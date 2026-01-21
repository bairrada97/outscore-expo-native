import type { Fixture, FixturesResponse } from "@outscore/shared-types";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
	calculateDivisionOffset,
	calculateExpectedScore,
	calculateStartingElo,
	inferDivisionLevel,
	updateElo,
} from "../src/modules/elo/elo-engine";
import { getFootballApiFixturesByLeagueSeason } from "../src/pkg/util/football-api";
import { detectMatchType } from "./lib/elo-utils";

type EvalRow = {
	fixtureId: number;
	date: string;
	leagueId: number;
	season: number;
	matchType: string;
	probHomeWin: number;
	probDraw: number;
	probAwayWin: number;
	actual: "HOME" | "DRAW" | "AWAY";
};

type UefaPriorsPayload = {
	asOfSeason: number;
	associations: Array<{
		countryCode: string;
		rank?: number | null;
		coefficient5y?: number | null;
	}>;
	clubs: Array<{
		uefaClubKey: string;
		name: string;
		countryCode?: string | null;
		coefficient?: number | null;
	}>;
	clubTeamMap: Array<{
		uefaClubKey: string;
		apiFootballTeamId: number;
		confidence?: number | null;
		method?: string | null;
	}>;
};

type EloState = {
	elo: number;
	games: number;
	asOf: string;
};

const FINISHED_STATUSES = new Set(["FT", "AET", "PEN"]);
const REQUEST_DELAY_MS = 250;
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 500;

const parseArg = (args: string[], key: string) => {
	const index = args.findIndex((a) => a === key);
	if (index === -1) return null;
	return args[index + 1] ?? null;
};

const parseLeagueIds = (raw: string | null) => {
	if (!raw) return [];
	return raw
		.split(",")
		.map((id) => Number(id.trim()))
		.filter((id) => Number.isFinite(id));
};

const parseSeasons = (args: string[]) => {
	const seasonsRaw = parseArg(args, "--seasons");
	if (seasonsRaw) {
		return seasonsRaw
			.split(",")
			.map((season) => Number(season.trim()))
			.filter((season) => Number.isInteger(season));
	}

	const fromSeasonRaw = parseArg(args, "--from-season");
	const toSeasonRaw = parseArg(args, "--to-season");
	const fromSeason = Number(fromSeasonRaw);
	const toSeason = Number(toSeasonRaw);

	if (
		!fromSeasonRaw ||
		!toSeasonRaw ||
		!Number.isInteger(fromSeason) ||
		!Number.isInteger(toSeason) ||
		fromSeason > toSeason
	) {
		return [];
	}

	const seasons: number[] = [];
	for (let season = fromSeason; season <= toSeason; season += 1) {
		seasons.push(season);
	}
	return seasons;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const shouldRetryRequest = (error: unknown) => {
	const message =
		error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
	const statusMatch = message.match(/\b([45]\d{2})\b/);
	const status = statusMatch ? Number(statusMatch[1]) : null;
	if (status === 429 || (status !== null && status >= 500)) {
		return true;
	}
	return (
		message.includes("too many requests") ||
		message.includes("rate limit") ||
		message.includes("service unavailable") ||
		message.includes("bad gateway") ||
		message.includes("gateway timeout")
	);
};

const fetchFixturesWithRetry = async (
	leagueId: number,
	season: number,
	apiUrl?: string,
	apiKey?: string,
): Promise<FixturesResponse> => {
	for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
		try {
			return await getFootballApiFixturesByLeagueSeason(
				leagueId,
				season,
				apiUrl,
				apiKey,
			);
		} catch (error) {
			if (attempt >= MAX_RETRIES || !shouldRetryRequest(error)) {
				throw error;
			}
			const delay = RETRY_BASE_MS * 2 ** attempt;
			console.warn(
				`⚠️ [Calibration] Retry ${attempt + 1}/${MAX_RETRIES} for league=${leagueId} season=${season} in ${delay}ms.`,
			);
			await sleep(delay);
		}
	}
	throw new Error("Failed to fetch fixtures after retries.");
};

const loadPriorsPayload = (payloadPath: string): UefaPriorsPayload => {
	const content = readFileSync(payloadPath, "utf-8");
	const parsed = JSON.parse(content);
	return parsed as UefaPriorsPayload;
};

const buildPriorsIndex = (payload: UefaPriorsPayload) => {
	const association = new Map<string, number | null>();
	for (const assoc of payload.associations) {
		association.set(assoc.countryCode, assoc.coefficient5y ?? null);
	}

	const clubCoeff = new Map<
		string,
		{ coefficient: number | null; countryCode: string | null }
	>();
	for (const club of payload.clubs) {
		clubCoeff.set(club.uefaClubKey, {
			coefficient: club.coefficient ?? null,
			countryCode: club.countryCode ?? null,
		});
	}

	const teamToClub = new Map<number, string>();
	for (const map of payload.clubTeamMap) {
		teamToClub.set(map.apiFootballTeamId, map.uefaClubKey);
	}

	return { association, clubCoeff, teamToClub };
};

const resolveStartingElo = (params: {
	apiFootballTeamId: number;
	priors: ReturnType<typeof buildPriorsIndex>;
	leagueName?: string | null;
	applyDivisionOffset: boolean;
}): number => {
	const clubKey = params.priors.teamToClub.get(params.apiFootballTeamId);
	const divisionOffset = params.applyDivisionOffset
		? calculateDivisionOffset(inferDivisionLevel(params.leagueName))
		: 0;
	if (!clubKey) {
		return calculateStartingElo({ divisionOffset });
	}

	const club = params.priors.clubCoeff.get(clubKey);
	const assocCoeff = club?.countryCode
		? params.priors.association.get(club.countryCode)
		: null;

	return calculateStartingElo({
		associationCoefficient5y: assocCoeff ?? null,
		clubCoefficient: club?.coefficient ?? null,
		divisionOffset,
	});
};

const normalizeDate = (value: string) => value.split("T")[0] ?? value;

const getActualOutcome = (fixture: Fixture): EvalRow["actual"] => {
	const home = fixture.goals.home ?? 0;
	const away = fixture.goals.away ?? 0;
	if (home > away) return "HOME";
	if (home < away) return "AWAY";
	return "DRAW";
};

const clamp = (value: number, min: number, max: number) =>
	Math.max(min, Math.min(max, value));

const computeDrawProbability = (eloGap: number) => {
	const base = 0.28 * Math.exp(-Math.abs(eloGap) / 400);
	return clamp(base, 0.12, 0.35);
};

const buildEloOnlyProbs = (homeElo: number, awayElo: number) => {
	const expectedHome = calculateExpectedScore(homeElo, awayElo);
	const draw = computeDrawProbability(homeElo - awayElo);
	const home = (1 - draw) * expectedHome;
	const away = (1 - draw) * (1 - expectedHome);
	return { home, draw, away };
};

const main = async () => {
	const args = process.argv.slice(2);
	const leagueIds = parseLeagueIds(parseArg(args, "--league-ids"));
	const seasons = parseSeasons(args);
	const outputPath =
		parseArg(args, "--output") ??
		resolve(__dirname, "calibration-eval-elo.json");
	const payloadPath =
		parseArg(args, "--payload") ??
		resolve(__dirname, "../../../docs/plans/uefa-priors-payload.json");

	if (!leagueIds.length || !seasons.length) {
		throw new Error(
			"Usage: --league-ids 39,140 --seasons 2024,2025 [--payload path] [--output path] (or --from-season 2024 --to-season 2025)",
		);
	}

	const payload = loadPriorsPayload(payloadPath);
	const priors = buildPriorsIndex(payload);

	const apiUrl = process.env.FOOTBALL_API_URL;
	const apiKey = process.env.RAPIDAPI_KEY;

	const evalRows: EvalRow[] = [];

	for (const leagueId of leagueIds) {
		for (const season of seasons) {
			const data = await fetchFixturesWithRetry(
				leagueId,
				season,
				apiUrl,
				apiKey,
			);
			await sleep(REQUEST_DELAY_MS);

			const fixtures = (data.response ?? [])
				.filter((fixture) =>
					FINISHED_STATUSES.has(fixture.fixture.status.short),
				)
				.filter(
					(fixture) =>
						fixture.goals.home !== null && fixture.goals.away !== null,
				)
				.sort(
					(a, b) =>
						new Date(a.fixture.date).getTime() -
						new Date(b.fixture.date).getTime(),
				);

			if (!fixtures.length) {
				continue;
			}

			const eloState = new Map<number, EloState>();

			for (const fixture of fixtures) {
				const homeId = fixture.teams.home.id;
				const awayId = fixture.teams.away.id;
				const matchType = detectMatchType(fixture.league.name);
				const applyDivisionOffset = matchType === "LEAGUE";

				const homeEloState = eloState.get(homeId) ?? {
					elo: resolveStartingElo({
						apiFootballTeamId: homeId,
						priors,
						leagueName: fixture.league.name,
						applyDivisionOffset,
					}),
					games: 0,
					asOf: fixture.fixture.date,
				};
				const awayEloState = eloState.get(awayId) ?? {
					elo: resolveStartingElo({
						apiFootballTeamId: awayId,
						priors,
						leagueName: fixture.league.name,
						applyDivisionOffset,
					}),
					games: 0,
					asOf: fixture.fixture.date,
				};

				const probs = buildEloOnlyProbs(homeEloState.elo, awayEloState.elo);

				evalRows.push({
					fixtureId: fixture.fixture.id,
					date: normalizeDate(fixture.fixture.date),
					leagueId,
					season,
					matchType,
					probHomeWin: probs.home,
					probDraw: probs.draw,
					probAwayWin: probs.away,
					actual: getActualOutcome(fixture),
				});

				const goalDiff = (fixture.goals.home ?? 0) - (fixture.goals.away ?? 0);
				const update = updateElo({
					homeElo: homeEloState.elo,
					awayElo: awayEloState.elo,
					matchType,
					goalDiff,
				});
				eloState.set(homeId, {
					elo: update.homeElo,
					games: homeEloState.games + 1,
					asOf: fixture.fixture.date,
				});
				eloState.set(awayId, {
					elo: update.awayElo,
					games: awayEloState.games + 1,
					asOf: fixture.fixture.date,
				});
			}
		}
	}

	writeFileSync(outputPath, JSON.stringify(evalRows, null, 2));
	console.log(`✅ [Calibration] Wrote ${evalRows.length} rows to ${outputPath}`);
};

main().catch((error) => {
	console.error("❌ [Calibration] Export failed:", error);
	process.exit(1);
});

import type { Fixture, FixturesResponse } from "@outscore/shared-types";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
	buildGoalDistributionModifiers,
	insightsService,
	simulateMatchOutcome,
	type ProcessedMatch,
} from "../src/modules/betting-insights";
import { buildMatchContext } from "../src/modules/betting-insights/match-context/context-adjustments";
import { extractRoundNumber } from "../src/modules/betting-insights/utils/helpers";
import { processH2HData } from "../src/modules/betting-insights/utils/h2h-helpers";
import {
	calculateDivisionOffset,
	calculateEloConfidence,
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
const MAX_MATCH_HISTORY = 50;
const MAX_H2H_HISTORY = 10;
const STATS_CONCURRENCY = 4;

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

const toProb = (value?: number) => {
	const safe = Number.isFinite(value) ? Number(value) : 0;
	return Math.max(0, Math.min(1, safe / 100));
};

const buildProcessedMatch = (fixture: Fixture, teamId: number): ProcessedMatch =>
	insightsService.convertToProcessedMatch(
		fixture as Parameters<typeof insightsService.convertToProcessedMatch>[0],
		teamId,
	);

const fetchTeamStats = async (
	teamId: number,
	leagueId: number,
	season: number,
	apiUrl?: string,
	apiKey?: string,
): Promise<unknown | null> => {
	if (!apiUrl || !apiKey) {
		throw new Error("API URL or API Key not provided");
	}
	const url = new URL(`${apiUrl}/teams/statistics`);
	url.searchParams.append("team", teamId.toString());
	url.searchParams.append("league", leagueId.toString());
	url.searchParams.append("season", season.toString());
	try {
		const response = await fetch(url.toString(), {
			headers: {
				"x-rapidapi-host": "api-football-v1.p.rapidapi.com",
				"x-rapidapi-key": apiKey,
			},
		});
		if (!response.ok) {
			console.warn(`⚠️ [Calibration] Failed to fetch stats for team ${teamId}`);
			return null;
		}
		const data = (await response.json()) as { response: unknown };
		return data.response ?? null;
	} catch (error) {
		console.warn(
			`⚠️ [Calibration] Error fetching stats for team ${teamId}:`,
			error,
		);
		return null;
	}
};

const buildTeamStatsCache = async (params: {
	teamIds: number[];
	leagueId: number;
	season: number;
	apiUrl?: string;
	apiKey?: string;
}) => {
	const cache = new Map<number, unknown | null>();
	let nextIndex = 0;

	const workers = Array.from(
		{ length: Math.min(STATS_CONCURRENCY, params.teamIds.length) },
		async () => {
			while (nextIndex < params.teamIds.length) {
				const idx = nextIndex;
				nextIndex += 1;
				const teamId = params.teamIds[idx];
				const stats = await fetchTeamStats(
					teamId,
					params.leagueId,
					params.season,
					params.apiUrl,
					params.apiKey,
				);
				cache.set(teamId, stats);
				await sleep(REQUEST_DELAY_MS);
			}
		},
	);

	await Promise.all(workers);
	return cache;
};

const computeLeagueStats = (fixtures: Fixture[]) => {
	let goals = 0;
	let matches = 0;
	for (const fixture of fixtures) {
		if (!FINISHED_STATUSES.has(fixture.fixture.status.short)) continue;
		if (fixture.goals.home === null || fixture.goals.away === null) continue;
		goals += fixture.goals.home + fixture.goals.away;
		matches += 1;
	}
	return {
		avgGoals: matches > 0 ? goals / matches : 0,
		matches,
	};
};

const main = async () => {
	const args = process.argv.slice(2);
	const leagueIds = parseLeagueIds(parseArg(args, "--league-ids"));
	const seasons = parseSeasons(args);
	const outputPath =
		parseArg(args, "--output") ??
		resolve(__dirname, "calibration-eval.json");
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
			const data = await fetchFixturesWithRetry(leagueId, season, apiUrl, apiKey);
			await sleep(REQUEST_DELAY_MS);

			const fixtures = (data.response ?? [])
				.filter((fixture) => FINISHED_STATUSES.has(fixture.fixture.status.short))
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

			const leagueStats = computeLeagueStats(fixtures);
			const teamIds = Array.from(
				new Set(
					fixtures.flatMap((fixture) => [
						fixture.teams.home.id,
						fixture.teams.away.id,
					]),
				),
			);
			const teamStatsCache = await buildTeamStatsCache({
				teamIds,
				leagueId,
				season,
				apiUrl,
				apiKey,
			});

			const teamHistory = new Map<number, ProcessedMatch[]>();
			const h2hHistory = new Map<string, Fixture[]>();
			const eloState = new Map<number, EloState>();

			for (const fixture of fixtures) {
				const homeId = fixture.teams.home.id;
				const awayId = fixture.teams.away.id;
				const key =
					homeId < awayId ? `${homeId}-${awayId}` : `${awayId}-${homeId}`;

				const homeMatches = teamHistory.get(homeId) ?? [];
				const awayMatches = teamHistory.get(awayId) ?? [];

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

				{
					const h2hRaw = h2hHistory.get(key) ?? [];
					const h2hMatches = h2hRaw.map((match) =>
						buildProcessedMatch(match, homeId),
					);
					const h2hData = processH2HData(h2hMatches, homeId, awayId);

					const homeElo = {
						rating: homeEloState.elo,
						games: homeEloState.games,
						asOf: homeEloState.asOf,
						confidence: calculateEloConfidence(homeEloState.games),
					};
					const awayElo = {
						rating: awayEloState.elo,
						games: awayEloState.games,
						asOf: awayEloState.asOf,
						confidence: calculateEloConfidence(awayEloState.games),
					};

					const homeTeam = insightsService.processTeamData(
						homeId,
						fixture.teams.home.name,
						(teamStatsCache.get(homeId) ?? null) as unknown,
						homeMatches,
						leagueId,
						null,
						homeElo,
					);
					const awayTeam = insightsService.processTeamData(
						awayId,
						fixture.teams.away.name,
						(teamStatsCache.get(awayId) ?? null) as unknown,
						awayMatches,
						leagueId,
						null,
						awayElo,
					);

					const roundNumber = extractRoundNumber(fixture.league.round);
					const context = buildMatchContext(
						fixture.league.name,
						fixture.league.round,
						homeId,
						awayId,
						fixture.teams.home.name,
						fixture.teams.away.name,
						{
							roundNumber,
							homeTeamData: homeTeam,
							awayTeamData: awayTeam,
							daysSinceLastMatch: Math.min(
								homeTeam.daysSinceLastMatch,
								awayTeam.daysSinceLastMatch,
							),
						},
					);

					const distributionModifiers = buildGoalDistributionModifiers({
						context,
						homeTeam,
						awayTeam,
						h2h: h2hData,
						leagueStats,
					});

					const simulation = simulateMatchOutcome(
						homeTeam,
						awayTeam,
						h2hData,
						context,
						undefined,
						undefined,
						distributionModifiers,
						{ skipCalibration: true },
					);

					evalRows.push({
						fixtureId: fixture.fixture.id,
						date: normalizeDate(fixture.fixture.date),
						leagueId,
						season,
						matchType: context.matchType.type,
						probHomeWin: toProb(simulation.probabilityDistribution.home),
						probDraw: toProb(simulation.probabilityDistribution.draw),
						probAwayWin: toProb(simulation.probabilityDistribution.away),
						actual: getActualOutcome(fixture),
					});
				}

				const goalDiff = (fixture.goals.home ?? 0) - (fixture.goals.away ?? 0);
				const update = updateElo({
					homeElo: homeEloState.elo,
					awayElo: awayEloState.elo,
					matchType,
					goalDiff,
				});
				const nextHome: EloState = {
					elo: update.homeElo,
					games: homeEloState.games + 1,
					asOf: fixture.fixture.date,
				};
				const nextAway: EloState = {
					elo: update.awayElo,
					games: awayEloState.games + 1,
					asOf: fixture.fixture.date,
				};
				eloState.set(homeId, nextHome);
				eloState.set(awayId, nextAway);

				const processedHome = buildProcessedMatch(fixture, homeId);
				const processedAway = buildProcessedMatch(fixture, awayId);
				const nextHomeHistory = [processedHome, ...homeMatches].slice(
					0,
					MAX_MATCH_HISTORY,
				);
				const nextAwayHistory = [processedAway, ...awayMatches].slice(
					0,
					MAX_MATCH_HISTORY,
				);
				teamHistory.set(homeId, nextHomeHistory);
				teamHistory.set(awayId, nextAwayHistory);

				const h2hRaw = h2hHistory.get(key) ?? [];
				if (h2hRaw.length >= MAX_H2H_HISTORY) {
					h2hRaw.pop();
				}
				h2hRaw.unshift(fixture);
				h2hHistory.set(key, h2hRaw);
			}
		}
	}

	writeFileSync(outputPath, JSON.stringify(evalRows, null, 2));
	console.log(
		`✅ [Calibration] Wrote ${evalRows.length} rows to ${outputPath}`,
	);
};

main().catch((error) => {
	console.error("❌ [Calibration] Export failed:", error);
	process.exit(1);
});

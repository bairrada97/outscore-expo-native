import type { FixturesResponse } from "@outscore/shared-types";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
	calculateDivisionOffset,
	calculateStartingElo,
	inferDivisionLevel,
	updateElo,
} from "../src/modules/elo/elo-engine";
import { getFootballApiFixturesByLeagueSeason } from "../src/pkg/util/football-api";
import {
	buildCurrentUpsertSql,
	buildInsertSql,
	buildWranglerArgs,
	detectMatchType,
	loadRows,
} from "./lib/elo-utils";

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

const getFixturesWithRetry = async (
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
				`⚠️ [Backfill] Retry ${attempt + 1}/${MAX_RETRIES} for league=${leagueId} season=${season} in ${delay}ms.`,
			);
			await sleep(delay);
		}
	}
	throw new Error("Failed to fetch fixtures after retries.");
};

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

const hasFlag = (args: string[], key: string) => args.includes(key);


const loadPriorsPayload = (payloadPath: string): UefaPriorsPayload => {
	const content = readFileSync(payloadPath, "utf-8");
	const parsed = JSON.parse(content);
	if (!parsed || typeof parsed !== "object") {
		throw new Error("Invalid UEFA priors payload: expected object.");
	}
	const payload = parsed as Partial<UefaPriorsPayload>;
	if (!Array.isArray(payload.associations)) {
		throw new Error("Invalid UEFA priors payload: associations must be an array.");
	}
	if (!Array.isArray(payload.clubs)) {
		throw new Error("Invalid UEFA priors payload: clubs must be an array.");
	}
	if (!Array.isArray(payload.clubTeamMap)) {
		throw new Error("Invalid UEFA priors payload: clubTeamMap must be an array.");
	}

	for (const assoc of payload.associations) {
		if (!assoc || typeof assoc !== "object" || typeof assoc.countryCode !== "string") {
			throw new Error(
				"Invalid UEFA priors payload: association.countryCode must be a string.",
			);
		}
	}
	for (const club of payload.clubs) {
		if (
			!club ||
			typeof club !== "object" ||
			typeof club.uefaClubKey !== "string" ||
			typeof club.name !== "string"
		) {
			throw new Error(
				"Invalid UEFA priors payload: clubs require uefaClubKey and name.",
			);
		}
	}
	for (const map of payload.clubTeamMap) {
		if (
			!map ||
			typeof map !== "object" ||
			typeof map.uefaClubKey !== "string" ||
			!Number.isFinite(map.apiFootballTeamId)
		) {
			throw new Error(
				"Invalid UEFA priors payload: clubTeamMap requires uefaClubKey and apiFootballTeamId.",
			);
		}
	}

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


const loadExternalTeamMap = (params: {
	dbName: string;
	configPath?: string | null;
	isRemote?: boolean;
}) => {
	const rows = loadRows([
		...buildWranglerArgs({
			dbName: params.dbName,
			configPath: params.configPath,
			isRemote: params.isRemote,
		}),
		"--command",
		"SELECT provider_id, internal_id FROM external_ids WHERE provider = 'api_football' AND entity_type = 'team'",
		"--json",
	]);

	const map = new Map<number, number>();
	for (const row of rows) {
		const providerId = Number(row.provider_id);
		const internalId = Number(row.internal_id);
		if (Number.isFinite(providerId) && Number.isFinite(internalId)) {
			map.set(providerId, internalId);
		}
	}
	return map;
};

const loadCurrentEloState = (params: {
	dbName: string;
	configPath?: string | null;
	isRemote?: boolean;
}) => {
	try {
		const rows = loadRows([
			...buildWranglerArgs({
				dbName: params.dbName,
				configPath: params.configPath,
				isRemote: params.isRemote,
			}),
			"--command",
			"SELECT team_id, elo, games, as_of_date FROM team_elo_current",
			"--json",
		]);

		const map = new Map<number, EloState>();
		for (const row of rows) {
			const teamId = Number(row.team_id);
			if (!Number.isFinite(teamId)) continue;
			map.set(teamId, {
				elo: Number(row.elo),
				games: Number(row.games),
				asOf: String(row.as_of_date ?? ""),
			});
		}
		return map;
	} catch (error) {
		console.warn(
			"⚠️ Failed to load team_elo_current. Starting from priors.",
			error,
		);
		return new Map<number, EloState>();
	}
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

const main = async () => {
	const args = process.argv.slice(2);
	const leagueIds = parseLeagueIds(parseArg(args, "--league-ids"));
	const fromSeasonRaw = parseArg(args, "--from-season");
	const toSeasonRaw = parseArg(args, "--to-season");
	const fromSeason = Number(fromSeasonRaw);
	const toSeason = Number(toSeasonRaw);
	const payloadPath =
		parseArg(args, "--payload") ??
		resolve(__dirname, "../../../docs/plans/uefa-priors-payload.json");
	const outputPath =
		parseArg(args, "--output") ?? resolve(__dirname, "elo-backfill.sql");
	const dbName = parseArg(args, "--db");
	const apply = args.includes("--apply");
	const configPath =
		parseArg(args, "--config") ?? resolve(__dirname, "../wrangler.toml");
	const isRemote = hasFlag(args, "--remote");
	const resume = hasFlag(args, "--resume");

	if (
		!leagueIds.length ||
		!fromSeasonRaw ||
		!toSeasonRaw ||
		!Number.isInteger(fromSeason) ||
		!Number.isInteger(toSeason) ||
		fromSeason > toSeason ||
		!dbName
	) {
		throw new Error(
			"Usage: --league-ids 39,140 --from-season 2021 --to-season 2025 --db ENTITIES_DB [--payload path] [--output path] [--config path] [--remote] [--resume] [--apply] (seasons must be integers with from-season <= to-season)",
		);
	}

	const payload = loadPriorsPayload(payloadPath);
	const priors = buildPriorsIndex(payload);
	const externalTeamMap = loadExternalTeamMap({
		dbName,
		configPath,
		isRemote,
	});
	if (externalTeamMap.size === 0) {
		console.warn(
			"⚠️ No external team mappings found. Check ENTITIES_DB and --remote/--config.",
		);
	}

	const eloState = resume
		? loadCurrentEloState({ dbName, configPath, isRemote })
		: new Map<number, EloState>();
	if (resume && eloState.size > 0) {
		console.log(`✅ Resume mode: loaded ${eloState.size} current Elo rows.`);
	}
	if (resume) {
		console.warn(
			"⚠️ Resume mode uses current Elo as starting state. Historical backfills may be approximate.",
		);
	}
	const inserts: Array<{
		teamId: number;
		asOf: string;
		elo: number;
		games: number;
		fixtureId: number;
	}> = [];

	for (let season = fromSeason; season <= toSeason; season += 1) {
		for (const leagueId of leagueIds) {
			const data = await getFixturesWithRetry(
				leagueId,
				season,
				process.env.FOOTBALL_API_URL,
				process.env.RAPIDAPI_KEY,
			);
			await sleep(REQUEST_DELAY_MS);

			const fixtures = data.response
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

			for (const fixture of fixtures) {
				const homeId = externalTeamMap.get(fixture.teams.home.id);
				const awayId = externalTeamMap.get(fixture.teams.away.id);
				if (!homeId || !awayId) continue;

				const matchType = detectMatchType(fixture.league.name);
				const applyDivisionOffset = matchType === "LEAGUE";
				const homeState = eloState.get(homeId) ?? {
					elo: resolveStartingElo({
						apiFootballTeamId: fixture.teams.home.id,
						priors,
						leagueName: fixture.league.name,
						applyDivisionOffset,
					}),
					games: 0,
					asOf: fixture.fixture.date,
				};
				const awayState = eloState.get(awayId) ?? {
					elo: resolveStartingElo({
						apiFootballTeamId: fixture.teams.away.id,
						priors,
						leagueName: fixture.league.name,
						applyDivisionOffset,
					}),
					games: 0,
					asOf: fixture.fixture.date,
				};

				const goalDiff = (fixture.goals.home ?? 0) - (fixture.goals.away ?? 0);
				const update = updateElo({
					homeElo: homeState.elo,
					awayElo: awayState.elo,
					matchType,
					goalDiff,
				});

				const nextHome: EloState = {
					elo: update.homeElo,
					games: homeState.games + 1,
					asOf: fixture.fixture.date,
				};
				const nextAway: EloState = {
					elo: update.awayElo,
					games: awayState.games + 1,
					asOf: fixture.fixture.date,
				};

				eloState.set(homeId, nextHome);
				eloState.set(awayId, nextAway);

				inserts.push({
					teamId: homeId,
					asOf: fixture.fixture.date,
					elo: nextHome.elo,
					games: nextHome.games,
					fixtureId: fixture.fixture.id,
				});
				inserts.push({
					teamId: awayId,
					asOf: fixture.fixture.date,
					elo: nextAway.elo,
					games: nextAway.games,
					fixtureId: fixture.fixture.id,
				});
			}
		}
	}

	const sql = buildInsertSql(inserts);
	const currentRows = Array.from(eloState.entries()).map(([teamId, state]) => ({
		teamId,
		elo: state.elo,
		games: state.games,
		asOf: state.asOf,
	}));
	const currentSql = buildCurrentUpsertSql(currentRows);
	writeFileSync(outputPath, sql);
	if (currentSql) {
		writeFileSync(outputPath, `\n${currentSql}`, { flag: "a" });
	}
	console.log(`✅ wrote ${inserts.length} Elo inserts to ${outputPath}`);

	if (apply) {
		if (!inserts.length) {
			console.warn("⚠️ No inserts generated; skipping D1 apply.");
			return;
		}

		execFileSync(
			"bunx",
			[
				...buildWranglerArgs({ dbName, configPath, isRemote }),
				"--file",
				outputPath,
			],
			{ stdio: "inherit" },
		);
	}
};

main().catch((error) => {
	console.error("❌ Elo backfill failed:", error);
	process.exit(1);
});

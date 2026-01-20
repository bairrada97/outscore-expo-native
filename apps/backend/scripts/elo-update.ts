import {
	closeSync,
	fsyncSync,
	openSync,
	renameSync,
	writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import {
	getFootballApiFixturesByDateRange,
} from "../src/pkg/util/football-api";
import {
	calculateDivisionOffset,
	inferDivisionLevel,
	updateElo,
} from "../src/modules/elo/elo-engine";
import {
	buildCurrentUpsertSql,
	buildInsertSql,
	buildWranglerArgs,
	detectMatchType,
	loadRows,
} from "./lib/elo-utils";

type EloState = {
	elo: number;
	games: number;
	asOf: string;
};

const FINISHED_STATUSES = new Set(["FT", "AET", "PEN"]);

const parseArg = (args: string[], key: string) => {
	const index = args.findIndex((a) => a === key);
	if (index === -1) return null;
	return args[index + 1] ?? null;
};

const hasFlag = (args: string[], key: string) => args.includes(key);

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

const loadLatestElo = (params: {
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
		`SELECT t1.team_id, t1.elo, t1.games, t2.max_date FROM team_elo_ratings t1
		 JOIN (
		   SELECT team_id, MAX(as_of_date) AS max_date
		   FROM team_elo_ratings
		   GROUP BY team_id
		 ) t2
		 ON t1.team_id = t2.team_id AND t1.as_of_date = t2.max_date`,
		"--json",
	]);
	const map = new Map<number, EloState>();
	for (const row of rows) {
		const teamId = Number(row.team_id);
		if (!Number.isFinite(teamId)) continue;
		map.set(teamId, {
			elo: Number(row.elo),
			games: Number(row.games),
			asOf: String(row.max_date ?? ""),
		});
	}
	return map;
};

const loadProcessedFixtureIds = (params: {
	dbName: string;
	configPath?: string | null;
	isRemote?: boolean;
	fromDate: string,
	toDate: string,
}) => {
	const rows = loadRows([
		...buildWranglerArgs({
			dbName: params.dbName,
			configPath: params.configPath,
			isRemote: params.isRemote,
		}),
		"--command",
		`SELECT DISTINCT last_fixture_id FROM team_elo_ratings
		 WHERE as_of_date >= '${params.fromDate}' AND as_of_date <= '${params.toDate}'`,
		"--json",
	]);
	return new Set(rows.map((row: { last_fixture_id: string }) => row.last_fixture_id));
};


const main = async () => {
	const args = process.argv.slice(2);
	const fromDate = parseArg(args, "--from");
	const toDate = parseArg(args, "--to");
	const dbName = parseArg(args, "--db");
	const outputPath =
		parseArg(args, "--output") ??
		resolve(__dirname, "elo-update.sql");
	const apply = args.includes("--apply");
	const configPath =
		parseArg(args, "--config") ?? resolve(__dirname, "../wrangler.toml");
	const isRemote = hasFlag(args, "--remote");

	if (!fromDate || !toDate || !dbName) {
		throw new Error(
			"Usage: --from YYYY-MM-DD --to YYYY-MM-DD --db ENTITIES_DB [--output path] [--config path] [--remote] [--apply]",
		);
	}

	const externalTeamMap = loadExternalTeamMap({ dbName, configPath, isRemote });
	const eloState = loadLatestElo({ dbName, configPath, isRemote });
	const processed = loadProcessedFixtureIds({
		dbName,
		configPath,
		isRemote,
		fromDate,
		toDate,
	});

	const data = await getFootballApiFixturesByDateRange(
		fromDate,
		toDate,
		process.env.FOOTBALL_API_URL,
		process.env.RAPIDAPI_KEY,
	);

	const fixtures = data.response
		.filter((fixture) => FINISHED_STATUSES.has(fixture.fixture.status.short))
		.filter((fixture) => fixture.goals.home !== null && fixture.goals.away !== null)
		.filter((fixture) => !processed.has(String(fixture.fixture.id)))
		.sort((a, b) => new Date(a.fixture.date).getTime() - new Date(b.fixture.date).getTime());

	const inserts: Array<{
		teamId: number;
		asOf: string;
		elo: number;
		games: number;
		fixtureId: number;
	}> = [];
	const touchedTeams = new Set<number>();

	for (const fixture of fixtures) {
		const homeId = externalTeamMap.get(fixture.teams.home.id);
		const awayId = externalTeamMap.get(fixture.teams.away.id);
		if (!homeId || !awayId) {
			console.warn(
				`⚠️ Missing team mapping for fixture ${fixture.fixture.id} (${fixture.fixture.date}): home=${fixture.teams.home.id}, away=${fixture.teams.away.id}`,
			);
			continue;
		}

		const matchType = detectMatchType(fixture.league.name);
		const baseDivisionOffset =
			matchType === "LEAGUE"
				? calculateDivisionOffset(inferDivisionLevel(fixture.league.name))
				: 0;
		const homeState =
			eloState.get(homeId) ?? {
				elo: 1500 + baseDivisionOffset,
				games: 0,
				asOf: fixture.fixture.date,
			};
		const awayState =
			eloState.get(awayId) ?? {
				elo: 1500 + baseDivisionOffset,
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
		touchedTeams.add(homeId);
		touchedTeams.add(awayId);

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

	const sql = buildInsertSql(inserts);
	const currentRows = Array.from(touchedTeams.values())
		.map((teamId) => {
			const state = eloState.get(teamId);
			if (!state) return null;
			return {
				teamId,
				elo: state.elo,
				games: state.games,
				asOf: state.asOf,
			};
		})
		.filter((row): row is NonNullable<typeof row> => Boolean(row));
	const currentSql = buildCurrentUpsertSql(currentRows);
	const combinedSql = currentSql ? `${sql}\n${currentSql}` : sql;
	const tmpPath = `${outputPath}.tmp`;
	writeFileSync(tmpPath, combinedSql);
	const fd = openSync(tmpPath, "r+");
	fsyncSync(fd);
	closeSync(fd);
	renameSync(tmpPath, outputPath);
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
	console.error("❌ Elo update failed:", error);
	process.exit(1);
});

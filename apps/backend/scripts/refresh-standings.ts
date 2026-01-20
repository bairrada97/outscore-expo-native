import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import type { StandingsResponse } from "@outscore/shared-types";
import { getFootballApiStandings } from "../src/pkg/util/football-api";

type CliArgs = {
	leagueId: number;
	season: number;
	dbName: string;
	configPath: string;
	isRemote: boolean;
	apply: boolean;
	outputPath: string;
};

const parseArg = (args: string[], key: string) => {
	const index = args.findIndex((a) => a === key);
	if (index === -1) return null;
	return args[index + 1] ?? null;
};

const hasFlag = (args: string[], key: string) => args.includes(key);

const buildWranglerArgs = (params: {
	dbName: string;
	configPath?: string | null;
	isRemote?: boolean;
}): string[] => {
	const base = ["wrangler", "d1", "execute", params.dbName];
	if (params.configPath) {
		base.push("--config", params.configPath);
	}
	if (params.isRemote) {
		base.push("--remote");
	}
	return base;
};

const extractWranglerResults = (payload: unknown): Array<Record<string, unknown>> => {
	if (Array.isArray(payload)) {
		return (payload[0]?.results as Array<Record<string, unknown>>) ?? [];
	}
	const parsed = payload as {
		result?: Array<{ results?: Array<Record<string, unknown>> }>;
		results?: Array<Record<string, unknown>>;
	};
	return parsed?.result?.[0]?.results ?? parsed?.results ?? [];
};

const loadRows = (args: string[]) => {
	const raw = execFileSync("bunx", args, { encoding: "utf-8" });
	const parsed = JSON.parse(raw);
	return extractWranglerResults(parsed);
};

const escapeSqlString = (value: string) =>
	value.replace(/'/g, "''").split("\u0000").join("");

const sqlValue = (value: string | number | null | undefined) => {
	if (value === null || value === undefined) return "NULL";
	if (typeof value === "number" && Number.isFinite(value)) return String(value);
	return `'${escapeSqlString(String(value))}'`;
};

const parseArgs = (): CliArgs => {
	const args = process.argv.slice(2);
	const leagueId = Number(parseArg(args, "--league-id"));
	const season = Number(parseArg(args, "--season"));
	const dbName = parseArg(args, "--db") ?? "ENTITIES_DB";
	const configPath =
		parseArg(args, "--config") ?? resolve(__dirname, "../wrangler.toml");
	const outputPath =
		parseArg(args, "--output") ?? resolve(__dirname, "standings-refresh.sql");

	if (!Number.isFinite(leagueId) || !Number.isFinite(season)) {
		throw new Error(
			"Usage: --league-id <id> --season <year> [--db ENTITIES_DB] [--config path] [--remote] [--apply] [--output path]",
		);
	}

	return {
		leagueId,
		season,
		dbName,
		configPath,
		isRemote: hasFlag(args, "--remote"),
		apply: hasFlag(args, "--apply"),
		outputPath,
	};
};

const loadTeamMap = (params: {
	dbName: string;
	configPath: string;
	isRemote: boolean;
}) => {
	const rows = loadRows([
		...buildWranglerArgs(params),
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

const loadLeagueInternalId = (params: {
	dbName: string;
	configPath: string;
	isRemote: boolean;
	leagueId: number;
}) => {
	const rows = loadRows([
		...buildWranglerArgs(params),
		"--command",
		`SELECT internal_id FROM external_ids WHERE provider = 'api_football' AND entity_type = 'league' AND provider_id = '${params.leagueId}' LIMIT 1`,
		"--json",
	]);
	const id = rows[0]?.internal_id;
	return typeof id === "number" ? id : Number(id);
};

const buildSql = (params: {
	internalLeagueId: number;
	season: number;
	rows: Array<{
		teamId: number;
		rank: number;
		points: number;
		played: number;
		win: number;
		draw: number;
		loss: number;
		goalsFor: number;
		goalsAgainst: number;
		goalDiff: number;
		form: string | null;
		groupName: string | null;
		description: string | null;
		teamName: string | null;
		leagueName: string | null;
	}>;
}) => {
	const statements: string[] = [];
	statements.push(
		`INSERT INTO standings_current (league_id, season, provider, fetched_at)
VALUES (${params.internalLeagueId}, ${params.season}, 'api_football', datetime('now'))
ON CONFLICT(league_id, season)
DO UPDATE SET provider = excluded.provider, fetched_at = excluded.fetched_at, updated_at = datetime('now');`,
	);
	statements.push(
		`DELETE FROM standings_current_row WHERE league_id = ${params.internalLeagueId} AND season = ${params.season};`,
	);

	for (const row of params.rows) {
		statements.push(
			`INSERT INTO standings_current_row
 (league_id, season, team_id, rank, points, played, win, draw, loss, goals_for, goals_against, goal_diff, form, group_name, description, team_name, league_name)
 VALUES (${params.internalLeagueId}, ${params.season}, ${row.teamId}, ${row.rank}, ${row.points}, ${row.played}, ${row.win}, ${row.draw}, ${row.loss}, ${row.goalsFor}, ${row.goalsAgainst}, ${row.goalDiff}, ${sqlValue(row.form)}, ${sqlValue(row.groupName)}, ${sqlValue(row.description)}, ${sqlValue(row.teamName)}, ${sqlValue(row.leagueName)});`,
		);
	}

	return statements.join("\n");
};

const main = async () => {
	const args = parseArgs();

	const standings: StandingsResponse = await getFootballApiStandings(
		args.leagueId,
		args.season,
		process.env.FOOTBALL_API_URL,
		process.env.RAPIDAPI_KEY,
	);

	if (!standings.response?.length) {
		throw new Error("No standings data returned from API-Football.");
	}

	const leagueData = standings.response[0].league;
	if (!leagueData.standings?.length) {
		throw new Error("Standings response is empty.");
	}

	const internalLeagueId = loadLeagueInternalId({
		dbName: args.dbName,
		configPath: args.configPath,
		isRemote: args.isRemote,
		leagueId: args.leagueId,
	});

	if (!Number.isFinite(internalLeagueId)) {
		throw new Error(
			`League ${args.leagueId} not found in external_ids. Run leagues registry ingestion first.`,
		);
	}

	const teamMap = loadTeamMap({
		dbName: args.dbName,
		configPath: args.configPath,
		isRemote: args.isRemote,
	});

	const flattened = leagueData.standings.flat();
	const byGroupTeam = new Map<string, (typeof flattened)[number]>();
	for (const row of flattened) {
		const groupName = row.group ?? "";
		const key = `${groupName}::${row.team.id}`;
		const existing = byGroupTeam.get(key);
		if (!existing || row.rank < existing.rank) {
			byGroupTeam.set(key, row);
		}
	}
	const allRows = Array.from(byGroupTeam.values());

	const missingTeams: number[] = [];
	const mappedRows = allRows
		.map((row) => {
			const internalTeamId = teamMap.get(row.team.id);
			if (!internalTeamId) {
				missingTeams.push(row.team.id);
				return null;
			}
			return {
				teamId: internalTeamId,
				rank: row.rank,
				points: row.points ?? 0,
				played: row.all.played ?? 0,
				win: row.all.win ?? 0,
				draw: row.all.draw ?? 0,
				loss: row.all.lose ?? 0,
				goalsFor: row.all.goals.for ?? 0,
				goalsAgainst: row.all.goals.against ?? 0,
				goalDiff: row.goalsDiff ?? 0,
				form: row.form ?? null,
				groupName: row.group ?? null,
				description: row.description ?? null,
				teamName: row.team.name ?? null,
				leagueName: leagueData.name ?? null,
			};
		})
		.filter((row): row is NonNullable<typeof row> => Boolean(row));

	if (missingTeams.length > 0) {
		console.warn(
			`⚠️ Missing ${missingTeams.length} team mappings in external_ids (league ${args.leagueId}).`,
		);
	}

	const sql = buildSql({
		internalLeagueId,
		season: leagueData.season,
		rows: mappedRows,
	});

	writeFileSync(args.outputPath, sql);
	console.log(
		`✅ Wrote ${mappedRows.length} standings rows to ${args.outputPath}`,
	);

	if (args.apply) {
		execFileSync(
			"bunx",
			[
				...buildWranglerArgs({
					dbName: args.dbName,
					configPath: args.configPath,
					isRemote: args.isRemote,
				}),
				"--file",
				args.outputPath,
			],
			{ stdio: "inherit" },
		);
	}
};

main().catch((error) => {
	console.error("❌ Standings refresh failed:", error);
	process.exit(1);
});

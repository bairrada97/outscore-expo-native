import { execFileSync } from "node:child_process";

type WranglerResultRow = Record<string, unknown>;

export const extractWranglerResults = (
	payload: unknown,
): Array<WranglerResultRow> => {
	if (Array.isArray(payload)) {
		return (payload[0]?.results as Array<WranglerResultRow>) ?? [];
	}
	const parsed = payload as {
		result?: Array<{ results?: Array<WranglerResultRow> }>;
		results?: Array<WranglerResultRow>;
	};
	return parsed?.result?.[0]?.results ?? parsed?.results ?? [];
};

export const buildWranglerArgs = (params: {
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

export const loadRows = (args: string[]) => {
	let raw = "";
	try {
		raw = execFileSync("bunx", args, {
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "pipe"],
		});
		const parsed = JSON.parse(raw);
		return extractWranglerResults(parsed);
	} catch (error) {
		const err = error as {
			message?: string;
			stdout?: string | Buffer;
			stderr?: string | Buffer;
			status?: number | null;
			signal?: NodeJS.Signals | null;
		};
		const stdout = raw || (err.stdout ? String(err.stdout) : "");
		const stderr = err.stderr ? String(err.stderr) : "";
		const exitInfo = [
			typeof err.status === "number" ? `status=${err.status}` : null,
			err.signal ? `signal=${err.signal}` : null,
		]
			.filter(Boolean)
			.join(" ");
		const details = [
			`command: bunx ${args.join(" ")}`,
			exitInfo ? `exit: ${exitInfo}` : null,
			stdout ? `stdout:\n${stdout}` : null,
			stderr ? `stderr:\n${stderr}` : null,
			err.message ? `error: ${err.message}` : null,
		]
			.filter(Boolean)
			.join("\n");
		throw new Error(`Failed to load rows via wrangler.\n${details}`);
	}
};

export const detectMatchType = (leagueName: string) => {
	const name = leagueName.toLowerCase();
	if (
		name.includes("champions league") ||
		name.includes("europa league") ||
		name.includes("conference league") ||
		name.includes("libertadores") ||
		name.includes("sudamericana") ||
		name.includes("club world cup")
	) {
		return "INTERNATIONAL" as const;
	}
	if (
		name.includes(" cup") ||
		name.includes("copa") ||
		name.includes("taça") ||
		name.includes("taca") ||
		name.includes("coupe") ||
		name.includes("coppa") ||
		name.includes("pokal") ||
		name.includes("beker") ||
		name.includes("community shield") ||
		name.includes("charity shield") ||
		name.includes("efl trophy") ||
		name.includes("efl cup") ||
		name.includes("league cup") ||
		name.includes("super cup") ||
		name.includes("supercopa") ||
		name.includes("supertaca") ||
		name.includes("supertaça")
	) {
		return "CUP" as const;
	}
	return "LEAGUE" as const;
};

export const buildInsertSql = (rows: Array<{
	teamId: number;
	asOf: string;
	elo: number;
	games: number;
	fixtureId: number;
}>) =>
	rows
		.map(
			(row) => `INSERT INTO team_elo_ratings
  (team_id, as_of_date, elo, games, last_fixture_provider, last_fixture_id, updated_at)
  VALUES (${row.teamId}, '${row.asOf}', ${row.elo.toFixed(4)}, ${row.games}, 'api_football', '${row.fixtureId}', datetime('now'))
  ON CONFLICT(team_id, last_fixture_provider, last_fixture_id) DO NOTHING;`,
		)
		.join("\n");

export const buildCurrentUpsertSql = (rows: Array<{
	teamId: number;
	asOf: string;
	elo: number;
	games: number;
}>) =>
	rows
		.map(
			(row) => `INSERT INTO team_elo_current
  (team_id, elo, games, as_of_date, updated_at)
  VALUES (${row.teamId}, ${row.elo.toFixed(4)}, ${row.games}, '${row.asOf}', datetime('now'))
  ON CONFLICT(team_id) DO UPDATE SET
    elo = excluded.elo,
    games = excluded.games,
    as_of_date = excluded.as_of_date,
    updated_at = datetime('now');`,
		)
		.join("\n");

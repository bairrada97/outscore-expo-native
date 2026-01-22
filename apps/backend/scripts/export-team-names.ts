import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { buildWranglerArgs, loadRows } from "./lib/elo-utils";

type CliArgs = {
	dbName: string;
	configPath: string;
	isRemote: boolean;
	outputPath: string;
	leagueIds: number[];
	allTeams: boolean;
};

const parseArg = (args: string[], key: string) => {
	const index = args.findIndex((a) => a === key);
	if (index === -1) return null;
	return args[index + 1] ?? null;
};

const hasFlag = (args: string[], key: string) => args.includes(key);

const parseLeagueIds = (raw: string | null) => {
	if (!raw) return [];
	return raw
		.split(",")
		.map((id) => Number(id.trim()))
		.filter((id) => Number.isFinite(id));
};

const parseArgs = (): CliArgs => {
	const args = process.argv.slice(2);
	const dbName = parseArg(args, "--db") ?? "ENTITIES_DB";
	const configPath =
		parseArg(args, "--config") ?? resolve(__dirname, "../wrangler.toml");
	const outputPath =
		parseArg(args, "--out") ?? resolve(__dirname, "../../../ml/data/api-team-names.json");
	const leagueIds =
		parseLeagueIds(parseArg(args, "--league-ids")) ??
		[39, 140, 135, 78, 61, 94, 88];

	return {
		dbName,
		configPath,
		isRemote: hasFlag(args, "--remote"),
		outputPath,
		leagueIds,
		allTeams: hasFlag(args, "--all-teams"),
	};
};

const buildTeamQuery = (params: { leagueIds: number[]; allTeams: boolean }) => {
	if (params.allTeams || params.leagueIds.length === 0) {
		return "SELECT DISTINCT name FROM teams ORDER BY name;";
	}
	const idList = params.leagueIds.join(", ");
	return `SELECT DISTINCT t.name AS name
FROM teams t
JOIN team_season_context c ON c.team_id = t.id
WHERE c.league_id IN (${idList})
ORDER BY t.name;`;
};

const main = () => {
	const args = parseArgs();
	const query = buildTeamQuery({
		leagueIds: args.leagueIds,
		allTeams: args.allTeams,
	});

	const rows = loadRows([
		...buildWranglerArgs({
			dbName: args.dbName,
			configPath: args.configPath,
			isRemote: args.isRemote,
		}),
		"--command",
		query,
		"--json",
	]);

	const names = rows
		.map((row) => String(row.name ?? "").trim())
		.filter(Boolean)
		.sort((a, b) => a.localeCompare(b));

	mkdirSync(dirname(args.outputPath), { recursive: true });
	writeFileSync(args.outputPath, JSON.stringify(names, null, 2));
	console.log(`✅ Exported ${names.length} team names to ${args.outputPath}`);
};

main();

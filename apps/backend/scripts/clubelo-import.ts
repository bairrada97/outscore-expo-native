import {
	closeSync,
	fsyncSync,
	openSync,
	readFileSync,
	renameSync,
	writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { parseCsv, toRecords } from "../../../ml/utils/csv";
import { normalizeTeamName } from "../../../ml/data-acquisition/team-name-normalizer";
import { buildWranglerArgs, loadRows } from "./lib/elo-utils";

type TeamNameMap = {
	mappings: Record<string, string>;
};

type CountryMap = Record<string, string>;

type TeamRow = {
	id: number;
	name: string;
	country: string | null;
};

const CLUBELO_CONFIDENCE_GAMES = 50;

const parseArg = (args: string[], key: string) => {
	const index = args.findIndex((value) => value === key);
	if (index === -1) return null;
	return args[index + 1] ?? null;
};

const hasFlag = (args: string[], key: string) => args.includes(key);

const loadTeams = (params: {
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
		"SELECT id, name, country FROM teams",
		"--json",
	]);
	return rows.map((row) => ({
		id: Number(row.id),
		name: String(row.name),
		country: row.country ? String(row.country) : null,
	}));
};

const buildTeamIndex = (teams: TeamRow[]) => {
	const index = new Map<string, TeamRow[]>();
	for (const team of teams) {
		const normalized = normalizeTeamName(team.name);
		const countryKey = team.country ? team.country.toLowerCase() : "";
		const exactKey = `${normalized}|${countryKey}`;
		const exactList = index.get(exactKey) ?? [];
		exactList.push(team);
		index.set(exactKey, exactList);

		// Also index by normalized name alone to allow fallback matches
		const anyKey = `${normalized}|`;
		const anyList = index.get(anyKey) ?? [];
		anyList.push(team);
		index.set(anyKey, anyList);
	}
	return index;
};

const resolveTeam = (params: {
	name: string;
	countryCode?: string | null;
	countryMap?: CountryMap | null;
	teamIndex: Map<string, TeamRow[]>;
}) => {
	const normalized = normalizeTeamName(params.name);
	const resolvedCountry = params.countryCode
		? params.countryMap?.[params.countryCode] ?? params.countryCode
		: null;
	const countryKey = resolvedCountry ? resolvedCountry.toLowerCase() : "";
	const countryMatch = params.teamIndex.get(`${normalized}|${countryKey}`);
	if (countryMatch && countryMatch.length === 1) return countryMatch[0];
	if (countryMatch && countryMatch.length > 1) return null;

	const anyMatch = params.teamIndex.get(`${normalized}|`);
	if (anyMatch && anyMatch.length === 1) return anyMatch[0];
	return null;
};

const buildInsertSql = (rows: Array<{
	teamId: number;
	asOf: string;
	elo: number;
	games: number;
	sourceKey: string;
}>) =>
	rows
		.map(
			(row) => `INSERT INTO team_elo_ratings
  (team_id, as_of_date, elo, games, last_fixture_provider, last_fixture_id, updated_at)
  VALUES (${row.teamId}, '${row.asOf}', ${row.elo.toFixed(4)}, ${row.games}, 'clubelo', '${row.sourceKey}', datetime('now'))
  ON CONFLICT(team_id, last_fixture_provider, last_fixture_id) DO NOTHING;`,
		)
		.join("\n");

const buildCurrentUpsertSql = (rows: Array<{
	teamId: number;
	asOf: string;
	elo: number;
	games: number;
}>) =>
	rows
		.map(
			(row) => `INSERT INTO team_elo_current
  (team_id, elo, games, as_of_date, source, updated_at)
  VALUES (${row.teamId}, ${row.elo.toFixed(4)}, ${row.games}, '${row.asOf}', 'clubelo', datetime('now'))
  ON CONFLICT(team_id) DO UPDATE SET
    elo = excluded.elo,
    games = excluded.games,
    as_of_date = excluded.as_of_date,
    source = excluded.source,
    updated_at = datetime('now');`,
		)
		.join("\n");

const main = async () => {
	const args = process.argv.slice(2);
	const inputPath = parseArg(args, "--input");
	const dbName = parseArg(args, "--db");
	const outputPath = parseArg(args, "--output") ?? resolve(__dirname, "clubelo-import.sql");
	const configPath = parseArg(args, "--config") ?? resolve(__dirname, "../wrangler.toml");
	const teamMapPath = parseArg(args, "--team-map");
	const countryMapPath = parseArg(args, "--country-map");
	const apply = hasFlag(args, "--apply");
	const isRemote = hasFlag(args, "--remote");

	if (!inputPath || !dbName) {
		throw new Error(
			"Usage: --input <EloRatings.csv> --db ENTITIES_DB [--output path] [--team-map map.json] [--country-map map.json] [--config path] [--remote] [--apply]",
		);
	}

	const teamMap: TeamNameMap | null = teamMapPath
		? (JSON.parse(readFileSync(teamMapPath, "utf-8")) as TeamNameMap)
		: null;

	const countryMap: CountryMap | null = countryMapPath
		? (JSON.parse(readFileSync(countryMapPath, "utf-8")) as CountryMap)
		: null;

	const teams = loadTeams({ dbName, configPath, isRemote });
	const teamIndex = buildTeamIndex(teams);

	const raw = readFileSync(inputPath, "utf-8");
	const rows = toRecords(parseCsv(raw));
	if (!rows.length) {
		throw new Error("No rows parsed from EloRatings.csv");
	}

	const headers = Object.keys(rows[0]);
	const resolveHeader = (candidates: string[]) => {
		const lower = headers.map((header) => header.trim().toLowerCase());
		for (const candidate of candidates) {
			const idx = lower.indexOf(candidate);
			if (idx !== -1) return headers[idx];
		}
		return null;
	};

	const dateCol = resolveHeader(["date"]);
	const clubCol = resolveHeader(["club", "team", "team_name"]);
	const countryCol = resolveHeader(["country", "country_code"]);
	const eloCol = resolveHeader(["elo", "rating"]);

	if (!dateCol || !clubCol || !eloCol) {
		throw new Error(`Missing required columns. Found headers: ${headers.join(", ")}`);
	}

	const inserts: Array<{
		teamId: number;
		asOf: string;
		elo: number;
		games: number;
		sourceKey: string;
	}> = [];
	const current = new Map<number, { asOf: string; elo: number; games: number }>();
	const unmapped: Array<{ club: string; country: string | null }> = [];

	for (const row of rows) {
		const date = String(row[dateCol]).slice(0, 10);
		const clubRaw = String(row[clubCol] ?? "").trim();
		if (!clubRaw) continue;
		const mappedClub = teamMap?.mappings?.[normalizeTeamName(clubRaw)] ?? clubRaw;
		const country = countryCol ? String(row[countryCol] ?? "").trim() : null;
		const elo = Number(row[eloCol]);
		if (!Number.isFinite(elo)) continue;

		const team = resolveTeam({
			name: mappedClub,
			countryCode: country,
			countryMap,
			teamIndex,
		});

		if (!team) {
			unmapped.push({ club: mappedClub, country });
			continue;
		}

		const sourceKey = `clubelo:${date}`;
		inserts.push({
			teamId: team.id,
			asOf: date,
			elo,
			games: CLUBELO_CONFIDENCE_GAMES,
			sourceKey,
		});
		const currentEntry = current.get(team.id);
		if (!currentEntry || currentEntry.asOf < date) {
			current.set(team.id, { asOf: date, elo, games: CLUBELO_CONFIDENCE_GAMES });
		}
	}

	const sql = buildInsertSql(inserts);
	const currentSql = buildCurrentUpsertSql(
		Array.from(current.entries()).map(([teamId, data]) => ({
			teamId,
			asOf: data.asOf,
			elo: data.elo,
			games: data.games,
		})),
	);
	const combined = currentSql ? `${sql}\n${currentSql}` : sql;
	const tmpPath = `${outputPath}.tmp`;
	writeFileSync(tmpPath, combined);
	const fd = openSync(tmpPath, "r+");
	fsyncSync(fd);
	closeSync(fd);
	renameSync(tmpPath, outputPath);

	console.log(`✅ ClubElo import SQL written to ${outputPath}`);
	console.log(`✅ Snapshots: ${inserts.length}`);
	if (unmapped.length) {
		console.warn(`⚠️ Unmapped clubs: ${unmapped.length}`);
	}

	if (apply) {
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
	console.error("❌ ClubElo import failed:", error);
	process.exit(1);
});

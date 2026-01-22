import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { COLUMN_CANDIDATES, resolveColumn } from "../config/columns";
import { resolveLeagueId } from "../config/leagues";
import { parseCsv, toRecords, writeCsv } from "../utils/csv";
import { parseDate, toISODate } from "../utils/date";
import { normalizeTeamName } from "./team-name-normalizer";

type CleanMatchRow = {
	date: string;
	season: number;
	leagueId: number | null;
	leagueName: string;
	homeTeam: string;
	awayTeam: string;
	homeGoals: number;
	awayGoals: number;
	result: "HOME" | "DRAW" | "AWAY";
};

type TeamNameMap = {
	mappings: Record<string, string>;
};

const args = process.argv.slice(2);
const inputIndex = args.indexOf("--input");
const outIndex = args.indexOf("--out");
const mapIndex = args.indexOf("--team-map");
const allLeagues = args.includes("--all-leagues");

if (inputIndex === -1) {
	console.error(
		"Usage: bun ml/data-acquisition/clean-historical-data.ts --input <raw.csv> [--out <output-dir>] [--team-map <map.json>] [--all-leagues]",
	);
	process.exit(1);
}

const inputPath = resolve(args[inputIndex + 1]);
const outputDir =
	outIndex !== -1
		? resolve(args[outIndex + 1])
		: resolve("ml/data/cleaned");
const teamMapPath = mapIndex !== -1 ? resolve(args[mapIndex + 1]) : null;

const rawText = readFileSync(inputPath, "utf-8");
const rows = parseCsv(rawText);
const records = toRecords(rows);

if (!records.length) {
	throw new Error("No records parsed from CSV.");
}

const headers = Object.keys(records[0]);
const dateCol = resolveColumn(headers, COLUMN_CANDIDATES.date);
const homeCol = resolveColumn(headers, COLUMN_CANDIDATES.homeTeam);
const awayCol = resolveColumn(headers, COLUMN_CANDIDATES.awayTeam);
const homeGoalsCol = resolveColumn(headers, COLUMN_CANDIDATES.homeGoals);
const awayGoalsCol = resolveColumn(headers, COLUMN_CANDIDATES.awayGoals);
const leagueCol = resolveColumn(headers, COLUMN_CANDIDATES.league);
const seasonCol = resolveColumn(headers, COLUMN_CANDIDATES.season);

if (!dateCol || !homeCol || !awayCol || !homeGoalsCol || !awayGoalsCol || !leagueCol) {
	throw new Error(
		`Missing required columns. Found headers: ${headers.join(", ")}`,
	);
}

let teamNameMap: TeamNameMap | null = null;
if (teamMapPath) {
	const payload = JSON.parse(readFileSync(teamMapPath, "utf-8")) as TeamNameMap;
	teamNameMap = payload?.mappings ? payload : null;
}

const dedupe = new Set<string>();
const cleaned: CleanMatchRow[] = [];

const inferSeason = (date: Date) => {
	const year = date.getUTCFullYear();
	const month = date.getUTCMonth() + 1;
	return month >= 7 ? year : year - 1;
};

for (const record of records) {
	const rawDate = record[dateCol];
	const parsed = parseDate(rawDate);
	if (!parsed) continue;
	const isoDate = toISODate(parsed);

	const leagueName = record[leagueCol]?.trim() ?? "";
	const leagueId = resolveLeagueId(leagueName);
	if (!allLeagues && leagueId === null) continue;

	const rawHome = record[homeCol]?.trim() ?? "";
	const rawAway = record[awayCol]?.trim() ?? "";
	if (!rawHome || !rawAway) continue;

	const normalizedHome = normalizeTeamName(rawHome);
	const normalizedAway = normalizeTeamName(rawAway);
	const mappedHome =
		teamNameMap?.mappings?.[normalizedHome] ?? rawHome.trim();
	const mappedAway =
		teamNameMap?.mappings?.[normalizedAway] ?? rawAway.trim();

	const homeGoals = Number(record[homeGoalsCol]);
	const awayGoals = Number(record[awayGoalsCol]);
	if (!Number.isFinite(homeGoals) || !Number.isFinite(awayGoals)) continue;
	if (homeGoals < 0 || awayGoals < 0) continue;

	const season = seasonCol
		? Number(record[seasonCol])
		: inferSeason(parsed);

	const key = `${isoDate}|${leagueId ?? leagueName}|${mappedHome}|${mappedAway}`;
	if (dedupe.has(key)) continue;
	dedupe.add(key);

	const result =
		homeGoals > awayGoals ? "HOME" : homeGoals < awayGoals ? "AWAY" : "DRAW";

	cleaned.push({
		date: isoDate,
		season,
		leagueId,
		leagueName,
		homeTeam: mappedHome,
		awayTeam: mappedAway,
		homeGoals,
		awayGoals,
		result,
	});
}

mkdirSync(outputDir, { recursive: true });
const jsonlPath = resolve(outputDir, "matches.jsonl");
const csvPath = resolve(outputDir, "matches.csv");

writeFileSync(
	jsonlPath,
	cleaned.map((row) => JSON.stringify(row)).join("\n"),
	"utf-8",
);

const csvRows = [
	[
		"date",
		"season",
		"leagueId",
		"leagueName",
		"homeTeam",
		"awayTeam",
		"homeGoals",
		"awayGoals",
		"result",
	],
	...cleaned.map((row) => [
		row.date,
		String(row.season),
		row.leagueId === null ? "" : String(row.leagueId),
		row.leagueName,
		row.homeTeam,
		row.awayTeam,
		String(row.homeGoals),
		String(row.awayGoals),
		row.result,
	]),
];

writeCsv(csvPath, csvRows);

console.log(`✅ Cleaned ${cleaned.length} matches`);
console.log(`📁 JSONL: ${jsonlPath}`);
console.log(`📁 CSV: ${csvPath}`);

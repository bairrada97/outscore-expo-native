import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseCsv, toRecords } from "../utils/csv";
import { parseDate } from "../utils/date";

type CleanMatchRow = {
	date: string;
	season: number;
	leagueId: string | number | null;
	leagueName: string;
	homeTeam: string;
	awayTeam: string;
	homeGoals: number;
	awayGoals: number;
};

const args = process.argv.slice(2);
const inputIndex = args.indexOf("--input");
const outIndex = args.indexOf("--out");

if (inputIndex === -1) {
	console.error(
		"Usage: bun ml/data-acquisition/validate-data.ts --input <clean.jsonl|clean.csv> [--out <summary.json>]",
	);
	process.exit(1);
}

const inputPath = resolve(args[inputIndex + 1]);
const outputPath =
	outIndex !== -1
		? resolve(args[outIndex + 1])
		: resolve("ml/data/cleaned/validation.json");

let rows: CleanMatchRow[] = [];
if (inputPath.endsWith(".jsonl")) {
	const lines = readFileSync(inputPath, "utf-8")
		.split("\n")
		.filter(Boolean);
	rows = lines.map((line) => JSON.parse(line));
} else {
	const csv = parseCsv(readFileSync(inputPath, "utf-8"));
	const records = toRecords(csv);
	rows = records.map((record) => ({
		date: record.date,
		season: Number(record.season),
		leagueId: record.leagueId,
		leagueName: record.leagueName,
		homeTeam: record.homeTeam,
		awayTeam: record.awayTeam,
		homeGoals: Number(record.homeGoals),
		awayGoals: Number(record.awayGoals),
	}));
}

const summary = {
	total: rows.length,
	invalidDates: 0,
	futureDates: 0,
	missingTeams: 0,
	invalidScores: 0,
	duplicates: 0,
	leagueCounts: {} as Record<string, number>,
};

const seen = new Set<string>();
const today = new Date();

for (const row of rows) {
	const parsed = parseDate(row.date);
	if (!parsed) summary.invalidDates += 1;
	if (parsed && parsed.getTime() > today.getTime()) summary.futureDates += 1;

	if (!row.homeTeam || !row.awayTeam) summary.missingTeams += 1;
	if (!Number.isFinite(row.homeGoals) || !Number.isFinite(row.awayGoals)) {
		summary.invalidScores += 1;
	}
	if (row.homeGoals < 0 || row.awayGoals < 0) summary.invalidScores += 1;

	const key = `${row.date}|${row.leagueId}|${row.homeTeam}|${row.awayTeam}`;
	if (seen.has(key)) summary.duplicates += 1;
	seen.add(key);

	const leagueKey = row.leagueName || String(row.leagueId ?? "unknown");
	summary.leagueCounts[leagueKey] = (summary.leagueCounts[leagueKey] ?? 0) + 1;
}

writeFileSync(outputPath, JSON.stringify(summary, null, 2), "utf-8");
console.log(`✅ Validation summary written to ${outputPath}`);
console.log(summary);

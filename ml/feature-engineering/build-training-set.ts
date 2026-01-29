import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseCsv, toRecords, writeCsv } from "../utils/csv";
import { parseDate } from "../utils/date";
import { getLeagueTier } from "./elo";
import { buildFormString, calculateWeightedFormScore, type FormResult } from "./form-features";

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
	homeElo?: number | null;
	awayElo?: number | null;
	oddHome?: number | null;
	oddDraw?: number | null;
	oddAway?: number | null;
	over25?: number | null;
	under25?: number | null;
};

type HistoryMatch = {
	date: Date;
	isHome: boolean;
	goalsFor: number;
	goalsAgainst: number;
	result: FormResult;
};

type FeatureRow = {
	date: string;
	season: number;
	leagueId: number | null;
	leagueName: string;
	homeTeam: string;
	awayTeam: string;
	homeForm: string;
	awayForm: string;
	homeFormScore: number;
	awayFormScore: number;
	homePPG10: number;
	awayPPG10: number;
	homeGF10: number;
	homeGA10: number;
	awayGF10: number;
	awayGA10: number;
	homeDaysSince: number | null;
	awayDaysSince: number | null;
	homeHomeFormScore: number;
	awayAwayFormScore: number;
	// NEW: ELO and Tier features
	homeElo: number;
	awayElo: number;
	eloDiff: number;
	homeTier: number;
	awayTier: number;
	tierGap: number;
	result: "HOME" | "DRAW" | "AWAY";
	homeGoals: number;
	awayGoals: number;
};

const DEFAULT_ELO = 1500;
const HOME_ADVANTAGE_ELO = 100;

const args = process.argv.slice(2);
const inputIndex = args.indexOf("--input");
const outIndex = args.indexOf("--out");
const minIndex = args.indexOf("--min-history");

if (inputIndex === -1) {
	console.error(
		"Usage: bun ml/feature-engineering/build-training-set.ts --input <clean.jsonl|clean.csv> [--out <output-dir>] [--min-history 5]",
	);
	process.exit(1);
}

const inputPath = resolve(args[inputIndex + 1]);
const outputDir =
	outIndex !== -1 ? resolve(args[outIndex + 1]) : resolve("ml/data/features");
const minHistory = minIndex !== -1 ? Number(args[minIndex + 1]) : 5;

const loadRows = (): CleanMatchRow[] => {
	if (inputPath.endsWith(".jsonl")) {
		const lines = readFileSync(inputPath, "utf-8")
			.split("\n")
			.filter(Boolean);
		return lines.map((line) => JSON.parse(line));
	}

	const csv = parseCsv(readFileSync(inputPath, "utf-8"));
	const records = toRecords(csv);
	return records.map((record) => ({
		date: record.date,
		season: Number(record.season),
		leagueId: record.leagueId ? Number(record.leagueId) : null,
		leagueName: record.leagueName,
		homeTeam: record.homeTeam,
		awayTeam: record.awayTeam,
		homeGoals: Number(record.homeGoals),
		awayGoals: Number(record.awayGoals),
		result: record.result as "HOME" | "DRAW" | "AWAY",
		homeElo: record.homeElo ? Number(record.homeElo) : null,
		awayElo: record.awayElo ? Number(record.awayElo) : null,
		oddHome: record.oddHome ? Number(record.oddHome) : null,
		oddDraw: record.oddDraw ? Number(record.oddDraw) : null,
		oddAway: record.oddAway ? Number(record.oddAway) : null,
		over25: record.over25 ? Number(record.over25) : null,
		under25: record.under25 ? Number(record.under25) : null,
	}));
};

type DatedRow = CleanMatchRow & { parsedDate: Date | null };

const rows = loadRows()
	.map(
		(row): DatedRow => ({
			...row,
			parsedDate: parseDate(row.date),
		}),
	)
	.filter((row): row is CleanMatchRow & { parsedDate: Date } =>
		Boolean(row.parsedDate),
	)
	.sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime());

const history = new Map<string, HistoryMatch[]>();

const getHistory = (team: string) => history.get(team) ?? [];

const toFormResult = (row: CleanMatchRow, isHome: boolean): FormResult => {
	if (row.result === "DRAW") return "D";
	const homeWon = row.result === "HOME";
	return homeWon === isHome ? "W" : "L";
};

const lastN = <T,>(items: T[], n: number) => items.slice(0, n);

const average = (values: number[]) =>
	values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

const buildStats = (matches: HistoryMatch[], n: number) => {
	const slice = lastN(matches, n);
	const results = slice.map((match) => match.result);
	const points = slice.map((match) => (match.result === "W" ? 3 : match.result === "D" ? 1 : 0));
	const goalsFor = slice.map((match) => match.goalsFor);
	const goalsAgainst = slice.map((match) => match.goalsAgainst);
	return {
		results,
		ppg: average(points),
		gf: average(goalsFor),
		ga: average(goalsAgainst),
	};
};

const calcDaysSince = (matches: HistoryMatch[], current: Date) => {
	if (!matches.length) return null;
	const latest = matches[0].date;
	const diff = current.getTime() - latest.getTime();
	return Math.max(0, Math.round(diff / (1000 * 60 * 60 * 24)));
};

const features: FeatureRow[] = [];

for (const row of rows) {
	const date = row.parsedDate;
	const homeHistory = getHistory(row.homeTeam);
	const awayHistory = getHistory(row.awayTeam);

	const homeElo = row.homeElo ?? DEFAULT_ELO;
	const awayElo = row.awayElo ?? DEFAULT_ELO;
	const eloDiff = homeElo + HOME_ADVANTAGE_ELO - awayElo;

	// Get tier information
	const homeTier = getLeagueTier(row.leagueId);
	const awayTier = getLeagueTier(row.leagueId); // Same league for domestic matches
	const tierGap = homeTier - awayTier; // 0 for domestic matches

	if (homeHistory.length >= minHistory && awayHistory.length >= minHistory) {
		const homeStats = buildStats(homeHistory, 10);
		const awayStats = buildStats(awayHistory, 10);

		const homeForm = buildFormString(homeStats.results, 5);
		const awayForm = buildFormString(awayStats.results, 5);

		const homeHomeStats = buildStats(homeHistory.filter((m) => m.isHome), 5);
		const awayAwayStats = buildStats(awayHistory.filter((m) => !m.isHome), 5);

		features.push({
			date: row.date,
			season: row.season,
			leagueId: row.leagueId,
			leagueName: row.leagueName,
			homeTeam: row.homeTeam,
			awayTeam: row.awayTeam,
			homeForm,
			awayForm,
			homeFormScore: calculateWeightedFormScore(homeStats.results),
			awayFormScore: calculateWeightedFormScore(awayStats.results),
			homePPG10: homeStats.ppg,
			awayPPG10: awayStats.ppg,
			homeGF10: homeStats.gf,
			homeGA10: homeStats.ga,
			awayGF10: awayStats.gf,
			awayGA10: awayStats.ga,
			homeDaysSince: calcDaysSince(homeHistory, date),
			awayDaysSince: calcDaysSince(awayHistory, date),
			homeHomeFormScore: calculateWeightedFormScore(homeHomeStats.results),
			awayAwayFormScore: calculateWeightedFormScore(awayAwayStats.results),
			// NEW: ELO and Tier features
			homeElo,
			awayElo,
			eloDiff,
			homeTier,
			awayTier,
			tierGap,
			result: row.result,
			homeGoals: row.homeGoals,
			awayGoals: row.awayGoals,
		});
	}

	const homeResult = toFormResult(row, true);
	const awayResult = toFormResult(row, false);

	const homeEntry: HistoryMatch = {
		date,
		isHome: true,
		goalsFor: row.homeGoals,
		goalsAgainst: row.awayGoals,
		result: homeResult,
	};

	const awayEntry: HistoryMatch = {
		date,
		isHome: false,
		goalsFor: row.awayGoals,
		goalsAgainst: row.homeGoals,
		result: awayResult,
	};

	history.set(row.homeTeam, [homeEntry, ...homeHistory]);
	history.set(row.awayTeam, [awayEntry, ...awayHistory]);
}

mkdirSync(outputDir, { recursive: true });
const jsonlPath = resolve(outputDir, "training.jsonl");
const csvPath = resolve(outputDir, "training.csv");

writeFileSync(
	jsonlPath,
	features.map((row) => JSON.stringify(row)).join("\n"),
	"utf-8",
);

const csvRows = [
	Object.keys(features[0] ?? {}),
	...features.map((row) => Object.values(row).map((value) => String(value ?? ""))),
];

writeCsv(csvPath, csvRows);
console.log(`✅ Training set rows: ${features.length}`);
console.log(`📁 JSONL: ${jsonlPath}`);
console.log(`📁 CSV: ${csvPath}`);

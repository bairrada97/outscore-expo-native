import { readFileSync } from "node:fs";
import {
	applyBinaryTemperatureScaling,
	assertProb,
	clamp,
} from "../src/modules/betting-insights/utils/calibration-utils";
import { TOTAL_GOALS_CALIBRATION } from "../src/modules/betting-insights/config/total-goals-calibration";

type EvalRow = {
	fixtureId: number;
	date: string;
	leagueId: number;
	season: number;
	matchType: string;
	line: number;
	probOver: number;
	probUnder: number;
	actual: "OVER" | "UNDER";
};

const brierScore = (rows: EvalRow[], temperature = 1) => {
	let sum = 0;
	for (const [index, row] of rows.entries()) {
		if (row.actual !== "OVER" && row.actual !== "UNDER") {
			throw new Error(
				`Invalid actual value at row ${index}: ${JSON.stringify(row.actual)}`,
			);
		}
		assertProb(row.probOver, "probOver", index);
		assertProb(row.probUnder, "probUnder", index);
		const over = applyBinaryTemperatureScaling(row.probOver, temperature);
		const target = row.actual === "OVER" ? 1 : 0;
		sum += (over - target) ** 2;
	}
	return sum / rows.length;
};

const logLoss = (rows: EvalRow[], temperature = 1) => {
	let sum = 0;
	for (const [index, row] of rows.entries()) {
		if (row.actual !== "OVER" && row.actual !== "UNDER") {
			throw new Error(
				`Invalid actual value at row ${index}: ${JSON.stringify(row.actual)}`,
			);
		}
		assertProb(row.probOver, "probOver", index);
		assertProb(row.probUnder, "probUnder", index);
		const over = applyBinaryTemperatureScaling(row.probOver, temperature);
		const under = applyBinaryTemperatureScaling(row.probUnder, temperature);
		const p = row.actual === "OVER" ? over : under;
		if (!Number.isFinite(p) || p <= 0 || p > 1) {
			throw new Error(
				`Invalid probability for actual=${row.actual} at row ${index}: ${JSON.stringify(
					p,
				)}`,
			);
		}
		sum += -Math.log(clamp(p, 1e-6, 1));
	}
	return sum / rows.length;
};

const summarize = (label: string, rows: EvalRow[], temperature = 1) => {
	const brier = brierScore(rows, temperature);
	const loss = logLoss(rows, temperature);
	console.log(
		`${label}: n=${rows.length}, brier=${brier.toFixed(6)}, logloss=${loss.toFixed(
			6,
		)}`,
	);
};

const isEvalRow = (value: unknown): value is EvalRow => {
	if (!value || typeof value !== "object") return false;
	const row = value as Record<string, unknown>;
	return (
		typeof row.probOver === "number" &&
		Number.isFinite(row.probOver) &&
		typeof row.probUnder === "number" &&
		Number.isFinite(row.probUnder) &&
		(row.actual === "OVER" || row.actual === "UNDER") &&
		typeof row.date === "string" &&
		row.date.length > 0 &&
		Number.isFinite(Date.parse(row.date)) &&
		typeof row.fixtureId === "number" &&
		Number.isFinite(row.fixtureId) &&
		typeof row.leagueId === "number" &&
		Number.isFinite(row.leagueId) &&
		typeof row.season === "number" &&
		Number.isFinite(row.season) &&
		typeof row.matchType === "string" &&
		row.matchType.length > 0 &&
		typeof row.line === "number" &&
		Number.isFinite(row.line)
	);
};

const main = () => {
	const file = process.argv[2];
	const minCountArg = process.argv.findIndex((arg) => arg === "--min-count");
	const minCount =
		minCountArg !== -1 ? Number(process.argv[minCountArg + 1]) : 30;

	if (!file) {
		throw new Error(
			"Usage: bun scripts/calibration-evaluate-goals.ts <eval.json>",
		);
	}

	const parsed = JSON.parse(readFileSync(file, "utf-8"));
	if (!Array.isArray(parsed)) {
		throw new Error("Expected JSON array for eval rows.");
	}
	const rows = parsed.filter(isEvalRow);
	if (rows.length !== parsed.length) {
		console.warn(
			`⚠️ [Calibration] Dropped ${parsed.length - rows.length} malformed eval rows.`,
		);
	}
	if (!rows.length) {
		throw new Error("No rows to evaluate.");
	}

	console.log("== Overall ==");
	summarize("raw", rows);

	if (TOTAL_GOALS_CALIBRATION.temperature !== 1) {
		console.log(`== Calibrated (T=${TOTAL_GOALS_CALIBRATION.temperature}) ==`);
		summarize("calibrated", rows, TOTAL_GOALS_CALIBRATION.temperature);
	}

	const byLeague = new Map<number, EvalRow[]>();
	const byMatchType = new Map<string, EvalRow[]>();
	const byLine = new Map<number, EvalRow[]>();
	for (const row of rows) {
		let leagueRows = byLeague.get(row.leagueId);
		if (!leagueRows) {
			leagueRows = [];
			byLeague.set(row.leagueId, leagueRows);
		}
		leagueRows.push(row);

		let matchTypeRows = byMatchType.get(row.matchType);
		if (!matchTypeRows) {
			matchTypeRows = [];
			byMatchType.set(row.matchType, matchTypeRows);
		}
		matchTypeRows.push(row);

		let lineRows = byLine.get(row.line);
		if (!lineRows) {
			lineRows = [];
			byLine.set(row.line, lineRows);
		}
		lineRows.push(row);
	}

	console.log(`== Line slices (min ${minCount}) ==`);
	for (const [line, list] of byLine.entries()) {
		if (list.length < minCount) continue;
		summarize(`line=${line}`, list);
		if (TOTAL_GOALS_CALIBRATION.temperature !== 1) {
			summarize(`line=${line} (calibrated)`, list, TOTAL_GOALS_CALIBRATION.temperature);
		}
	}

	console.log(`== League slices (min ${minCount}) ==`);
	for (const [leagueId, list] of byLeague.entries()) {
		if (list.length < minCount) continue;
		summarize(`league=${leagueId}`, list);
		if (TOTAL_GOALS_CALIBRATION.temperature !== 1) {
			summarize(
				`league=${leagueId} (calibrated)`,
				list,
				TOTAL_GOALS_CALIBRATION.temperature,
			);
		}
	}

	console.log(`== MatchType slices (min ${minCount}) ==`);
	for (const [matchType, list] of byMatchType.entries()) {
		if (list.length < minCount) continue;
		summarize(`matchType=${matchType}`, list);
		if (TOTAL_GOALS_CALIBRATION.temperature !== 1) {
			summarize(
				`matchType=${matchType} (calibrated)`,
				list,
				TOTAL_GOALS_CALIBRATION.temperature,
			);
		}
	}
};

try {
	main();
} catch (err) {
	console.error("Error in main:", err);
	process.exit(1);
}

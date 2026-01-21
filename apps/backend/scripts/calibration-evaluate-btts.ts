import { readFileSync } from "node:fs";
import {
	applyBinaryTemperatureScaling,
	assertProb,
	clamp,
} from "../src/modules/betting-insights/utils/calibration-utils";
import { BTTS_CALIBRATION } from "../src/modules/betting-insights/config/btts-calibration";

type EvalRow = {
	fixtureId: number;
	date: string;
	leagueId: number;
	season: number;
	matchType: string;
	probYes: number;
	probNo: number;
	actual: "YES" | "NO";
};

const brierScore = (rows: EvalRow[], temperature = 1) => {
	let sum = 0;
	for (const [index, row] of rows.entries()) {
		if (row.actual !== "YES" && row.actual !== "NO") {
			throw new Error(
				`Invalid actual value at row ${index}: ${JSON.stringify(row.actual)}`,
			);
		}
		assertProb(row.probYes, "probYes", index);
		assertProb(row.probNo, "probNo", index);
		const probSum = row.probYes + row.probNo;
		if (Math.abs(probSum - 1) > 1e-6) {
			throw new Error(
				`Invalid probYes/probNo sum at row ${index}: probYes=${row.probYes}, probNo=${row.probNo}, sum=${probSum}`,
			);
		}
		const yes = applyBinaryTemperatureScaling(row.probYes, temperature);
		const target = row.actual === "YES" ? 1 : 0;
		sum += (yes - target) ** 2;
	}
	return sum / rows.length;
};

const logLoss = (rows: EvalRow[], temperature = 1) => {
	let sum = 0;
	for (const [index, row] of rows.entries()) {
		if (row.actual !== "YES" && row.actual !== "NO") {
			throw new Error(
				`Invalid actual value at row ${index}: ${JSON.stringify(row.actual)}`,
			);
		}
		assertProb(row.probYes, "probYes", index);
		assertProb(row.probNo, "probNo", index);
		const yes = applyBinaryTemperatureScaling(row.probYes, temperature);
		const p = row.actual === "YES" ? yes : 1 - yes;
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
		typeof row.probYes === "number" &&
		typeof row.probNo === "number" &&
		typeof row.actual === "string"
	);
};

const main = () => {
	const file = process.argv[2];
	const minCountArg = process.argv.findIndex((arg) => arg === "--min-count");
	let minCount = 30;
	if (minCountArg !== -1) {
		const raw = process.argv[minCountArg + 1];
		const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
		if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 0) {
			throw new Error(
				"Invalid --min-count value. Expected a non-negative integer.",
			);
		}
		minCount = parsed;
	}

	if (!file) {
		throw new Error("Usage: bun scripts/calibration-evaluate-btts.ts <eval.json>");
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

	if (BTTS_CALIBRATION.temperature !== 1) {
		console.log(`== Calibrated (T=${BTTS_CALIBRATION.temperature}) ==`);
		summarize("calibrated", rows, BTTS_CALIBRATION.temperature);
	}

	const byLeague = new Map<number, EvalRow[]>();
	const byMatchType = new Map<string, EvalRow[]>();
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
	}

	console.log(`== League slices (min ${minCount}) ==`);
	for (const [leagueId, list] of byLeague.entries()) {
		if (list.length < minCount) continue;
		summarize(`league=${leagueId}`, list);
		if (BTTS_CALIBRATION.temperature !== 1) {
			summarize(`league=${leagueId} (calibrated)`, list, BTTS_CALIBRATION.temperature);
		}
	}

	console.log(`== MatchType slices (min ${minCount}) ==`);
	for (const [matchType, list] of byMatchType.entries()) {
		if (list.length < minCount) continue;
		summarize(`matchType=${matchType}`, list);
		if (BTTS_CALIBRATION.temperature !== 1) {
			summarize(
				`matchType=${matchType} (calibrated)`,
				list,
				BTTS_CALIBRATION.temperature,
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

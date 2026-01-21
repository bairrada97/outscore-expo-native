import { readFileSync } from "node:fs";
import { MATCH_OUTCOME_CALIBRATION } from "../src/modules/betting-insights/config/match-outcome-calibration";
import {
	applyTemperatureScaling,
	assertActual,
	assertProb,
	logLoss,
} from "../src/modules/betting-insights/utils/calibration-utils";

type EvalRow = {
	fixtureId?: number;
	date?: string;
	leagueId?: number;
	season?: number;
	matchType?: string;
	probHomeWin: number;
	probDraw: number;
	probAwayWin: number;
	actual: "HOME" | "DRAW" | "AWAY";
};


const brierScore = (rows: EvalRow[], temperature = 1) => {
	let sum = 0;
	for (const [index, row] of rows.entries()) {
		assertActual(row.actual, index);
		assertProb(row.probHomeWin, "probHomeWin", index);
		assertProb(row.probDraw, "probDraw", index);
		assertProb(row.probAwayWin, "probAwayWin", index);
		const scaled = applyTemperatureScaling(
			{
				home: row.probHomeWin,
				draw: row.probDraw,
				away: row.probAwayWin,
			},
			temperature,
		);
		const actual = [
			row.actual === "HOME" ? 1 : 0,
			row.actual === "DRAW" ? 1 : 0,
			row.actual === "AWAY" ? 1 : 0,
		];
		const probs = [scaled.home, scaled.draw, scaled.away];
		const diff = probs.map((p, idx) => (p - actual[idx]) ** 2);
		sum += diff.reduce((a, b) => a + b, 0);
	}
	return sum / rows.length;
};

const summarize = (label: string, rows: EvalRow[], temperature = 1) => {
	console.log(
		`${label}: n=${rows.length}, brier=${brierScore(rows, temperature).toFixed(
			6,
		)}, logloss=${logLoss(rows, temperature).toFixed(6)}`,
	);
};

const isEvalRow = (value: unknown): value is EvalRow => {
	if (!value || typeof value !== "object") return false;
	const row = value as Record<string, unknown>;
	return (
		"probHomeWin" in row &&
		"probDraw" in row &&
		"probAwayWin" in row &&
		"actual" in row
	);
};

const main = () => {
	const file = process.argv[2];
	if (!file) {
		throw new Error("Usage: bun scripts/calibration-evaluate.ts <eval.json>");
	}
	const minCountArg = process.argv.includes("--min-count")
		? Number(process.argv[process.argv.indexOf("--min-count") + 1])
		: 30;
	const minCount = Number.isFinite(minCountArg) ? minCountArg : 30;

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
		console.log("No rows to evaluate.");
		return;
	}

	console.log("== Overall ==");
	summarize("raw", rows);

	if (MATCH_OUTCOME_CALIBRATION.temperature !== 1) {
		console.log(
			`== Calibrated (T=${MATCH_OUTCOME_CALIBRATION.temperature}) ==`,
		);
		summarize("calibrated", rows, MATCH_OUTCOME_CALIBRATION.temperature);
	}

	const byLeague = new Map<number, EvalRow[]>();
	const byMatchType = new Map<string, EvalRow[]>();

	for (const row of rows) {
		if (typeof row.leagueId === "number") {
			const list = byLeague.get(row.leagueId) ?? [];
			list.push(row);
			byLeague.set(row.leagueId, list);
		}
		if (row.matchType) {
			const list = byMatchType.get(row.matchType) ?? [];
			list.push(row);
			byMatchType.set(row.matchType, list);
		}
	}

	console.log(`== League slices (min ${minCount}) ==`);
	for (const [leagueId, list] of byLeague.entries()) {
		if (list.length < minCount) continue;
		summarize(`league=${leagueId}`, list);
		if (MATCH_OUTCOME_CALIBRATION.temperature !== 1) {
			summarize(
				`league=${leagueId} (calibrated)`,
				list,
				MATCH_OUTCOME_CALIBRATION.temperature,
			);
		}
	}

	console.log(`== MatchType slices (min ${minCount}) ==`);
	for (const [matchType, list] of byMatchType.entries()) {
		if (list.length < minCount) continue;
		summarize(`matchType=${matchType}`, list);
		if (MATCH_OUTCOME_CALIBRATION.temperature !== 1) {
			summarize(
				`matchType=${matchType} (calibrated)`,
				list,
				MATCH_OUTCOME_CALIBRATION.temperature,
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

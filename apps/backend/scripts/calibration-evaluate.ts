import { readFileSync } from "node:fs";
import { MATCH_OUTCOME_CALIBRATION } from "../src/modules/betting-insights/config/match-outcome-calibration";

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

const clamp = (value: number, min: number, max: number) =>
	Math.max(min, Math.min(max, value));

const assertProb = (value: number, key: string, index: number) => {
	if (!Number.isFinite(value) || value < 0 || value > 1) {
		throw new Error(
			`Invalid probability for ${key} at row ${index}: ${JSON.stringify(
				value,
			)}`,
		);
	}
};

const assertActual = (value: EvalRow["actual"], index: number) => {
	if (value !== "HOME" && value !== "DRAW" && value !== "AWAY") {
		throw new Error(
			`Invalid actual value at row ${index}: ${JSON.stringify(value)}`,
		);
	}
};

const applyTemperatureScaling = (
	probs: { home: number; draw: number; away: number },
	temperature: number,
): { home: number; draw: number; away: number } => {
	if (!Number.isFinite(temperature) || temperature <= 0 || temperature === 1) {
		return probs;
	}
	const logits = [probs.home, probs.draw, probs.away].map((p) =>
		Math.log(clamp(p, 1e-12, 1)) / temperature,
	);
	const exp = logits.map((value) => Math.exp(value));
	const sum = exp.reduce((acc, value) => acc + value, 0);
	if (!Number.isFinite(sum) || sum <= 0) {
		return probs;
	}
	return {
		home: exp[0] / sum,
		draw: exp[1] / sum,
		away: exp[2] / sum,
	};
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

const logLoss = (rows: EvalRow[], temperature = 1) => {
	let sum = 0;
	for (const [index, row] of rows.entries()) {
		assertActual(row.actual, index);
		const scaled = applyTemperatureScaling(
			{
				home: row.probHomeWin,
				draw: row.probDraw,
				away: row.probAwayWin,
			},
			temperature,
		);
		const p =
			row.actual === "HOME"
				? scaled.home
				: row.actual === "DRAW"
					? scaled.draw
					: scaled.away;
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
	console.log(
		`${label}: n=${rows.length}, brier=${brierScore(rows, temperature).toFixed(
			6,
		)}, logloss=${logLoss(rows, temperature).toFixed(6)}`,
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
	const rows = parsed as EvalRow[];
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
	}

	console.log(`== MatchType slices (min ${minCount}) ==`);
	for (const [matchType, list] of byMatchType.entries()) {
		if (list.length < minCount) continue;
		summarize(`matchType=${matchType}`, list);
	}
};

main();

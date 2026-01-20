import { readFileSync } from "node:fs";

type EvalRow = {
	probHomeWin: number;
	probDraw: number;
	probAwayWin: number;
	actual: "HOME" | "DRAW" | "AWAY";
};

const clamp = (value: number, min: number, max: number) =>
	Math.max(min, Math.min(max, value));

const isValidActual = (value: EvalRow["actual"]) =>
	value === "HOME" || value === "DRAW" || value === "AWAY";

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
	if (!isValidActual(value)) {
		throw new Error(
			`Invalid actual value at row ${index}: ${JSON.stringify(value)}`,
		);
	}
};

const brierScore = (rows: EvalRow[]) => {
	let sum = 0;
	for (const [index, row] of rows.entries()) {
		assertActual(row.actual, index);
		assertProb(row.probHomeWin, "probHomeWin", index);
		assertProb(row.probDraw, "probDraw", index);
		assertProb(row.probAwayWin, "probAwayWin", index);

		const actual = [
			row.actual === "HOME" ? 1 : 0,
			row.actual === "DRAW" ? 1 : 0,
			row.actual === "AWAY" ? 1 : 0,
		];
		const probs = [row.probHomeWin, row.probDraw, row.probAwayWin];
		const diff = probs.map((p, idx) => (p - actual[idx]) ** 2);
		sum += diff.reduce((a, b) => a + b, 0);
	}
	return sum / rows.length;
};

const logLoss = (rows: EvalRow[]) => {
	let sum = 0;
	for (const [index, row] of rows.entries()) {
		assertActual(row.actual, index);
		const p =
			row.actual === "HOME"
				? row.probHomeWin
				: row.actual === "DRAW"
					? row.probDraw
					: row.probAwayWin;
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

const main = () => {
	const file = process.argv[2];
	if (!file) {
		throw new Error("Usage: bun scripts/elo-evaluate.ts <eval.json>");
	}

	const parsed = JSON.parse(readFileSync(file, "utf-8"));
	if (!Array.isArray(parsed)) {
		throw new Error("Expected JSON array for eval rows.");
	}
	const rows = parsed as EvalRow[];
	if (!rows.length) {
		console.log("No rows to evaluate.");
		return;
	}

	console.log(`Brier score: ${brierScore(rows).toFixed(6)}`);
	console.log(`Log loss: ${logLoss(rows).toFixed(6)}`);
};

main();

import { readFileSync } from "node:fs";

type EvalRow = {
	probHomeWin: number;
	probDraw: number;
	probAwayWin: number;
	actual: "HOME" | "DRAW" | "AWAY";
};

const clamp = (value: number, min: number, max: number) =>
	Math.max(min, Math.min(max, value));

const brierScore = (rows: EvalRow[]) => {
	let sum = 0;
	for (const row of rows) {
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
	for (const row of rows) {
		const p =
			row.actual === "HOME"
				? row.probHomeWin
				: row.actual === "DRAW"
					? row.probDraw
					: row.probAwayWin;
		sum += -Math.log(clamp(p, 1e-6, 1));
	}
	return sum / rows.length;
};

const main = () => {
	const file = process.argv[2];
	if (!file) {
		throw new Error("Usage: bun scripts/elo-evaluate.ts <eval.json>");
	}

	const rows = JSON.parse(readFileSync(file, "utf-8")) as EvalRow[];
	if (!rows.length) {
		console.log("No rows to evaluate.");
		return;
	}

	console.log(`Brier score: ${brierScore(rows).toFixed(6)}`);
	console.log(`Log loss: ${logLoss(rows).toFixed(6)}`);
};

main();

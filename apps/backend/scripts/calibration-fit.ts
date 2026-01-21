import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
	applyTemperatureScaling,
	assertActual,
	assertProb,
	clamp,
} from "../src/modules/betting-insights/utils/calibration-utils";

type EvalRow = {
	probHomeWin: number;
	probDraw: number;
	probAwayWin: number;
	actual: "HOME" | "DRAW" | "AWAY";
};


const logLoss = (rows: EvalRow[], temperature = 1) => {
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

const main = async () => {
	const file = process.argv[2];
	if (!file) {
		throw new Error("Usage: bun scripts/calibration-fit.ts <eval.json>");
	}
	const outputPath =
		process.argv.includes("--output")
			? process.argv[process.argv.indexOf("--output") + 1]
			: resolve(
					__dirname,
					"../src/modules/betting-insights/config/match-outcome-calibration.ts",
				);

	const parsed = JSON.parse(readFileSync(file, "utf-8"));
	if (!Array.isArray(parsed)) {
		throw new Error("Expected JSON array for eval rows.");
	}
	const rows = parsed as EvalRow[];
	if (!rows.length) {
		throw new Error("No rows to evaluate.");
	}

	const minT = 0.5;
	const maxT = 2.5;
	const step = 0.05;
	let bestT = 1;
	let bestLoss = Number.POSITIVE_INFINITY;

	for (let t = minT; t <= maxT + 1e-9; t += step) {
		const loss = logLoss(rows, t);
		if (loss < bestLoss) {
			bestLoss = loss;
			bestT = t;
		}
	}

	const baseline = logLoss(rows, 1);

	const contents = `export type MatchOutcomeCalibrationConfig = {
	temperature: number;
	updatedAt: string;
	source: string;
};

export const MATCH_OUTCOME_CALIBRATION: MatchOutcomeCalibrationConfig = {
	temperature: ${bestT.toFixed(4)},
	updatedAt: "${new Date().toISOString()}",
	source: "${file.replace(/\\/g, "/")}",
};
`;

	writeFileSync(outputPath, contents);
	console.log(
		`✅ [Calibration] Best temperature=${bestT.toFixed(4)} (logloss ${bestLoss.toFixed(
			6,
		)}; baseline ${baseline.toFixed(6)})`,
	);
	console.log(`✅ [Calibration] Wrote ${outputPath}`);
};

main().catch((err) => {
	console.error("Error in main:", err);
	process.exit(1);
});

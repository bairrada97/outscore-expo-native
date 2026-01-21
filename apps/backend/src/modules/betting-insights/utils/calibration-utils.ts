export type CalibrationScale = "unit" | "percent";

export const clamp = (value: number, min: number, max: number) =>
	Math.max(min, Math.min(max, value));

export const assertProb = (value: number, key: string, index: number) => {
	if (!Number.isFinite(value) || value < 0 || value > 1) {
		throw new Error(
			`Invalid probability for ${key} at row ${index}: ${JSON.stringify(
				value,
			)}`,
		);
	}
};

export const assertActual = (value: string, index: number) => {
	if (value !== "HOME" && value !== "DRAW" && value !== "AWAY") {
		throw new Error(
			`Invalid actual value at row ${index}: ${JSON.stringify(value)}`,
		);
	}
};

export const applyTemperatureScaling = (
	probs: { home: number; draw: number; away: number },
	temperature: number,
	scale: CalibrationScale = "unit",
): { home: number; draw: number; away: number } => {
	if (!Number.isFinite(temperature) || temperature <= 0 || temperature === 1) {
		return probs;
	}

	const divisor = scale === "percent" ? 100 : 1;
	const home = Math.max(0, probs.home) / divisor;
	const draw = Math.max(0, probs.draw) / divisor;
	const away = Math.max(0, probs.away) / divisor;
	const logits = [home, draw, away].map((p) =>
		Math.log(clamp(p, 1e-12, 1)) / temperature,
	);
	const exp = logits.map((value) => Math.exp(value));
	const sum = exp.reduce((acc, value) => acc + value, 0);
	if (!Number.isFinite(sum) || sum <= 0) {
		return probs;
	}

	const scaled = {
		home: exp[0] / sum,
		draw: exp[1] / sum,
		away: exp[2] / sum,
	};

	if (scale === "percent") {
		return {
			home: scaled.home * 100,
			draw: scaled.draw * 100,
			away: scaled.away * 100,
		};
	}

	return scaled;
};

export const applyBinaryTemperatureScaling = (
	probYes: number,
	temperature: number,
	scale: CalibrationScale = "unit",
): number => {
	if (!Number.isFinite(temperature) || temperature <= 0 || temperature === 1) {
		return probYes;
	}

	const divisor = scale === "percent" ? 100 : 1;
	const raw = Math.max(0, probYes) / divisor;
	const p = clamp(raw, 1e-6, 1 - 1e-6);
	const logit = Math.log(p / (1 - p)) / temperature;
	const scaled = 1 / (1 + Math.exp(-logit));

	if (scale === "percent") {
		return scaled * 100;
	}

	return scaled;
};

export const logLoss = (
	rows: Array<{
		probHomeWin: number;
		probDraw: number;
		probAwayWin: number;
		actual: string;
	}>,
	temperature = 1,
) => {
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

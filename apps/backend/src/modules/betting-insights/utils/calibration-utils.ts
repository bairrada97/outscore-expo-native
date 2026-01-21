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

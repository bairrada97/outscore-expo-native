export type FormResult = "W" | "D" | "L";

const RESULT_POINTS: Record<FormResult, number> = {
	W: 3,
	D: 1,
	L: 0,
};

export const buildFormString = (results: FormResult[], length = 5) =>
	results.slice(0, length).join("");

export const calculateWeightedFormScore = (results: FormResult[]) => {
	const weights = results.map((_, index) => {
		if (index < 2) return 1.5;
		if (index < 4) return 1.2;
		return 1;
	});
	const totalWeight = weights.reduce((sum, value) => sum + value, 0);
	if (totalWeight === 0) return 0;
	const weighted = results.reduce(
		(sum, result, idx) => sum + RESULT_POINTS[result] * weights[idx],
		0,
	);
	return weighted / totalWeight;
};

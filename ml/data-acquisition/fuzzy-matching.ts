export const levenshteinDistance = (a: string, b: string) => {
	const matrix: number[][] = Array.from({ length: a.length + 1 }, () =>
		Array.from({ length: b.length + 1 }, () => 0),
	);

	for (let i = 0; i <= a.length; i += 1) matrix[i][0] = i;
	for (let j = 0; j <= b.length; j += 1) matrix[0][j] = j;

	for (let i = 1; i <= a.length; i += 1) {
		for (let j = 1; j <= b.length; j += 1) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			matrix[i][j] = Math.min(
				matrix[i - 1][j] + 1,
				matrix[i][j - 1] + 1,
				matrix[i - 1][j - 1] + cost,
			);
		}
	}

	return matrix[a.length][b.length];
};

export const similarityRatio = (a: string, b: string) => {
	if (!a && !b) return 1;
	if (!a || !b) return 0;
	const distance = levenshteinDistance(a, b);
	const maxLen = Math.max(a.length, b.length);
	return maxLen === 0 ? 1 : (maxLen - distance) / maxLen;
};

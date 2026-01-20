export type EloMatchType = "LEAGUE" | "CUP" | "INTERNATIONAL";

export type EloMatchResult = "HOME_WIN" | "DRAW" | "AWAY_WIN";

export interface EloUpdateInput {
	homeElo: number;
	awayElo: number;
	matchType: EloMatchType;
	goalDiff: number;
	homeAdvantage?: number;
}

export interface EloUpdateResult {
	homeElo: number;
	awayElo: number;
	homeDelta: number;
	awayDelta: number;
}

const DEFAULT_HOME_ADVANTAGE = 60;

const K_FACTORS: Record<EloMatchType, number> = {
	LEAGUE: 20,
	CUP: 18,
	INTERNATIONAL: 24,
};

const MIN_GOAL_MULTIPLIER = 1;
const MAX_GOAL_MULTIPLIER = 1.5;

const clamp = (value: number, min: number, max: number) =>
	Math.max(min, Math.min(max, value));

export const calculateExpectedScore = (
	ratingA: number,
	ratingB: number,
	homeAdvantage = DEFAULT_HOME_ADVANTAGE,
) => 1 / (1 + 10 ** (-(ratingA - ratingB + homeAdvantage) / 400));

export const calculateGoalMultiplier = (goalDiff: number) => {
	if (goalDiff <= 1) return MIN_GOAL_MULTIPLIER;
	const multiplier = 1 + (goalDiff - 1) * 0.25;
	return clamp(multiplier, MIN_GOAL_MULTIPLIER, MAX_GOAL_MULTIPLIER);
};

export const resolveMatchResult = (
	goalDiff: number,
): EloMatchResult => {
	if (goalDiff > 0) return "HOME_WIN";
	if (goalDiff < 0) return "AWAY_WIN";
	return "DRAW";
};

const resultScore = (result: EloMatchResult) => {
	if (result === "HOME_WIN") return 1;
	if (result === "DRAW") return 0.5;
	return 0;
};

export const updateElo = (input: EloUpdateInput): EloUpdateResult => {
	const homeAdvantage = input.homeAdvantage ?? DEFAULT_HOME_ADVANTAGE;
	const expectedHome = calculateExpectedScore(
		input.homeElo,
		input.awayElo,
		homeAdvantage,
	);
	const expectedAway = 1 - expectedHome;

	const result = resolveMatchResult(input.goalDiff);
	const homeScore = resultScore(result);
	const awayScore = 1 - homeScore;

	const k = K_FACTORS[input.matchType];
	const g = calculateGoalMultiplier(Math.abs(input.goalDiff));

	const homeDelta = k * g * (homeScore - expectedHome);
	const awayDelta = k * g * (awayScore - expectedAway);

	return {
		homeElo: input.homeElo + homeDelta,
		awayElo: input.awayElo + awayDelta,
		homeDelta,
		awayDelta,
	};
};

export const applySeasonRegression = (elo: number, factor = 0.15) => {
	const regression = clamp(factor, 0, 0.3);
	return 1500 + (elo - 1500) * (1 - regression);
};

export const calculateEloConfidence = (games: number, fullGames = 50) =>
	clamp(games / fullGames, 0, 1);

export const calculateEloGapAdjustment = (
	eloGap: number,
	gamesConfidence: number,
	maxPoints = 8,
) => {
	const normalized = clamp(eloGap / 50, -1, 1);
	return clamp(normalized * maxPoints * gamesConfidence, -maxPoints, maxPoints);
};

export const calculateEloBalanceShift = (
	eloGap: number,
	gamesConfidence: number,
	maxShift = 0.08,
) => {
	const normalized = clamp(eloGap / 80, -1, 1);
	return clamp(normalized * maxShift * gamesConfidence, -maxShift, maxShift);
};

export const calculateAssociationOffset = (
	coefficient5y: number | null,
) => {
	if (coefficient5y === null || coefficient5y === undefined) return 0;
	return clamp((coefficient5y - 30) * 2, -120, 120);
};

export const calculateClubOffset = (clubCoefficient: number | null) => {
	if (clubCoefficient === null || clubCoefficient === undefined) return 0;
	return clamp((clubCoefficient - 40) * 2, -80, 120);
};

export const inferDivisionLevel = (leagueName: string | null | undefined) => {
	if (!leagueName) return null;
	const name = leagueName.toLowerCase();

	if (
		name.includes("u21") ||
		name.includes("u20") ||
		name.includes("u19") ||
		name.includes("youth")
	) {
		return null;
	}

	if (
		name.includes("premier") ||
		name.includes("primeira") ||
		name.includes("primera") ||
		name.includes("liga 1") ||
		name.includes("ligue 1") ||
		name.includes("serie a") ||
		name === "bundesliga" ||
		name.includes("la liga")
	) {
		return 1;
	}

	if (
		name.includes("championship") ||
		name.includes("2. bundesliga") ||
		name.includes("bundesliga 2") ||
		name.includes("liga 2") ||
		name.includes("ligue 2") ||
		name.includes("serie b") ||
		name.includes("segunda") ||
		/\bdivision 2\b/.test(name) ||
		/\b2nd\b/.test(name)
	) {
		return 2;
	}

	if (
		name.includes("league one") ||
		name.includes("3. liga") ||
		name.includes("liga 3") ||
		name.includes("ligue 3") ||
		name.includes("serie c") ||
		/\bdivision 3\b/.test(name) ||
		/\b3rd\b/.test(name)
	) {
		return 3;
	}

	if (
		name.includes("league two") ||
		name.includes("liga 4") ||
		name.includes("serie d") ||
		/\bdivision 4\b/.test(name) ||
		/\b4th\b/.test(name)
	) {
		return 4;
	}

	return null;
};

export const calculateDivisionOffset = (divisionLevel: number | null) => {
	if (!divisionLevel) return 0;
	if (divisionLevel === 1) return 0;
	if (divisionLevel === 2) return -120;
	if (divisionLevel === 3) return -200;
	if (divisionLevel === 4) return -260;
	return -280;
};

export const calculateStartingElo = (params: {
	associationCoefficient5y?: number | null;
	clubCoefficient?: number | null;
	divisionOffset?: number;
}) => {
	const assocOffset = calculateAssociationOffset(
		params.associationCoefficient5y ?? null,
	);
	const clubOffset = calculateClubOffset(params.clubCoefficient ?? null);
	const divisionOffset = params.divisionOffset ?? 0;
	return 1500 + assocOffset + clubOffset + divisionOffset;
};

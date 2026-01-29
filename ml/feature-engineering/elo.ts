/**
 * ELO Rating System for ML Training
 *
 * Computes ELO ratings for teams based on historical match results.
 * The algorithm updates ratings after each match chronologically.
 *
 * Standard ELO parameters:
 * - K-factor: 32 (higher for more volatility)
 * - Initial rating: 1500
 * - Home advantage: 100 ELO points
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

/** K-factor determines how much a single match affects the rating */
const K_FACTOR = 32;

/** Starting ELO for teams with no history */
const INITIAL_ELO = 1500;

/** Home advantage in ELO points */
const HOME_ADVANTAGE = 100;

// ============================================================================
// LEAGUE TIERS
// ============================================================================

/**
 * Tier mapping for leagues
 * Tier 1: Top 5 leagues (EPL, La Liga, Serie A, Bundesliga, Ligue 1)
 * Tier 2: Strong leagues (Portugal, Netherlands, etc.)
 * Tier 3: Mid-tier leagues
 * Tier 4: Lower leagues
 */
export const LEAGUE_TIER_MAP: Record<number, number> = {
	// Tier 1 - Top 5 leagues
	39: 1, // Premier League
	140: 1, // La Liga
	135: 1, // Serie A
	78: 1, // Bundesliga
	61: 1, // Ligue 1

	// Tier 2 - Strong leagues
	94: 2, // Primeira Liga (Portugal)
	88: 2, // Eredivisie (Netherlands)
	40: 2, // Championship (England)
	141: 2, // La Liga 2 (Spain)
	136: 2, // Serie B (Italy)

	// Tier 3 - Mid-tier leagues
	79: 3, // 2. Bundesliga (Germany)
	62: 3, // Ligue 2 (France)
	2: 3, // UEFA Champions League
	3: 3, // UEFA Europa League
	848: 3, // Europa Conference League

	// Default to tier 2 for unknown leagues (conservative)
};

/**
 * Get tier for a league ID
 * Returns 2 as default for unknown leagues
 */
export function getLeagueTier(leagueId: number | null): number {
	if (leagueId === null) return 2;
	return LEAGUE_TIER_MAP[leagueId] ?? 2;
}

// ============================================================================
// ELO CALCULATION
// ============================================================================

/**
 * Calculate expected score based on ELO ratings
 * Uses the standard logistic formula
 */
function expectedScore(ratingA: number, ratingB: number): number {
	return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * Get actual score for ELO calculation
 * Win = 1, Draw = 0.5, Loss = 0
 */
function getActualScore(result: "HOME" | "DRAW" | "AWAY", isHome: boolean): number {
	if (result === "DRAW") return 0.5;
	const homeWon = result === "HOME";
	return homeWon === isHome ? 1 : 0;
}

export interface EloState {
	ratings: Map<string, number>;
	matchCount: Map<string, number>;
}

/**
 * Create a new ELO state tracker
 */
export function createEloState(): EloState {
	return {
		ratings: new Map(),
		matchCount: new Map(),
	};
}

/**
 * Get ELO rating for a team
 */
export function getElo(state: EloState, team: string): number {
	return state.ratings.get(team) ?? INITIAL_ELO;
}

/**
 * Get match count for a team
 */
export function getMatchCount(state: EloState, team: string): number {
	return state.matchCount.get(team) ?? 0;
}

/**
 * Update ELO ratings after a match
 * Returns the pre-match ratings for both teams
 */
export function updateElo(
	state: EloState,
	homeTeam: string,
	awayTeam: string,
	result: "HOME" | "DRAW" | "AWAY",
): { homeElo: number; awayElo: number; eloDiff: number } {
	// Get current ratings
	const homeElo = getElo(state, homeTeam);
	const awayElo = getElo(state, awayTeam);

	// Calculate ELO difference (home perspective, with home advantage)
	const eloDiff = homeElo + HOME_ADVANTAGE - awayElo;

	// Calculate expected scores (with home advantage applied)
	const homeExpected = expectedScore(homeElo + HOME_ADVANTAGE, awayElo);
	const awayExpected = 1 - homeExpected;

	// Get actual scores
	const homeActual = getActualScore(result, true);
	const awayActual = getActualScore(result, false);

	// Update ratings
	const homeNewElo = homeElo + K_FACTOR * (homeActual - homeExpected);
	const awayNewElo = awayElo + K_FACTOR * (awayActual - awayExpected);

	state.ratings.set(homeTeam, homeNewElo);
	state.ratings.set(awayTeam, awayNewElo);

	// Update match counts
	state.matchCount.set(homeTeam, getMatchCount(state, homeTeam) + 1);
	state.matchCount.set(awayTeam, getMatchCount(state, awayTeam) + 1);

	// Return pre-match ELOs (what was used for prediction)
	return { homeElo, awayElo, eloDiff };
}

/**
 * Calculate ELO-based win probability for home team
 * Useful for debugging/validation
 */
export function eloWinProbability(
	homeElo: number,
	awayElo: number,
): { home: number; draw: number; away: number } {
	// Expected score with home advantage
	const homeExpected = expectedScore(homeElo + HOME_ADVANTAGE, awayElo);

	// Convert expected score to win/draw/away probabilities
	// This is an approximation - ELO doesn't natively model draws
	// We use a simple heuristic: draws are more likely when teams are evenly matched
	const drawProbBase = 0.25; // Base draw probability
	const mismatchFactor = Math.abs(homeExpected - 0.5) * 2; // 0 = even, 1 = mismatch
	const drawProb = drawProbBase * (1 - mismatchFactor * 0.5);

	// Remaining probability split by expected score
	const remaining = 1 - drawProb;
	const homeWinProb = remaining * homeExpected;
	const awayWinProb = remaining * (1 - homeExpected);

	return {
		home: homeWinProb,
		draw: drawProb,
		away: awayWinProb,
	};
}

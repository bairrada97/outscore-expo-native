/**
 * H2H Score Calculation
 *
 * Calculates head-to-head advantage based on historical record
 * between the two teams.
 *
 * Reference: docs/betting-insights-algorithm.md - Section 4.6.1 Factor 2
 */

import type { H2HData } from "../types";
import { getH2HWeightAdjustment } from "./h2h-helpers";
import { clamp } from "./helpers";

/**
 * Minimum H2H matches required for meaningful analysis
 */
const MIN_H2H_MATCHES = 3;

/**
 * Calculate H2H score between home and away teams
 *
 * Uses historical win percentages to determine which team
 * has the psychological/historical advantage.
 *
 * @param h2h - Head-to-head data (optional)
 * @returns Score from -100 (away dominates H2H) to +100 (home dominates H2H)
 *
 * @example
 * // Home team won 6 of 10 H2H matches, away won 2
 * calculateH2HScore(h2h); // Returns ~+40 (60% - 20%)
 */
export function calculateH2HScore(h2h?: H2HData): number {
	if (!h2h || h2h.h2hMatchCount < MIN_H2H_MATCHES) {
		return 0; // Neutral if insufficient data
	}

	const totalMatches = h2h.h2hMatchCount;
	const homeWinPct = (h2h.homeTeamWins / totalMatches) * 100;
	const awayWinPct = (h2h.awayTeamWins / totalMatches) * 100;

	// Score based on win percentage difference
	const winDiff = homeWinPct - awayWinPct;

	// Downweight small H2H samples so 3-5 matches can't dominate MatchOutcome.
	const weightedDiff = winDiff * getH2HWeightAdjustment(h2h);

	return clamp(weightedDiff, -100, 100);
}

/**
 * Check if H2H data is sufficient for analysis
 *
 * @param h2h - Head-to-head data
 * @returns True if at least MIN_H2H_MATCHES available
 */
export function hasEnoughH2HData(h2h?: H2HData): boolean {
	return !!h2h && h2h.h2hMatchCount >= MIN_H2H_MATCHES;
}

/**
 * Determine H2H dominant team
 *
 * @param h2h - Head-to-head data
 * @returns 'home', 'away', 'balanced', or 'insufficient'
 */
export function getH2HDominance(
	h2h?: H2HData,
): "home" | "away" | "balanced" | "insufficient" {
	if (!h2h || h2h.h2hMatchCount < MIN_H2H_MATCHES) {
		return "insufficient";
	}

	const score = calculateH2HScore(h2h);

	if (score > 30) return "home";
	if (score < -30) return "away";
	return "balanced";
}

/**
 * Get H2H summary string
 *
 * @param h2h - Head-to-head data
 * @returns Human-readable H2H summary
 */
export function getH2HSummary(h2h?: H2HData): string {
	if (!h2h || h2h.h2hMatchCount === 0) {
		return "No head-to-head history";
	}

	const { homeTeamWins, awayTeamWins, draws, h2hMatchCount } = h2h;

	return `H2H: ${homeTeamWins}W-${draws}D-${awayTeamWins}L in ${h2hMatchCount} matches`;
}

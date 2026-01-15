/**
 * Head-to-Head (H2H) Helper Functions
 *
 * Functions for processing and analyzing H2H data between teams:
 * - Recency weighting (recent matches matter more)
 * - Same-season detection (within-season boost)
 * - Weighted averages for H2H statistics
 *
 * Reference: docs/implementation-plan/phase1.md - Section 1.1.4-1.1.5
 * Algorithm: docs/betting-insights-Algorithm.md - H2H Recency Weighting section
 */

import type { H2HData, H2HRecencyConfig, ProcessedMatch } from "../types";
import { DEFAULT_GOAL_LINES } from "../types";
import {
  calculateTotalGoals,
  determineMatchResult,
  isBTTS,
  isOverGoalsLine
} from "./helpers";

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default H2H recency configuration
 * Based on algorithm document recommendations
 */
const DEFAULT_H2H_RECENCY_CONFIG: H2HRecencyConfig = {
	decayBase: 0.7, // Exponential decay base (0.7^years)
	currentYearWeight: 1.2, // 20% boost for current season matches
	recentMonthsWeight: 1.1, // 10% boost for last 3 months
};

/**
 * Minimum H2H matches for reliable analysis
 */
const MIN_H2H_MATCHES = 3;

/**
 * Days in 3 months (for recent months boost)
 */
const RECENT_MONTHS_DAYS = 90;

// ============================================================================
// SEASON DETECTION
// ============================================================================

/**
 * Get the season year from a date
 * Football seasons typically run Aug-May, so:
 * - Aug 2024 - May 2025 = 2024 season
 *
 * @param date - Date to check
 * @returns Season year (e.g., 2024 for 2024/25 season)
 */
export function getSeasonFromDate(date: Date): number {
	const month = date.getMonth(); // 0-11
	const year = date.getFullYear();

	// If Jan-July, it's the previous year's season
	// If Aug-Dec, it's the current year's season
	return month < 7 ? year - 1 : year;
}

/**
 * Check if two dates are in the same football season
 *
 * @param date1 - First date (string or Date)
 * @param date2 - Second date (string or Date)
 * @returns true if in same season
 */
export function isSameSeasonHelper(
	date1: string | Date,
	date2: string | Date,
): boolean {
	try {
		const d1 = typeof date1 === "string" ? new Date(date1) : date1;
		const d2 = typeof date2 === "string" ? new Date(date2) : date2;

		return getSeasonFromDate(d1) === getSeasonFromDate(d2);
	} catch {
		return false;
	}
}

/**
 * Check if a match is from the current season
 *
 * @param matchDate - Date of the match
 * @param currentDate - Reference date (defaults to now)
 * @returns true if in current season
 */
export function isCurrentSeason(
	matchDate: string | Date,
	currentDate: Date = new Date(),
): boolean {
	return isSameSeasonHelper(matchDate, currentDate);
}

/**
 * Check if a match is within the last N months
 *
 * @param matchDate - Date of the match
 * @param months - Number of months to check
 * @param currentDate - Reference date (defaults to now)
 * @returns true if within last N months
 */
export function isWithinLastMonths(
	matchDate: string | Date,
	months: number,
	currentDate: Date = new Date(),
): boolean {
	try {
		const match =
			typeof matchDate === "string" ? new Date(matchDate) : matchDate;
		const daysDiff =
			(currentDate.getTime() - match.getTime()) / (1000 * 60 * 60 * 24);
		return daysDiff <= months * 30;
	} catch {
		return false;
	}
}

// ============================================================================
// RECENCY WEIGHTING
// ============================================================================

/**
 * Calculate days since a match
 *
 * @param matchDate - Date of the match
 * @param currentDate - Reference date (defaults to now)
 * @returns Number of days since match
 */
function daysSinceMatch(
	matchDate: string | Date,
	currentDate: Date = new Date(),
): number {
	try {
		const match =
			typeof matchDate === "string" ? new Date(matchDate) : matchDate;
		return Math.max(
			0,
			(currentDate.getTime() - match.getTime()) / (1000 * 60 * 60 * 24),
		);
	} catch {
		return 365; // Default to old if can't parse
	}
}

/**
 * Calculate recency weight for a single H2H match
 *
 * Uses days-based decay with bonuses for:
 * - Current season matches (1.2x multiplier)
 * - Recent months matches (1.1x multiplier for last 3 months)
 *
 * Formula: weight = decayBase^(days/365) * seasonBonus * recencyBonus
 *
 * @param matchDate - Date of the match
 * @param config - H2H recency configuration
 * @param currentDate - Reference date (defaults to now)
 * @returns Recency weight (can exceed 1.0 when boosted; typical max is ~1.32 with defaults)
 */
export function calculateSingleH2HWeight(
	matchDate: string | Date,
	config: H2HRecencyConfig = DEFAULT_H2H_RECENCY_CONFIG,
	currentDate: Date = new Date(),
): number {
	const days = daysSinceMatch(matchDate, currentDate);

	// Base decay: exponential decay based on years
	// decayBase^(days/365) means:
	// - 0 days: weight = 1.0
	// - 365 days: weight = 0.7
	// - 730 days: weight = 0.49
	const yearsAgo = days / 365;
	let weight = config.decayBase ** yearsAgo;

	// Apply within-season boost (1.2x)
	if (isCurrentSeason(matchDate, currentDate)) {
		weight *= config.currentYearWeight;
	}

	// Apply recent months boost (1.1x for last 3 months)
	if (days <= RECENT_MONTHS_DAYS) {
		weight *= config.recentMonthsWeight;
	}

	return weight;
}

/**
 * Calculate recency weights for all H2H matches
 *
 * @param matches - Array of H2H matches
 * @param config - H2H recency configuration
 * @param currentDate - Reference date (defaults to now)
 * @returns Array of weights corresponding to each match
 */
export function calculateH2HRecencyWeights(
	matches: ProcessedMatch[],
	config: H2HRecencyConfig = DEFAULT_H2H_RECENCY_CONFIG,
	currentDate: Date = new Date(),
): number[] {
	return matches.map((match) =>
		calculateSingleH2HWeight(match.date, config, currentDate),
	);
}

// ============================================================================
// WEIGHTED CALCULATIONS
// ============================================================================

/**
 * Calculate weighted average given values and weights
 *
 * @param values - Array of values
 * @param weights - Array of weights (same length as values)
 * @returns Weighted average
 */
export function calculateWeightedAverage(
	values: number[],
	weights: number[],
): number {
	if (values.length === 0 || values.length !== weights.length) {
		return 0;
	}

	let weightedSum = 0;
	let totalWeight = 0;

	for (let i = 0; i < values.length; i++) {
		weightedSum += values[i] * weights[i];
		totalWeight += weights[i];
	}

	return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

/**
 * Calculate weighted count (for boolean values like BTTS)
 *
 * @param items - Array of items
 * @param predicate - Function to test each item
 * @param weights - Array of weights
 * @returns Weighted count
 */
export function calculateWeightedCount<T>(
	items: T[],
	predicate: (item: T) => boolean,
	weights: number[],
): number {
	if (items.length === 0 || items.length !== weights.length) {
		return 0;
	}

	let weightedCount = 0;
	let totalWeight = 0;

	for (let i = 0; i < items.length; i++) {
		if (predicate(items[i])) {
			weightedCount += weights[i];
		}
		totalWeight += weights[i];
	}

	return totalWeight > 0 ? weightedCount / totalWeight : 0;
}

/**
 * Calculate weighted percentage
 *
 * @param items - Array of items
 * @param predicate - Function to test each item
 * @param weights - Array of weights
 * @returns Weighted percentage (0-100)
 */
export function calculateWeightedPercentage<T>(
	items: T[],
	predicate: (item: T) => boolean,
	weights: number[],
): number {
	return calculateWeightedCount(items, predicate, weights) * 100;
}

// ============================================================================
// H2H DATA PROCESSING
// ============================================================================

/**
 * Process raw H2H matches into H2HData structure
 *
 * @param matches - Raw H2H matches from API
 * @param homeTeamId - ID of the home team
 * @param awayTeamId - ID of the away team
 * @param config - H2H recency configuration
 * @param currentDate - Reference date (defaults to now)
 * @returns Processed H2HData
 */
export function processH2HData(
	matches: ProcessedMatch[],
	homeTeamId: number,
	awayTeamId: number,
	config: H2HRecencyConfig = DEFAULT_H2H_RECENCY_CONFIG,
	currentDate: Date = new Date(),
): H2HData {
	// Sort matches by date (most recent first)
	const sortedMatches = [...matches].sort(
		(a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
	);

	// Calculate recency weights
	const weights = calculateH2HRecencyWeights(
		sortedMatches,
		config,
		currentDate,
	);

	// Initialize counters
	let homeTeamWins = 0;
	let awayTeamWins = 0;
	let draws = 0;
	let bttsCount = 0;
	const goalLineOverCount: Record<string, number> = {};
	const totalGoals: number[] = [];
	const homeGoals: number[] = [];
	const awayGoals: number[] = [];

	// Process each match
	for (const match of sortedMatches) {
		const homeScore = match.score.home ?? 0;
		const awayScore = match.score.away ?? 0;

		// Determine winner (from perspective of the two teams in this H2H)
		const isMatchHomeTeamHome = match.homeTeam.id === homeTeamId;
		const relevantHomeScore = isMatchHomeTeamHome ? homeScore : awayScore;
		const relevantAwayScore = isMatchHomeTeamHome ? awayScore : homeScore;

		if (relevantHomeScore > relevantAwayScore) {
			homeTeamWins++;
		} else if (relevantHomeScore < relevantAwayScore) {
			awayTeamWins++;
		} else {
			draws++;
		}

		// Track BTTS and Over/Under Goals by line
		if (isBTTS(homeScore, awayScore)) {
			bttsCount++;
		}
		for (const line of DEFAULT_GOAL_LINES) {
			const key = String(line);
			if (goalLineOverCount[key] == null) goalLineOverCount[key] = 0;
			if (isOverGoalsLine(homeScore, awayScore, line)) {
				goalLineOverCount[key] += 1;
			}
		}

		// Track goals
		totalGoals.push(calculateTotalGoals(homeScore, awayScore));
		homeGoals.push(relevantHomeScore);
		awayGoals.push(relevantAwayScore);
	}

	const matchCount = sortedMatches.length;
	const hasSufficientData = matchCount >= MIN_H2H_MATCHES;

	// Calculate weighted averages for goals
	const avgGoals =
		matchCount > 0 ? calculateWeightedAverage(totalGoals, weights) : 0;
	const avgHomeGoals =
		matchCount > 0 ? calculateWeightedAverage(homeGoals, weights) : 0;
	const avgAwayGoals =
		matchCount > 0 ? calculateWeightedAverage(awayGoals, weights) : 0;

	// Calculate percentages (using weighted calculation)
	const bttsPercentage =
		matchCount > 0
			? calculateWeightedPercentage(
					sortedMatches,
					(m) => isBTTS(m.score.home, m.score.away),
					weights,
				)
			: 0;

	const goalLineOverPct: Record<string, number> = {};
	for (const line of DEFAULT_GOAL_LINES) {
		const key = String(line);
		goalLineOverPct[key] =
			matchCount > 0
				? calculateWeightedPercentage(
						sortedMatches,
						(m) => isOverGoalsLine(m.score.home, m.score.away, line),
						weights,
					)
				: 0;
	}

	return {
		matches: sortedMatches,
		h2hMatchCount: matchCount,
		homeTeamWins,
		awayTeamWins,
		draws,
		bttsCount,
		bttsPercentage,
		goalLineOverCount,
		goalLineOverPct,
		avgGoals,
		avgHomeGoals,
		avgAwayGoals,
		recencyWeights: weights,
		hasSufficientData,
	};
}

// ============================================================================
// H2H ANALYSIS HELPERS
// ============================================================================

/**
 * Calculate H2H home win percentage with recency weighting
 *
 * @param h2h - H2H data
 * @returns Home win percentage (0-100)
 */
export function getWeightedH2HHomeWinPct(h2h: H2HData): number {
	if (h2h.h2hMatchCount === 0) return 50; // Default to neutral

	return calculateWeightedPercentage(
		h2h.matches,
		(m) => {
			const result = determineMatchResult(m.goalsScored, m.goalsConceded);
			return result === "W" && m.isHome;
		},
		h2h.recencyWeights,
	);
}

/**
 * Calculate H2H away win percentage with recency weighting
 *
 * @param h2h - H2H data
 * @returns Away win percentage (0-100)
 */
export function getWeightedH2HAwayWinPct(h2h: H2HData): number {
	if (h2h.h2hMatchCount === 0) return 50; // Default to neutral

	return calculateWeightedPercentage(
		h2h.matches,
		(m) => {
			const result = determineMatchResult(m.goalsScored, m.goalsConceded);
			return result === "W" && !m.isHome;
		},
		h2h.recencyWeights,
	);
}

/**
 * Calculate H2H draw percentage with recency weighting
 *
 * @param h2h - H2H data
 * @returns Draw percentage (0-100)
 */
export function getWeightedH2HDrawPct(h2h: H2HData): number {
	if (h2h.h2hMatchCount === 0) return 25; // Default to typical draw rate

	return calculateWeightedPercentage(
		h2h.matches,
		(m) => determineMatchResult(m.goalsScored, m.goalsConceded) === "D",
		h2h.recencyWeights,
	);
}

/**
 * Get H2H data quality assessment
 *
 * @param h2h - H2H data
 * @returns Quality level ('HIGH' | 'MEDIUM' | 'LOW')
 */
export function assessH2HDataQuality(h2h: H2HData): "HIGH" | "MEDIUM" | "LOW" {
	if (h2h.h2hMatchCount >= 8) return "HIGH";
	if (h2h.h2hMatchCount >= MIN_H2H_MATCHES) return "MEDIUM";
	return "LOW";
}

/**
 * Calculate H2H weight adjustment factor
 * Reduces H2H weight when data is insufficient
 *
 * @param h2h - H2H data
 * @returns Weight multiplier (0.4 - 1.0)
 */
export function getH2HWeightAdjustment(h2h: H2HData): number {
	if (h2h.h2hMatchCount >= 8) return 1.0;
	if (h2h.h2hMatchCount >= 5) return 0.8;
	if (h2h.h2hMatchCount >= MIN_H2H_MATCHES) return 0.6;
	return 0.4; // Very low data
}

/**
 * General Helper Functions for Betting Insights
 *
 * Core utility functions for data processing:
 * - Friendly match filtering
 * - Round number extraction
 * - Early season detection
 * - Days since match calculation
 *
 * Reference: docs/implementation-plan/phase1.md - Section 1.1
 */

import type { MatchResult } from "../types";

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Keywords that identify friendly/exhibition matches
 * These should be excluded from competitive analysis
 */
const FRIENDLY_KEYWORDS = [
	"Friendlies Clubs",
	"friendly",
	"friendlies",
	"club friendly",
	"international friendly",
	"exhibition",
	"testimonial",
	"charity",
	"pre-season",
	"preseason",
	"tour",
	// NOTE: Avoid generic keywords like "trophy" (can match competitive comps like "EFL Trophy")
] as const;

/**
 * Round string patterns for extraction
 * Handles various formats from different leagues/competitions
 */
const ROUND_PATTERNS = [
	/Regular Season - (\d+)/i,
	/Matchday (\d+)/i,
	/Round (\d+)/i,
	/Week (\d+)/i,
	/Gameweek (\d+)/i,
	/Jornada (\d+)/i, // Spanish
	/Journée (\d+)/i, // French
	/Giornata (\d+)/i, // Italian
	/Spieltag (\d+)/i, // German
	/^\s*(\d+)\s*$/i, // Just a number
] as const;

/**
 * Early season threshold (first N rounds)
 */
const EARLY_SEASON_ROUNDS = 5;

// ============================================================================
// FRIENDLY MATCH FILTERING
// ============================================================================

/**
 * Check if a league name indicates a friendly match
 *
 * @param leagueName - Name of the league/competition
 * @returns true if the match is likely a friendly
 */
export function isFriendlyMatch(leagueName: string): boolean {
	if (!leagueName) return false;

	const lowerName = leagueName.toLowerCase();
	return FRIENDLY_KEYWORDS.some((keyword) => lowerName.includes(keyword));
}

/**
 * Filter out friendly matches from an array
 *
 * @param matches - Array of matches to filter
 * @returns Matches with friendlies removed
 */
export function filterNonFriendlyMatches<
	T extends { league?: { name?: string } },
>(matches: T[]): T[] {
	return matches.filter((match) => {
		const leagueName = match.league?.name || "";
		return !isFriendlyMatch(leagueName);
	});
}

// ============================================================================
// ROUND NUMBER EXTRACTION
// ============================================================================

/**
 * Extract round number from various round string formats
 *
 * Handles formats like:
 * - "Regular Season - 3"
 * - "Matchday 5"
 * - "Round 2"
 * - "Jornada 10"
 *
 * @param roundString - The round string from the API
 * @returns The round number or null if not parseable
 */
export function extractRoundNumber(
	roundString: string | undefined,
): number | null {
	if (!roundString) return null;

	// Try each pattern
	for (const pattern of ROUND_PATTERNS) {
		const match = roundString.match(pattern);
		if (match && match[1]) {
			const roundNum = parseInt(match[1], 10);
			if (!Number.isNaN(roundNum) && roundNum > 0) {
				return roundNum;
			}
		}
	}

	// Try to extract any number from the string as fallback
	const numbers = roundString.match(/\d+/);
	if (numbers) {
		const num = parseInt(numbers[0], 10);
		if (!Number.isNaN(num) && num > 0 && num <= 50) {
			// Reasonable round range
			return num;
		}
	}

	return null;
}

// ============================================================================
// EARLY SEASON DETECTION
// ============================================================================

/**
 * Check if a match is in the early season (first 5 rounds)
 *
 * Early season matches have less predictable outcomes because:
 * - Teams are still finding their rhythm
 * - New signings haven't integrated
 * - Formations are more experimental
 *
 * Algorithm adjustment: Reduce recent form weight by 40%, increase H2H/historical
 *
 * @param roundString - The round string from the API
 * @param threshold - Number of rounds considered "early" (default: 5)
 * @returns true if in early season
 */
export function isEarlySeason(
	roundString: string | undefined,
	threshold: number = EARLY_SEASON_ROUNDS,
): boolean {
	const roundNumber = extractRoundNumber(roundString);

	// If we can't determine the round, assume not early season
	if (roundNumber === null) return false;

	return roundNumber <= threshold;
}

/**
 * Check if a match is in the end of season (last 5 rounds)
 *
 * End of season matches can be unpredictable because:
 * - Teams may be "safe" with nothing to play for
 * - Relegation battles create pressure
 * - Title races intensify
 *
 * @param roundString - The round string from the API
 * @param totalRounds - Total rounds in the season (default: 38 for most leagues)
 * @param threshold - Number of rounds from end considered "late" (default: 5)
 * @returns true if in end of season
 */
export function isEndOfSeason(
	roundString: string | undefined,
	totalRounds: number = 38,
	threshold: number = 5,
): boolean {
	const roundNumber = extractRoundNumber(roundString);

	if (roundNumber === null) return false;

	return roundNumber > totalRounds - threshold;
}

// ============================================================================
// DATE & TIME HELPERS
// ============================================================================

/**
 * Calculate days since last match
 *
 * @param lastMatchDate - ISO date string of last match
 * @param currentDate - Current date (defaults to now)
 * @returns Number of days since last match
 */
export function calculateDaysSinceLastMatch(
	lastMatchDate: string | undefined,
	currentDate: Date = new Date(),
): number {
	if (!lastMatchDate) return 14; // Default to 2 weeks if no data

	try {
		const lastMatch = new Date(lastMatchDate);
		const diffTime = currentDate.getTime() - lastMatch.getTime();
		const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

		// Sanity check: if negative or too large, return default
		if (diffDays < 0 || diffDays > 365) {
			return 14;
		}

		return diffDays;
	} catch {
		return 14;
	}
}

/**
 * Check if a match date is within a certain number of days
 *
 * @param matchDate - ISO date string of the match
 * @param days - Number of days to check
 * @param referenceDate - Reference date (defaults to now)
 * @returns true if match is within the specified days
 */
export function isWithinDays(
	matchDate: string,
	days: number,
	referenceDate: Date = new Date(),
): boolean {
	try {
		const match = new Date(matchDate);
		const diffTime = Math.abs(referenceDate.getTime() - match.getTime());
		const diffDays = diffTime / (1000 * 60 * 60 * 24);
		return diffDays <= days;
	} catch {
		return false;
	}
}

// ============================================================================
// MATCH RESULT HELPERS
// ============================================================================

/**
 * Determine match result from a team's perspective
 *
 * @param goalsFor - Goals scored by the team
 * @param goalsAgainst - Goals conceded by the team
 * @returns 'W', 'D', or 'L'
 */
export function determineMatchResult(
	goalsFor: number | null,
	goalsAgainst: number | null,
): MatchResult {
	if (goalsFor === null || goalsAgainst === null) {
		// Default to draw if scores not available
		return "D";
	}

	if (goalsFor > goalsAgainst) return "W";
	if (goalsFor < goalsAgainst) return "L";
	return "D";
}

/**
 * Calculate points from a match result
 *
 * @param result - Match result ('W', 'D', 'L')
 * @returns Points earned (3 for win, 1 for draw, 0 for loss)
 */
export function calculateMatchPoints(result: MatchResult): number {
	switch (result) {
		case "W":
			return 3;
		case "D":
			return 1;
		case "L":
			return 0;
		default:
			return 0;
	}
}

/**
 * Generate form string from match results
 *
 * @param results - Array of match results (most recent first)
 * @param length - Length of form string (default: 5)
 * @returns Form string like "WWDLW"
 */
export function generateFormString(
	results: MatchResult[],
	length: number = 5,
): string {
	return results.slice(0, length).join("");
}

// ============================================================================
// SCORING HELPERS
// ============================================================================

/**
 * Check if both teams scored in a match
 *
 * @param homeGoals - Goals scored by home team
 * @param awayGoals - Goals scored by away team
 * @returns true if both teams scored
 */
export function isBTTS(
	homeGoals: number | null | undefined,
	awayGoals: number | null | undefined,
): boolean {
	// Treat both `null` and `undefined` as missing data (prevents NaN comparisons downstream)
	if (homeGoals == null || awayGoals == null) return false;
	return homeGoals > 0 && awayGoals > 0;
}

/**
 * Check if total goals are over 2.5
 *
 * @param homeGoals - Goals scored by home team
 * @param awayGoals - Goals scored by away team
 * @returns true if over 2.5 goals
 */
export function isOver25(
	homeGoals: number | null | undefined,
	awayGoals: number | null | undefined,
): boolean {
	return isOverGoalsLine(homeGoals, awayGoals, 2.5);
}

/**
 * Check if total goals are over a given goal line
 *
 * @param homeGoals - Goals scored by home team
 * @param awayGoals - Goals scored by away team
 * @param line - Goal line threshold (e.g. 2.5)
 * @returns true if total goals > line
 */
export function isOverGoalsLine(
	homeGoals: number | null | undefined,
	awayGoals: number | null | undefined,
	line: number,
): boolean {
	// Treat both `null` and `undefined` as missing data (prevents `undefined + undefined` => NaN)
	if (homeGoals == null || awayGoals == null) return false;
	return homeGoals + awayGoals > line;
}

/**
 * Calculate total goals in a match
 *
 * @param homeGoals - Goals scored by home team
 * @param awayGoals - Goals scored by away team
 * @returns Total goals or 0 if null
 */
export function calculateTotalGoals(
	homeGoals: number | null | undefined,
	awayGoals: number | null | undefined,
): number {
	return (homeGoals ?? 0) + (awayGoals ?? 0);
}

// ============================================================================
// ARRAY HELPERS
// ============================================================================

/**
 * Calculate average of numeric array
 *
 * @param values - Array of numbers
 * @returns Average or 0 if empty
 */
export function calculateAverage(values: number[]): number {
	if (values.length === 0) return 0;
	const sum = values.reduce((acc, val) => acc + val, 0);
	return sum / values.length;
}

/**
 * Calculate percentage of items meeting a condition
 *
 * @param items - Array of items
 * @param predicate - Function to test each item
 * @returns Percentage (0-100)
 */
export function calculatePercentage<T>(
	items: T[],
	predicate: (item: T) => boolean,
): number {
	if (items.length === 0) return 0;
	const count = items.filter(predicate).length;
	return (count / items.length) * 100;
}

/**
 * Count consecutive items from start meeting a condition
 *
 * @param items - Array of items (most recent first)
 * @param predicate - Function to test each item
 * @returns Count of consecutive items
 */
export function countConsecutive<T>(
	items: T[],
	predicate: (item: T) => boolean,
): number {
	let count = 0;
	for (const item of items) {
		if (predicate(item)) {
			count++;
		} else {
			break;
		}
	}
	return count;
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Check if a value is a valid number
 *
 * @param value - Value to check
 * @returns true if valid number
 */
export function isValidNumber(value: unknown): value is number {
	return typeof value === "number" && !Number.isNaN(value) && isFinite(value);
}

/**
 * Clamp a value between min and max
 *
 * @param value - Value to clamp
 * @param min - Minimum value
 * @param max - Maximum value
 * @returns Clamped value
 */
export function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

/**
 * Round to specified decimal places
 *
 * @param value - Value to round
 * @param decimals - Number of decimal places (default: 2)
 * @returns Rounded value
 */
export function roundTo(value: number, decimals: number = 2): number {
	const factor = 10 ** decimals;
	return Math.round(value * factor) / factor;
}

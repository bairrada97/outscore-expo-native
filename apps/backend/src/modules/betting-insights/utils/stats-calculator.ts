/**
 * Statistics Calculator Functions
 *
 * Functions for calculating and aggregating team statistics:
 * - DNA layer calculation (season stats)
 * - Goal minute distributions
 * - Under/Over percentages
 * - Clean sheet and scoring rates
 * - Danger zone detection
 *
 * Reference: docs/implementation-plan/phase1.md - Section 1.2.6
 * Algorithm: docs/betting-insights-Algorithm.md - DNA Layer section
 */

import type {
	DangerZone,
	DNALayer,
	GoalLine,
	GoalLineOverPctMap,
	GoalMinuteDistribution,
	MotivationLevel,
	ProcessedMatch,
	SafetyFlags,
	TeamStatistics,
} from "../types";
import {
	calculateFormationFrequency,
	getMostPlayedFormation,
} from "./formation-helpers";
import {
	calculatePercentage,
	countConsecutive,
	isBTTS,
	isOverGoalsLine
} from "./helpers";

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Threshold for "late starter" detection
 * Teams scoring <5% in first 15 minutes are late starters
 */
const LATE_STARTER_THRESHOLD = 5;

/**
 * Threshold for danger zone detection
 * Periods with >25% of goals are danger zones
 */
const DANGER_ZONE_THRESHOLD = 25;

/**
 * Default goal minute distribution (when no data)
 */
const DEFAULT_GOAL_MINUTE_DISTRIBUTION: GoalMinuteDistribution = {
	"0-15": 15,
	"16-30": 17,
	"31-45": 18,
	"46-60": 17,
	"61-75": 17,
	"76-90": 16,
};

// ============================================================================
// GOAL STATISTICS
// ============================================================================

/**
 * Calculate Over-goals percentage for a given goal line
 */
export function calculateOverGoalsPercentageForLine(
	matches: ProcessedMatch[],
	line: GoalLine,
): number {
	return calculatePercentage(matches, (m) =>
		isOverGoalsLine(m.goalsScored, m.goalsConceded, line),
	);
}

/**
 * Calculate Over-goals percentages for all supported lines
 */
export function calculateGoalLineOverPct(
	matches: ProcessedMatch[],
	lines: readonly GoalLine[] = [0.5, 1.5, 2.5, 3.5, 4.5, 5.5],
): GoalLineOverPctMap {
	const result: GoalLineOverPctMap = {};
	for (const line of lines) {
		result[String(line) as `${GoalLine}`] = calculateOverGoalsPercentageForLine(
			matches,
			line,
		);
	}
	return result;
}

/**
 * Calculate BTTS Yes rate
 *
 * @param matches - Array of processed matches
 * @returns BTTS Yes percentage (0-100)
 */
export function calculateBTTSYesRate(matches: ProcessedMatch[]): number {
	return calculatePercentage(matches, (m) =>
		isBTTS(m.goalsScored, m.goalsConceded),
	);
}

/**
 * Calculate average goals per game
 *
 * @param matches - Array of processed matches
 * @returns Average goals (scored + conceded)
 */
export function calculateAvgGoalsPerGame(matches: ProcessedMatch[]): number {
	if (matches.length === 0) return 2.5; // Default

	const totalGoals = matches.reduce(
		(sum, m) => sum + m.goalsScored + m.goalsConceded,
		0,
	);
	return totalGoals / matches.length;
}

/**
 * Calculate average goals scored per game
 *
 * @param matches - Array of processed matches
 * @returns Average goals scored
 */
export function calculateAvgGoalsScored(matches: ProcessedMatch[]): number {
	if (matches.length === 0) return 1.2;
	const total = matches.reduce((sum, m) => sum + m.goalsScored, 0);
	return total / matches.length;
}

/**
 * Calculate average goals conceded per game
 *
 * @param matches - Array of processed matches
 * @returns Average goals conceded
 */
export function calculateAvgGoalsConceded(matches: ProcessedMatch[]): number {
	if (matches.length === 0) return 1.2;
	const total = matches.reduce((sum, m) => sum + m.goalsConceded, 0);
	return total / matches.length;
}

// ============================================================================
// DEFENSIVE STATISTICS
// ============================================================================

/**
 * Calculate clean sheet percentage
 *
 * @param matches - Array of processed matches
 * @returns Clean sheet percentage (0-100)
 */
export function calculateCleanSheetPercentage(
	matches: ProcessedMatch[],
): number {
	return calculatePercentage(matches, (m) => m.goalsConceded === 0);
}

/**
 * Calculate failed to score percentage
 *
 * @param matches - Array of processed matches
 * @returns Failed to score percentage (0-100)
 */
export function calculateFailedToScorePercentage(
	matches: ProcessedMatch[],
): number {
	return calculatePercentage(matches, (m) => m.goalsScored === 0);
}

// ============================================================================
// GOAL MINUTE DISTRIBUTION
// ============================================================================

/**
 * Get minute range key from elapsed minute
 *
 * @param minute - Elapsed minute (1-90+)
 * @returns Minute range key
 */
function getMinuteRangeKey(minute: number): keyof GoalMinuteDistribution {
	if (minute <= 15) return "0-15";
	if (minute <= 30) return "16-30";
	if (minute <= 45) return "31-45";
	if (minute <= 60) return "46-60";
	if (minute <= 75) return "61-75";
	return "76-90";
}

/**
 * Calculate goal minute distribution from match events
 *
 * NOTE: This requires goal minute data from match events.
 * If not available, returns default distribution.
 *
 * @param goalMinutes - Array of minutes when goals were scored
 * @returns Goal minute distribution
 */
export function calculateGoalMinuteDistribution(
	goalMinutes: number[],
): GoalMinuteDistribution {
	if (goalMinutes.length === 0) {
		return { ...DEFAULT_GOAL_MINUTE_DISTRIBUTION };
	}

	const distribution: GoalMinuteDistribution = {
		"0-15": 0,
		"16-30": 0,
		"31-45": 0,
		"46-60": 0,
		"61-75": 0,
		"76-90": 0,
	};

	// Count goals in each period
	for (const minute of goalMinutes) {
		const key = getMinuteRangeKey(minute);
		distribution[key]++;
	}

	// Convert to percentages
	const total = goalMinutes.length;
	for (const key of Object.keys(
		distribution,
	) as (keyof GoalMinuteDistribution)[]) {
		distribution[key] = (distribution[key] / total) * 100;
	}

	return distribution;
}

/**
 * Check if team is a "late starter" (rarely scores in first 15 mins)
 *
 * @param distribution - Goal minute distribution
 * @param threshold - Percentage threshold (default: 5%)
 * @returns true if late starter
 */
export function isLateStarter(
	distribution: GoalMinuteDistribution,
	threshold: number = LATE_STARTER_THRESHOLD,
): boolean {
	return distribution["0-15"] < threshold;
}

/**
 * Calculate first half goal percentage
 *
 * @param distribution - Goal minute distribution
 * @returns First half percentage (0-100)
 */
export function calculateFirstHalfGoalPercentage(
	distribution: GoalMinuteDistribution,
): number {
	return distribution["0-15"] + distribution["16-30"] + distribution["31-45"];
}

// ============================================================================
// DANGER ZONE DETECTION
// ============================================================================

/**
 * Detect danger zones from goal distribution
 *
 * A danger zone is a period where the team scores/concedes >25% of goals
 *
 * @param scoringDistribution - Distribution of goals scored
 * @param concedingDistribution - Distribution of goals conceded
 * @param threshold - Percentage threshold (default: 25%)
 * @returns Array of danger zones
 */
export function detectDangerZones(
	scoringDistribution: GoalMinuteDistribution,
	concedingDistribution: GoalMinuteDistribution,
	threshold: number = DANGER_ZONE_THRESHOLD,
): DangerZone[] {
	const dangerZones: DangerZone[] = [];

	// Check scoring danger zones
	for (const [period, pct] of Object.entries(scoringDistribution)) {
		if (pct >= threshold) {
			dangerZones.push({
				period: period as keyof GoalMinuteDistribution,
				percentage: pct,
				type: "scoring",
			});
		}
	}

	// Check conceding danger zones
	for (const [period, pct] of Object.entries(concedingDistribution)) {
		if (pct >= threshold) {
			dangerZones.push({
				period: period as keyof GoalMinuteDistribution,
				percentage: pct,
				type: "conceding",
			});
		}
	}

	// Sort by percentage (highest first)
	return dangerZones.sort((a, b) => b.percentage - a.percentage);
}

// ============================================================================
// DNA LAYER CALCULATION
// ============================================================================

/**
 * Calculate complete DNA layer from season matches
 *
 * @param matches - Season matches (most recent first)
 * @param scoringMinutes - Optional array of goal minutes for distribution
 * @param concedingMinutes - Optional array of conceding minutes for distribution
 * @returns DNALayer data
 */
export function calculateDNALayer(
	matches: ProcessedMatch[],
	scoringMinutes: number[] = [],
	concedingMinutes: number[] = [],
): DNALayer {
	// Formation analysis
	const formationFrequency = calculateFormationFrequency(matches);
	const mostPlayedFormation = getMostPlayedFormation(matches);

	// Goal statistics
	const goalLineOverPct = calculateGoalLineOverPct(matches);
	const cleanSheetPercentage = calculateCleanSheetPercentage(matches);
	const failedToScorePercentage = calculateFailedToScorePercentage(matches);
	const bttsYesRate = calculateBTTSYesRate(matches);
	const avgGoalsPerGame = calculateAvgGoalsPerGame(matches);
	const avgGoalsConcededPerGame = calculateAvgGoalsConceded(matches);

	// Goal minute distributions
	const goalMinutesScoring =
		scoringMinutes.length > 0
			? calculateGoalMinuteDistribution(scoringMinutes)
			: { ...DEFAULT_GOAL_MINUTE_DISTRIBUTION };

	const goalMinutesConceding =
		concedingMinutes.length > 0
			? calculateGoalMinuteDistribution(concedingMinutes)
			: { ...DEFAULT_GOAL_MINUTE_DISTRIBUTION };

	// Late starter detection
	const lateStarter = isLateStarter(goalMinutesScoring);

	// First half percentage
	const firstHalfGoalPercentage =
		calculateFirstHalfGoalPercentage(goalMinutesScoring);

	// Danger zones
	const dangerZones = detectDangerZones(
		goalMinutesScoring,
		goalMinutesConceding,
	);

	return {
		mostPlayedFormation,
		formationFrequency,
		goalLineOverPct,
		cleanSheetPercentage,
		failedToScorePercentage,
		bttsYesRate,
		goalMinutesScoring,
		goalMinutesConceding,
		isLateStarter: lateStarter,
		dangerZones,
		firstHalfGoalPercentage,
		avgGoalsPerGame,
		avgGoalsConcededPerGame,
	};
}

// ============================================================================
// TEAM STATISTICS CALCULATION
// ============================================================================

/**
 * Calculate team statistics from matches
 *
 * @param allMatches - All matches (for form)
 * @param homeMatches - Home matches
 * @param awayMatches - Away matches
 * @param leaguePosition - Current league position (if known)
 * @returns TeamStatistics data
 */
export function calculateTeamStatistics(
	allMatches: ProcessedMatch[],
	homeMatches: ProcessedMatch[],
	awayMatches: ProcessedMatch[],
	leaguePosition: number = 10,
	pointsFromCL: number = 0,
	pointsFromRelegation: number = 0,
	pointsFromFirst: number = 0,
): TeamStatistics {
	// Calculate form string (last 5)
	const formResults = allMatches.slice(0, 5).map((m) => m.result);
	const form = formResults.join("");

	// Overall averages
	const avgGoalsScored = calculateAvgGoalsScored(allMatches);
	const avgGoalsConceded = calculateAvgGoalsConceded(allMatches);

	// Home averages
	const homeAvgScored = calculateAvgGoalsScored(homeMatches);
	const homeAvgConceded = calculateAvgGoalsConceded(homeMatches);

	// Away averages
	const awayAvgScored = calculateAvgGoalsScored(awayMatches);
	const awayAvgConceded = calculateAvgGoalsConceded(awayMatches);

	return {
		form,
		leaguePosition,
		avgGoalsScored,
		avgGoalsConceded,
		homeAvgScored,
		homeAvgConceded,
		awayAvgScored,
		awayAvgConceded,
		pointsFromCL,
		pointsFromRelegation,
		pointsFromFirst,
		gamesPlayed: allMatches.length,
	};
}

// ============================================================================
// SAFETY FLAGS CALCULATION
// ============================================================================

/**
 * Determine motivation level based on league position and points
 *
 * @param leaguePosition - Current league position
 * @param pointsFromFirst - Points behind first place
 * @param pointsFromCL - Points from Champions League spot
 * @param pointsFromRelegation - Points above relegation
 * @returns Motivation level
 */
export function determineMotivation(
	leaguePosition: number,
	pointsFromFirst: number,
	pointsFromCL: number,
	pointsFromRelegation: number,
): MotivationLevel {
	// Title race: Top 3 and within 10 points of first
	if (leaguePosition <= 3 && pointsFromFirst <= 10) {
		return "TITLE_RACE";
	}

	// CL race: Within 6 points of top 4
	if (pointsFromCL <= 6 && pointsFromCL >= -6) {
		return "CL_RACE";
	}

	// Europa race: Position 5-7 range, close to European spots
	if (leaguePosition >= 5 && leaguePosition <= 8 && pointsFromCL <= 10) {
		return "EUROPA_RACE";
	}

	// Relegation battle: Within 8 points of drop zone
	if (pointsFromRelegation <= 8) {
		return "RELEGATION_BATTLE";
	}

	// Secure: More than 15 points above relegation, nowhere near Europe
	if (pointsFromRelegation > 15 && pointsFromCL > 15) {
		return "SECURE";
	}

	// Default: Mid-table
	return "MID_TABLE";
}

/**
 * Detect motivation clash between teams
 *
 * @param homeMotivation - Home team motivation
 * @param awayMotivation - Away team motivation
 * @returns true if motivation clash detected
 */
export function detectMotivationClash(
	homeMotivation: MotivationLevel,
	awayMotivation: MotivationLevel,
): boolean {
	const highMotivation: MotivationLevel[] = [
		"TITLE_RACE",
		"CL_RACE",
		"RELEGATION_BATTLE",
	];
	const lowMotivation: MotivationLevel[] = ["MID_TABLE", "SECURE"];

	// Clash if one team is highly motivated and other is not
	const homeHigh = highMotivation.includes(homeMotivation);
	const awayHigh = highMotivation.includes(awayMotivation);
	const homeLow = lowMotivation.includes(homeMotivation);
	const awayLow = lowMotivation.includes(awayMotivation);

	return (homeHigh && awayLow) || (awayHigh && homeLow);
}

/**
 * Detect "live dog" pattern
 *
 * A live dog is a bottom team that has shown fighting spirit:
 * - Scored in 2 of last 3 away games
 * - Team in bottom half of table
 *
 * @param matches - Recent away matches
 * @param leaguePosition - Current league position
 * @returns true if live dog pattern detected
 */
export function detectLiveDog(
	matches: ProcessedMatch[],
	leaguePosition: number,
): boolean {
	// Must be in bottom half
	if (leaguePosition < 10) return false;

	// Check last 3 away matches
	const lastThreeAway = matches.slice(0, 3);
	if (lastThreeAway.length < 3) return false;

	// Count matches where team scored
	const scoredCount = lastThreeAway.filter((m) => m.goalsScored > 0).length;

	return scoredCount >= 2;
}

/**
 * Calculate complete safety flags
 *
 * @param matches - Recent matches (most recent first)
 * @param awayMatches - Away matches for live dog detection
 * @param mindTier - Team's Mind tier
 * @param leaguePosition - Current league position
 * @param pointsFromFirst - Points behind first
 * @param pointsFromCL - Points from CL spot
 * @param pointsFromRelegation - Points above relegation
 * @returns SafetyFlags data
 */
export function calculateSafetyFlags(
	matches: ProcessedMatch[],
	awayMatches: ProcessedMatch[],
	mindTier: 1 | 2 | 3 | 4,
	leaguePosition: number,
	pointsFromFirst: number,
	pointsFromCL: number,
	pointsFromRelegation: number,
): SafetyFlags {
	// Count consecutive wins
	const consecutiveWins = countConsecutive(matches, (m) => m.result === "W");

	// Regression risk: Non-elite team on winning streak
	const regressionRisk = mindTier >= 3 && consecutiveWins >= 5;

	// Motivation
	const motivation = determineMotivation(
		leaguePosition,
		pointsFromFirst,
		pointsFromCL,
		pointsFromRelegation,
	);

	// Note: motivationClash requires both teams, so we set false here
	// It will be calculated when both teams are available
	const motivationClash = false;

	// Live dog detection
	// Live dog is intended for bottom-half, non-elite teams showing away resilience.
	// Avoid flagging Tier 1/2 teams as "underdogs" just because standings data is missing/noisy.
	const liveDog =
		mindTier >= 3 && detectLiveDog(awayMatches, leaguePosition);

	return {
		regressionRisk,
		motivationClash,
		liveDog,
		motivation,
		consecutiveWins,
	};
}

// ============================================================================
// HOME/AWAY SPLIT HELPERS
// ============================================================================

/**
 * Split matches into home and away
 *
 * @param matches - All matches
 * @returns Object with home and away arrays
 */
export function splitHomeAway(matches: ProcessedMatch[]): {
	home: ProcessedMatch[];
	away: ProcessedMatch[];
} {
	return {
		home: matches.filter((m) => m.isHome),
		away: matches.filter((m) => !m.isHome),
	};
}

/**
 * Calculate home/away performance difference
 *
 * @param homeMatches - Home matches
 * @param awayMatches - Away matches
 * @returns Home advantage metrics
 */
export function calculateHomeAwayDifference(
	homeMatches: ProcessedMatch[],
	awayMatches: ProcessedMatch[],
): {
	homeWinRate: number;
	awayWinRate: number;
	homeGoalDiff: number;
	awayGoalDiff: number;
	homeAdvantage: number; // Positive = strong at home
} {
	const homeWinRate = calculatePercentage(homeMatches, (m) => m.result === "W");
	const awayWinRate = calculatePercentage(awayMatches, (m) => m.result === "W");

	const homeGoalDiff =
		homeMatches.reduce((sum, m) => sum + (m.goalsScored - m.goalsConceded), 0) /
		(homeMatches.length || 1);
	const awayGoalDiff =
		awayMatches.reduce((sum, m) => sum + (m.goalsScored - m.goalsConceded), 0) /
		(awayMatches.length || 1);

	const homeAdvantage = homeWinRate - awayWinRate;

	return {
		homeWinRate,
		awayWinRate,
		homeGoalDiff,
		awayGoalDiff,
		homeAdvantage,
	};
}

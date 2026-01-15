/**
 * Tier and Efficiency Index Helper Functions
 *
 * Functions for calculating Mind/Mood layers:
 * - Efficiency Index (EI) calculation
 * - Tier categorization (1-4)
 * - Mind vs Mood gap detection
 * - Sleeping Giant / Over-performer patterns
 * - One-Season Wonder detection
 *
 * Reference: docs/implementation-plan/phase1.md - Section 1.1.6-1.1.10
 * Algorithm: docs/betting-insights-Algorithm.md - Mind/Mood/DNA sections
 */

import { DEFAULT_TIER_THRESHOLDS } from "../config/algorithm-config";
import type {
  MatchResult,
  MindLayer,
  MoodLayer,
  ProcessedMatch,
  TeamTier,
  TierThresholds,
} from "../types";
import { calculateMatchPoints, generateFormString } from "./helpers";

// ============================================================================
// CONSTANTS
// ============================================================================

// NOTE: Tier thresholds are centralized in config (`config/algorithm-config.ts`).

/**
 * Minimum matches for reliable Mind calculation
 */
const MIN_MIND_MATCHES = 30;

/**
 * Ideal matches for Mind calculation
 */
const IDEAL_MIND_MATCHES = 50;

/**
 * Matches for Mood calculation
 */
const MOOD_MATCHES = 10;

/**
 * Minimum consecutive wins for regression risk flag
 */
const REGRESSION_CONSECUTIVE_WINS = 5;

// ============================================================================
// EFFICIENCY INDEX CALCULATION
// ============================================================================

/**
 * Calculate Efficiency Index (EI) from match data
 *
 * Formula (normalized): EI = (Avg Points per Game) + ((Avg Goal Difference per Game) / 10)
 *
 * This metric combines:
 * - Points performance (winning consistency)
 * - Goal difference rate (dominance level, normalized by match count to avoid scale blow-up)
 *
 * @param matches - Array of processed matches
 * @returns Efficiency Index
 */
export function calculateEfficiencyIndex(matches: ProcessedMatch[]): number {
	if (matches.length === 0) return 1.0; // Default to mid-tier

	// Calculate total points
	let totalPoints = 0;
	let totalGoalsScored = 0;
	let totalGoalsConceded = 0;

	for (const match of matches) {
		totalPoints += calculateMatchPoints(match.result);
		totalGoalsScored += match.goalsScored;
		totalGoalsConceded += match.goalsConceded;
	}

	// Calculate components
	const avgPointsPerGame = totalPoints / matches.length;
	const goalDifference = totalGoalsScored - totalGoalsConceded;
	const avgGoalDiffPerGame = goalDifference / matches.length;
	const goalDiffComponent = avgGoalDiffPerGame / 10;

	// EI = Avg PPG + (Avg GD per game / 10)
	return avgPointsPerGame + goalDiffComponent;
}

/**
 * Calculate average points per game
 *
 * @param matches - Array of processed matches
 * @returns Average points per game
 */
export function calculateAvgPointsPerGame(matches: ProcessedMatch[]): number {
	if (matches.length === 0) return 1.0;

	const totalPoints = matches.reduce(
		(sum, m) => sum + calculateMatchPoints(m.result),
		0,
	);

	return totalPoints / matches.length;
}

/**
 * Calculate goal difference from matches
 *
 * @param matches - Array of processed matches
 * @returns Total goal difference
 */
export function calculateGoalDifference(matches: ProcessedMatch[]): number {
	return matches.reduce((sum, m) => sum + (m.goalsScored - m.goalsConceded), 0);
}

// ============================================================================
// TIER CATEGORIZATION
// ============================================================================

/**
 * Categorize team into tier (1-4) based on Efficiency Index
 *
 * Tier 1: EI >= 2.0 (Elite)
 * Tier 2: EI >= 1.5 (Top)
 * Tier 3: EI >= 1.0 (Mid)
 * Tier 4: EI < 1.0 (Lower)
 *
 * @param efficiencyIndex - The calculated EI
 * @param thresholds - Tier thresholds (optional)
 * @returns Team tier (1-4)
 */
export function categorizeTier(
	efficiencyIndex: number,
	thresholds: TierThresholds = DEFAULT_TIER_THRESHOLDS,
): TeamTier {
	if (efficiencyIndex >= thresholds.tier1) return 1;
	if (efficiencyIndex >= thresholds.tier2) return 2;
	if (efficiencyIndex >= thresholds.tier3) return 3;
	return 4;
}

/**
 * Calculate Mood tier from last 10 matches
 *
 * Uses same tier thresholds but only recent form
 *
 * @param matches - Last 10 matches (most recent first)
 * @param thresholds - Tier thresholds (optional)
 * @returns Mood tier (1-4)
 */
export function calculateMoodTier(
	matches: ProcessedMatch[],
	thresholds: TierThresholds = DEFAULT_TIER_THRESHOLDS,
): TeamTier {
	// Use only last MOOD_MATCHES matches
	const moodMatches = matches.slice(0, MOOD_MATCHES);

	if (moodMatches.length === 0) return 3; // Default to mid-tier

	const ei = calculateEfficiencyIndex(moodMatches);
	return categorizeTier(ei, thresholds);
}

// ============================================================================
// MIND LAYER CALCULATION
// ============================================================================

/**
 * Calculate Mind layer (Baseline Quality - 50 matches)
 *
 * @param matches - All available matches (most recent first)
 * @param thresholds - Tier thresholds (optional)
 * @returns MindLayer data
 */
export function calculateMindLayer(
	matches: ProcessedMatch[],
	thresholds: TierThresholds = DEFAULT_TIER_THRESHOLDS,
): MindLayer {
	// Use up to IDEAL_MIND_MATCHES matches
	const mindMatches = matches.slice(0, IDEAL_MIND_MATCHES);
	const matchCount = mindMatches.length;

	// Calculate EI
	const efficiencyIndex = calculateEfficiencyIndex(mindMatches);
	const tier = categorizeTier(efficiencyIndex, thresholds);

	// Additional stats
	const avgPointsPerGame = calculateAvgPointsPerGame(mindMatches);
	const goalDifference = calculateGoalDifference(mindMatches);

	// Data quality check
	const hasSufficientData = matchCount >= MIN_MIND_MATCHES;

	return {
		tier,
		efficiencyIndex,
		avgPointsPerGame,
		goalDifference,
		matchCount,
		hasSufficientData: hasSufficientData,
	};
}

// ============================================================================
// MOOD LAYER CALCULATION
// ============================================================================

/**
 * Calculate Mood layer (Recent Momentum - 10 matches)
 *
 * @param matches - All available matches (most recent first)
 * @param mind - The calculated Mind layer
 * @param seasonsInLeague - Number of seasons team has been in current league
 * @param thresholds - Tier thresholds (optional)
 * @returns MoodLayer data
 */
export function calculateMoodLayer(
	matches: ProcessedMatch[],
	mind: MindLayer,
	seasonsInLeague: number,
	thresholds: TierThresholds = DEFAULT_TIER_THRESHOLDS,
): MoodLayer {
	// Use last MOOD_MATCHES matches
	const moodMatches = matches.slice(0, MOOD_MATCHES);

	if (moodMatches.length === 0) {
		return {
			tier: mind.tier, // Default to Mind tier if no recent data
			mindMoodGap: 0,
			isSleepingGiant: false,
			isOverPerformer: false,
			isOneSeasonWonder: false,
			formString: "",
			last10Points: 0,
			last10GoalsScored: 0,
			last10GoalsConceded: 0,
		};
	}

	// Calculate Mood tier
	const moodTier = calculateMoodTier(moodMatches, thresholds);

	// Calculate Mind/Mood gap (positive = better mood than baseline)
	const mindMoodGap = mind.tier - moodTier;

	// Detect patterns
	const { isSleepingGiant, isOverPerformer, isOneSeasonWonder } =
		detectMoodVsMindGap(mind.tier, moodTier, seasonsInLeague);

	// Calculate form stats
	const results: MatchResult[] = moodMatches.map((m) => m.result);
	const formString = generateFormString(results, 5);

	const last10Points = moodMatches.reduce(
		(sum, m) => sum + calculateMatchPoints(m.result),
		0,
	);

	const last10GoalsScored = moodMatches.reduce(
		(sum, m) => sum + m.goalsScored,
		0,
	);

	const last10GoalsConceded = moodMatches.reduce(
		(sum, m) => sum + m.goalsConceded,
		0,
	);

	return {
		tier: moodTier,
		mindMoodGap,
		isSleepingGiant,
		isOverPerformer,
		isOneSeasonWonder,
		formString,
		last10Points,
		last10GoalsScored,
		last10GoalsConceded,
	};
}

// ============================================================================
// MIND VS MOOD GAP DETECTION
// ============================================================================

/**
 * Detect Mind vs Mood gap patterns
 *
 * Sleeping Giant: Mind Tier 1, Mood Tier 4
 * - High-value bet - class remains despite bad form
 * - Algorithm adds +10% probability
 *
 * Over-performer: Mind Tier 4, Mood Tier 1
 * - Regression risk - team is "due" for a loss
 * - Algorithm reduces probability by 8%
 *
 * One-Season Wonder: Recently promoted team overperforming
 * - Reduces confidence instead of adding probability
 *
 * @param mindTier - Team's Mind tier (baseline quality)
 * @param moodTier - Team's Mood tier (recent momentum)
 * @param seasonsInLeague - Number of seasons in current league
 * @returns Detection results
 */
export function detectMoodVsMindGap(
	mindTier: TeamTier,
	moodTier: TeamTier,
	seasonsInLeague: number,
): {
	isSleepingGiant: boolean;
	isOverPerformer: boolean;
	isOneSeasonWonder: boolean;
} {
	// Sleeping Giant: Mind Tier 1, Mood Tier 3-4
	// Elite team in bad form = value opportunity
	const isSleepingGiant = mindTier === 1 && moodTier >= 3;

	// Over-performer: Mind Tier 3-4, Mood Tier 1
	// Lower tier team in great form = regression risk
	const isOverPerformer = mindTier >= 3 && moodTier === 1;

	// One-Season Wonder: Recently promoted (<=2 seasons) AND overperforming
	// These teams often regress after initial success
	const isOneSeasonWonder = detectOneSeasonWonder(
		mindTier,
		moodTier,
		seasonsInLeague,
	);

	return {
		isSleepingGiant,
		isOverPerformer,
		isOneSeasonWonder,
	};
}

/**
 * Detect One-Season Wonder pattern
 *
 * A one-season wonder is:
 * - Recently promoted team (<=2 seasons in current league)
 * - Overperforming (Mind Tier 3-4, Mood Tier 1-2)
 *
 * These teams often regress after initial success because:
 * - Squad depth issues
 * - Opponent adaptation
 * - Manager limitations
 * - Financial constraints
 *
 * @param mindTier - Team's Mind tier
 * @param moodTier - Team's Mood tier
 * @param seasonsInLeague - Seasons in current league
 * @returns true if one-season wonder pattern detected
 */
export function detectOneSeasonWonder(
	mindTier: TeamTier,
	moodTier: TeamTier,
	seasonsInLeague: number,
): boolean {
	// Must be recently in the league (promoted within last 2 seasons)
	if (seasonsInLeague > 2) return false;

	// Must be lower baseline tier (Mind 3-4)
	if (mindTier <= 2) return false;

	// Must be in good current form (Mood 1-2)
	if (moodTier > 2) return false;

	return true;
}

/**
 * Get number of seasons team has been in current league
 *
 * This should be populated from historical data or API
 * For now, provides a helper to estimate from match data
 *
 * @param allMatches - All available matches for the team
 * @param currentLeagueId - Current league ID
 * @returns Number of seasons (1 if newly promoted)
 */
export function getSeasonsInCurrentLeague(
	allMatches: ProcessedMatch[],
	currentLeagueId: number,
): number {
	if (allMatches.length === 0) return 1;

	// Find unique seasons where team played in current league
	const seasonsInLeague = new Set<number>();

	for (const match of allMatches) {
		if (match.league.id === currentLeagueId) {
			seasonsInLeague.add(match.season);
		}
	}

	return Math.max(1, seasonsInLeague.size);
}

// ============================================================================
// REGRESSION RISK DETECTION
// ============================================================================

/**
 * Count consecutive wins from most recent matches
 *
 * @param matches - Matches sorted most recent first
 * @returns Number of consecutive wins
 */
export function countConsecutiveWins(matches: ProcessedMatch[]): number {
	let count = 0;
	for (const match of matches) {
		if (match.result === "W") {
			count++;
		} else {
			break;
		}
	}
	return count;
}

/**
 * Detect regression risk
 *
 * A team has regression risk if:
 * - They are not an elite team (Mind Tier 3-4)
 * - They have won 5+ in a row
 *
 * Action: Reduce Confidence by 15%
 *
 * @param mindTier - Team's Mind tier
 * @param consecutiveWins - Number of consecutive wins
 * @returns true if regression risk detected
 */
export function detectRegressionRisk(
	mindTier: TeamTier,
	consecutiveWins: number,
): boolean {
	// Only applies to non-elite teams
	if (mindTier <= 2) return false;

	// Check for hot streak
	return consecutiveWins >= REGRESSION_CONSECUTIVE_WINS;
}

// ============================================================================
// DATA QUALITY HELPERS
// ============================================================================

/**
 * Assess Mind data quality based on match count
 *
 * @param matchCount - Number of matches used for Mind calculation
 * @returns Quality level
 */
export function assessMindDataQuality(
	mindOrMatchCount: MindLayer | number,
): "HIGH" | "MEDIUM" | "LOW" {
	const matchCount =
		typeof mindOrMatchCount === "number"
			? mindOrMatchCount
			: mindOrMatchCount.matchCount;

	if (matchCount >= IDEAL_MIND_MATCHES) return "HIGH";
	if (matchCount >= MIN_MIND_MATCHES) return "MEDIUM";
	return "LOW";
}

/**
 * Calculate confidence multiplier based on data quality
 *
 * @param mindMatchCount - Matches used for Mind
 * @param moodMatchCount - Matches used for Mood
 * @returns Multiplier (0.5 - 1.0)
 */
export function calculateDataQualityMultiplier(
	mindMatchCount: number,
	moodMatchCount: number,
): number {
	let multiplier = 1.0;

	// Reduce if insufficient Mind data
	if (mindMatchCount < MIN_MIND_MATCHES) {
		multiplier *= 0.7 + (0.3 * mindMatchCount) / MIN_MIND_MATCHES;
	}

	// Reduce if insufficient Mood data
	if (moodMatchCount < MOOD_MATCHES) {
		multiplier *= 0.8 + (0.2 * moodMatchCount) / MOOD_MATCHES;
	}

	return Math.max(0.5, multiplier);
}

// ============================================================================
// TIER UTILITIES
// ============================================================================

/**
 * Get tier description for display
 *
 * @param tier - Team tier
 * @returns Human-readable description
 */
export function getTierDescription(tier: TeamTier): string {
	switch (tier) {
		case 1:
			return "Elite";
		case 2:
			return "Top Tier";
		case 3:
			return "Mid Tier";
		case 4:
			return "Lower Tier";
		default:
			return "Unknown";
	}
}

/**
 * Calculate tier gap between two teams
 *
 * @param homeTier - Home team tier
 * @param awayTier - Away team tier
 * @returns Gap (positive = home team better, negative = away team better)
 */
export function calculateTierGap(
	homeTier: TeamTier,
	awayTier: TeamTier,
): number {
	// Lower tier number = better team
	// So gap = away - home (positive if home is better)
	return awayTier - homeTier;
}

/**
 * Check if there's a significant tier gap
 *
 * @param homeTier - Home team tier
 * @param awayTier - Away team tier
 * @param threshold - Gap threshold (default: 2)
 * @returns true if significant gap exists
 */
export function hasSignificantTierGap(
	homeTier: TeamTier,
	awayTier: TeamTier,
	threshold: number = 2,
): boolean {
	return Math.abs(calculateTierGap(homeTier, awayTier)) >= threshold;
}

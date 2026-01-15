/**
 * Match Context Adjustments
 *
 * Combines all match context factors to produce unified adjustments
 * for simulations: match type, derby, end-of-season, etc.
 *
 * Reference: docs/implementation-plan/phase3.5.md
 * Algorithm: docs/betting-insights-Algorithm.md - Context Adjustments section
 */

import {
  type DerbyInfo,
  detectDerby,
  getDerbyWeightAdjustments,
} from "./derby-detector";
import {
  detectEndOfSeason,
  getEndOfSeasonAdjustments,
  type EndOfSeasonContext,
  type SeasonStakes,
} from "./end-of-season-detector";
import {
  detectMatchType,
  getMatchTypeConfidenceReduction,
  getWeightAdjustments,
  type MatchType,
} from "./match-type-detector";
import type { Adjustment, TeamData } from "../types";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Complete match context
 */
export interface MatchContext {
	// Match type info
	matchType: MatchType;

	// Derby info
	derby: DerbyInfo;

	// Season context
	isEarlySeason: boolean;
	isEndOfSeason: boolean;
	roundNumber?: number;
	totalRounds?: number;

	// End-of-season stakes (detailed analysis)
	endOfSeasonContext?: EndOfSeasonContext;
	homeStakes?: SeasonStakes;
	awayStakes?: SeasonStakes;
	isSixPointer?: boolean;

	// Post-break context
	isPostInternationalBreak: boolean;
	daysSinceLastMatch?: number;

	// Team context
	homeTeamPosition?: number;
	awayTeamPosition?: number;

	// Combined adjustments
	adjustments: CombinedAdjustments;

	// End-of-season specific adjustments
	endOfSeasonAdjustments?: Adjustment[];
}

/**
 * Combined weight adjustments from all context factors
 */
export interface CombinedAdjustments {
	// Weight multipliers
	recentForm: number;
	h2h: number;
	homeAdvantage: number;
	motivation: number;
	goalScoring: number;

	// Confidence impact
	confidenceReduction: number;

	// Probability adjustments
	goalExpectationAdjustment: number; // -10 to +10 percentage points
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * End of season detection thresholds
 */
const END_OF_SEASON_ROUNDS = 5; // Last 5 rounds
const END_OF_SEASON_THRESHOLD = 0.85; // 85% of season completed

/**
 * Early season detection thresholds
 */
const EARLY_SEASON_ROUNDS = 5; // First 5 rounds
const EARLY_SEASON_THRESHOLD = 0.15; // Less than 15% of season

/**
 * Post-international break thresholds
 */
const POST_BREAK_DAYS = 14; // Within 14 days of a break

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Build complete match context from available data
 *
 * @param leagueName - Name of the league/competition
 * @param round - Round name or number
 * @param homeTeamId - Home team ID
 * @param awayTeamId - Away team ID
 * @param homeTeamName - Home team name (optional)
 * @param awayTeamName - Away team name (optional)
 * @param options - Additional context options
 * @returns Complete match context with adjustments
 */
export function buildMatchContext(
	leagueName: string,
	round: string | number | undefined,
	homeTeamId: number,
	awayTeamId: number,
	homeTeamName?: string,
	awayTeamName?: string,
	options?: {
		roundNumber?: number;
		totalRounds?: number;
		daysSinceLastMatch?: number;
		isInternationalBreak?: boolean;
		homeTeamPosition?: number;
		awayTeamPosition?: number;
		venue?: string;
		homeTeamData?: TeamData;
		awayTeamData?: TeamData;
		leagueSize?: number;
	},
): MatchContext {
	// Detect match type
	const matchType = detectMatchType(leagueName, round);

	// Detect derby
	const derby = detectDerby(homeTeamId, awayTeamId, homeTeamName, awayTeamName);

	// Update match type with derby info
	matchType.isDerby = derby.isDerby;

	// Detect season position
	const { isEarlySeason, isEndOfSeason } = detectSeasonPosition(
		options?.roundNumber,
		options?.totalRounds,
	);

	// Update match type
	matchType.isEndOfSeason = isEndOfSeason;

	// Detect post-international break
	const isPostInternationalBreak = detectPostInternationalBreak(
		options?.daysSinceLastMatch,
		options?.isInternationalBreak,
	);

	// Update match type
	matchType.isPostInternationalBreak = isPostInternationalBreak;

	// Detect detailed end-of-season context if team data is available
	let endOfSeasonContext: EndOfSeasonContext | undefined;
	let endOfSeasonAdjustments: Adjustment[] | undefined;

	// IMPORTANT: End-of-season stakes only make sense for league competitions.
	// For CUP/INTERNATIONAL/FRIENDLY matches, league table position does not
	// represent the actual stakes of the match.
	if (
		matchType.type === "LEAGUE" &&
		options?.homeTeamData &&
		options?.awayTeamData
	) {
		endOfSeasonContext = detectEndOfSeason(
			options.homeTeamData,
			options.awayTeamData,
			options.roundNumber,
			options.totalRounds,
			options.leagueSize,
		);

		if (endOfSeasonContext.isEndOfSeason) {
			endOfSeasonAdjustments = getEndOfSeasonAdjustments(endOfSeasonContext);
		}
	}

	// Calculate combined adjustments
	const adjustments = calculateCombinedAdjustments(
		matchType,
		derby,
		isEarlySeason,
		isEndOfSeason,
		isPostInternationalBreak,
		options?.homeTeamPosition,
		options?.awayTeamPosition,
		endOfSeasonContext,
	);

	return {
		matchType,
		derby,
		isEarlySeason,
		isEndOfSeason,
		roundNumber: options?.roundNumber,
		totalRounds: options?.totalRounds,
		endOfSeasonContext,
		homeStakes: endOfSeasonContext?.homeStakes,
		awayStakes: endOfSeasonContext?.awayStakes,
		isSixPointer: endOfSeasonContext?.isSixPointer,
		isPostInternationalBreak,
		daysSinceLastMatch: options?.daysSinceLastMatch,
		homeTeamPosition: options?.homeTeamPosition,
		awayTeamPosition: options?.awayTeamPosition,
		adjustments,
		endOfSeasonAdjustments,
	};
}

// ============================================================================
// SEASON POSITION DETECTION
// ============================================================================

/**
 * Detect if match is in early season or end of season
 */
function detectSeasonPosition(
	roundNumber?: number,
	totalRounds?: number,
): { isEarlySeason: boolean; isEndOfSeason: boolean } {
	if (!roundNumber || !totalRounds || totalRounds === 0) {
		return { isEarlySeason: false, isEndOfSeason: false };
	}

	const progress = roundNumber / totalRounds;

	// Early season: first 5 rounds or less than 15% through
	const isEarlySeason =
		roundNumber <= EARLY_SEASON_ROUNDS || progress < EARLY_SEASON_THRESHOLD;

	// End of season: last 5 rounds or more than 85% through
	const isEndOfSeason =
		totalRounds - roundNumber < END_OF_SEASON_ROUNDS ||
		progress > END_OF_SEASON_THRESHOLD;

	return { isEarlySeason, isEndOfSeason };
}

/**
 * Detect if match is shortly after international break
 */
function detectPostInternationalBreak(
	daysSinceLastMatch?: number,
	isInternationalBreak?: boolean,
): boolean {
	// Explicit flag
	if (isInternationalBreak) {
		return true;
	}

	// Heuristic: long gap suggests international break
	if (daysSinceLastMatch && daysSinceLastMatch > POST_BREAK_DAYS) {
		return true;
	}

	return false;
}

// ============================================================================
// COMBINED ADJUSTMENTS
// ============================================================================

/**
 * Calculate combined adjustments from all context factors
 */
function calculateCombinedAdjustments(
	matchType: MatchType,
	derby: DerbyInfo,
	isEarlySeason: boolean,
	isEndOfSeason: boolean,
	isPostInternationalBreak: boolean,
	homeTeamPosition?: number,
	awayTeamPosition?: number,
	endOfSeasonContext?: EndOfSeasonContext,
): CombinedAdjustments {
	// Get base adjustments from match type
	const typeAdjustments = getWeightAdjustments(matchType);

	// Get derby adjustments
	const derbyAdjustments = getDerbyWeightAdjustments(derby);

	// Start with type adjustments
	const combined: CombinedAdjustments = {
		recentForm:
			typeAdjustments.recentForm * derbyAdjustments.formReliabilityMultiplier,
		h2h: typeAdjustments.h2h,
		homeAdvantage: typeAdjustments.homeAdvantage,
		motivation:
			typeAdjustments.motivation * derbyAdjustments.motivationMultiplier,
		goalScoring:
			typeAdjustments.goalScoring * derbyAdjustments.goalScoringMultiplier,
		confidenceReduction:
			getMatchTypeConfidenceReduction(matchType) +
			derbyAdjustments.confidenceReduction,
		goalExpectationAdjustment: 0,
	};

	// Apply early season adjustments
	if (isEarlySeason) {
		combined.recentForm *= 0.8; // Less reliable form data
		combined.h2h *= 1.15; // Historical data more reliable
		combined.confidenceReduction += 5; // Higher uncertainty
	}

	// Apply end-of-season adjustments
	if (isEndOfSeason) {
		if (endOfSeasonContext) {
			// Use detailed end-of-season context for more accurate adjustments
			const motivationGapFactor = Math.abs(endOfSeasonContext.motivationGap) / 100;
			combined.motivation *= 1 + motivationGapFactor * 0.3;

			// Six-pointer matches are more unpredictable
			if (endOfSeasonContext.isSixPointer) {
				combined.confidenceReduction += 5;
			}

			// Apply goal expectation adjustment from end-of-season context
			combined.goalExpectationAdjustment += endOfSeasonContext.adjustments.goalsAdjustment;
		} else {
			// Fallback to simple position-based motivation
			const motivationBoost = calculateEndOfSeasonMotivation(
				homeTeamPosition,
				awayTeamPosition,
			);
			combined.motivation *= 1 + motivationBoost;
		}
	}

	// Apply post-international break adjustments
	if (isPostInternationalBreak) {
		combined.recentForm *= 0.85; // Players may be tired/absent
		combined.confidenceReduction += 3;
	}

	// Calculate goal expectation adjustment
	combined.goalExpectationAdjustment = calculateGoalExpectationAdjustment(
		matchType,
		derby,
		isEndOfSeason,
		endOfSeasonContext,
	);

	return combined;
}

/**
 * Calculate end-of-season motivation boost
 */
function calculateEndOfSeasonMotivation(
	homePosition?: number,
	awayPosition?: number,
): number {
	if (!homePosition && !awayPosition) {
		return 0;
	}

	let boost = 0;

	// Teams in top positions (title race, top 4)
	if (homePosition && homePosition <= 4) boost += 0.1;
	if (awayPosition && awayPosition <= 4) boost += 0.1;

	// Teams in relegation zone (assuming 20 team league)
	if (homePosition && homePosition >= 18) boost += 0.15;
	if (awayPosition && awayPosition >= 18) boost += 0.15;

	// Teams mid-table with nothing to play for
	if (homePosition && homePosition > 8 && homePosition < 15) boost -= 0.05;
	if (awayPosition && awayPosition > 8 && awayPosition < 15) boost -= 0.05;

	return Math.min(0.3, Math.max(-0.1, boost));
}

/**
 * Calculate goal expectation adjustment
 *
 * @returns Adjustment in percentage points (-10 to +10)
 */
function calculateGoalExpectationAdjustment(
	matchType: MatchType,
	derby: DerbyInfo,
	isEndOfSeason: boolean,
	endOfSeasonContext?: EndOfSeasonContext,
): number {
	let adjustment = 0;

	// Match type adjustments
	switch (matchType.type) {
		case "FRIENDLY":
			adjustment += 5; // More goals in friendlies
			break;
		case "CUP":
			if (matchType.isKnockout) {
				adjustment -= 3; // Fewer goals in knockouts
			}
			break;
		case "INTERNATIONAL":
			adjustment -= 2; // Slightly fewer goals
			break;
	}

	// Derby adjustment
	if (derby.isDerby) {
		switch (derby.intensity) {
			case "EXTREME":
				adjustment -= 3; // High-stakes, cagey matches
				break;
			case "HIGH":
				adjustment -= 2;
				break;
			case "MEDIUM":
				adjustment -= 1;
				break;
		}
	}

	// End of season: can go either way
	// Teams fighting = fewer goals (cagey)
	// Teams with nothing to play for = more open
	if (isEndOfSeason) {
		if (endOfSeasonContext) {
			// Use detailed adjustments from end-of-season detector
			adjustment += endOfSeasonContext.adjustments.goalsAdjustment;
		} else {
			// Net effect is small without detailed context
			adjustment += 1;
		}
	}

	// Finals are typically low-scoring
	if (matchType.stageName === "Final") {
		adjustment -= 5;
	}

	return Math.min(10, Math.max(-10, adjustment));
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get a human-readable description of match context
 */
export function describeMatchContext(context: MatchContext): string[] {
	const descriptions: string[] = [];

	// Match type
	if (context.matchType.type !== "LEAGUE") {
		descriptions.push(`${context.matchType.type} match`);
	}

	if (context.matchType.isKnockout) {
		descriptions.push(
			`Knockout stage${context.matchType.stageName ? `: ${context.matchType.stageName}` : ""}`,
		);
	}

	// Derby
	if (context.derby.isDerby) {
		descriptions.push(
			context.derby.derbyName || `${context.derby.derbyType} derby`,
		);
	}

	// Season position
	if (context.isEarlySeason) {
		descriptions.push("Early season");
	}
	if (context.isEndOfSeason) {
		if (context.endOfSeasonContext) {
			descriptions.push(context.endOfSeasonContext.summary);
		} else {
			descriptions.push("End of season");
		}
	}

	// Six-pointer
	if (context.isSixPointer) {
		descriptions.push("Six-pointer match");
	}

	// Post-break
	if (context.isPostInternationalBreak) {
		descriptions.push("Post-international break");
	}

	// Neutral venue
	if (context.matchType.isNeutralVenue) {
		descriptions.push("Neutral venue");
	}

	return descriptions;
}

/**
 * Check if context suggests high variance (unpredictable)
 */
export function isHighVarianceContext(context: MatchContext): boolean {
	return (
		context.adjustments.confidenceReduction >= 10 ||
		context.matchType.type === "FRIENDLY" ||
		context.derby.intensity === "EXTREME" ||
		context.isPostInternationalBreak
	);
}

/**
 * Get suggested maximum confidence for context
 */
export function getMaxConfidenceForContext(
	context: MatchContext,
): "HIGH" | "MEDIUM" | "LOW" {
	if (context.matchType.type === "FRIENDLY") {
		return "LOW";
	}

	if (context.adjustments.confidenceReduction >= 15) {
		return "LOW";
	}

	if (context.adjustments.confidenceReduction >= 8) {
		return "MEDIUM";
	}

	return "HIGH";
}

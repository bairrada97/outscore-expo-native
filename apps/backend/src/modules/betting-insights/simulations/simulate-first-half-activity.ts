/**
 * First Half Prediction
 *
 * Predicts probability of goals in the first half.
 *
 * Factors:
 * - First Half Scoring Rate (40%): Team's first half goal frequency
 * - Recent Form (25%): General recent performance
 * - H2H First Half (20%): Historical first half patterns
 * - Home Advantage (15%): Home teams start faster
 * - Motivation (10%): High-stakes games often cautious
 *
 * Reference: docs/implementation-plan/phase4.md - Section 4.4
 * Algorithm: docs/betting-insights-Algorithm.md - First Half Prediction section
 */

import { DEFAULT_ALGORITHM_CONFIG } from "../config/algorithm-config";
import type { MatchContext } from "../match-context/context-adjustments";
import { finalizeSimulation } from "../presentation/simulation-presenter";
import type {
  Adjustment,
  AlgorithmConfig,
  ConfidenceLevel,
  H2HData,
  Simulation,
  TeamData,
} from "../types";
import {
  applyCappedAsymmetricAdjustments,
  createAdjustment,
} from "../utils/capped-adjustments";
import { clamp } from "../utils/helpers";

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Base First Half goal probability
 */
const BASE_FIRST_HALF_PROBABILITY = 50;

/**
 * Weight configuration
 */
// NOTE: weights are currently applied implicitly via adjustment magnitudes.
// Keep the declared weights in the docs/config until we refactor to use them directly.

/**
 * Thresholds
 */
const THRESHOLDS = {
	highFirstHalfRate: 70, // Teams scoring FH in >70% of matches
	lowFirstHalfRate: 40, // Teams scoring FH in <40% of matches
	slowStarterThreshold: 30, // <30% = slow starter
} as const;

// ============================================================================
// MAIN PREDICTION FUNCTION
// ============================================================================

/**
 * Predict First Half goal probability
 *
 * @param homeTeam - Home team data
 * @param awayTeam - Away team data
 * @param h2h - Head-to-head data
 * @param context - Match context
 * @param config - Algorithm configuration
 * @returns Market prediction for First Half goals
 */
export function simulateFirstHalfActivity(
	homeTeam: TeamData,
	awayTeam: TeamData,
	h2h?: H2HData,
	context?: MatchContext,
	config: AlgorithmConfig = DEFAULT_ALGORITHM_CONFIG,
): Simulation {
	// Step 1: Calculate base probability
	const baseProbability = calculateBaseFirstHalfProbability(
		homeTeam,
		awayTeam,
		h2h,
	);

	// Step 2: Collect adjustments
	const adjustments: Adjustment[] = [];

	// Add first half scoring adjustments
	adjustments.push(...getFirstHalfScoringAdjustments(homeTeam, awayTeam));

	// Add slow starter detection
	adjustments.push(...getSlowStarterAdjustments(homeTeam, awayTeam));

	// Add recent form adjustments
	adjustments.push(...getRecentFormAdjustments(homeTeam, awayTeam));

	// Add H2H adjustments
	if (h2h?.hasSufficientData) {
		adjustments.push(...getH2HAdjustments(h2h));
	}

	// Add home advantage adjustments
	adjustments.push(...getHomeAdvantageAdjustments(homeTeam));

	// Add context adjustments
	if (context) {
		adjustments.push(...getContextAdjustments(context));
	}

	// Add formation adjustments (20% less impact = 0.8 multiplier)
	adjustments.push(...getFormationAdjustments(homeTeam, awayTeam, 0.8));

	// Step 3: Apply capped adjustments
	const result = applyCappedAsymmetricAdjustments(
		baseProbability,
		adjustments,
		"FirstHalfActivity",
		config,
		calculateBaseConfidence(homeTeam, awayTeam),
	);

	// Step 4: Build response
	return buildFirstHalfPrediction(result);
}

// ============================================================================
// BASE PROBABILITY
// ============================================================================

/**
 * Calculate base First Half probability
 */
function calculateBaseFirstHalfProbability(
	homeTeam: TeamData,
	awayTeam: TeamData,
	h2h?: H2HData,
): number {
	let probability = BASE_FIRST_HALF_PROBABILITY;

	// Factor 1: First half scoring rates
	// We don't currently store a direct "% of matches with 1H goal" stat.
	// Use DNA's `firstHalfGoalPercentage` (share of goals in 1H) as a proxy signal.
	const homeFirstHalfRate = homeTeam.dna?.firstHalfGoalPercentage ?? 55;
	const awayFirstHalfRate = awayTeam.dna?.firstHalfGoalPercentage ?? 50;

	// Combined probability of at least one team scoring in first half
	// P(at least one) = 1 - P(neither)
	const homeNotScoring = 1 - homeFirstHalfRate / 100;
	const awayNotScoring = 1 - awayFirstHalfRate / 100;
	const combinedFirstHalfProb = (1 - homeNotScoring * awayNotScoring) * 100;

	// Blend with base
	probability = probability * 0.4 + combinedFirstHalfProb * 0.6;

	// Factor 2: H2H first half patterns (if available)
	if (h2h?.hasSufficientData) {
		// Estimate first half goal rate from total goals
		// Typically ~40-45% of goals are scored in first half
		const h2hFirstHalfEstimate = Math.min(100, h2h.avgGoals * 18);
		probability = probability * 0.8 + h2hFirstHalfEstimate * 0.2;
	}

	return clamp(probability, 30, 80);
}

// ============================================================================
// ADJUSTMENT FUNCTIONS
// ============================================================================

/**
 * Get first half scoring adjustments
 */
function getFirstHalfScoringAdjustments(
	homeTeam: TeamData,
	awayTeam: TeamData,
): Adjustment[] {
	const adjustments: Adjustment[] = [];

	const homeRate = homeTeam.dna?.firstHalfGoalPercentage ?? 55;
	const awayRate = awayTeam.dna?.firstHalfGoalPercentage ?? 50;

	// High first half scoring rate
	if (homeRate > THRESHOLDS.highFirstHalfRate) {
		adjustments.push(
			createAdjustment(
				"home_first_half_rate",
				5,
				`Home team scores in 1st half in ${homeRate.toFixed(0)}% of matches`,
			),
		);
	}

	if (awayRate > THRESHOLDS.highFirstHalfRate) {
		adjustments.push(
			createAdjustment(
				"away_first_half_rate",
				5,
				`Away team scores in 1st half in ${awayRate.toFixed(0)}% of matches`,
			),
		);
	}

	// Low first half scoring rate
	if (homeRate < THRESHOLDS.lowFirstHalfRate) {
		adjustments.push(
			createAdjustment(
				"home_first_half_rate",
				-4,
				`Home team scores in 1st half in only ${homeRate.toFixed(0)}% of matches`,
			),
		);
	}

	if (awayRate < THRESHOLDS.lowFirstHalfRate) {
		adjustments.push(
			createAdjustment(
				"away_first_half_rate",
				-4,
				`Away team scores in 1st half in only ${awayRate.toFixed(0)}% of matches`,
			),
		);
	}

	return adjustments;
}

/**
 * Get slow starter adjustments
 */
function getSlowStarterAdjustments(
	homeTeam: TeamData,
	awayTeam: TeamData,
): Adjustment[] {
	const adjustments: Adjustment[] = [];

	const homeRate = homeTeam.dna?.firstHalfGoalPercentage ?? 55;
	const awayRate = awayTeam.dna?.firstHalfGoalPercentage ?? 50;

	// Both teams are slow starters
	if (
		homeRate < THRESHOLDS.slowStarterThreshold &&
		awayRate < THRESHOLDS.slowStarterThreshold
	) {
		adjustments.push(
			createAdjustment(
				"both_slow_starters",
				-8,
				"Both teams are slow starters - first half goals unlikely",
			),
		);
	}

	// Check for late starters pattern
	if (homeTeam.dna?.isLateStarter) {
		adjustments.push(
			createAdjustment(
				"home_late_starter",
				-3,
				"Home team typically scores late in games",
			),
		);
	}

	if (awayTeam.dna?.isLateStarter) {
		adjustments.push(
			createAdjustment(
				"away_late_starter",
				-3,
				"Away team typically scores late in games",
			),
		);
	}

	return adjustments;
}

/**
 * Get recent form adjustments
 */
function getRecentFormAdjustments(
	homeTeam: TeamData,
	awayTeam: TeamData,
): Adjustment[] {
	const adjustments: Adjustment[] = [];

	// Use mood tier as form indicator
	const homeTier = homeTeam.mood?.tier ?? 3;
	const awayTier = awayTeam.mood?.tier ?? 3;

	// Teams in good form (tier 1-2) tend to start games confidently
	if (homeTier <= 2) {
		adjustments.push(
			createAdjustment(
				"home_good_form",
				2,
				"Home team in good form - likely to start confidently",
			),
		);
	}

	if (awayTier <= 2) {
		adjustments.push(
			createAdjustment(
				"away_good_form",
				2,
				"Away team in good form - likely to start confidently",
			),
		);
	}

	// Teams in poor form may be cautious early
	if (homeTier === 4) {
		adjustments.push(
			createAdjustment(
				"home_poor_form",
				-2,
				"Home team in poor form - may start cautiously",
			),
		);
	}

	if (awayTier === 4) {
		adjustments.push(
			createAdjustment(
				"away_poor_form",
				-2,
				"Away team in poor form - may start cautiously",
			),
		);
	}

	return adjustments;
}

/**
 * Get H2H adjustments
 */
function getH2HAdjustments(h2h: H2HData): Adjustment[] {
	const adjustments: Adjustment[] = [];

	// High-scoring H2H suggests more first half goals
	if (h2h.avgGoals > 3.5) {
		adjustments.push(
			createAdjustment(
				"h2h_high_scoring",
				4,
				`H2H matches average ${h2h.avgGoals.toFixed(1)} goals - early goals likely`,
			),
		);
	}

	// Low-scoring H2H
	if (h2h.avgGoals < 2.0) {
		adjustments.push(
			createAdjustment(
				"h2h_low_scoring",
				-4,
				`H2H matches average only ${h2h.avgGoals.toFixed(1)} goals`,
			),
		);
	}

	return adjustments;
}

/**
 * Get home advantage adjustments
 */
function getHomeAdvantageAdjustments(homeTeam: TeamData): Adjustment[] {
	const adjustments: Adjustment[] = [];

	// We don't currently have `homeWinRate` stored in TeamData.
	// Keep this adjustment conservative until we compute a proper home-adv metric.
	const homeMoodTier = homeTeam.mood?.tier ?? 3;
	if (homeMoodTier <= 2) {
		adjustments.push(
			createAdjustment(
				"home_advantage_proxy",
				1,
				"Home side in good form - may start on front foot",
			),
		);
	}

	return adjustments;
}

/**
 * Get context adjustments
 */
function getContextAdjustments(context: MatchContext): Adjustment[] {
	const adjustments: Adjustment[] = [];

	// High-stakes matches often start cagey
	if (context.matchType.importance === "CRITICAL") {
		adjustments.push(
			createAdjustment(
				"critical_match",
				-5,
				"Critical match - likely cautious start",
			),
		);
	}

	if (context.matchType.importance === "HIGH") {
		adjustments.push(
			createAdjustment(
				"high_stakes",
				-3,
				"High-stakes match - may start cautiously",
			),
		);
	}

	// Knockout stages
	if (context.matchType.isKnockout) {
		adjustments.push(
			createAdjustment(
				"knockout_stage",
				-4,
				"Knockout match - typically tactical opening",
			),
		);
	}

	// Derbies can be explosive or cagey
	if (context.derby.isDerby && context.derby.intensity === "EXTREME") {
		// High-intensity derbies often have cagey starts
		adjustments.push(
			createAdjustment(
				"derby_caution",
				-2,
				"High-intensity derby - could be cagey opening",
			),
		);
	}

	return adjustments;
}

/**
 * Get formation adjustments (20% less impact = 0.8 multiplier)
 */
function getFormationAdjustments(
	homeTeam: TeamData,
	awayTeam: TeamData,
	impactMultiplier: number,
): Adjustment[] {
	const adjustments: Adjustment[] = [];

	// NOTE: No dedicated match-level formation context is wired in yet.
	// Use a lightweight proxy based on formation usage %.
	const homeUsage =
		homeTeam.dna?.formationFrequency?.[homeTeam.dna?.mostPlayedFormation] ??
		100;
	const awayUsage =
		awayTeam.dna?.formationFrequency?.[awayTeam.dna?.mostPlayedFormation] ??
		100;

	const homeReduction =
		homeUsage < 40 ? clamp((40 - homeUsage) * 0.8, 0, 25) : 0;
	const awayReduction =
		awayUsage < 40 ? clamp((40 - awayUsage) * 0.8, 0, 25) : 0;

	if (homeReduction > 10) {
		adjustments.push(
			createAdjustment(
				"formation_home",
				-homeReduction * impactMultiplier * 0.2,
				"Home team formation instability",
			),
		);
	}

	if (awayReduction > 10) {
		adjustments.push(
			createAdjustment(
				"formation_away",
				-awayReduction * impactMultiplier * 0.2,
				"Away team formation instability",
			),
		);
	}

	return adjustments;
}

// ============================================================================
// CONFIDENCE & RESPONSE
// ============================================================================

/**
 * Calculate base confidence
 */
function calculateBaseConfidence(
	homeTeam: TeamData,
	awayTeam: TeamData,
): ConfidenceLevel {
	let confidence: ConfidenceLevel = "MEDIUM";

	// First half data is often less comprehensive
	const homeData = homeTeam.mind?.matchCount ?? 0;
	const awayData = awayTeam.mind?.matchCount ?? 0;

	if (homeData >= 30 && awayData >= 30) {
		confidence = "MEDIUM"; // Cap at MEDIUM for first half (less data)
	} else if (homeData < 10 || awayData < 10) {
		confidence = "LOW";
	}

	return confidence;
}

/**
 * Build First Half prediction response
 */
function buildFirstHalfPrediction(
	result: ReturnType<typeof applyCappedAsymmetricAdjustments>,
): Simulation {
	const goalsProbability = result.finalProbability;
	const noGoalsProbability = 100 - goalsProbability;

	return finalizeSimulation({
		scenarioType: "FirstHalfActivity",
		probabilityDistribution: {
			yes: Math.round(goalsProbability * 10) / 10,
			no: Math.round(noGoalsProbability * 10) / 10,
		},
		modelReliability: result.confidenceLevel,
		insights: [],
		adjustmentsApplied: result.cappedAdjustments,
		totalAdjustment: result.totalAdjustment,
		capsHit: result.wasCapped,
		overcorrectionWarning: result.overcorrectionWarning,
	});
}
// Note: `signalStrength` and `mostProbableOutcome` are added via `finalizeSimulation`.

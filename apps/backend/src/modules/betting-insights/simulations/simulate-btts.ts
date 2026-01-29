/**
 * BTTS (Both Teams To Score) Prediction
 *
 * Predicts probability of both teams scoring in a match.
 *
 * Factors (from algorithm document):
 * - Scoring Rate (25%): Team's goal-scoring frequency
 * - Defensive Form (20%): Clean sheet percentage (inverse)
 * - Recent Form (35%): Recent scoring and conceding patterns
 * - H2H BTTS (25%): Historical BTTS rate between teams
 *
 * Reference: docs/implementation-plan/phase4.md - Section 4.1
 * Algorithm: docs/betting-insights-Algorithm.md - BTTS Prediction section
 */

import { DEFAULT_ALGORITHM_CONFIG, ML_FACTOR_COEFFICIENTS } from "../config/algorithm-config";
import { BTTS_CALIBRATION } from "../config/btts-calibration";
import type { MatchContext } from "../match-context/context-adjustments";
import { getMaxConfidenceForContext } from "../match-context/context-adjustments";
import { predictBTTS as mlPredictBTTS } from "../ml";
import { finalizeSimulation } from "../presentation/simulation-presenter";
import type {
	Adjustment,
	AlgorithmConfig,
	ConfidenceLevel,
	H2HData,
	Insight,
	ProcessedMatch,
	Simulation,
	TeamData,
} from "../types";
import { applyBinaryTemperatureScaling } from "../utils/calibration-utils";
import {
	applyAdjustments,
	createAdjustment,
} from "../utils/capped-adjustments";
import { clamp } from "../utils/helpers";
import { buildGoalDistribution } from "./goal-distribution";
import type { GoalDistributionModifiers } from "./goal-distribution-modifiers";

// ============================================================================
// ML PREDICTION MODE
// ============================================================================

/**
 * Enable ML-based predictions instead of rule-based factor adjustments.
 */
export const USE_ML_PREDICTION = true;

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Base BTTS probability (neutral starting point)
 */
const BASE_BTTS_PROBABILITY = 50;

/**
 * Thresholds for BTTS adjustments
 */
const THRESHOLDS = {
	highScoringRate: 75, // Teams scoring in >75% of matches
	lowScoringRate: 40, // Teams scoring in <40% of matches
	highCleanSheetRate: 40, // Teams keeping >40% clean sheets
	lowCleanSheetRate: 15, // Teams keeping <15% clean sheets
	highH2HBtts: 70, // H2H BTTS rate >70%
	lowH2HBtts: 30, // H2H BTTS rate <30%
} as const;

/**
 * Scoring drought + elite defense suppression constants
 * 
 * When one team is on a scoring drought AND the opponent has elite defense,
 * BTTS should be suppressed more aggressively than the individual factors suggest.
 * 
 * Example: Auxerre (failed to score 2 matches) vs PSG (42% clean sheets)
 * - Individual factors: -4 (high clean sheet) + maybe -3 (low scoring) = -7
 * - But combined effect should be stronger because drought + elite defense compound
 */
const DROUGHT_ELITE_DEFENSE = {
	// Minimum consecutive matches without scoring to trigger drought detection
	droughtMinMatches: 2,
	// Minimum clean sheet percentage to be considered "elite" defense
	eliteDefenseThreshold: 35,
	// Very elite defense threshold (triggers stronger suppression)
	veryEliteDefenseThreshold: 40,
	// Base suppression when drought meets elite defense
	baseSuppression: -4,
	// Extra suppression for very elite defense
	veryEliteSuppression: -2,
	// Extra suppression when H2H also shows dominance (>=3 wins out of 5)
	h2hDominanceSuppression: -2,
} as const;

/**
 * Standalone elite defense suppression (no drought required)
 * 
 * When a team has elite defense stats (high clean sheet rate, low goals conceded),
 * BTTS should be suppressed even if the opponent doesn't have a scoring drought.
 * 
 * Example: Inter with 38% clean sheets facing Pisa (10 winless games)
 * should strongly reduce BTTS Yes probability.
 */
const ELITE_DEFENSE_STANDALONE = {
	// Very high clean sheet rate threshold
	veryHighCleanSheetThreshold: 38,
	// Base suppression for very high clean sheet rate
	cleanSheetSuppression: -4,
	// Low goals conceded per game threshold
	lowConcededThreshold: 0.7,
	// Suppression for very low conceded rate
	lowConcededSuppression: -2,
	// Extra suppression when opponent is in poor form (high failed to score %)
	opponentPoorFormThreshold: 25, // If opponent fails to score in 25%+ of matches
	opponentPoorFormSuppression: -3,
	// Extra suppression when opponent has low scoring average
	opponentLowScoringThreshold: 1.0, // Avg goals scored per game
	opponentLowScoringSuppression: -2,
} as const;

/**
 * Six-pointer suppression for BTTS
 * 
 * In six-pointer matches (both teams fighting for same objective like relegation),
 * BTTS tends to be less likely because:
 * - Both teams play conservatively and defensively
 * - Neither can afford to lose, so they prioritize not conceding
 * - High stakes lead to cagier, more defensive approaches
 * - Teams focus on "not losing" rather than "winning"
 * 
 * This applies a negative adjustment to BTTS Yes probability.
 */
const SIX_POINTER_BTTS_SUPPRESSION = {
	adjustment: -5, // -5% adjustment to BTTS Yes
} as const;

const normalizeWeights = (
	weights: AlgorithmConfig["marketWeights"]["btts"],
) => {
	const sum = Object.values(weights).reduce((acc, value) => acc + value, 0);
	if (!Number.isFinite(sum) || sum <= 0) {
		const fallback = DEFAULT_ALGORITHM_CONFIG.marketWeights.btts;
		const fallbackSum = Object.values(fallback).reduce(
			(acc, value) => acc + value,
			0,
		);
		return fallbackSum > 0
			? {
					scoringRate: fallback.scoringRate / fallbackSum,
					defensiveForm: fallback.defensiveForm / fallbackSum,
					recentForm: fallback.recentForm / fallbackSum,
					h2h: fallback.h2h / fallbackSum,
				}
			: {
					scoringRate: 0.25,
					defensiveForm: 0.25,
					recentForm: 0.25,
					h2h: 0.25,
				};
	}
	return {
		scoringRate: weights.scoringRate / sum,
		defensiveForm: weights.defensiveForm / sum,
		recentForm: weights.recentForm / sum,
		h2h: weights.h2h / sum,
	};
};

const scaleAdjustment = (value: number, multiplier: number) =>
	value * multiplier;

// ============================================================================
// DERIVED METRICS (avoid type/field drift)
// ============================================================================

function getScoringRateFromDNA(team: TeamData): number {
	// "scoring rate" = % of matches where the team scored at least 1
	// We store the inverse as failedToScorePercentage.
	const failedToScore = team.dna?.failedToScorePercentage;
	if (typeof failedToScore === "number" && !Number.isNaN(failedToScore)) {
		return clamp(100 - failedToScore, 0, 100);
	}
	return 60;
}

function getCleanSheetRateFromDNA(team: TeamData): number {
	// Stored as cleanSheetPercentage
	const cleanSheet = team.dna?.cleanSheetPercentage;
	if (typeof cleanSheet === "number" && !Number.isNaN(cleanSheet)) {
		return clamp(cleanSheet, 0, 100);
	}
	return 25;
}

function getMostRecentMatches(
	team: TeamData,
	limit: number = 10,
): ProcessedMatch[] {
	// Best-effort "recent overall": merge recent home+away and sort by date desc.
	const combined = [
		...(team.lastHomeMatches ?? []),
		...(team.lastAwayMatches ?? []),
	];
	combined.sort(
		(a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
	);
	return combined.slice(0, limit);
}

function calculateBttsRateFromMatches(
	matches: ProcessedMatch[],
): number | null {
	if (!matches || matches.length === 0) return null;
	const bttsCount = matches.filter(
		(m) => m.goalsScored > 0 && m.goalsConceded > 0,
	).length;
	return (bttsCount / matches.length) * 100;
}

function getRecentBttsRate(team: TeamData): number {
	const recent = getMostRecentMatches(team, 10);
	const fromMatches = calculateBttsRateFromMatches(recent);
	if (typeof fromMatches === "number") return fromMatches;
	// Fallback to season-wide BTTS rate if match samples aren't present.
	return team.dna?.bttsYesRate ?? 50;
}

/**
 * Detect consecutive scoring drought (failed to score in X consecutive matches)
 * Returns the number of consecutive matches without scoring, or 0 if no drought
 */
function getScoringDroughtLength(team: TeamData): number {
	const recent = getMostRecentMatches(team, 5);
	if (recent.length === 0) return 0;
	
	let drought = 0;
	for (const match of recent) {
		if (match.goalsScored === 0) {
			drought++;
		} else {
			break; // Drought ends when they score
		}
	}
	return drought;
}

// ============================================================================
// MAIN PREDICTION FUNCTION
// ============================================================================

/**
 * Predict BTTS probability
 *
 * @param homeTeam - Home team data
 * @param awayTeam - Away team data
 * @param h2h - Head-to-head data
 * @param context - Match context (optional)
 * @param config - Algorithm configuration
 * @returns Market prediction for BTTS
 */
export function simulateBTTS(
	homeTeam: TeamData,
	awayTeam: TeamData,
	h2h?: H2HData,
	context?: MatchContext,
	config: AlgorithmConfig = DEFAULT_ALGORITHM_CONFIG,
	distributionModifiers?: GoalDistributionModifiers,
	options?: {
		skipCalibration?: boolean;
		useML?: boolean;
		season?: number;
		leagueId?: number | null;
	},
): Simulation {
	// Check if ML prediction should be used
	const useML = options?.useML ?? USE_ML_PREDICTION;

	if (useML) {
		return simulateBTTSML(homeTeam, awayTeam, h2h, context, options);
	}

	// Shared goal distribution (Poisson + Dixon-Coles)
	const distribution = buildGoalDistribution(
		homeTeam,
		awayTeam,
		config.goalDistribution,
		distributionModifiers,
	);
	const baseYesProbability = distribution.probBTTSYes;

	// Context-aware + capped adjustments (Phase 3.5 + 4.5)
	const adjustments: Adjustment[] = [];
	const normalizedWeights = normalizeWeights(config.marketWeights.btts);
	const multipliers = {
		scoringRate: normalizedWeights.scoringRate,
		defensiveForm: normalizedWeights.defensiveForm,
		recentForm: normalizedWeights.recentForm,
		h2h: normalizedWeights.h2h,
	};

	// Base confidence from data coverage, then cap maximum confidence based on match context volatility.
	let baseConfidence = calculateBaseConfidence(homeTeam, awayTeam, h2h);
	if (context) {
		const maxConfidence = getMaxConfidenceForContext(context);
		baseConfidence = minConfidence(baseConfidence, maxConfidence);
	}

	adjustments.push(
		...getScoringRateAdjustments(homeTeam, awayTeam, multipliers.scoringRate),
	);
	adjustments.push(
		...getDefensiveFormAdjustments(
			homeTeam,
			awayTeam,
			multipliers.defensiveForm,
		),
	);
	adjustments.push(
		...getRecentFormAdjustments(homeTeam, awayTeam, multipliers.recentForm),
	);
	if (h2h?.hasSufficientData) {
		adjustments.push(...getH2HAdjustments(h2h, multipliers.h2h));
	}
	if (context) {
		adjustments.push(...getContextAdjustments(context));
	}
	adjustments.push(...getFormationAdjustments(homeTeam, awayTeam, 0.8));
	adjustments.push(...getSafetyFlagAdjustments(homeTeam, awayTeam));
	// Compounding effect: scoring drought + elite defense opponent
	adjustments.push(...getDroughtEliteDefenseAdjustments(homeTeam, awayTeam, h2h));
	// Standalone elite defense suppression (even without opponent drought)
	adjustments.push(...getEliteDefenseStandaloneAdjustments(homeTeam, awayTeam));

	// Six-pointer suppression: reduce BTTS Yes probability in high-stakes same-objective matches
	// These matches tend to be cagier with both teams playing defensively
	if (context?.isSixPointer) {
		adjustments.push(
			createAdjustment(
				"six_pointer_btts_suppression",
				SIX_POINTER_BTTS_SUPPRESSION.adjustment,
				"Six-pointer match: both teams play conservatively",
			),
		);
	}

	// Use smart adjustment function (selects uncapped mode if enabled)
	const result = applyAdjustments(
		baseYesProbability,
		adjustments,
		"BothTeamsToScore",
		config,
		baseConfidence,
	);

	const rawYesProbability = result.finalProbability;
	const yesProbability = options?.skipCalibration
		? rawYesProbability
		: applyBinaryTemperatureScaling(
				rawYesProbability,
				BTTS_CALIBRATION.temperature,
				"percent",
			);
	const noProbability = 100 - yesProbability;

	return finalizeSimulation({
		scenarioType: "BothTeamsToScore",
		probabilityDistribution: {
			yes: Math.round(yesProbability * 10) / 10,
			no: Math.round(noProbability * 10) / 10,
		},
		modelReliability: result.confidenceLevel,
		insights: buildBttsInsights(yesProbability, homeTeam, awayTeam, h2h),
		adjustmentsApplied: result.cappedAdjustments,
		totalAdjustment: result.totalAdjustment,
		capsHit: result.wasCapped,
		overcorrectionWarning: result.overcorrectionWarning,
	});
}

// ============================================================================
// ML-BASED PREDICTION FUNCTION
// ============================================================================

/**
 * Predict BTTS using ML model + rule-based adjustments
 *
 * Uses trained LightGBM model for base probabilities, then applies
 * rule-based adjustments for context that ML doesn't capture.
 */
function simulateBTTSML(
	homeTeam: TeamData,
	awayTeam: TeamData,
	h2h?: H2HData,
	context?: MatchContext,
	options?: {
		skipCalibration?: boolean;
		season?: number;
		leagueId?: number | null;
	},
): Simulation {
	// =========================================================================
	// STEP 1: Get ML base probability
	// =========================================================================
	const season = options?.season ?? new Date().getFullYear();
	const leagueId = options?.leagueId ?? null;

	const mlPrediction = mlPredictBTTS(homeTeam, awayTeam, h2h, season, leagueId);
	let yesProbability = mlPrediction.yes;

	// =========================================================================
	// STEP 2: Collect ONLY rule-based adjustments (things ML doesn't know)
	// =========================================================================
	const adjustments: Adjustment[] = [];

	// Six-pointer suppression
	if (context?.isSixPointer) {
		adjustments.push(
			createAdjustment(
				"six_pointer_btts_suppression",
				SIX_POINTER_BTTS_SUPPRESSION.adjustment,
				"Six-pointer match: both teams play conservatively",
			),
		);
	}

	// Context adjustments (derby intensity, etc.)
	if (context) {
		adjustments.push(...getContextAdjustments(context));
	}

	// =========================================================================
	// STEP 3: Apply rule-based adjustments
	// =========================================================================
	const totalAdj = adjustments.reduce((sum, adj) => sum + adj.value, 0);
	const maxAdjustment = 12; // Max ±12% from rule-based
	const cappedAdj = clamp(totalAdj, -maxAdjustment, maxAdjustment);

	yesProbability += cappedAdj;
	yesProbability = clamp(yesProbability, 5, 95);
	const noProbability = 100 - yesProbability;

	// =========================================================================
	// STEP 4: Build result
	// =========================================================================
	let baseConfidence = calculateBaseConfidence(homeTeam, awayTeam, h2h);
	if (context) {
		const maxConfidence = getMaxConfidenceForContext(context);
		baseConfidence = minConfidence(baseConfidence, maxConfidence);
	}

	return finalizeSimulation({
		scenarioType: "BothTeamsToScore",
		probabilityDistribution: {
			yes: Math.round(yesProbability * 10) / 10,
			no: Math.round(noProbability * 10) / 10,
		},
		modelReliability: baseConfidence,
		insights: buildBttsInsights(yesProbability, homeTeam, awayTeam, h2h),
		adjustmentsApplied: adjustments,
		totalAdjustment: totalAdj,
		capsHit: Math.abs(totalAdj) > maxAdjustment,
	});
}

function minConfidence(
	a: ConfidenceLevel,
	b: ConfidenceLevel,
): ConfidenceLevel {
	if (a === "LOW" || b === "LOW") return "LOW";
	if (a === "MEDIUM" || b === "MEDIUM") return "MEDIUM";
	return "HIGH";
}

// ============================================================================
// BASE PROBABILITY CALCULATION
// ============================================================================

/**
 * Calculate base BTTS probability from core factors
 */
function calculateBaseBTTSProbability(
	homeTeam: TeamData,
	awayTeam: TeamData,
	h2h?: H2HData,
): number {
	let probability = BASE_BTTS_PROBABILITY;

	// Factor 1: Combined scoring rate
	const homeScoringRate = getScoringRateFromDNA(homeTeam);
	const awayScoringRate = getScoringRateFromDNA(awayTeam);
	const avgScoringRate = (homeScoringRate + awayScoringRate) / 2;

	// Convert to probability adjustment (-15 to +15)
	const normalizedWeights = normalizeWeights(
		DEFAULT_ALGORITHM_CONFIG.marketWeights.btts,
	);
	const scoringAdjustment =
		((avgScoringRate - 60) / 40) * 15 * normalizedWeights.scoringRate;
	probability += scoringAdjustment;

	// Factor 2: Combined defensive weakness (inverse of clean sheet rate)
	const homeCleanSheetRate = getCleanSheetRateFromDNA(homeTeam);
	const awayCleanSheetRate = getCleanSheetRateFromDNA(awayTeam);
	const avgCleanSheetRate = (homeCleanSheetRate + awayCleanSheetRate) / 2;

	// Lower clean sheet rate = higher BTTS chance
	const defensiveAdjustment =
		((30 - avgCleanSheetRate) / 30) * 12 * normalizedWeights.defensiveForm;
	probability += defensiveAdjustment;

	// Factor 3: H2H BTTS rate (if available)
	if (h2h?.hasSufficientData) {
		const h2hBttsRate = h2h.bttsPercentage;
		// Convert to adjustment (-10 to +10)
		const h2hAdjustment =
			((h2hBttsRate - 50) / 50) * 10 * normalizedWeights.h2h;
		probability += h2hAdjustment;
	}

	return clamp(probability, 25, 75);
}

// ============================================================================
// ADJUSTMENT FUNCTIONS
// ============================================================================

/**
 * Get scoring rate adjustments
 */
function getScoringRateAdjustments(
	homeTeam: TeamData,
	awayTeam: TeamData,
	weightMultiplier: number = 1,
): Adjustment[] {
	const adjustments: Adjustment[] = [];

	const homeScoringRate = getScoringRateFromDNA(homeTeam);
	const awayScoringRate = getScoringRateFromDNA(awayTeam);

	// High scoring teams boost BTTS
	if (homeScoringRate > THRESHOLDS.highScoringRate) {
		adjustments.push(
			createAdjustment(
				"home_scoring_rate",
				scaleAdjustment(3, weightMultiplier),
				`Home team scores frequently (${homeScoringRate.toFixed(0)}%)`,
			),
		);
	}

	if (awayScoringRate > THRESHOLDS.highScoringRate) {
		adjustments.push(
			createAdjustment(
				"away_scoring_rate",
				scaleAdjustment(3, weightMultiplier),
				`Away team scores frequently (${awayScoringRate.toFixed(0)}%)`,
			),
		);
	}

	// Low scoring teams reduce BTTS
	if (homeScoringRate < THRESHOLDS.lowScoringRate) {
		adjustments.push(
			createAdjustment(
				"home_scoring_rate",
				scaleAdjustment(-4, weightMultiplier),
				`Home team struggles to score (${homeScoringRate.toFixed(0)}%)`,
			),
		);
	}

	if (awayScoringRate < THRESHOLDS.lowScoringRate) {
		adjustments.push(
			createAdjustment(
				"away_scoring_rate",
				scaleAdjustment(-4, weightMultiplier),
				`Away team struggles to score (${awayScoringRate.toFixed(0)}%)`,
			),
		);
	}

	return adjustments;
}

/**
 * Get defensive form adjustments
 */
function getDefensiveFormAdjustments(
	homeTeam: TeamData,
	awayTeam: TeamData,
	weightMultiplier: number = 1,
): Adjustment[] {
	const adjustments: Adjustment[] = [];

	const homeCleanSheetRate = getCleanSheetRateFromDNA(homeTeam);
	const awayCleanSheetRate = getCleanSheetRateFromDNA(awayTeam);

	// Strong defense reduces BTTS chance
	if (homeCleanSheetRate > THRESHOLDS.highCleanSheetRate) {
		adjustments.push(
			createAdjustment(
				"home_defensive_form",
				scaleAdjustment(-4, weightMultiplier),
				`Home team has strong defense (${homeCleanSheetRate.toFixed(0)}% clean sheets)`,
			),
		);
	}

	if (awayCleanSheetRate > THRESHOLDS.highCleanSheetRate) {
		adjustments.push(
			createAdjustment(
				"away_defensive_form",
				scaleAdjustment(-4, weightMultiplier),
				`Away team has strong defense (${awayCleanSheetRate.toFixed(0)}% clean sheets)`,
			),
		);
	}

	// Weak defense increases BTTS chance
	if (homeCleanSheetRate < THRESHOLDS.lowCleanSheetRate) {
		adjustments.push(
			createAdjustment(
				"home_defensive_form",
				scaleAdjustment(3, weightMultiplier),
				`Home team has weak defense (${homeCleanSheetRate.toFixed(0)}% clean sheets)`,
			),
		);
	}

	if (awayCleanSheetRate < THRESHOLDS.lowCleanSheetRate) {
		adjustments.push(
			createAdjustment(
				"away_defensive_form",
				scaleAdjustment(3, weightMultiplier),
				`Away team has weak defense (${awayCleanSheetRate.toFixed(0)}% clean sheets)`,
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
	weightMultiplier: number = 1,
): Adjustment[] {
	const adjustments: Adjustment[] = [];

	// Check recent BTTS rate in last ~10 matches (best-effort from stored recent matches)
	const homeRecentBtts = getRecentBttsRate(homeTeam);
	const awayRecentBtts = getRecentBttsRate(awayTeam);

	// High recent BTTS rate
	if (homeRecentBtts > 70) {
		adjustments.push(
			createAdjustment(
				"form_home_btts",
				scaleAdjustment(4, weightMultiplier),
				`BTTS in ${homeRecentBtts.toFixed(0)}% of home team's recent matches`,
			),
		);
	}

	if (awayRecentBtts > 70) {
		adjustments.push(
			createAdjustment(
				"form_away_btts",
				scaleAdjustment(4, weightMultiplier),
				`BTTS in ${awayRecentBtts.toFixed(0)}% of away team's recent matches`,
			),
		);
	}

	// Low recent BTTS rate
	if (homeRecentBtts < 30) {
		adjustments.push(
			createAdjustment(
				"form_home_btts",
				scaleAdjustment(-3, weightMultiplier),
				`BTTS in only ${homeRecentBtts.toFixed(0)}% of home team's recent matches`,
			),
		);
	}

	if (awayRecentBtts < 30) {
		adjustments.push(
			createAdjustment(
				"form_away_btts",
				scaleAdjustment(-3, weightMultiplier),
				`BTTS in only ${awayRecentBtts.toFixed(0)}% of away team's recent matches`,
			),
		);
	}

	return adjustments;
}

/**
 * Get H2H adjustments
 * 
 * Uses ML-derived coefficient (0.28) for proportional adjustment based on
 * H2H BTTS percentage deviation from neutral (50%).
 * 
 * ML training found H2H to be the most important factor (~35% weight),
 * so we use a strong coefficient to reflect this.
 */
function getH2HAdjustments(
	h2h: H2HData,
	weightMultiplier: number = 1,
): Adjustment[] {
	const adjustments: Adjustment[] = [];
	
	// Use ML-derived coefficient for H2H BTTS
	const h2hCoefficient = ML_FACTOR_COEFFICIENTS.btts.h2h; // 0.28
	
	// Calculate proportional adjustment based on deviation from 50%
	// H2H BTTS 100% → (100-50)/100 * 28 = +14
	// H2H BTTS 80% → (80-50)/100 * 28 = +8.4
	// H2H BTTS 20% → (20-50)/100 * 28 = -8.4
	const deviation = h2h.bttsPercentage - 50;
	const proportionalAdjustment = (deviation / 100) * (h2hCoefficient * 100);
	
	// Only apply if deviation is meaningful (>10% from neutral)
	if (Math.abs(deviation) >= 10) {
		const reason = deviation > 0
			? `BTTS in ${h2h.bttsPercentage.toFixed(0)}% of H2H matches`
			: `BTTS in only ${h2h.bttsPercentage.toFixed(0)}% of H2H matches`;
		
		adjustments.push(
			createAdjustment(
				"h2h_btts",
				scaleAdjustment(proportionalAdjustment, weightMultiplier),
				reason,
			),
		);
	}

	return adjustments;
}

/**
 * Get scoring drought + elite defense adjustments
 * 
 * When one team is on a scoring drought AND faces an opponent with elite defense,
 * apply compounding suppression to BTTS probability.
 * 
 * This addresses cases like Auxerre vs PSG where:
 * - Auxerre failed to score in 2 consecutive matches
 * - PSG has 42% clean sheet rate
 * - H2H shows PSG dominance (4/5 wins)
 * - BTTS should lean No despite season-wide scoring rates
 */
function getDroughtEliteDefenseAdjustments(
	homeTeam: TeamData,
	awayTeam: TeamData,
	h2h?: H2HData,
): Adjustment[] {
	const adjustments: Adjustment[] = [];

	const homeDrought = getScoringDroughtLength(homeTeam);
	const awayDrought = getScoringDroughtLength(awayTeam);
	const homeCleanSheet = getCleanSheetRateFromDNA(homeTeam);
	const awayCleanSheet = getCleanSheetRateFromDNA(awayTeam);

	// Check home team drought + away elite defense
	if (homeDrought >= DROUGHT_ELITE_DEFENSE.droughtMinMatches) {
		if (awayCleanSheet >= DROUGHT_ELITE_DEFENSE.eliteDefenseThreshold) {
			let suppression = DROUGHT_ELITE_DEFENSE.baseSuppression;
			let reason = `Home team drought (${homeDrought} matches) vs elite defense (${awayCleanSheet.toFixed(0)}% CS)`;

			// Extra suppression for very elite defense
			if (awayCleanSheet >= DROUGHT_ELITE_DEFENSE.veryEliteDefenseThreshold) {
				suppression += DROUGHT_ELITE_DEFENSE.veryEliteSuppression;
				reason = `Home team drought (${homeDrought} matches) vs very elite defense (${awayCleanSheet.toFixed(0)}% CS)`;
			}

			// Extra suppression if H2H shows dominance
			if (h2h?.hasSufficientData && h2h.awayTeamWins >= 3) {
				suppression += DROUGHT_ELITE_DEFENSE.h2hDominanceSuppression;
			}

			adjustments.push(
				createAdjustment("drought_elite_defense_home", suppression, reason),
			);
		}
	}

	// Check away team drought + home elite defense
	if (awayDrought >= DROUGHT_ELITE_DEFENSE.droughtMinMatches) {
		if (homeCleanSheet >= DROUGHT_ELITE_DEFENSE.eliteDefenseThreshold) {
			let suppression = DROUGHT_ELITE_DEFENSE.baseSuppression;
			let reason = `Away team drought (${awayDrought} matches) vs elite defense (${homeCleanSheet.toFixed(0)}% CS)`;

			// Extra suppression for very elite defense
			if (homeCleanSheet >= DROUGHT_ELITE_DEFENSE.veryEliteDefenseThreshold) {
				suppression += DROUGHT_ELITE_DEFENSE.veryEliteSuppression;
				reason = `Away team drought (${awayDrought} matches) vs very elite defense (${homeCleanSheet.toFixed(0)}% CS)`;
			}

			// Extra suppression if H2H shows dominance
			if (h2h?.hasSufficientData && h2h.homeTeamWins >= 3) {
				suppression += DROUGHT_ELITE_DEFENSE.h2hDominanceSuppression;
			}

			adjustments.push(
				createAdjustment("drought_elite_defense_away", suppression, reason),
			);
		}
	}

	return adjustments;
}

/**
 * Get standalone elite defense adjustments (no drought required)
 * 
 * Suppresses BTTS when one team has exceptionally strong defensive stats,
 * even if the opponent is scoring normally.
 */
function getEliteDefenseStandaloneAdjustments(
	homeTeam: TeamData,
	awayTeam: TeamData,
): Adjustment[] {
	const adjustments: Adjustment[] = [];

	const homeCleanSheet = getCleanSheetRateFromDNA(homeTeam);
	const awayCleanSheet = getCleanSheetRateFromDNA(awayTeam);
	const homeConceded = homeTeam.stats?.avgGoalsConceded ?? 1.2;
	const awayConceded = awayTeam.stats?.avgGoalsConceded ?? 1.2;
	const homeScored = homeTeam.stats?.avgGoalsScored ?? 1.3;
	const awayScored = awayTeam.stats?.avgGoalsScored ?? 1.3;
	const homeFailedToScore = homeTeam.dna?.failedToScorePercentage ?? 15;
	const awayFailedToScore = awayTeam.dna?.failedToScorePercentage ?? 15;

	// Check home team elite defense vs away team scoring
	if (homeCleanSheet >= ELITE_DEFENSE_STANDALONE.veryHighCleanSheetThreshold) {
		adjustments.push(
			createAdjustment(
				"elite_defense_home",
				ELITE_DEFENSE_STANDALONE.cleanSheetSuppression,
				`Home team elite defense (${homeCleanSheet.toFixed(0)}% clean sheets)`,
			),
		);
		
		// Extra suppression when opponent (away) struggles to score
		if (awayFailedToScore >= ELITE_DEFENSE_STANDALONE.opponentPoorFormThreshold) {
			adjustments.push(
				createAdjustment(
					"elite_vs_poor_scorer",
					ELITE_DEFENSE_STANDALONE.opponentPoorFormSuppression,
					`Elite defense vs opponent who fails to score ${awayFailedToScore.toFixed(0)}% of matches`,
				),
			);
		}
		if (awayScored <= ELITE_DEFENSE_STANDALONE.opponentLowScoringThreshold) {
			adjustments.push(
				createAdjustment(
					"elite_vs_low_scorer",
					ELITE_DEFENSE_STANDALONE.opponentLowScoringSuppression,
					`Elite defense vs opponent averaging ${awayScored.toFixed(1)} goals/game`,
				),
			);
		}
	}
	if (homeConceded <= ELITE_DEFENSE_STANDALONE.lowConcededThreshold) {
		adjustments.push(
			createAdjustment(
				"elite_defense_conceded_home",
				ELITE_DEFENSE_STANDALONE.lowConcededSuppression,
				`Home team concedes very few (${homeConceded.toFixed(2)} per game)`,
			),
		);
	}

	// Check away team elite defense vs home team scoring
	if (awayCleanSheet >= ELITE_DEFENSE_STANDALONE.veryHighCleanSheetThreshold) {
		adjustments.push(
			createAdjustment(
				"elite_defense_away",
				ELITE_DEFENSE_STANDALONE.cleanSheetSuppression,
				`Away team elite defense (${awayCleanSheet.toFixed(0)}% clean sheets)`,
			),
		);
		
		// Extra suppression when opponent (home) struggles to score
		if (homeFailedToScore >= ELITE_DEFENSE_STANDALONE.opponentPoorFormThreshold) {
			adjustments.push(
				createAdjustment(
					"elite_vs_poor_scorer",
					ELITE_DEFENSE_STANDALONE.opponentPoorFormSuppression,
					`Elite defense vs opponent who fails to score ${homeFailedToScore.toFixed(0)}% of matches`,
				),
			);
		}
		if (homeScored <= ELITE_DEFENSE_STANDALONE.opponentLowScoringThreshold) {
			adjustments.push(
				createAdjustment(
					"elite_vs_low_scorer",
					ELITE_DEFENSE_STANDALONE.opponentLowScoringSuppression,
					`Elite defense vs opponent averaging ${homeScored.toFixed(1)} goals/game`,
				),
			);
		}
	}
	if (awayConceded <= ELITE_DEFENSE_STANDALONE.lowConcededThreshold) {
		adjustments.push(
			createAdjustment(
				"elite_defense_conceded_away",
				ELITE_DEFENSE_STANDALONE.lowConcededSuppression,
				`Away team concedes very few (${awayConceded.toFixed(2)} per game)`,
			),
		);
	}

	return adjustments;
}

/**
 * Get context adjustments (match type, etc.)
 */
function getContextAdjustments(context: MatchContext): Adjustment[] {
	const adjustments: Adjustment[] = [];

	// Knockout matches tend to be more cagey
	if (context.matchType.isKnockout) {
		adjustments.push(
			createAdjustment(
				"match_type",
				-3,
				"Knockout match - typically more defensive",
			),
		);
	}

	// Derby matches can go either way but often tactical
	if (context.derby.isDerby && context.derby.intensity === "EXTREME") {
		adjustments.push(
			createAdjustment("derby", -2, "High-intensity derby - often cagey start"),
		);
	}

	// End of season - teams may be more open
	if (context.isEndOfSeason) {
		adjustments.push(
			createAdjustment(
				"end_of_season",
				2,
				"End of season - potentially more open games",
			),
		);
	}

	return adjustments;
}

/**
 * Get formation stability adjustments (40% impact for BTTS)
 */
function getFormationAdjustments(
	homeTeam: TeamData,
	awayTeam: TeamData,
	impactMultiplier: number,
): Adjustment[] {
	const adjustments: Adjustment[] = [];

	// NOTE: We don't currently have a dedicated match-level formation context wired in.
	// Use a lightweight proxy: if a team's "most played formation" isn't used often,
	// treat them as more experimental and reduce confidence/probability impact.
	const homeUsage =
		homeTeam.dna?.formationFrequency?.[homeTeam.dna?.mostPlayedFormation] ??
		100;
	const awayUsage =
		awayTeam.dna?.formationFrequency?.[awayTeam.dna?.mostPlayedFormation] ??
		100;

	// Map usage % -> reduction points (0..25). Below 40% usage implies instability.
	const homeFormationReduction =
		homeUsage < 40 ? clamp((40 - homeUsage) * 0.8, 0, 25) : 0;
	const awayFormationReduction =
		awayUsage < 40 ? clamp((40 - awayUsage) * 0.8, 0, 25) : 0;

	if (homeFormationReduction > 10) {
		adjustments.push(
			createAdjustment(
				"formation_home",
				-homeFormationReduction * impactMultiplier * 0.3,
				"Home team using experimental formation",
			),
		);
	}

	if (awayFormationReduction > 10) {
		adjustments.push(
			createAdjustment(
				"formation_away",
				-awayFormationReduction * impactMultiplier * 0.3,
				"Away team using experimental formation",
			),
		);
	}

	return adjustments;
}

/**
 * Get safety flag adjustments
 */
function getSafetyFlagAdjustments(
	homeTeam: TeamData,
	awayTeam: TeamData,
): Adjustment[] {
	const adjustments: Adjustment[] = [];

	// Regression risk teams may not sustain high scoring
	if (homeTeam.safetyFlags?.regressionRisk) {
		adjustments.push(
			createAdjustment(
				"safety_regression_home",
				-2,
				"Home team may regress from recent form",
			),
		);
	}

	if (awayTeam.safetyFlags?.regressionRisk) {
		adjustments.push(
			createAdjustment(
				"safety_regression_away",
				-2,
				"Away team may regress from recent form",
			),
		);
	}

	// High motivation teams push for goals
	if (homeTeam.safetyFlags?.motivationClash) {
		adjustments.push(
			createAdjustment(
				"motivation",
				2,
				"Motivation clash - both teams need result",
			),
		);
	}

	return adjustments;
}

// ============================================================================
// CONFIDENCE CALCULATION
// ============================================================================

/**
 * Calculate base confidence level
 */
function calculateBaseConfidence(
	homeTeam: TeamData,
	awayTeam: TeamData,
	h2h?: H2HData,
): ConfidenceLevel {
	let confidence: ConfidenceLevel = "MEDIUM";

	// Boost for sufficient data
	const homeMatchCount = homeTeam.mind?.matchCount ?? 0;
	const awayMatchCount = awayTeam.mind?.matchCount ?? 0;

	if (homeMatchCount >= 30 && awayMatchCount >= 30) {
		confidence = "HIGH";
	} else if (homeMatchCount < 10 || awayMatchCount < 10) {
		confidence = "LOW";
	}

	// Reduce for low H2H data
	if (!h2h || !h2h.hasSufficientData) {
		if (confidence === "HIGH") confidence = "MEDIUM";
	}

	return confidence;
}

// ============================================================================
// RESPONSE BUILDER
// ============================================================================

/**
 * Build final BTTS prediction response
 * @deprecated Legacy function, no longer used in goal-distribution mode
 */
function buildBTTSPrediction(
	_result: ReturnType<typeof applyAdjustments>,
	_homeTeam: TeamData,
	_awayTeam: TeamData,
	_h2h?: H2HData,
): Simulation {
	throw new Error("Legacy BTTS path disabled in goal-distribution mode.");
}

function buildBttsInsights(
	yesProb: number,
	homeTeam: TeamData,
	awayTeam: TeamData,
	h2h?: H2HData,
): Insight[] {
	const supporting: Insight[] = [];
	const watchOuts: Insight[] = [];

	const homeScoringRate = getScoringRateFromDNA(homeTeam);
	const awayScoringRate = getScoringRateFromDNA(awayTeam);
	const avgScoringRate = (homeScoringRate + awayScoringRate) / 2;

	const homeCleanSheets = getCleanSheetRateFromDNA(homeTeam);
	const awayCleanSheets = getCleanSheetRateFromDNA(awayTeam);
	const avgCleanSheets = (homeCleanSheets + awayCleanSheets) / 2;

	const recentHomeBtts = getRecentBttsRate(homeTeam);
	const recentAwayBtts = getRecentBttsRate(awayTeam);
	const avgRecentBtts = (recentHomeBtts + recentAwayBtts) / 2;

	const hasH2H = Boolean(h2h?.hasSufficientData);
	const h2hBtts = hasH2H ? (h2h?.bttsPercentage ?? 0) : null;

	const leansYes = yesProb >= 50;
	const strongRecentBtts = avgRecentBtts >= 60;
	const strongScoring = avgScoringRate >= 65;

	const pushSupport = (
		text: string,
		category: Insight["category"],
		priority: number = 70,
	) =>
		supporting.push({
			text,
			emoji: "✅",
			priority,
			category,
			severity: "MEDIUM",
		});

	const pushWatchOut = (text: string, priority: number = 70) =>
		watchOuts.push({
			text,
			emoji: "⚠️",
			priority,
			category: "WARNING",
			severity: "MEDIUM",
		});

	if (leansYes) {
		if (avgScoringRate >= 60) {
			pushSupport(
				`Both sides usually find the net — their combined scoring rate is around ${avgScoringRate.toFixed(
					0,
				)}%.`,
				"SCORING",
			);
		}
		if (avgCleanSheets <= 30) {
			pushSupport(
				`Clean sheets are relatively rare (${avgCleanSheets.toFixed(
					0,
				)}% combined), which keeps goals at both ends in play.`,
				"DEFENSIVE",
				65,
			);
		}
		if (avgRecentBtts >= 55) {
			pushSupport(
				`Recent matches for both teams have seen both teams score about ${avgRecentBtts.toFixed(
					0,
				)}% of the time.`,
				"FORM",
				60,
			);
		}
		if (hasH2H && (h2hBtts ?? 0) >= 55) {
			pushSupport(
				`Recent head-to-heads have seen both teams score in ${(
					h2hBtts ?? 0
				).toFixed(0)}% of meetings.`,
				"H2H",
				60,
			);
		}

		if (avgCleanSheets >= 40) {
			pushWatchOut(
				`One side keeps clean sheets fairly often, which can spoil a goal at both ends.`,
				68,
			);
		}
		if (avgScoringRate <= 50) {
			pushWatchOut(
				`One of the teams doesn’t always find the net, which can leave a side scoreless.`,
				65,
			);
		}
		if (hasH2H && (h2hBtts ?? 0) <= 35 && !strongRecentBtts && !strongScoring) {
			pushWatchOut(`Recent head-to-heads have often had a clean sheet.`, 62);
		}
	} else {
		if (avgCleanSheets >= 35) {
			pushSupport(
				`Clean sheets show up fairly often (${avgCleanSheets.toFixed(
					0,
				)}% combined), which leans against goals at both ends.`,
				"DEFENSIVE",
			);
		}
		if (avgScoringRate <= 55) {
			pushSupport(
				`At least one side has a modest scoring rate (${avgScoringRate.toFixed(
					0,
				)}% combined).`,
				"SCORING",
				65,
			);
		}
		if (hasH2H && (h2hBtts ?? 0) <= 40) {
			pushSupport(
				`Recent meetings have more often featured a clean sheet.`,
				"H2H",
				60,
			);
		}

		if (avgScoringRate >= 65) {
			pushWatchOut(
				`Both teams score frequently, which keeps a goal at both ends in play.`,
				68,
			);
		}
		if (avgCleanSheets <= 20) {
			pushWatchOut(
				`Clean sheets are rare, so a goal at both ends can still happen.`,
				65,
			);
		}
		if (hasH2H && (h2hBtts ?? 0) >= 60) {
			pushWatchOut(
				`Head-to-heads have often featured goals from both sides.`,
				62,
			);
		}
	}

	if (supporting.length === 0 && watchOuts.length === 0) return [];

	if (watchOuts.length === 0) return supporting.slice(0, 5);

	const remaining = Math.max(1, 5 - watchOuts.length);
	return [
		...supporting.slice(0, remaining),
		...watchOuts.slice(0, 5 - remaining),
	];
}

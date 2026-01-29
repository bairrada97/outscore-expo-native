/**
 * Over/Under Goals Prediction (multi-line)
 *
 * Predicts probability of Over/Under total goals for a specific line.
 *
 * Lines supported: 0.5, 1.5, 2.5, 3.5, 4.5, 5.5
 *
 * Reference: docs/implementation-plan/phase4.md - Section 4.2
 */

import { DEFAULT_ALGORITHM_CONFIG, ML_FACTOR_COEFFICIENTS, UNCAPPED_MODE } from "../config/algorithm-config";
import { TOTAL_GOALS_CALIBRATION } from "../config/total-goals-calibration";
import type { MatchContext } from "../match-context/context-adjustments";
import { getMaxConfidenceForContext } from "../match-context/context-adjustments";
import { predictOverUnder as mlPredictOverUnder } from "../ml";
import { finalizeSimulation } from "../presentation/simulation-presenter";
import type {
	Adjustment,
	AlgorithmConfig,
	ConfidenceLevel,
	GoalLine,
	GoalLineKey,
	H2HData,
	Insight,
	Simulation,
	TeamData,
} from "../types";
import {
	applyAdjustments,
	createAdjustment,
} from "../utils/capped-adjustments";
import { applyBinaryTemperatureScaling } from "../utils/calibration-utils";
import { clamp } from "../utils/helpers";
import { buildGoalDistribution } from "./goal-distribution";
import type { GoalDistributionModifiers } from "./goal-distribution-modifiers";

// ============================================================================
// ML PREDICTION MODE
// ============================================================================

/**
 * Enable ML-based predictions instead of rule-based factor adjustments.
 * Applies to lines where we have trained models.
 */
export const USE_ML_PREDICTION = true;

/** Lines supported by ML models */
const ML_SUPPORTED_LINES = [0.5, 1.5, 2.5, 3.5, 4.5, 5.5] as const;
type MLSupportedLine = typeof ML_SUPPORTED_LINES[number];

// ============================================================================
// TIER-GAP ADJUSTMENT CONSTANTS
// ============================================================================

/**
 * Tier-gap adjustment for total goals
 * 
 * When an elite team (tier 1-2) plays a weak team (tier 3-4) with different
 * competitive objectives, total goals tend to increase because:
 * - Elite teams score freely against weaker defenses
 * - Weak teams can't effectively park the bus
 * - Games become more open
 * 
 * This adjustment is applied directly to the Over probability for lines 2.5-3.5
 * where the gap between model and bookmaker is most pronounced.
 * 
 * Example: PSG (tier 1, TITLE_RACE) vs Auxerre (tier 4, RELEGATION) = +5 adjustment
 */
const TIER_GAP_ADJUSTMENT = {
	minTierGap: 2,           // Minimum tier gap to trigger adjustment
	baseAdjustment: 2.5,     // +2.5% per tier gap
	maxAdjustment: 8,        // Max +8% total
	applicableLines: [2.5, 3.5] as const,  // Only apply to middle lines where gap is worst
} as const;

/**
 * Six-pointer suppression for total goals
 * 
 * In six-pointer matches (both teams fighting for same objective like relegation),
 * total goals tend to be lower because:
 * - Both teams play conservatively and defensively
 * - Neither can afford to lose, so they prioritize not conceding
 * - High stakes lead to cagier, more defensive approaches
 * 
 * This applies a negative adjustment (Under boost) to counteract the model's
 * tendency to overestimate goals in these matches.
 */
const SIX_POINTER_SUPPRESSION = {
	adjustment: -6,          // -6% adjustment (Under boost)
	applicableLines: [2.5, 3.5] as const,  // Only apply to middle lines
} as const;

/**
 * Competitive zones for same-zone detection
 * (mirrors goal-distribution-modifiers.ts)
 */
type CompetitiveZone = 'RELEGATION' | 'TITLE' | 'EUROPEAN' | 'MID_TABLE' | 'OTHER';

function getCompetitiveZone(stakes?: string): CompetitiveZone {
	if (!stakes) return 'OTHER';
	switch (stakes) {
		case 'RELEGATION_BATTLE':
		case 'ALREADY_RELEGATED':
			return 'RELEGATION';
		case 'TITLE_RACE':
			return 'TITLE';
		case 'CL_QUALIFICATION':
		case 'EUROPA_RACE':
		case 'CONFERENCE_RACE':
			return 'EUROPEAN';
		case 'NOTHING_TO_PLAY':
			return 'MID_TABLE';
		default:
			return 'OTHER';
	}
}

function areInSameZone(homeStakes?: string, awayStakes?: string): boolean {
	const homeZone = getCompetitiveZone(homeStakes);
	const awayZone = getCompetitiveZone(awayStakes);
	if (homeZone === 'OTHER' || awayZone === 'OTHER') return false;
	return homeZone === awayZone;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const normalizeWeights = (
	weights: AlgorithmConfig["marketWeights"]["overUnderGoals"],
) => {
	const sum = Object.values(weights).reduce((acc, value) => acc + value, 0);
	if (!Number.isFinite(sum) || sum <= 0) {
		const fallback = DEFAULT_ALGORITHM_CONFIG.marketWeights.overUnderGoals;
		const fallbackSum = Object.values(fallback).reduce(
			(acc, value) => acc + value,
			0,
		);
		return fallbackSum > 0
			? {
					avgGoalsPerGame: fallback.avgGoalsPerGame / fallbackSum,
					defensiveWeakness: fallback.defensiveWeakness / fallbackSum,
					recentForm: fallback.recentForm / fallbackSum,
					h2h: fallback.h2h / fallbackSum,
				}
			: {
					avgGoalsPerGame: 0.25,
					defensiveWeakness: 0.25,
					recentForm: 0.25,
					h2h: 0.25,
				};
	}
	return {
		avgGoalsPerGame: weights.avgGoalsPerGame / sum,
		defensiveWeakness: weights.defensiveWeakness / sum,
		recentForm: weights.recentForm / sum,
		h2h: weights.h2h / sum,
	};
};

const clampSignal = (value: number) => clamp(value, -1, 1);

// ============================================================================
// MAIN PREDICTION FUNCTION
// ============================================================================

export function simulateTotalGoalsOverUnder(
	homeTeam: TeamData,
	awayTeam: TeamData,
	h2h: H2HData | undefined,
	context: MatchContext | undefined,
	line: GoalLine,
	config: AlgorithmConfig = DEFAULT_ALGORITHM_CONFIG,
	distributionModifiers?: GoalDistributionModifiers,
	options?: {
		skipCalibration?: boolean;
		useML?: boolean;
		season?: number;
		leagueId?: number | null;
	},
): Simulation {
	// Check if ML prediction should be used (only for supported lines)
	const useML = options?.useML ?? USE_ML_PREDICTION;
	const isMLSupportedLine = ML_SUPPORTED_LINES.includes(line as MLSupportedLine);

	if (useML && isMLSupportedLine) {
		return simulateTotalGoalsML(
			homeTeam,
			awayTeam,
			h2h,
			context,
			line as MLSupportedLine,
			options,
		);
	}

	const distribution = buildGoalDistribution(
		homeTeam,
		awayTeam,
		config.goalDistribution,
		distributionModifiers,
	);
	const baseOverProbability = clamp(
		distribution.probOverByLine[String(line)] ?? 50,
		0,
		100,
	);

	// Phase 3.5 + 4.5: context-aware adjustments + caps/asymmetry.
	const adjustments: Adjustment[] = [];
	const normalizedWeights = normalizeWeights(config.marketWeights.overUnderGoals);
	const multipliers = {
		avgGoalsPerGame: normalizedWeights.avgGoalsPerGame,
		defensiveWeakness: normalizedWeights.defensiveWeakness,
		recentForm: normalizedWeights.recentForm,
		h2h: normalizedWeights.h2h,
	};

	const combinedScored =
		(homeTeam.stats.avgGoalsScored ?? 0) + (awayTeam.stats.avgGoalsScored ?? 0);
	const combinedConceded =
		(homeTeam.stats.avgGoalsConceded ?? 0) +
		(awayTeam.stats.avgGoalsConceded ?? 0);
	const avgGoalsSignal = clampSignal((combinedScored - line) / 2);
	const defensiveSignal = clampSignal((combinedConceded - line) / 2);

	const homeFormTier = homeTeam.mood?.tier ?? 3;
	const awayFormTier = awayTeam.mood?.tier ?? 3;
	const avgFormTier = (homeFormTier + awayFormTier) / 2;
	const recentFormSignal =
		avgFormTier <= 2 ? 1 : avgFormTier >= 4 ? -1 : 0;

	const key = String(line) as GoalLineKey;
	const h2hOverPct =
		h2h?.hasSufficientData && h2h.goalLineOverPct?.[key] !== undefined
			? h2h.goalLineOverPct[key]
			: null;
	const h2hSignal =
		typeof h2hOverPct === "number"
			? clampSignal((h2hOverPct - 50) / 50)
			: 0;

	if (combinedScored > 0) {
		adjustments.push(
			createAdjustment(
				"avg_goals_per_game",
				avgGoalsSignal * 8 * multipliers.avgGoalsPerGame,
				"Average goals profile vs line",
			),
		);
	}
	if (combinedConceded > 0) {
		adjustments.push(
			createAdjustment(
				"defensive_weakness",
				defensiveSignal * 7 * multipliers.defensiveWeakness,
				"Defensive profile vs line",
			),
		);
	}
	if (recentFormSignal !== 0) {
		adjustments.push(
			createAdjustment(
				"recent_form_totals",
				recentFormSignal * 5 * multipliers.recentForm,
				"Recent form scoring tendency",
			),
		);
	}
	if (h2hSignal !== 0) {
		// Use ML-derived coefficient for H2H totals (0.26 = max ±26% adjustment)
		// ML training found H2H to be the most predictive factor (~33% weight)
		const h2hCoefficient = ML_FACTOR_COEFFICIENTS.totalGoals.h2h;
		adjustments.push(
			createAdjustment(
				"h2h_totals",
				h2hSignal * (h2hCoefficient * 100),
				"H2H totals tendency",
			),
		);
	}

	// Tier-gap adjustment for extreme mismatches (elite vs weak team)
	const tierGapAdjustment = getTierGapAdjustment(homeTeam, awayTeam, line, context);
	if (tierGapAdjustment) {
		adjustments.push(tierGapAdjustment);
	}

	// Six-pointer suppression: reduce Over probability in high-stakes same-objective matches
	// These matches tend to be cagier with both teams playing defensively
	if (
		context?.isSixPointer &&
		SIX_POINTER_SUPPRESSION.applicableLines.includes(line as 2.5 | 3.5)
	) {
		adjustments.push(
			createAdjustment(
				"six_pointer_suppression",
				SIX_POINTER_SUPPRESSION.adjustment,
				"Six-pointer match: both teams play conservatively",
			),
		);
	}

	let baseConfidence = calculateBaseConfidence(baseOverProbability);
	if (context) {
		const maxConfidence = getMaxConfidenceForContext(context);
		baseConfidence = minConfidence(baseConfidence, maxConfidence);
	}

	// Use smart adjustment function (selects uncapped mode if enabled)
	const result = applyAdjustments(
		baseOverProbability,
		adjustments,
		"TotalGoalsOverUnder",
		config,
		baseConfidence,
	);

	const rawOverProbability = clamp(result.finalProbability, 0, 100);
	const overProbability = options?.skipCalibration
		? rawOverProbability
		: applyBinaryTemperatureScaling(
				rawOverProbability,
				TOTAL_GOALS_CALIBRATION.temperature,
				"percent",
			);
	const underProbability = clamp(100 - overProbability, 0, 100);

	return finalizeSimulation({
		scenarioType: "TotalGoalsOverUnder",
		line,
		probabilityDistribution: {
			over: Math.round(overProbability * 10) / 10,
			under: Math.round(underProbability * 10) / 10,
		},
		modelReliability: result.confidenceLevel,
		insights: buildInsights(overProbability, line, homeTeam, awayTeam, h2h),
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
 * Predict Total Goals using ML model + rule-based adjustments
 *
 * Uses trained LightGBM model for base probabilities, then applies
 * rule-based adjustments for context that ML doesn't capture.
 */
function simulateTotalGoalsML(
	homeTeam: TeamData,
	awayTeam: TeamData,
	h2h: H2HData | undefined,
	context: MatchContext | undefined,
	line: MLSupportedLine,
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

	const mlPrediction = mlPredictOverUnder(
		homeTeam,
		awayTeam,
		h2h,
		season,
		leagueId,
		line,
	);
	let overProbability = mlPrediction.over;

	// =========================================================================
	// STEP 2: Collect ONLY rule-based adjustments (things ML doesn't know)
	// =========================================================================
	const adjustments: Adjustment[] = [];

	// Six-pointer suppression
	if (
		context?.isSixPointer &&
		SIX_POINTER_SUPPRESSION.applicableLines.includes(line as 2.5 | 3.5)
	) {
		adjustments.push(
			createAdjustment(
				"six_pointer_suppression",
				SIX_POINTER_SUPPRESSION.adjustment,
				"Six-pointer match: both teams play conservatively",
			),
		);
	}

	// =========================================================================
	// STEP 3: Apply rule-based adjustments
	// =========================================================================
	const totalAdj = adjustments.reduce((sum, adj) => sum + adj.value, 0);
	const maxAdjustment = 10; // Max ±10% from rule-based
	const cappedAdj = clamp(totalAdj, -maxAdjustment, maxAdjustment);

	overProbability += cappedAdj;
	overProbability = clamp(overProbability, 5, 95);
	const underProbability = 100 - overProbability;

	// =========================================================================
	// STEP 4: Build result
	// =========================================================================
	let baseConfidence = calculateBaseConfidence(overProbability);
	if (context) {
		const maxConfidence = getMaxConfidenceForContext(context);
		baseConfidence = minConfidence(baseConfidence, maxConfidence);
	}

	return finalizeSimulation({
		scenarioType: "TotalGoalsOverUnder",
		line,
		probabilityDistribution: {
			over: Math.round(overProbability * 10) / 10,
			under: Math.round(underProbability * 10) / 10,
		},
		modelReliability: baseConfidence,
		insights: buildInsights(overProbability, line, homeTeam, awayTeam, h2h),
		adjustmentsApplied: adjustments,
		totalAdjustment: totalAdj,
		capsHit: Math.abs(totalAdj) > maxAdjustment,
	});
}

// ============================================================================
// OUTPUT HELPERS
// ============================================================================

function calculateBaseConfidence(baseProbability: number) {
	const dist = Math.abs(baseProbability - 50);
	if (dist >= 20) return "HIGH" as const;
	if (dist >= 10) return "MEDIUM" as const;
	return "LOW" as const;
}

// Note: `signalStrength` and `mostProbableOutcome` are added via `finalizeSimulation`.

function minConfidence(
	a: ConfidenceLevel,
	b: ConfidenceLevel,
): ConfidenceLevel {
	if (a === "LOW" || b === "LOW") return "LOW";
	if (a === "MEDIUM" || b === "MEDIUM") return "MEDIUM";
	return "HIGH";
}

function getTeamLineOverPct(team: TeamData, line: GoalLine): number {
	const key = String(line) as GoalLineKey;
	const pct = team.dna.goalLineOverPct?.[key];
	if (typeof pct === "number") return pct;
	// Fallback to a rough estimate from avg goals if line rate missing
	const combined =
		(team.stats.avgGoalsScored ?? 0) + (team.stats.avgGoalsConceded ?? 0);
	return clamp(50 + (combined - line) * 20, 5, 95);
}

function buildInsights(
	overProb: number,
	line: GoalLine,
	homeTeam: TeamData,
	awayTeam: TeamData,
	h2h?: H2HData,
) {
	const supporting: Insight[] = [];
	const watchOuts: Insight[] = [];

	const avgOver =
		(getTeamLineOverPct(homeTeam, line) + getTeamLineOverPct(awayTeam, line)) /
		2;
	const underPct = 100 - avgOver;
	const combinedScored =
		(homeTeam.stats.avgGoalsScored ?? 0) + (awayTeam.stats.avgGoalsScored ?? 0);
	const combinedConceded =
		(homeTeam.stats.avgGoalsConceded ?? 0) +
		(awayTeam.stats.avgGoalsConceded ?? 0);

	const hasH2H = Boolean(h2h?.hasSufficientData);
	const key = String(line) as GoalLineKey;
	const h2hOverPct = hasH2H ? (h2h?.goalLineOverPct?.[key] ?? null) : null;

	const leansOver = overProb >= 50;

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

	if (leansOver) {
		if (avgOver >= 50) {
			pushSupport(
				`Matches involving ${homeTeam.name} and ${awayTeam.name} go over ${line} goals about ${avgOver.toFixed(
					0,
				)}% of the time.`,
				"SCORING",
			);
		}
		if (combinedScored >= 2.6) {
			pushSupport(
				`The two sides combine for around ${combinedScored.toFixed(
					1,
				)} goals scored per game, which keeps totals up.`,
				"SCORING",
				65,
			);
		}
		if (combinedConceded >= 2.4) {
			pushSupport(
				`Their defenses allow roughly ${combinedConceded.toFixed(
					1,
				)} goals per game combined, which can open this up.`,
				"DEFENSIVE",
				60,
			);
		}
		if (hasH2H && h2hOverPct !== null && h2hOverPct >= 55) {
			pushSupport(
				`Recent meetings have gone over ${line} goals in ${(
					h2hOverPct ?? 0
				).toFixed(0)}% of games.`,
				"H2H",
				60,
			);
		}

		if (avgOver <= 45) {
			pushWatchOut(
				`The recent over-${line} rate is modest (${avgOver.toFixed(0)}%), which can keep the total down.`,
				68,
			);
		}
		if (combinedScored <= 2.2) {
			pushWatchOut(
				`Scoring trends are on the lower side (${combinedScored.toFixed(
					1,
				)} goals per game combined).`,
				65,
			);
		}
		if (combinedConceded <= 1.6) {
			pushWatchOut(
				`Both defenses can keep games tight (${combinedConceded.toFixed(
					1,
				)} conceded per game combined).`,
				62,
			);
		}
		if (hasH2H && h2hOverPct !== null && h2hOverPct <= 40) {
			pushWatchOut(
				`Recent head-to-heads often stay under ${line} goals (${(
					h2hOverPct ?? 0
				).toFixed(0)}% over).`,
				62,
			);
		}
	} else {
		if (avgOver <= 50) {
			pushSupport(
				`These teams stay under ${line} goals in about ${underPct.toFixed(
					0,
				)}% of matches on average.`,
				"SCORING",
			);
		}
		if (combinedScored <= 2.2) {
			pushSupport(
				`Combined scoring is around ${combinedScored.toFixed(
					1,
				)} goals per game, which keeps totals down.`,
				"SCORING",
				65,
			);
		}
		if (combinedConceded <= 1.8) {
			pushSupport(
				`They concede roughly ${combinedConceded.toFixed(
					1,
				)} goals per game combined, which leans under.`,
				"DEFENSIVE",
				60,
			);
		}
		if (hasH2H && h2hOverPct !== null && h2hOverPct <= 45) {
			pushSupport(
				`Recent meetings have stayed under ${line} goals most of the time.`,
				"H2H",
				60,
			);
		}

		if (avgOver >= 55) {
			pushWatchOut(
				`They still clear ${line} goals quite often (${avgOver.toFixed(0)}%).`,
				68,
			);
		}
		if (combinedScored >= 2.8) {
			pushWatchOut(
				`Combined scoring is still healthy (${combinedScored.toFixed(
					1,
				)} goals per game).`,
				65,
			);
		}
		if (combinedConceded >= 2.6) {
			pushWatchOut(
				`Defenses concede plenty (${combinedConceded.toFixed(
					1,
				)} per game combined), which can push totals higher.`,
				62,
			);
		}
		if (hasH2H && h2hOverPct !== null && h2hOverPct >= 60) {
			pushWatchOut(`Head-to-heads have often gone over ${line} goals.`, 62);
		}
	}

	// Ensure at least two supporting reasons so we don't imply a single factor.
	if (supporting.length < 2) {
		if (!supporting.some((s) => s.text.includes("goals per game"))) {
			pushSupport(
				`Overall scoring trends sit around ${combinedScored.toFixed(
					1,
				)} goals per game across the two teams.`,
				"SCORING",
				58,
			);
		}
		if (!supporting.some((s) => s.category === "DEFENSIVE")) {
			pushSupport(
				`Defensive trends allow about ${combinedConceded.toFixed(
					1,
				)} goals per game combined.`,
				"DEFENSIVE",
				56,
			);
		}
	}

	if (supporting.length === 0 && watchOuts.length === 0) return [];

	if (watchOuts.length === 0) return supporting.slice(0, 5);

	const remainingSupports = Math.min(
		supporting.length,
		Math.max(2, 5 - watchOuts.length),
	);
	return [
		...supporting.slice(0, remainingSupports),
		...watchOuts.slice(0, 5 - remainingSupports),
	];
}

// ============================================================================
// TIER-GAP ADJUSTMENT
// ============================================================================

/**
 * Get tier-gap adjustment for total goals
 * 
 * When an elite team plays a weak team with different competitive objectives,
 * apply a direct Over adjustment for the middle lines (2.5, 3.5) where the
 * gap between model and bookmaker is most pronounced.
 * 
 * This supplements the tier-gap boost in goal-distribution-modifiers.ts,
 * which affects the base Poisson distribution but may be capped.
 * 
 * Example: PSG (tier 1, TITLE_RACE) vs Auxerre (tier 4, RELEGATION_BATTLE)
 * - Tier gap: 3
 * - Different zones: Yes
 * - Applicable line (2.5): Yes
 * - Adjustment: min(3 * 2.5, 8) = +7.5% for Over
 * 
 * @returns Adjustment or null if not applicable
 */
function getTierGapAdjustment(
	homeTeam: TeamData,
	awayTeam: TeamData,
	line: GoalLine,
	context?: MatchContext,
): Adjustment | null {
	// Only apply in uncapped mode
	if (!UNCAPPED_MODE.enabled) return null;

	// Only apply to applicable lines (2.5, 3.5 where gap is worst)
	if (!TIER_GAP_ADJUSTMENT.applicableLines.includes(line as 2.5 | 3.5)) {
		return null;
	}

	const homeTier = homeTeam.mind?.tier ?? 3;
	const awayTier = awayTeam.mind?.tier ?? 3;
	const tierGap = Math.abs(homeTier - awayTier);

	// Only apply for significant tier gaps
	if (tierGap < TIER_GAP_ADJUSTMENT.minTierGap) {
		return null;
	}

	// Don't apply if both teams are in the same competitive zone
	// Same-zone matches (both relegation, both title race) tend to be cagier
	const sameZone = areInSameZone(context?.homeStakes, context?.awayStakes);
	if (sameZone) {
		return null;
	}

	// Calculate adjustment: base * tierGap, capped at max
	const adjustment = Math.min(
		tierGap * TIER_GAP_ADJUSTMENT.baseAdjustment,
		TIER_GAP_ADJUSTMENT.maxAdjustment,
	);

	// Determine which team is stronger for the reason text
	const strongerTeam = homeTier < awayTier ? homeTeam.name : awayTeam.name;
	const weakerTeam = homeTier < awayTier ? awayTeam.name : homeTeam.name;

	return createAdjustment(
		"tier_gap_mismatch",
		adjustment,
		`Elite vs weak team mismatch (${strongerTeam} tier ${Math.min(homeTier, awayTier)} vs ${weakerTeam} tier ${Math.max(homeTier, awayTier)})`,
	);
}

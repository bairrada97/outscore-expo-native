/**
 * Over/Under Goals Prediction (multi-line)
 *
 * Predicts probability of Over/Under total goals for a specific line.
 *
 * Lines supported: 0.5, 1.5, 2.5, 3.5, 4.5, 5.5
 *
 * Reference: docs/implementation-plan/phase4.md - Section 4.2
 */

import { DEFAULT_ALGORITHM_CONFIG } from "../config/algorithm-config";
import { TOTAL_GOALS_CALIBRATION } from "../config/total-goals-calibration";
import type { MatchContext } from "../match-context/context-adjustments";
import { getMaxConfidenceForContext } from "../match-context/context-adjustments";
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
	applyCappedAsymmetricAdjustments,
	createAdjustment,
} from "../utils/capped-adjustments";
import { applyBinaryTemperatureScaling } from "../utils/calibration-utils";
import { clamp } from "../utils/helpers";
import { buildGoalDistribution } from "./goal-distribution";
import type { GoalDistributionModifiers } from "./goal-distribution-modifiers";

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
	},
): Simulation {
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
		adjustments.push(
			createAdjustment(
				"h2h_totals",
				h2hSignal * 6 * multipliers.h2h,
				"H2H totals tendency",
			),
		);
	}

	let baseConfidence = calculateBaseConfidence(baseOverProbability);
	if (context) {
		const maxConfidence = getMaxConfidenceForContext(context);
		baseConfidence = minConfidence(baseConfidence, maxConfidence);
	}

	const result = applyCappedAsymmetricAdjustments(
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

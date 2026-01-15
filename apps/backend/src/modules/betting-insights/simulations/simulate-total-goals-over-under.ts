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
import type { MatchContext } from "../match-context/context-adjustments";
import { finalizeSimulation } from "../presentation/simulation-presenter";
import type {
  Adjustment,
  AlgorithmConfig,
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
import { clamp } from "../utils/helpers";

// ============================================================================
// CONSTANTS
// ============================================================================

const BASE_PROBABILITY = 50;

const WEIGHTS = {
	avgGoals: 0.3,
	defensiveWeakness: 0.25,
	recentForm: 0.3,
	h2h: 0.2,
} as const;

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
): Simulation {
	const baseProbability = calculateBaseProbability(homeTeam, awayTeam, h2h, line);

	const adjustments: Adjustment[] = [];
	adjustments.push(...getAvgGoalsAdjustments(homeTeam, awayTeam, line));
	adjustments.push(...getDefensiveWeaknessAdjustments(homeTeam, awayTeam, line));
	adjustments.push(...getRecentFormAdjustments(homeTeam, awayTeam, line));

	if (h2h?.hasSufficientData) {
		adjustments.push(...getH2HAdjustments(h2h, line));
	}

	if (context) {
		adjustments.push(...getContextAdjustments(context));
	}

	// Formation adjustments: 40% impact for goal totals (same as old Over25)
	adjustments.push(...getFormationAdjustments(homeTeam, awayTeam, 0.4));

	const result = applyCappedAsymmetricAdjustments(
		baseProbability,
		adjustments,
		"TotalGoalsOverUnder",
		config,
		calculateBaseConfidence(baseProbability),
	);

	const overProbability = clamp(result.finalProbability, 0, 100);
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
// BASE PROBABILITY
// ============================================================================

function calculateBaseProbability(
	homeTeam: TeamData,
	awayTeam: TeamData,
	h2h: H2HData | undefined,
	line: GoalLine,
): number {
	const avgGoalsScore = getAvgGoalsScore(homeTeam, awayTeam);
	const defensiveWeaknessScore = getDefensiveWeaknessScore(homeTeam, awayTeam);
	const recentFormScore = getRecentFormScore(homeTeam, awayTeam, line);
	const h2hScore = getH2HScore(h2h, line);

	const weighted =
		avgGoalsScore * WEIGHTS.avgGoals +
		defensiveWeaknessScore * WEIGHTS.defensiveWeakness +
		recentFormScore * WEIGHTS.recentForm +
		h2hScore * WEIGHTS.h2h;

	// Normalize weights sum (~1.05) → clamp to sane 0-100
	const normalized = weighted / (WEIGHTS.avgGoals + WEIGHTS.defensiveWeakness + WEIGHTS.recentForm + WEIGHTS.h2h);
	return clamp(normalized, 5, 95);
}

function getAvgGoalsScore(homeTeam: TeamData, awayTeam: TeamData): number {
	const combinedAvgGoals = (homeTeam.stats.avgGoalsScored ?? 0) + (awayTeam.stats.avgGoalsScored ?? 0);
	// Map typical range ~1.5..4.0 to ~30..80
	return clamp(50 + (combinedAvgGoals - 2.5) * 15, 20, 80);
}

function getDefensiveWeaknessScore(homeTeam: TeamData, awayTeam: TeamData): number {
	const combinedConceded = (homeTeam.stats.avgGoalsConceded ?? 0) + (awayTeam.stats.avgGoalsConceded ?? 0);
	return clamp(50 + (combinedConceded - 2.0) * 15, 20, 80);
}

function getRecentFormScore(homeTeam: TeamData, awayTeam: TeamData, line: GoalLine): number {
	const homeOverPct = getTeamLineOverPct(homeTeam, line);
	const awayOverPct = getTeamLineOverPct(awayTeam, line);
	return clamp((homeOverPct + awayOverPct) / 2, 10, 90);
}

function getH2HScore(h2h: H2HData | undefined, line: GoalLine): number {
	if (!h2h || h2h.h2hMatchCount === 0) return BASE_PROBABILITY;
	const key = String(line) as GoalLineKey;
	const pct = h2h.goalLineOverPct?.[key] ?? BASE_PROBABILITY;
	return clamp(pct, 10, 90);
}

function getTeamLineOverPct(team: TeamData, line: GoalLine): number {
	const key = String(line) as GoalLineKey;
	const pct = team.dna.goalLineOverPct?.[key];
	if (typeof pct === "number") return pct;
	// Fallback to a rough estimate from avg goals if line rate missing
	const combined = (team.stats.avgGoalsScored ?? 0) + (team.stats.avgGoalsConceded ?? 0);
	return clamp(50 + (combined - line) * 20, 5, 95);
}

// ============================================================================
// ADJUSTMENTS
// ============================================================================

function getAvgGoalsAdjustments(homeTeam: TeamData, awayTeam: TeamData, line: GoalLine): Adjustment[] {
	const combinedAvg = (homeTeam.stats.avgGoalsScored ?? 0) + (awayTeam.stats.avgGoalsScored ?? 0);
	const adjustments: Adjustment[] = [];

	if (combinedAvg >= 3.2) {
		adjustments.push(
			createAdjustment("other", 4, `High combined scoring (${combinedAvg.toFixed(2)} goals/game)`),
		);
	} else if (combinedAvg <= 1.8 && line >= 2.5) {
		adjustments.push(
			createAdjustment("other", -4, `Low combined scoring (${combinedAvg.toFixed(2)} goals/game)`),
		);
	}

	return adjustments;
}

function getDefensiveWeaknessAdjustments(homeTeam: TeamData, awayTeam: TeamData, _line: GoalLine): Adjustment[] {
	const combinedConceded = (homeTeam.stats.avgGoalsConceded ?? 0) + (awayTeam.stats.avgGoalsConceded ?? 0);
	const adjustments: Adjustment[] = [];

	if (combinedConceded >= 2.8) {
		adjustments.push(
			createAdjustment("other", 3, `Leaky defenses (${combinedConceded.toFixed(2)} conceded/game combined)`),
		);
	} else if (combinedConceded <= 1.4) {
		adjustments.push(
			createAdjustment("other", -3, `Strong defenses (${combinedConceded.toFixed(2)} conceded/game combined)`),
		);
	}

	return adjustments;
}

function getRecentFormAdjustments(homeTeam: TeamData, awayTeam: TeamData, line: GoalLine): Adjustment[] {
	const avgOverPct = (getTeamLineOverPct(homeTeam, line) + getTeamLineOverPct(awayTeam, line)) / 2;
	const adjustments: Adjustment[] = [];

	if (avgOverPct >= 70) {
		adjustments.push(
			createAdjustment("dna", 4, `High Over ${line} DNA (${avgOverPct.toFixed(0)}% avg)`),
		);
	} else if (avgOverPct <= 35) {
		adjustments.push(
			createAdjustment("dna", -4, `Low Over ${line} DNA (${avgOverPct.toFixed(0)}% avg)`),
		);
	}

	return adjustments;
}

function getH2HAdjustments(h2h: H2HData, line: GoalLine): Adjustment[] {
	const key = String(line) as GoalLineKey;
	const pct = h2h.goalLineOverPct?.[key] ?? 50;
	const adjustments: Adjustment[] = [];

	if (pct >= 70) {
		adjustments.push(
			createAdjustment("h2h", 3, `Over ${line} in ${pct.toFixed(0)}% of H2H matches`),
		);
	} else if (pct <= 35) {
		adjustments.push(
			createAdjustment("h2h", -3, `Under ${line} in ${(100 - pct).toFixed(0)}% of H2H matches`),
		);
	}

	return adjustments;
}

function getContextAdjustments(_context: MatchContext): Adjustment[] {
	// Placeholder: keep same structure as other predictors; context-based adjustments can be added later.
	return [];
}

function getFormationAdjustments(_homeTeam: TeamData, _awayTeam: TeamData, _impact: number): Adjustment[] {
	// Placeholder: existing formation stability adjustments are applied in other predictors; keep consistent shape for now.
	return [];
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

function buildInsights(
	overProb: number,
	line: GoalLine,
	homeTeam: TeamData,
	awayTeam: TeamData,
	h2h?: H2HData,
) {
	const insights: Insight[] = [];
	const avgOver = (getTeamLineOverPct(homeTeam, line) + getTeamLineOverPct(awayTeam, line)) / 2;
	insights.push({
		text: `Avg Over ${line} DNA: ${avgOver.toFixed(0)}%`,
		emoji: "📊",
		priority: 70,
		category: "SCORING",
		severity: "MEDIUM",
	});

	if (h2h?.hasSufficientData) {
		const key = String(line) as GoalLineKey;
		const pct = h2h.goalLineOverPct?.[key] ?? 0;
		insights.push({
			text: `H2H Over ${line}: ${pct.toFixed(0)}%`,
			emoji: "🤝",
			priority: 60,
			category: "H2H",
			severity: "LOW",
		});
	}

	insights.push({
		text: `Model probability: Over ${line} ${overProb.toFixed(0)}%`,
		emoji: "🎯",
		priority: 80,
		category: "SCORING",
		severity: overProb >= 70 || overProb <= 30 ? "HIGH" : "MEDIUM",
	});

	return insights.slice(0, 5);
}



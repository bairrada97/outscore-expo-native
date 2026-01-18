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
	const supporting: Insight[] = [];
	const watchOuts: Insight[] = [];

	const avgOver =
		(getTeamLineOverPct(homeTeam, line) + getTeamLineOverPct(awayTeam, line)) /
		2;
	const underPct = 100 - avgOver;
	const combinedScored =
		(homeTeam.stats.avgGoalsScored ?? 0) +
		(awayTeam.stats.avgGoalsScored ?? 0);
	const combinedConceded =
		(homeTeam.stats.avgGoalsConceded ?? 0) +
		(awayTeam.stats.avgGoalsConceded ?? 0);

	const hasH2H = Boolean(h2h?.hasSufficientData);
	const key = String(line) as GoalLineKey;
	const h2hOverPct = hasH2H ? h2h?.goalLineOverPct?.[key] ?? 0 : null;

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
		if (hasH2H && (h2hOverPct ?? 0) >= 55) {
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
		if (hasH2H && (h2hOverPct ?? 0) <= 40) {
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
		if (hasH2H && (h2hOverPct ?? 0) <= 45) {
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
		if (hasH2H && (h2hOverPct ?? 0) >= 60) {
			pushWatchOut(
				`Head-to-heads have often gone over ${line} goals.`,
				62,
			);
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
		if (!supporting.some((s) => s.text.includes("Defensive trends"))) {
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

	const remaining = Math.max(1, 5 - watchOuts.length);
	return [
		...supporting.slice(0, remaining),
		...watchOuts.slice(0, 5 - remaining),
	];
}



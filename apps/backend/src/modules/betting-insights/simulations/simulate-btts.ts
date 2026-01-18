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

import { DEFAULT_ALGORITHM_CONFIG } from "../config/algorithm-config";
import type { MatchContext } from "../match-context/context-adjustments";
import { finalizeSimulation } from "../presentation/simulation-presenter";
import type {
  Adjustment,
  AlgorithmConfig,
  ConfidenceLevel,
  H2HData,
  ProcessedMatch,
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
 * Base BTTS probability (neutral starting point)
 */
const BASE_BTTS_PROBABILITY = 50;

/**
 * Weight configuration for BTTS factors
 * Total should conceptually represent contribution to final probability
 */
const BTTS_WEIGHTS = {
	scoringRate: 0.25,
	defensiveForm: 0.2,
	recentForm: 0.35,
	h2h: 0.25,
} as const;

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
): Simulation {
	// Step 1: Calculate base probability from factors
	const baseProbability = calculateBaseBTTSProbability(homeTeam, awayTeam, h2h);

	// Step 2: Collect all adjustments
	const adjustments: Adjustment[] = [];

	// Add scoring rate adjustments
	adjustments.push(...getScoringRateAdjustments(homeTeam, awayTeam));

	// Add defensive form adjustments
	adjustments.push(...getDefensiveFormAdjustments(homeTeam, awayTeam));

	// Add recent form adjustments
	adjustments.push(...getRecentFormAdjustments(homeTeam, awayTeam));

	// Add H2H adjustments
	if (h2h?.hasSufficientData) {
		adjustments.push(...getH2HAdjustments(h2h));
	}

	// Add context adjustments
	if (context) {
		adjustments.push(...getContextAdjustments(context));
	}

	// Add formation stability adjustments (40% impact for BTTS)
	adjustments.push(...getFormationAdjustments(homeTeam, awayTeam, 0.4));

	// Add safety flag adjustments
	adjustments.push(...getSafetyFlagAdjustments(homeTeam, awayTeam));

	// Step 3: Apply unified capping
	const result = applyCappedAsymmetricAdjustments(
		baseProbability,
		adjustments,
		"BothTeamsToScore",
		config,
		calculateBaseConfidence(homeTeam, awayTeam, h2h),
	);

	// Step 4: Build prediction response
	return buildBTTSPrediction(result, homeTeam, awayTeam, h2h);
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
	const scoringAdjustment =
		((avgScoringRate - 60) / 40) * 15 * BTTS_WEIGHTS.scoringRate;
	probability += scoringAdjustment;

	// Factor 2: Combined defensive weakness (inverse of clean sheet rate)
	const homeCleanSheetRate = getCleanSheetRateFromDNA(homeTeam);
	const awayCleanSheetRate = getCleanSheetRateFromDNA(awayTeam);
	const avgCleanSheetRate = (homeCleanSheetRate + awayCleanSheetRate) / 2;

	// Lower clean sheet rate = higher BTTS chance
	const defensiveAdjustment =
		((30 - avgCleanSheetRate) / 30) * 12 * BTTS_WEIGHTS.defensiveForm;
	probability += defensiveAdjustment;

	// Factor 3: H2H BTTS rate (if available)
	if (h2h?.hasSufficientData) {
		const h2hBttsRate = h2h.bttsPercentage;
		// Convert to adjustment (-10 to +10)
		const h2hAdjustment = ((h2hBttsRate - 50) / 50) * 10 * BTTS_WEIGHTS.h2h;
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
): Adjustment[] {
	const adjustments: Adjustment[] = [];

	const homeScoringRate = getScoringRateFromDNA(homeTeam);
	const awayScoringRate = getScoringRateFromDNA(awayTeam);

	// High scoring teams boost BTTS
	if (homeScoringRate > THRESHOLDS.highScoringRate) {
		adjustments.push(
			createAdjustment(
				"home_scoring_rate",
				3,
				`Home team scores frequently (${homeScoringRate.toFixed(0)}%)`,
			),
		);
	}

	if (awayScoringRate > THRESHOLDS.highScoringRate) {
		adjustments.push(
			createAdjustment(
				"away_scoring_rate",
				3,
				`Away team scores frequently (${awayScoringRate.toFixed(0)}%)`,
			),
		);
	}

	// Low scoring teams reduce BTTS
	if (homeScoringRate < THRESHOLDS.lowScoringRate) {
		adjustments.push(
			createAdjustment(
				"home_scoring_rate",
				-4,
				`Home team struggles to score (${homeScoringRate.toFixed(0)}%)`,
			),
		);
	}

	if (awayScoringRate < THRESHOLDS.lowScoringRate) {
		adjustments.push(
			createAdjustment(
				"away_scoring_rate",
				-4,
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
): Adjustment[] {
	const adjustments: Adjustment[] = [];

	const homeCleanSheetRate = getCleanSheetRateFromDNA(homeTeam);
	const awayCleanSheetRate = getCleanSheetRateFromDNA(awayTeam);

	// Strong defense reduces BTTS chance
	if (homeCleanSheetRate > THRESHOLDS.highCleanSheetRate) {
		adjustments.push(
			createAdjustment(
				"home_defensive_form",
				-4,
				`Home team has strong defense (${homeCleanSheetRate.toFixed(0)}% clean sheets)`,
			),
		);
	}

	if (awayCleanSheetRate > THRESHOLDS.highCleanSheetRate) {
		adjustments.push(
			createAdjustment(
				"away_defensive_form",
				-4,
				`Away team has strong defense (${awayCleanSheetRate.toFixed(0)}% clean sheets)`,
			),
		);
	}

	// Weak defense increases BTTS chance
	if (homeCleanSheetRate < THRESHOLDS.lowCleanSheetRate) {
		adjustments.push(
			createAdjustment(
				"home_defensive_form",
				3,
				`Home team has weak defense (${homeCleanSheetRate.toFixed(0)}% clean sheets)`,
			),
		);
	}

	if (awayCleanSheetRate < THRESHOLDS.lowCleanSheetRate) {
		adjustments.push(
			createAdjustment(
				"away_defensive_form",
				3,
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
				4,
				`BTTS in ${homeRecentBtts.toFixed(0)}% of home team's recent matches`,
			),
		);
	}

	if (awayRecentBtts > 70) {
		adjustments.push(
			createAdjustment(
				"form_away_btts",
				4,
				`BTTS in ${awayRecentBtts.toFixed(0)}% of away team's recent matches`,
			),
		);
	}

	// Low recent BTTS rate
	if (homeRecentBtts < 30) {
		adjustments.push(
			createAdjustment(
				"form_home_btts",
				-3,
				`BTTS in only ${homeRecentBtts.toFixed(0)}% of home team's recent matches`,
			),
		);
	}

	if (awayRecentBtts < 30) {
		adjustments.push(
			createAdjustment(
				"form_away_btts",
				-3,
				`BTTS in only ${awayRecentBtts.toFixed(0)}% of away team's recent matches`,
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

	// Strong H2H BTTS trend
	if (h2h.bttsPercentage > THRESHOLDS.highH2HBtts) {
		adjustments.push(
			createAdjustment(
				"h2h_btts",
				5,
				`BTTS in ${h2h.bttsPercentage.toFixed(0)}% of H2H matches`,
			),
		);
	}

	// Low H2H BTTS trend
	if (h2h.bttsPercentage < THRESHOLDS.lowH2HBtts) {
		adjustments.push(
			createAdjustment(
				"h2h_btts",
				-5,
				`BTTS in only ${h2h.bttsPercentage.toFixed(0)}% of H2H matches`,
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
 */
function buildBTTSPrediction(
	result: ReturnType<typeof applyCappedAsymmetricAdjustments>,
	homeTeam: TeamData,
	awayTeam: TeamData,
	h2h?: H2HData,
): Simulation {
	const yesProbability = result.finalProbability;
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
	const h2hBtts = hasH2H ? h2h?.bttsPercentage ?? 0 : null;

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
			pushWatchOut(
				`Recent head-to-heads have often had a clean sheet.`,
				62,
			);
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

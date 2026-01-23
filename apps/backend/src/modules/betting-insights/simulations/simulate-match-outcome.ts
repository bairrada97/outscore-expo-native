/**
 * Match Result (1X2) Prediction
 *
 * CRITICAL: This is the proper implementation per Section 4.6.1.
 * DO NOT use simplified hardcoded probabilities (40/25/35).
 *
 * Uses all 6 factors with proper weights:
 * - Recent Form (30%): Compare home vs away form
 * - H2H Record (25%): Win percentages from H2H
 * - Dynamic Home Advantage (20%): Based on actual stats
 * - Motivation (18%): Who wants it more
 * - Rest Advantage (12%): Days since last match difference
 * - League Position (10%): Quality/tier difference
 *
 * Reference: docs/implementation-plan/phase4.md - Section 4.3
 * Algorithm: docs/betting-insights-Algorithm.md - Section 4.6.1
 */

import { calculateEloGapAdjustment } from "../../elo";
import {
	DEFAULT_ALGORITHM_CONFIG,
	ML_FACTOR_COEFFICIENTS,
	UNCAPPED_MODE,
} from "../config/algorithm-config";
import { MATCH_OUTCOME_CALIBRATION } from "../config/match-outcome-calibration";
import type { MatchContext } from "../match-context/context-adjustments";
import { detectDerby } from "../match-context/derby-detector";
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
import { applyTemperatureScaling } from "../utils/calibration-utils";
import {
	applyAdjustments,
	createAdjustment,
} from "../utils/capped-adjustments";
// Extracted factor calculation utilities (Phase 4.6)
import { calculateFormScore } from "../utils/form-score";
import { calculateH2HScore } from "../utils/h2h-score";
import { clamp } from "../utils/helpers";
import { calculateHomeAdvantageScore } from "../utils/home-advantage";
import type { InjuryImpactAssessment } from "../utils/injury-adjustments";
import {
	calculateMotivationScore,
	getMotivationDescription,
	hasMotivationClash,
} from "../utils/motivation-score";
import { calculatePositionScore } from "../utils/position-score";
import { calculateRestScore } from "../utils/rest-score";
import { buildGoalDistribution } from "./goal-distribution";
import type { GoalDistributionModifiers } from "./goal-distribution-modifiers";

const MATCH_OUTCOME_NEUTRAL_GOAL_STATS = {
	avgGoalsScored: 1.2,
	avgGoalsConceded: 1.2,
	homeAvgScored: 1.2,
	homeAvgConceded: 1.2,
	awayAvgScored: 1.2,
	awayAvgConceded: 1.2,
} as const;

function withNeutralGoalStats(team: TeamData): TeamData {
	return {
		...team,
		stats: {
			...team.stats,
			...MATCH_OUTCOME_NEUTRAL_GOAL_STATS,
		},
	};
}

/**
 * Competitive zones for same-zone detection
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

function addFactorScoreAdjustments(params: {
	formScore: number;
	h2hScore: number;
	homeAdvantageScore: number;
	motivationScore: number;
	restScore: number;
	positionScore: number;
	homeAdjustments: Adjustment[];
	awayAdjustments: Adjustment[];
	config: AlgorithmConfig;
	isSixPointer?: boolean;
	homeStakes?: string;
	awayStakes?: string;
	homeTier?: number;
	awayTier?: number;
}): void {
	const {
		formScore,
		h2hScore,
		homeAdvantageScore,
		motivationScore,
		restScore,
		positionScore,
		homeAdjustments,
		awayAdjustments,
		config,
		isSixPointer,
		homeStakes,
		awayStakes,
		homeTier = 3,
		awayTier = 3,
	} = params;

	// Use ML-learned coefficients in uncapped mode, fall back to legacy scaling otherwise
	if (UNCAPPED_MODE.enabled) {
		const coeffs = ML_FACTOR_COEFFICIENTS.matchOutcome;

		// Check if both teams are in the same competitive zone
		// When they are (e.g., both relegation battle), tier differences matter less
		const sameZone = areInSameZone(homeStakes, awayStakes);

		// Calculate signal consensus - when H2H, form, and motivation are all neutral,
		// the position score alone shouldn't dominate (indicates unpredictable match)
		const h2hNeutral = Math.abs(h2hScore) < 25;
		const formNeutral = Math.abs(formScore) < 25;
		const motivationNeutral = Math.abs(motivationScore) < 15;
		const signalsAreNeutral = h2hNeutral && formNeutral && motivationNeutral;

		// Dampen position score when other signals are neutral
		// This prevents tier differences alone from swinging predictions too much
		// in "coin-flip" matches where H2H is balanced, form is similar, etc.
		let positionDampener = 1.0;
		
		// Same zone dampening: tier matters less when both teams fight for the same thing
		if (sameZone) {
			positionDampener *= 0.5; // 50% reduction for same zone
		}
		
		if (signalsAreNeutral && Math.abs(positionScore) > 50) {
			// When signals are neutral but position gap is large, dampen by 40%
			positionDampener = 0.6;
		}

		// Additional dampening for six-pointer matches (both teams fighting for same goal)
		// In these high-stakes matches, tier differences matter less
		if (isSixPointer) {
			positionDampener *= 0.7;
		}

		// Form dampener for same-zone/six-pointer matches
		// Recent form is less predictive when both teams are fighting for survival/title
		// because desperation and stakes override typical performance patterns
		let formDampener = 1.0;
		if (sameZone || isSixPointer) {
			formDampener = 0.7; // 30% reduction in high-stakes same-zone matches
		}

		// H2H dominance boost: when one team has dominated H2H (score >= 70 or <= -70),
		// increase the H2H coefficient. This reflects that H2H dominance is historically
		// predictive and shouldn't be overridden by contextual factors like motivation.
		let h2hBoost = 1.0;
		if (Math.abs(h2hScore) >= 70) {
			h2hBoost = 1.25; // 25% boost for dominant H2H
		}

		// Motivation dampener: when H2H shows dominance, reduce motivation impact
		// A team's current motivation shouldn't override years of H2H dominance
		let motivationDampener = 1.0;
		if (Math.abs(h2hScore) >= 70) {
			motivationDampener = 0.6; // 40% reduction when H2H is dominant
		}

		// =========================================================================
		// TIER-BASED SCALING (DISABLED)
		// =========================================================================
		// 
		// Previously implemented dynamic scaling based on tier gap, but this was
		// hurting performance on international matches and not improving league matches
		// enough to justify the complexity. Now using fixed coefficients.
		// 
		// Keeping homeTier/awayTier params for potential future use.
		const _tierGap = Math.abs(homeTier - awayTier); // Unused, kept for reference
		void _tierGap;

		// No dynamic scaling - use coefficients directly
		const dynamicScale = 1.0;

		const factors = [
			{
				key: "recent_form",
				label: "Recent form",
				type: "other_form_factor",
				score: formScore,
				// Scale by tier gap: balanced matches get smaller adjustments
				coefficient: coeffs.formScore * formDampener * dynamicScale,
			},
			{
				key: "h2h",
				label: "Head-to-head",
				type: "h2h_factor",
				score: h2hScore,
				// Scale by tier gap + H2H dominance boost
				coefficient: coeffs.h2hScore * h2hBoost * dynamicScale,
			},
			{
				key: "home_advantage",
				label: "Home advantage",
				type: "context_home_advantage_factor",
				score: homeAdvantageScore,
				// Home advantage NOT scaled - applies equally to all matches
				coefficient: coeffs.homeAdvantageScore,
			},
			{
				key: "motivation",
				label: "Motivation",
				type: "motivation_factor",
				score: motivationScore,
				// Scale by tier gap + H2H dampener
				coefficient: coeffs.motivationScore * motivationDampener * dynamicScale,
			},
			{
				key: "rest",
				label: "Rest advantage",
				type: "rest_factor",
				score: restScore,
				// Rest NOT scaled - minor factor that applies equally
				coefficient: coeffs.restScore,
			},
			{
				key: "league_position",
				label: "League position",
				type: "other_position_factor",
				score: positionScore,
				// Scale by tier gap: this is the most important scaling
				coefficient: coeffs.positionScore * positionDampener * dynamicScale,
			},
		] as const;

		for (const factor of factors) {
			// Direct translation: score (-100 to +100) * coefficient = adjustment %
			// Example: positionScore -100 * 0.18 = -18% adjustment
			const value = (factor.score / 100) * factor.coefficient * 100;
			if (Math.abs(value) < 0.5) continue;

			const reason = `${factor.label} favors ${value >= 0 ? "home" : "away"} side`;
			homeAdjustments.push(createAdjustment(factor.type, value, reason));
			awayAdjustments.push(createAdjustment(factor.type, -value, reason));
		}
		return;
	}

	// Legacy capped mode (fallback)
	const weights = config.marketWeights.matchResult;
	const weightSum =
		weights.recentForm +
		weights.h2h +
		weights.homeAdvantage +
		weights.motivation +
		weights.rest +
		weights.leaguePosition;
	const combinedScore =
		formScore * weights.recentForm +
		h2hScore * weights.h2h +
		homeAdvantageScore * weights.homeAdvantage +
		motivationScore * weights.motivation +
		restScore * weights.rest +
		positionScore * weights.leaguePosition;
	const strength = clamp(Math.abs(combinedScore) / (weightSum * 100), 0.15, 1);
	const scale = config.probabilityCaps.maxSwing * 0.7 * strength;

	const factors = [
		{
			key: "recent_form",
			label: "Recent form",
			type: "other_form_factor",
			score: formScore,
			weight: weights.recentForm,
		},
		{
			key: "h2h",
			label: "Head-to-head",
			type: "h2h_factor",
			score: h2hScore,
			weight: weights.h2h,
		},
		{
			key: "home_advantage",
			label: "Home advantage",
			type: "context_home_advantage_factor",
			score: homeAdvantageScore,
			weight: weights.homeAdvantage,
		},
		{
			key: "motivation",
			label: "Motivation",
			type: "motivation_factor",
			score: motivationScore,
			weight: weights.motivation,
		},
		{
			key: "rest",
			label: "Rest advantage",
			type: "rest_factor",
			score: restScore,
			weight: weights.rest,
		},
		{
			key: "league_position",
			label: "League position",
			type: "other_position_factor",
			score: positionScore,
			weight: weights.leaguePosition,
		},
	] as const;

	for (const factor of factors) {
		const value = (factor.score / 100) * factor.weight * scale;
		if (Math.abs(value) < 0.1) continue;

		const reason = `${factor.label} favors ${value >= 0 ? "home" : "away"} side`;
		homeAdjustments.push(createAdjustment(factor.type, value, reason));
		awayAdjustments.push(createAdjustment(factor.type, -value, reason));
	}
}

// ============================================================================
// MIDWEEK LOAD (competition context)
// ============================================================================

function getMostRecentMatch(team: TeamData): ProcessedMatch | null {
	const all = [
		...(team.lastHomeMatches ?? []),
		...(team.lastAwayMatches ?? []),
	];
	if (!all.length) return null;
	const sorted = all
		.slice()
		.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
	return sorted[0] ?? null;
}

function isMidweekUTC(dateIso: string): boolean {
	const d = new Date(dateIso);
	const day = d.getUTCDay(); // 0 Sun ... 6 Sat
	return day === 2 || day === 3 || day === 4; // Tue/Wed/Thu
}

function classifyCompetition(
	leagueName: string,
): "international" | "domestic_cup" | "other" {
	const t = (leagueName ?? "").toLowerCase();

	// International club/national competitions
	if (
		t.includes("champions league") ||
		t.includes("europa league") ||
		t.includes("conference league") ||
		t.includes("nations league") ||
		t.includes("world cup") ||
		t.includes("copa america") ||
		t.includes("afc champions") ||
		t.includes("caf champions") ||
		t.includes("concacaf") ||
		t.includes("libertadores") ||
		t.includes("sudamericana")
	) {
		return "international";
	}

	// Domestic cups
	if (
		t.includes(" cup") ||
		t.startsWith("cup ") ||
		t.includes("copa") ||
		t.includes("taça") ||
		t.includes("taca") ||
		t.includes("coupe") ||
		t.includes("coppa") ||
		t.includes("pokal") ||
		t.includes("beker")
	) {
		return "domestic_cup";
	}

	return "other";
}

function buildMidweekLoadAdjustment(
	team: TeamData,
): { adj: Adjustment; leagueName: string } | null {
	const last = getMostRecentMatch(team);
	if (!last) return null;
	if (!isMidweekUTC(last.date)) return null;

	const leagueName = last.league?.name ?? "";
	const kind = classifyCompetition(leagueName);
	if (kind === "other") return null;

	const days = team.daysSinceLastMatch ?? 7;
	const veryShort = days <= 3;
	const short = days <= 5;
	if (!short) return null;

	// Conservative penalties; this captures intensity/rotation effects beyond rest-days alone.
	let value = 0;
	if (kind === "international") value = veryShort ? -4 : -3;
	if (kind === "domestic_cup") value = veryShort ? -3 : -2;

	return {
		leagueName,
		adj: createAdjustment(
			"context_midweek_competition_load",
			value,
			`Midweek ${leagueName} match can affect freshness and rotation`,
		),
	};
}

function buildPostDerbyHangoverAdjustment(params: {
	team: TeamData;
}): { adj: Adjustment; derbyName?: string } | null {
	const { team } = params;
	const last = getMostRecentMatch(team);
	if (!last) return null;

	// If we have no days since last match, don't guess.
	const days = team.daysSinceLastMatch ?? 7;
	if (days > 6) return null;

	const derby = detectDerby(
		last.homeTeam.id,
		last.awayTeam.id,
		last.homeTeam.name,
		last.awayTeam.name,
	);
	if (!derby.isDerby) return null;

	// Stronger effect for international matches (e.g., UCL) where intensity/travel tends to be higher.
	const lastLeagueName = last.league?.name ?? "";
	const lastCompetition = classifyCompetition(lastLeagueName);
	const isInternational = lastCompetition === "international";

	let base = 0;
	switch (derby.intensity) {
		case "EXTREME":
			base = -3;
			break;
		case "HIGH":
			base = -2;
			break;
		case "MEDIUM":
			base = -1.5;
			break;
		default:
			base = -1;
	}

	// Shorter turnaround increases the hangover risk.
	if (days <= 3) base -= 1;
	if (isInternational) base -= 0.5;

	// Clamp to a conservative range (we still want the core model to dominate).
	const value = Math.max(-4, Math.min(-1, base));

	return {
		derbyName: derby.derbyName,
		adj: createAdjustment(
			"context_post_derby_hangover",
			value,
			derby.derbyName
				? `Coming off a derby (${derby.derbyName}) can affect freshness and focus`
				: "Coming off a derby can affect freshness and focus",
		),
	};
}

// ============================================================================
// MAIN PREDICTION FUNCTION
// ============================================================================

/**
 * Predict Match Result (Home/Draw/Away)
 *
 * IMPORTANT: Uses all 6 factors per Section 4.6.1
 *
 * @param homeTeam - Home team data
 * @param awayTeam - Away team data
 * @param h2h - Head-to-head data
 * @param context - Match context (optional)
 * @param config - Algorithm configuration
 * @returns Match result prediction with all three probabilities
 */
export function simulateMatchOutcome(
	homeTeam: TeamData,
	awayTeam: TeamData,
	h2h?: H2HData,
	context?: MatchContext,
	config: AlgorithmConfig = DEFAULT_ALGORITHM_CONFIG,
	injuries?: {
		homeAdjustments?: Adjustment[];
		awayAdjustments?: Adjustment[];
		homeImpact?: InjuryImpactAssessment | null;
		awayImpact?: InjuryImpactAssessment | null;
	},
	distributionModifiers?: GoalDistributionModifiers,
	options?: {
		skipCalibration?: boolean;
	},
): Simulation {
	// Ignore season goal-rate stats for MatchOutcome calculations.
	const homeOutcomeTeam = withNeutralGoalStats(homeTeam);
	const awayOutcomeTeam = withNeutralGoalStats(awayTeam);

	// =========================================================================
	// STEP 1: Calculate factor scores (Section 4.6.1)
	// =========================================================================

	// Factor 1: Recent Form Comparison (30% weight)
	const formScore = calculateFormScore(homeOutcomeTeam, awayOutcomeTeam);

	// Factor 2: H2H Record (25% weight)
	const h2hScore = calculateH2HScore(h2h);

	// Factor 3: Dynamic Home Advantage (20% weight)
	const homeAdvantageScore = calculateHomeAdvantageScore(
		homeOutcomeTeam,
		awayOutcomeTeam,
	);

	// Factor 4: Motivation Score (18% weight)
	const motivationScore = calculateMotivationScore(
		homeOutcomeTeam,
		awayOutcomeTeam,
	);

	// Factor 5: Rest Advantage (12% weight)
	const restScore = calculateRestScore(homeOutcomeTeam, awayOutcomeTeam);

	// Factor 6: League Position/Quality (10% weight)
	const positionScore = calculatePositionScore(
		homeOutcomeTeam,
		awayOutcomeTeam,
	);

	// =========================================================================
	// STEP 2: Shared goal distribution probabilities
	// =========================================================================
	const distribution = buildGoalDistribution(
		homeOutcomeTeam,
		awayOutcomeTeam,
		config.goalDistribution,
		distributionModifiers,
	);

	// =========================================================================
	// STEP 3: Collect adjustments for tracking and application
	// These adjustments are applied later via applyCappedAsymmetricAdjustments to modify probabilities.
	// =========================================================================
	const homeAdjustments: Adjustment[] = [];
	const awayAdjustments: Adjustment[] = [];

	addFactorScoreAdjustments({
		formScore,
		h2hScore,
		homeAdvantageScore,
		motivationScore,
		restScore,
		positionScore,
		homeAdjustments,
		awayAdjustments,
		config,
		isSixPointer: context?.isSixPointer,
		homeStakes: context?.homeStakes,
		awayStakes: context?.awayStakes,
		homeTier: homeTeam.mind?.tier,
		awayTier: awayTeam.mind?.tier,
	});

	addMindMoodAdjustments(
		homeOutcomeTeam,
		awayOutcomeTeam,
		homeAdjustments,
		awayAdjustments,
	);
	addEloAdjustments(
		homeOutcomeTeam,
		awayOutcomeTeam,
		homeAdjustments,
		awayAdjustments,
	);
	addFormationAdjustments(
		homeOutcomeTeam,
		awayOutcomeTeam,
		homeAdjustments,
		awayAdjustments,
		1.0,
	);
	addSafetyFlagAdjustments(
		homeOutcomeTeam,
		awayOutcomeTeam,
		homeAdjustments,
		awayAdjustments,
	);

	const injuryAdjustmentsHome = injuries?.homeAdjustments ?? [];
	const injuryAdjustmentsAway = injuries?.awayAdjustments ?? [];

	const homeMidweek = buildMidweekLoadAdjustment(homeOutcomeTeam);
	if (homeMidweek) homeAdjustments.push(homeMidweek.adj);
	const awayMidweek = buildMidweekLoadAdjustment(awayOutcomeTeam);
	if (awayMidweek) awayAdjustments.push(awayMidweek.adj);

	const homeDerbyHangover = buildPostDerbyHangoverAdjustment({
		team: homeOutcomeTeam,
	});
	if (homeDerbyHangover) homeAdjustments.push(homeDerbyHangover.adj);
	const awayDerbyHangover = buildPostDerbyHangoverAdjustment({
		team: awayOutcomeTeam,
	});
	if (awayDerbyHangover) awayAdjustments.push(awayDerbyHangover.adj);

	if (context) {
		addContextAdjustments(context, homeAdjustments, awayAdjustments);
	}

	const baseConfidence = calculateBaseConfidence(
		homeOutcomeTeam,
		awayOutcomeTeam,
	);

	// Use smart adjustment function (selects uncapped mode if enabled)
	const homeResult = applyAdjustments(
		distribution.probHomeWin,
		homeAdjustments,
		"MatchOutcome",
		config,
		baseConfidence,
	);
	const awayResult = applyAdjustments(
		distribution.probAwayWin,
		awayAdjustments,
		"MatchOutcome",
		config,
		baseConfidence,
	);

	const normalized = normalizeProbabilities(
		homeResult.finalProbability,
		distribution.probDraw,
		awayResult.finalProbability,
	);
	const calibrated = options?.skipCalibration
		? normalized
		: applyTemperatureScaling(
				normalized,
				MATCH_OUTCOME_CALIBRATION.temperature,
				"percent",
			);

	// Apply six-pointer draw boost
	// In six-pointer matches (both teams fighting for same objective), draws are more common
	// because both teams play conservatively and can't afford to lose
	const drawBoosted = applySixPointerDrawBoost(calibrated, context);

	// Apply post-calibration floor to prevent extreme underdog predictions
	// Bookmakers rarely price home teams below 5-7% even in extreme mismatches
	const floored = applyProbabilityFloors(drawBoosted);

	return buildMatchResultPrediction(
		floored,
		homeResult,
		awayResult,
		homeTeam,
		awayTeam,
		context,
		h2h,
		injuries?.homeImpact ?? null,
		injuries?.awayImpact ?? null,
		{
			formScore,
			h2hScore,
			homeAdvantageScore,
			motivationScore,
			restScore,
			positionScore,
		},
		[...injuryAdjustmentsHome, ...injuryAdjustmentsAway],
	);
}

// ============================================================================
// ADJUSTMENT FUNCTIONS
// ============================================================================

function addEloAdjustments(
	homeTeam: TeamData,
	awayTeam: TeamData,
	homeAdj: Adjustment[],
	awayAdj: Adjustment[],
): void {
	if (!homeTeam.elo || !awayTeam.elo) return;

	const eloGap = homeTeam.elo.rating - awayTeam.elo.rating;
	const confidence = Math.min(homeTeam.elo.confidence, awayTeam.elo.confidence);
	if (confidence <= 0) return;

	const adjustment = calculateEloGapAdjustment(eloGap, confidence, 8);
	if (adjustment === 0) return;

	homeAdj.push(
		createAdjustment(
			"elo_gap_home",
			adjustment,
			`Elo gap favors ${adjustment > 0 ? "home" : "away"} side`,
		),
	);
	awayAdj.push(
		createAdjustment(
			"elo_gap_away",
			-adjustment,
			`Elo gap favors ${adjustment > 0 ? "home" : "away"} side`,
		),
	);
}

/**
 * Add Mind/Mood gap adjustments (Sleeping Giant, Over-Performer)
 */
function addMindMoodAdjustments(
	homeTeam: TeamData,
	awayTeam: TeamData,
	homeAdj: Adjustment[],
	awayAdj: Adjustment[],
): void {
	// Sleeping Giant: Elite team in bad form = value
	if (homeTeam.mood?.isSleepingGiant) {
		homeAdj.push(
			createAdjustment(
				"sleeping_giant_home",
				10,
				"Home team is elite quality in poor form - value opportunity",
			),
		);
	}

	if (awayTeam.mood?.isSleepingGiant) {
		awayAdj.push(
			createAdjustment(
				"sleeping_giant_away",
				10,
				"Away team is elite quality in poor form - value opportunity",
			),
		);
	}

	// Over-Performer: Lower team in great form = regression risk
	if (homeTeam.mood?.isOverPerformer) {
		homeAdj.push(
			createAdjustment(
				"over_performer_home",
				-8,
				"Home team is overperforming - regression risk",
			),
		);
	}

	if (awayTeam.mood?.isOverPerformer) {
		awayAdj.push(
			createAdjustment(
				"over_performer_away",
				-8,
				"Away team is overperforming - regression risk",
			),
		);
	}
}

/**
 * Add formation stability adjustments
 */
function addFormationAdjustments(
	homeTeam: TeamData,
	awayTeam: TeamData,
	homeAdj: Adjustment[],
	awayAdj: Adjustment[],
	impactMultiplier: number,
): void {
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
		homeAdj.push(
			createAdjustment(
				"formation_instability_home",
				-homeReduction * impactMultiplier * 0.5,
				"Home team using experimental formation",
			),
		);
	}

	if (awayReduction > 10) {
		awayAdj.push(
			createAdjustment(
				"formation_instability_away",
				-awayReduction * impactMultiplier * 0.5,
				"Away team using experimental formation",
			),
		);
	}
}

/**
 * Add safety flag adjustments
 */
function addSafetyFlagAdjustments(
	homeTeam: TeamData,
	awayTeam: TeamData,
	homeAdj: Adjustment[],
	awayAdj: Adjustment[],
): void {
	// Regression risk
	if (homeTeam.safetyFlags?.regressionRisk) {
		homeAdj.push(
			createAdjustment(
				"regression_risk_home",
				-5,
				"Home team showing regression risk patterns",
			),
		);
	}

	if (awayTeam.safetyFlags?.regressionRisk) {
		awayAdj.push(
			createAdjustment(
				"regression_risk_away",
				-5,
				"Away team showing regression risk patterns",
			),
		);
	}
}

/**
 * Add context-based adjustments
 */
function addContextAdjustments(
	context: MatchContext,
	homeAdj: Adjustment[],
	awayAdj: Adjustment[],
): void {
	// Neutral venue reduces home advantage
	if (context.matchType.isNeutralVenue) {
		homeAdj.push(
			createAdjustment(
				"neutral_venue",
				-5,
				"Neutral venue - reduced home advantage",
			),
		);
	}

	// Derby match adjustments
	if (context.derby.isDerby) {
		// Derbies are unpredictable - slight penalty to favorite
		homeAdj.push(
			createAdjustment(
				"derby_unpredictability_home",
				-3,
				"Derby match - increased unpredictability",
			),
		);
		awayAdj.push(
			createAdjustment(
				"derby_unpredictability_away",
				-2,
				"Derby match - increased unpredictability",
			),
		);
	}
}

// ============================================================================
// NORMALIZATION
// ============================================================================

/**
 * Normalize probabilities to sum to 100%
 */
function normalizeProbabilities(
	home: number,
	draw: number,
	away: number,
): { home: number; draw: number; away: number } {
	// Ensure all are positive
	home = Math.max(5, home);
	draw = Math.max(5, draw);
	away = Math.max(5, away);

	const total = home + draw + away;

	return {
		home: (home / total) * 100,
		draw: (draw / total) * 100,
		away: (away / total) * 100,
	};
}

/**
 * Apply post-calibration floors to prevent extreme predictions
 * 
 * Bookmakers rarely price any outcome below certain thresholds:
 * - Home win: rarely below 5% even in extreme mismatches
 * - Draw: rarely below 8% in league matches
 * - Away win: rarely below 5%
 * 
 * This prevents the model from being overconfident on heavy favorites.
 */
const PROBABILITY_FLOORS = {
	home: 5,
	draw: 8,
	away: 5,
} as const;

/**
 * Six-pointer draw boost configuration
 * 
 * In six-pointer matches (both teams fighting for same objective like relegation),
 * draws are historically more common because:
 * - Both teams play conservatively
 * - Neither can afford to lose
 * - High stakes lead to cagier, more defensive approaches
 * 
 * Bookmakers typically price draws higher in these matches.
 */
const SIX_POINTER_DRAW_BOOST = {
	boostAmount: 6, // +6% to draw probability
	maxDraw: 38,    // Don't boost draw above 38%
} as const;

function applySixPointerDrawBoost(
	probs: { home: number; draw: number; away: number },
	context?: MatchContext,
): { home: number; draw: number; away: number } {
	// Only apply in six-pointer matches
	if (!context?.isSixPointer) {
		return probs;
	}

	const { home, draw, away } = probs;
	
	// Calculate boost amount, capped to not exceed maxDraw
	const potentialDraw = draw + SIX_POINTER_DRAW_BOOST.boostAmount;
	const newDraw = Math.min(potentialDraw, SIX_POINTER_DRAW_BOOST.maxDraw);
	const actualBoost = newDraw - draw;
	
	if (actualBoost <= 0) {
		return probs;
	}
	
	// Redistribute the boost equally from home and away
	const reduction = actualBoost / 2;
	const newHome = Math.max(home - reduction, PROBABILITY_FLOORS.home);
	const newAway = Math.max(away - reduction, PROBABILITY_FLOORS.away);
	
	// Normalize to ensure sum is 100
	const total = newHome + newDraw + newAway;
	return {
		home: (newHome / total) * 100,
		draw: (newDraw / total) * 100,
		away: (newAway / total) * 100,
	};
}

function applyProbabilityFloors(
	probs: { home: number; draw: number; away: number },
): { home: number; draw: number; away: number } {
	let { home, draw, away } = probs;
	
	// Apply floors
	const homeFloored = Math.max(home, PROBABILITY_FLOORS.home);
	const drawFloored = Math.max(draw, PROBABILITY_FLOORS.draw);
	const awayFloored = Math.max(away, PROBABILITY_FLOORS.away);
	
	// If floors were applied, we need to redistribute the excess
	const homeAdded = homeFloored - home;
	const drawAdded = drawFloored - draw;
	const awayAdded = awayFloored - away;
	const totalAdded = homeAdded + drawAdded + awayAdded;
	
	if (totalAdded === 0) {
		// No floors applied, return as-is
		return probs;
	}
	
	// Redistribute: subtract from the highest probability proportionally
	home = homeFloored;
	draw = drawFloored;
	away = awayFloored;
	
	// Find which outcome had the highest probability to reduce
	const total = home + draw + away;
	
	// Normalize back to 100%
	return {
		home: Math.round((home / total) * 1000) / 10,
		draw: Math.round((draw / total) * 1000) / 10,
		away: Math.round((away / total) * 1000) / 10,
	};
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

	const homeData = homeTeam.mind?.matchCount ?? 0;
	const awayData = awayTeam.mind?.matchCount ?? 0;

	if (homeData >= 30 && awayData >= 30) {
		confidence = "HIGH";
	} else if (homeData < 15 || awayData < 15) {
		confidence = "LOW";
	}

	return confidence;
}

/**
 * Build final prediction response
 */
function buildMatchResultPrediction(
	probs: { home: number; draw: number; away: number },
	homeResult: ReturnType<typeof applyAdjustments>,
	awayResult: ReturnType<typeof applyAdjustments>,
	_homeTeam: TeamData,
	_awayTeam: TeamData,
	_context: MatchContext | undefined,
	_h2h: H2HData | undefined,
	_homeInjuryImpact: InjuryImpactAssessment | null,
	_awayInjuryImpact: InjuryImpactAssessment | null,
	factorScores: {
		formScore: number;
		h2hScore: number;
		homeAdvantageScore: number;
		motivationScore: number;
		restScore: number;
		positionScore: number;
	},
	extraAdjustments: Adjustment[] = [],
): Simulation {
	// Note: _homeTeam, _awayTeam, _h2h, and _factorScores are passed for potential
	// future use (e.g., detailed breakdown in response) but not currently used.

	// Get confidence (use worse of the two)
	const confidence =
		homeResult.confidenceLevel === "LOW" || awayResult.confidenceLevel === "LOW"
			? "LOW"
			: homeResult.confidenceLevel === "MEDIUM" ||
					awayResult.confidenceLevel === "MEDIUM"
				? "MEDIUM"
				: "HIGH";

	return finalizeSimulation({
		scenarioType: "MatchOutcome",
		probabilityDistribution: {
			home: Math.round(probs.home * 10) / 10,
			draw: Math.round(probs.draw * 10) / 10,
			away: Math.round(probs.away * 10) / 10,
		},
		modelReliability: confidence,
		insights: buildMatchOutcomeInsights({
			probs,
			factorScores,
			homeTeam: _homeTeam,
			awayTeam: _awayTeam,
			context: _context,
			h2h: _h2h,
			homeInjuryImpact: _homeInjuryImpact,
			awayInjuryImpact: _awayInjuryImpact,
		}),
		factorScores,
		adjustmentsApplied: [
			...homeResult.cappedAdjustments,
			...awayResult.cappedAdjustments,
			...extraAdjustments,
		],
		totalAdjustment: homeResult.totalAdjustment + awayResult.totalAdjustment,
		capsHit: homeResult.wasCapped || awayResult.wasCapped,
		overcorrectionWarning:
			homeResult.overcorrectionWarning || awayResult.overcorrectionWarning,
	});
}
// Note: `signalStrength` and `mostProbableOutcome` are added via `finalizeSimulation`.

function buildMatchOutcomeInsights(params: {
	probs: { home: number; draw: number; away: number };
	factorScores: {
		formScore: number;
		h2hScore: number;
		homeAdvantageScore: number;
		motivationScore: number;
		restScore: number;
		positionScore: number;
	};
	homeTeam: TeamData;
	awayTeam: TeamData;
	context?: MatchContext;
	h2h?: H2HData;
	homeInjuryImpact?: InjuryImpactAssessment | null;
	awayInjuryImpact?: InjuryImpactAssessment | null;
}): Insight[] {
	const {
		probs,
		factorScores,
		homeTeam,
		awayTeam,
		context,
		h2h,
		homeInjuryImpact,
		awayInjuryImpact,
	} = params;

	function getPick(): "home" | "away" | "draw" {
		const homeP = probs.home ?? 0;
		const drawP = probs.draw ?? 0;
		const awayP = probs.away ?? 0;
		if (homeP >= drawP && homeP >= awayP) return "home";
		if (awayP >= drawP) return "away";
		return "draw";
	}

	function directionFromScore(score: number): "home" | "away" | "neutral" {
		if (score > 0) return "home";
		if (score < 0) return "away";
		return "neutral";
	}

	function strengthWord(abs: number): "slightly" | "moderately" | "clearly" {
		if (abs >= 30) return "clearly";
		if (abs >= 18) return "moderately";
		return "slightly";
	}

	function shouldBeWarning(
		pick: "home" | "away" | "draw",
		dir: "home" | "away" | "neutral",
	): boolean {
		if (pick === "draw") {
			// When model leans draw, any strong directional signal is a watch-out.
			return dir === "home" || dir === "away";
		}
		return dir !== "neutral" && dir !== pick;
	}

	const pick = getPick();
	const pickTeam =
		pick === "home" ? homeTeam.name : pick === "away" ? awayTeam.name : "Draw";

	function formSentence(dir: "home" | "away", abs: number): string {
		const team = dir === "home" ? homeTeam.name : awayTeam.name;
		const w = strengthWord(abs);
		return `${team} is in ${w} better form recently, because they’ve been picking up better results over the last few games.`;
	}

	function h2hSentence(dir: "home" | "away", abs: number): string {
		const team = dir === "home" ? homeTeam.name : awayTeam.name;
		const w = strengthWord(abs);
		return `Recent head-to-head meetings give ${team} a ${w} edge, because recent matchups have often gone their way.`;
	}

	function baselineQualitySentence(dir: "home" | "away", abs: number): string {
		const team = dir === "home" ? homeTeam.name : awayTeam.name;
		const w =
			strengthWord(abs) === "moderately" ? "slightly" : strengthWord(abs); // keep phrasing simple
		return `Overall ${team} looks ${w} stronger this season.`;
	}

	function restSentence(dir: "home" | "away"): string {
		const team = dir === "home" ? homeTeam.name : awayTeam.name;
		return `${team} comes in with a better recovery rhythm, which can help maintain sharpness.`;
	}

	function homeAdvantageSentence(dir: "home" | "away"): string {
		const homeName = homeTeam.name;
		const awayName = awayTeam.name;

		const homeHomeScored = homeTeam.stats?.homeAvgScored;
		const homeAwayScored = homeTeam.stats?.awayAvgScored;
		const awayHomeScored = awayTeam.stats?.homeAvgScored;
		const awayAwayScored = awayTeam.stats?.awayAvgScored;

		const clauses: string[] = [];

		if (dir === "home") {
			// Reasons: home boost and/or away road drop-off.
			if (
				typeof homeHomeScored === "number" &&
				typeof homeAwayScored === "number" &&
				homeHomeScored > homeAwayScored
			) {
				clauses.push(`${homeName} tends to score more at home than away.`);
			}
			if (
				typeof awayHomeScored === "number" &&
				typeof awayAwayScored === "number" &&
				awayHomeScored > awayAwayScored
			) {
				clauses.push(`${awayName} often produces less on the road.`);
			}
			if (clauses.length === 0) {
				clauses.push(
					`home advantage looks more meaningful for ${homeName} in this spot.`,
				);
			}
			return `Playing at home could give ${homeName} an extra lift, because ${clauses.join(" ")}`;
		}

		// Away-leaning home advantage: away travels well and/or home lacks a home boost.
		if (
			typeof awayHomeScored === "number" &&
			typeof awayAwayScored === "number" &&
			awayAwayScored >= awayHomeScored
		) {
			clauses.push(`${awayName} doesn’t drop off much on the road.`);
		}
		if (
			typeof homeHomeScored === "number" &&
			typeof homeAwayScored === "number" &&
			homeHomeScored <= homeAwayScored
		) {
			clauses.push(`${homeName} hasn’t shown a big home boost.`);
		}
		if (clauses.length === 0) {
			clauses.push(`${awayName} tends to travel well.`);
		}
		return `Even away from home, ${awayName} can still impose their game, because ${clauses.join(" ")}`;
	}

	function motivationSentence(params: {
		dir: "home" | "away";
		warn: boolean;
	}): string | null {
		const { dir, warn } = params;
		// Gate: only talk about motivation when it's a big mismatch.
		if (!hasMotivationClash(homeTeam, awayTeam)) return null;

		const team = dir === "home" ? homeTeam : awayTeam;
		const teamName = team.name;
		const level = team.safetyFlags?.motivation;
		if (!level) return null;

		const isEndOfSeason = !!context?.isEndOfSeason;

		// Mid-season: soften CL/Europa language.
		let stakes: string;
		if (!isEndOfSeason && (level === "CL_RACE" || level === "EUROPA_RACE")) {
			stakes =
				level === "CL_RACE"
					? "still in the hunt for Champions League places"
					: "still in the hunt for European places";
		} else {
			stakes = getMotivationDescription(level).toLowerCase();
		}

		const suffix = isEndOfSeason
			? " Late-season urgency can shift performances."
			: "";

		const base = warn
			? `Watch out for ${teamName}: motivation favors them here, because they’re ${stakes}.${suffix}`
			: `Motivation favors ${teamName} here, because they’re ${stakes}.${suffix}`;

		return base.replace(
			"because they’re mid-table, nothing to play for.",
			"because they still have something to play for.",
		);
	}

	const drivers: Array<{
		key: string;
		score: number;
		label: string;
		emoji: string;
		category: Insight["category"];
	}> = [
		{
			key: "h2hScore",
			score: factorScores.h2hScore,
			label: "H2H",
			emoji: "🤝",
			category: "H2H",
		},
		{
			key: "homeAdvantageScore",
			score: factorScores.homeAdvantageScore,
			label: "Home advantage",
			emoji: "🏠",
			category: "CONTEXT",
		},
		{
			key: "restScore",
			score: factorScores.restScore,
			label: "Rest",
			emoji: "🛌",
			category: "CONTEXT",
		},
		{
			key: "formScore",
			score: factorScores.formScore,
			label: "Recent form",
			emoji: "🔥",
			category: "FORM",
		},
		{
			key: "positionScore",
			score: factorScores.positionScore,
			label: "Baseline quality",
			emoji: "📊",
			category: "SAFETY",
		},
		{
			key: "motivationScore",
			score: factorScores.motivationScore,
			label: "Motivation",
			emoji: "🎯",
			category: "CONTEXT",
		},
	];

	const candidates = drivers
		.map((d) => ({ ...d, abs: Math.abs(d.score) }))
		.filter((d) => d.abs >= 12)
		.sort((a, b) => b.abs - a.abs);

	const supporting: Array<{ abs: number; insight: Insight }> = [];
	const watchOuts: Array<{ abs: number; insight: Insight }> = [];

	for (const d of candidates) {
		const dir = directionFromScore(d.score);
		if (dir === "neutral") continue;

		const warn = shouldBeWarning(pick, dir);

		const severity: Insight["severity"] =
			d.abs >= 30 ? "HIGH" : d.abs >= 18 ? "MEDIUM" : "LOW";
		const priority = d.abs >= 30 ? 75 : d.abs >= 18 ? 65 : 55;

		let text: string;
		switch (d.key) {
			case "formScore":
				text = formSentence(dir, d.abs);
				break;
			case "h2hScore":
				text = h2hSentence(dir, d.abs);
				break;
			case "homeAdvantageScore":
				text = homeAdvantageSentence(dir);
				break;
			case "restScore":
				text = restSentence(dir);
				break;
			case "positionScore":
				text = baselineQualitySentence(dir, d.abs);
				break;
			case "motivationScore": {
				const t = motivationSentence({ dir, warn });
				if (!t) continue;
				const insight: Insight = {
					text: t,
					emoji: d.emoji,
					priority: 70,
					category: warn ? "WARNING" : d.category,
					severity,
				};
				if (warn) watchOuts.push({ abs: d.abs, insight });
				else supporting.push({ abs: d.abs, insight });
				continue;
			}
			default:
				text = `${pickTeam} has the edge here.`;
				break;
		}

		const category: Insight["category"] = warn ? "WARNING" : d.category;
		const insight: Insight = {
			text,
			emoji: d.emoji,
			priority,
			category,
			severity,
		};

		if (warn) watchOuts.push({ abs: d.abs, insight });
		else supporting.push({ abs: d.abs, insight });
	}

	// -------------------------------------------------------------------------
	// Additional non-probability watch-outs (variance / uncertainty)
	// These do NOT restate probabilities; they highlight concrete reasons the
	// favorite might still drop points (draw/lose).
	// -------------------------------------------------------------------------

	// H2H tendency: if the picked team doesn't have a strong win record in recent H2H.
	// Only use when we actually have a small recent sample (commonly last 5).
	if (pick !== "draw" && h2h && h2h.h2hMatchCount >= 3) {
		const n = Math.min(5, h2h.h2hMatchCount);
		const pickedWins = pick === "home" ? h2h.homeTeamWins : h2h.awayTeamWins;
		// If the picked side won <= 2 of the last 5 (or <= 1 of the last 3-4), it’s a fair watch-out.
		const isSoftH2H = n >= 5 ? pickedWins <= 2 : pickedWins <= 1;

		if (isSoftH2H && !watchOuts.some((w) => w.insight.emoji === "🤝")) {
			watchOuts.push({
				abs: 28,
				insight: {
					text: `In the last ${n} meetings between these two teams, ${pickTeam} only won ${pickedWins}.`,
					emoji: "🤝",
					priority: 68,
					category: "WARNING",
					severity: "MEDIUM",
				},
			});
		}
	}

	// Home struggles at home: if home is picked but home advantage is negative.
	if (
		pick === "home" &&
		factorScores.homeAdvantageScore < 0 &&
		!watchOuts.some((w) => w.insight.emoji === "🏠")
	) {
		watchOuts.push({
			abs: Math.abs(factorScores.homeAdvantageScore),
			insight: {
				text: `${homeTeam.name} hasn’t shown a strong home edge lately, which can keep this tighter.`,
				emoji: "🏠",
				priority: 64,
				category: "WARNING",
				severity: "MEDIUM",
			},
		});
	}

	// Rest/rhythm watch-outs (aligned with rest quality, not "more days = fresher"):
	// - Very short turnaround can bring fatigue/rotation risk
	// - Very long break can disrupt rhythm (or help); we frame it as uncertainty
	if (!watchOuts.some((w) => w.insight.emoji === "🛌")) {
		const homeDays = homeTeam.daysSinceLastMatch ?? 7;
		const awayDays = awayTeam.daysSinceLastMatch ?? 7;

		const fatigueTeam =
			homeDays < 3 ? homeTeam.name : awayDays < 3 ? awayTeam.name : null;
		if (fatigueTeam && (pick === "draw" || fatigueTeam === pickTeam)) {
			watchOuts.push({
				abs: 24,
				insight: {
					text: `${fatigueTeam} are on a short recovery. That can lead to fatigue and force rotation.`,
					emoji: "🛌",
					priority: 66,
					category: "WARNING",
					severity: "MEDIUM",
				},
			});
		}

		const longBreakTeam =
			homeDays > 10 ? homeTeam.name : awayDays > 10 ? awayTeam.name : null;
		if (longBreakTeam) {
			watchOuts.push({
				abs: 18,
				insight: {
					text: `${longBreakTeam} are coming off a longer break, while that can sometimes help, it can also disrupt their rhythm.`,
					emoji: "🛌",
					priority: 62,
					category: "WARNING",
					severity: "LOW",
				},
			});
		}
	}

	let hasHighEloMidweek = false;
	const highEloPick =
		pick === "home"
			? homeTeam.recentHighEloOpponent
			: pick === "away"
				? awayTeam.recentHighEloOpponent
				: null;
	if (pick !== "draw" && highEloPick) {
		watchOuts.push({
			abs: Math.min(30, 12 + Math.round(highEloPick.gap / 20)),
			insight: {
				text: `${pickTeam} faced a much stronger ${highEloPick.leagueName} opponent (${highEloPick.opponentName}) midweek, which can reduce freshness going into this match.`,
				emoji: "⚡",
				priority: 67,
				category: "WARNING",
				severity: "MEDIUM",
			},
		});
		hasHighEloMidweek = true;
	}

	// Injuries uncertainty: only when the situation is materially unbalanced or severe.
	if (
		(homeInjuryImpact || awayInjuryImpact) &&
		!watchOuts.some((w) => w.insight.emoji === "🏥")
	) {
		const homeAdj = homeInjuryImpact?.adjustmentValue ?? 0;
		const awayAdj = awayInjuryImpact?.adjustmentValue ?? 0;
		const diff = Math.abs(homeAdj - awayAdj);
		const severe =
			homeInjuryImpact?.severity === "CRITICAL" ||
			awayInjuryImpact?.severity === "CRITICAL" ||
			homeInjuryImpact?.severity === "HIGH" ||
			awayInjuryImpact?.severity === "HIGH";

		// Trigger only when relatively meaningful (future: key-player injuries).
		if (severe || diff >= 5) {
			watchOuts.push({
				abs: severe ? 30 : 20,
				insight: {
					text: "Injuries add more uncertainty to this match",
					emoji: "🏥",
					priority: 70,
					category: "WARNING",
					severity: severe ? "HIGH" : "MEDIUM",
				},
			});
		}
	}

	// Midweek competition load: highlight potential rotation/freshness effects without rest-day talk.
	if (!hasHighEloMidweek && !watchOuts.some((w) => w.insight.emoji === "🗓️")) {
		const homeLoad = buildMidweekLoadAdjustment(homeTeam);
		const awayLoad = buildMidweekLoadAdjustment(awayTeam);
		const pickLoad =
			pick === "home" ? homeLoad : pick === "away" ? awayLoad : null;

		if (pick !== "draw" && pickLoad) {
			watchOuts.push({
				abs: 22,
				insight: {
					text: `${pickTeam} had a midweek ${pickLoad.leagueName} match, which can impact rotation and sharpness.`,
					emoji: "🗓️",
					priority: 64,
					category: "WARNING",
					severity: "MEDIUM",
				},
			});
		}
	}

	// Post-derby hangover: previous match was a derby/rivalry.
	// - If the picked team comes off a derby, it’s a watch-out.
	// - If the opponent comes off a derby, it can be a supporting context signal.
	if (
		!supporting.some((s) => s.insight.emoji === "⚔️") &&
		!watchOuts.some((w) => w.insight.emoji === "⚔️")
	) {
		const homeDerby = buildPostDerbyHangoverAdjustment({
			team: homeTeam,
		});
		const awayDerby = buildPostDerbyHangoverAdjustment({
			team: awayTeam,
		});

		const pickedDerby =
			pick === "home" ? homeDerby : pick === "away" ? awayDerby : null;
		const oppDerby =
			pick === "home" ? awayDerby : pick === "away" ? homeDerby : null;

		if (pick !== "draw" && pickedDerby) {
			watchOuts.push({
				abs: 26,
				insight: {
					text: pickedDerby.derbyName
						? `${pickTeam} are coming off a derby (${pickedDerby.derbyName}) — those games can be draining and sometimes affect focus and legs.`
						: `${pickTeam} are coming off a derby — those games can be draining and sometimes affect focus and legs.`,
					emoji: "⚔️",
					priority: 68,
					category: "WARNING",
					severity: "MEDIUM",
				},
			});
		} else if (pick !== "draw" && oppDerby) {
			const oppName = pick === "home" ? awayTeam.name : homeTeam.name;
			supporting.push({
				abs: 20,
				insight: {
					text: oppDerby.derbyName
						? `${oppName} are coming off a derby (${oppDerby.derbyName}), which can impact recovery and rotation.`
						: `${oppName} are coming off a derby, which can impact recovery and rotation.`,
					emoji: "⚔️",
					priority: 60,
					category: "CONTEXT",
					severity: "LOW",
				},
			});
		}
	}

	// Match context volatility (derby/neutral/post-break/end-season).
	const isDerby = !!(context?.derby?.isDerby ?? context?.matchType?.isDerby);
	const isNeutral = !!context?.matchType?.isNeutralVenue;
	const isPostBreak = !!context?.isPostInternationalBreak;
	const isEndSeason = !!context?.isEndOfSeason;

	if (
		(isDerby || isNeutral || isPostBreak || isEndSeason) &&
		!watchOuts.some((w) => w.insight.emoji === "⚠️")
	) {
		const reasons: string[] = [];
		if (isDerby) reasons.push("Derby matches can be unpredictable.");
		if (isNeutral)
			reasons.push("A neutral venue can reduce the usual home edge.");
		if (isPostBreak)
			reasons.push(
				"Post-break games can be harder to read due to rotation and rhythm.",
			);
		if (isEndSeason)
			reasons.push("Late-season pressure can lead to surprise outcomes.");

		watchOuts.push({
			abs: 24,
			insight: {
				text: reasons.join(" "),
				emoji: "⚠️",
				priority: 66,
				category: "WARNING",
				severity: "MEDIUM",
			},
		});
	}

	// Allow more depth: up to 5 supporting + up to 5 watch-outs.
	const topSupporting = supporting
		.sort((a, b) => b.abs - a.abs)
		.slice(0, 5)
		.map((x) => x.insight);
	const topWatchOuts = watchOuts
		.sort((a, b) => b.abs - a.abs)
		.slice(0, 5)
		.map((x) => x.insight);

	// Keep ordering stable for the UI: supporting first, then watch-outs.
	return [...topSupporting, ...topWatchOuts];
}

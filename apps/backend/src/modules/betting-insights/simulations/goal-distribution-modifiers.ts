import { calculateEloBalanceShift } from "../../elo";
import { DEFAULT_ALGORITHM_CONFIG, UNCAPPED_MODE } from "../config/algorithm-config";
import type { MatchContext } from "../match-context/context-adjustments";
import type { H2HData, TeamData } from "../types";
import { calculateFormScore } from "../utils/form-score";
import { calculateH2HScore } from "../utils/h2h-score";
import { clamp } from "../utils/helpers";
import { calculateHomeAdvantageScore } from "../utils/home-advantage";
import type { InjuryImpactAssessment } from "../utils/injury-adjustments";
import { calculateMotivationScore } from "../utils/motivation-score";
import { calculatePositionScore } from "../utils/position-score";
import { calculateRestScore } from "../utils/rest-score";

export interface GoalDistributionModifiers {
	attackHomeMult: number;
	defenseHomeMult: number;
	attackAwayMult: number;
	defenseAwayMult: number;
	globalGoalsMult: number;
}

/**
 * Injury scaling factors for goal distribution
 * 
 * When the opponent is injured, the stronger team benefits MORE.
 * Example: Inter (tier 1) vs Pisa (tier 3) with Pisa injured
 * - Pisa's attack reduction: base effect (injuries hurt their scoring)
 * - Pisa's defense penalty: AMPLIFIED because Inter will exploit weakened defense
 */
const INJURY_ATTACK_SCALE = 0.35; // Base: 35% of injury value affects attack
const INJURY_DEFENSE_SCALE = 0.25; // Base: 25% of injury value affects defense
const TIER_GAP_DEFENSE_BOOST = 0.15; // +15% per tier gap (stronger team scores more vs injured weaker team)

const DEFAULT_MODIFIERS: GoalDistributionModifiers = {
	attackHomeMult: 1,
	defenseHomeMult: 1,
	attackAwayMult: 1,
	defenseAwayMult: 1,
	globalGoalsMult: 1,
};

// Widened multiplier clamps to allow more extreme goal expectations
// This lets elite teams (tier 1) vs weak teams (tier 4) show higher total goals
const MIN_MULTIPLIER = 0.7;
const MAX_MULTIPLIER = 1.35;

const BASE_MAX_BALANCE_SHIFT = 0.18; // Base max +/-18% shift in scoring balance
const LARGE_GAP_MAX_BALANCE_SHIFT = 0.35; // For tier gaps >= 2, allow up to +/-35%
const SAME_ZONE_BALANCE_SHIFT = 0.12; // When both teams in same zone, use +/-12% max
const BASE_LEAGUE_AVG_GOALS = 2.6;
const LEAGUE_GOALS_MAX_SHIFT = 0.1;

/**
 * Tier gap boost for total goals
 * When a strong team plays a weak team, total goals tend to increase
 * because the strong team scores freely and weak teams can't defend effectively
 * 
 * Increased from 0.05 to 0.07 to better match bookmaker expectations for
 * extreme mismatches (e.g., PSG vs Auxerre where Over 2.5 should be ~65%)
 */
const TIER_GAP_TOTAL_GOALS_BOOST = 0.07; // +7% per tier gap (max 21% for gap of 3)

/**
 * Low-scoring scenario suppression constants
 * When multiple low-scoring signals align, reduce total goals expectation
 * 
 * This addresses the symmetry problem where the model clusters toward 50%
 * for genuinely low-scoring matches (e.g., relegation six-pointers with
 * poor H2H scoring history)
 */
const LOW_SCORING_COMBINED_AVG_THRESHOLD = 2.0; // Combined goals/game < 2.0 = low
const LOW_SCORING_H2H_OVER25_THRESHOLD = 35; // H2H Over 2.5 < 35% = historically low
const LOW_SCORING_DNA_OVER25_THRESHOLD = 45; // DNA Over 2.5 < 45% = team profile is low
const LOW_SCORING_BASE_SUPPRESSION = 0.04; // -4% base suppression per signal
const LOW_SCORING_SAME_ZONE_BOOST = 0.02; // Extra -2% for same-zone six-pointers
const LOW_SCORING_MAX_SUPPRESSION = 0.15; // Max -15% total suppression

/**
 * Competitive zones - when both teams are in the same zone, tier gaps matter less
 * because desperation and psychological factors level the playing field.
 */
type CompetitiveZone = 'RELEGATION' | 'TITLE' | 'EUROPEAN' | 'MID_TABLE' | 'OTHER';

/**
 * Map stakes to competitive zone for same-zone detection
 */
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

/**
 * Check if both teams are in the same competitive zone
 * When they are, tier differences matter less (desperation equalizes)
 */
function areInSameZone(homeStakes?: string, awayStakes?: string): boolean {
	const homeZone = getCompetitiveZone(homeStakes);
	const awayZone = getCompetitiveZone(awayStakes);
	
	// Only dampen for meaningful zones (not OTHER)
	if (homeZone === 'OTHER' || awayZone === 'OTHER') return false;
	
	return homeZone === awayZone;
}

const DEFAULT_MATCH_RESULT_WEIGHTS =
	DEFAULT_ALGORITHM_CONFIG.marketWeights.matchResult;

export function buildGoalDistributionModifiers(params: {
	context?: MatchContext;
	homeTeam?: TeamData;
	awayTeam?: TeamData;
	h2h?: H2HData;
	homeInjuryImpact?: InjuryImpactAssessment | null;
	awayInjuryImpact?: InjuryImpactAssessment | null;
	leagueStats?: {
		avgGoals: number;
		matches: number;
	};
}): GoalDistributionModifiers {
	const modifiers: GoalDistributionModifiers = { ...DEFAULT_MODIFIERS };

	applyContextExpectation(modifiers, params.context);
	applyInjuryImpacts(
		modifiers,
		params.homeInjuryImpact,
		params.awayInjuryImpact,
		params.homeTeam,
		params.awayTeam,
	);
	applyBalanceShift(
		modifiers,
		params.homeTeam,
		params.awayTeam,
		params.h2h,
		params.context,
	);
	applyTierGapTotalGoalsBoost(
		modifiers,
		params.homeTeam,
		params.awayTeam,
		params.context,
	);
	applyLowScoringScenarioSuppression(
		modifiers,
		params.homeTeam,
		params.awayTeam,
		params.h2h,
		params.context,
	);
	applyLeagueScoringProfile(modifiers, params.leagueStats);

	return clampModifiers(modifiers);
}

/**
 * Apply tier-gap boost to total goals
 * 
 * When a strong team (tier 1-2) plays a weak team (tier 3-4), total goals tend to increase:
 * - Strong teams score freely against weaker defenses
 * - Weak teams often can't "park the bus" effectively against elite attackers
 * - Games become more open as weak teams try to attack back
 * 
 * Example: Inter (tier 1) vs Pisa (tier 3) = gap of 2 → +10% total goals boost
 * Example: PSG (tier 1) vs Auxerre (tier 4) = gap of 3 → +15% total goals boost
 * 
 * NOT applied when both teams are in the same competitive zone (e.g., both relegation)
 * because desperation leads to more cagey, defensive matches.
 */
function applyTierGapTotalGoalsBoost(
	modifiers: GoalDistributionModifiers,
	homeTeam?: TeamData,
	awayTeam?: TeamData,
	context?: MatchContext,
): void {
	if (!homeTeam || !awayTeam) return;
	if (!UNCAPPED_MODE.enabled) return;

	const homeTier = homeTeam.mind?.tier ?? 3;
	const awayTier = awayTeam.mind?.tier ?? 3;
	const tierGap = Math.abs(homeTier - awayTier);

	// Only apply for significant tier gaps (>= 2)
	if (tierGap < 2) return;

	// Don't apply if both teams are in the same competitive zone
	// Same-zone matches (both relegation, both title race) tend to be cagier
	const sameZone = areInSameZone(context?.homeStakes, context?.awayStakes);
	if (sameZone) return;

	// Apply boost: 5% per tier gap, max 15%
	const boost = Math.min(tierGap * TIER_GAP_TOTAL_GOALS_BOOST, 0.15);
	modifiers.globalGoalsMult *= 1 + boost;
}

/**
 * Apply suppression for low-scoring scenarios
 * 
 * Addresses the symmetry problem where the model clusters toward 50% for
 * genuinely low-scoring matches. When multiple low-scoring signals align,
 * this reduces total goals expectation.
 * 
 * Signals considered:
 * 1. Combined low scoring rate (< 2.0 goals/game combined)
 * 2. H2H historically low (Over 2.5 < 35%)
 * 3. DNA profile low (both teams' Over 2.5 < 45%)
 * 4. Same-zone six-pointer (e.g., relegation battle - teams play cagey)
 * 
 * Example: Casa Pia vs AVS (both relegation, H2H 0% over 2.5, combined 1.5 gpg)
 * - All 4 signals fire → ~14% suppression → Under 2.5 pushed from 48% to ~55%
 * 
 * NOT applied if tier-gap boost was applied (those games tend to be high-scoring)
 */
function applyLowScoringScenarioSuppression(
	modifiers: GoalDistributionModifiers,
	homeTeam?: TeamData,
	awayTeam?: TeamData,
	h2h?: H2HData,
	context?: MatchContext,
): void {
	if (!homeTeam || !awayTeam) return;
	if (!UNCAPPED_MODE.enabled) return;

	// Check if tier-gap boost was likely applied (skip suppression in that case)
	const homeTier = homeTeam.mind?.tier ?? 3;
	const awayTier = awayTeam.mind?.tier ?? 3;
	const tierGap = Math.abs(homeTier - awayTier);
	const sameZone = areInSameZone(context?.homeStakes, context?.awayStakes);
	
	// If tier gap >= 2 and NOT same zone, the boost was applied - don't suppress
	if (tierGap >= 2 && !sameZone) return;

	let suppressionSignals = 0;
	let totalSuppression = 0;

	// Signal 1: Combined low scoring rate
	const homeAvgScored = homeTeam.stats?.avgGoalsScored ?? 1.2;
	const awayAvgScored = awayTeam.stats?.avgGoalsScored ?? 1.2;
	const combinedScoringRate = homeAvgScored + awayAvgScored;
	
	if (combinedScoringRate < LOW_SCORING_COMBINED_AVG_THRESHOLD) {
		suppressionSignals++;
		totalSuppression += LOW_SCORING_BASE_SUPPRESSION;
	}

	// Signal 2: H2H historically low scoring
	if (h2h?.hasSufficientData && h2h.goalLineOverPct) {
		const h2hOver25Pct = h2h.goalLineOverPct["2.5"] ?? 50;
		if (h2hOver25Pct < LOW_SCORING_H2H_OVER25_THRESHOLD) {
			suppressionSignals++;
			// Scale suppression by how far below threshold
			const h2hFactor = 1 - (h2hOver25Pct / LOW_SCORING_H2H_OVER25_THRESHOLD);
			totalSuppression += LOW_SCORING_BASE_SUPPRESSION * (1 + h2hFactor);
		}
	}

	// Signal 3: Both teams' DNA profile shows low scoring
	const homeOver25Pct = homeTeam.dna?.goalLineOverPct?.["2.5"] ?? 55;
	const awayOver25Pct = awayTeam.dna?.goalLineOverPct?.["2.5"] ?? 55;
	const avgOver25Pct = (homeOver25Pct + awayOver25Pct) / 2;
	
	if (avgOver25Pct < LOW_SCORING_DNA_OVER25_THRESHOLD) {
		suppressionSignals++;
		totalSuppression += LOW_SCORING_BASE_SUPPRESSION;
	}

	// Signal 4: Same-zone six-pointer (extra suppression for cagey matches)
	if (sameZone && context?.isSixPointer) {
		suppressionSignals++;
		totalSuppression += LOW_SCORING_SAME_ZONE_BOOST;
	}

	// Only apply if at least 2 signals agree (avoids over-suppression)
	if (suppressionSignals < 2) return;

	// Cap total suppression
	totalSuppression = Math.min(totalSuppression, LOW_SCORING_MAX_SUPPRESSION);

	// Apply suppression to global goals multiplier
	modifiers.globalGoalsMult *= 1 - totalSuppression;
}

function applyContextExpectation(
	modifiers: GoalDistributionModifiers,
	context?: MatchContext,
): void {
	if (!context) return;
	const adjustment = context.adjustments.goalExpectationAdjustment;
	if (!adjustment) return;

	const globalGoalsMult = 1 + (adjustment / 100) * 0.35;
	modifiers.globalGoalsMult *= globalGoalsMult;
}

function applyInjuryImpacts(
	modifiers: GoalDistributionModifiers,
	homeImpact?: InjuryImpactAssessment | null,
	awayImpact?: InjuryImpactAssessment | null,
	homeTeam?: TeamData,
	awayTeam?: TeamData,
): void {
	const homeTier = homeTeam?.mind?.tier ?? 3;
	const awayTier = awayTeam?.mind?.tier ?? 3;

	if (homeImpact) {
		// Home team injured: away team (awayTier) benefits from exploiting home's weakness
		const tierGapForAway = Math.max(0, homeTier - awayTier); // Positive if away is stronger
		applyInjuryImpact(modifiers, "home", homeImpact.adjustmentValue, tierGapForAway);
	}
	if (awayImpact) {
		// Away team injured: home team (homeTier) benefits from exploiting away's weakness
		const tierGapForHome = Math.max(0, awayTier - homeTier); // Positive if home is stronger
		applyInjuryImpact(modifiers, "away", awayImpact.adjustmentValue, tierGapForHome);
	}
}

/**
 * Apply injury impact to goal distribution modifiers
 * 
 * When a team is injured, their attack weakens (they score less) and their defense
 * weakens (they concede more). The defense weakness is amplified when the opponent
 * is a stronger team (higher tier gap).
 * 
 * Example: Inter (tier 1) vs Pisa (tier 3) with Pisa injured (adjustmentValue = -12)
 * - Pisa attack: 1 + (-12/100) * 0.35 = 0.958 (Pisa scores ~4% less)
 * - Pisa defense: 1 - (-12/100) * (0.25 + 2 * 0.15) = 1 + 0.066 = 1.066 (Pisa concedes ~7% more)
 * - The tier gap of 2 (3-1) adds extra 30% to Inter's exploitation of Pisa's weak defense
 * 
 * @param modifiers - Goal distribution modifiers to update
 * @param side - Which team is injured ('home' or 'away')
 * @param adjustmentValue - Negative value indicating injury severity
 * @param opponentTierAdvantage - How much stronger the opponent is (0-3)
 */
function applyInjuryImpact(
	modifiers: GoalDistributionModifiers,
	side: "home" | "away",
	adjustmentValue: number,
	opponentTierAdvantage: number = 0,
): void {
	if (adjustmentValue === 0) return;

	// Attack reduction: injured team scores less
	const attackMult = 1 + (adjustmentValue / 100) * INJURY_ATTACK_SCALE;

	// Defense penalty: injured team concedes more
	// Amplified when opponent is stronger (they will exploit the weakness)
	const defenseScaleWithTierBoost = INJURY_DEFENSE_SCALE + (opponentTierAdvantage * TIER_GAP_DEFENSE_BOOST);
	const defensePenalty = 1 - (adjustmentValue / 100) * defenseScaleWithTierBoost;

	if (side === "home") {
		modifiers.attackHomeMult *= attackMult;
		modifiers.defenseHomeMult *= defensePenalty;
	} else {
		modifiers.attackAwayMult *= attackMult;
		modifiers.defenseAwayMult *= defensePenalty;
	}
}

function applyBalanceShift(
	modifiers: GoalDistributionModifiers,
	homeTeam?: TeamData,
	awayTeam?: TeamData,
	h2h?: H2HData,
	context?: MatchContext,
): void {
	if (!homeTeam || !awayTeam) return;

	const formScore = calculateFormScore(homeTeam, awayTeam);
	const h2hScore = calculateH2HScore(h2h);
	const homeAdvantageScore = calculateHomeAdvantageScore(homeTeam, awayTeam);
	const motivationScore = calculateMotivationScore(homeTeam, awayTeam);
	const restScore = calculateRestScore(homeTeam, awayTeam);
	const positionScore = calculatePositionScore(homeTeam, awayTeam);
	const eloGap =
		homeTeam.elo && awayTeam.elo
			? homeTeam.elo.rating - awayTeam.elo.rating
			: 0;
	const eloConfidence =
		homeTeam.elo && awayTeam.elo
			? Math.min(homeTeam.elo.confidence, awayTeam.elo.confidence)
			: 0;

	// Calculate tier gap for dynamic balance shift
	const homeTier = homeTeam.mind?.tier ?? 3;
	const awayTier = awayTeam.mind?.tier ?? 3;
	const tierGap = Math.abs(homeTier - awayTier);

	// Check if both teams are in the same competitive zone
	// When they are (e.g., both relegation battle), tier differences matter less
	const sameZone = areInSameZone(context?.homeStakes, context?.awayStakes);

	// Determine max balance shift based on context
	let maxBalanceShift: number;
	if (sameZone) {
		// Same zone: use reduced balance shift regardless of tier gap
		// This makes outcomes more unpredictable (desperation equalizes)
		maxBalanceShift = SAME_ZONE_BALANCE_SHIFT;
	} else if (UNCAPPED_MODE.enabled && tierGap >= 2) {
		// Large tier gap with different objectives: use larger shift
		// Example: PSG (tier 1, title race) vs Auxerre (tier 4, relegation) = gap of 3
		maxBalanceShift = LARGE_GAP_MAX_BALANCE_SHIFT;
	} else {
		maxBalanceShift = BASE_MAX_BALANCE_SHIFT;
	}

	// Weighted home advantage signal (-100..100-ish)
	const weightSum = Object.values(DEFAULT_MATCH_RESULT_WEIGHTS).reduce(
		(sum, w) => sum + w,
		0,
	);
	
	// When in same zone, also dampen the position score's contribution
	// Position/tier matters less when both teams are equally desperate
	const positionWeight = sameZone
		? DEFAULT_MATCH_RESULT_WEIGHTS.leaguePosition * 0.5 // 50% reduction
		: DEFAULT_MATCH_RESULT_WEIGHTS.leaguePosition;

	const weightedScore =
		formScore * DEFAULT_MATCH_RESULT_WEIGHTS.recentForm +
		h2hScore * DEFAULT_MATCH_RESULT_WEIGHTS.h2h +
		homeAdvantageScore * DEFAULT_MATCH_RESULT_WEIGHTS.homeAdvantage +
		motivationScore * DEFAULT_MATCH_RESULT_WEIGHTS.motivation +
		restScore * DEFAULT_MATCH_RESULT_WEIGHTS.rest +
		positionScore * positionWeight;

	// Recalculate weight sum if position weight changed
	const effectiveWeightSum = sameZone
		? weightSum - DEFAULT_MATCH_RESULT_WEIGHTS.leaguePosition + positionWeight
		: weightSum;

	// Convert to balance shift without changing total goals
	const normalized = clamp(weightedScore / (effectiveWeightSum * 100), -1, 1);
	const balanceShift = clamp(
		normalized * maxBalanceShift,
		-maxBalanceShift,
		maxBalanceShift,
	);
	
	// Also dampen ELO shift when in same zone
	const effectiveEloMaxShift = sameZone ? maxBalanceShift * 0.7 : maxBalanceShift;
	const eloShift = calculateEloBalanceShift(
		eloGap,
		eloConfidence,
		effectiveEloMaxShift,
	);

	modifiers.attackHomeMult *= 1 + balanceShift + eloShift;
	modifiers.attackAwayMult *= 1 - balanceShift - eloShift;
}

function applyLeagueScoringProfile(
	modifiers: GoalDistributionModifiers,
	leagueStats?: { avgGoals: number; matches: number },
): void {
	if (!leagueStats || leagueStats.matches <= 0) return;

	const ratio = clamp(leagueStats.avgGoals / BASE_LEAGUE_AVG_GOALS, 0.8, 1.2);
	const shift = clamp(
		(ratio - 1) * 0.5,
		-LEAGUE_GOALS_MAX_SHIFT,
		LEAGUE_GOALS_MAX_SHIFT,
	);
	modifiers.globalGoalsMult *= 1 + shift;
}

function clampModifiers(
	modifiers: GoalDistributionModifiers,
): GoalDistributionModifiers {
	return {
		attackHomeMult: clamp(
			modifiers.attackHomeMult,
			MIN_MULTIPLIER,
			MAX_MULTIPLIER,
		),
		defenseHomeMult: clamp(
			modifiers.defenseHomeMult,
			MIN_MULTIPLIER,
			MAX_MULTIPLIER,
		),
		attackAwayMult: clamp(
			modifiers.attackAwayMult,
			MIN_MULTIPLIER,
			MAX_MULTIPLIER,
		),
		defenseAwayMult: clamp(
			modifiers.defenseAwayMult,
			MIN_MULTIPLIER,
			MAX_MULTIPLIER,
		),
		globalGoalsMult: clamp(
			modifiers.globalGoalsMult,
			MIN_MULTIPLIER,
			MAX_MULTIPLIER,
		),
	};
}

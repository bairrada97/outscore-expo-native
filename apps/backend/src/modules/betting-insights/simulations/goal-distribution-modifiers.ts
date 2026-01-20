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
import { calculateEloBalanceShift } from "../../elo";

export interface GoalDistributionModifiers {
	attackHomeMult: number;
	defenseHomeMult: number;
	attackAwayMult: number;
	defenseAwayMult: number;
	globalGoalsMult: number;
}

const DEFAULT_MODIFIERS: GoalDistributionModifiers = {
	attackHomeMult: 1,
	defenseHomeMult: 1,
	attackAwayMult: 1,
	defenseAwayMult: 1,
	globalGoalsMult: 1,
};

const MIN_MULTIPLIER = 0.85;
const MAX_MULTIPLIER = 1.15;
const MAX_BALANCE_SHIFT = 0.08; // max +/-8% shift in scoring balance
const BASE_LEAGUE_AVG_GOALS = 2.6;
const LEAGUE_GOALS_MAX_SHIFT = 0.1;

const MATCH_RESULT_WEIGHTS = {
	recentForm: 0.3,
	h2h: 0.25,
	homeAdvantage: 0.2,
	motivation: 0.18,
	rest: 0.12,
	leaguePosition: 0.1,
} as const;

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
	);
	applyBalanceShift(modifiers, params.homeTeam, params.awayTeam, params.h2h);
	applyLeagueScoringProfile(modifiers, params.leagueStats);

	return clampModifiers(modifiers);
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
): void {
	if (homeImpact) {
		applyInjuryImpact(modifiers, "home", homeImpact.adjustmentValue);
	}
	if (awayImpact) {
		applyInjuryImpact(modifiers, "away", awayImpact.adjustmentValue);
	}
}

function applyInjuryImpact(
	modifiers: GoalDistributionModifiers,
	side: "home" | "away",
	adjustmentValue: number,
): void {
	if (adjustmentValue === 0) return;

	const attackMult = 1 + (adjustmentValue / 100) * 0.25;
	// Negative adjustment means weaker (more goals conceded), positive means stronger.
	const defensePenalty = 1 - (adjustmentValue / 100) * 0.2;

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
): void {
	if (!homeTeam || !awayTeam) return;

	const formScore = calculateFormScore(homeTeam, awayTeam);
	const h2hScore = calculateH2HScore(h2h);
	const homeAdvantageScore = calculateHomeAdvantageScore(homeTeam, awayTeam);
	const motivationScore = calculateMotivationScore(homeTeam, awayTeam);
	const restScore = calculateRestScore(homeTeam, awayTeam);
	const positionScore = calculatePositionScore(homeTeam, awayTeam);
	const eloGap = homeTeam.elo && awayTeam.elo
		? homeTeam.elo.rating - awayTeam.elo.rating
		: 0;
	const eloConfidence = homeTeam.elo && awayTeam.elo
		? Math.min(homeTeam.elo.confidence, awayTeam.elo.confidence)
		: 0;

	// Weighted home advantage signal (-100..100-ish)
	const weightSum = Object.values(MATCH_RESULT_WEIGHTS).reduce(
		(sum, w) => sum + w,
		0,
	);
	const weightedScore =
		formScore * MATCH_RESULT_WEIGHTS.recentForm +
		h2hScore * MATCH_RESULT_WEIGHTS.h2h +
		homeAdvantageScore * MATCH_RESULT_WEIGHTS.homeAdvantage +
		motivationScore * MATCH_RESULT_WEIGHTS.motivation +
		restScore * MATCH_RESULT_WEIGHTS.rest +
		positionScore * MATCH_RESULT_WEIGHTS.leaguePosition;

	// Convert to small balance shift without changing total goals
	const normalized = clamp(weightedScore / (weightSum * 100), -1, 1);
	const balanceShift = clamp(
		normalized * MAX_BALANCE_SHIFT,
		-MAX_BALANCE_SHIFT,
		MAX_BALANCE_SHIFT,
	);
	const eloShift = calculateEloBalanceShift(
		eloGap,
		eloConfidence,
		MAX_BALANCE_SHIFT,
	);

	modifiers.attackHomeMult *= 1 + balanceShift + eloShift;
	modifiers.attackAwayMult *= 1 - balanceShift - eloShift;
}

function applyLeagueScoringProfile(
	modifiers: GoalDistributionModifiers,
	leagueStats?: { avgGoals: number; matches: number },
): void {
	if (!leagueStats || leagueStats.matches <= 0) return;

	const ratio = clamp(
		leagueStats.avgGoals / BASE_LEAGUE_AVG_GOALS,
		0.8,
		1.2,
	);
	const shift = clamp((ratio - 1) * 0.5, -LEAGUE_GOALS_MAX_SHIFT, LEAGUE_GOALS_MAX_SHIFT);
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

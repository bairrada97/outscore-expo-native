import type { MatchContext } from "../match-context/context-adjustments";
import type { TeamData } from "../types";
import { calculateFormScore } from "../utils/form-score";
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

export function buildGoalDistributionModifiers(params: {
	context?: MatchContext;
	homeTeam?: TeamData;
	awayTeam?: TeamData;
	homeInjuryImpact?: InjuryImpactAssessment | null;
	awayInjuryImpact?: InjuryImpactAssessment | null;
}): GoalDistributionModifiers {
	const modifiers: GoalDistributionModifiers = { ...DEFAULT_MODIFIERS };

	applyContextExpectation(modifiers, params.context);
	applyInjuryImpacts(
		modifiers,
		params.homeInjuryImpact,
		params.awayInjuryImpact,
	);
	applyBalanceShift(modifiers, params.homeTeam, params.awayTeam);

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
	const defensePenalty = 1 + (Math.abs(adjustmentValue) / 100) * 0.2;

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
): void {
	if (!homeTeam || !awayTeam) return;

	const formScore = calculateFormScore(homeTeam, awayTeam);
	const homeAdvantageScore = calculateHomeAdvantageScore(homeTeam, awayTeam);
	const motivationScore = calculateMotivationScore(homeTeam, awayTeam);
	const restScore = calculateRestScore(homeTeam, awayTeam);
	const positionScore = calculatePositionScore(homeTeam, awayTeam);

	// Weighted home advantage signal (-100..100-ish)
	const weightedScore =
		formScore * 0.3 +
		homeAdvantageScore * 0.2 +
		motivationScore * 0.18 +
		restScore * 0.12 +
		positionScore * 0.1;

	// Convert to small balance shift without changing total goals
	const normalized = clamp(weightedScore / 100, -1, 1);
	const balanceShift = clamp(
		normalized * MAX_BALANCE_SHIFT,
		-MAX_BALANCE_SHIFT,
		MAX_BALANCE_SHIFT,
	);

	modifiers.attackHomeMult *= 1 + balanceShift;
	modifiers.attackAwayMult *= 1 - balanceShift;
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

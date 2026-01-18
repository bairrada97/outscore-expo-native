import type { GoalDistributionConfig, GoalLine, TeamData } from "../types";
import { DEFAULT_GOAL_LINES } from "../types";
import { clamp } from "../utils/helpers";
import type { GoalDistributionModifiers } from "./goal-distribution-modifiers";

type ScoreMatrix = number[][];

type GoalDistributionResult = {
	lambdaHome: number;
	lambdaAway: number;
	scoreMatrix: ScoreMatrix;
	probHomeWin: number;
	probDraw: number;
	probAwayWin: number;
	probBTTSYes: number;
	probOverByLine: Record<string, number>;
};

const DEFAULT_LAMBDA = 1.2;
const XG_BLEND_WEIGHT = 0.7;
const GOALS_BLEND_WEIGHT = 0.3;
const MIN_LAMBDA = 0.2;
const MAX_LAMBDA = 4.5;

function clampLambda(value: number): number {
	return clamp(value, MIN_LAMBDA, MAX_LAMBDA);
}

function getRecentMatches(team: TeamData, limit: number) {
	const combined = [
		...(team.lastHomeMatches ?? []),
		...(team.lastAwayMatches ?? []),
	].filter((match) => Number.isFinite(match.goalsScored));
	combined.sort(
		(a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
	);
	return combined.slice(0, limit);
}

function getRecentAverages(team: TeamData, limit: number) {
	const matches = getRecentMatches(team, limit);
	if (matches.length === 0) {
		return {
			scored: team.stats?.avgGoalsScored ?? DEFAULT_LAMBDA,
			conceded: team.stats?.avgGoalsConceded ?? DEFAULT_LAMBDA,
		};
	}

	const totals = matches.reduce(
		(acc, match) => {
			acc.scored += match.goalsScored ?? 0;
			acc.conceded += match.goalsConceded ?? 0;
			return acc;
		},
		{ scored: 0, conceded: 0 },
	);

	return {
		scored: totals.scored / matches.length,
		conceded: totals.conceded / matches.length,
	};
}

function getRecentXGAverages(team: TeamData, limit: number) {
	const matches = getRecentMatches(team, limit).filter(
		(match) => typeof match.expectedGoals === "number",
	);
	if (matches.length < 3) return null;

	const totals = matches.reduce(
		(acc, match) => {
			acc.xgFor += match.expectedGoals ?? 0;
			acc.xgAgainst += (match.goalsConceded ?? 0) + (match.goalsPrevented ?? 0);
			return acc;
		},
		{ xgFor: 0, xgAgainst: 0 },
	);

	return {
		xgFor: totals.xgFor / matches.length,
		xgAgainst: totals.xgAgainst / matches.length,
	};
}

function getSeasonHomeScoring(team: TeamData): number {
	return (
		team.stats?.homeAvgScored ?? team.stats?.avgGoalsScored ?? DEFAULT_LAMBDA
	);
}

function getSeasonHomeConceded(team: TeamData): number {
	return (
		team.stats?.homeAvgConceded ??
		team.stats?.avgGoalsConceded ??
		DEFAULT_LAMBDA
	);
}

function getSeasonAwayScoring(team: TeamData): number {
	return (
		team.stats?.awayAvgScored ?? team.stats?.avgGoalsScored ?? DEFAULT_LAMBDA
	);
}

function getSeasonAwayConceded(team: TeamData): number {
	return (
		team.stats?.awayAvgConceded ??
		team.stats?.avgGoalsConceded ??
		DEFAULT_LAMBDA
	);
}

function buildScoreMatrix(
	lambdaHome: number,
	lambdaAway: number,
	config: GoalDistributionConfig,
): ScoreMatrix {
	const maxGoals = config.maxGoals;
	const matrix: ScoreMatrix = Array.from({ length: maxGoals + 1 }, () =>
		Array.from({ length: maxGoals + 1 }, () => 0),
	);

	const homeProbs = poissonProbabilities(lambdaHome, maxGoals);
	const awayProbs = poissonProbabilities(lambdaAway, maxGoals);

	for (let i = 0; i <= maxGoals; i += 1) {
		for (let j = 0; j <= maxGoals; j += 1) {
			matrix[i][j] = homeProbs[i] * awayProbs[j];
		}
	}

	return applyDixonColes(matrix, lambdaHome, lambdaAway, config.dixonColesRho);
}

function poissonProbabilities(lambda: number, maxGoals: number): number[] {
	const probs: number[] = [];
	let factorial = 1;
	const exp = Math.exp(-lambda);
	for (let k = 0; k <= maxGoals; k += 1) {
		if (k > 1) factorial *= k;
		else if (k === 1) factorial = 1;
		const value = (exp * lambda ** k) / (factorial || 1);
		probs.push(value);
	}
	return probs;
}

function applyDixonColes(
	matrix: ScoreMatrix,
	lambdaHome: number,
	lambdaAway: number,
	rho: number,
): ScoreMatrix {
	const adjusted = matrix.map((row) => [...row]);

	if (matrix.length < 2 || matrix[0].length < 2) return adjusted;

	const tau00 = 1 - lambdaHome * lambdaAway * rho;
	const tau10 = 1 + lambdaAway * rho;
	const tau01 = 1 + lambdaHome * rho;
	const tau11 = 1 - rho;

	adjusted[0][0] *= tau00;
	adjusted[1][0] *= tau10;
	adjusted[0][1] *= tau01;
	adjusted[1][1] *= tau11;

	const total = adjusted.reduce(
		(sum, row) => sum + row.reduce((acc, v) => acc + v, 0),
		0,
	);
	if (total > 0) {
		for (let i = 0; i < adjusted.length; i += 1) {
			for (let j = 0; j < adjusted[i].length; j += 1) {
				adjusted[i][j] /= total;
			}
		}
	}

	return adjusted;
}

function summarizeMatrix(matrix: ScoreMatrix) {
	let homeWin = 0;
	let draw = 0;
	let awayWin = 0;
	let bttsYes = 0;

	for (let h = 0; h < matrix.length; h += 1) {
		for (let a = 0; a < matrix[h].length; a += 1) {
			const p = matrix[h][a];
			if (h > a) homeWin += p;
			else if (h === a) draw += p;
			else awayWin += p;

			if (h > 0 && a > 0) bttsYes += p;
		}
	}

	return { homeWin, draw, awayWin, bttsYes };
}

function probabilityOver(matrix: ScoreMatrix, line: GoalLine): number {
	let total = 0;
	for (let h = 0; h < matrix.length; h += 1) {
		for (let a = 0; a < matrix[h].length; a += 1) {
			if (h + a > line) total += matrix[h][a];
		}
	}
	return total;
}

export function buildGoalDistribution(
	homeTeam: TeamData,
	awayTeam: TeamData,
	config: GoalDistributionConfig,
	modifiers?: GoalDistributionModifiers,
): GoalDistributionResult {
	const recentWeight = clamp(config.recentFormWeight, 0, 0.3);
	const appliedModifiers = normalizeModifiers(modifiers);

	const seasonHomeScored =
		getSeasonHomeScoring(homeTeam) * appliedModifiers.attackHomeMult;
	const seasonHomeConceded =
		getSeasonHomeConceded(homeTeam) * appliedModifiers.defenseHomeMult;
	const seasonAwayScored =
		getSeasonAwayScoring(awayTeam) * appliedModifiers.attackAwayMult;
	const seasonAwayConceded =
		getSeasonAwayConceded(awayTeam) * appliedModifiers.defenseAwayMult;

	const seasonLambdaHome = clampLambda(
		(seasonHomeScored + seasonAwayConceded) / 2,
	);
	const seasonLambdaAway = clampLambda(
		(seasonAwayScored + seasonHomeConceded) / 2,
	);

	const recentHome = getRecentAverages(homeTeam, config.recentMatchesCount);
	const recentAway = getRecentAverages(awayTeam, config.recentMatchesCount);
	const recentHomeXg = getRecentXGAverages(homeTeam, config.recentMatchesCount);
	const recentAwayXg = getRecentXGAverages(awayTeam, config.recentMatchesCount);

	const baseRecentHomeAttack = recentHomeXg
		? recentHomeXg.xgFor * XG_BLEND_WEIGHT +
			recentHome.scored * GOALS_BLEND_WEIGHT
		: recentHome.scored;
	const baseRecentHomeDefense = recentHomeXg
		? recentHomeXg.xgAgainst * XG_BLEND_WEIGHT +
			recentHome.conceded * GOALS_BLEND_WEIGHT
		: recentHome.conceded;
	const baseRecentAwayAttack = recentAwayXg
		? recentAwayXg.xgFor * XG_BLEND_WEIGHT +
			recentAway.scored * GOALS_BLEND_WEIGHT
		: recentAway.scored;
	const baseRecentAwayDefense = recentAwayXg
		? recentAwayXg.xgAgainst * XG_BLEND_WEIGHT +
			recentAway.conceded * GOALS_BLEND_WEIGHT
		: recentAway.conceded;

	const recentHomeAttack =
		baseRecentHomeAttack * appliedModifiers.attackHomeMult;
	const recentHomeDefense =
		baseRecentHomeDefense * appliedModifiers.defenseHomeMult;
	const recentAwayAttack =
		baseRecentAwayAttack * appliedModifiers.attackAwayMult;
	const recentAwayDefense =
		baseRecentAwayDefense * appliedModifiers.defenseAwayMult;

	const recentLambdaHome = clampLambda(
		(recentHomeAttack + recentAwayDefense) / 2,
	);
	const recentLambdaAway = clampLambda(
		(recentAwayAttack + recentHomeDefense) / 2,
	);

	const blendedHome =
		seasonLambdaHome * (1 - recentWeight) + recentLambdaHome * recentWeight;
	const blendedAway =
		seasonLambdaAway * (1 - recentWeight) + recentLambdaAway * recentWeight;

	const lambdaHome = clampLambda(
		blendedHome * appliedModifiers.globalGoalsMult,
	);
	const lambdaAway = clampLambda(
		blendedAway * appliedModifiers.globalGoalsMult,
	);

	const scoreMatrix = buildScoreMatrix(lambdaHome, lambdaAway, config);
	const summary = summarizeMatrix(scoreMatrix);

	const probOverByLine: Record<string, number> = {};
	for (const line of DEFAULT_GOAL_LINES) {
		probOverByLine[String(line)] = probabilityOver(scoreMatrix, line) * 100;
	}

	return {
		lambdaHome,
		lambdaAway,
		scoreMatrix,
		probHomeWin: summary.homeWin * 100,
		probDraw: summary.draw * 100,
		probAwayWin: summary.awayWin * 100,
		probBTTSYes: summary.bttsYes * 100,
		probOverByLine,
	};
}

function normalizeModifiers(
	modifiers?: GoalDistributionModifiers,
): GoalDistributionModifiers {
	return {
		attackHomeMult: modifiers?.attackHomeMult ?? 1,
		defenseHomeMult: modifiers?.defenseHomeMult ?? 1,
		attackAwayMult: modifiers?.attackAwayMult ?? 1,
		defenseAwayMult: modifiers?.defenseAwayMult ?? 1,
		globalGoalsMult: modifiers?.globalGoalsMult ?? 1,
	};
}

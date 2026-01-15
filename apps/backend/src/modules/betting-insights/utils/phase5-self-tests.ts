/**
 * Phase 5 Self Tests (No external test runner required)
 *
 * Lightweight sanity checks for route-shape assumptions and
 * OVER_UNDER_GOALS multi-line invariants.
 *
 * You can call `runBettingInsightsPhase5SelfTests()` in a dev-only context.
 */

import type { MatchContext } from "../match-context/context-adjustments";
import { simulateTotalGoalsOverUnder } from "../simulations/simulate-total-goals-over-under";
import type { H2HData, TeamData } from "../types";
import { DEFAULT_GOAL_LINES } from "../types";

function assert(condition: unknown, message: string): void {
	if (!condition) {
		throw new Error(`Phase5SelfTest failed: ${message}`);
	}
}

function makeTeam(name: string): TeamData {
	return {
		id: 1,
		name,
		stats: {
			form: "WWWWW",
			leaguePosition: 10,
			avgGoalsScored: 1.5,
			avgGoalsConceded: 1.2,
			homeAvgScored: 1.6,
			homeAvgConceded: 1.1,
			awayAvgScored: 1.3,
			awayAvgConceded: 1.3,
			pointsFromCL: 10,
			pointsFromRelegation: 10,
			pointsFromFirst: 10,
			gamesPlayed: 10,
		},
		mind: {
			tier: 3,
			efficiencyIndex: 1.2,
			avgPointsPerGame: 1.2,
			goalDifference: 0,
			matchCount: 30,
			hasSufficientData: true,
		},
		mood: {
			tier: 2,
			formString: "WWWWW",
			mindMoodGap: 1,
			isSleepingGiant: false,
			isOverPerformer: false,
			isOneSeasonWonder: false,
			last10Points: 18,
			last10GoalsScored: 14,
			last10GoalsConceded: 10,
		},
		dna: {
			mostPlayedFormation: "4-3-3",
			formationFrequency: { "4-3-3": 100 },
			goalLineOverPct: {
				"0.5": 90,
				"1.5": 70,
				"2.5": 50,
				"3.5": 30,
				"4.5": 15,
				"5.5": 8,
			},
			cleanSheetPercentage: 20,
			failedToScorePercentage: 15,
			bttsYesRate: 55,
			goalMinutesScoring: {
				"0-15": 16,
				"16-30": 16,
				"31-45": 18,
				"46-60": 16,
				"61-75": 17,
				"76-90": 17,
			},
			goalMinutesConceding: {
				"0-15": 14,
				"16-30": 15,
				"31-45": 18,
				"46-60": 16,
				"61-75": 18,
				"76-90": 19,
			},
			isLateStarter: false,
			dangerZones: [],
			firstHalfGoalPercentage: 45,
			avgGoalsPerGame: 2.7,
			avgGoalsConcededPerGame: 1.2,
		},
		safetyFlags: {
			regressionRisk: false,
			motivationClash: false,
			liveDog: false,
			motivation: "MID_TABLE",
			consecutiveWins: 0,
		},
		daysSinceLastMatch: 7,
		lastHomeMatches: [],
		lastAwayMatches: [],
		seasonsInLeague: 1,
	};
}

function makeH2H(): H2HData {
	return {
		matches: [],
		h2hMatchCount: 0,
		homeTeamWins: 0,
		awayTeamWins: 0,
		draws: 0,
		bttsCount: 0,
		bttsPercentage: 0,
		goalLineOverCount: {},
		goalLineOverPct: {},
		avgGoals: 0,
		avgHomeGoals: 0,
		avgAwayGoals: 0,
		recencyWeights: [],
		hasSufficientData: false,
	};
}

function makeContext(): MatchContext {
	return {
		matchType: {
			type: "LEAGUE",
			importance: "MEDIUM",
			isKnockout: false,
			isDerby: false,
			isNeutralVenue: false,
			isEndOfSeason: false,
			isPostInternationalBreak: false,
		},
		derby: { isDerby: false, derbyType: "NONE", intensity: "LOW" },
		isEarlySeason: false,
		isEndOfSeason: false,
		isPostInternationalBreak: false,
		adjustments: {
			recentForm: 1,
			h2h: 1,
			homeAdvantage: 1,
			motivation: 1,
			goalScoring: 1,
			confidenceReduction: 0,
			goalExpectationAdjustment: 0,
		},
	};
}

export function runBettingInsightsPhase5SelfTests(): void {
	const home = makeTeam("Home");
	const away = makeTeam("Away");
	const h2h = makeH2H();
	const ctx = makeContext();

	const overs: number[] = [];
	for (const line of DEFAULT_GOAL_LINES) {
		const sim = simulateTotalGoalsOverUnder(home, away, h2h, ctx, line);
		assert(
			sim.scenarioType === "TotalGoalsOverUnder",
			"scenarioType should be TotalGoalsOverUnder",
		);
		assert(sim.line === line, "simulation line should match requested line");
		assert(
			typeof sim.probabilityDistribution.over === "number" &&
				typeof sim.probabilityDistribution.under === "number",
			"over/under probabilities must exist",
		);
		const over = sim.probabilityDistribution.over;
		assert(typeof over === "number", "over probability should exist");
		overs.push(over as number);
	}

	// Monotonic sanity: higher lines shouldn't have higher Over probability
	for (let i = 1; i < overs.length; i++) {
		const current = overs[i];
		const previous = overs[i - 1];
		assert(typeof current === "number" && typeof previous === "number", "overs must be numbers");
		assert(
			current <= previous + 1e-9,
			`Over probability should be non-increasing with line (line ${DEFAULT_GOAL_LINES[i]})`,
		);
	}
}

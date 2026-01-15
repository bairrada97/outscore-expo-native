/**
 * Tests for motivation-score.ts
 *
 * Motivation level comparison between teams.
 */

import { describe, expect, it } from "vitest";
import type { MotivationLevel, TeamData } from "../types";
import {
	calculateMotivationScore,
	getMotivationDescription,
	getMotivationValue,
	hasMotivationClash,
} from "./motivation-score";

// Helper to create minimal team data for testing
function createTeamData(
	motivation: MotivationLevel = "MID_TABLE",
	overrides: Partial<TeamData> = {},
): TeamData {
	return {
		id: 1,
		name: "Test Team",
		stats: {
			form: "WWDLW",
			leaguePosition: 10,
			avgGoalsScored: 1.5,
			avgGoalsConceded: 1.2,
			homeAvgScored: 1.8,
			homeAvgConceded: 1.0,
			awayAvgScored: 1.2,
			awayAvgConceded: 1.4,
			pointsFromCL: 15,
			pointsFromRelegation: 20,
			pointsFromFirst: 25,
			gamesPlayed: 20,
		},
		mind: {
			tier: 2,
			efficiencyIndex: 1.8,
			avgPointsPerGame: 1.7,
			goalDifference: 8,
			matchCount: 50,
			hasSufficientData: true,
		},
		mood: {
			tier: 2,
			mindMoodGap: 0,
			isSleepingGiant: false,
			isOverPerformer: false,
			isOneSeasonWonder: false,
			formString: "WWDLW",
			last10Points: 16,
			last10GoalsScored: 15,
			last10GoalsConceded: 10,
		},
		dna: {
			mostPlayedFormation: "4-3-3",
			formationFrequency: { "4-3-3": 60, "4-4-2": 40 },
			goalLineOverPct: {},
			cleanSheetPercentage: 25,
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
			firstHalfGoalPercentage: 50,
			avgGoalsPerGame: 1.5,
			avgGoalsConcededPerGame: 1.2,
		},
		safetyFlags: {
			regressionRisk: false,
			motivationClash: false,
			liveDog: false,
			motivation,
			consecutiveWins: 2,
		},
		daysSinceLastMatch: 5,
		lastHomeMatches: [],
		lastAwayMatches: [],
		seasonsInLeague: 5,
		...overrides,
	};
}

describe("getMotivationValue", () => {
	it("should return 5 for TITLE_RACE", () => {
		const team = createTeamData("TITLE_RACE");
		expect(getMotivationValue(team)).toBe(5);
	});

	it("should return 4 for RELEGATION_BATTLE", () => {
		const team = createTeamData("RELEGATION_BATTLE");
		expect(getMotivationValue(team)).toBe(4);
	});

	it("should return 3 for CL_RACE", () => {
		const team = createTeamData("CL_RACE");
		expect(getMotivationValue(team)).toBe(3);
	});

	it("should return 2 for EUROPA_RACE", () => {
		const team = createTeamData("EUROPA_RACE");
		expect(getMotivationValue(team)).toBe(2);
	});

	it("should return 1 for MID_TABLE", () => {
		const team = createTeamData("MID_TABLE");
		expect(getMotivationValue(team)).toBe(1);
	});

	it("should return 0 for SECURE", () => {
		const team = createTeamData("SECURE");
		expect(getMotivationValue(team)).toBe(0);
	});

	it("should default to 1 (MID_TABLE) for missing safetyFlags", () => {
		const team = createTeamData("MID_TABLE", { safetyFlags: undefined as any });
		expect(getMotivationValue(team)).toBe(1);
	});
});

describe("calculateMotivationScore", () => {
	it("should return positive score when home team is more motivated", () => {
		const homeTeam = createTeamData("TITLE_RACE");
		const awayTeam = createTeamData("MID_TABLE");

		const score = calculateMotivationScore(homeTeam, awayTeam);
		expect(score).toBeGreaterThan(0);
	});

	it("should return negative score when away team is more motivated", () => {
		const homeTeam = createTeamData("SECURE");
		const awayTeam = createTeamData("RELEGATION_BATTLE");

		const score = calculateMotivationScore(homeTeam, awayTeam);
		expect(score).toBeLessThan(0);
	});

	it("should return 0 when both teams have same motivation", () => {
		const homeTeam = createTeamData("CL_RACE");
		const awayTeam = createTeamData("CL_RACE");

		const score = calculateMotivationScore(homeTeam, awayTeam);
		expect(score).toBe(0);
	});

	it("should return +100 for maximum home advantage (TITLE_RACE vs SECURE)", () => {
		const homeTeam = createTeamData("TITLE_RACE");
		const awayTeam = createTeamData("SECURE");

		const score = calculateMotivationScore(homeTeam, awayTeam);
		expect(score).toBe(100); // (5 - 0) * 25 = 125, clamped to 100
	});

	it("should return -100 for maximum away advantage (SECURE vs TITLE_RACE)", () => {
		const homeTeam = createTeamData("SECURE");
		const awayTeam = createTeamData("TITLE_RACE");

		const score = calculateMotivationScore(homeTeam, awayTeam);
		expect(score).toBe(-100); // (0 - 5) * 25 = -125, clamped to -100
	});

	it("should be clamped between -100 and 100", () => {
		const homeTeam = createTeamData("TITLE_RACE");
		const awayTeam = createTeamData("SECURE");

		const score = calculateMotivationScore(homeTeam, awayTeam);
		expect(score).toBeLessThanOrEqual(100);
		expect(score).toBeGreaterThanOrEqual(-100);
	});

	it("should calculate correct intermediate values", () => {
		const homeTeam = createTeamData("CL_RACE"); // Value 3
		const awayTeam = createTeamData("MID_TABLE"); // Value 1

		const score = calculateMotivationScore(homeTeam, awayTeam);
		expect(score).toBe(50); // (3 - 1) * 25 = 50
	});
});

describe("hasMotivationClash", () => {
	it("should return true when motivation levels differ by 3+", () => {
		const homeTeam = createTeamData("TITLE_RACE"); // Value 5
		const awayTeam = createTeamData("EUROPA_RACE"); // Value 2

		expect(hasMotivationClash(homeTeam, awayTeam)).toBe(true);
	});

	it("should return true for TITLE_RACE vs MID_TABLE", () => {
		const homeTeam = createTeamData("TITLE_RACE"); // Value 5
		const awayTeam = createTeamData("MID_TABLE"); // Value 1

		expect(hasMotivationClash(homeTeam, awayTeam)).toBe(true);
	});

	it("should return false when motivation levels are close", () => {
		const homeTeam = createTeamData("CL_RACE"); // Value 3
		const awayTeam = createTeamData("EUROPA_RACE"); // Value 2

		expect(hasMotivationClash(homeTeam, awayTeam)).toBe(false);
	});

	it("should return false for same motivation", () => {
		const homeTeam = createTeamData("MID_TABLE");
		const awayTeam = createTeamData("MID_TABLE");

		expect(hasMotivationClash(homeTeam, awayTeam)).toBe(false);
	});

	it("should work regardless of which team is more motivated", () => {
		const titleTeam = createTeamData("TITLE_RACE");
		const secureTeam = createTeamData("SECURE");

		// Both orderings should return true
		expect(hasMotivationClash(titleTeam, secureTeam)).toBe(true);
		expect(hasMotivationClash(secureTeam, titleTeam)).toBe(true);
	});
});

describe("getMotivationDescription", () => {
	it("should return correct description for TITLE_RACE", () => {
		expect(getMotivationDescription("TITLE_RACE")).toBe("Fighting for the title");
	});

	it("should return correct description for RELEGATION_BATTLE", () => {
		expect(getMotivationDescription("RELEGATION_BATTLE")).toBe("Battling relegation");
	});

	it("should return correct description for CL_RACE", () => {
		expect(getMotivationDescription("CL_RACE")).toBe("Chasing Champions League");
	});

	it("should return correct description for EUROPA_RACE", () => {
		expect(getMotivationDescription("EUROPA_RACE")).toBe("Pursuing Europa League");
	});

	it("should return correct description for MID_TABLE", () => {
		expect(getMotivationDescription("MID_TABLE")).toBe("Mid-table, nothing to play for");
	});

	it("should return correct description for SECURE", () => {
		expect(getMotivationDescription("SECURE")).toBe("Season objectives complete");
	});
});

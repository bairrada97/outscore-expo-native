/**
 * Tests for rest-score.ts
 *
 * Rest advantage calculation based on days since last match.
 */

import { describe, expect, it } from "vitest";
import type { TeamData } from "../types";
import {
	calculateRestQuality,
	calculateRestScore,
	getRestDescription,
	hasFatigueRisk,
	hasRustinessRisk,
} from "./rest-score";

// Helper to create minimal team data for testing
function createTeamData(daysSinceLastMatch: number): TeamData {
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
			motivation: "MID_TABLE",
			consecutiveWins: 2,
		},
		daysSinceLastMatch,
		lastHomeMatches: [],
		lastAwayMatches: [],
		seasonsInLeague: 5,
	};
}

describe("calculateRestQuality", () => {
	it("should return 5 (OPTIMAL) for 4-7 days rest", () => {
		expect(calculateRestQuality(4)).toBe(5);
		expect(calculateRestQuality(5)).toBe(5);
		expect(calculateRestQuality(6)).toBe(5);
		expect(calculateRestQuality(7)).toBe(5);
	});

	it("should return 4 (SLIGHTLY_LONG) for 8-9 days rest", () => {
		expect(calculateRestQuality(8)).toBe(4);
		expect(calculateRestQuality(9)).toBe(4);
	});

	it("should return 3 (SLIGHTLY_SHORT) for 3 days rest", () => {
		expect(calculateRestQuality(3)).toBe(3);
	});

	it("should return 2 (RUSTY) for >10 days rest", () => {
		expect(calculateRestQuality(11)).toBe(2);
		expect(calculateRestQuality(14)).toBe(2);
		expect(calculateRestQuality(21)).toBe(2);
	});

	it("should return 1 (FATIGUED) for <3 days rest", () => {
		expect(calculateRestQuality(0)).toBe(1);
		expect(calculateRestQuality(1)).toBe(1);
		expect(calculateRestQuality(2)).toBe(1);
	});

	it("should handle exactly 10 days", () => {
		// 10 days is slightly long (not rusty until >10)
		const quality = calculateRestQuality(10);
		expect(quality).toBe(4);
	});
});

describe("calculateRestScore", () => {
	it("should return positive score when home team has better rest", () => {
		const homeTeam = createTeamData(5); // Optimal rest
		const awayTeam = createTeamData(2); // Fatigued

		const score = calculateRestScore(homeTeam, awayTeam);
		expect(score).toBeGreaterThan(0);
	});

	it("should return negative score when away team has better rest", () => {
		const homeTeam = createTeamData(1); // Fatigued
		const awayTeam = createTeamData(6); // Optimal rest

		const score = calculateRestScore(homeTeam, awayTeam);
		expect(score).toBeLessThan(0);
	});

	it("should return 0 when both teams have same rest quality", () => {
		const homeTeam = createTeamData(5); // Optimal
		const awayTeam = createTeamData(6); // Also optimal

		const score = calculateRestScore(homeTeam, awayTeam);
		expect(score).toBe(0);
	});

	it("should calculate correct score for optimal vs fatigued", () => {
		const homeTeam = createTeamData(5); // Quality 5 (optimal)
		const awayTeam = createTeamData(2); // Quality 1 (fatigued)

		const score = calculateRestScore(homeTeam, awayTeam);
		expect(score).toBe(80); // (5 - 1) * 20 = 80
	});

	it("should be clamped between -100 and 100", () => {
		const homeTeam = createTeamData(5);
		const awayTeam = createTeamData(1);

		const score = calculateRestScore(homeTeam, awayTeam);
		expect(score).toBeLessThanOrEqual(100);
		expect(score).toBeGreaterThanOrEqual(-100);
	});

	it("should use default of 7 days when daysSinceLastMatch is missing", () => {
		const homeTeam = createTeamData(7);
		homeTeam.daysSinceLastMatch = undefined as any;
		const awayTeam = createTeamData(7);

		const score = calculateRestScore(homeTeam, awayTeam);
		expect(score).toBe(0); // Both default to 7 (optimal)
	});
});

describe("hasFatigueRisk", () => {
	it("should return true when days < 3", () => {
		expect(hasFatigueRisk(createTeamData(0))).toBe(true);
		expect(hasFatigueRisk(createTeamData(1))).toBe(true);
		expect(hasFatigueRisk(createTeamData(2))).toBe(true);
	});

	it("should return false when days >= 3", () => {
		expect(hasFatigueRisk(createTeamData(3))).toBe(false);
		expect(hasFatigueRisk(createTeamData(4))).toBe(false);
		expect(hasFatigueRisk(createTeamData(7))).toBe(false);
	});

	it("should use default of 7 when daysSinceLastMatch is missing", () => {
		const team = createTeamData(7);
		team.daysSinceLastMatch = undefined as any;
		expect(hasFatigueRisk(team)).toBe(false);
	});
});

describe("hasRustinessRisk", () => {
	it("should return true when days > 10", () => {
		expect(hasRustinessRisk(createTeamData(11))).toBe(true);
		expect(hasRustinessRisk(createTeamData(14))).toBe(true);
		expect(hasRustinessRisk(createTeamData(21))).toBe(true);
	});

	it("should return false when days <= 10", () => {
		expect(hasRustinessRisk(createTeamData(7))).toBe(false);
		expect(hasRustinessRisk(createTeamData(9))).toBe(false);
		expect(hasRustinessRisk(createTeamData(10))).toBe(false);
	});

	it("should use default of 7 when daysSinceLastMatch is missing", () => {
		const team = createTeamData(7);
		team.daysSinceLastMatch = undefined as any;
		expect(hasRustinessRisk(team)).toBe(false);
	});
});

describe("getRestDescription", () => {
	it("should return 'Fatigued (short turnaround)' for < 3 days", () => {
		expect(getRestDescription(0)).toBe("Fatigued (short turnaround)");
		expect(getRestDescription(1)).toBe("Fatigued (short turnaround)");
		expect(getRestDescription(2)).toBe("Fatigued (short turnaround)");
	});

	it("should return 'Slightly short rest' for 3 days", () => {
		expect(getRestDescription(3)).toBe("Slightly short rest");
	});

	it("should return 'Optimal rest' for 4-7 days", () => {
		expect(getRestDescription(4)).toBe("Optimal rest");
		expect(getRestDescription(5)).toBe("Optimal rest");
		expect(getRestDescription(6)).toBe("Optimal rest");
		expect(getRestDescription(7)).toBe("Optimal rest");
	});

	it("should return 'Slightly long rest' for 8-9 days", () => {
		expect(getRestDescription(8)).toBe("Slightly long rest");
		expect(getRestDescription(9)).toBe("Slightly long rest");
	});

	it("should return 'Rusty (long break)' for >= 10 days", () => {
		expect(getRestDescription(10)).toBe("Rusty (long break)");
		expect(getRestDescription(14)).toBe("Rusty (long break)");
		expect(getRestDescription(21)).toBe("Rusty (long break)");
	});
});

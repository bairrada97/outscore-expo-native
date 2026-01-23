/**
 * Tests for position-score.ts
 *
 * Position/quality score calculation based on Mind tier and Efficiency Index.
 */

import { describe, expect, it } from "vitest";
import type { TeamData, TeamTier } from "../types";
import {
	calculatePositionScore,
	determineFavorite,
	getTierDescription,
	hasSignificantQualityGap,
} from "./position-score";

// Helper to create minimal team data for testing
function createTeamData(
	tier: TeamTier = 2,
	efficiencyIndex: number = 1.0,
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
			tier,
			efficiencyIndex,
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
		daysSinceLastMatch: 5,
		lastHomeMatches: [],
		lastAwayMatches: [],
		seasonsInLeague: 5,
		...overrides,
	};
}

describe("calculatePositionScore", () => {
	it("should return positive score when home team has better tier", () => {
		const homeTeam = createTeamData(1, 1.5); // Elite
		const awayTeam = createTeamData(3, 1.0); // Average

		const score = calculatePositionScore(homeTeam, awayTeam);
		expect(score).toBeGreaterThan(0);
	});

	it("should return negative score when away team has better tier", () => {
		const homeTeam = createTeamData(4, 0.8); // Weak
		const awayTeam = createTeamData(1, 1.5); // Elite

		const score = calculatePositionScore(homeTeam, awayTeam);
		expect(score).toBeLessThan(0);
	});

	it("should return 0 when both teams have same tier and EI", () => {
		const homeTeam = createTeamData(2, 1.0);
		const awayTeam = createTeamData(2, 1.0);

		const score = calculatePositionScore(homeTeam, awayTeam);
		expect(score).toBe(0);
	});

	it("should factor in efficiency index for granularity", () => {
		// Same tier, but home has higher EI
		const homeTeam = createTeamData(2, 1.5);
		const awayTeam = createTeamData(2, 0.8);

		const score = calculatePositionScore(homeTeam, awayTeam);
		expect(score).toBeGreaterThan(0);
	});

	it("should give larger impact to tier difference than EI", () => {
		// Home: worse tier but better EI
		const homeTeam = createTeamData(3, 1.8);
		const awayTeam = createTeamData(2, 1.0);

		const score = calculatePositionScore(homeTeam, awayTeam);
		// Tier diff is -1 (30 points away), EI diff is 0.8 (16 points home)
		// Net should favor away team
		expect(score).toBeLessThan(0);
	});

	it("should be clamped between -100 and 100", () => {
		const eliteTeam = createTeamData(1, 2.5);
		const weakTeam = createTeamData(4, 0.5);

		const score1 = calculatePositionScore(eliteTeam, weakTeam);
		const score2 = calculatePositionScore(weakTeam, eliteTeam);

		expect(score1).toBeLessThanOrEqual(100);
		expect(score1).toBeGreaterThanOrEqual(-100);
		expect(score2).toBeLessThanOrEqual(100);
		expect(score2).toBeGreaterThanOrEqual(-100);
	});

	it("should use default tier 3 when mind is missing", () => {
		const homeTeam = createTeamData(2, 1.0);
		const awayTeam = createTeamData(3, 1.0, { mind: undefined });

		const score = calculatePositionScore(homeTeam, awayTeam);
		// Away defaults to tier 3, home is tier 2, so home is better
		expect(score).toBeGreaterThan(0);
	});

	it("should calculate correct score for tier 1 vs tier 4", () => {
		const homeTeam = createTeamData(1, 1.0);
		const awayTeam = createTeamData(4, 1.0);

		const score = calculatePositionScore(homeTeam, awayTeam);
		// New formula: Tier diff: 4 - 1 = 3 → 3 * 25 = 75
		// Position diff = 0 (both at position 10), EI diff = 0
		// Total = 75
		expect(score).toBe(75);
	});
});

describe("getTierDescription", () => {
	it("should return 'Elite' for tier 1", () => {
		const team = createTeamData(1);
		expect(getTierDescription(team)).toBe("Elite");
	});

	it("should return 'Strong' for tier 2", () => {
		const team = createTeamData(2);
		expect(getTierDescription(team)).toBe("Strong");
	});

	it("should return 'Average' for tier 3", () => {
		const team = createTeamData(3);
		expect(getTierDescription(team)).toBe("Average");
	});

	it("should return 'Weak' for tier 4", () => {
		const team = createTeamData(4);
		expect(getTierDescription(team)).toBe("Weak");
	});

	it("should return 'Unknown' for invalid tier", () => {
		const team = createTeamData(5 as TeamTier);
		expect(getTierDescription(team)).toBe("Unknown");
	});

	it("should default to 'Average' when mind is missing", () => {
		const team = createTeamData(2, 1.0, { mind: undefined });
		expect(getTierDescription(team)).toBe("Average");
	});
});

describe("hasSignificantQualityGap", () => {
	it("should return true when tier difference is 2", () => {
		const homeTeam = createTeamData(1);
		const awayTeam = createTeamData(3);

		expect(hasSignificantQualityGap(homeTeam, awayTeam)).toBe(true);
	});

	it("should return true when tier difference is 3", () => {
		const homeTeam = createTeamData(1);
		const awayTeam = createTeamData(4);

		expect(hasSignificantQualityGap(homeTeam, awayTeam)).toBe(true);
	});

	it("should return false when tier difference is 1", () => {
		const homeTeam = createTeamData(2);
		const awayTeam = createTeamData(3);

		expect(hasSignificantQualityGap(homeTeam, awayTeam)).toBe(false);
	});

	it("should return false when tiers are equal", () => {
		const homeTeam = createTeamData(2);
		const awayTeam = createTeamData(2);

		expect(hasSignificantQualityGap(homeTeam, awayTeam)).toBe(false);
	});

	it("should work when away team is better", () => {
		const homeTeam = createTeamData(4);
		const awayTeam = createTeamData(1);

		expect(hasSignificantQualityGap(homeTeam, awayTeam)).toBe(true);
	});

	it("should use default tier 3 when mind is missing", () => {
		const homeTeam = createTeamData(1);
		const awayTeam = createTeamData(3, 1.0, { mind: undefined });

		// Default tier is 3, so gap is 2
		expect(hasSignificantQualityGap(homeTeam, awayTeam)).toBe(true);
	});
});

describe("determineFavorite", () => {
	it("should return 'home' when home team is significantly better", () => {
		const homeTeam = createTeamData(1, 1.5); // Elite
		const awayTeam = createTeamData(3, 0.8); // Average

		expect(determineFavorite(homeTeam, awayTeam)).toBe("home");
	});

	it("should return 'away' when away team is significantly better", () => {
		const homeTeam = createTeamData(4, 0.7); // Weak
		const awayTeam = createTeamData(1, 1.5); // Elite

		expect(determineFavorite(homeTeam, awayTeam)).toBe("away");
	});

	it("should return 'even' when teams are similar quality", () => {
		const homeTeam = createTeamData(2, 1.1);
		const awayTeam = createTeamData(2, 1.0);

		expect(determineFavorite(homeTeam, awayTeam)).toBe("even");
	});

	it("should return 'even' when score is around 25", () => {
		// New formula: tierScore (tierDiff * 25) + positionScore (positionDiff * 2.5, capped ±25) + eiDiff
		// With both teams at position 10, positionScore = 0
		// tier diff = 1 -> +25, eiDiff = (1.0-1.0)*20 = 0 -> total 25
		const homeTeam = createTeamData(2, 1.0);
		const awayTeam = createTeamData(3, 1.0); // tier diff = 1 (+25), EI diff = 0, position diff = 0 -> 25

		const score = calculatePositionScore(homeTeam, awayTeam);
		expect(score).toBe(25);
		expect(determineFavorite(homeTeam, awayTeam)).toBe("even");
	});

	it("should return 'even' when score is around -25", () => {
		const homeTeam = createTeamData(3, 1.0);
		const awayTeam = createTeamData(2, 1.0);

		const score = calculatePositionScore(homeTeam, awayTeam);
		expect(score).toBe(-25);
		expect(determineFavorite(homeTeam, awayTeam)).toBe("even");
	});

	it("should return 'home' when score is just over 25", () => {
		// tier diff = 1 * 25 = 25, eiDiff = (1.2-1.0)*20 = 4 -> total 29
		const homeTeam = createTeamData(1, 1.2);
		const awayTeam = createTeamData(2, 1.0);

		const score = calculatePositionScore(homeTeam, awayTeam);
		expect(score).toBeGreaterThan(25);
		expect(determineFavorite(homeTeam, awayTeam)).toBe("home");
	});
});

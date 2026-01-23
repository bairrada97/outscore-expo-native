/**
 * Tests for home-advantage.ts
 *
 * Dynamic home advantage calculation tests.
 */

import { describe, expect, it } from "vitest";
import type { TeamData } from "../types";
import {
	calculateHomeAdvantageScore,
	hasSignificantHomeAdvantage,
	isStrongRoadTeam,
} from "./home-advantage";

// Helper to create minimal team data for testing
function createTeamData(overrides: Partial<TeamData> = {}): TeamData {
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
		daysSinceLastMatch: 5,
		lastHomeMatches: [],
		lastAwayMatches: [],
		seasonsInLeague: 5,
		...overrides,
	};
}

describe("calculateHomeAdvantageScore", () => {
	it("should return positive score when home team has strong home advantage", () => {
		const homeTeam = createTeamData({
			stats: {
				...createTeamData().stats,
				homeAvgScored: 2.5, // Scores much more at home
				awayAvgScored: 1.0, // Scores less away
			},
		});
		const awayTeam = createTeamData({
			id: 2,
			stats: {
				...createTeamData().stats,
				homeAvgScored: 2.0,
				awayAvgScored: 0.8, // Struggles on the road
			},
		});

		const score = calculateHomeAdvantageScore(homeTeam, awayTeam);
		expect(score).toBeGreaterThan(0);
	});

	it("should return higher score when away team struggles on the road", () => {
		const homeTeam = createTeamData({
			stats: {
				...createTeamData().stats,
				homeAvgScored: 1.5,
				awayAvgScored: 1.3, // Consistent
			},
		});

		const weakAwayTeam = createTeamData({
			id: 2,
			stats: {
				...createTeamData().stats,
				homeAvgScored: 2.5, // Great at home
				awayAvgScored: 0.5, // Terrible away
			},
		});

		const strongAwayTeam = createTeamData({
			id: 3,
			stats: {
				...createTeamData().stats,
				homeAvgScored: 1.5,
				awayAvgScored: 1.4, // Good road form
			},
		});

		const weakScore = calculateHomeAdvantageScore(homeTeam, weakAwayTeam);
		const strongScore = calculateHomeAdvantageScore(homeTeam, strongAwayTeam);

		expect(weakScore).toBeGreaterThan(strongScore);
	});

	it("should return reduced score when home team has no home advantage", () => {
		// Note: With baseline home advantage of 18, even teams with negative
		// dynamic advantage will have a positive total score
		const homeTeam = createTeamData({
			stats: {
				...createTeamData().stats,
				homeAvgScored: 1.0,
				awayAvgScored: 1.5, // Actually better away (-7.5 dynamic)
			},
		});
		const awayTeam = createTeamData({
			id: 2,
			stats: {
				...createTeamData().stats,
				homeAvgScored: 1.3,
				awayAvgScored: 1.4, // Good road team (-1.5 dynamic)
			},
		});

		const score = calculateHomeAdvantageScore(homeTeam, awayTeam);
		// Baseline (18) + dynamic avg ((-7.5 + -1.5) / 2 = -4.5) = 13.5
		// Should be lower than baseline but still positive due to real home advantage
		expect(score).toBeLessThan(18);
		expect(score).toBeGreaterThan(0);
	});

	it("should be clamped between -50 and 100", () => {
		// Extreme home advantage
		const extremeHomeTeam = createTeamData({
			stats: {
				...createTeamData().stats,
				homeAvgScored: 5.0,
				awayAvgScored: 0.0,
			},
		});
		const extremeAwayTeam = createTeamData({
			id: 2,
			stats: {
				...createTeamData().stats,
				homeAvgScored: 5.0,
				awayAvgScored: 0.0,
			},
		});

		const score = calculateHomeAdvantageScore(extremeHomeTeam, extremeAwayTeam);
		expect(score).toBeLessThanOrEqual(100);
		expect(score).toBeGreaterThanOrEqual(-50);
	});

	it("should handle missing stats gracefully", () => {
		const homeTeam = createTeamData({ stats: undefined as any });
		const awayTeam = createTeamData({ id: 2, stats: undefined as any });

		// Should not throw and return default-based score
		const score = calculateHomeAdvantageScore(homeTeam, awayTeam);
		expect(typeof score).toBe("number");
	});

	it("should return baseline score for teams with similar home/away form", () => {
		const homeTeam = createTeamData({
			stats: {
				...createTeamData().stats,
				homeAvgScored: 1.5,
				awayAvgScored: 1.4,
			},
		});
		const awayTeam = createTeamData({
			id: 2,
			stats: {
				...createTeamData().stats,
				homeAvgScored: 1.5,
				awayAvgScored: 1.4,
			},
		});

		const score = calculateHomeAdvantageScore(homeTeam, awayTeam);
		// With baseline home advantage of 18, similar differentials should give ~18-20
		// (baseline + small dynamic component)
		expect(score).toBeGreaterThanOrEqual(15);
		expect(score).toBeLessThanOrEqual(25);
	});
});

describe("hasSignificantHomeAdvantage", () => {
	it("should return true when home scoring is 0.5+ higher than away", () => {
		const team = createTeamData({
			stats: {
				...createTeamData().stats,
				homeAvgScored: 2.0,
				awayAvgScored: 1.2, // 0.8 difference
			},
		});

		expect(hasSignificantHomeAdvantage(team)).toBe(true);
	});

	it("should return false when home/away scoring is similar", () => {
		const team = createTeamData({
			stats: {
				...createTeamData().stats,
				homeAvgScored: 1.5,
				awayAvgScored: 1.3, // 0.2 difference
			},
		});

		expect(hasSignificantHomeAdvantage(team)).toBe(false);
	});

	it("should return false when team scores better away", () => {
		const team = createTeamData({
			stats: {
				...createTeamData().stats,
				homeAvgScored: 1.0,
				awayAvgScored: 1.5,
			},
		});

		expect(hasSignificantHomeAdvantage(team)).toBe(false);
	});

	it("should handle missing stats with defaults", () => {
		const team = createTeamData({ stats: undefined as any });
		// Should not throw
		const result = hasSignificantHomeAdvantage(team);
		expect(typeof result).toBe("boolean");
	});
});

describe("isStrongRoadTeam", () => {
	it("should return true when home/away scoring difference is < 0.3", () => {
		const team = createTeamData({
			stats: {
				...createTeamData().stats,
				homeAvgScored: 1.5,
				awayAvgScored: 1.4, // 0.1 difference
			},
		});

		expect(isStrongRoadTeam(team)).toBe(true);
	});

	it("should return true when team scores more away than home", () => {
		const team = createTeamData({
			stats: {
				...createTeamData().stats,
				homeAvgScored: 1.2,
				awayAvgScored: 1.5,
			},
		});

		expect(isStrongRoadTeam(team)).toBe(true);
	});

	it("should return false when team has significant home/away differential", () => {
		const team = createTeamData({
			stats: {
				...createTeamData().stats,
				homeAvgScored: 2.0,
				awayAvgScored: 1.0, // 1.0 difference
			},
		});

		expect(isStrongRoadTeam(team)).toBe(false);
	});

	it("should handle missing stats with defaults", () => {
		const team = createTeamData({ stats: undefined as any });
		// Should not throw
		const result = isStrongRoadTeam(team);
		expect(typeof result).toBe("boolean");
	});
});

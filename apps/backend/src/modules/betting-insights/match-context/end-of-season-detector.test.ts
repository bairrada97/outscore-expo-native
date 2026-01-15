/**
 * Tests for end-of-season-detector.ts
 *
 * End-of-season detection and adjustments tests.
 */

import { describe, expect, it } from "vitest";
import type { TeamData } from "../types";
import {
	analyzeSeasonStakes,
	calculateMotivationGap,
	detectEndOfSeason,
	detectIsEndOfSeason,
	detectSixPointer,
	getEndOfSeasonAdjustments,
} from "./end-of-season-detector";

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

describe("detectIsEndOfSeason", () => {
	it("should return false for early season", () => {
		expect(detectIsEndOfSeason(5, 38)).toBe(false);
		expect(detectIsEndOfSeason(10, 38)).toBe(false);
		expect(detectIsEndOfSeason(20, 38)).toBe(false);
	});

	it("should return true for last 5 rounds", () => {
		expect(detectIsEndOfSeason(34, 38)).toBe(true);
		expect(detectIsEndOfSeason(35, 38)).toBe(true);
		expect(detectIsEndOfSeason(36, 38)).toBe(true);
		expect(detectIsEndOfSeason(37, 38)).toBe(true);
		expect(detectIsEndOfSeason(38, 38)).toBe(true);
	});

	it("should return true when 85% of season completed", () => {
		// 33/38 = 86.8%
		expect(detectIsEndOfSeason(33, 38)).toBe(true);
	});

	it("should handle edge cases", () => {
		expect(detectIsEndOfSeason(0, 38)).toBe(false);
		expect(detectIsEndOfSeason(38, 0)).toBe(false);
	});
});

describe("analyzeSeasonStakes", () => {
	it("should detect title race for 1st-2nd place within 6 points", () => {
		const team = createTeamData({
			stats: {
				...createTeamData().stats,
				leaguePosition: 2,
				pointsFromFirst: 3, // Close to leader
				pointsFromCL: 5, // Not already secured
			},
			safetyFlags: undefined,
		});

		const stakes = analyzeSeasonStakes(team, 20, true);
		expect(stakes).toBe("TITLE_RACE");
	});

	it("should detect CL qualification for 3rd-4th place", () => {
		const team = createTeamData({
			stats: {
				...createTeamData().stats,
				leaguePosition: 3,
				pointsFromCL: 0,
			},
			safetyFlags: undefined,
		});

		const stakes = analyzeSeasonStakes(team, 20, true);
		expect(stakes).toBe("CL_QUALIFICATION");
	});

	it("should detect Europa race for 5th-7th place", () => {
		const team = createTeamData({
			stats: {
				...createTeamData().stats,
				leaguePosition: 6,
			},
			safetyFlags: undefined,
		});

		const stakes = analyzeSeasonStakes(team, 20, true);
		expect(stakes).toBe("EUROPA_RACE");
	});

	it("should detect relegation battle for bottom 3", () => {
		const team = createTeamData({
			stats: {
				...createTeamData().stats,
				leaguePosition: 18,
				pointsFromRelegation: 2,
			},
			safetyFlags: undefined,
		});

		const stakes = analyzeSeasonStakes(team, 20, true);
		expect(stakes).toBe("RELEGATION_BATTLE");
	});

	it("should detect nothing to play for mid-table", () => {
		const team = createTeamData({
			stats: {
				...createTeamData().stats,
				leaguePosition: 12,
				pointsFromCL: -20,
				pointsFromRelegation: 15,
			},
			safetyFlags: undefined,
		});

		const stakes = analyzeSeasonStakes(team, 20, true);
		expect(stakes).toBe("NOTHING_TO_PLAY");
	});

	it("should use safetyFlags motivation when available", () => {
		const team = createTeamData({
			safetyFlags: {
				...createTeamData().safetyFlags,
				motivation: "RELEGATION_BATTLE",
			},
		});

		const stakes = analyzeSeasonStakes(team, 20, true);
		expect(stakes).toBe("RELEGATION_BATTLE");
	});

	it("should scale thresholds for smaller leagues", () => {
		// In a 10-team league, top 2 should be CL spots (20%)
		const team = createTeamData({
			stats: {
				...createTeamData().stats,
				leaguePosition: 2,
				pointsFromFirst: 10,
			},
			safetyFlags: undefined,
		});

		const stakes = analyzeSeasonStakes(team, 10, true);
		expect(stakes).toBe("CL_QUALIFICATION");
	});
});

describe("calculateMotivationGap", () => {
	it("should return positive when home more motivated", () => {
		const gap = calculateMotivationGap("TITLE_RACE", "NOTHING_TO_PLAY");
		expect(gap).toBeGreaterThan(0);
	});

	it("should return negative when away more motivated", () => {
		const gap = calculateMotivationGap("NOTHING_TO_PLAY", "RELEGATION_BATTLE");
		expect(gap).toBeLessThan(0);
	});

	it("should return zero when equal motivation", () => {
		const gap = calculateMotivationGap("CL_QUALIFICATION", "CL_QUALIFICATION");
		expect(gap).toBe(0);
	});

	it("should give relegation battle very high priority", () => {
		const relegationVsEuropa = calculateMotivationGap("RELEGATION_BATTLE", "EUROPA_RACE");
		const titleVsEuropa = calculateMotivationGap("TITLE_RACE", "EUROPA_RACE");

		// Relegation should be almost as motivating as title race
		expect(Math.abs(relegationVsEuropa)).toBeGreaterThan(Math.abs(titleVsEuropa) * 0.5);
	});
});

describe("detectSixPointer", () => {
	it("should detect six-pointer when both teams have same stakes", () => {
		expect(detectSixPointer("RELEGATION_BATTLE", "RELEGATION_BATTLE")).toBe(true);
		expect(detectSixPointer("TITLE_RACE", "TITLE_RACE")).toBe(true);
		expect(detectSixPointer("CL_QUALIFICATION", "CL_QUALIFICATION")).toBe(true);
	});

	it("should detect six-pointer when both chasing European spots", () => {
		expect(detectSixPointer("CL_QUALIFICATION", "EUROPA_RACE")).toBe(true);
		expect(detectSixPointer("EUROPA_RACE", "CONFERENCE_RACE")).toBe(true);
	});

	it("should not detect six-pointer for nothing to play for", () => {
		expect(detectSixPointer("NOTHING_TO_PLAY", "NOTHING_TO_PLAY")).toBe(false);
	});

	it("should not detect six-pointer for mismatched stakes", () => {
		expect(detectSixPointer("TITLE_RACE", "RELEGATION_BATTLE")).toBe(false);
		expect(detectSixPointer("CL_QUALIFICATION", "NOTHING_TO_PLAY")).toBe(false);
	});
});

describe("detectEndOfSeason", () => {
	it("should return complete context", () => {
		const homeTeam = createTeamData({
			name: "Home FC",
			stats: {
				...createTeamData().stats,
				leaguePosition: 2,
				pointsFromFirst: 3,
			},
			safetyFlags: undefined,
		});
		const awayTeam = createTeamData({
			id: 2,
			name: "Away United",
			stats: {
				...createTeamData().stats,
				leaguePosition: 19,
				pointsFromRelegation: 1,
			},
			safetyFlags: undefined,
		});

		const context = detectEndOfSeason(homeTeam, awayTeam, 36, 38);

		expect(context.isEndOfSeason).toBe(true);
		expect(context.homeStakes).toBe("TITLE_RACE");
		expect(context.awayStakes).toBe("RELEGATION_BATTLE");
		expect(context.isSixPointer).toBe(false);
		expect(context.motivationGap).toBeGreaterThan(0); // Home more motivated (title > relegation by our priority)
		expect(context.summary).toContain("Home FC");
		expect(context.summary).toContain("Away United");
	});

	it("should calculate adjustments for relegation battle", () => {
		const homeTeam = createTeamData({
			stats: {
				...createTeamData().stats,
				leaguePosition: 18,
			},
			safetyFlags: undefined,
		});
		const awayTeam = createTeamData({
			id: 2,
			stats: {
				...createTeamData().stats,
				leaguePosition: 19,
			},
			safetyFlags: undefined,
		});

		const context = detectEndOfSeason(homeTeam, awayTeam, 36, 38);

		expect(context.isSixPointer).toBe(true);
		expect(context.adjustments.goalsAdjustment).toBeLessThan(0); // Fewer goals expected
		expect(context.adjustments.bttsAdjustment).toBeLessThan(0); // More defensive
	});

	it("should return no adjustments when not end of season", () => {
		const homeTeam = createTeamData();
		const awayTeam = createTeamData({ id: 2 });

		const context = detectEndOfSeason(homeTeam, awayTeam, 10, 38);

		expect(context.isEndOfSeason).toBe(false);
		expect(context.adjustments.homeWinAdjustment).toBe(0);
		expect(context.adjustments.awayWinAdjustment).toBe(0);
		expect(context.adjustments.goalsAdjustment).toBe(0);
	});

	it("should handle missing round information", () => {
		const homeTeam = createTeamData();
		const awayTeam = createTeamData({ id: 2 });

		const context = detectEndOfSeason(homeTeam, awayTeam);

		expect(context).toBeDefined();
		// When no round info, should default to end of season (conservative)
		expect(context.roundNumber).toBe(38);
		expect(context.totalRounds).toBe(38);
	});
});

describe("getEndOfSeasonAdjustments", () => {
	it("should return empty array when not end of season", () => {
		const homeTeam = createTeamData();
		const awayTeam = createTeamData({ id: 2 });
		const context = detectEndOfSeason(homeTeam, awayTeam, 10, 38);

		const adjustments = getEndOfSeasonAdjustments(context);

		expect(adjustments).toHaveLength(0);
	});

	it("should return adjustments for six-pointer", () => {
		const homeTeam = createTeamData({
			stats: {
				...createTeamData().stats,
				leaguePosition: 18,
			},
			safetyFlags: undefined,
		});
		const awayTeam = createTeamData({
			id: 2,
			stats: {
				...createTeamData().stats,
				leaguePosition: 19,
			},
			safetyFlags: undefined,
		});

		const context = detectEndOfSeason(homeTeam, awayTeam, 36, 38);
		const adjustments = getEndOfSeasonAdjustments(context);

		const hasSixPointerAdjustment = adjustments.some(
			(adj) => adj.reason?.toLowerCase().includes("six-pointer"),
		);
		expect(hasSixPointerAdjustment).toBe(true);
	});

	it("should return adjustments for relegation battle", () => {
		const homeTeam = createTeamData({
			stats: {
				...createTeamData().stats,
				leaguePosition: 18,
			},
			safetyFlags: undefined,
		});
		const awayTeam = createTeamData({
			id: 2,
			stats: {
				...createTeamData().stats,
				leaguePosition: 10,
			},
			safetyFlags: undefined,
		});

		const context = detectEndOfSeason(homeTeam, awayTeam, 36, 38);
		const adjustments = getEndOfSeasonAdjustments(context);

		const hasRelegationAdjustment = adjustments.some(
			(adj) => adj.reason?.toLowerCase().includes("relegation"),
		);
		expect(hasRelegationAdjustment).toBe(true);
	});

	it("should return adjustments for title race", () => {
		const homeTeam = createTeamData({
			stats: {
				...createTeamData().stats,
				leaguePosition: 2,
				pointsFromFirst: 2,
				pointsFromCL: 5,
			},
			safetyFlags: undefined,
		});
		const awayTeam = createTeamData({
			id: 2,
			stats: {
				...createTeamData().stats,
				leaguePosition: 10,
			},
			safetyFlags: undefined,
		});

		const context = detectEndOfSeason(homeTeam, awayTeam, 36, 38);
		const adjustments = getEndOfSeasonAdjustments(context);

		const hasTitleAdjustment = adjustments.some(
			(adj) => adj.reason?.toLowerCase().includes("title"),
		);
		expect(hasTitleAdjustment).toBe(true);
	});
});

/**
 * Tests for h2h-helpers.ts
 *
 * Head-to-head data processing including season detection,
 * recency weighting, and weighted calculations.
 */

import { describe, expect, it } from "vitest";
import type { ProcessedMatch, H2HRecencyConfig } from "../types";
import {
	getSeasonFromDate,
	isSameSeasonHelper,
	isCurrentSeason,
	isWithinLastMonths,
	calculateSingleH2HWeight,
	calculateH2HRecencyWeights,
	calculateWeightedAverage,
	calculateWeightedCount,
	calculateWeightedPercentage,
	processH2HData,
	assessH2HDataQuality,
	getH2HWeightAdjustment,
} from "./h2h-helpers";

// Helper to create a processed match for H2H testing
function createH2HMatch(
	date: string,
	homeTeamId: number,
	awayTeamId: number,
	homeScore: number,
	awayScore: number,
	overrides: Partial<ProcessedMatch> = {},
): ProcessedMatch {
	return {
		fixtureId: 1,
		date,
		homeOrAway: "H",
		homeTeam: { id: homeTeamId, name: "Home Team" },
		opponent: { id: awayTeamId, name: "Away Team" },
		result: homeScore > awayScore ? "W" : homeScore < awayScore ? "L" : "D",
		goalsScored: homeScore,
		goalsConceded: awayScore,
		score: { home: homeScore, away: awayScore },
		league: { id: 39, name: "Premier League" },
		season: 2024,
		round: 10,
		isHome: true,
		...overrides,
	} as ProcessedMatch;
}

describe("getSeasonFromDate", () => {
	it("should return current year for Aug-Dec dates", () => {
		expect(getSeasonFromDate(new Date("2024-08-15"))).toBe(2024);
		expect(getSeasonFromDate(new Date("2024-10-01"))).toBe(2024);
		expect(getSeasonFromDate(new Date("2024-12-31"))).toBe(2024);
	});

	it("should return previous year for Jan-July dates", () => {
		expect(getSeasonFromDate(new Date("2025-01-15"))).toBe(2024);
		expect(getSeasonFromDate(new Date("2025-03-01"))).toBe(2024);
		expect(getSeasonFromDate(new Date("2025-07-31"))).toBe(2024);
	});

	it("should handle July (month index 6) as previous season", () => {
		expect(getSeasonFromDate(new Date("2024-07-15"))).toBe(2023);
	});

	it("should handle August (month index 7) as current season", () => {
		expect(getSeasonFromDate(new Date("2024-08-01"))).toBe(2024);
	});
});

describe("isSameSeasonHelper", () => {
	it("should return true for dates in same season", () => {
		expect(isSameSeasonHelper("2024-09-15", "2025-02-15")).toBe(true);
		expect(isSameSeasonHelper("2024-08-01", "2025-05-31")).toBe(true);
	});

	it("should return false for dates in different seasons", () => {
		expect(isSameSeasonHelper("2024-05-15", "2024-09-15")).toBe(false);
		expect(isSameSeasonHelper("2023-12-01", "2024-12-01")).toBe(false);
	});

	it("should handle Date objects", () => {
		const date1 = new Date("2024-09-15");
		const date2 = new Date("2025-02-15");
		expect(isSameSeasonHelper(date1, date2)).toBe(true);
	});

	it("should handle invalid dates gracefully", () => {
		expect(isSameSeasonHelper("invalid", "2024-09-15")).toBe(false);
	});
});

describe("isCurrentSeason", () => {
	it("should return true for match in current season", () => {
		const currentDate = new Date("2024-10-15");
		expect(isCurrentSeason("2024-09-01", currentDate)).toBe(true);
		expect(isCurrentSeason("2025-02-01", currentDate)).toBe(true);
	});

	it("should return false for match in previous season", () => {
		const currentDate = new Date("2024-10-15");
		expect(isCurrentSeason("2024-05-01", currentDate)).toBe(false);
		expect(isCurrentSeason("2023-12-01", currentDate)).toBe(false);
	});
});

describe("isWithinLastMonths", () => {
	it("should return true for recent matches", () => {
		const currentDate = new Date("2024-10-15");
		expect(isWithinLastMonths("2024-10-01", 1, currentDate)).toBe(true);
		expect(isWithinLastMonths("2024-09-01", 2, currentDate)).toBe(true);
	});

	it("should return false for older matches", () => {
		const currentDate = new Date("2024-10-15");
		expect(isWithinLastMonths("2024-06-01", 3, currentDate)).toBe(false);
		expect(isWithinLastMonths("2023-10-01", 6, currentDate)).toBe(false);
	});

	it("should handle edge case at boundary", () => {
		const currentDate = new Date("2024-10-15");
		// 3 months = ~90 days, so mid-July should be just outside
		expect(isWithinLastMonths("2024-07-01", 3, currentDate)).toBe(false);
	});
});

describe("calculateSingleH2HWeight", () => {
	const config: H2HRecencyConfig = {
		decayBase: 0.7,
		currentYearWeight: 1.2,
		recentMonthsWeight: 1.1,
	};

	it("should return ~1.0 for very recent match", () => {
		const currentDate = new Date("2024-10-15");
		const weight = calculateSingleH2HWeight("2024-10-14", config, currentDate);
		// Should have current season boost (1.2) and recent months boost (1.1)
		expect(weight).toBeGreaterThan(1.2);
	});

	it("should apply decay for older matches", () => {
		const currentDate = new Date("2024-10-15");

		// 1 year ago - decay of ~0.7
		const weight1yr = calculateSingleH2HWeight("2023-10-15", config, currentDate);
		expect(weight1yr).toBeLessThan(0.9);

		// 2 years ago - decay of ~0.49
		const weight2yr = calculateSingleH2HWeight("2022-10-15", config, currentDate);
		expect(weight2yr).toBeLessThan(0.6);
	});

	it("should apply current season boost", () => {
		const currentDate = new Date("2024-10-15");

		// Current season match (within 90 days)
		const currentSeasonWeight = calculateSingleH2HWeight(
			"2024-09-15",
			config,
			currentDate,
		);

		// Same time last season (outside 90 days)
		const lastSeasonWeight = calculateSingleH2HWeight(
			"2023-09-15",
			config,
			currentDate,
		);

		// Current season should be significantly higher
		expect(currentSeasonWeight).toBeGreaterThan(lastSeasonWeight * 1.2);
	});

	it("should apply recent months boost", () => {
		const currentDate = new Date("2024-10-15");

		// Within 90 days
		const recentWeight = calculateSingleH2HWeight("2024-08-01", config, currentDate);

		// Just outside 90 days (but still current season)
		const olderWeight = calculateSingleH2HWeight("2024-07-01", config, currentDate);

		// Recent should have additional boost
		expect(recentWeight).toBeGreaterThan(olderWeight);
	});
});

describe("calculateH2HRecencyWeights", () => {
	it("should return weights for all matches", () => {
		const currentDate = new Date("2024-10-15");
		const matches = [
			createH2HMatch("2024-09-15", 1, 2, 2, 1),
			createH2HMatch("2024-03-15", 1, 2, 1, 1),
			createH2HMatch("2023-09-15", 1, 2, 0, 2),
		];

		const weights = calculateH2HRecencyWeights(matches, undefined, currentDate);

		expect(weights.length).toBe(3);
		// Most recent should have highest weight
		expect(weights[0]).toBeGreaterThan(weights[2]);
	});
});

describe("calculateWeightedAverage", () => {
	it("should calculate weighted average correctly", () => {
		const values = [2, 4, 6];
		const weights = [1, 1, 1];

		expect(calculateWeightedAverage(values, weights)).toBe(4);
	});

	it("should weight values correctly", () => {
		const values = [10, 20];
		const weights = [3, 1]; // 10 weighted 3x more

		// (10*3 + 20*1) / (3+1) = 50/4 = 12.5
		expect(calculateWeightedAverage(values, weights)).toBe(12.5);
	});

	it("should return 0 for empty arrays", () => {
		expect(calculateWeightedAverage([], [])).toBe(0);
	});

	it("should return 0 for mismatched lengths", () => {
		expect(calculateWeightedAverage([1, 2, 3], [1, 2])).toBe(0);
	});
});

describe("calculateWeightedCount", () => {
	it("should calculate weighted count correctly", () => {
		const items = [1, 2, 3, 4, 5];
		const weights = [1, 1, 1, 1, 1];
		const isEven = (n: number) => n % 2 === 0;

		// 2 and 4 are even = 2/5 = 0.4
		expect(calculateWeightedCount(items, isEven, weights)).toBeCloseTo(0.4);
	});

	it("should apply weights to count", () => {
		const items = [true, false, true];
		const weights = [2, 1, 1]; // First true weighted 2x
		const isTrue = (b: boolean) => b;

		// (2 + 0 + 1) / (2+1+1) = 3/4 = 0.75
		expect(calculateWeightedCount(items, isTrue, weights)).toBe(0.75);
	});

	it("should return 0 for empty arrays", () => {
		expect(calculateWeightedCount([], () => true, [])).toBe(0);
	});
});

describe("calculateWeightedPercentage", () => {
	it("should return percentage as 0-100", () => {
		const items = [true, true, false, false];
		const weights = [1, 1, 1, 1];

		expect(calculateWeightedPercentage(items, (b) => b, weights)).toBe(50);
	});
});

describe("processH2HData", () => {
	const currentDate = new Date("2024-10-15");

	it("should process H2H matches correctly", () => {
		const matches = [
			createH2HMatch("2024-09-15", 40, 157, 2, 1), // Home win
			createH2HMatch("2024-03-15", 40, 157, 1, 1), // Draw
			createH2HMatch("2023-09-15", 157, 40, 0, 2), // Away win (home team is 40)
		];

		const h2h = processH2HData(matches, 40, 157, undefined, currentDate);

		expect(h2h.h2hMatchCount).toBe(3);
		expect(h2h.hasSufficientData).toBe(true);
	});

	it("should calculate averages", () => {
		const matches = [
			createH2HMatch("2024-09-15", 40, 157, 3, 1),
			createH2HMatch("2024-03-15", 40, 157, 2, 2),
			createH2HMatch("2023-09-15", 40, 157, 1, 0),
		];

		const h2h = processH2HData(matches, 40, 157, undefined, currentDate);

		// Total goals: 4, 4, 1 = avg ~3 (weighted)
		expect(h2h.avgGoals).toBeGreaterThan(0);
	});

	it("should track BTTS correctly", () => {
		const matches = [
			createH2HMatch("2024-09-15", 40, 157, 2, 1), // BTTS
			createH2HMatch("2024-03-15", 40, 157, 1, 0), // Not BTTS
			createH2HMatch("2023-09-15", 40, 157, 3, 2), // BTTS
		];

		const h2h = processH2HData(matches, 40, 157, undefined, currentDate);

		expect(h2h.bttsCount).toBe(2);
		expect(h2h.bttsPercentage).toBeGreaterThan(0);
	});

	it("should mark insufficient data", () => {
		const matches = [
			createH2HMatch("2024-09-15", 40, 157, 2, 1),
			createH2HMatch("2024-03-15", 40, 157, 1, 0),
		];

		const h2h = processH2HData(matches, 40, 157, undefined, currentDate);

		expect(h2h.h2hMatchCount).toBe(2);
		expect(h2h.hasSufficientData).toBe(false); // < 3 matches
	});

	it("should sort matches by date", () => {
		const matches = [
			createH2HMatch("2023-09-15", 40, 157, 1, 0),
			createH2HMatch("2024-09-15", 40, 157, 2, 1),
			createH2HMatch("2024-03-15", 40, 157, 3, 2),
		];

		const h2h = processH2HData(matches, 40, 157, undefined, currentDate);

		// Should be sorted most recent first
		expect(h2h.matches[0].date).toBe("2024-09-15");
		expect(h2h.matches[2].date).toBe("2023-09-15");
	});

	it("should calculate recency weights", () => {
		const matches = [
			createH2HMatch("2024-09-15", 40, 157, 2, 1),
			createH2HMatch("2024-03-15", 40, 157, 1, 0),
			createH2HMatch("2022-09-15", 40, 157, 3, 2),
		];

		const h2h = processH2HData(matches, 40, 157, undefined, currentDate);

		expect(h2h.recencyWeights.length).toBe(3);
		// Most recent should have highest weight
		expect(h2h.recencyWeights[0]).toBeGreaterThan(h2h.recencyWeights[2]);
	});
});

describe("assessH2HDataQuality", () => {
	it("should return HIGH for 8+ matches", () => {
		const h2h = {
			h2hMatchCount: 10,
			matches: [],
			homeTeamWins: 5,
			awayTeamWins: 3,
			draws: 2,
			bttsCount: 6,
			bttsPercentage: 60,
			goalLineOverCount: {},
			goalLineOverPct: {},
			avgGoals: 2.5,
			avgHomeGoals: 1.5,
			avgAwayGoals: 1.0,
			recencyWeights: [],
			hasSufficientData: true,
		};

		expect(assessH2HDataQuality(h2h)).toBe("HIGH");
	});

	it("should return MEDIUM for 3-7 matches", () => {
		const h2h = {
			h2hMatchCount: 5,
			matches: [],
			homeTeamWins: 2,
			awayTeamWins: 2,
			draws: 1,
			bttsCount: 3,
			bttsPercentage: 60,
			goalLineOverCount: {},
			goalLineOverPct: {},
			avgGoals: 2.5,
			avgHomeGoals: 1.5,
			avgAwayGoals: 1.0,
			recencyWeights: [],
			hasSufficientData: true,
		};

		expect(assessH2HDataQuality(h2h)).toBe("MEDIUM");
	});

	it("should return LOW for <3 matches", () => {
		const h2h = {
			h2hMatchCount: 2,
			matches: [],
			homeTeamWins: 1,
			awayTeamWins: 1,
			draws: 0,
			bttsCount: 1,
			bttsPercentage: 50,
			goalLineOverCount: {},
			goalLineOverPct: {},
			avgGoals: 2.5,
			avgHomeGoals: 1.5,
			avgAwayGoals: 1.0,
			recencyWeights: [],
			hasSufficientData: false,
		};

		expect(assessH2HDataQuality(h2h)).toBe("LOW");
	});
});

describe("getH2HWeightAdjustment", () => {
	it("should return 1.0 for 8+ matches", () => {
		const h2h = {
			h2hMatchCount: 10,
			matches: [],
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
			hasSufficientData: true,
		};

		expect(getH2HWeightAdjustment(h2h)).toBe(1.0);
	});

	it("should return 0.8 for 5-7 matches", () => {
		const h2h = {
			h2hMatchCount: 6,
			matches: [],
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
			hasSufficientData: true,
		};

		expect(getH2HWeightAdjustment(h2h)).toBe(0.8);
	});

	it("should return 0.6 for 3-4 matches", () => {
		const h2h = {
			h2hMatchCount: 3,
			matches: [],
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
			hasSufficientData: true,
		};

		expect(getH2HWeightAdjustment(h2h)).toBe(0.6);
	});

	it("should return 0.4 for <3 matches", () => {
		const h2h = {
			h2hMatchCount: 1,
			matches: [],
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

		expect(getH2HWeightAdjustment(h2h)).toBe(0.4);
	});
});

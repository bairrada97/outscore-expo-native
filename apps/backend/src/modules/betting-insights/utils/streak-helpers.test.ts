/**
 * Tests for streak-helpers.ts
 *
 * Streak counting functions for consecutive results, scoring,
 * clean sheets, BTTS, Over/Under, and analysis helpers.
 */

import { describe, expect, it } from "vitest";
import type { ProcessedMatch } from "../types";
import {
	countConsecutiveWins,
	countConsecutiveLosses,
	countConsecutiveDraws,
	countConsecutiveUnbeaten,
	countConsecutiveWinless,
	countConsecutiveResults,
	countConsecutiveMatchesWithGoals,
	countConsecutiveMatchesWithoutGoals,
	countConsecutiveHighScoringMatches,
	countConsecutiveCleanSheets,
	countConsecutiveMatchesWithoutCleanSheet,
	countConsecutiveMultiGoalsConceded,
	countConsecutiveBTTS,
	countConsecutiveNoBTTS,
	countConsecutiveOver25,
	countConsecutiveUnder25,
	countConsecutiveFirstHalfGoals,
	countConsecutiveNoFirstHalfGoals,
	findLongestStreak,
	hasRecentStreakBreaker,
	calculateStreakMomentum,
} from "./streak-helpers";

// Helper to create a processed match
function createMatch(
	result: "W" | "D" | "L",
	goalsScored: number,
	goalsConceded: number,
	firstHalfGoals?: number,
): ProcessedMatch {
	return {
		id: 1,
		date: "2024-01-01",
		homeTeam: { id: 1, name: "Test Team" },
		awayTeam: { id: 2, name: "Opponent" },
		score: { home: goalsScored, away: goalsConceded },
		result,
		goalsScored,
		goalsConceded,
		league: { id: 39, name: "Premier League" },
		season: 2024,
		isHome: true,
		firstHalfGoals,
	};
}

describe("countConsecutiveWins", () => {
	it("should count consecutive wins from start", () => {
		const matches = [
			createMatch("W", 2, 0),
			createMatch("W", 1, 0),
			createMatch("W", 3, 1),
			createMatch("D", 1, 1),
			createMatch("W", 2, 0),
		];

		expect(countConsecutiveWins(matches)).toBe(3);
	});

	it("should return 0 when first match is not a win", () => {
		const matches = [
			createMatch("D", 1, 1),
			createMatch("W", 2, 0),
			createMatch("W", 1, 0),
		];

		expect(countConsecutiveWins(matches)).toBe(0);
	});

	it("should return 0 for empty array", () => {
		expect(countConsecutiveWins([])).toBe(0);
	});

	it("should count all matches if all are wins", () => {
		const matches = [
			createMatch("W", 2, 0),
			createMatch("W", 1, 0),
			createMatch("W", 3, 1),
		];

		expect(countConsecutiveWins(matches)).toBe(3);
	});
});

describe("countConsecutiveLosses", () => {
	it("should count consecutive losses from start", () => {
		const matches = [
			createMatch("L", 0, 2),
			createMatch("L", 1, 3),
			createMatch("D", 1, 1),
		];

		expect(countConsecutiveLosses(matches)).toBe(2);
	});

	it("should return 0 when first match is not a loss", () => {
		const matches = [
			createMatch("W", 2, 0),
			createMatch("L", 0, 2),
		];

		expect(countConsecutiveLosses(matches)).toBe(0);
	});
});

describe("countConsecutiveDraws", () => {
	it("should count consecutive draws from start", () => {
		const matches = [
			createMatch("D", 1, 1),
			createMatch("D", 0, 0),
			createMatch("D", 2, 2),
			createMatch("W", 2, 0),
		];

		expect(countConsecutiveDraws(matches)).toBe(3);
	});
});

describe("countConsecutiveUnbeaten", () => {
	it("should count wins and draws", () => {
		const matches = [
			createMatch("W", 2, 0),
			createMatch("D", 1, 1),
			createMatch("W", 3, 1),
			createMatch("D", 0, 0),
			createMatch("L", 0, 2),
		];

		expect(countConsecutiveUnbeaten(matches)).toBe(4);
	});

	it("should stop at first loss", () => {
		const matches = [
			createMatch("W", 2, 0),
			createMatch("L", 0, 2),
			createMatch("W", 1, 0),
		];

		expect(countConsecutiveUnbeaten(matches)).toBe(1);
	});
});

describe("countConsecutiveWinless", () => {
	it("should count losses and draws", () => {
		const matches = [
			createMatch("D", 1, 1),
			createMatch("L", 0, 2),
			createMatch("D", 0, 0),
			createMatch("W", 2, 0),
		];

		expect(countConsecutiveWinless(matches)).toBe(3);
	});

	it("should stop at first win", () => {
		const matches = [
			createMatch("L", 0, 2),
			createMatch("W", 2, 0),
			createMatch("L", 1, 3),
		];

		expect(countConsecutiveWinless(matches)).toBe(1);
	});
});

describe("countConsecutiveResults", () => {
	it("should count specific result type", () => {
		const matches = [
			createMatch("W", 2, 0),
			createMatch("W", 1, 0),
			createMatch("D", 1, 1),
		];

		expect(countConsecutiveResults(matches, "W")).toBe(2);
		expect(countConsecutiveResults(matches, "D")).toBe(0);
	});
});

describe("countConsecutiveMatchesWithGoals", () => {
	it("should count matches where team scored", () => {
		const matches = [
			createMatch("W", 2, 0),
			createMatch("D", 1, 1),
			createMatch("L", 1, 3),
			createMatch("L", 0, 2),
		];

		expect(countConsecutiveMatchesWithGoals(matches)).toBe(3);
	});

	it("should return 0 if first match had no goals", () => {
		const matches = [
			createMatch("L", 0, 2),
			createMatch("W", 2, 0),
		];

		expect(countConsecutiveMatchesWithGoals(matches)).toBe(0);
	});
});

describe("countConsecutiveMatchesWithoutGoals", () => {
	it("should count matches where team failed to score", () => {
		const matches = [
			createMatch("L", 0, 2),
			createMatch("D", 0, 0),
			createMatch("L", 0, 1),
			createMatch("W", 2, 0),
		];

		expect(countConsecutiveMatchesWithoutGoals(matches)).toBe(3);
	});
});

describe("countConsecutiveHighScoringMatches", () => {
	it("should count matches with 2+ goals scored", () => {
		const matches = [
			createMatch("W", 3, 0),
			createMatch("W", 2, 1),
			createMatch("D", 2, 2),
			createMatch("W", 1, 0),
		];

		expect(countConsecutiveHighScoringMatches(matches)).toBe(3);
	});

	it("should stop at match with less than 2 goals", () => {
		const matches = [
			createMatch("W", 2, 0),
			createMatch("W", 1, 0),
		];

		expect(countConsecutiveHighScoringMatches(matches)).toBe(1);
	});
});

describe("countConsecutiveCleanSheets", () => {
	it("should count matches with no goals conceded", () => {
		const matches = [
			createMatch("W", 2, 0),
			createMatch("D", 0, 0),
			createMatch("W", 1, 0),
			createMatch("D", 1, 1),
		];

		expect(countConsecutiveCleanSheets(matches)).toBe(3);
	});
});

describe("countConsecutiveMatchesWithoutCleanSheet", () => {
	it("should count matches with goals conceded", () => {
		const matches = [
			createMatch("W", 3, 1),
			createMatch("L", 1, 2),
			createMatch("D", 1, 1),
			createMatch("W", 2, 0),
		];

		expect(countConsecutiveMatchesWithoutCleanSheet(matches)).toBe(3);
	});
});

describe("countConsecutiveMultiGoalsConceded", () => {
	it("should count matches with 2+ goals conceded", () => {
		const matches = [
			createMatch("L", 0, 3),
			createMatch("L", 1, 2),
			createMatch("D", 2, 2),
			createMatch("L", 0, 1),
		];

		expect(countConsecutiveMultiGoalsConceded(matches)).toBe(3);
	});
});

describe("countConsecutiveBTTS", () => {
	it("should count BTTS matches", () => {
		const matches = [
			createMatch("W", 2, 1),
			createMatch("D", 1, 1),
			createMatch("L", 1, 2),
			createMatch("W", 2, 0),
		];

		expect(countConsecutiveBTTS(matches)).toBe(3);
	});

	it("should stop at first non-BTTS match", () => {
		const matches = [
			createMatch("W", 2, 1),
			createMatch("W", 2, 0),
			createMatch("W", 3, 1),
		];

		expect(countConsecutiveBTTS(matches)).toBe(1);
	});
});

describe("countConsecutiveNoBTTS", () => {
	it("should count non-BTTS matches", () => {
		const matches = [
			createMatch("W", 2, 0),
			createMatch("L", 0, 1),
			createMatch("D", 0, 0),
			createMatch("W", 3, 1),
		];

		expect(countConsecutiveNoBTTS(matches)).toBe(3);
	});
});

describe("countConsecutiveOver25", () => {
	it("should count Over 2.5 matches", () => {
		const matches = [
			createMatch("W", 3, 1), // 4 goals
			createMatch("D", 2, 2), // 4 goals
			createMatch("L", 1, 2), // 3 goals
			createMatch("W", 1, 0), // 1 goal
		];

		expect(countConsecutiveOver25(matches)).toBe(3);
	});

	it("should stop at 2 or fewer goals", () => {
		const matches = [
			createMatch("W", 3, 0), // 3 goals
			createMatch("D", 1, 1), // 2 goals
		];

		expect(countConsecutiveOver25(matches)).toBe(1);
	});
});

describe("countConsecutiveUnder25", () => {
	it("should count Under 2.5 matches", () => {
		const matches = [
			createMatch("W", 1, 0), // 1 goal
			createMatch("D", 1, 1), // 2 goals
			createMatch("D", 0, 0), // 0 goals
			createMatch("W", 2, 1), // 3 goals
		];

		expect(countConsecutiveUnder25(matches)).toBe(3);
	});
});

describe("countConsecutiveFirstHalfGoals", () => {
	it("should count matches with first half goals", () => {
		const matches = [
			createMatch("W", 2, 0, 1),
			createMatch("D", 1, 1, 1),
			createMatch("W", 3, 1, 2),
			createMatch("L", 0, 2, 0),
		];

		expect(countConsecutiveFirstHalfGoals(matches)).toBe(3);
	});

	it("should break on undefined firstHalfGoals", () => {
		const matches = [
			createMatch("W", 2, 0, 1),
			createMatch("D", 1, 1, undefined), // No data
			createMatch("W", 3, 1, 2),
		];

		expect(countConsecutiveFirstHalfGoals(matches)).toBe(1);
	});

	it("should break on zero firstHalfGoals", () => {
		const matches = [
			createMatch("W", 2, 0, 1),
			createMatch("D", 1, 1, 0),
			createMatch("W", 3, 1, 2),
		];

		expect(countConsecutiveFirstHalfGoals(matches)).toBe(1);
	});
});

describe("countConsecutiveNoFirstHalfGoals", () => {
	it("should count matches without first half goals", () => {
		const matches = [
			createMatch("L", 0, 2, 0),
			createMatch("W", 1, 0, 0),
			createMatch("D", 0, 0, 0),
			createMatch("W", 2, 0, 1),
		];

		expect(countConsecutiveNoFirstHalfGoals(matches)).toBe(3);
	});

	it("should break on undefined firstHalfGoals", () => {
		const matches = [
			createMatch("L", 0, 2, 0),
			createMatch("W", 1, 0, undefined),
		];

		expect(countConsecutiveNoFirstHalfGoals(matches)).toBe(1);
	});
});

describe("findLongestStreak", () => {
	it("should find longest winning streak", () => {
		const matches = [
			createMatch("W", 2, 0),
			createMatch("L", 0, 2),
			createMatch("W", 1, 0),
			createMatch("W", 3, 1),
			createMatch("W", 2, 1),
			createMatch("D", 1, 1),
		];

		const { length, startIndex } = findLongestStreak(
			matches,
			(m) => m.result === "W",
		);

		expect(length).toBe(3);
		expect(startIndex).toBe(2);
	});

	it("should return 0 for no matches", () => {
		const { length } = findLongestStreak([], (m) => m.result === "W");
		expect(length).toBe(0);
	});

	it("should return 0 when predicate never matches", () => {
		const matches = [
			createMatch("L", 0, 2),
			createMatch("D", 1, 1),
		];

		const { length } = findLongestStreak(matches, (m) => m.result === "W");
		expect(length).toBe(0);
	});

	it("should handle entire array matching", () => {
		const matches = [
			createMatch("W", 2, 0),
			createMatch("W", 1, 0),
			createMatch("W", 3, 1),
		];

		const { length, startIndex } = findLongestStreak(
			matches,
			(m) => m.result === "W",
		);

		expect(length).toBe(3);
		expect(startIndex).toBe(0);
	});
});

describe("hasRecentStreakBreaker", () => {
	it("should detect win after losing streak", () => {
		const matches = [
			createMatch("W", 2, 0),
			createMatch("L", 0, 2),
			createMatch("L", 1, 3),
			createMatch("L", 0, 1),
		];

		expect(hasRecentStreakBreaker(matches)).toBe(true);
	});

	it("should return false if no win at start", () => {
		const matches = [
			createMatch("L", 0, 2),
			createMatch("L", 1, 3),
			createMatch("W", 2, 0),
		];

		expect(hasRecentStreakBreaker(matches)).toBe(false);
	});

	it("should return false if only one previous loss", () => {
		const matches = [
			createMatch("W", 2, 0),
			createMatch("L", 0, 2),
			createMatch("W", 1, 0),
		];

		expect(hasRecentStreakBreaker(matches)).toBe(false);
	});

	it("should return false for too few matches", () => {
		const matches = [createMatch("W", 2, 0)];
		expect(hasRecentStreakBreaker(matches)).toBe(false);
	});

	it("should respect lookback parameter", () => {
		const matches = [
			createMatch("W", 2, 0),
			createMatch("L", 0, 2),
			createMatch("L", 1, 3),
			createMatch("D", 1, 1),
		];

		// With default lookback of 5, should find the pattern
		expect(hasRecentStreakBreaker(matches, 5)).toBe(true);

		// With lookback of 2, only looks at W, L - not enough losses
		expect(hasRecentStreakBreaker(matches, 2)).toBe(false);
	});
});

describe("calculateStreakMomentum", () => {
	it("should return positive momentum for winning team", () => {
		const matches = [
			createMatch("W", 2, 0),
			createMatch("W", 1, 0),
			createMatch("W", 3, 1),
			createMatch("D", 1, 1),
			createMatch("L", 0, 2),
		];

		const momentum = calculateStreakMomentum(matches);
		expect(momentum).toBeGreaterThan(0);
		// 3W, 1D, 1L = (3 - 1) / 5 = 0.4
		expect(momentum).toBeCloseTo(0.4);
	});

	it("should return negative momentum for losing team", () => {
		const matches = [
			createMatch("L", 0, 2),
			createMatch("L", 1, 3),
			createMatch("L", 0, 1),
			createMatch("D", 1, 1),
			createMatch("W", 2, 0),
		];

		const momentum = calculateStreakMomentum(matches);
		expect(momentum).toBeLessThan(0);
		// 1W, 1D, 3L = (1 - 3) / 5 = -0.4
		expect(momentum).toBeCloseTo(-0.4);
	});

	it("should return 0 for balanced results", () => {
		const matches = [
			createMatch("W", 2, 0),
			createMatch("L", 0, 2),
			createMatch("D", 1, 1),
		];

		const momentum = calculateStreakMomentum(matches, 3);
		expect(momentum).toBe(0);
	});

	it("should return 0 for empty matches", () => {
		expect(calculateStreakMomentum([])).toBe(0);
	});

	it("should respect count parameter", () => {
		const matches = [
			createMatch("W", 2, 0),
			createMatch("W", 1, 0),
			createMatch("W", 3, 1),
			createMatch("L", 0, 2),
			createMatch("L", 1, 3),
		];

		// Last 3: WWW = 1.0
		expect(calculateStreakMomentum(matches, 3)).toBe(1.0);

		// Last 5: 3W, 2L = 0.2
		expect(calculateStreakMomentum(matches, 5)).toBeCloseTo(0.2);
	});

	it("should return 1.0 for all wins", () => {
		const matches = [
			createMatch("W", 2, 0),
			createMatch("W", 1, 0),
			createMatch("W", 3, 1),
		];

		expect(calculateStreakMomentum(matches, 3)).toBe(1.0);
	});

	it("should return -1.0 for all losses", () => {
		const matches = [
			createMatch("L", 0, 2),
			createMatch("L", 1, 3),
			createMatch("L", 0, 1),
		];

		expect(calculateStreakMomentum(matches, 3)).toBe(-1.0);
	});
});

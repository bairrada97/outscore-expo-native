/**
 * Tests for tier-helpers.ts
 *
 * Tier and Efficiency Index calculations including Mind/Mood layers,
 * gap detection, and regression risk analysis.
 */

import { describe, expect, it } from "vitest";
import type { ProcessedMatch, TeamTier } from "../types";
import {
	calculateEfficiencyIndex,
	calculateAvgPointsPerGame,
	calculateGoalDifference,
	categorizeTier,
	calculateMoodTier,
	calculateMindLayer,
	calculateMoodLayer,
	detectMoodVsMindGap,
	detectOneSeasonWonder,
	getSeasonsInCurrentLeague,
	countConsecutiveWins,
	detectRegressionRisk,
	assessMindDataQuality,
	calculateDataQualityMultiplier,
	getTierDescription,
	calculateTierGap,
	hasSignificantTierGap,
} from "./tier-helpers";

// Helper to create a processed match for testing
function createMatch(
	result: "W" | "D" | "L",
	goalsScored: number,
	goalsConceded: number,
	overrides: Partial<ProcessedMatch> = {},
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
		...overrides,
	};
}

describe("calculateEfficiencyIndex", () => {
	it("should return 1.0 for empty matches", () => {
		const ei = calculateEfficiencyIndex([]);
		expect(ei).toBe(1.0);
	});

	it("should calculate EI correctly for winning team", () => {
		const matches = [
			createMatch("W", 2, 0), // 3 pts, +2 GD
			createMatch("W", 3, 1), // 3 pts, +2 GD
			createMatch("W", 1, 0), // 3 pts, +1 GD
		];

		const ei = calculateEfficiencyIndex(matches);

		// Average PPG = 9/3 = 3
		// Average GD per game = 5/3 = 1.67
		// EI = 3 + (1.67/10) = 3.167
		expect(ei).toBeCloseTo(3.167, 2);
	});

	it("should calculate EI correctly for losing team", () => {
		const matches = [
			createMatch("L", 0, 2), // 0 pts, -2 GD
			createMatch("L", 1, 3), // 0 pts, -2 GD
			createMatch("L", 0, 1), // 0 pts, -1 GD
		];

		const ei = calculateEfficiencyIndex(matches);

		// Average PPG = 0
		// Average GD per game = -5/3 = -1.67
		// EI = 0 + (-1.67/10) = -0.167
		expect(ei).toBeCloseTo(-0.167, 2);
	});

	it("should calculate EI correctly for mid-table team", () => {
		const matches = [
			createMatch("W", 2, 1), // 3 pts, +1 GD
			createMatch("D", 1, 1), // 1 pt, 0 GD
			createMatch("L", 0, 1), // 0 pts, -1 GD
			createMatch("D", 0, 0), // 1 pt, 0 GD
		];

		const ei = calculateEfficiencyIndex(matches);

		// Average PPG = 5/4 = 1.25
		// Average GD per game = 0/4 = 0
		// EI = 1.25 + 0 = 1.25
		expect(ei).toBeCloseTo(1.25, 2);
	});

	it("should normalize by match count to prevent scale blow-up", () => {
		// 50 matches with same per-game stats should give same EI as 5 matches
		const fiveMatches = Array(5).fill(null).map(() => createMatch("W", 2, 1));
		const fiftyMatches = Array(50).fill(null).map(() => createMatch("W", 2, 1));

		const eiFive = calculateEfficiencyIndex(fiveMatches);
		const eiFifty = calculateEfficiencyIndex(fiftyMatches);

		// Both should give same EI since formula is per-game based
		expect(eiFive).toBeCloseTo(eiFifty, 2);
	});
});

describe("calculateAvgPointsPerGame", () => {
	it("should return 1.0 for empty matches", () => {
		expect(calculateAvgPointsPerGame([])).toBe(1.0);
	});

	it("should calculate correctly for all wins", () => {
		const matches = [
			createMatch("W", 1, 0),
			createMatch("W", 2, 1),
			createMatch("W", 3, 0),
		];

		expect(calculateAvgPointsPerGame(matches)).toBe(3.0);
	});

	it("should calculate correctly for mixed results", () => {
		const matches = [
			createMatch("W", 1, 0), // 3 pts
			createMatch("D", 1, 1), // 1 pt
			createMatch("L", 0, 2), // 0 pts
		];

		expect(calculateAvgPointsPerGame(matches)).toBeCloseTo(4 / 3, 2);
	});
});

describe("calculateGoalDifference", () => {
	it("should return 0 for empty matches", () => {
		expect(calculateGoalDifference([])).toBe(0);
	});

	it("should calculate positive GD", () => {
		const matches = [
			createMatch("W", 3, 1),
			createMatch("W", 2, 0),
		];

		expect(calculateGoalDifference(matches)).toBe(4);
	});

	it("should calculate negative GD", () => {
		const matches = [
			createMatch("L", 0, 2),
			createMatch("L", 1, 3),
		];

		expect(calculateGoalDifference(matches)).toBe(-4);
	});
});

describe("categorizeTier", () => {
	it("should return tier 1 for elite EI (>= 2.0)", () => {
		expect(categorizeTier(2.5)).toBe(1);
		expect(categorizeTier(2.0)).toBe(1);
	});

	it("should return tier 2 for strong EI (>= 1.5)", () => {
		expect(categorizeTier(1.8)).toBe(2);
		expect(categorizeTier(1.5)).toBe(2);
	});

	it("should return tier 3 for mid EI (>= 1.0)", () => {
		expect(categorizeTier(1.2)).toBe(3);
		expect(categorizeTier(1.0)).toBe(3);
	});

	it("should return tier 4 for lower EI (< 1.0)", () => {
		expect(categorizeTier(0.9)).toBe(4);
		expect(categorizeTier(0.5)).toBe(4);
		expect(categorizeTier(0)).toBe(4);
	});

	it("should handle negative EI", () => {
		expect(categorizeTier(-0.5)).toBe(4);
	});
});

describe("calculateMoodTier", () => {
	it("should return tier 3 for empty matches", () => {
		expect(calculateMoodTier([])).toBe(3);
	});

	it("should use only last 10 matches", () => {
		// Create 15 matches: first 5 wins, last 10 losses
		const winMatches = Array(5).fill(null).map(() => createMatch("W", 3, 0));
		const lossMatches = Array(10).fill(null).map(() => createMatch("L", 0, 2));

		// Most recent first, so losses come before wins
		const matches = [...lossMatches, ...winMatches];

		const tier = calculateMoodTier(matches);

		// Should use only the 10 losses (most recent)
		expect(tier).toBe(4);
	});
});

describe("calculateMindLayer", () => {
	it("should calculate Mind layer with sufficient data", () => {
		const matches = Array(50).fill(null).map(() => createMatch("W", 2, 1));

		const mind = calculateMindLayer(matches);

		expect(mind.tier).toBe(1); // Elite tier
		expect(mind.matchCount).toBe(50);
		expect(mind.hasSufficientData).toBe(true);
	});

	it("should mark insufficient data for < 30 matches", () => {
		const matches = Array(20).fill(null).map(() => createMatch("W", 2, 1));

		const mind = calculateMindLayer(matches);

		expect(mind.matchCount).toBe(20);
		expect(mind.hasSufficientData).toBe(false);
	});

	it("should limit to 50 matches", () => {
		const matches = Array(100).fill(null).map(() => createMatch("W", 2, 1));

		const mind = calculateMindLayer(matches);

		expect(mind.matchCount).toBe(50);
	});
});

describe("calculateMoodLayer", () => {
	it("should return Mind tier when no recent matches", () => {
		const mind = {
			tier: 2 as TeamTier,
			efficiencyIndex: 1.6,
			avgPointsPerGame: 2.0,
			goalDifference: 10,
			matchCount: 50,
			hasSufficientData: true,
		};

		const mood = calculateMoodLayer([], mind, 5);

		expect(mood.tier).toBe(2);
		expect(mood.mindMoodGap).toBe(0);
	});

	it("should detect sleeping giant (Mind tier 1, Mood tier 3+)", () => {
		const mind = {
			tier: 1 as TeamTier,
			efficiencyIndex: 2.5,
			avgPointsPerGame: 2.5,
			goalDifference: 30,
			matchCount: 50,
			hasSufficientData: true,
		};

		// Recent bad form
		const recentMatches = Array(10).fill(null).map(() => createMatch("L", 0, 2));

		const mood = calculateMoodLayer(recentMatches, mind, 5);

		expect(mood.tier).toBeGreaterThanOrEqual(3);
		expect(mood.isSleepingGiant).toBe(true);
	});

	it("should detect over-performer (Mind tier 3+, Mood tier 1)", () => {
		const mind = {
			tier: 3 as TeamTier,
			efficiencyIndex: 1.0,
			avgPointsPerGame: 1.2,
			goalDifference: 0,
			matchCount: 50,
			hasSufficientData: true,
		};

		// Recent great form
		const recentMatches = Array(10).fill(null).map(() => createMatch("W", 3, 0));

		const mood = calculateMoodLayer(recentMatches, mind, 5);

		expect(mood.tier).toBe(1);
		expect(mood.isOverPerformer).toBe(true);
	});

	it("should calculate mindMoodGap correctly", () => {
		const mind = {
			tier: 1 as TeamTier,
			efficiencyIndex: 2.5,
			avgPointsPerGame: 2.5,
			goalDifference: 30,
			matchCount: 50,
			hasSufficientData: true,
		};

		// Recent bad form -> tier 4 mood
		const recentMatches = Array(10).fill(null).map(() => createMatch("L", 0, 2));

		const mood = calculateMoodLayer(recentMatches, mind, 5);

		// Gap = Mind tier - Mood tier = 1 - 4 = -3 (worse mood)
		expect(mood.mindMoodGap).toBe(1 - mood.tier);
	});

	it("should calculate form stats correctly", () => {
		const mind = {
			tier: 2 as TeamTier,
			efficiencyIndex: 1.6,
			avgPointsPerGame: 2.0,
			goalDifference: 10,
			matchCount: 50,
			hasSufficientData: true,
		};

		const recentMatches = [
			createMatch("W", 2, 0),
			createMatch("W", 1, 0),
			createMatch("D", 1, 1),
			createMatch("L", 0, 2),
			createMatch("W", 3, 1),
		];

		const mood = calculateMoodLayer(recentMatches, mind, 5);

		expect(mood.last10Points).toBe(10); // 3+3+1+0+3
		expect(mood.last10GoalsScored).toBe(7);
		expect(mood.last10GoalsConceded).toBe(4);
		expect(mood.formString).toBe("WWDLW");
	});
});

describe("detectMoodVsMindGap", () => {
	it("should detect sleeping giant", () => {
		const { isSleepingGiant, isOverPerformer, isOneSeasonWonder } =
			detectMoodVsMindGap(1, 4, 5);

		expect(isSleepingGiant).toBe(true);
		expect(isOverPerformer).toBe(false);
	});

	it("should detect over-performer", () => {
		const { isSleepingGiant, isOverPerformer, isOneSeasonWonder } =
			detectMoodVsMindGap(4, 1, 5);

		expect(isSleepingGiant).toBe(false);
		expect(isOverPerformer).toBe(true);
	});

	it("should NOT detect patterns for stable teams", () => {
		const { isSleepingGiant, isOverPerformer, isOneSeasonWonder } =
			detectMoodVsMindGap(2, 2, 5);

		expect(isSleepingGiant).toBe(false);
		expect(isOverPerformer).toBe(false);
		expect(isOneSeasonWonder).toBe(false);
	});
});

describe("detectOneSeasonWonder", () => {
	it("should detect one-season wonder", () => {
		// Recently promoted (<=2 seasons), Mind tier 3-4, Mood tier 1-2
		expect(detectOneSeasonWonder(3, 1, 1)).toBe(true);
		expect(detectOneSeasonWonder(4, 2, 2)).toBe(true);
	});

	it("should NOT detect for established teams", () => {
		// More than 2 seasons in league
		expect(detectOneSeasonWonder(4, 1, 3)).toBe(false);
	});

	it("should NOT detect for elite teams", () => {
		// Mind tier 1-2
		expect(detectOneSeasonWonder(2, 1, 1)).toBe(false);
	});

	it("should NOT detect if not in good form", () => {
		// Mood tier 3-4
		expect(detectOneSeasonWonder(4, 3, 1)).toBe(false);
	});
});

describe("getSeasonsInCurrentLeague", () => {
	it("should return 1 for empty matches", () => {
		expect(getSeasonsInCurrentLeague([], 39)).toBe(1);
	});

	it("should count unique seasons in current league", () => {
		const matches = [
			createMatch("W", 2, 0, { season: 2024, league: { id: 39, name: "PL" } }),
			createMatch("W", 2, 0, { season: 2024, league: { id: 39, name: "PL" } }),
			createMatch("W", 2, 0, { season: 2023, league: { id: 39, name: "PL" } }),
			createMatch("W", 2, 0, { season: 2022, league: { id: 39, name: "PL" } }),
		];

		expect(getSeasonsInCurrentLeague(matches, 39)).toBe(3);
	});

	it("should ignore matches from other leagues", () => {
		const matches = [
			createMatch("W", 2, 0, { season: 2024, league: { id: 39, name: "PL" } }),
			createMatch("W", 2, 0, { season: 2023, league: { id: 140, name: "LaLiga" } }),
			createMatch("W", 2, 0, { season: 2022, league: { id: 39, name: "PL" } }),
		];

		expect(getSeasonsInCurrentLeague(matches, 39)).toBe(2);
	});
});

describe("countConsecutiveWins", () => {
	it("should count consecutive wins", () => {
		const matches = [
			createMatch("W", 2, 0),
			createMatch("W", 1, 0),
			createMatch("W", 3, 1),
			createMatch("D", 1, 1),
			createMatch("W", 2, 0),
		];

		expect(countConsecutiveWins(matches)).toBe(3);
	});

	it("should return 0 if first match is not a win", () => {
		const matches = [
			createMatch("D", 1, 1),
			createMatch("W", 2, 0),
		];

		expect(countConsecutiveWins(matches)).toBe(0);
	});

	it("should handle all wins", () => {
		const matches = Array(5).fill(null).map(() => createMatch("W", 2, 0));
		expect(countConsecutiveWins(matches)).toBe(5);
	});

	it("should return 0 for empty matches", () => {
		expect(countConsecutiveWins([])).toBe(0);
	});
});

describe("detectRegressionRisk", () => {
	it("should detect regression risk for non-elite team on hot streak", () => {
		expect(detectRegressionRisk(3, 5)).toBe(true);
		expect(detectRegressionRisk(4, 6)).toBe(true);
	});

	it("should NOT detect for elite teams", () => {
		expect(detectRegressionRisk(1, 10)).toBe(false);
		expect(detectRegressionRisk(2, 8)).toBe(false);
	});

	it("should NOT detect for short winning streaks", () => {
		expect(detectRegressionRisk(3, 4)).toBe(false);
		expect(detectRegressionRisk(4, 3)).toBe(false);
	});
});

describe("assessMindDataQuality", () => {
	it("should return HIGH for >= 50 matches", () => {
		expect(assessMindDataQuality(50)).toBe("HIGH");
		expect(assessMindDataQuality(100)).toBe("HIGH");
	});

	it("should return MEDIUM for >= 30 matches", () => {
		expect(assessMindDataQuality(30)).toBe("MEDIUM");
		expect(assessMindDataQuality(40)).toBe("MEDIUM");
	});

	it("should return LOW for < 30 matches", () => {
		expect(assessMindDataQuality(20)).toBe("LOW");
		expect(assessMindDataQuality(10)).toBe("LOW");
	});

	it("should accept MindLayer object", () => {
		const mind = {
			tier: 2 as TeamTier,
			efficiencyIndex: 1.6,
			avgPointsPerGame: 2.0,
			goalDifference: 10,
			matchCount: 50,
			hasSufficientData: true,
		};

		expect(assessMindDataQuality(mind)).toBe("HIGH");
	});
});

describe("calculateDataQualityMultiplier", () => {
	it("should return 1.0 for ideal data", () => {
		expect(calculateDataQualityMultiplier(50, 10)).toBe(1.0);
	});

	it("should reduce for insufficient Mind data", () => {
		const multiplier = calculateDataQualityMultiplier(15, 10);
		expect(multiplier).toBeLessThan(1.0);
		expect(multiplier).toBeGreaterThan(0.7);
	});

	it("should reduce for insufficient Mood data", () => {
		const multiplier = calculateDataQualityMultiplier(50, 5);
		expect(multiplier).toBeLessThan(1.0);
		expect(multiplier).toBeGreaterThan(0.8);
	});

	it("should compound reductions", () => {
		const multiplier = calculateDataQualityMultiplier(15, 5);
		expect(multiplier).toBeLessThan(0.9);
	});

	it("should never go below 0.5", () => {
		expect(calculateDataQualityMultiplier(1, 1)).toBeGreaterThanOrEqual(0.5);
	});
});

describe("getTierDescription", () => {
	it("should return correct descriptions", () => {
		expect(getTierDescription(1)).toBe("Elite");
		expect(getTierDescription(2)).toBe("Top Tier");
		expect(getTierDescription(3)).toBe("Mid Tier");
		expect(getTierDescription(4)).toBe("Lower Tier");
	});

	it("should return Unknown for invalid tier", () => {
		expect(getTierDescription(5 as TeamTier)).toBe("Unknown");
		expect(getTierDescription(0 as TeamTier)).toBe("Unknown");
	});
});

describe("calculateTierGap", () => {
	it("should return positive when home is better", () => {
		expect(calculateTierGap(1, 4)).toBe(3);
		expect(calculateTierGap(2, 3)).toBe(1);
	});

	it("should return negative when away is better", () => {
		expect(calculateTierGap(4, 1)).toBe(-3);
		expect(calculateTierGap(3, 2)).toBe(-1);
	});

	it("should return 0 for equal tiers", () => {
		expect(calculateTierGap(2, 2)).toBe(0);
	});
});

describe("hasSignificantTierGap", () => {
	it("should return true for gap >= 2", () => {
		expect(hasSignificantTierGap(1, 3)).toBe(true);
		expect(hasSignificantTierGap(1, 4)).toBe(true);
		expect(hasSignificantTierGap(4, 1)).toBe(true);
	});

	it("should return false for gap < 2", () => {
		expect(hasSignificantTierGap(1, 2)).toBe(false);
		expect(hasSignificantTierGap(2, 3)).toBe(false);
		expect(hasSignificantTierGap(2, 2)).toBe(false);
	});

	it("should support custom threshold", () => {
		expect(hasSignificantTierGap(1, 2, 1)).toBe(true);
		expect(hasSignificantTierGap(1, 4, 4)).toBe(false);
	});
});

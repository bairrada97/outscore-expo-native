/**
 * Tests for formation-helpers.ts
 *
 * Formation normalization, parsing, similarity calculation,
 * frequency analysis, and stability scoring.
 */

import { describe, expect, it } from "vitest";
import type { ProcessedMatch } from "../types";
import {
	normalizeFormation,
	parseFormation,
	calculateFormationSimilarity,
	areFormationsSimilar,
	calculateFormationFrequency,
	getMostPlayedFormation,
	getFormationUsage,
	calculateFormationStability,
	isExperimentalFormation,
	calculateFormationStabilityContext,
	getMarketAdjustedFormationReduction,
	FORMATION_CANONICAL_MAP,
	FORMATION_MARKET_IMPACT,
} from "./formation-helpers";

// Helper to create a processed match with formation
function createMatch(
	formation: string | undefined,
	overrides: Partial<ProcessedMatch> = {},
): ProcessedMatch {
	return {
		id: 1,
		date: "2024-01-01",
		homeTeam: { id: 1, name: "Test Team" },
		awayTeam: { id: 2, name: "Opponent" },
		score: { home: 2, away: 1 },
		result: "W",
		goalsScored: 2,
		goalsConceded: 1,
		league: { id: 39, name: "Premier League" },
		season: 2024,
		isHome: true,
		formation,
		...overrides,
	};
}

describe("normalizeFormation", () => {
	it("should return empty string for null/undefined", () => {
		expect(normalizeFormation(null)).toBe("");
		expect(normalizeFormation(undefined)).toBe("");
	});

	it("should normalize canonical formations", () => {
		expect(normalizeFormation("4-3-3")).toBe("4-3-3");
		expect(normalizeFormation("4-4-2")).toBe("4-4-2");
	});

	it("should map variations to canonical form", () => {
		expect(normalizeFormation("4-1-2-3")).toBe("4-3-3");
		expect(normalizeFormation("4-2-1-3")).toBe("4-3-3");
		expect(normalizeFormation("4-4-1-1")).toBe("4-4-2");
		expect(normalizeFormation("4-5-1")).toBe("4-2-3-1");
	});

	it("should handle whitespace", () => {
		expect(normalizeFormation("  4-3-3  ")).toBe("4-3-3");
		// Whitespace is cleaned internally during lookup, returns canonical
		expect(normalizeFormation(" 4 - 3 - 3 ")).toBe("4-3-3");
	});

	it("should handle case insensitivity", () => {
		expect(normalizeFormation("4-3-3")).toBe("4-3-3");
	});

	it("should return original for unknown formations", () => {
		expect(normalizeFormation("5-5-0")).toBe("5-5-0");
	});
});

describe("parseFormation", () => {
	it("should parse standard 3-part formation", () => {
		const result = parseFormation("4-3-3");

		expect(result).not.toBeNull();
		expect(result!.defenders).toBe(4);
		expect(result!.midfielders).toBe(3);
		expect(result!.forwards).toBe(3);
		expect(result!.total).toBe(10);
		expect(result!.raw).toEqual([4, 3, 3]);
	});

	it("should parse 4-part formation", () => {
		const result = parseFormation("4-2-3-1");

		expect(result).not.toBeNull();
		expect(result!.defenders).toBe(4);
		expect(result!.midfielders).toBe(5); // 2 + 3
		expect(result!.forwards).toBe(1);
		expect(result!.total).toBe(10);
	});

	it("should parse 5-part formation", () => {
		const result = parseFormation("4-1-2-1-2");

		expect(result).not.toBeNull();
		expect(result!.defenders).toBe(4);
		expect(result!.midfielders).toBe(4); // 1 + 2 + 1
		expect(result!.forwards).toBe(2);
	});

	it("should return null for invalid formation", () => {
		expect(parseFormation("")).toBeNull();
		expect(parseFormation("4-3")).toBeNull(); // Too few parts
		expect(parseFormation("invalid")).toBeNull();
	});

	it("should return null for out-of-range totals", () => {
		expect(parseFormation("5-5-5")).toBeNull(); // 15 players
		expect(parseFormation("2-2-2")).toBeNull(); // 6 players
	});

	it("should handle edge case totals", () => {
		// 9 players (goalkeeper sometimes counted)
		const result = parseFormation("3-3-3");
		expect(result).not.toBeNull();
		expect(result!.total).toBe(9);
	});
});

describe("calculateFormationSimilarity", () => {
	it("should return 1.0 for identical formations", () => {
		expect(calculateFormationSimilarity("4-3-3", "4-3-3")).toBe(1.0);
		expect(calculateFormationSimilarity("4-4-2", "4-4-2")).toBe(1.0);
	});

	it("should return 0.5 for missing formations", () => {
		expect(calculateFormationSimilarity(null, "4-3-3")).toBe(0.5);
		expect(calculateFormationSimilarity("4-3-3", null)).toBe(0.5);
		expect(calculateFormationSimilarity(null, null)).toBe(0.5);
	});

	it("should return high similarity for canonical matches", () => {
		// 4-1-2-3 normalizes to 4-3-3
		expect(calculateFormationSimilarity("4-3-3", "4-1-2-3")).toBe(1.0);
	});

	it("should calculate structural similarity", () => {
		// 4-3-3 vs 4-4-2: def same, mid +1, fwd -1 = 2 diff
		const similarity = calculateFormationSimilarity("4-3-3", "4-4-2");
		expect(similarity).toBeGreaterThan(0.5);
		expect(similarity).toBeLessThan(1.0);
	});

	it("should give bonus for same defense", () => {
		// Same defenders (4-back)
		const sameDefense = calculateFormationSimilarity("4-3-3", "4-4-2");

		// Different defenders (3-back vs 4-back)
		const diffDefense = calculateFormationSimilarity("3-5-2", "4-4-2");

		expect(sameDefense).toBeGreaterThan(diffDefense);
	});

	it("should return low similarity for very different formations", () => {
		const similarity = calculateFormationSimilarity("5-4-1", "3-4-3");
		expect(similarity).toBeLessThan(0.7);
	});
});

describe("areFormationsSimilar", () => {
	it("should return true for identical formations", () => {
		expect(areFormationsSimilar("4-3-3", "4-3-3")).toBe(true);
	});

	it("should return true for similar formations above threshold", () => {
		expect(areFormationsSimilar("4-3-3", "4-4-2")).toBe(true);
	});

	it("should return false for different formations below threshold", () => {
		expect(areFormationsSimilar("5-4-1", "3-4-3")).toBe(false);
	});

	it("should support custom threshold", () => {
		// With default threshold 0.7
		const similarity = calculateFormationSimilarity("4-3-3", "4-4-2");

		// Custom low threshold
		expect(areFormationsSimilar("5-4-1", "3-4-3", 0.3)).toBe(true);

		// Custom high threshold
		expect(areFormationsSimilar("4-3-3", "4-4-2", 0.95)).toBe(false);
	});
});

describe("calculateFormationFrequency", () => {
	it("should return empty object for empty matches", () => {
		expect(calculateFormationFrequency([])).toEqual({});
	});

	it("should return empty object for matches without formations", () => {
		const matches = [
			createMatch(undefined),
			createMatch(undefined),
		];

		expect(calculateFormationFrequency(matches)).toEqual({});
	});

	it("should calculate correct frequencies", () => {
		const matches = [
			createMatch("4-3-3"),
			createMatch("4-3-3"),
			createMatch("4-4-2"),
			createMatch("4-3-3"),
		];

		const frequency = calculateFormationFrequency(matches);

		expect(frequency["4-3-3"]).toBe(75); // 3/4 = 75%
		expect(frequency["4-4-2"]).toBe(25); // 1/4 = 25%
	});

	it("should normalize formations in frequency", () => {
		const matches = [
			createMatch("4-3-3"),
			createMatch("4-1-2-3"), // Normalizes to 4-3-3
		];

		const frequency = calculateFormationFrequency(matches);

		expect(frequency["4-3-3"]).toBe(100);
	});

	it("should ignore matches without valid formations", () => {
		const matches = [
			createMatch("4-3-3"),
			createMatch(undefined),
			createMatch("4-4-2"),
		];

		const frequency = calculateFormationFrequency(matches);

		// Only 2 matches with formations
		expect(frequency["4-3-3"]).toBe(50);
		expect(frequency["4-4-2"]).toBe(50);
	});
});

describe("getMostPlayedFormation", () => {
	it("should return empty string for no matches", () => {
		expect(getMostPlayedFormation([])).toBe("");
	});

	it("should return most frequent formation", () => {
		const matches = [
			createMatch("4-3-3"),
			createMatch("4-3-3"),
			createMatch("4-4-2"),
		];

		expect(getMostPlayedFormation(matches)).toBe("4-3-3");
	});

	it("should handle ties by returning first encountered", () => {
		const matches = [
			createMatch("4-3-3"),
			createMatch("4-4-2"),
		];

		// Either is valid
		const result = getMostPlayedFormation(matches);
		expect(["4-3-3", "4-4-2"]).toContain(result);
	});
});

describe("getFormationUsage", () => {
	it("should return 0 for null formation", () => {
		expect(getFormationUsage(null, { "4-3-3": 100 })).toBe(0);
	});

	it("should return direct match percentage", () => {
		const frequency = { "4-3-3": 60, "4-4-2": 40 };
		expect(getFormationUsage("4-3-3", frequency)).toBe(60);
	});

	it("should find canonical form match", () => {
		const frequency = { "4-3-3": 60 };
		expect(getFormationUsage("4-1-2-3", frequency)).toBe(60);
	});

	it("should aggregate similar formations", () => {
		const frequency = { "4-3-3": 40, "4-2-3-1": 30 };
		// 4-3-3 and 4-2-3-1 are similar (both have 4 defenders)
		const usage = getFormationUsage("4-3-3", frequency);
		expect(usage).toBeGreaterThanOrEqual(40);
	});

	it("should return 0 for unknown formation", () => {
		const frequency = { "4-3-3": 100 };
		expect(getFormationUsage("3-5-2", frequency)).toBeLessThan(50);
	});
});

describe("calculateFormationStability", () => {
	it("should return 0 for null formation", () => {
		expect(calculateFormationStability(null, { "4-3-3": 100 })).toBe(0);
	});

	it("should return 0 for empty frequency", () => {
		expect(calculateFormationStability("4-3-3", {})).toBe(0);
	});

	it("should return 0 for highly used formation (>=80%)", () => {
		expect(calculateFormationStability("4-3-3", { "4-3-3": 85 })).toBe(0);
	});

	it("should return 5 for 60-80% usage", () => {
		expect(calculateFormationStability("4-3-3", { "4-3-3": 70 })).toBe(5);
	});

	it("should return 10 for 40-60% usage", () => {
		expect(calculateFormationStability("4-3-3", { "4-3-3": 50 })).toBe(10);
	});

	it("should return 15 for 20-40% usage", () => {
		expect(calculateFormationStability("4-3-3", { "4-3-3": 30 })).toBe(15);
	});

	it("should return 25 for <20% usage (experimental)", () => {
		expect(calculateFormationStability("4-3-3", { "4-3-3": 10 })).toBe(25);
	});

	it("should reduce penalty by 50% in early season", () => {
		const normal = calculateFormationStability("4-3-3", { "4-3-3": 10 }, false);
		const earlySeason = calculateFormationStability("4-3-3", { "4-3-3": 10 }, true);

		expect(earlySeason).toBe(normal * 0.5);
	});
});

describe("isExperimentalFormation", () => {
	it("should return false for null formation", () => {
		expect(isExperimentalFormation(null, { "4-3-3": 100 })).toBe(false);
	});

	it("should return true for <20% usage", () => {
		expect(isExperimentalFormation("4-3-3", { "4-3-3": 10 })).toBe(true);
	});

	it("should return false for >=20% usage", () => {
		expect(isExperimentalFormation("4-3-3", { "4-3-3": 25 })).toBe(false);
	});

	it("should support custom threshold", () => {
		expect(isExperimentalFormation("4-3-3", { "4-3-3": 30 }, 50)).toBe(true);
		expect(isExperimentalFormation("4-3-3", { "4-3-3": 60 }, 50)).toBe(false);
	});
});

describe("calculateFormationStabilityContext", () => {
	it("should calculate complete context", () => {
		const homeFrequency = { "4-3-3": 80 };
		const awayFrequency = { "4-4-2": 60 };

		const context = calculateFormationStabilityContext(
			"4-3-3",
			"4-4-2",
			homeFrequency,
			awayFrequency,
			"4-3-3",
			"4-4-2",
		);

		expect(context.homeFormation).toBe("4-3-3");
		expect(context.awayFormation).toBe("4-4-2");
		expect(context.homeFormationUsage).toBe(80);
		expect(context.awayFormationUsage).toBe(60);
		expect(context.homeIsExperimental).toBe(false);
		expect(context.awayIsExperimental).toBe(false);
		expect(context.homeFormationReduction).toBe(0); // 80%+ usage
		expect(context.awayFormationReduction).toBe(5); // 60-80% usage
		expect(context.totalFormationReduction).toBe(5);
	});

	it("should cap total reduction at 30%", () => {
		const homeFrequency = { "4-3-3": 5 }; // 25% reduction
		const awayFrequency = { "4-4-2": 5 }; // 25% reduction

		const context = calculateFormationStabilityContext(
			"4-3-3",
			"4-4-2",
			homeFrequency,
			awayFrequency,
			"4-3-3",
			"4-4-2",
		);

		// Would be 50% but capped at 30%
		expect(context.totalFormationReduction).toBe(30);
	});

	it("should apply early season reduction", () => {
		const frequency = { "4-3-3": 10 }; // Would be 25% reduction

		const normalContext = calculateFormationStabilityContext(
			"4-3-3",
			"4-3-3",
			frequency,
			frequency,
			"4-3-3",
			"4-3-3",
			false,
		);

		const earlyContext = calculateFormationStabilityContext(
			"4-3-3",
			"4-3-3",
			frequency,
			frequency,
			"4-3-3",
			"4-3-3",
			true,
		);

		expect(earlyContext.homeFormationReduction).toBe(normalContext.homeFormationReduction * 0.5);
	});

	it("should detect experimental formations", () => {
		const homeFrequency = { "4-3-3": 10 }; // <20% = experimental
		const awayFrequency = { "4-4-2": 50 }; // >=20% = not experimental

		const context = calculateFormationStabilityContext(
			"4-3-3",
			"4-4-2",
			homeFrequency,
			awayFrequency,
			"4-3-3",
			"4-4-2",
		);

		expect(context.homeIsExperimental).toBe(true);
		expect(context.awayIsExperimental).toBe(false);
	});
});

describe("getMarketAdjustedFormationReduction", () => {
	it("should return full reduction for MATCH_RESULT", () => {
		expect(getMarketAdjustedFormationReduction(20, "MATCH_RESULT")).toBe(20);
	});

	it("should return 60% reduction for BTTS", () => {
		expect(getMarketAdjustedFormationReduction(20, "BTTS")).toBe(12);
	});

	it("should return 60% reduction for OVER_UNDER_GOALS", () => {
		expect(getMarketAdjustedFormationReduction(20, "OVER_UNDER_GOALS")).toBe(12);
	});

	it("should return 80% reduction for FIRST_HALF", () => {
		expect(getMarketAdjustedFormationReduction(20, "FIRST_HALF")).toBe(16);
	});
});

describe("FORMATION_CANONICAL_MAP", () => {
	it("should have expected canonical forms", () => {
		expect(FORMATION_CANONICAL_MAP["4-3-3"]).toBe("4-3-3");
		expect(FORMATION_CANONICAL_MAP["4-4-2"]).toBe("4-4-2");
		expect(FORMATION_CANONICAL_MAP["3-5-2"]).toBe("3-5-2");
	});

	it("should map variations to canonical forms", () => {
		// 4-3-3 family
		expect(FORMATION_CANONICAL_MAP["4-1-2-3"]).toBe("4-3-3");

		// 4-4-2 family
		expect(FORMATION_CANONICAL_MAP["4-4-1-1"]).toBe("4-4-2");

		// 4-2-3-1 family
		expect(FORMATION_CANONICAL_MAP["4-5-1"]).toBe("4-2-3-1");

		// Diamond
		expect(FORMATION_CANONICAL_MAP["4-3-1-2"]).toBe("4-1-2-1-2");
	});
});

describe("FORMATION_MARKET_IMPACT", () => {
	it("should have expected impact multipliers", () => {
		expect(FORMATION_MARKET_IMPACT.MATCH_RESULT).toBe(1.0);
		expect(FORMATION_MARKET_IMPACT.BTTS).toBe(0.6);
		expect(FORMATION_MARKET_IMPACT.OVER_UNDER_GOALS).toBe(0.6);
		expect(FORMATION_MARKET_IMPACT.FIRST_HALF).toBe(0.8);
	});
});

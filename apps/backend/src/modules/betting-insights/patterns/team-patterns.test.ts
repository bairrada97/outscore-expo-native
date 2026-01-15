/**
 * Tests for team-patterns.ts
 *
 * Team pattern detection including streaks, form, and Mind/Mood patterns.
 */

import { describe, expect, it } from "vitest";
import type { MindLayer, MoodLayer, ProcessedMatch } from "../types";
import {
	detectTeamPatterns,
	filterPatternsBySeverity,
	getPattern,
	getTopPatterns,
	hasPattern,
	type Pattern,
	type PatternType,
} from "./team-patterns";

// Helper to create a processed match
function createMatch(overrides: Partial<ProcessedMatch> = {}): ProcessedMatch {
	return {
		id: 1,
		date: "2024-01-01",
		homeTeam: { id: 1, name: "Test Team" },
		awayTeam: { id: 2, name: "Opponent" },
		score: { home: 2, away: 1 },
		isHome: true,
		result: "W" as const,
		goalsScored: 2,
		goalsConceded: 1,
		league: { id: 39, name: "Premier League" },
		season: 2024,
		...overrides,
	};
}

// Helper to create a series of wins
function createWinningStreak(count: number): ProcessedMatch[] {
	return Array.from({ length: count }, (_, i) =>
		createMatch({ id: i + 1, result: "W", goalsScored: 2, goalsConceded: 1 }),
	);
}

// Helper to create a series of losses
function createLosingStreak(count: number): ProcessedMatch[] {
	return Array.from({ length: count }, (_, i) =>
		createMatch({ id: i + 1, result: "L", goalsScored: 0, goalsConceded: 2 }),
	);
}

// Helper to create Mind layer
function createMindLayer(overrides: Partial<MindLayer> = {}): MindLayer {
	return {
		tier: 2,
		efficiencyIndex: 1.2,
		avgPointsPerGame: 1.7,
		goalDifference: 8,
		matchCount: 50,
		hasSufficientData: true,
		...overrides,
	};
}

// Helper to create Mood layer
function createMoodLayer(overrides: Partial<MoodLayer> = {}): MoodLayer {
	return {
		tier: 2,
		mindMoodGap: 0,
		isSleepingGiant: false,
		isOverPerformer: false,
		isOneSeasonWonder: false,
		formString: "WWDLW",
		last10Points: 16,
		last10GoalsScored: 15,
		last10GoalsConceded: 10,
		...overrides,
	};
}

describe("detectTeamPatterns", () => {
	it("should return empty array for empty matches", () => {
		const patterns = detectTeamPatterns([], undefined, undefined, "Test Team");
		expect(patterns).toHaveLength(0);
	});

	it("should detect a long winning streak (3+)", () => {
		const matches = createWinningStreak(5);
		const patterns = detectTeamPatterns(matches, undefined, undefined, "Test Team");

		const winningPattern = patterns.find((p) => p.type === "LONG_WINNING_STREAK");
		expect(winningPattern).toBeDefined();
		expect(winningPattern?.data.streak).toBe(5);
	});

	it("should detect a long losing streak (3+)", () => {
		const matches = createLosingStreak(4);
		const patterns = detectTeamPatterns(matches, undefined, undefined, "Test Team");

		const losingPattern = patterns.find((p) => p.type === "LONG_LOSING_STREAK");
		expect(losingPattern).toBeDefined();
		expect(losingPattern?.data.streak).toBe(4);
	});

	it("should detect scoring streak", () => {
		const matches = Array.from({ length: 6 }, (_, i) =>
			createMatch({ id: i + 1, goalsScored: 1 + (i % 2), goalsConceded: i % 3 }),
		);
		const patterns = detectTeamPatterns(matches, undefined, undefined, "Test Team");

		const scoringPattern = patterns.find((p) => p.type === "SCORING_STREAK");
		expect(scoringPattern).toBeDefined();
		expect(scoringPattern?.data.streak).toBe(6);
	});

	it("should detect scoring drought", () => {
		const matches = Array.from({ length: 3 }, (_, i) =>
			createMatch({
				id: i + 1,
				result: "L",
				goalsScored: 0,
				goalsConceded: 2,
			}),
		);
		const patterns = detectTeamPatterns(matches, undefined, undefined, "Test Team");

		const droughtPattern = patterns.find((p) => p.type === "SCORING_DROUGHT");
		expect(droughtPattern).toBeDefined();
		expect(droughtPattern?.data.streak).toBe(3);
	});

	it("should detect clean sheet streak", () => {
		const matches = Array.from({ length: 4 }, (_, i) =>
			createMatch({
				id: i + 1,
				result: "W",
				goalsScored: 2,
				goalsConceded: 0,
			}),
		);
		const patterns = detectTeamPatterns(matches, undefined, undefined, "Test Team");

		const cleanSheetPattern = patterns.find((p) => p.type === "CLEAN_SHEET_STREAK");
		expect(cleanSheetPattern).toBeDefined();
		expect(cleanSheetPattern?.data.streak).toBe(4);
	});

	it("should detect defensive collapse (2+ goals conceded in consecutive matches)", () => {
		const matches = Array.from({ length: 4 }, (_, i) =>
			createMatch({
				id: i + 1,
				result: "L",
				goalsScored: 1,
				goalsConceded: 3,
			}),
		);
		const patterns = detectTeamPatterns(matches, undefined, undefined, "Test Team");

		const collapsePattern = patterns.find((p) => p.type === "DEFENSIVE_COLLAPSE");
		expect(collapsePattern).toBeDefined();
		expect(collapsePattern?.data.streak).toBe(4);
	});

	it("should detect BTTS streak", () => {
		const matches = Array.from({ length: 4 }, (_, i) =>
			createMatch({
				id: i + 1,
				goalsScored: 1,
				goalsConceded: 1,
			}),
		);
		const patterns = detectTeamPatterns(matches, undefined, undefined, "Test Team");

		const bttsPattern = patterns.find((p) => p.type === "BTTS_STREAK");
		expect(bttsPattern).toBeDefined();
	});

	it("should detect over 2.5 streak", () => {
		const matches = Array.from({ length: 4 }, (_, i) =>
			createMatch({
				id: i + 1,
				goalsScored: 2,
				goalsConceded: 2, // Total 4 goals
			}),
		);
		const patterns = detectTeamPatterns(matches, undefined, undefined, "Test Team");

		const overPattern = patterns.find((p) => p.type === "OVER_25_STREAK");
		expect(overPattern).toBeDefined();
		expect(overPattern?.data.streak).toBe(4);
	});

	it("should detect under 2.5 streak", () => {
		const matches = Array.from({ length: 4 }, (_, i) =>
			createMatch({
				id: i + 1,
				goalsScored: 1,
				goalsConceded: 0, // Total 1 goal
			}),
		);
		const patterns = detectTeamPatterns(matches, undefined, undefined, "Test Team");

		const underPattern = patterns.find((p) => p.type === "UNDER_25_STREAK");
		expect(underPattern).toBeDefined();
		expect(underPattern?.data.streak).toBe(4);
	});

	it("should sort patterns by priority (highest first)", () => {
		const matches = createLosingStreak(5); // Will generate LONG_LOSING_STREAK
		const patterns = detectTeamPatterns(matches, undefined, undefined, "Test Team");

		// If multiple patterns, should be sorted by priority
		for (let i = 1; i < patterns.length; i++) {
			expect(patterns[i - 1].priority).toBeGreaterThanOrEqual(patterns[i].priority);
		}
	});
});

describe("detectTeamPatterns - Mind/Mood patterns", () => {
	it("should detect Sleeping Giant pattern", () => {
		const matches = createWinningStreak(3);
		const mind = createMindLayer({ tier: 1 }); // Elite team
		const mood = createMoodLayer({
			tier: 4,
			isSleepingGiant: true,
			mindMoodGap: -3,
		});

		const patterns = detectTeamPatterns(matches, mind, mood, "Test Team");
		const sleepingGiant = patterns.find((p) => p.type === "SLEEPING_GIANT");

		expect(sleepingGiant).toBeDefined();
		expect(sleepingGiant?.severity).toBe("HIGH");
	});

	it("should detect Over-Performer pattern", () => {
		const matches = createWinningStreak(3);
		const mind = createMindLayer({ tier: 4 }); // Weak team baseline
		const mood = createMoodLayer({
			tier: 1,
			isOverPerformer: true,
			mindMoodGap: 3,
		});

		const patterns = detectTeamPatterns(matches, mind, mood, "Test Team");
		const overPerformer = patterns.find((p) => p.type === "OVER_PERFORMER");

		expect(overPerformer).toBeDefined();
		expect(overPerformer?.severity).toBe("HIGH");
	});

	it("should detect One-Season Wonder pattern", () => {
		const matches = createWinningStreak(3);
		const mind = createMindLayer({ tier: 3 });
		const mood = createMoodLayer({
			tier: 1,
			isOneSeasonWonder: true,
		});

		const patterns = detectTeamPatterns(matches, mind, mood, "Test Team");
		const oneSeasonWonder = patterns.find((p) => p.type === "ONE_SEASON_WONDER");

		expect(oneSeasonWonder).toBeDefined();
		expect(oneSeasonWonder?.severity).toBe("MEDIUM");
	});

	it("should not detect Mind/Mood patterns when data is missing", () => {
		const matches = createWinningStreak(3);

		const patterns = detectTeamPatterns(matches, undefined, undefined, "Test Team");
		const mindMoodPatterns = patterns.filter(
			(p) =>
				p.type === "SLEEPING_GIANT" ||
				p.type === "OVER_PERFORMER" ||
				p.type === "ONE_SEASON_WONDER",
		);

		expect(mindMoodPatterns).toHaveLength(0);
	});
});

describe("detectTeamPatterns - Performance patterns", () => {
	it("should detect high scoring form (2.5+ avg)", () => {
		// Need 3+ matches with total > 25 goals for 10 matches = 2.5+ avg
		const matches = Array.from({ length: 10 }, (_, i) =>
			createMatch({
				id: i + 1,
				goalsScored: 3,
				goalsConceded: 1,
			}),
		);
		const patterns = detectTeamPatterns(matches, undefined, undefined, "Test Team");

		const highScoring = patterns.find((p) => p.type === "HIGH_SCORING_FORM");
		expect(highScoring).toBeDefined();
	});

	it("should detect defensive weakness (2.0+ avg conceded)", () => {
		const matches = Array.from({ length: 10 }, (_, i) =>
			createMatch({
				id: i + 1,
				goalsScored: 1,
				goalsConceded: 2,
			}),
		);
		const patterns = detectTeamPatterns(matches, undefined, undefined, "Test Team");

		const defensiveWeakness = patterns.find((p) => p.type === "DEFENSIVE_WEAKNESS");
		expect(defensiveWeakness).toBeDefined();
	});
});

describe("detectTeamPatterns - First half patterns", () => {
	it("should detect first half weakness (< 30% FH goals)", () => {
		const matches = Array.from({ length: 10 }, (_, i) =>
			createMatch({
				id: i + 1,
				goalsScored: 2,
				goalsConceded: 1,
				firstHalfGoals: i < 2 ? 1 : 0, // Only 20% with first half goals
			}),
		);
		const patterns = detectTeamPatterns(matches, undefined, undefined, "Test Team");

		const firstHalfWeakness = patterns.find((p) => p.type === "FIRST_HALF_WEAKNESS");
		expect(firstHalfWeakness).toBeDefined();
	});

	it("should detect first half strength (> 70% FH goals)", () => {
		const matches = Array.from({ length: 10 }, (_, i) =>
			createMatch({
				id: i + 1,
				goalsScored: 2,
				goalsConceded: 1,
				firstHalfGoals: i < 8 ? 1 : 0, // 80% with first half goals
			}),
		);
		const patterns = detectTeamPatterns(matches, undefined, undefined, "Test Team");

		const firstHalfStrength = patterns.find((p) => p.type === "FIRST_HALF_STRENGTH");
		expect(firstHalfStrength).toBeDefined();
	});

	it("should not detect first half patterns with insufficient data", () => {
		const matches = Array.from({ length: 3 }, (_, i) =>
			createMatch({
				id: i + 1,
				firstHalfGoals: 1,
			}),
		);
		const patterns = detectTeamPatterns(matches, undefined, undefined, "Test Team");

		const firstHalfPatterns = patterns.filter(
			(p) => p.type === "FIRST_HALF_WEAKNESS" || p.type === "FIRST_HALF_STRENGTH",
		);
		expect(firstHalfPatterns).toHaveLength(0);
	});
});

describe("detectTeamPatterns - Home/Away patterns", () => {
	it("should detect away dominance (60%+ away win rate)", () => {
		const awayMatches = Array.from({ length: 5 }, (_, i) =>
			createMatch({
				id: i + 1,
				isHome: false,
				result: i < 4 ? "W" : "D", // 80% away win rate
			}),
		);
		const homeMatches = Array.from({ length: 5 }, (_, i) =>
			createMatch({
				id: i + 6,
				isHome: true,
				result: i < 2 ? "W" : "L",
			}),
		);
		const patterns = detectTeamPatterns(
			[...awayMatches, ...homeMatches],
			undefined,
			undefined,
			"Test Team",
		);

		const awayDominance = patterns.find((p) => p.type === "AWAY_DOMINANCE");
		expect(awayDominance).toBeDefined();
	});

	it("should detect home form collapse (good away, poor home)", () => {
		const awayMatches = Array.from({ length: 4 }, (_, i) =>
			createMatch({
				id: i + 1,
				isHome: false,
				result: i < 3 ? "W" : "D", // 75% away win rate
			}),
		);
		const homeMatches = Array.from({ length: 4 }, (_, i) =>
			createMatch({
				id: i + 5,
				isHome: true,
				result: "L", // 0% home win rate
			}),
		);
		const patterns = detectTeamPatterns(
			[...awayMatches, ...homeMatches],
			undefined,
			undefined,
			"Test Team",
		);

		const homeCollapse = patterns.find((p) => p.type === "HOME_FORM_COLLAPSE");
		expect(homeCollapse).toBeDefined();
	});
});

describe("filterPatternsBySeverity", () => {
	const patterns: Pattern[] = [
		{
			type: "LONG_LOSING_STREAK",
			severity: "CRITICAL",
			priority: 100,
			description: "Critical pattern",
			data: {},
		},
		{
			type: "LONG_WINNING_STREAK",
			severity: "HIGH",
			priority: 95,
			description: "High pattern",
			data: {},
		},
		{
			type: "SCORING_STREAK",
			severity: "MEDIUM",
			priority: 72,
			description: "Medium pattern",
			data: {},
		},
		{
			type: "AWAY_DOMINANCE",
			severity: "LOW",
			priority: 45,
			description: "Low pattern",
			data: {},
		},
	];

	it("should filter to CRITICAL only", () => {
		const filtered = filterPatternsBySeverity(patterns, "CRITICAL");
		expect(filtered).toHaveLength(1);
		expect(filtered[0].severity).toBe("CRITICAL");
	});

	it("should filter to HIGH and above", () => {
		const filtered = filterPatternsBySeverity(patterns, "HIGH");
		expect(filtered).toHaveLength(2);
		expect(filtered.every((p) => p.severity === "CRITICAL" || p.severity === "HIGH")).toBe(
			true,
		);
	});

	it("should filter to MEDIUM and above", () => {
		const filtered = filterPatternsBySeverity(patterns, "MEDIUM");
		expect(filtered).toHaveLength(3);
	});

	it("should return all patterns for LOW", () => {
		const filtered = filterPatternsBySeverity(patterns, "LOW");
		expect(filtered).toHaveLength(4);
	});
});

describe("getTopPatterns", () => {
	it("should return top N patterns", () => {
		const patterns: Pattern[] = Array.from({ length: 10 }, (_, i) => ({
			type: "SCORING_STREAK" as PatternType,
			severity: "MEDIUM" as const,
			priority: 100 - i,
			description: `Pattern ${i}`,
			data: {},
		}));

		const top5 = getTopPatterns(patterns, 5);
		expect(top5).toHaveLength(5);
		expect(top5[0].priority).toBe(100);
		expect(top5[4].priority).toBe(96);
	});

	it("should return all if fewer than N patterns", () => {
		const patterns: Pattern[] = [
			{
				type: "SCORING_STREAK",
				severity: "MEDIUM",
				priority: 72,
				description: "Pattern",
				data: {},
			},
		];

		const top5 = getTopPatterns(patterns, 5);
		expect(top5).toHaveLength(1);
	});

	it("should default to 5 patterns", () => {
		const patterns: Pattern[] = Array.from({ length: 10 }, (_, i) => ({
			type: "SCORING_STREAK" as PatternType,
			severity: "MEDIUM" as const,
			priority: 100 - i,
			description: `Pattern ${i}`,
			data: {},
		}));

		const top = getTopPatterns(patterns);
		expect(top).toHaveLength(5);
	});
});

describe("hasPattern", () => {
	const patterns: Pattern[] = [
		{
			type: "LONG_WINNING_STREAK",
			severity: "HIGH",
			priority: 95,
			description: "Winning",
			data: {},
		},
		{
			type: "SCORING_STREAK",
			severity: "MEDIUM",
			priority: 72,
			description: "Scoring",
			data: {},
		},
	];

	it("should return true when pattern exists", () => {
		expect(hasPattern(patterns, "LONG_WINNING_STREAK")).toBe(true);
		expect(hasPattern(patterns, "SCORING_STREAK")).toBe(true);
	});

	it("should return false when pattern does not exist", () => {
		expect(hasPattern(patterns, "LONG_LOSING_STREAK")).toBe(false);
		expect(hasPattern(patterns, "SLEEPING_GIANT")).toBe(false);
	});
});

describe("getPattern", () => {
	const patterns: Pattern[] = [
		{
			type: "LONG_WINNING_STREAK",
			severity: "HIGH",
			priority: 95,
			description: "Winning streak",
			data: { streak: 5 },
		},
		{
			type: "SCORING_STREAK",
			severity: "MEDIUM",
			priority: 72,
			description: "Scoring streak",
			data: { streak: 8 },
		},
	];

	it("should return the pattern when it exists", () => {
		const pattern = getPattern(patterns, "LONG_WINNING_STREAK");
		expect(pattern).toBeDefined();
		expect(pattern?.data.streak).toBe(5);
	});

	it("should return undefined when pattern does not exist", () => {
		const pattern = getPattern(patterns, "LONG_LOSING_STREAK");
		expect(pattern).toBeUndefined();
	});
});

describe("Pattern severity thresholds", () => {
	it("should assign CRITICAL severity for 8+ winning streak", () => {
		const matches = createWinningStreak(8);
		const patterns = detectTeamPatterns(matches, undefined, undefined, "Test Team");

		const winningPattern = patterns.find((p) => p.type === "LONG_WINNING_STREAK");
		expect(winningPattern?.severity).toBe("CRITICAL");
	});

	it("should assign HIGH severity for 5-7 winning streak", () => {
		const matches = createWinningStreak(6);
		const patterns = detectTeamPatterns(matches, undefined, undefined, "Test Team");

		const winningPattern = patterns.find((p) => p.type === "LONG_WINNING_STREAK");
		expect(winningPattern?.severity).toBe("HIGH");
	});

	it("should assign MEDIUM severity for 3-4 winning streak", () => {
		const matches = createWinningStreak(3);
		const patterns = detectTeamPatterns(matches, undefined, undefined, "Test Team");

		const winningPattern = patterns.find((p) => p.type === "LONG_WINNING_STREAK");
		expect(winningPattern?.severity).toBe("MEDIUM");
	});

	it("should not detect winning streak for < 3 wins", () => {
		const matches = createWinningStreak(2);
		const patterns = detectTeamPatterns(matches, undefined, undefined, "Test Team");

		const winningPattern = patterns.find((p) => p.type === "LONG_WINNING_STREAK");
		expect(winningPattern).toBeUndefined();
	});
});

/**
 * Tests for h2h-patterns.ts
 *
 * Head-to-head pattern detection including BTTS, dominance, goals, and over/under patterns.
 */

import { describe, expect, it } from "vitest";
import type { H2HData, ProcessedMatch } from "../types";
import {
	detectH2HPatterns,
	getH2HDominantTeam,
	getH2HSummary,
	h2hSuggestsMarket,
	type H2HPatternType,
} from "./h2h-patterns";

// Type helper to safely compare pattern types
const hasType = (
	pattern: { type: string },
	targetType: H2HPatternType,
): boolean => pattern.type === targetType;

// Helper to create a processed match for H2H
function createH2HMatch(overrides: Partial<ProcessedMatch> = {}): ProcessedMatch {
	return {
		id: 1,
		date: "2024-01-01",
		homeTeam: { id: 1, name: "Home FC" },
		awayTeam: { id: 2, name: "Away United" },
		isHome: true,
		result: "W" as const,
		goalsScored: 2,
		goalsConceded: 1,
		score: { home: 2, away: 1 },
		league: { id: 39, name: "Premier League" },
		season: 2024,
		...overrides,
	};
}

// Helper to create H2H data
function createH2HData(overrides: Partial<H2HData> = {}): H2HData {
	return {
		h2hMatchCount: 5,
		homeTeamWins: 2,
		awayTeamWins: 1,
		draws: 2,
		avgGoals: 2.5,
		avgHomeGoals: 1.4,
		avgAwayGoals: 1.1,
		bttsCount: 3,
		bttsPercentage: 60,
		goalLineOverPct: { "2.5": 60 },
		goalLineOverCount: { "2.5": 3 },
		hasSufficientData: true,
		recencyWeights: [1, 0.9, 0.8, 0.7, 0.6],
		matches: [
			createH2HMatch({ id: 1, goalsScored: 2, goalsConceded: 1 }),
			createH2HMatch({ id: 2, goalsScored: 1, goalsConceded: 1 }),
			createH2HMatch({ id: 3, goalsScored: 2, goalsConceded: 2 }),
			createH2HMatch({ id: 4, goalsScored: 0, goalsConceded: 1, result: "L" }),
			createH2HMatch({ id: 5, goalsScored: 3, goalsConceded: 0 }),
		],
		...overrides,
	};
}

describe("detectH2HPatterns", () => {
	it("should return empty array for insufficient matches", () => {
		const h2hData = createH2HData({ h2hMatchCount: 2 });
		const patterns = detectH2HPatterns(h2hData, "Home FC", "Away United");
		expect(patterns).toHaveLength(0);
	});

	it("should detect H2H BTTS streak", () => {
		const matches = [
			createH2HMatch({ id: 1, goalsScored: 2, goalsConceded: 1, score: { home: 2, away: 1 } }),
			createH2HMatch({ id: 2, goalsScored: 1, goalsConceded: 2, score: { home: 1, away: 2 } }),
			createH2HMatch({ id: 3, goalsScored: 3, goalsConceded: 1, score: { home: 3, away: 1 } }),
			createH2HMatch({ id: 4, goalsScored: 1, goalsConceded: 1, score: { home: 1, away: 1 } }),
		];
		const h2hData = createH2HData({
			matches,
			h2hMatchCount: 4,
			bttsCount: 4,
			bttsPercentage: 100,
		});

		const patterns = detectH2HPatterns(h2hData, "Home FC", "Away United");
		const bttsPattern = patterns.find((p) => hasType(p, "H2H_BTTS_STREAK"));

		expect(bttsPattern).toBeDefined();
		expect(bttsPattern?.data.streak).toBe(4);
	});

	it("should detect high BTTS rate without streak", () => {
		const h2hData = createH2HData({
			bttsPercentage: 80,
			bttsCount: 4,
			h2hMatchCount: 5,
			matches: [
				createH2HMatch({ goalsScored: 2, goalsConceded: 0, score: { home: 2, away: 0 } }), // Breaks streak
				createH2HMatch({ goalsScored: 2, goalsConceded: 1, score: { home: 2, away: 1 } }),
				createH2HMatch({ goalsScored: 1, goalsConceded: 2, score: { home: 1, away: 2 } }),
				createH2HMatch({ goalsScored: 1, goalsConceded: 1, score: { home: 1, away: 1 } }),
				createH2HMatch({ goalsScored: 3, goalsConceded: 1, score: { home: 3, away: 1 } }),
			],
		});

		const patterns = detectH2HPatterns(h2hData, "Home FC", "Away United");
		const highBttsPattern = patterns.find((p) => hasType(p, "H2H_HIGH_BTTS_RATE"));

		expect(highBttsPattern).toBeDefined();
		expect(highBttsPattern?.data.bttsRate).toBe(80);
	});

	it("should detect no BTTS streak", () => {
		const matches = [
			createH2HMatch({ goalsScored: 2, goalsConceded: 0, score: { home: 2, away: 0 } }),
			createH2HMatch({ goalsScored: 0, goalsConceded: 1, score: { home: 0, away: 1 } }),
			createH2HMatch({ goalsScored: 0, goalsConceded: 0, score: { home: 0, away: 0 } }),
		];
		const h2hData = createH2HData({
			matches,
			h2hMatchCount: 3,
			bttsCount: 0,
			bttsPercentage: 0,
		});

		const patterns = detectH2HPatterns(h2hData, "Home FC", "Away United");
		const noBttsPattern = patterns.find((p) => hasType(p, "H2H_NO_BTTS_STREAK"));

		expect(noBttsPattern).toBeDefined();
		expect(noBttsPattern?.data.streak).toBe(3);
	});

	it("should detect home team dominance", () => {
		const h2hData = createH2HData({
			h2hMatchCount: 5,
			homeTeamWins: 4,
			awayTeamWins: 0,
			draws: 1,
		});

		const patterns = detectH2HPatterns(h2hData, "Home FC", "Away United");
		const dominancePattern = patterns.find(
			(p) => hasType(p, "H2H_DOMINANCE") && p.data.dominantTeam === "home",
		);

		expect(dominancePattern).toBeDefined();
		expect(dominancePattern?.data.winRate).toBe(80);
	});

	it("should detect away team dominance", () => {
		const h2hData = createH2HData({
			h2hMatchCount: 5,
			homeTeamWins: 0,
			awayTeamWins: 4,
			draws: 1,
		});

		const patterns = detectH2HPatterns(h2hData, "Home FC", "Away United");
		const dominancePattern = patterns.find(
			(p) => hasType(p, "H2H_DOMINANCE") && p.data.dominantTeam === "away",
		);

		expect(dominancePattern).toBeDefined();
		expect(dominancePattern?.data.winRate).toBe(80);
	});

	it("should detect high scoring H2H", () => {
		const h2hData = createH2HData({
			avgGoals: 4.0,
		});

		const patterns = detectH2HPatterns(h2hData, "Home FC", "Away United");
		const highScoringPattern = patterns.find((p) => hasType(p, "H2H_HIGH_SCORING"));

		expect(highScoringPattern).toBeDefined();
		expect(highScoringPattern?.data.avgGoals).toBe(4.0);
		expect(highScoringPattern?.severity).toBe("HIGH");
	});

	it("should detect low scoring H2H", () => {
		const h2hData = createH2HData({
			avgGoals: 1.2,
		});

		const patterns = detectH2HPatterns(h2hData, "Home FC", "Away United");
		const lowScoringPattern = patterns.find((p) => hasType(p, "H2H_LOW_SCORING"));

		expect(lowScoringPattern).toBeDefined();
		expect(lowScoringPattern?.data.avgGoals).toBe(1.2);
	});

	it("should detect over 2.5 streak", () => {
		const matches = [
			createH2HMatch({ goalsScored: 2, goalsConceded: 2, score: { home: 2, away: 2 } }), // 4 goals
			createH2HMatch({ goalsScored: 3, goalsConceded: 1, score: { home: 3, away: 1 } }), // 4 goals
			createH2HMatch({ goalsScored: 2, goalsConceded: 1, score: { home: 2, away: 1 } }), // 3 goals
		];
		const h2hData = createH2HData({
			matches,
			h2hMatchCount: 3,
			goalLineOverPct: { "2.5": 100 },
			goalLineOverCount: { "2.5": 3 },
		});

		const patterns = detectH2HPatterns(h2hData, "Home FC", "Away United");
		const overPattern = patterns.find((p) => hasType(p, "H2H_OVER_25_STREAK"));

		expect(overPattern).toBeDefined();
		expect(overPattern?.data.streak).toBe(3);
	});

	it("should detect under 2.5 streak", () => {
		const matches = [
			createH2HMatch({ goalsScored: 1, goalsConceded: 0, score: { home: 1, away: 0 } }), // 1 goal
			createH2HMatch({ goalsScored: 0, goalsConceded: 1, score: { home: 0, away: 1 } }), // 1 goal
			createH2HMatch({ goalsScored: 1, goalsConceded: 1, score: { home: 1, away: 1 } }), // 2 goals
		];
		const h2hData = createH2HData({
			matches,
			h2hMatchCount: 3,
			goalLineOverPct: { "2.5": 0 },
			goalLineOverCount: { "2.5": 0 },
		});

		const patterns = detectH2HPatterns(h2hData, "Home FC", "Away United");
		const underPattern = patterns.find((p) => hasType(p, "H2H_UNDER_25_STREAK"));

		expect(underPattern).toBeDefined();
		expect(underPattern?.data.streak).toBe(3);
	});

	it("should detect high draw rate", () => {
		const h2hData = createH2HData({
			h2hMatchCount: 5,
			homeTeamWins: 1,
			awayTeamWins: 1,
			draws: 3, // 60% draws
		});

		const patterns = detectH2HPatterns(h2hData, "Home FC", "Away United");
		const drawPattern = patterns.find((p) => hasType(p, "H2H_DRAWS_COMMON"));

		expect(drawPattern).toBeDefined();
		expect(drawPattern?.data.drawRate).toBe(60);
	});

	it("should sort patterns by priority", () => {
		const h2hData = createH2HData({
			h2hMatchCount: 5,
			homeTeamWins: 4, // Dominance
			avgGoals: 4.0, // High scoring
			bttsPercentage: 80, // High BTTS
		});

		const patterns = detectH2HPatterns(h2hData, "Home FC", "Away United");

		// Should be sorted by priority (highest first)
		for (let i = 1; i < patterns.length; i++) {
			expect(patterns[i - 1].priority).toBeGreaterThanOrEqual(patterns[i].priority);
		}
	});
});

describe("detectH2HPatterns - Home/Away venue patterns", () => {
	it("should detect home venue dominance", () => {
		const matches = [
			createH2HMatch({ isHome: true, result: "W" }),
			createH2HMatch({ isHome: true, result: "W" }),
			createH2HMatch({ isHome: true, result: "W" }),
			createH2HMatch({ isHome: false, result: "L" }),
			createH2HMatch({ isHome: false, result: "L" }),
		];
		const h2hData = createH2HData({
			matches,
			h2hMatchCount: 5,
			homeTeamWins: 3,
			awayTeamWins: 0,
			draws: 2,
		});

		const patterns = detectH2HPatterns(h2hData, "Home FC", "Away United");
		const homeVenuePattern = patterns.find((p) => hasType(p, "H2H_HOME_DOMINANCE"));

		expect(homeVenuePattern).toBeDefined();
		expect(homeVenuePattern?.data.homeVenueWinRate).toBe(100);
	});

	it("should detect away upset trend", () => {
		const matches = [
			// Current home team (Home FC) is at home; away team wins at this venue => result "L"
			createH2HMatch({ isHome: true, result: "L" }),
			createH2HMatch({ isHome: true, result: "L" }),
			createH2HMatch({ isHome: true, result: "D" }),
			// Extra matches elsewhere shouldn't affect the venue calculation
			createH2HMatch({ isHome: false, result: "W" }),
			createH2HMatch({ isHome: false, result: "W" }),
		];
		const h2hData = createH2HData({
			matches,
			h2hMatchCount: 5,
		});

		const patterns = detectH2HPatterns(h2hData, "Home FC", "Away United");
		const awayUpsetPattern = patterns.find((p) => hasType(p, "H2H_AWAY_UPSET_TREND"));

		expect(awayUpsetPattern).toBeDefined();
		// 2 away-team wins in 3 matches at Home FC venue = 66%
		expect(awayUpsetPattern?.data.awayVenueWinRate).toBeGreaterThanOrEqual(66);
	});
});

describe("getH2HSummary", () => {
	it("should return correct summary stats", () => {
		const h2hData = createH2HData({
			h2hMatchCount: 10,
			homeTeamWins: 4,
			awayTeamWins: 3,
			draws: 3,
			avgGoals: 2.8,
			bttsPercentage: 70,
			goalLineOverPct: { "2.5": 65 },
		});

		const summary = getH2HSummary(h2hData);

		expect(summary.bttsRate).toBe(70);
		expect(summary.over25Rate).toBe(65);
		expect(summary.homeWinRate).toBe(40);
		expect(summary.awayWinRate).toBe(30);
		expect(summary.drawRate).toBe(30);
		expect(summary.avgGoals).toBe(2.8);
		expect(summary.hasSufficientData).toBe(true);
	});

	it("should handle zero matches", () => {
		const h2hData = createH2HData({
			h2hMatchCount: 0,
			homeTeamWins: 0,
			awayTeamWins: 0,
			draws: 0,
		});

		const summary = getH2HSummary(h2hData);

		expect(summary.homeWinRate).toBe(0);
		expect(summary.awayWinRate).toBe(0);
		expect(summary.drawRate).toBe(0);
	});
});

describe("h2hSuggestsMarket", () => {
	it("should suggest BTTS_YES for high BTTS rate", () => {
		const h2hData = createH2HData({ bttsPercentage: 75 });
		expect(h2hSuggestsMarket(h2hData, "BTTS_YES")).toBe(true);
	});

	it("should not suggest BTTS_YES for low BTTS rate", () => {
		const h2hData = createH2HData({ bttsPercentage: 50 });
		expect(h2hSuggestsMarket(h2hData, "BTTS_YES")).toBe(false);
	});

	it("should suggest BTTS_NO for very low BTTS rate", () => {
		const h2hData = createH2HData({ bttsPercentage: 25 });
		expect(h2hSuggestsMarket(h2hData, "BTTS_NO")).toBe(true);
	});

	it("should not suggest BTTS_NO for moderate BTTS rate", () => {
		const h2hData = createH2HData({ bttsPercentage: 50 });
		expect(h2hSuggestsMarket(h2hData, "BTTS_NO")).toBe(false);
	});

	it("should suggest OVER_25 for high over 2.5 rate", () => {
		const h2hData = createH2HData({ goalLineOverPct: { "2.5": 75 } });
		expect(h2hSuggestsMarket(h2hData, "OVER_25")).toBe(true);
	});

	it("should not suggest OVER_25 for low over 2.5 rate", () => {
		const h2hData = createH2HData({ goalLineOverPct: { "2.5": 40 } });
		expect(h2hSuggestsMarket(h2hData, "OVER_25")).toBe(false);
	});

	it("should suggest UNDER_25 for very low over 2.5 rate", () => {
		const h2hData = createH2HData({ goalLineOverPct: { "2.5": 25 } });
		expect(h2hSuggestsMarket(h2hData, "UNDER_25")).toBe(true);
	});

	it("should not suggest UNDER_25 for moderate over 2.5 rate", () => {
		const h2hData = createH2HData({ goalLineOverPct: { "2.5": 50 } });
		expect(h2hSuggestsMarket(h2hData, "UNDER_25")).toBe(false);
	});

	it("should handle missing goalLineOverPct", () => {
		const h2hData = createH2HData({ goalLineOverPct: {} });
		expect(h2hSuggestsMarket(h2hData, "OVER_25")).toBe(false);
		expect(h2hSuggestsMarket(h2hData, "UNDER_25")).toBe(true);
	});
});

describe("getH2HDominantTeam", () => {
	it("should return 'home' when home team dominates", () => {
		const h2hData = createH2HData({
			h2hMatchCount: 5,
			homeTeamWins: 4,
			awayTeamWins: 0,
			draws: 1,
		});

		expect(getH2HDominantTeam(h2hData)).toBe("home");
	});

	it("should return 'away' when away team dominates", () => {
		const h2hData = createH2HData({
			h2hMatchCount: 5,
			homeTeamWins: 0,
			awayTeamWins: 4,
			draws: 1,
		});

		expect(getH2HDominantTeam(h2hData)).toBe("away");
	});

	it("should return null when no clear dominance", () => {
		const h2hData = createH2HData({
			h2hMatchCount: 5,
			homeTeamWins: 2,
			awayTeamWins: 2,
			draws: 1,
		});

		expect(getH2HDominantTeam(h2hData)).toBeNull();
	});

	it("should return null for insufficient matches", () => {
		const h2hData = createH2HData({
			h2hMatchCount: 2,
			homeTeamWins: 2,
			awayTeamWins: 0,
			draws: 0,
		});

		expect(getH2HDominantTeam(h2hData)).toBeNull();
	});
});

describe("H2H pattern severity", () => {
	it("should assign HIGH severity for 4+ BTTS streak", () => {
		const matches = Array.from({ length: 5 }, (_, i) =>
			createH2HMatch({
				id: i + 1,
				goalsScored: 2,
				goalsConceded: 1,
				score: { home: 2, away: 1 },
			}),
		);
		const h2hData = createH2HData({
			matches,
			h2hMatchCount: 5,
			bttsCount: 5,
			bttsPercentage: 100,
		});

		const patterns = detectH2HPatterns(h2hData, "Home FC", "Away United");
		const bttsPattern = patterns.find((p) => hasType(p, "H2H_BTTS_STREAK"));

		expect(bttsPattern?.severity).toBe("HIGH");
	});

	it("should assign MEDIUM severity for 3 BTTS streak", () => {
		const matches = [
			createH2HMatch({ goalsScored: 2, goalsConceded: 1, score: { home: 2, away: 1 } }),
			createH2HMatch({ goalsScored: 1, goalsConceded: 1, score: { home: 1, away: 1 } }),
			createH2HMatch({ goalsScored: 3, goalsConceded: 2, score: { home: 3, away: 2 } }),
		];
		const h2hData = createH2HData({
			matches,
			h2hMatchCount: 3,
			bttsCount: 3,
			bttsPercentage: 100,
		});

		const patterns = detectH2HPatterns(h2hData, "Home FC", "Away United");
		const bttsPattern = patterns.find((p) => hasType(p, "H2H_BTTS_STREAK"));

		expect(bttsPattern?.severity).toBe("MEDIUM");
	});

	it("should assign HIGH severity for 80%+ dominance", () => {
		const h2hData = createH2HData({
			h2hMatchCount: 5,
			homeTeamWins: 5,
			awayTeamWins: 0,
			draws: 0,
		});

		const patterns = detectH2HPatterns(h2hData, "Home FC", "Away United");
		const dominancePattern = patterns.find((p) => hasType(p, "H2H_DOMINANCE"));

		expect(dominancePattern?.severity).toBe("HIGH");
	});

	it("should assign MEDIUM severity for 70-79% dominance", () => {
		const h2hData = createH2HData({
			h2hMatchCount: 10,
			homeTeamWins: 7,
			awayTeamWins: 1,
			draws: 2,
		});

		const patterns = detectH2HPatterns(h2hData, "Home FC", "Away United");
		const dominancePattern = patterns.find((p) => hasType(p, "H2H_DOMINANCE"));

		expect(dominancePattern?.severity).toBe("MEDIUM");
	});
});

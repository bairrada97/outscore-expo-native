/**
 * Tests for insight-generator.ts
 *
 * Insight generation from patterns including templates, categorization, and formatting.
 */

import { describe, expect, it } from "vitest";
import type { Pattern, PatternSeverity, PatternType } from "../patterns/team-patterns";
import {
	categorizePattern,
	filterInsightsByCategory,
	filterInsightsBySeverity,
	formatInsight,
	formatInsights,
	generateInsight,
	generateInsights,
	generateMatchInsights,
	getInsightSummary,
	getSeverityBadge,
	getTopInsightPerCategory,
	getTopInsights,
	groupInsightsByCategory,
	type Insight,
	type InsightCategory,
} from "./insight-generator";

// Helper to create a pattern
function createPattern(
	type: PatternType,
	data: Record<string, unknown> = {},
	overrides: Partial<Pattern> = {},
): Pattern {
	return {
		type,
		severity: "MEDIUM",
		priority: 50,
		description: `Pattern: ${type}`,
		data,
		...overrides,
	};
}

describe("generateInsight", () => {
	it("should generate insight from winning streak pattern", () => {
		const pattern = createPattern("LONG_WINNING_STREAK", { streak: 5 }, { priority: 95 });
		const insight = generateInsight(pattern, "Test Team");

		expect(insight).toBeDefined();
		expect(insight?.text).toBe("Test Team has won 5 consecutive matches");
		expect(insight?.emoji).toBe("🔥");
		expect(insight?.category).toBe("FORM");
		expect(insight?.priority).toBe(95);
	});

	it("should generate insight from losing streak pattern", () => {
		const pattern = createPattern("LONG_LOSING_STREAK", { streak: 4 });
		const insight = generateInsight(pattern, "Test Team");

		expect(insight?.text).toBe("Test Team has lost 4 consecutive matches");
		expect(insight?.emoji).toBe("🔴");
	});

	it("should generate insight from unbeaten streak pattern", () => {
		const pattern = createPattern("LONG_UNBEATEN_STREAK", { streak: 8 });
		const insight = generateInsight(pattern, "Test Team");

		expect(insight?.text).toBe("Test Team is unbeaten in 8 consecutive matches");
		expect(insight?.emoji).toBe("💪");
	});

	it("should generate insight from scoring streak pattern", () => {
		const pattern = createPattern("SCORING_STREAK", { streak: 10 });
		const insight = generateInsight(pattern, "Test Team");

		expect(insight?.text).toBe("Test Team has scored in 10 consecutive matches");
		expect(insight?.category).toBe("SCORING");
	});

	it("should generate insight from clean sheet streak pattern", () => {
		const pattern = createPattern("CLEAN_SHEET_STREAK", { streak: 4 });
		const insight = generateInsight(pattern, "Test Team");

		expect(insight?.text).toBe("Test Team has kept 4 consecutive clean sheets");
		expect(insight?.category).toBe("DEFENSIVE");
	});

	it("should generate insight from sleeping giant pattern", () => {
		const pattern = createPattern("SLEEPING_GIANT", { mindTier: 1, moodTier: 4 });
		const insight = generateInsight(pattern, "Test Team");

		expect(insight?.text).toContain("Value Alert");
		expect(insight?.text).toContain("Tier 1 quality but in Tier 4 form");
	});

	it("should generate insight from over-performer pattern", () => {
		const pattern = createPattern("OVER_PERFORMER", { mindTier: 4, moodTier: 1 });
		const insight = generateInsight(pattern, "Test Team");

		expect(insight?.text).toContain("Regression Risk");
		expect(insight?.text).toContain("Tier 4 quality but in Tier 1 form");
	});

	it("should generate insight from H2H pattern", () => {
		const pattern = createPattern(
			"H2H_BTTS_STREAK" as PatternType,
			{ streak: 5 },
			{ priority: 85 },
		);
		const insight = generateInsight(pattern);

		expect(insight?.text).toBe("Both teams have scored in the last 5 H2H meetings");
		expect(insight?.category).toBe("H2H");
	});

	it("should generate insight from H2H dominance pattern", () => {
		const pattern = createPattern("H2H_DOMINANCE" as PatternType, {
			dominantTeam: "home",
			winRate: 75,
			wins: 6,
			totalMatches: 8,
		});
		const insight = generateInsight(pattern);

		expect(insight?.text).toBe("The home team has won 75% of H2H matches (6/8)");
	});

	it("should handle BTTS streak with streak count", () => {
		const pattern = createPattern("BTTS_STREAK", { streak: 6 });
		const insight = generateInsight(pattern, "Test Team");

		expect(insight?.text).toBe("Both teams have scored in the last 6 matches");
	});

	it("should handle BTTS streak with rate", () => {
		const pattern = createPattern("BTTS_STREAK", { bttsRate: 80 });
		const insight = generateInsight(pattern, "Test Team");

		expect(insight?.text).toBe("Both teams score 80% of the time");
	});

	it("should use fallback for unknown patterns", () => {
		const pattern = createPattern("UNKNOWN_PATTERN" as PatternType, {}, { description: "Unknown pattern description" });
		const insight = generateInsight(pattern);

		expect(insight?.text).toBe("Unknown pattern description");
		expect(insight?.emoji).toBe("📋");
	});

	it("should preserve pattern priority in insight", () => {
		const pattern = createPattern("LONG_WINNING_STREAK", { streak: 5 }, { priority: 100 });
		const insight = generateInsight(pattern, "Test Team");

		expect(insight?.priority).toBe(100);
	});

	it("should preserve pattern severity in insight", () => {
		const pattern = createPattern(
			"LONG_WINNING_STREAK",
			{ streak: 10 },
			{ severity: "CRITICAL" },
		);
		const insight = generateInsight(pattern, "Test Team");

		expect(insight?.severity).toBe("CRITICAL");
	});

	it("should never include 'undefined' when teamName is missing", () => {
		const pattern = createPattern("SCORING_STREAK", { streak: 12 });
		const insight = generateInsight(pattern);

		expect(insight?.text).toBeDefined();
		expect(insight?.text).not.toContain("undefined");
	});
});

describe("generateInsights", () => {
	it("should generate insights from multiple patterns", () => {
		const patterns: Pattern[] = [
			createPattern("LONG_WINNING_STREAK", { streak: 5 }, { priority: 95 }),
			createPattern("SCORING_STREAK", { streak: 8 }, { priority: 72 }),
			createPattern("CLEAN_SHEET_STREAK", { streak: 3 }, { priority: 70 }),
		];

		const insights = generateInsights(patterns, "Test Team");

		expect(insights).toHaveLength(3);
	});

	it("should sort insights by priority (highest first)", () => {
		const patterns: Pattern[] = [
			createPattern("SCORING_STREAK", { streak: 8 }, { priority: 72 }),
			createPattern("LONG_WINNING_STREAK", { streak: 5 }, { priority: 95 }),
			createPattern("CLEAN_SHEET_STREAK", { streak: 3 }, { priority: 70 }),
		];

		const insights = generateInsights(patterns, "Test Team");

		expect(insights[0].priority).toBe(95);
		expect(insights[1].priority).toBe(72);
		expect(insights[2].priority).toBe(70);
	});

	it("should return empty array for empty patterns", () => {
		const insights = generateInsights([], "Test Team");
		expect(insights).toHaveLength(0);
	});
});

describe("generateMatchInsights", () => {
	it("should combine home, away, and H2H insights", () => {
		const homePatterns: Pattern[] = [
			createPattern("LONG_WINNING_STREAK", { streak: 5 }, { priority: 95 }),
		];
		const awayPatterns: Pattern[] = [
			createPattern("SCORING_STREAK", { streak: 8 }, { priority: 72 }),
		];
		const h2hPatterns: Pattern[] = [
			createPattern("H2H_BTTS_STREAK" as PatternType, { streak: 4 }, { priority: 85 }),
		];

		const insights = generateMatchInsights(
			homePatterns,
			awayPatterns,
			h2hPatterns,
			"Home FC",
			"Away United",
		);

		expect(insights).toHaveLength(3);
		expect(insights[0].text).toContain("Home FC"); // Highest priority
	});

	it("should use correct team names in insights", () => {
		const homePatterns: Pattern[] = [
			createPattern("LONG_WINNING_STREAK", { streak: 5 }),
		];
		const awayPatterns: Pattern[] = [
			createPattern("LONG_LOSING_STREAK", { streak: 3 }),
		];

		const insights = generateMatchInsights(
			homePatterns,
			awayPatterns,
			[],
			"Home FC",
			"Away United",
		);

		const homeInsight = insights.find((i) => i.text.includes("Home FC"));
		const awayInsight = insights.find((i) => i.text.includes("Away United"));

		expect(homeInsight).toBeDefined();
		expect(awayInsight).toBeDefined();
	});

	it("should sort combined insights by priority", () => {
		const homePatterns: Pattern[] = [
			createPattern("SCORING_STREAK", { streak: 8 }, { priority: 50 }),
		];
		const awayPatterns: Pattern[] = [
			createPattern("LONG_WINNING_STREAK", { streak: 5 }, { priority: 90 }),
		];
		const h2hPatterns: Pattern[] = [
			createPattern("H2H_DOMINANCE" as PatternType, { dominantTeam: "home", winRate: 80, wins: 4, totalMatches: 5 }, { priority: 70 }),
		];

		const insights = generateMatchInsights(
			homePatterns,
			awayPatterns,
			h2hPatterns,
			"Home FC",
			"Away United",
		);

		expect(insights[0].priority).toBe(90);
		expect(insights[1].priority).toBe(70);
		expect(insights[2].priority).toBe(50);
	});
});

describe("categorizePattern", () => {
	it("should categorize form patterns correctly", () => {
		expect(categorizePattern("LONG_WINNING_STREAK")).toBe("FORM");
		expect(categorizePattern("LONG_LOSING_STREAK")).toBe("FORM");
		expect(categorizePattern("SLEEPING_GIANT")).toBe("FORM");
		expect(categorizePattern("OVER_PERFORMER")).toBe("FORM");
	});

	it("should categorize scoring patterns correctly", () => {
		expect(categorizePattern("SCORING_STREAK")).toBe("SCORING");
		expect(categorizePattern("SCORING_DROUGHT")).toBe("SCORING");
		expect(categorizePattern("HIGH_SCORING_FORM")).toBe("SCORING");
		expect(categorizePattern("BTTS_STREAK")).toBe("SCORING");
	});

	it("should categorize defensive patterns correctly", () => {
		expect(categorizePattern("CLEAN_SHEET_STREAK")).toBe("DEFENSIVE");
		expect(categorizePattern("CLEAN_SHEET_DROUGHT")).toBe("DEFENSIVE");
		expect(categorizePattern("DEFENSIVE_COLLAPSE")).toBe("DEFENSIVE");
	});

	it("should categorize timing patterns correctly", () => {
		expect(categorizePattern("FIRST_HALF_WEAKNESS")).toBe("TIMING");
		expect(categorizePattern("FIRST_HALF_STRENGTH")).toBe("TIMING");
	});

	it("should categorize safety patterns correctly", () => {
		expect(categorizePattern("REGRESSION_RISK")).toBe("SAFETY");
	});

	it("should default to FORM for unknown patterns", () => {
		expect(categorizePattern("UNKNOWN_PATTERN" as PatternType)).toBe("FORM");
	});
});

describe("filterInsightsByCategory", () => {
	const insights: Insight[] = [
		{
			text: "Form insight",
			emoji: "🔥",
			priority: 90,
			category: "FORM",
			severity: "HIGH",
			patternType: "LONG_WINNING_STREAK",
		},
		{
			text: "Scoring insight",
			emoji: "⚽",
			priority: 70,
			category: "SCORING",
			severity: "MEDIUM",
			patternType: "SCORING_STREAK",
		},
		{
			text: "H2H insight",
			emoji: "📊",
			priority: 80,
			category: "H2H",
			severity: "MEDIUM",
			patternType: "H2H_BTTS_STREAK" as PatternType,
		},
	];

	it("should filter by category", () => {
		const formInsights = filterInsightsByCategory(insights, "FORM");
		expect(formInsights).toHaveLength(1);
		expect(formInsights[0].category).toBe("FORM");
	});

	it("should return empty array when no matches", () => {
		const defensiveInsights = filterInsightsByCategory(insights, "DEFENSIVE");
		expect(defensiveInsights).toHaveLength(0);
	});
});

describe("groupInsightsByCategory", () => {
	const insights: Insight[] = [
		{
			text: "Form 1",
			emoji: "🔥",
			priority: 90,
			category: "FORM",
			severity: "HIGH",
			patternType: "LONG_WINNING_STREAK",
		},
		{
			text: "Form 2",
			emoji: "💪",
			priority: 80,
			category: "FORM",
			severity: "MEDIUM",
			patternType: "LONG_UNBEATEN_STREAK",
		},
		{
			text: "Scoring",
			emoji: "⚽",
			priority: 70,
			category: "SCORING",
			severity: "MEDIUM",
			patternType: "SCORING_STREAK",
		},
	];

	it("should group insights by category", () => {
		const grouped = groupInsightsByCategory(insights);

		expect(grouped.get("FORM")).toHaveLength(2);
		expect(grouped.get("SCORING")).toHaveLength(1);
	});

	it("should not include empty categories", () => {
		const grouped = groupInsightsByCategory(insights);

		expect(grouped.has("DEFENSIVE")).toBe(false);
		expect(grouped.has("H2H")).toBe(false);
	});
});

describe("filterInsightsBySeverity", () => {
	const insights: Insight[] = [
		{
			text: "Critical",
			emoji: "🔴",
			priority: 100,
			category: "FORM",
			severity: "CRITICAL",
			patternType: "LONG_LOSING_STREAK",
		},
		{
			text: "High",
			emoji: "🟠",
			priority: 80,
			category: "FORM",
			severity: "HIGH",
			patternType: "LONG_WINNING_STREAK",
		},
		{
			text: "Medium",
			emoji: "🟡",
			priority: 60,
			category: "SCORING",
			severity: "MEDIUM",
			patternType: "SCORING_STREAK",
		},
		{
			text: "Low",
			emoji: "🟢",
			priority: 40,
			category: "TIMING",
			severity: "LOW",
			patternType: "FIRST_HALF_WEAKNESS",
		},
	];

	it("should filter to CRITICAL only", () => {
		const filtered = filterInsightsBySeverity(insights, "CRITICAL");
		expect(filtered).toHaveLength(1);
		expect(filtered[0].severity).toBe("CRITICAL");
	});

	it("should filter to HIGH and above", () => {
		const filtered = filterInsightsBySeverity(insights, "HIGH");
		expect(filtered).toHaveLength(2);
	});

	it("should filter to MEDIUM and above", () => {
		const filtered = filterInsightsBySeverity(insights, "MEDIUM");
		expect(filtered).toHaveLength(3);
	});

	it("should return all for LOW", () => {
		const filtered = filterInsightsBySeverity(insights, "LOW");
		expect(filtered).toHaveLength(4);
	});
});

describe("getTopInsights", () => {
	const insights: Insight[] = Array.from({ length: 10 }, (_, i) => ({
		text: `Insight ${i}`,
		emoji: "📋",
		priority: 100 - i,
		category: "FORM" as InsightCategory,
		severity: "MEDIUM" as PatternSeverity,
		patternType: "LONG_WINNING_STREAK" as PatternType,
	}));

	it("should return top N insights", () => {
		const top5 = getTopInsights(insights, 5);
		expect(top5).toHaveLength(5);
		expect(top5[0].priority).toBe(100);
	});

	it("should return all if fewer than N", () => {
		const top20 = getTopInsights(insights, 20);
		expect(top20).toHaveLength(10);
	});
});

describe("getTopInsightPerCategory", () => {
	const insights: Insight[] = [
		{
			text: "Form High",
			emoji: "🔥",
			priority: 90,
			category: "FORM",
			severity: "HIGH",
			patternType: "LONG_WINNING_STREAK",
		},
		{
			text: "Form Low",
			emoji: "💪",
			priority: 50,
			category: "FORM",
			severity: "LOW",
			patternType: "LONG_UNBEATEN_STREAK",
		},
		{
			text: "Scoring",
			emoji: "⚽",
			priority: 70,
			category: "SCORING",
			severity: "MEDIUM",
			patternType: "SCORING_STREAK",
		},
	];

	it("should return highest priority per category", () => {
		const topPerCategory = getTopInsightPerCategory(insights);

		expect(topPerCategory.get("FORM")?.priority).toBe(90);
		expect(topPerCategory.get("SCORING")?.priority).toBe(70);
	});

	it("should only include categories with insights", () => {
		const topPerCategory = getTopInsightPerCategory(insights);

		expect(topPerCategory.has("FORM")).toBe(true);
		expect(topPerCategory.has("SCORING")).toBe(true);
		expect(topPerCategory.has("DEFENSIVE")).toBe(false);
	});
});

describe("formatInsight", () => {
	it("should format insight with emoji and text", () => {
		const insight: Insight = {
			text: "Team has won 5 matches",
			emoji: "🔥",
			priority: 90,
			category: "FORM",
			severity: "HIGH",
			patternType: "LONG_WINNING_STREAK",
		};

		const formatted = formatInsight(insight);
		expect(formatted).toBe("🔥 Team has won 5 matches");
	});
});

describe("formatInsights", () => {
	it("should format multiple insights", () => {
		const insights: Insight[] = [
			{
				text: "Insight 1",
				emoji: "🔥",
				priority: 90,
				category: "FORM",
				severity: "HIGH",
				patternType: "LONG_WINNING_STREAK",
			},
			{
				text: "Insight 2",
				emoji: "⚽",
				priority: 70,
				category: "SCORING",
				severity: "MEDIUM",
				patternType: "SCORING_STREAK",
			},
		];

		const formatted = formatInsights(insights);

		expect(formatted).toHaveLength(2);
		expect(formatted[0]).toBe("🔥 Insight 1");
		expect(formatted[1]).toBe("⚽ Insight 2");
	});
});

describe("getSeverityBadge", () => {
	it("should return correct badges for each severity", () => {
		expect(getSeverityBadge("CRITICAL")).toBe("🔴");
		expect(getSeverityBadge("HIGH")).toBe("🟠");
		expect(getSeverityBadge("MEDIUM")).toBe("🟡");
		expect(getSeverityBadge("LOW")).toBe("🟢");
	});

	it("should return default for unknown severity", () => {
		expect(getSeverityBadge("UNKNOWN" as PatternSeverity)).toBe("⚪");
	});
});

describe("getInsightSummary", () => {
	const insights: Insight[] = [
		{
			text: "Critical",
			emoji: "🔴",
			priority: 100,
			category: "FORM",
			severity: "CRITICAL",
			patternType: "LONG_LOSING_STREAK",
		},
		{
			text: "High 1",
			emoji: "🟠",
			priority: 90,
			category: "FORM",
			severity: "HIGH",
			patternType: "LONG_WINNING_STREAK",
		},
		{
			text: "High 2",
			emoji: "🟠",
			priority: 80,
			category: "SCORING",
			severity: "HIGH",
			patternType: "SCORING_STREAK",
		},
		{
			text: "Medium",
			emoji: "🟡",
			priority: 60,
			category: "H2H",
			severity: "MEDIUM",
			patternType: "H2H_BTTS_STREAK" as PatternType,
		},
	];

	it("should return correct total count", () => {
		const summary = getInsightSummary(insights);
		expect(summary.total).toBe(4);
	});

	it("should count critical and high severity correctly", () => {
		const summary = getInsightSummary(insights);
		expect(summary.byCriticalCount).toBe(1);
		expect(summary.byHighCount).toBe(2);
	});

	it("should count by category correctly", () => {
		const summary = getInsightSummary(insights);
		expect(summary.byCategory.FORM).toBe(2);
		expect(summary.byCategory.SCORING).toBe(1);
		expect(summary.byCategory.H2H).toBe(1);
		expect(summary.byCategory.DEFENSIVE).toBe(0);
	});

	it("should include top three formatted insights", () => {
		const summary = getInsightSummary(insights);
		expect(summary.topThree).toHaveLength(3);
		expect(summary.topThree[0]).toContain("🔴");
	});

	it("should handle empty insights", () => {
		const summary = getInsightSummary([]);
		expect(summary.total).toBe(0);
		expect(summary.byCriticalCount).toBe(0);
		expect(summary.topThree).toHaveLength(0);
	});
});

describe("H2H Insight Templates", () => {
	it("should generate H2H high BTTS rate insight", () => {
		const pattern = createPattern("H2H_HIGH_BTTS_RATE" as PatternType, {
			bttsRate: 80,
			bttsCount: 8,
			matchCount: 10,
		});
		const insight = generateInsight(pattern);

		expect(insight?.text).toBe("Both teams score in 80% of H2H matches (8/10)");
	});

	it("should generate H2H draws common insight", () => {
		const pattern = createPattern("H2H_DRAWS_COMMON" as PatternType, {
			drawRate: 40,
			draws: 4,
			matchCount: 10,
		});
		const insight = generateInsight(pattern);

		expect(insight?.text).toBe("40% of H2H matches end in draws (4/10)");
	});

	it("should generate H2H high scoring insight", () => {
		const pattern = createPattern("H2H_HIGH_SCORING" as PatternType, {
			avgGoals: 3.5,
		});
		const insight = generateInsight(pattern);

		expect(insight?.text).toBe("H2H matches average 3.5 goals per game");
	});

	it("should generate H2H over 2.5 streak insight", () => {
		const pattern = createPattern("H2H_OVER_25_STREAK" as PatternType, {
			streak: 4,
		});
		const insight = generateInsight(pattern);

		expect(insight?.text).toBe("3+ goals in the last 4 H2H meetings");
	});

	it("should generate H2H over 2.5 rate insight", () => {
		const pattern = createPattern("H2H_OVER_25_STREAK" as PatternType, {
			over25Rate: 75,
		});
		const insight = generateInsight(pattern);

		expect(insight?.text).toBe("3+ goals in 75% of H2H matches");
	});
});

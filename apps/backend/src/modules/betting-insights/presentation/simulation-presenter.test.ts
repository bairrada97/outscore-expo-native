import { describe, expect, it } from "vitest";
import { buildMostProbableOutcome } from "./simulation-presenter";

describe("simulation-presenter: buildMostProbableOutcome", () => {
	it("should use 'Slight lean' when MatchOutcome top is within 5% of runner-up", () => {
		const text = buildMostProbableOutcome({
			scenarioType: "MatchOutcome",
			probabilityDistribution: { home: 33.2, draw: 30.5, away: 36.2 },
		});
		expect(text).toContain("Match Outcome: Slight lean:");
		expect(text).toContain("Away side");
	});

	it("should not use 'Slight lean' when MatchOutcome is decisive", () => {
		const text = buildMostProbableOutcome({
			scenarioType: "MatchOutcome",
			probabilityDistribution: { home: 55, draw: 25, away: 20 },
		});
		expect(text).toContain("Match Outcome:");
		expect(text).not.toContain("Slight lean:");
	});

	it("should use 'Slight lean' for BTTS when Yes/No are close", () => {
		const text = buildMostProbableOutcome({
			scenarioType: "BothTeamsToScore",
			probabilityDistribution: { yes: 52.0, no: 48.0 },
		});
		expect(text).toContain("Both Teams To Score: Slight lean:");
	});
});

describe("simulation-presenter: buildModelReliabilityBreakdown", () => {
	it("should include a knockout cup volatility reason when matchType is CUP and isKnockout is true", async () => {
		const { buildModelReliabilityBreakdown } = await import("./simulation-presenter");
		const result = buildModelReliabilityBreakdown({
			level: "HIGH",
			homeMatchCount: 47,
			awayMatchCount: 47,
			h2hMatchCount: 5,
			h2hHasSufficientData: true,
			matchType: "CUP",
			isKnockout: true,
			isDerby: false,
			isNeutralVenue: false,
			isPostInternationalBreak: false,
			isEndOfSeason: false,
			capsHit: false,
		});
		expect(result.reasons.join(" ")).toContain("Knockout cup matches");
		expect(result.signals.context.isKnockout).toBe(true);
	});
});



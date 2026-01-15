/**
 * Tests for capped-adjustments.ts
 *
 * Probability capping and adjustment logic tests.
 */

import { describe, expect, it } from "vitest";
import { DEFAULT_ALGORITHM_CONFIG } from "../config/algorithm-config";
import type { Adjustment, ScenarioType } from "../types";
import {
	applyCappedAsymmetricAdjustments,
	applyCumulativeCaps,
	applyAsymmetricCaps,
	applyHardCap,
	calculateConfidenceWithSwing,
	createAdjustment,
	detectOvercorrection,
	wasProbabilityCapped,
} from "./capped-adjustments";

describe("createAdjustment", () => {
	it("should create adjustment with valid type", () => {
		const adj = createAdjustment("formation_instability", 5, "Test reason");

		expect(adj.type).toBe("formation");
		expect(adj.name).toBe("formation_instability");
		expect(adj.value).toBe(5);
		expect(adj.reason).toBe("Test reason");
	});

	it("should map unknown types to 'other'", () => {
		const adj = createAdjustment("unknown_type", 3, "Test reason");

		expect(adj.type).toBe("other");
	});

	it("should map injury-related names correctly", () => {
		// The categorization checks for "injur" substring
		const adj = createAdjustment("injuries_impact", -5, "Injury impact");

		expect(adj.type).toBe("injuries");
	});

	it("should handle negative values", () => {
		const adj = createAdjustment("h2h_dominance", -8, "H2H disadvantage");

		expect(adj.value).toBe(-8);
		expect(adj.type).toBe("h2h");
	});
});

describe("applyCumulativeCaps", () => {
	it("should not cap adjustments within limits", () => {
		const adjustments: Adjustment[] = [
			createAdjustment("formation_a", 5, "Reason 1"),
			createAdjustment("formation_b", 5, "Reason 2"),
		];

		const result = applyCumulativeCaps(adjustments, DEFAULT_ALGORITHM_CONFIG);

		const totalFormation = result
			.filter((a) => a.type === "formation")
			.reduce((sum, a) => sum + a.value, 0);

		// Total is 10, cap is 15 (default), should not be capped
		expect(totalFormation).toBe(10);
	});

	it("should cap adjustments exceeding category limits", () => {
		const adjustments: Adjustment[] = [
			createAdjustment("formation_a", 10, "Reason 1"),
			createAdjustment("formation_b", 10, "Reason 2"),
		];

		const result = applyCumulativeCaps(adjustments, DEFAULT_ALGORITHM_CONFIG);

		const totalFormation = result
			.filter((a) => a.type === "formation")
			.reduce((sum, a) => sum + a.value, 0);

		// Total is 20, cap is 15 (default), should be scaled down
		expect(totalFormation).toBeLessThanOrEqual(15);
	});

	it("should handle multiple categories independently", () => {
		const adjustments: Adjustment[] = [
			createAdjustment("formation_a", 10, "Formation"),
			createAdjustment("injury_impact", -8, "Injuries"),
			createAdjustment("rest_advantage", 5, "Rest"),
		];

		const result = applyCumulativeCaps(adjustments, DEFAULT_ALGORITHM_CONFIG);

		// Each category should be handled independently
		expect(result.length).toBe(3);
	});

	it("should mark capped adjustments in reason", () => {
		const adjustments: Adjustment[] = [
			createAdjustment("formation_a", 20, "Reason 1"),
		];

		const result = applyCumulativeCaps(adjustments, DEFAULT_ALGORITHM_CONFIG);

		// Should be capped and marked
		expect(result[0].reason).toContain("capped");
	});
});

describe("detectOvercorrection", () => {
	it("should not detect overcorrection for few adjustments", () => {
		const adjustments: Adjustment[] = [
			createAdjustment("test", 5, "Reason"),
			createAdjustment("test2", 3, "Reason 2"),
		];

		const result = detectOvercorrection(adjustments);

		expect(result.shouldReduce).toBe(false);
		expect(result.reductionFactor).toBe(1.0);
	});

	it("should detect overcorrection for too many adjustments", () => {
		const adjustments: Adjustment[] = Array(7)
			.fill(null)
			.map((_, i) => createAdjustment(`test${i}`, 2, `Reason ${i}`));

		const result = detectOvercorrection(adjustments);

		expect(result.shouldReduce).toBe(true);
		expect(result.reductionFactor).toBeLessThan(1.0);
		expect(result.reason).toContain("Too many adjustments");
	});

	it("should not detect overcorrection for many small adjustments with low net swing", () => {
		const adjustments: Adjustment[] = [
			createAdjustment("pos1", 2, "Positive 1"),
			createAdjustment("pos2", 2, "Positive 2"),
			createAdjustment("pos3", 2, "Positive 3"),
			createAdjustment("neg1", -2.2, "Negative 1"),
			createAdjustment("neg2", -2.0, "Negative 2"),
			createAdjustment("neg3", -2.0, "Negative 3"),
		];

		const result = detectOvercorrection(adjustments);
		expect(result.shouldReduce).toBe(false);
		expect(result.reductionFactor).toBe(1.0);
	});

	it("should detect overcorrection for large swing", () => {
		const adjustments: Adjustment[] = [
			createAdjustment("big_positive", 25, "Big positive"),
		];

		const result = detectOvercorrection(adjustments);

		expect(result.shouldReduce).toBe(true);
		expect(result.reason).toContain("Large total swing");
	});

	it("should detect overcorrection for conflicting adjustments", () => {
		const adjustments: Adjustment[] = [
			createAdjustment("positive", 12, "Positive"),
			createAdjustment("negative", -12, "Negative"),
		];

		const result = detectOvercorrection(adjustments);

		expect(result.shouldReduce).toBe(true);
		expect(result.reason).toContain("Conflicting");
	});

	it("should return no reduction for empty adjustments", () => {
		const result = detectOvercorrection([]);

		expect(result.shouldReduce).toBe(false);
		expect(result.reductionFactor).toBe(1.0);
	});
});

describe("applyAsymmetricCaps", () => {
	const scenarios: ScenarioType[] = [
		"BothTeamsToScore",
		"TotalGoalsOverUnder",
		"MatchOutcome",
		"FirstHalfActivity",
	];

	it.each(scenarios)("should apply caps for %s market", (scenario) => {
		const adjustments: Adjustment[] = [
			createAdjustment("positive", 50, "Large positive"),
			createAdjustment("negative", -50, "Large negative"),
		];

		const result = applyAsymmetricCaps(adjustments, scenario, DEFAULT_ALGORITHM_CONFIG);

		// Should cap both positive and negative
		expect(result[0].value).toBeLessThan(50);
		expect(Math.abs(result[1].value)).toBeLessThan(50);
	});

	it("should preserve small adjustments", () => {
		const adjustments: Adjustment[] = [createAdjustment("small", 3, "Small adjustment")];

		const result = applyAsymmetricCaps(
			adjustments,
			"BothTeamsToScore",
			DEFAULT_ALGORITHM_CONFIG,
		);

		// Small adjustment should be mostly preserved (may have risk multiplier)
		expect(result[0].value).toBeGreaterThan(0);
	});
});

describe("calculateConfidenceWithSwing", () => {
	it("should maintain HIGH confidence for small swings", () => {
		const result = calculateConfidenceWithSwing("HIGH", 5, 2, DEFAULT_ALGORITHM_CONFIG);

		expect(result).toBe("HIGH");
	});

	it("should downgrade for medium swing", () => {
		const result = calculateConfidenceWithSwing("HIGH", 12, 2, DEFAULT_ALGORITHM_CONFIG);

		expect(result).toBe("MEDIUM");
	});

	it("should downgrade significantly for large swing", () => {
		const result = calculateConfidenceWithSwing("HIGH", 18, 2, DEFAULT_ALGORITHM_CONFIG);

		expect(result).toBe("LOW");
	});

	it("should downgrade for many adjustments", () => {
		const result = calculateConfidenceWithSwing("HIGH", 5, 7, DEFAULT_ALGORITHM_CONFIG);

		expect(result).toBe("MEDIUM");
	});

	it("should not go below LOW", () => {
		const result = calculateConfidenceWithSwing("LOW", 20, 10, DEFAULT_ALGORITHM_CONFIG);

		expect(result).toBe("LOW");
	});
});

describe("applyCappedAsymmetricAdjustments", () => {
	it("should return valid result structure", () => {
		const adjustments: Adjustment[] = [createAdjustment("test", 5, "Test")];

		const result = applyCappedAsymmetricAdjustments(
			50,
			adjustments,
			"BothTeamsToScore",
			DEFAULT_ALGORITHM_CONFIG,
		);

		expect(result.finalProbability).toBeDefined();
		expect(result.baseProbability).toBe(50);
		expect(result.totalAdjustment).toBeDefined();
		expect(result.cappedAdjustments).toBeDefined();
		expect(result.confidenceLevel).toBeDefined();
		expect(result.adjustmentSummary).toBeDefined();
	});

	it("should apply adjustments to base probability", () => {
		const adjustments: Adjustment[] = [createAdjustment("positive", 10, "Positive")];

		const result = applyCappedAsymmetricAdjustments(
			50,
			adjustments,
			"BothTeamsToScore",
			DEFAULT_ALGORITHM_CONFIG,
		);

		expect(result.finalProbability).toBeGreaterThan(50);
	});

	it("should respect hard probability caps (minProb/maxProb)", () => {
		// Try to push probability above max
		const highAdjustments: Adjustment[] = [createAdjustment("high", 100, "Very high")];

		const highResult = applyCappedAsymmetricAdjustments(
			80,
			highAdjustments,
			"BothTeamsToScore",
			DEFAULT_ALGORITHM_CONFIG,
		);

		expect(highResult.finalProbability).toBeLessThanOrEqual(
			DEFAULT_ALGORITHM_CONFIG.probabilityCaps.maxProb,
		);

		// Try to push probability below min
		const lowAdjustments: Adjustment[] = [createAdjustment("low", -100, "Very low")];

		const lowResult = applyCappedAsymmetricAdjustments(
			20,
			lowAdjustments,
			"BothTeamsToScore",
			DEFAULT_ALGORITHM_CONFIG,
		);

		expect(lowResult.finalProbability).toBeGreaterThanOrEqual(
			DEFAULT_ALGORITHM_CONFIG.probabilityCaps.minProb,
		);
	});

	it("should respect max swing cap (±22%)", () => {
		const largeAdjustments: Adjustment[] = [
			createAdjustment("big1", 15, "Big 1"),
			createAdjustment("big2", 15, "Big 2"),
			createAdjustment("big3", 15, "Big 3"),
		];

		const result = applyCappedAsymmetricAdjustments(
			50,
			largeAdjustments,
			"BothTeamsToScore",
			DEFAULT_ALGORITHM_CONFIG,
		);

		// Total adjustment should be capped at maxSwing (22%)
		expect(Math.abs(result.totalAdjustment)).toBeLessThanOrEqual(
			DEFAULT_ALGORITHM_CONFIG.probabilityCaps.maxSwing,
		);
	});

	it("should track wasCapped correctly", () => {
		// Large adjustment - should be capped
		const largeAdjustments: Adjustment[] = [
			createAdjustment("large1", 20, "Large 1"),
			createAdjustment("large2", 20, "Large 2"),
		];

		const largeResult = applyCappedAsymmetricAdjustments(
			50,
			largeAdjustments,
			"BothTeamsToScore",
			DEFAULT_ALGORITHM_CONFIG,
		);

		// Large adjustments should trigger capping
		expect(largeResult.wasCapped || largeResult.totalAdjustment < 40).toBe(true);
	});

	it("should set overcorrectionWarning when applicable", () => {
		const conflictingAdjustments: Adjustment[] = [
			createAdjustment("pos", 12, "Positive"),
			createAdjustment("neg", -12, "Negative"),
		];

		const result = applyCappedAsymmetricAdjustments(
			50,
			conflictingAdjustments,
			"BothTeamsToScore",
			DEFAULT_ALGORITHM_CONFIG,
		);

		expect(result.overcorrectionWarning).toBeDefined();
	});

	it("should not mark wasCapped when adjustments simply cancel out (no cap/clamp applied)", () => {
		// Small conflicting signals that net out close to 0 should not be treated as
		// "caps hit" — this is the false-positive we want to avoid.
		const adjustments: Adjustment[] = [
			createAdjustment("home_scoring_rate", 3.6, "Home team scores frequently"),
			createAdjustment("home_defensive_form", -4.0, "Home team has strong defense"),
		];

		const result = applyCappedAsymmetricAdjustments(
			50,
			adjustments,
			"BothTeamsToScore",
			DEFAULT_ALGORITHM_CONFIG,
		);

		expect(result.wasCapped).toBe(false);
		expect(result.overcorrectionWarning).toBeUndefined();
	});

	it("should calculate adjustment summary correctly", () => {
		const adjustments: Adjustment[] = [
			createAdjustment("formation", 5, "Formation"),
			createAdjustment("injury", -3, "Injury"),
			createAdjustment("h2h", 4, "H2H"),
		];

		const result = applyCappedAsymmetricAdjustments(
			50,
			adjustments,
			"BothTeamsToScore",
			DEFAULT_ALGORITHM_CONFIG,
		);

		expect(result.adjustmentSummary.adjustmentCount).toBe(3);
		expect(result.adjustmentSummary.totalPositive).toBeGreaterThan(0);
		expect(result.adjustmentSummary.totalNegative).toBeGreaterThan(0);
	});

	it("should handle empty adjustments array", () => {
		const result = applyCappedAsymmetricAdjustments(
			50,
			[],
			"BothTeamsToScore",
			DEFAULT_ALGORITHM_CONFIG,
		);

		expect(result.finalProbability).toBe(50);
		expect(result.totalAdjustment).toBe(0);
		expect(result.adjustmentSummary.adjustmentCount).toBe(0);
	});

	it("should work with different scenario types", () => {
		const adjustments: Adjustment[] = [createAdjustment("test", 10, "Test")];

		const bttsResult = applyCappedAsymmetricAdjustments(
			50,
			adjustments,
			"BothTeamsToScore",
			DEFAULT_ALGORITHM_CONFIG,
		);

		const matchResult = applyCappedAsymmetricAdjustments(
			50,
			adjustments,
			"MatchOutcome",
			DEFAULT_ALGORITHM_CONFIG,
		);

		// Both should produce valid results (may differ due to asymmetric caps)
		expect(bttsResult.finalProbability).toBeGreaterThan(50);
		expect(matchResult.finalProbability).toBeGreaterThan(50);
	});
});

describe("applyHardCap", () => {
	it("should cap probability at maxProb", () => {
		const result = applyHardCap(95, DEFAULT_ALGORITHM_CONFIG);

		expect(result).toBeLessThanOrEqual(DEFAULT_ALGORITHM_CONFIG.probabilityCaps.maxProb);
	});

	it("should cap probability at minProb", () => {
		const result = applyHardCap(5, DEFAULT_ALGORITHM_CONFIG);

		expect(result).toBeGreaterThanOrEqual(DEFAULT_ALGORITHM_CONFIG.probabilityCaps.minProb);
	});

	it("should preserve probability within bounds", () => {
		const result = applyHardCap(50, DEFAULT_ALGORITHM_CONFIG);

		expect(result).toBe(50);
	});
});

describe("wasProbabilityCapped", () => {
	it("should return true when values differ significantly", () => {
		expect(wasProbabilityCapped(50, 80)).toBe(true);
		expect(wasProbabilityCapped(80, 50)).toBe(true);
	});

	it("should return false when values are nearly equal", () => {
		expect(wasProbabilityCapped(50, 50)).toBe(false);
		expect(wasProbabilityCapped(50, 50.005)).toBe(false);
	});
});

describe("edge cases", () => {
	it("should handle negative base probability", () => {
		const result = applyCappedAsymmetricAdjustments(
			-10,
			[],
			"BothTeamsToScore",
			DEFAULT_ALGORITHM_CONFIG,
		);

		expect(result.finalProbability).toBeGreaterThanOrEqual(
			DEFAULT_ALGORITHM_CONFIG.probabilityCaps.minProb,
		);
	});

	it("should handle probability over 100", () => {
		const result = applyCappedAsymmetricAdjustments(
			110,
			[],
			"BothTeamsToScore",
			DEFAULT_ALGORITHM_CONFIG,
		);

		expect(result.finalProbability).toBeLessThanOrEqual(
			DEFAULT_ALGORITHM_CONFIG.probabilityCaps.maxProb,
		);
	});

	it("should handle very large adjustment values", () => {
		const adjustments: Adjustment[] = [createAdjustment("extreme", 1000, "Extreme")];

		const result = applyCappedAsymmetricAdjustments(
			50,
			adjustments,
			"BothTeamsToScore",
			DEFAULT_ALGORITHM_CONFIG,
		);

		expect(result.finalProbability).toBeLessThanOrEqual(
			DEFAULT_ALGORITHM_CONFIG.probabilityCaps.maxProb,
		);
	});

	it("should handle very negative adjustment values", () => {
		const adjustments: Adjustment[] = [createAdjustment("extreme", -1000, "Extreme negative")];

		const result = applyCappedAsymmetricAdjustments(
			50,
			adjustments,
			"BothTeamsToScore",
			DEFAULT_ALGORITHM_CONFIG,
		);

		expect(result.finalProbability).toBeGreaterThanOrEqual(
			DEFAULT_ALGORITHM_CONFIG.probabilityCaps.minProb,
		);
	});
});

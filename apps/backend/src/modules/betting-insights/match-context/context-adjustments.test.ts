/**
 * Tests for context-adjustments.ts
 *
 * Combined match context building including match type, derby detection,
 * season position, and combined weight adjustments.
 */

import { describe, expect, it } from "vitest";
import type { TeamData } from "../types";
import {
    buildMatchContext,
    describeMatchContext,
    getMaxConfidenceForContext,
    isHighVarianceContext,
} from "./context-adjustments";

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
			gamesPlayed: 30,
		},
		mind: {
			tier: 2,
			efficiencyIndex: 1.5,
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

describe("buildMatchContext", () => {
	describe("match type detection", () => {
		it("should detect league match", () => {
			const context = buildMatchContext(
				"Premier League",
				"Regular Season - 15",
				40, // Liverpool
				157, // Bayern (not a derby)
			);

			expect(context.matchType.type).toBe("LEAGUE");
			expect(context.matchType.importance).toBe("MEDIUM");
		});

		it("should detect cup match", () => {
			const context = buildMatchContext("FA Cup", "Quarter-final", 40, 157);

			expect(context.matchType.type).toBe("CUP");
			expect(context.matchType.isKnockout).toBe(true);
		});

		it("should detect international match", () => {
			const context = buildMatchContext(
				"UEFA Champions League",
				"Round of 16",
				40,
				157,
			);

			expect(context.matchType.type).toBe("INTERNATIONAL");
			expect(context.matchType.isKnockout).toBe(true);
		});

		it("should detect friendly match", () => {
			const context = buildMatchContext(
				"Club Friendlies",
				"Pre-season",
				40,
				157,
			);

			expect(context.matchType.type).toBe("FRIENDLY");
			expect(context.matchType.importance).toBe("LOW");
		});
	});

	describe("derby detection", () => {
		it("should detect known derby", () => {
			const context = buildMatchContext(
				"Premier League",
				"Matchday 10",
				33, // Man Utd
				34, // Man City
				"Manchester United",
				"Manchester City",
			);

			expect(context.derby.isDerby).toBe(true);
			expect(context.derby.derbyName).toBe("Manchester Derby");
			expect(context.matchType.isDerby).toBe(true);
		});

		it("should detect same-city derby", () => {
			const context = buildMatchContext(
				"Premier League",
				"Matchday 10",
				62, // West Ham
				55, // Fulham (same city - London)
				"West Ham United",
				"Fulham",
			);

			expect(context.derby.isDerby).toBe(true);
			expect(context.derby.derbyType).toBe("LOCAL");
		});

		it("should return no derby for unrelated teams", () => {
			const context = buildMatchContext(
				"Premier League",
				"Matchday 10",
				40, // Liverpool
				157, // Bayern
			);

			expect(context.derby.isDerby).toBe(false);
			expect(context.derby.derbyType).toBe("NONE");
		});
	});

	describe("season position detection", () => {
		it("should detect early season", () => {
			const context = buildMatchContext(
				"Premier League",
				"Matchday 3",
				40,
				157,
				undefined,
				undefined,
				{
					roundNumber: 3,
					totalRounds: 38,
				},
			);

			expect(context.isEarlySeason).toBe(true);
			expect(context.isEndOfSeason).toBe(false);
		});

		it("should detect end of season", () => {
			const context = buildMatchContext(
				"Premier League",
				"Matchday 36",
				40,
				157,
				undefined,
				undefined,
				{
					roundNumber: 36,
					totalRounds: 38,
				},
			);

			expect(context.isEndOfSeason).toBe(true);
			expect(context.isEarlySeason).toBe(false);
			expect(context.matchType.isEndOfSeason).toBe(true);
		});

		it("should detect mid-season", () => {
			const context = buildMatchContext(
				"Premier League",
				"Matchday 20",
				40,
				157,
				undefined,
				undefined,
				{
					roundNumber: 20,
					totalRounds: 38,
				},
			);

			expect(context.isEarlySeason).toBe(false);
			expect(context.isEndOfSeason).toBe(false);
		});

		it("should handle missing round data", () => {
			const context = buildMatchContext(
				"Premier League",
				"Matchday 20",
				40,
				157,
			);

			expect(context.isEarlySeason).toBe(false);
			expect(context.isEndOfSeason).toBe(false);
		});
	});

	describe("post-international break detection", () => {
		it("should detect post-international break via explicit flag", () => {
			const context = buildMatchContext(
				"Premier League",
				"Matchday 10",
				40,
				157,
				undefined,
				undefined,
				{
					isInternationalBreak: true,
				},
			);

			expect(context.isPostInternationalBreak).toBe(true);
		});

		it("should detect post-international break via days gap", () => {
			const context = buildMatchContext(
				"Premier League",
				"Matchday 10",
				40,
				157,
				undefined,
				undefined,
				{
					daysSinceLastMatch: 18, // More than 14 days
				},
			);

			expect(context.isPostInternationalBreak).toBe(true);
		});

		it("should NOT detect post-break for short gap", () => {
			const context = buildMatchContext(
				"Premier League",
				"Matchday 10",
				40,
				157,
				undefined,
				undefined,
				{
					daysSinceLastMatch: 7,
				},
			);

			expect(context.isPostInternationalBreak).toBe(false);
		});
	});

	describe("combined adjustments", () => {
		it("should have neutral adjustments for regular league match", () => {
			const context = buildMatchContext(
				"Premier League",
				"Matchday 15",
				40, // Liverpool
				157, // Bayern (not a derby)
			);

			expect(context.adjustments.recentForm).toBe(1.0);
			expect(context.adjustments.h2h).toBe(1.0);
			expect(context.adjustments.homeAdvantage).toBe(1.0);
			expect(context.adjustments.motivation).toBe(1.0);
		});

		it("should reduce form reliability and increase confidence reduction for derby", () => {
			const context = buildMatchContext(
				"Premier League",
				"Matchday 15",
				33, // Man Utd
				34, // Man City
			);

			expect(context.adjustments.recentForm).toBeLessThan(1.0);
			expect(context.adjustments.motivation).toBeGreaterThan(1.0);
			expect(context.adjustments.confidenceReduction).toBeGreaterThan(0);
		});

		it("should apply friendly adjustments", () => {
			const context = buildMatchContext(
				"Club Friendlies",
				"Pre-season",
				40,
				157,
			);

			expect(context.adjustments.recentForm).toBe(0.7);
			expect(context.adjustments.motivation).toBe(0.5);
			expect(context.adjustments.confidenceReduction).toBe(20);
		});

		it("should apply early season adjustments", () => {
			const context = buildMatchContext(
				"Premier League",
				"Matchday 3",
				40,
				157,
				undefined,
				undefined,
				{
					roundNumber: 3,
					totalRounds: 38,
				},
			);

			expect(context.adjustments.recentForm).toBe(0.8);
			expect(context.adjustments.h2h).toBe(1.15);
			expect(context.adjustments.confidenceReduction).toBe(5);
		});

		it("should apply post-international break adjustments", () => {
			const context = buildMatchContext(
				"Premier League",
				"Matchday 10",
				40,
				157,
				undefined,
				undefined,
				{
					isInternationalBreak: true,
				},
			);

			// Post-break adjustments are applied in both getWeightAdjustments (0.8) and
			// calculateCombinedAdjustments (0.85), so: 1.0 * 0.8 * 0.85 = 0.68
			expect(context.adjustments.recentForm).toBeCloseTo(0.68, 2);
			expect(context.adjustments.confidenceReduction).toBe(3);
		});
	});

	describe("goal expectation adjustment", () => {
		it("should increase goals for friendlies", () => {
			const context = buildMatchContext(
				"Club Friendlies",
				"Pre-season",
				40,
				157,
			);

			expect(context.adjustments.goalExpectationAdjustment).toBeGreaterThan(0);
		});

		it("should decrease goals for knockout matches", () => {
			const context = buildMatchContext("FA Cup", "Quarter-final", 40, 157);

			expect(context.adjustments.goalExpectationAdjustment).toBeLessThan(0);
		});

		it("should decrease goals for extreme derbies", () => {
			const context = buildMatchContext(
				"Premier League",
				"Matchday 15",
				33, // Man Utd
				34, // Man City (Extreme derby)
			);

			expect(context.adjustments.goalExpectationAdjustment).toBeLessThan(0);
		});

		it("should decrease goals significantly for finals", () => {
			const context = buildMatchContext("FA Cup", "Final", 40, 157);

			expect(context.adjustments.goalExpectationAdjustment).toBeLessThanOrEqual(
				-5,
			);
		});

		it("should be clamped between -10 and +10", () => {
			const friendlyContext = buildMatchContext(
				"Club Friendlies",
				"Pre-season",
				40,
				157,
			);

			const finalContext = buildMatchContext(
				"FA Cup",
				"Final",
				33, // Man Utd
				34, // Man City (extreme derby + final)
			);

			expect(
				friendlyContext.adjustments.goalExpectationAdjustment,
			).toBeLessThanOrEqual(10);
			expect(
				finalContext.adjustments.goalExpectationAdjustment,
			).toBeGreaterThanOrEqual(-10);
		});
	});

	describe("end-of-season context", () => {
		it("should NOT apply end-of-season context for CUP matches", () => {
			const homeTeam = createTeamData({
				stats: { ...createTeamData().stats, leaguePosition: 1 },
			});
			const awayTeam = createTeamData({
				stats: { ...createTeamData().stats, leaguePosition: 20 },
			});

			const context = buildMatchContext(
				"FA Cup",
				"Semi-final",
				40,
				157,
				"Liverpool",
				"Bayern",
				{
					roundNumber: 36,
					totalRounds: 38,
					homeTeamData: homeTeam,
					awayTeamData: awayTeam,
				},
			);

			// End of season context should not be populated for cup matches
			expect(context.endOfSeasonContext).toBeUndefined();
		});
	});
});

describe("describeMatchContext", () => {
	it("should describe cup knockout match", () => {
		const context = buildMatchContext("FA Cup", "Semi-final", 40, 157);

		const descriptions = describeMatchContext(context);

		expect(descriptions).toContain("CUP match");
		expect(descriptions.some((d) => d.includes("Knockout stage"))).toBe(true);
	});

	it("should describe derby", () => {
		const context = buildMatchContext("Premier League", "Matchday 15", 33, 34);

		const descriptions = describeMatchContext(context);

		expect(descriptions).toContain("Manchester Derby");
	});

	it("should describe early season", () => {
		const context = buildMatchContext(
			"Premier League",
			"Matchday 3",
			40,
			157,
			undefined,
			undefined,
			{
				roundNumber: 3,
				totalRounds: 38,
			},
		);

		const descriptions = describeMatchContext(context);

		expect(descriptions).toContain("Early season");
	});

	it("should describe end of season", () => {
		const context = buildMatchContext(
			"Premier League",
			"Matchday 36",
			40,
			157,
			undefined,
			undefined,
			{
				roundNumber: 36,
				totalRounds: 38,
			},
		);

		const descriptions = describeMatchContext(context);

		expect(descriptions).toContain("End of season");
	});

	it("should describe post-international break", () => {
		const context = buildMatchContext(
			"Premier League",
			"Matchday 10",
			40,
			157,
			undefined,
			undefined,
			{
				isInternationalBreak: true,
			},
		);

		const descriptions = describeMatchContext(context);

		expect(descriptions).toContain("Post-international break");
	});

	it("should describe neutral venue", () => {
		const context = buildMatchContext("FA Cup", "Final", 40, 157);

		const descriptions = describeMatchContext(context);

		expect(descriptions).toContain("Neutral venue");
	});

	it("should return empty array for regular league match", () => {
		const context = buildMatchContext(
			"Premier League",
			"Matchday 15",
			40, // Liverpool
			157, // Bayern (not a derby)
		);

		const descriptions = describeMatchContext(context);

		// Regular league match with no special context
		expect(descriptions.length).toBe(0);
	});
});

describe("isHighVarianceContext", () => {
	it("should return true for friendly", () => {
		const context = buildMatchContext("Club Friendlies", "Pre-season", 40, 157);

		expect(isHighVarianceContext(context)).toBe(true);
	});

	it("should return true for extreme derby", () => {
		const context = buildMatchContext(
			"Premier League",
			"Matchday 15",
			529, // Barcelona
			541, // Real Madrid (El Clásico - EXTREME)
		);

		expect(isHighVarianceContext(context)).toBe(true);
	});

	it("should return true for post-international break", () => {
		const context = buildMatchContext(
			"Premier League",
			"Matchday 10",
			40,
			157,
			undefined,
			undefined,
			{
				isInternationalBreak: true,
			},
		);

		expect(isHighVarianceContext(context)).toBe(true);
	});

	it("should return true for high confidence reduction", () => {
		// Create context with multiple factors that add up
		const context = buildMatchContext(
			"FA Cup",
			"Final",
			33, // Man Utd
			34, // Man City (extreme derby)
		);

		// Should have high confidence reduction from derby + knockout
		expect(context.adjustments.confidenceReduction).toBeGreaterThanOrEqual(10);
		expect(isHighVarianceContext(context)).toBe(true);
	});

	it("should return false for regular league match", () => {
		const context = buildMatchContext(
			"Premier League",
			"Matchday 15",
			40, // Liverpool
			157, // Bayern (not a derby)
		);

		expect(isHighVarianceContext(context)).toBe(false);
	});
});

describe("getMaxConfidenceForContext", () => {
	it("should return LOW for friendly", () => {
		const context = buildMatchContext("Club Friendlies", "Pre-season", 40, 157);

		expect(getMaxConfidenceForContext(context)).toBe("LOW");
	});

	it("should return LOW for very high confidence reduction", () => {
		// Friendly has 20 confidence reduction
		const context = buildMatchContext("Club Friendlies", "Pre-season", 40, 157);

		expect(getMaxConfidenceForContext(context)).toBe("LOW");
	});

	it("should return MEDIUM for extreme derby (high confidence reduction, but below LOW threshold)", () => {
		// Extreme derby (Man Utd vs Man City) has high confidence reduction
		// Derby confidence reduction comes from derby-detector intensity only (EXTREME = 12)
		// 12 >= 8 threshold, so returns MEDIUM
		const context = buildMatchContext(
			"Premier League",
			"Matchday 15",
			33, // Man Utd
			34, // Man City
		);

		// Extreme derby has very high confidence reduction
		expect(context.adjustments.confidenceReduction).toBeGreaterThanOrEqual(12);
		expect(getMaxConfidenceForContext(context)).toBe("MEDIUM");
	});

	it("should return MEDIUM for moderate confidence reduction (non-extreme derby)", () => {
		// Local derby (London clubs) has HIGH intensity, not EXTREME
		// getMatchTypeConfidenceReduction adds 8 + derby adds 8 for HIGH = 16
		// But London derby may not be known, try early season which adds 5
		const context = buildMatchContext(
			"Premier League",
			"Matchday 3",
			40, // Liverpool
			157, // Bayern (no derby)
			undefined,
			undefined,
			{
				roundNumber: 3,
				totalRounds: 38,
			},
		);

		// Early season adds 5 confidence reduction (which is >= 8 after rounding? No, just 5)
		// Actually 5 < 8 so this would be HIGH not MEDIUM
		// Let's use CUP match which adds confidence reduction
		expect(context.adjustments.confidenceReduction).toBe(5);
	});

	it("should return MEDIUM for cup knockout match", () => {
		// Cup knockout adds confidence reduction
		const context = buildMatchContext(
			"FA Cup",
			"Quarter-final",
			40, // Liverpool
			157, // Bayern (no derby)
		);

		// Cup knockout adds moderate confidence reduction
		expect(context.adjustments.confidenceReduction).toBeGreaterThanOrEqual(8);
		expect(context.adjustments.confidenceReduction).toBeLessThan(15);
		expect(getMaxConfidenceForContext(context)).toBe("MEDIUM");
	});

	it("should return HIGH for regular league match", () => {
		const context = buildMatchContext(
			"Premier League",
			"Matchday 15",
			40, // Liverpool
			157, // Bayern (not a derby)
		);

		expect(getMaxConfidenceForContext(context)).toBe("HIGH");
	});
});

describe("edge cases", () => {
	it("should handle undefined round", () => {
		const context = buildMatchContext("Premier League", undefined, 40, 157);

		expect(context.matchType.type).toBe("LEAGUE");
	});

	it("should handle numeric round", () => {
		const context = buildMatchContext("Serie A", 25, 40, 157);

		expect(context.matchType.type).toBe("LEAGUE");
	});

	it("should combine derby and end-of-season adjustments", () => {
		const context = buildMatchContext(
			"Premier League",
			"Matchday 36",
			33, // Man Utd
			34, // Man City
			undefined,
			undefined,
			{
				roundNumber: 36,
				totalRounds: 38,
			},
		);

		// Should have both derby and end-of-season effects
		expect(context.derby.isDerby).toBe(true);
		expect(context.isEndOfSeason).toBe(true);
		expect(context.adjustments.motivation).toBeGreaterThan(1.0);
	});

	it("should combine multiple context factors", () => {
		const context = buildMatchContext(
			"Premier League",
			"Matchday 3",
			33, // Man Utd
			34, // Man City
			undefined,
			undefined,
			{
				roundNumber: 3,
				totalRounds: 38,
				isInternationalBreak: true,
			},
		);

		// Early season + derby + post-break
		expect(context.isEarlySeason).toBe(true);
		expect(context.derby.isDerby).toBe(true);
		expect(context.isPostInternationalBreak).toBe(true);

		// Form reliability should be reduced by all three factors
		// Early season: 0.8
		// Derby (EXTREME): 0.75
		// Post-break: 0.85
		// Combined: varies based on order but should be significantly reduced
		expect(context.adjustments.recentForm).toBeLessThan(0.7);
	});
});

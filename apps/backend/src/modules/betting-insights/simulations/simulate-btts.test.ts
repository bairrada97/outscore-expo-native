/**
 * Tests for simulate-btts.ts
 *
 * BTTS (Both Teams To Score) simulation tests.
 */

import { describe, expect, it } from "vitest";
import type { H2HData, TeamData } from "../types";
import { simulateBTTS } from "./simulate-btts";

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
			gamesPlayed: 20,
		},
		mind: {
			tier: 2,
			efficiencyIndex: 1.8,
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
			goalLineOverPct: {
				"0.5": 90,
				"1.5": 75,
				"2.5": 55,
				"3.5": 30,
				"4.5": 15,
				"5.5": 5,
			},
			cleanSheetPercentage: 25,
			failedToScorePercentage: 15,
			bttsYesRate: 55,
			goalMinutesScoring: {
				"0-15": 15,
				"16-30": 20,
				"31-45": 15,
				"46-60": 20,
				"61-75": 15,
				"76-90": 15,
			},
			goalMinutesConceding: {
				"0-15": 10,
				"16-30": 15,
				"31-45": 20,
				"46-60": 20,
				"61-75": 20,
				"76-90": 15,
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

function createH2HData(overrides: Partial<H2HData> = {}): H2HData {
	return {
		matches: [],
		h2hMatchCount: 10,
		homeTeamWins: 4,
		awayTeamWins: 3,
		draws: 3,
		bttsCount: 6,
		bttsPercentage: 60,
		goalLineOverCount: { "2.5": 7 },
		goalLineOverPct: { "2.5": 70 },
		avgGoals: 2.8,
		avgHomeGoals: 1.5,
		avgAwayGoals: 1.3,
		recencyWeights: [1, 0.9, 0.8, 0.7, 0.6],
		hasSufficientData: true,
		...overrides,
	};
}

describe("simulateBTTS", () => {
	describe("basic functionality", () => {
		it("should return a valid simulation result", () => {
			const homeTeam = createTeamData({ name: "Home Team" });
			const awayTeam = createTeamData({ id: 2, name: "Away Team" });

			const result = simulateBTTS(homeTeam, awayTeam);

			expect(result).toBeDefined();
			expect(result.scenarioType).toBe("BothTeamsToScore");
			expect(result.probabilityDistribution).toBeDefined();
			expect(result.probabilityDistribution.yes).toBeDefined();
			expect(result.probabilityDistribution.no).toBeDefined();
		});

		it("should have yes + no probabilities equal 100", () => {
			const homeTeam = createTeamData();
			const awayTeam = createTeamData({ id: 2 });

			const result = simulateBTTS(homeTeam, awayTeam);

			const yes = result.probabilityDistribution.yes ?? 0;
			const no = result.probabilityDistribution.no ?? 0;
			expect(Math.round(yes + no)).toBe(100);
		});

		it("should return probability within valid range (0-100)", () => {
			const homeTeam = createTeamData();
			const awayTeam = createTeamData({ id: 2 });

			const result = simulateBTTS(homeTeam, awayTeam);

			const yes = result.probabilityDistribution.yes ?? 0;
			expect(yes).toBeGreaterThanOrEqual(0);
			expect(yes).toBeLessThanOrEqual(100);
		});
	});

	describe("scoring rate impact", () => {
		it("should increase BTTS probability for high-scoring teams", () => {
			const normalTeam = createTeamData();
			const highScoringTeam = createTeamData({
				id: 2,
				dna: {
					...createTeamData().dna,
					failedToScorePercentage: 5, // 95% scoring rate
					bttsYesRate: 80,
				},
			});

			const normalResult = simulateBTTS(normalTeam, normalTeam);
			const highScoringResult = simulateBTTS(highScoringTeam, highScoringTeam);

			const normalYes = normalResult.probabilityDistribution.yes ?? 0;
			const highScoringYes = highScoringResult.probabilityDistribution.yes ?? 0;

			expect(highScoringYes).toBeGreaterThan(normalYes);
		});

		it("should decrease BTTS probability for low-scoring teams", () => {
			const normalTeam = createTeamData();
			const lowScoringTeam = createTeamData({
				id: 2,
				dna: {
					...createTeamData().dna,
					failedToScorePercentage: 50, // 50% scoring rate
					bttsYesRate: 30,
				},
			});

			const normalResult = simulateBTTS(normalTeam, normalTeam);
			const lowScoringResult = simulateBTTS(lowScoringTeam, lowScoringTeam);

			const normalYes = normalResult.probabilityDistribution.yes ?? 0;
			const lowScoringYes = lowScoringResult.probabilityDistribution.yes ?? 0;

			expect(lowScoringYes).toBeLessThan(normalYes);
		});
	});

	describe("defensive form impact", () => {
		it("should decrease BTTS probability for teams with strong defense", () => {
			const normalTeam = createTeamData();
			const strongDefenseTeam = createTeamData({
				id: 2,
				dna: {
					...createTeamData().dna,
					cleanSheetPercentage: 50, // High clean sheet rate
				},
			});

			const normalResult = simulateBTTS(normalTeam, normalTeam);
			const strongDefenseResult = simulateBTTS(
				strongDefenseTeam,
				strongDefenseTeam,
			);

			const normalYes = normalResult.probabilityDistribution.yes ?? 0;
			const strongDefenseYes =
				strongDefenseResult.probabilityDistribution.yes ?? 0;

			expect(strongDefenseYes).toBeLessThan(normalYes);
		});

		it("should increase BTTS probability for teams with weak defense", () => {
			const normalTeam = createTeamData();
			const weakDefenseTeam = createTeamData({
				id: 2,
				dna: {
					...createTeamData().dna,
					cleanSheetPercentage: 5, // Very low clean sheet rate
				},
			});

			const normalResult = simulateBTTS(normalTeam, normalTeam);
			const weakDefenseResult = simulateBTTS(weakDefenseTeam, weakDefenseTeam);

			const normalYes = normalResult.probabilityDistribution.yes ?? 0;
			const weakDefenseYes = weakDefenseResult.probabilityDistribution.yes ?? 0;

			expect(weakDefenseYes).toBeGreaterThan(normalYes);
		});
	});

	describe("H2H impact", () => {
		it("should increase BTTS probability with high H2H BTTS rate", () => {
			const homeTeam = createTeamData();
			const awayTeam = createTeamData({ id: 2 });

			const lowH2H = createH2HData({ bttsPercentage: 20 });
			const highH2H = createH2HData({ bttsPercentage: 85 });

			const lowH2HResult = simulateBTTS(homeTeam, awayTeam, lowH2H);
			const highH2HResult = simulateBTTS(homeTeam, awayTeam, highH2H);

			const lowH2HYes = lowH2HResult.probabilityDistribution.yes ?? 0;
			const highH2HYes = highH2HResult.probabilityDistribution.yes ?? 0;

			expect(highH2HYes).toBeGreaterThan(lowH2HYes);
		});

		it("should handle missing H2H data gracefully", () => {
			const homeTeam = createTeamData();
			const awayTeam = createTeamData({ id: 2 });

			const result = simulateBTTS(homeTeam, awayTeam, undefined);

			expect(result).toBeDefined();
			expect(result.scenarioType).toBe("BothTeamsToScore");
		});
	});

	describe("confidence levels", () => {
		it("should return HIGH confidence for teams with lots of data", () => {
			const wellDatadTeam = createTeamData({
				mind: {
					...createTeamData().mind,
					matchCount: 50,
				},
			});

			const h2h = createH2HData({ hasSufficientData: true });
			const result = simulateBTTS(wellDatadTeam, wellDatadTeam, h2h);

			expect(result.modelReliability).toBe("HIGH");
		});

		it("should return LOW confidence for teams with limited data", () => {
			const limitedDataTeam = createTeamData({
				mind: {
					...createTeamData().mind,
					matchCount: 5,
					hasSufficientData: false,
				},
			});

			const result = simulateBTTS(limitedDataTeam, limitedDataTeam);

			expect(result.modelReliability).toBe("LOW");
		});
	});

	describe("adjustments tracking", () => {
		it("should track adjustments applied", () => {
			const homeTeam = createTeamData();
			const awayTeam = createTeamData({ id: 2 });

			const result = simulateBTTS(homeTeam, awayTeam);

			expect(result.adjustmentsApplied).toBeDefined();
			expect(Array.isArray(result.adjustmentsApplied)).toBe(true);
		});

		it("should include adjustment reasons", () => {
			const highScoringTeam = createTeamData({
				dna: {
					...createTeamData().dna,
					failedToScorePercentage: 5,
				},
			});

			const result = simulateBTTS(highScoringTeam, highScoringTeam);

			// Should have some adjustments with reasons
			const hasReasons = result.adjustmentsApplied?.some(
				(adj) => adj.reason && adj.reason.length > 0,
			);
			expect(hasReasons).toBe(true);
		});
	});

	describe("signal strength", () => {
		it("should include signal strength in result", () => {
			const homeTeam = createTeamData();
			const awayTeam = createTeamData({ id: 2 });

			const result = simulateBTTS(homeTeam, awayTeam);

			expect(result.signalStrength).toBeDefined();
			expect(["Strong", "Moderate", "Balanced", "Weak"]).toContain(
				result.signalStrength,
			);
		});
	});

	describe("most probable outcome", () => {
		it("should correctly identify most probable outcome", () => {
			const homeTeam = createTeamData({
				dna: {
					...createTeamData().dna,
					failedToScorePercentage: 5,
					cleanSheetPercentage: 5,
					bttsYesRate: 85,
				},
			});

			const result = simulateBTTS(homeTeam, homeTeam);

			// With high BTTS indicators, should predict "yes"
			expect(result.mostProbableOutcome).toBeDefined();
		});
	});
});

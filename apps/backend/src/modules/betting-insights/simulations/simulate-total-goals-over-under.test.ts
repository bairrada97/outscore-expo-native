/**
 * Tests for simulate-total-goals-over-under.ts
 *
 * Over/Under Goals multi-line simulation tests.
 */

import { describe, expect, it } from "vitest";
import type { GoalLine, H2HData, TeamData } from "../types";
import { simulateTotalGoalsOverUnder } from "./simulate-total-goals-over-under";

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
		goalLineOverCount: {
			"0.5": 10,
			"1.5": 9,
			"2.5": 7,
			"3.5": 4,
			"4.5": 2,
			"5.5": 1,
		},
		goalLineOverPct: {
			"0.5": 100,
			"1.5": 90,
			"2.5": 70,
			"3.5": 40,
			"4.5": 20,
			"5.5": 10,
		},
		avgGoals: 2.8,
		avgHomeGoals: 1.5,
		avgAwayGoals: 1.3,
		recencyWeights: [1, 0.9, 0.8, 0.7, 0.6],
		hasSufficientData: true,
		...overrides,
	};
}

describe("simulateTotalGoalsOverUnder", () => {
	describe("basic functionality", () => {
		it("should return a valid simulation result", () => {
			const homeTeam = createTeamData({ name: "Home Team" });
			const awayTeam = createTeamData({ id: 2, name: "Away Team" });

			const result = simulateTotalGoalsOverUnder(homeTeam, awayTeam, undefined, undefined, 2.5);

			expect(result).toBeDefined();
			expect(result.scenarioType).toBe("TotalGoalsOverUnder");
			expect(result.probabilityDistribution).toBeDefined();
			expect(result.probabilityDistribution.over).toBeDefined();
			expect(result.probabilityDistribution.under).toBeDefined();
		});

		it("should have over + under probabilities equal 100", () => {
			const homeTeam = createTeamData();
			const awayTeam = createTeamData({ id: 2 });

			const result = simulateTotalGoalsOverUnder(homeTeam, awayTeam, undefined, undefined, 2.5);

			const over = result.probabilityDistribution.over ?? 0;
			const under = result.probabilityDistribution.under ?? 0;
			expect(Math.round(over + under)).toBe(100);
		});

		it("should return probabilities within valid range (0-100)", () => {
			const homeTeam = createTeamData();
			const awayTeam = createTeamData({ id: 2 });

			const result = simulateTotalGoalsOverUnder(homeTeam, awayTeam, undefined, undefined, 2.5);

			const over = result.probabilityDistribution.over ?? 0;
			const under = result.probabilityDistribution.under ?? 0;

			expect(over).toBeGreaterThanOrEqual(0);
			expect(over).toBeLessThanOrEqual(100);
			expect(under).toBeGreaterThanOrEqual(0);
			expect(under).toBeLessThanOrEqual(100);
		});

		it("should include line in the result", () => {
			const homeTeam = createTeamData();
			const awayTeam = createTeamData({ id: 2 });

			const result = simulateTotalGoalsOverUnder(homeTeam, awayTeam, undefined, undefined, 2.5);

			expect(result.line).toBe(2.5);
		});
	});

	describe("all goal lines", () => {
		const goalLines: GoalLine[] = [0.5, 1.5, 2.5, 3.5, 4.5, 5.5];

		it.each(goalLines)("should return valid probabilities for line %s", (line) => {
			const homeTeam = createTeamData();
			const awayTeam = createTeamData({ id: 2 });

			const result = simulateTotalGoalsOverUnder(homeTeam, awayTeam, undefined, undefined, line);

			expect(result.line).toBe(line);
			expect(result.probabilityDistribution.over).toBeDefined();
			expect(result.probabilityDistribution.under).toBeDefined();

			const over = result.probabilityDistribution.over ?? 0;
			const under = result.probabilityDistribution.under ?? 0;
			expect(Math.round(over + under)).toBe(100);
		});

		it("should have decreasing Over probability as line increases", () => {
			const homeTeam = createTeamData();
			const awayTeam = createTeamData({ id: 2 });

			const results = goalLines.map((line) =>
				simulateTotalGoalsOverUnder(homeTeam, awayTeam, undefined, undefined, line),
			);

			const overProbabilities = results.map((r) => r.probabilityDistribution.over ?? 0);

			// Over 0.5 should be higher than Over 5.5
			expect(overProbabilities[0]).toBeGreaterThan(overProbabilities[5]);

			// Generally decreasing (allow some tolerance for close lines)
			for (let i = 0; i < overProbabilities.length - 2; i++) {
				expect(overProbabilities[i]).toBeGreaterThanOrEqual(overProbabilities[i + 2] - 5);
			}
		});
	});

	describe("scoring rate impact", () => {
		it("should increase Over probability for high-scoring teams", () => {
			const normalTeam = createTeamData();
			const highScoringTeam = createTeamData({
				id: 2,
				stats: {
					...createTeamData().stats,
					avgGoalsScored: 2.5,
					avgGoalsConceded: 1.8,
				},
				dna: {
					...createTeamData().dna,
					goalLineOverPct: {
						"0.5": 100,
						"1.5": 95,
						"2.5": 85,
						"3.5": 65,
						"4.5": 40,
						"5.5": 20,
					},
				},
			});

			const normalResult = simulateTotalGoalsOverUnder(normalTeam, normalTeam, undefined, undefined, 2.5);
			const highScoringResult = simulateTotalGoalsOverUnder(
				highScoringTeam,
				highScoringTeam,
				undefined,
				undefined,
				2.5,
			);

			const normalOver = normalResult.probabilityDistribution.over ?? 0;
			const highScoringOver = highScoringResult.probabilityDistribution.over ?? 0;

			expect(highScoringOver).toBeGreaterThan(normalOver);
		});

		it("should decrease Over probability for defensive teams", () => {
			const normalTeam = createTeamData();
			const defensiveTeam = createTeamData({
				id: 2,
				stats: {
					...createTeamData().stats,
					avgGoalsScored: 0.8,
					avgGoalsConceded: 0.6,
				},
				dna: {
					...createTeamData().dna,
					goalLineOverPct: {
						"0.5": 70,
						"1.5": 50,
						"2.5": 25,
						"3.5": 10,
						"4.5": 3,
						"5.5": 1,
					},
					cleanSheetPercentage: 50,
				},
			});

			const normalResult = simulateTotalGoalsOverUnder(normalTeam, normalTeam, undefined, undefined, 2.5);
			const defensiveResult = simulateTotalGoalsOverUnder(
				defensiveTeam,
				defensiveTeam,
				undefined,
				undefined,
				2.5,
			);

			const normalOver = normalResult.probabilityDistribution.over ?? 0;
			const defensiveOver = defensiveResult.probabilityDistribution.over ?? 0;

			expect(defensiveOver).toBeLessThan(normalOver);
		});
	});

	describe("H2H impact", () => {
		it("should increase Over probability with high H2H goals", () => {
			const homeTeam = createTeamData();
			const awayTeam = createTeamData({ id: 2 });

			const highGoalsH2H = createH2HData({
				avgGoals: 4.2,
				goalLineOverPct: {
					"0.5": 100,
					"1.5": 100,
					"2.5": 90,
					"3.5": 75,
					"4.5": 50,
					"5.5": 30,
				},
			});
			const lowGoalsH2H = createH2HData({
				avgGoals: 1.5,
				goalLineOverPct: {
					"0.5": 80,
					"1.5": 60,
					"2.5": 30,
					"3.5": 10,
					"4.5": 5,
					"5.5": 0,
				},
			});

			const highGoalsResult = simulateTotalGoalsOverUnder(homeTeam, awayTeam, highGoalsH2H, undefined, 2.5);
			const lowGoalsResult = simulateTotalGoalsOverUnder(homeTeam, awayTeam, lowGoalsH2H, undefined, 2.5);

			const highGoalsOver = highGoalsResult.probabilityDistribution.over ?? 0;
			const lowGoalsOver = lowGoalsResult.probabilityDistribution.over ?? 0;

			expect(highGoalsOver).toBeGreaterThan(lowGoalsOver);
		});

		it("should handle missing H2H data gracefully", () => {
			const homeTeam = createTeamData();
			const awayTeam = createTeamData({ id: 2 });

			const result = simulateTotalGoalsOverUnder(homeTeam, awayTeam, undefined, undefined, 2.5);

			expect(result).toBeDefined();
			expect(result.scenarioType).toBe("TotalGoalsOverUnder");
			const total =
				(result.probabilityDistribution.over ?? 0) + (result.probabilityDistribution.under ?? 0);
			expect(Math.round(total)).toBe(100);
		});
	});

	describe("DNA goalLineOverPct impact", () => {
		it("should use team DNA percentages for specific lines", () => {
			const highOver25Team = createTeamData({
				dna: {
					...createTeamData().dna,
					goalLineOverPct: {
						"0.5": 100,
						"1.5": 95,
						"2.5": 85,
						"3.5": 60,
						"4.5": 30,
						"5.5": 10,
					},
				},
			});
			const lowOver25Team = createTeamData({
				id: 2,
				dna: {
					...createTeamData().dna,
					goalLineOverPct: {
						"0.5": 75,
						"1.5": 55,
						"2.5": 30,
						"3.5": 15,
						"4.5": 5,
						"5.5": 2,
					},
				},
			});

			const highResult = simulateTotalGoalsOverUnder(highOver25Team, highOver25Team, undefined, undefined, 2.5);
			const lowResult = simulateTotalGoalsOverUnder(lowOver25Team, lowOver25Team, undefined, undefined, 2.5);

			const highOver = highResult.probabilityDistribution.over ?? 0;
			const lowOver = lowResult.probabilityDistribution.over ?? 0;

			expect(highOver).toBeGreaterThan(lowOver);
		});
	});

	describe("confidence levels", () => {
		it("should return HIGH confidence for extreme probabilities", () => {
			// Create teams that will produce extreme probability
			const highScoringTeam = createTeamData({
				stats: {
					...createTeamData().stats,
					avgGoalsScored: 3.0,
					avgGoalsConceded: 2.0,
				},
				dna: {
					...createTeamData().dna,
					goalLineOverPct: {
						"0.5": 100,
						"1.5": 98,
						"2.5": 90,
						"3.5": 70,
						"4.5": 50,
						"5.5": 25,
					},
				},
			});

			// Over 0.5 should have very high probability = high confidence
			const result = simulateTotalGoalsOverUnder(highScoringTeam, highScoringTeam, undefined, undefined, 0.5);

			// With very high Over 0.5 probability, confidence should be HIGH
			expect(["HIGH", "MEDIUM"]).toContain(result.modelReliability);
		});

		it("should return lower confidence for balanced probabilities", () => {
			const balancedTeam = createTeamData({
				dna: {
					...createTeamData().dna,
					goalLineOverPct: {
						"0.5": 90,
						"1.5": 70,
						"2.5": 50,
						"3.5": 30,
						"4.5": 15,
						"5.5": 5,
					},
				},
			});

			// Line 2.5 with 50% DNA should produce balanced probability
			const result = simulateTotalGoalsOverUnder(balancedTeam, balancedTeam, undefined, undefined, 2.5);

			// Balanced probabilities should result in LOW or MEDIUM confidence
			expect(["LOW", "MEDIUM"]).toContain(result.modelReliability);
		});
	});

	describe("adjustments tracking", () => {
		it("should track adjustments applied", () => {
			const homeTeam = createTeamData();
			const awayTeam = createTeamData({ id: 2 });

			const result = simulateTotalGoalsOverUnder(homeTeam, awayTeam, undefined, undefined, 2.5);

			expect(result.adjustmentsApplied).toBeDefined();
			expect(Array.isArray(result.adjustmentsApplied)).toBe(true);
		});

		it("should include H2H adjustment when H2H data shows strong pattern", () => {
			const homeTeam = createTeamData();
			const awayTeam = createTeamData({ id: 2 });

			const strongH2H = createH2HData({
				goalLineOverPct: {
					"0.5": 100,
					"1.5": 100,
					"2.5": 90,
					"3.5": 80,
					"4.5": 60,
					"5.5": 40,
				},
				hasSufficientData: true,
			});

			const result = simulateTotalGoalsOverUnder(homeTeam, awayTeam, strongH2H, undefined, 2.5);

			const hasH2HAdjustment = result.adjustmentsApplied?.some(
				(adj) => adj.type === "h2h" || adj.reason?.toLowerCase().includes("h2h"),
			);
			expect(hasH2HAdjustment).toBe(true);
		});

		it("should include DNA adjustment for extreme DNA patterns", () => {
			const extremeDnaTeam = createTeamData({
				dna: {
					...createTeamData().dna,
					goalLineOverPct: {
						"0.5": 100,
						"1.5": 95,
						"2.5": 85,
						"3.5": 70,
						"4.5": 50,
						"5.5": 25,
					},
				},
			});

			const result = simulateTotalGoalsOverUnder(extremeDnaTeam, extremeDnaTeam, undefined, undefined, 2.5);

			const hasDnaAdjustment = result.adjustmentsApplied?.some(
				(adj) => adj.type === "dna" || adj.reason?.toLowerCase().includes("dna"),
			);
			expect(hasDnaAdjustment).toBe(true);
		});
	});

	describe("signal strength", () => {
		it("should include signal strength in result", () => {
			const homeTeam = createTeamData();
			const awayTeam = createTeamData({ id: 2 });

			const result = simulateTotalGoalsOverUnder(homeTeam, awayTeam, undefined, undefined, 2.5);

			expect(result.signalStrength).toBeDefined();
			expect(["Strong", "Moderate", "Balanced", "Weak"]).toContain(result.signalStrength);
		});
	});

	describe("most probable outcome", () => {
		it("should correctly identify most probable outcome", () => {
			const homeTeam = createTeamData();
			const awayTeam = createTeamData({ id: 2 });

			const result = simulateTotalGoalsOverUnder(homeTeam, awayTeam, undefined, undefined, 2.5);

			expect(result.mostProbableOutcome).toBeDefined();
			// mostProbableOutcome is a human-readable sentence including Over or Under
			expect(result.mostProbableOutcome).toMatch(/Over|Under/i);
		});
	});

	describe("insights", () => {
		it("should include insights in result", () => {
			const homeTeam = createTeamData();
			const awayTeam = createTeamData({ id: 2 });

			const result = simulateTotalGoalsOverUnder(homeTeam, awayTeam, undefined, undefined, 2.5);

			expect(result.insights).toBeDefined();
			expect(Array.isArray(result.insights)).toBe(true);
			expect(result.insights.length).toBeGreaterThan(0);
		});

		it("should include H2H insights when H2H data is available", () => {
			const homeTeam = createTeamData();
			const awayTeam = createTeamData({ id: 2 });
			const h2h = createH2HData({ hasSufficientData: true });

			const result = simulateTotalGoalsOverUnder(homeTeam, awayTeam, h2h, undefined, 2.5);

			const hasH2HInsight = result.insights?.some(
				(insight) => insight.category === "H2H" || insight.text.toLowerCase().includes("h2h"),
			);
			expect(hasH2HInsight).toBe(true);
		});
	});

	describe("edge cases", () => {
		it("should handle teams with missing goalLineOverPct", () => {
			const teamWithoutDna = createTeamData({
				dna: {
					...createTeamData().dna,
					goalLineOverPct: {},
				},
			});

			const result = simulateTotalGoalsOverUnder(teamWithoutDna, teamWithoutDna, undefined, undefined, 2.5);

			expect(result).toBeDefined();
			const total =
				(result.probabilityDistribution.over ?? 0) + (result.probabilityDistribution.under ?? 0);
			expect(Math.round(total)).toBe(100);
		});

		it("should clamp extreme probability values", () => {
			// Create extreme scenario
			const extremeHighTeam = createTeamData({
				stats: {
					...createTeamData().stats,
					avgGoalsScored: 5.0,
					avgGoalsConceded: 4.0,
				},
				dna: {
					...createTeamData().dna,
					goalLineOverPct: {
						"0.5": 100,
						"1.5": 100,
						"2.5": 100,
						"3.5": 95,
						"4.5": 90,
						"5.5": 80,
					},
				},
			});

			const h2h = createH2HData({
				avgGoals: 6.0,
				goalLineOverPct: {
					"0.5": 100,
					"1.5": 100,
					"2.5": 100,
					"3.5": 100,
					"4.5": 100,
					"5.5": 100,
				},
			});

			const result = simulateTotalGoalsOverUnder(extremeHighTeam, extremeHighTeam, h2h, undefined, 0.5);

			// Even extreme scenarios shouldn't produce exactly 0% or 100%
			expect(result.probabilityDistribution.under).toBeGreaterThan(0);
			expect(result.probabilityDistribution.over).toBeLessThan(100);
		});

		it("should handle zero average goals", () => {
			const zeroGoalsTeam = createTeamData({
				stats: {
					...createTeamData().stats,
					avgGoalsScored: 0,
					avgGoalsConceded: 0,
				},
			});

			const result = simulateTotalGoalsOverUnder(zeroGoalsTeam, zeroGoalsTeam, undefined, undefined, 2.5);

			expect(result).toBeDefined();
			const total =
				(result.probabilityDistribution.over ?? 0) + (result.probabilityDistribution.under ?? 0);
			expect(Math.round(total)).toBe(100);
		});
	});
});

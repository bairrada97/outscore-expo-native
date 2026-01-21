/**
 * Tests for simulate-match-outcome.ts
 *
 * Match Result (1X2) simulation tests.
 */

import { describe, expect, it } from "vitest";
import type { H2HData, TeamData } from "../types";
import { simulateMatchOutcome } from "./simulate-match-outcome";

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

describe("simulateMatchOutcome", () => {
	describe("basic functionality", () => {
		it("should return a valid simulation result", () => {
			const homeTeam = createTeamData({ name: "Home Team" });
			const awayTeam = createTeamData({ id: 2, name: "Away Team" });

			const result = simulateMatchOutcome(homeTeam, awayTeam);

			expect(result).toBeDefined();
			expect(result.scenarioType).toBe("MatchOutcome");
			expect(result.probabilityDistribution).toBeDefined();
			expect(result.probabilityDistribution.home).toBeDefined();
			expect(result.probabilityDistribution.draw).toBeDefined();
			expect(result.probabilityDistribution.away).toBeDefined();
		});

		it("should have home + draw + away probabilities equal 100", () => {
			const homeTeam = createTeamData();
			const awayTeam = createTeamData({ id: 2 });

			const result = simulateMatchOutcome(homeTeam, awayTeam);

			const home = result.probabilityDistribution.home ?? 0;
			const draw = result.probabilityDistribution.draw ?? 0;
			const away = result.probabilityDistribution.away ?? 0;
			expect(Math.round(home + draw + away)).toBe(100);
		});

		it("should return probabilities within valid range (0-100)", () => {
			const homeTeam = createTeamData();
			const awayTeam = createTeamData({ id: 2 });

			const result = simulateMatchOutcome(homeTeam, awayTeam);

			const home = result.probabilityDistribution.home ?? 0;
			const draw = result.probabilityDistribution.draw ?? 0;
			const away = result.probabilityDistribution.away ?? 0;

			expect(home).toBeGreaterThanOrEqual(0);
			expect(home).toBeLessThanOrEqual(100);
			expect(draw).toBeGreaterThanOrEqual(0);
			expect(draw).toBeLessThanOrEqual(100);
			expect(away).toBeGreaterThanOrEqual(0);
			expect(away).toBeLessThanOrEqual(100);
		});
	});

	describe("season scoring impact", () => {
		it("should ignore season scoring stats for match outcome", () => {
			const strongHome = createTeamData({
				stats: {
					...createTeamData().stats,
					homeAvgScored: 2.3,
					homeAvgConceded: 1.0,
				},
			});
			const weakAway = createTeamData({
				id: 2,
				stats: {
					...createTeamData().stats,
					awayAvgScored: 0.9,
					awayAvgConceded: 1.9,
				},
			});

			const base = simulateMatchOutcome(
				createTeamData(),
				createTeamData({ id: 2 }),
			);
			const strong = simulateMatchOutcome(strongHome, weakAway);

			expect(strong.probabilityDistribution.home ?? 0).toBeCloseTo(
				base.probabilityDistribution.home ?? 0,
				1,
			);
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
			const result = simulateMatchOutcome(wellDatadTeam, wellDatadTeam, h2h);

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

			const result = simulateMatchOutcome(limitedDataTeam, limitedDataTeam);

			expect(result.modelReliability).toBe("LOW");
		});

		it("should return MEDIUM confidence for moderate data", () => {
			const moderateDataTeam = createTeamData({
				mind: {
					...createTeamData().mind,
					matchCount: 20,
				},
			});

			const result = simulateMatchOutcome(moderateDataTeam, moderateDataTeam);

			expect(result.modelReliability).toBe("MEDIUM");
		});
	});

	describe("adjustments tracking", () => {
		it("should track adjustments applied", () => {
			const homeTeam = createTeamData();
			const awayTeam = createTeamData({ id: 2 });

			const result = simulateMatchOutcome(homeTeam, awayTeam);

			expect(result.adjustmentsApplied).toBeDefined();
			expect(Array.isArray(result.adjustmentsApplied)).toBe(true);
		});

		it("should include sleeping giant adjustment when applicable", () => {
			const sleepingGiantHome = createTeamData({
				mood: {
					...createTeamData().mood,
					isSleepingGiant: true,
				},
			});
			const awayTeam = createTeamData({ id: 2 });

			const result = simulateMatchOutcome(sleepingGiantHome, awayTeam);

			const hasSleepingGiant = result.adjustmentsApplied?.some(
				(adj) => adj.name.includes("sleeping_giant"),
			);
			expect(hasSleepingGiant).toBe(true);
		});

		it("should include over-performer adjustment when applicable", () => {
			const overPerformerHome = createTeamData({
				mood: {
					...createTeamData().mood,
					isOverPerformer: true,
				},
			});
			const awayTeam = createTeamData({ id: 2 });

			const result = simulateMatchOutcome(overPerformerHome, awayTeam);

			const hasOverPerformer = result.adjustmentsApplied?.some(
				(adj) => adj.name.includes("over_performer"),
			);
			expect(hasOverPerformer).toBe(true);
		});

		it("should include regression risk adjustment when applicable", () => {
			const regressionRiskHome = createTeamData({
				safetyFlags: {
					...createTeamData().safetyFlags,
					regressionRisk: true,
				},
			});
			const awayTeam = createTeamData({ id: 2 });

			const result = simulateMatchOutcome(regressionRiskHome, awayTeam);

			const hasRegressionRisk = result.adjustmentsApplied?.some(
				(adj) => adj.name.includes("regression_risk"),
			);
			expect(hasRegressionRisk).toBe(true);
		});
	});

	describe("signal strength", () => {
		it("should include signal strength in result", () => {
			const homeTeam = createTeamData();
			const awayTeam = createTeamData({ id: 2 });

			const result = simulateMatchOutcome(homeTeam, awayTeam);

			expect(result.signalStrength).toBeDefined();
			expect(["Strong", "Moderate", "Balanced", "Weak"]).toContain(
				result.signalStrength,
			);
		});
	});

	describe("most probable outcome", () => {
		it("should correctly identify most probable outcome", () => {
			const homeTeam = createTeamData();
			const awayTeam = createTeamData({ id: 2 });

			const result = simulateMatchOutcome(homeTeam, awayTeam);

			expect(result.mostProbableOutcome).toBeDefined();
			// mostProbableOutcome is a human-readable sentence including the outcome
			expect(result.mostProbableOutcome).toMatch(/Home|Draw|Away/i);
		});

		it("should identify home as most probable when home has highest probability", () => {
			const strongHomeTeam = createTeamData({
				mind: { ...createTeamData().mind, tier: 1 },
				mood: {
					...createTeamData().mood,
					tier: 1,
					formString: "WWWWW",
					last10Points: 30,
				},
			});
			const weakAwayTeam = createTeamData({
				id: 2,
				mind: { ...createTeamData().mind, tier: 4 },
				mood: {
					...createTeamData().mood,
					tier: 4,
					formString: "LLLLL",
					last10Points: 0,
				},
			});

			const result = simulateMatchOutcome(strongHomeTeam, weakAwayTeam);

			// mostProbableOutcome is a sentence including "Home" for home win predictions
			expect(result.mostProbableOutcome).toMatch(/Home/i);
		});
	});

	describe("edge cases", () => {
		it("should handle teams with minimal data", () => {
			const minimalTeam = createTeamData({
				mind: {
					...createTeamData().mind,
					matchCount: 1,
					hasSufficientData: false,
				},
				mood: undefined as unknown as TeamData["mood"],
			});

			const result = simulateMatchOutcome(minimalTeam, minimalTeam);

			expect(result).toBeDefined();
			const total =
				(result.probabilityDistribution.home ?? 0) +
				(result.probabilityDistribution.draw ?? 0) +
				(result.probabilityDistribution.away ?? 0);
			expect(Math.round(total)).toBe(100);
		});

		it("should clamp extreme probability values", () => {
			// Create extreme mismatch
			const eliteTeam = createTeamData({
				mind: { ...createTeamData().mind, tier: 1, matchCount: 100 },
				mood: {
					...createTeamData().mood,
					tier: 1,
					formString: "WWWWWWWWWW",
					last10Points: 30,
				},
			});
			const relegationTeam = createTeamData({
				id: 2,
				mind: { ...createTeamData().mind, tier: 4, matchCount: 100 },
				mood: {
					...createTeamData().mood,
					tier: 4,
					formString: "LLLLLLLLLL",
					last10Points: 0,
				},
			});

			const h2h = createH2HData({
				homeTeamWins: 10,
				awayTeamWins: 0,
				draws: 0,
			});

			const result = simulateMatchOutcome(eliteTeam, relegationTeam, h2h);

			// Even extreme mismatches shouldn't produce 0% or 100%
			expect(result.probabilityDistribution.away).toBeGreaterThan(0);
			expect(result.probabilityDistribution.home).toBeLessThan(100);
			expect(result.probabilityDistribution.draw).toBeGreaterThan(0);
		});
	});
});

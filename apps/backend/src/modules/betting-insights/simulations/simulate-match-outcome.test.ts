/**
 * Tests for simulate-match-outcome.ts
 *
 * Match Result (1X2) simulation tests.
 */

import { describe, expect, it } from "vitest";
import type { H2HData, TeamData } from "../types";
import type { MatchContext } from "../match-context/context-adjustments";
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

	describe("live dog handling", () => {
		it("should shift probability from home win into draw/away (competitiveness), not inflate away win directly", () => {
			const baseHome = createTeamData({ name: "Home Team" });
			const baseAway = createTeamData({ id: 2, name: "Away Team" });

			const base = simulateMatchOutcome(baseHome, baseAway);

			const liveDogAway = createTeamData({
				id: 2,
				name: "Away Team",
				safetyFlags: { ...createTeamData().safetyFlags, liveDog: true },
			});
			const withLiveDog = simulateMatchOutcome(baseHome, liveDogAway);

			// Draw should increase and home should decrease (small shift)
			expect(withLiveDog.probabilityDistribution.draw ?? 0).toBeGreaterThan(
				base.probabilityDistribution.draw ?? 0,
			);
			expect(withLiveDog.probabilityDistribution.home ?? 0).toBeLessThan(
				base.probabilityDistribution.home ?? 0,
			);
			// Away can increase slightly, but should not jump dramatically like the old +5 approach
			expect(withLiveDog.probabilityDistribution.away ?? 0).toBeLessThan(
				(base.probabilityDistribution.away ?? 0) + 3,
			);

			// Ensure we record the reason for transparency
			const names = (withLiveDog.adjustmentsApplied ?? []).map((a) => a.name);
			expect(names).toContain("live_dog_competitiveness");
		});
	});

	describe("form score impact", () => {
		it("should increase home win probability for home team with better form", () => {
			const strongHomeTeam = createTeamData({
				mood: {
					...createTeamData().mood,
					tier: 1,
					formString: "WWWWW",
					last10Points: 30,
				},
			});
			const weakAwayTeam = createTeamData({
				id: 2,
				mood: {
					...createTeamData().mood,
					tier: 4,
					formString: "LLLLL",
					last10Points: 0,
				},
			});

			const equalHomeTeam = createTeamData();
			const equalAwayTeam = createTeamData({ id: 2 });

			const strongResult = simulateMatchOutcome(strongHomeTeam, weakAwayTeam);
			const equalResult = simulateMatchOutcome(equalHomeTeam, equalAwayTeam);

			const strongHomeProb = strongResult.probabilityDistribution.home ?? 0;
			const equalHomeProb = equalResult.probabilityDistribution.home ?? 0;

			expect(strongHomeProb).toBeGreaterThan(equalHomeProb);
		});

		it("should decrease home win probability when away team has better form", () => {
			const weakHomeTeam = createTeamData({
				mood: {
					...createTeamData().mood,
					tier: 4,
					formString: "LLLLL",
					last10Points: 0,
				},
			});
			const strongAwayTeam = createTeamData({
				id: 2,
				mood: {
					...createTeamData().mood,
					tier: 1,
					formString: "WWWWW",
					last10Points: 30,
				},
			});

			const equalHomeTeam = createTeamData();
			const equalAwayTeam = createTeamData({ id: 2 });

			const weakResult = simulateMatchOutcome(weakHomeTeam, strongAwayTeam);
			const equalResult = simulateMatchOutcome(equalHomeTeam, equalAwayTeam);

			const weakHomeProb = weakResult.probabilityDistribution.home ?? 0;
			const equalHomeProb = equalResult.probabilityDistribution.home ?? 0;

			expect(weakHomeProb).toBeLessThan(equalHomeProb);
		});
	});

	describe("H2H impact", () => {
		it("should increase home win probability with strong H2H record", () => {
			const homeTeam = createTeamData();
			const awayTeam = createTeamData({ id: 2 });

			const strongH2H = createH2HData({
				homeTeamWins: 8,
				awayTeamWins: 1,
				draws: 1,
			});
			const weakH2H = createH2HData({
				homeTeamWins: 1,
				awayTeamWins: 8,
				draws: 1,
			});

			const strongH2HResult = simulateMatchOutcome(homeTeam, awayTeam, strongH2H);
			const weakH2HResult = simulateMatchOutcome(homeTeam, awayTeam, weakH2H);

			const strongHomeProb = strongH2HResult.probabilityDistribution.home ?? 0;
			const weakHomeProb = weakH2HResult.probabilityDistribution.home ?? 0;

			expect(strongHomeProb).toBeGreaterThan(weakHomeProb);
		});

		it("should handle missing H2H data gracefully", () => {
			const homeTeam = createTeamData();
			const awayTeam = createTeamData({ id: 2 });

			const result = simulateMatchOutcome(homeTeam, awayTeam, undefined);

			expect(result).toBeDefined();
			expect(result.scenarioType).toBe("MatchOutcome");
			const total =
				(result.probabilityDistribution.home ?? 0) +
				(result.probabilityDistribution.draw ?? 0) +
				(result.probabilityDistribution.away ?? 0);
			expect(Math.round(total)).toBe(100);
		});

		it("should increase draw probability with high H2H draw rate", () => {
			const homeTeam = createTeamData();
			const awayTeam = createTeamData({ id: 2 });

			const highDrawH2H = createH2HData({
				homeTeamWins: 2,
				awayTeamWins: 2,
				draws: 6,
				h2hMatchCount: 10,
			});
			const lowDrawH2H = createH2HData({
				homeTeamWins: 5,
				awayTeamWins: 4,
				draws: 1,
				h2hMatchCount: 10,
			});

			const highDrawResult = simulateMatchOutcome(homeTeam, awayTeam, highDrawH2H);
			const lowDrawResult = simulateMatchOutcome(homeTeam, awayTeam, lowDrawH2H);

			const highDrawProb = highDrawResult.probabilityDistribution.draw ?? 0;
			const lowDrawProb = lowDrawResult.probabilityDistribution.draw ?? 0;

			expect(highDrawProb).toBeGreaterThan(lowDrawProb);
		});
	});

	describe("tier difference impact", () => {
		it("should favor higher tier team", () => {
			const eliteHomeTeam = createTeamData({
				mind: {
					...createTeamData().mind,
					tier: 1,
				},
			});
			const weakAwayTeam = createTeamData({
				id: 2,
				mind: {
					...createTeamData().mind,
					tier: 4,
				},
			});

			const equalHomeTeam = createTeamData({
				mind: {
					...createTeamData().mind,
					tier: 2,
				},
			});
			const equalAwayTeam = createTeamData({
				id: 2,
				mind: {
					...createTeamData().mind,
					tier: 2,
				},
			});

			const mismatchResult = simulateMatchOutcome(eliteHomeTeam, weakAwayTeam);
			const equalResult = simulateMatchOutcome(equalHomeTeam, equalAwayTeam);

			const mismatchHomeProb = mismatchResult.probabilityDistribution.home ?? 0;
			const equalHomeProb = equalResult.probabilityDistribution.home ?? 0;

			expect(mismatchHomeProb).toBeGreaterThan(equalHomeProb);
		});

		it("should increase draw probability when tiers are equal", () => {
			const sameTierHome = createTeamData({
				mind: { ...createTeamData().mind, tier: 2 },
			});
			const sameTierAway = createTeamData({
				id: 2,
				mind: { ...createTeamData().mind, tier: 2 },
			});

			const diffTierHome = createTeamData({
				mind: { ...createTeamData().mind, tier: 1 },
			});
			const diffTierAway = createTeamData({
				id: 2,
				mind: { ...createTeamData().mind, tier: 4 },
			});

			const sameTierResult = simulateMatchOutcome(sameTierHome, sameTierAway);
			const diffTierResult = simulateMatchOutcome(diffTierHome, diffTierAway);

			const sameTierDraw = sameTierResult.probabilityDistribution.draw ?? 0;
			const diffTierDraw = diffTierResult.probabilityDistribution.draw ?? 0;

			expect(sameTierDraw).toBeGreaterThan(diffTierDraw);
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

	describe("context adjustments", () => {
		it("should apply neutral venue adjustment", () => {
			const homeTeam = createTeamData();
			const awayTeam = createTeamData({ id: 2 });

			const neutralContext: MatchContext = {
				matchType: {
					type: "LEAGUE",
					importance: "MEDIUM",
					isKnockout: false,
					isNeutralVenue: true,
					isDerby: false,
					isEndOfSeason: false,
					isPostInternationalBreak: false,
				},
				derby: {
					isDerby: false,
					derbyType: "NONE",
					intensity: "LOW",
				},
				isEarlySeason: false,
				isEndOfSeason: false,
				isPostInternationalBreak: false,
				adjustments: {
					recentForm: 1,
					h2h: 1,
					homeAdvantage: 0.5,
					motivation: 1,
					goalScoring: 1,
					confidenceReduction: 0,
					goalExpectationAdjustment: 0,
				},
			};

			const result = simulateMatchOutcome(homeTeam, awayTeam, undefined, neutralContext);

			const hasNeutralVenue = result.adjustmentsApplied?.some(
				(adj) => adj.name.includes("neutral_venue"),
			);
			expect(hasNeutralVenue).toBe(true);
		});

		it("should apply derby adjustment", () => {
			const homeTeam = createTeamData();
			const awayTeam = createTeamData({ id: 2 });

			const derbyContext: MatchContext = {
				matchType: {
					type: "LEAGUE",
					importance: "MEDIUM",
					isKnockout: false,
					isNeutralVenue: false,
					isDerby: true,
					isEndOfSeason: false,
					isPostInternationalBreak: false,
				},
				derby: {
					isDerby: true,
					derbyType: "LOCAL",
					derbyName: "Test Derby",
					intensity: "HIGH",
				},
				isEarlySeason: false,
				isEndOfSeason: false,
				isPostInternationalBreak: false,
				adjustments: {
					recentForm: 0.8,
					h2h: 1.2,
					homeAdvantage: 0.9,
					motivation: 1,
					goalScoring: 1,
					confidenceReduction: 0,
					goalExpectationAdjustment: 0,
				},
			};

			const result = simulateMatchOutcome(homeTeam, awayTeam, undefined, derbyContext);

			const hasDerby = result.adjustmentsApplied?.some(
				(adj) => adj.name.includes("derby"),
			);
			expect(hasDerby).toBe(true);
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

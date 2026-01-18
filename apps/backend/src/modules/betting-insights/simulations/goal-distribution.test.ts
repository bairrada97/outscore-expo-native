import { describe, expect, it } from "vitest";
import type { TeamData } from "../types";
import { buildGoalDistribution } from "./goal-distribution";

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

describe("goal distribution", () => {
	it("should return probabilities that sum to 100", () => {
		const homeTeam = createTeamData({ name: "Home Team" });
		const awayTeam = createTeamData({ id: 2, name: "Away Team" });

		const result = buildGoalDistribution(homeTeam, awayTeam, {
			maxGoals: 6,
			recentFormWeight: 0.15,
			recentMatchesCount: 8,
			dixonColesRho: -0.05,
		});

		const total = result.probHomeWin + result.probDraw + result.probAwayWin;
		expect(Math.round(total)).toBe(100);
	});

	it("should have non-increasing over probabilities as line increases", () => {
		const homeTeam = createTeamData({ name: "Home Team" });
		const awayTeam = createTeamData({ id: 2, name: "Away Team" });

		const result = buildGoalDistribution(homeTeam, awayTeam, {
			maxGoals: 6,
			recentFormWeight: 0.15,
			recentMatchesCount: 8,
			dixonColesRho: -0.05,
		});

		const lines = [0.5, 1.5, 2.5, 3.5, 4.5, 5.5];
		for (let i = 0; i < lines.length - 1; i += 1) {
			const current = result.probOverByLine[String(lines[i])] ?? 0;
			const next = result.probOverByLine[String(lines[i + 1])] ?? 0;
			expect(current).toBeGreaterThanOrEqual(next);
		}
	});

	it("should use xG when available in recent matches", () => {
		const withXg = createTeamData({
			lastHomeMatches: [
				{
					id: 1,
					date: "2024-01-01",
					homeTeam: { id: 1, name: "Test Team" },
					awayTeam: { id: 2, name: "Other Team" },
					score: { home: 1, away: 0 },
					result: "WIN",
					goalsScored: 1,
					goalsConceded: 0,
					expectedGoals: 2.2,
					goalsPrevented: 0.1,
					league: { id: 1, name: "League" },
					season: 2024,
					isHome: true,
				},
				{
					id: 2,
					date: "2024-01-02",
					homeTeam: { id: 1, name: "Test Team" },
					awayTeam: { id: 3, name: "Other Team" },
					score: { home: 1, away: 0 },
					result: "WIN",
					goalsScored: 1,
					goalsConceded: 0,
					expectedGoals: 2.0,
					goalsPrevented: 0.2,
					league: { id: 1, name: "League" },
					season: 2024,
					isHome: true,
				},
				{
					id: 3,
					date: "2024-01-03",
					homeTeam: { id: 1, name: "Test Team" },
					awayTeam: { id: 4, name: "Other Team" },
					score: { home: 1, away: 0 },
					result: "WIN",
					goalsScored: 1,
					goalsConceded: 0,
					expectedGoals: 2.1,
					goalsPrevented: 0.0,
					league: { id: 1, name: "League" },
					season: 2024,
					isHome: true,
				},
			],
		});

		const base = createTeamData();
		const resultWithXg = buildGoalDistribution(withXg, base, {
			maxGoals: 6,
			recentFormWeight: 0.15,
			recentMatchesCount: 8,
			dixonColesRho: -0.05,
		});
		const resultWithoutXg = buildGoalDistribution(base, base, {
			maxGoals: 6,
			recentFormWeight: 0.15,
			recentMatchesCount: 8,
			dixonColesRho: -0.05,
		});

		expect(resultWithXg.lambdaHome).toBeGreaterThan(
			resultWithoutXg.lambdaHome,
		);
	});

	it("should apply Dixon-Coles correction to low-score cells", () => {
		const homeTeam = createTeamData();
		const awayTeam = createTeamData({ id: 2 });

		const base = buildGoalDistribution(homeTeam, awayTeam, {
			maxGoals: 6,
			recentFormWeight: 0.15,
			recentMatchesCount: 8,
			dixonColesRho: 0,
		});
		const adjusted = buildGoalDistribution(homeTeam, awayTeam, {
			maxGoals: 6,
			recentFormWeight: 0.15,
			recentMatchesCount: 8,
			dixonColesRho: -0.1,
		});

		expect(adjusted.scoreMatrix[0][0]).not.toBe(base.scoreMatrix[0][0]);
		expect(adjusted.scoreMatrix[1][1]).not.toBe(base.scoreMatrix[1][1]);
	});
});

describe("buildGoalDistribution", () => {
	it("should produce probabilities that sum to ~100", () => {
		const homeTeam = createTeamData({ name: "Home" });
		const awayTeam = createTeamData({ id: 2, name: "Away" });

		const dist = buildGoalDistribution(homeTeam, awayTeam, {
			maxGoals: 6,
			recentFormWeight: 0.15,
			recentMatchesCount: 8,
			dixonColesRho: -0.05,
		});

		const total = dist.probHomeWin + dist.probDraw + dist.probAwayWin;
		expect(Math.round(total)).toBe(100);
	});

	it("should adjust low-score outcomes when Dixon-Coles rho changes", () => {
		const homeTeam = createTeamData({ name: "Home" });
		const awayTeam = createTeamData({ id: 2, name: "Away" });

		const base = buildGoalDistribution(homeTeam, awayTeam, {
			maxGoals: 6,
			recentFormWeight: 0.15,
			recentMatchesCount: 8,
			dixonColesRho: 0,
		});
		const adjusted = buildGoalDistribution(homeTeam, awayTeam, {
			maxGoals: 6,
			recentFormWeight: 0.15,
			recentMatchesCount: 8,
			dixonColesRho: -0.05,
		});

		expect(adjusted.scoreMatrix[0][0]).not.toBe(base.scoreMatrix[0][0]);
	});

	it("should keep basic market relationships consistent", () => {
		const homeTeam = createTeamData({ name: "Home" });
		const awayTeam = createTeamData({ id: 2, name: "Away" });

		const dist = buildGoalDistribution(homeTeam, awayTeam, {
			maxGoals: 6,
			recentFormWeight: 0.15,
			recentMatchesCount: 8,
			dixonColesRho: -0.05,
		});

		const over05 = dist.probOverByLine["0.5"] ?? 0;
		const bttsYes = dist.probBTTSYes;
		expect(over05).toBeGreaterThanOrEqual(bttsYes);
	});

	it("should increase total-goal markets when globalGoalsMult rises", () => {
		const homeTeam = createTeamData({ name: "Home" });
		const awayTeam = createTeamData({ id: 2, name: "Away" });

		const base = buildGoalDistribution(homeTeam, awayTeam, {
			maxGoals: 6,
			recentFormWeight: 0.15,
			recentMatchesCount: 8,
			dixonColesRho: -0.05,
		});

		const boosted = buildGoalDistribution(
			homeTeam,
			awayTeam,
			{
				maxGoals: 6,
				recentFormWeight: 0.15,
				recentMatchesCount: 8,
				dixonColesRho: -0.05,
			},
			{
				attackHomeMult: 1,
				defenseHomeMult: 1,
				attackAwayMult: 1,
				defenseAwayMult: 1,
				globalGoalsMult: 1.1,
			},
		);

		expect(boosted.probOverByLine["2.5"] ?? 0).toBeGreaterThan(
			base.probOverByLine["2.5"] ?? 0,
		);
		expect(boosted.probBTTSYes).toBeGreaterThan(base.probBTTSYes);
	});

	it("should shift win balance when attack multipliers change", () => {
		const homeTeam = createTeamData({ name: "Home" });
		const awayTeam = createTeamData({ id: 2, name: "Away" });

		const base = buildGoalDistribution(homeTeam, awayTeam, {
			maxGoals: 6,
			recentFormWeight: 0.15,
			recentMatchesCount: 8,
			dixonColesRho: -0.05,
		});

		const shifted = buildGoalDistribution(
			homeTeam,
			awayTeam,
			{
				maxGoals: 6,
				recentFormWeight: 0.15,
				recentMatchesCount: 8,
				dixonColesRho: -0.05,
			},
			{
				attackHomeMult: 1.06,
				defenseHomeMult: 1,
				attackAwayMult: 0.94,
				defenseAwayMult: 1,
				globalGoalsMult: 1,
			},
		);

		expect(shifted.probHomeWin).toBeGreaterThan(base.probHomeWin);
		expect(shifted.probAwayWin).toBeLessThan(base.probAwayWin);
	});
});

import { describe, expect, it } from "vitest";
import type { ProcessedMatch, TeamStatistics } from "../types";
import { insightsService } from "./insights.service";

function createMatch(params: {
	isHome: boolean;
	goalsScored: number;
	goalsConceded: number;
}): ProcessedMatch {
	return {
		id: 1,
		date: "2025-01-01T00:00:00Z",
		homeTeam: { id: 1, name: "Team A" },
		awayTeam: { id: 2, name: "Team B" },
		score: { home: 1, away: 0 },
		result: params.goalsScored > params.goalsConceded ? "W" : params.goalsScored < params.goalsConceded ? "L" : "D",
		goalsScored: params.goalsScored,
		goalsConceded: params.goalsConceded,
		league: { id: 1, name: "Some League", round: "Regular Season - 1" },
		season: 2025,
		isHome: params.isHome,
	};
}

describe("insightsService.calculateTeamStats", () => {
	it("should fallback to recent matches when API stats sample is tiny (played.total < threshold or home/away = 0)", () => {
		const matches: ProcessedMatch[] = [
			createMatch({ isHome: true, goalsScored: 2, goalsConceded: 0 }),
			createMatch({ isHome: true, goalsScored: 1, goalsConceded: 1 }),
			createMatch({ isHome: false, goalsScored: 1, goalsConceded: 2 }),
			createMatch({ isHome: false, goalsScored: 3, goalsConceded: 1 }),
		];

		// Simulate CUP stats with only 1 match and 0 home matches (like KNVB Beker early rounds)
		type MinimalRawTeamStats = {
			form?: string;
			fixtures: { played: { home: number; away: number; total: number } };
			goals: {
				for: { average: { total: string; home: string; away: string } };
				against: { average: { total: string; home: string; away: string } };
			};
		};

		const stats: MinimalRawTeamStats = {
			form: "W",
			fixtures: { played: { home: 0, away: 1, total: 1 } },
			goals: {
				for: { average: { total: "3.0", home: "0.0", away: "3.0" } },
				against: { average: { total: "1.0", home: "0.0", away: "1.0" } },
			},
		};

		const calculateTeamStats = (insightsService as unknown as {
			calculateTeamStats: (
				stats: unknown,
				standingsData: unknown,
				matches: ProcessedMatch[],
			) => TeamStatistics;
		}).calculateTeamStats;

		const result = calculateTeamStats(stats, null, matches);

		// Home averages should not be 0.0 just because cup stats have 0 home matches
		expect(result.homeAvgScored).toBeGreaterThan(0);
		expect(result.homeAvgConceded).toBeGreaterThanOrEqual(0);
		expect(result.awayAvgScored).toBeGreaterThan(0);
		expect(result.awayAvgConceded).toBeGreaterThanOrEqual(0);

		// Overall averages should be derived from matches, not inflated cup totals (e.g. 3.0 from 1 match)
		// Our match sample: goalsScored = (2+1+1+3)/4 = 1.75
		expect(result.avgGoalsScored).toBeCloseTo(1.75, 2);
	});
});



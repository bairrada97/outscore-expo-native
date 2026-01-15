/**
 * Phase 1 Self Tests (No external test runner required)
 *
 * These are lightweight sanity checks for the Phase 1 core helpers.
 * You can call `runBettingInsightsPhase1SelfTests()` in a dev-only context.
 *
 * Note: This intentionally avoids Node-specific APIs so it typechecks under the Workers TS config.
 */

import type { ProcessedMatch } from "../types";
import { calculateFormationFrequency } from "./formation-helpers";
import {
  calculateSingleH2HWeight,
  calculateWeightedAverage,
  getSeasonFromDate,
  isSameSeasonHelper,
} from "./h2h-helpers";
import {
  extractRoundNumber,
  filterNonFriendlyMatches,
  isEarlySeason,
} from "./helpers";
import {
  calculateEfficiencyIndex,
  categorizeTier,
  detectMoodVsMindGap,
  detectOneSeasonWonder,
  getSeasonsInCurrentLeague,
} from "./tier-helpers";

function assert(condition: unknown, message: string): void {
	if (!condition) {
		throw new Error(`Phase1SelfTest failed: ${message}`);
	}
}

function makeMatch(partial: Partial<ProcessedMatch>): ProcessedMatch {
	return {
		id: partial.id ?? 1,
		date: partial.date ?? new Date().toISOString(),
		homeTeam: partial.homeTeam ?? { id: 1, name: "Home" },
		awayTeam: partial.awayTeam ?? { id: 2, name: "Away" },
		score: partial.score ?? { home: 1, away: 0 },
		result: partial.result ?? "W",
		goalsScored: partial.goalsScored ?? 1,
		goalsConceded: partial.goalsConceded ?? 0,
		firstHalfGoals: partial.firstHalfGoals,
		league: partial.league ?? {
			id: 39,
			name: "Premier League",
			round: "Regular Season - 3",
		},
		season: partial.season ?? 2024,
		formation: partial.formation,
		isHome: partial.isHome ?? true,
	};
}

export function runBettingInsightsPhase1SelfTests(): void {
	// ---------------------------------------------------------------------------
	// Friendly filtering
	// ---------------------------------------------------------------------------
	{
		const matches = [
			{ league: { name: "Club Friendly Games" } },
			{ league: { name: "Premier League" } },
		];
		const filtered = filterNonFriendlyMatches(matches);
		assert(
			filtered.length === 1,
			"filterNonFriendlyMatches should remove friendlies",
		);
		assert(
			filtered[0]?.league?.name === "Premier League",
			"filterNonFriendlyMatches kept wrong match",
		);
	}
	assert(
		extractRoundNumber("Regular Season - 3") === 3,
		"extractRoundNumber Regular Season",
	);
	assert(extractRoundNumber("Matchday 5") === 5, "extractRoundNumber Matchday");
	assert(extractRoundNumber("Jornada 10") === 10, "extractRoundNumber Jornada");
	assert(
		extractRoundNumber(undefined) === null,
		"extractRoundNumber undefined should be null",
	);
	assert(
		isEarlySeason("Regular Season - 1") === true,
		"isEarlySeason should be true for round 1",
	);
	assert(
		isEarlySeason("Regular Season - 6") === false,
		"isEarlySeason should be false after threshold",
	);

	// ---------------------------------------------------------------------------
	// H2H helpers
	// ---------------------------------------------------------------------------
	{
		const seasonA = getSeasonFromDate(new Date("2024-08-01T00:00:00.000Z"));
		const seasonB = getSeasonFromDate(new Date("2025-01-01T00:00:00.000Z"));
		assert(
			seasonA === 2024,
			"getSeasonFromDate Aug should be current-year season",
		);
		assert(
			seasonB === 2024,
			"getSeasonFromDate Jan should be previous-year season",
		);
		assert(
			isSameSeasonHelper("2024-10-01", "2025-03-01") === true,
			"isSameSeasonHelper should detect same season",
		);

		const avg = calculateWeightedAverage([10, 20], [0.25, 0.75]);
		assert(
			Math.abs(avg - 17.5) < 1e-9,
			"calculateWeightedAverage should be correct",
		);

		const weight = calculateSingleH2HWeight(
			"2025-12-15T00:00:00.000Z",
			undefined,
			new Date("2026-01-01T00:00:00.000Z"),
		);
		assert(weight > 0, "calculateSingleH2HWeight should be positive");
	}

	// ---------------------------------------------------------------------------
	// EI + tiers + mind/mood gap + one-season wonder + seasons-in-league
	// ---------------------------------------------------------------------------
	{
		const matches: ProcessedMatch[] = [
			makeMatch({
				result: "W",
				goalsScored: 2,
				goalsConceded: 0,
				season: 2024,
				league: { id: 39, name: "Premier League" },
			}),
			makeMatch({
				result: "D",
				goalsScored: 1,
				goalsConceded: 1,
				season: 2024,
				league: { id: 39, name: "Premier League" },
			}),
			makeMatch({
				result: "L",
				goalsScored: 0,
				goalsConceded: 1,
				season: 2023,
				league: { id: 39, name: "Premier League" },
			}),
		];

		const ei = calculateEfficiencyIndex(matches);
		assert(
			typeof ei === "number" && !Number.isNaN(ei),
			"calculateEfficiencyIndex should return a number",
		);

		const tier = categorizeTier(2.1);
		assert(tier === 1, "categorizeTier should classify EI>=2.0 as Tier 1");

		const seasons = getSeasonsInCurrentLeague(matches, 39);
		assert(
			seasons === 2,
			"getSeasonsInCurrentLeague should count unique seasons",
		);

		assert(
			detectOneSeasonWonder(4, 1, 1) === true,
			"detectOneSeasonWonder should trigger for promoted overperformer",
		);
		const gap = detectMoodVsMindGap(1, 4, 3);
		assert(
			gap.isSleepingGiant === true,
			"detectMoodVsMindGap should detect sleeping giant",
		);
	}

	// ---------------------------------------------------------------------------
	// Formation frequency
	// ---------------------------------------------------------------------------
	{
		const matches: ProcessedMatch[] = [
			makeMatch({ formation: "4-3-3" }),
			makeMatch({ formation: "4-3-3" }),
			makeMatch({ formation: "4-2-3-1" }),
		];
		const freq = calculateFormationFrequency(matches);
		assert(
			freq["4-3-3"] !== undefined,
			"calculateFormationFrequency should include 4-3-3",
		);
	}
}

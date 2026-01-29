/**
 * ML Feature Computation
 *
 * Computes features matching the ML training set for LightGBM inference.
 * These features must match exactly what the model was trained on.
 *
 * Features from training:
 * - season, leagueId (metadata)
 * - homeFormScore, awayFormScore (weighted form)
 * - homePPG10, awayPPG10 (points per game last 10)
 * - homeGF10, homeGA10, awayGF10, awayGA10 (goals for/against last 10)
 * - homeDaysSince, awayDaysSince (rest days)
 * - homeHomeFormScore, awayAwayFormScore (home/away specific form)
 * - homeElo, awayElo, eloDiff (ELO ratings and difference)
 * - homeTier, awayTier, tierGap (team tiers and gap)
 * - h2h_overall_* (7 H2H features - any venue)
 * - h2h_venue_* (7 H2H features - same venue configuration)
 */

import type { H2HData, ProcessedMatch, TeamData } from "../types";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Complete feature set for ML inference
 */
export interface MLFeatures {
	// Metadata (not always used in model but needed for feature array)
	season: number;
	leagueId: number | null;

	// Form features
	homeFormScore: number;
	awayFormScore: number;
	homePPG10: number;
	awayPPG10: number;
	homeGF10: number;
	homeGA10: number;
	awayGF10: number;
	awayGA10: number;

	// Rest features
	homeDaysSince: number | null;
	awayDaysSince: number | null;

	// Home/Away specific form
	homeHomeFormScore: number;
	awayAwayFormScore: number;

	// ELO features (team quality)
	homeElo: number;
	awayElo: number;
	eloDiff: number;

	// Tier features (league/performance tier)
	homeTier: number;
	awayTier: number;
	tierGap: number;

	// H2H Overall (any venue)
	h2h_overall_matches: number;
	h2h_overall_home_win_pct: number | null;
	h2h_overall_away_win_pct: number | null;
	h2h_overall_draw_pct: number | null;
	h2h_overall_avg_goals: number | null;
	h2h_overall_btts_pct: number | null;
	h2h_overall_over_2_5_pct: number | null;

	// H2H Venue (same venue configuration)
	h2h_venue_matches: number;
	h2h_venue_home_win_pct: number | null;
	h2h_venue_away_win_pct: number | null;
	h2h_venue_draw_pct: number | null;
	h2h_venue_avg_goals: number | null;
	h2h_venue_btts_pct: number | null;
	h2h_venue_over_2_5_pct: number | null;
}

// ============================================================================
// FORM SCORE CALCULATION
// ============================================================================

type FormResult = "W" | "D" | "L";

const RESULT_POINTS: Record<FormResult, number> = {
	W: 3,
	D: 1,
	L: 0,
};

/**
 * Calculate weighted form score matching ML training
 * Recent games (0-1) get 1.5x weight, mid games (2-3) get 1.2x, older games get 1x
 */
function calculateWeightedFormScore(results: FormResult[]): number {
	if (results.length === 0) return 0;

	const weights = results.map((_, index) => {
		if (index < 2) return 1.5;
		if (index < 4) return 1.2;
		return 1;
	});

	const totalWeight = weights.reduce((sum, value) => sum + value, 0);
	if (totalWeight === 0) return 0;

	const weighted = results.reduce(
		(sum, result, idx) => sum + RESULT_POINTS[result] * weights[idx],
		0,
	);

	return weighted / totalWeight;
}

/**
 * Parse form string (e.g., "WWDLW") to results array
 */
function parseFormString(form: string): FormResult[] {
	return form.split("").filter((c): c is FormResult => c === "W" || c === "D" || c === "L");
}

/**
 * Get result from match perspective
 */
function getMatchResult(
	match: ProcessedMatch,
	teamId: number,
): FormResult {
	const isHome = match.homeTeam.id === teamId;
	const homeGoals = match.score?.home ?? 0;
	const awayGoals = match.score?.away ?? 0;

	if (homeGoals === awayGoals) return "D";
	const homeWon = homeGoals > awayGoals;
	return homeWon === isHome ? "W" : "L";
}

// ============================================================================
// STATS CALCULATION
// ============================================================================

/**
 * Calculate stats from last N matches
 */
function calculateMatchStats(
	matches: ProcessedMatch[],
	teamId: number,
	n: number,
): {
	results: FormResult[];
	ppg: number;
	gf: number;
	ga: number;
} {
	const slice = matches.slice(0, n);
	if (slice.length === 0) {
		return { results: [], ppg: 0, gf: 0, ga: 0 };
	}

	const results: FormResult[] = [];
	let totalPoints = 0;
	let totalGoalsFor = 0;
	let totalGoalsAgainst = 0;

	for (const match of slice) {
		const isHome = match.homeTeam.id === teamId;
		const homeGoals = match.score?.home ?? 0;
		const awayGoals = match.score?.away ?? 0;

		const goalsFor = isHome ? homeGoals : awayGoals;
		const goalsAgainst = isHome ? awayGoals : homeGoals;

		totalGoalsFor += goalsFor;
		totalGoalsAgainst += goalsAgainst;

		const result = getMatchResult(match, teamId);
		results.push(result);

		if (result === "W") totalPoints += 3;
		else if (result === "D") totalPoints += 1;
	}

	return {
		results,
		ppg: totalPoints / slice.length,
		gf: totalGoalsFor / slice.length,
		ga: totalGoalsAgainst / slice.length,
	};
}

// ============================================================================
// H2H FEATURE CALCULATION
// ============================================================================

/**
 * Compute H2H statistics from H2HData
 * Note: H2HData already has computed stats, we just need to extract them
 */
function computeH2HOverallFeatures(
	h2h: H2HData | undefined,
	homeTeamId: number,
	awayTeamId: number,
): {
	matches: number;
	home_win_pct: number | null;
	away_win_pct: number | null;
	draw_pct: number | null;
	avg_goals: number | null;
	btts_pct: number | null;
	over_2_5_pct: number | null;
} {
	if (!h2h || h2h.h2hMatchCount === 0) {
		return {
			matches: 0,
			home_win_pct: null,
			away_win_pct: null,
			draw_pct: null,
			avg_goals: null,
			btts_pct: null,
			over_2_5_pct: null,
		};
	}

	const total = h2h.h2hMatchCount;

	return {
		matches: total,
		home_win_pct: (h2h.homeTeamWins / total) * 100,
		away_win_pct: (h2h.awayTeamWins / total) * 100,
		draw_pct: (h2h.draws / total) * 100,
		avg_goals: h2h.avgGoals,
		btts_pct: h2h.bttsPercentage,
		over_2_5_pct: h2h.goalLineOverPct["2.5"] ?? null,
	};
}

/**
 * Compute venue-specific H2H (same home/away configuration)
 * This filters H2H matches to only include those where teams played in same venue config
 */
function computeH2HVenueFeatures(
	h2h: H2HData | undefined,
	homeTeamId: number,
	awayTeamId: number,
): {
	matches: number;
	home_win_pct: number | null;
	away_win_pct: number | null;
	draw_pct: number | null;
	avg_goals: number | null;
	btts_pct: number | null;
	over_2_5_pct: number | null;
} {
	if (!h2h || !h2h.matches || h2h.matches.length === 0) {
		return {
			matches: 0,
			home_win_pct: null,
			away_win_pct: null,
			draw_pct: null,
			avg_goals: null,
			btts_pct: null,
			over_2_5_pct: null,
		};
	}

	// Filter to matches where current home team was also home
	const venueMatches = h2h.matches.filter(
		(match) => match.homeTeam.id === homeTeamId && match.awayTeam.id === awayTeamId,
	);

	if (venueMatches.length === 0) {
		return {
			matches: 0,
			home_win_pct: null,
			away_win_pct: null,
			draw_pct: null,
			avg_goals: null,
			btts_pct: null,
			over_2_5_pct: null,
		};
	}

	let homeWins = 0;
	let awayWins = 0;
	let draws = 0;
	let totalGoals = 0;
	let bttsCount = 0;
	let over25Count = 0;

	for (const match of venueMatches) {
		const homeGoals = match.score?.home ?? 0;
		const awayGoals = match.score?.away ?? 0;
		const total = homeGoals + awayGoals;

		if (homeGoals > awayGoals) homeWins++;
		else if (awayGoals > homeGoals) awayWins++;
		else draws++;

		totalGoals += total;
		if (homeGoals > 0 && awayGoals > 0) bttsCount++;
		if (total > 2.5) over25Count++;
	}

	const count = venueMatches.length;

	return {
		matches: count,
		home_win_pct: (homeWins / count) * 100,
		away_win_pct: (awayWins / count) * 100,
		draw_pct: (draws / count) * 100,
		avg_goals: totalGoals / count,
		btts_pct: (bttsCount / count) * 100,
		over_2_5_pct: (over25Count / count) * 100,
	};
}

// ============================================================================
// MAIN FEATURE COMPUTATION
// ============================================================================

// ============================================================================
// ELO CONSTANTS
// ============================================================================

/** Default ELO for teams with no rating */
const DEFAULT_ELO = 1500;

/** Home advantage in ELO points (matching training) */
const HOME_ADVANTAGE_ELO = 100;

// ============================================================================
// MAIN FEATURE COMPUTATION
// ============================================================================

/**
 * Compute all ML features from team data and H2H
 *
 * @param homeTeam - Home team data
 * @param awayTeam - Away team data
 * @param h2h - Head-to-head data (optional)
 * @param season - Current season year
 * @param leagueId - League ID (optional)
 * @returns Complete feature set for ML inference
 */
export function computeMLFeatures(
	homeTeam: TeamData,
	awayTeam: TeamData,
	h2h: H2HData | undefined,
	season: number,
	leagueId: number | null,
): MLFeatures {
	// Form scores from form string (already available in mood layer)
	const homeFormResults = parseFormString(homeTeam.mood?.formString ?? homeTeam.stats?.form ?? "");
	const awayFormResults = parseFormString(awayTeam.mood?.formString ?? awayTeam.stats?.form ?? "");

	const homeFormScore = calculateWeightedFormScore(homeFormResults.slice(0, 10));
	const awayFormScore = calculateWeightedFormScore(awayFormResults.slice(0, 10));

	// PPG and goals from mood layer (last 10 matches)
	const homePPG10 = homeTeam.mood?.last10Points
		? homeTeam.mood.last10Points / 10
		: 0;
	const awayPPG10 = awayTeam.mood?.last10Points
		? awayTeam.mood.last10Points / 10
		: 0;

	const homeGF10 = homeTeam.mood?.last10GoalsScored
		? homeTeam.mood.last10GoalsScored / 10
		: homeTeam.stats?.avgGoalsScored ?? 0;
	const homeGA10 = homeTeam.mood?.last10GoalsConceded
		? homeTeam.mood.last10GoalsConceded / 10
		: homeTeam.stats?.avgGoalsConceded ?? 0;
	const awayGF10 = awayTeam.mood?.last10GoalsScored
		? awayTeam.mood.last10GoalsScored / 10
		: awayTeam.stats?.avgGoalsScored ?? 0;
	const awayGA10 = awayTeam.mood?.last10GoalsConceded
		? awayTeam.mood.last10GoalsConceded / 10
		: awayTeam.stats?.avgGoalsConceded ?? 0;

	// Rest days
	const homeDaysSince = homeTeam.daysSinceLastMatch ?? null;
	const awayDaysSince = awayTeam.daysSinceLastMatch ?? null;

	// Home/Away specific form - calculate from venue-specific matches
	const homeHomeResults = homeTeam.lastHomeMatches
		? homeTeam.lastHomeMatches.slice(0, 5).map((m) => getMatchResult(m, homeTeam.id))
		: [];
	const awayAwayResults = awayTeam.lastAwayMatches
		? awayTeam.lastAwayMatches.slice(0, 5).map((m) => getMatchResult(m, awayTeam.id))
		: [];

	const homeHomeFormScore = calculateWeightedFormScore(homeHomeResults);
	const awayAwayFormScore = calculateWeightedFormScore(awayAwayResults);

	// ELO features - critical for team quality
	const homeElo = homeTeam.elo?.rating ?? DEFAULT_ELO;
	const awayElo = awayTeam.elo?.rating ?? DEFAULT_ELO;
	// eloDiff includes home advantage (matching training)
	const eloDiff = homeElo + HOME_ADVANTAGE_ELO - awayElo;

	// Tier features - using performance tier (mind.tier)
	// Note: Tier is 1-4 where 1 = elite, 4 = lower tier
	const homeTier = homeTeam.mind?.tier ?? 2;
	const awayTier = awayTeam.mind?.tier ?? 2;
	const tierGap = homeTier - awayTier; // Negative = home is better tier

	// H2H features
	const h2hOverall = computeH2HOverallFeatures(h2h, homeTeam.id, awayTeam.id);
	const h2hVenue = computeH2HVenueFeatures(h2h, homeTeam.id, awayTeam.id);

	return {
		season,
		leagueId,

		homeFormScore,
		awayFormScore,
		homePPG10,
		awayPPG10,
		homeGF10,
		homeGA10,
		awayGF10,
		awayGA10,

		homeDaysSince,
		awayDaysSince,

		homeHomeFormScore,
		awayAwayFormScore,

		// ELO features
		homeElo,
		awayElo,
		eloDiff,

		// Tier features
		homeTier,
		awayTier,
		tierGap,

		h2h_overall_matches: h2hOverall.matches,
		h2h_overall_home_win_pct: h2hOverall.home_win_pct,
		h2h_overall_away_win_pct: h2hOverall.away_win_pct,
		h2h_overall_draw_pct: h2hOverall.draw_pct,
		h2h_overall_avg_goals: h2hOverall.avg_goals,
		h2h_overall_btts_pct: h2hOverall.btts_pct,
		h2h_overall_over_2_5_pct: h2hOverall.over_2_5_pct,

		h2h_venue_matches: h2hVenue.matches,
		h2h_venue_home_win_pct: h2hVenue.home_win_pct,
		h2h_venue_away_win_pct: h2hVenue.away_win_pct,
		h2h_venue_draw_pct: h2hVenue.draw_pct,
		h2h_venue_avg_goals: h2hVenue.avg_goals,
		h2h_venue_btts_pct: h2hVenue.btts_pct,
		h2h_venue_over_2_5_pct: h2hVenue.over_2_5_pct,
	};
}

/**
 * Convert MLFeatures to a record for use with createFeatureArray
 */
export function featuresToRecord(
	features: MLFeatures,
): Record<string, number | null | undefined> {
	return {
		season: features.season,
		leagueId: features.leagueId,
		homeFormScore: features.homeFormScore,
		awayFormScore: features.awayFormScore,
		homePPG10: features.homePPG10,
		awayPPG10: features.awayPPG10,
		homeGF10: features.homeGF10,
		homeGA10: features.homeGA10,
		awayGF10: features.awayGF10,
		awayGA10: features.awayGA10,
		homeDaysSince: features.homeDaysSince,
		awayDaysSince: features.awayDaysSince,
		homeHomeFormScore: features.homeHomeFormScore,
		awayAwayFormScore: features.awayAwayFormScore,
		// ELO features
		homeElo: features.homeElo,
		awayElo: features.awayElo,
		eloDiff: features.eloDiff,
		// Tier features
		homeTier: features.homeTier,
		awayTier: features.awayTier,
		tierGap: features.tierGap,
		// H2H features
		h2h_overall_matches: features.h2h_overall_matches,
		h2h_overall_home_win_pct: features.h2h_overall_home_win_pct,
		h2h_overall_away_win_pct: features.h2h_overall_away_win_pct,
		h2h_overall_draw_pct: features.h2h_overall_draw_pct,
		h2h_overall_avg_goals: features.h2h_overall_avg_goals,
		h2h_overall_btts_pct: features.h2h_overall_btts_pct,
		h2h_overall_over_2_5_pct: features.h2h_overall_over_2_5_pct,
		h2h_venue_matches: features.h2h_venue_matches,
		h2h_venue_home_win_pct: features.h2h_venue_home_win_pct,
		h2h_venue_away_win_pct: features.h2h_venue_away_win_pct,
		h2h_venue_draw_pct: features.h2h_venue_draw_pct,
		h2h_venue_avg_goals: features.h2h_venue_avg_goals,
		h2h_venue_btts_pct: features.h2h_venue_btts_pct,
		h2h_venue_over_2_5_pct: features.h2h_venue_over_2_5_pct,
	};
}

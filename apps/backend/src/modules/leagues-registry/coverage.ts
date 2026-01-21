import type { LeaguesRegistrySnapshot } from "./leagues-registry.service";

export type LeagueCoverage = {
	fixtures: {
		events: boolean;
		lineups: boolean;
		statistics_fixtures: boolean;
		statistics_players: boolean;
	};
	standings: boolean;
	players: boolean;
	top_scorers: boolean;
	top_assists: boolean;
	top_cards: boolean;
	injuries: boolean;
	predictions: boolean;
	odds: boolean;
};

const EMPTY_COVERAGE: LeagueCoverage = {
	fixtures: {
		events: false,
		lineups: false,
		statistics_fixtures: false,
		statistics_players: false,
	},
	standings: false,
	players: false,
	top_scorers: false,
	top_assists: false,
	top_cards: false,
	injuries: false,
	predictions: false,
	odds: false,
};

export function getCoverageForLeagueSeason(
	snapshot: LeaguesRegistrySnapshot | null | undefined,
	leagueId: number,
	season: number,
): LeagueCoverage {
	if (!snapshot) return EMPTY_COVERAGE;
	const entry = snapshot.byLeagueId?.[String(leagueId)];
	if (!entry) return EMPTY_COVERAGE;
	const seasonEntry = entry.seasons?.find((s) => s.year === season);
	const coverage = seasonEntry?.coverage;
	if (!coverage) return EMPTY_COVERAGE;

	return {
		fixtures: {
			events: Boolean(coverage.fixtures?.events),
			lineups: Boolean(coverage.fixtures?.lineups),
			statistics_fixtures: Boolean(coverage.fixtures?.statistics_fixtures),
			statistics_players: Boolean(coverage.fixtures?.statistics_players),
		},
		standings: Boolean(coverage.standings),
		players: Boolean(coverage.players),
		top_scorers: Boolean(coverage.top_scorers),
		top_assists: Boolean(coverage.top_assists),
		top_cards: Boolean(coverage.top_cards),
		injuries: Boolean(coverage.injuries),
		predictions: Boolean(coverage.predictions),
		odds: Boolean(coverage.odds),
	};
}

import { h2hFixturesQuery } from "@/queries/h2h-fixtures";
import { injuriesQuery } from "@/queries/injuries";
import { standingsQuery } from "@/queries/standings";
import { teamFixturesQuery } from "@/queries/team-fixtures";
import { teamStatisticsQuery } from "@/queries/team-statistics";
import type { Fixture } from "@outscore/shared-types";
import { useQueries } from "@tanstack/react-query";

/**
 * Hook that prefetches all related data for a fixture
 * This includes:
 * - Home team recent fixtures (last 50)
 * - Away team recent fixtures (last 50)
 * - Home team statistics for the league/season
 * - Away team statistics for the league/season
 * - H2H fixtures between both teams (last 20)
 * - Injuries for the fixture
 * - League standings
 */
export function useFixtureRelatedData(fixture: Fixture | undefined) {
	const homeTeamId = fixture?.teams.home.id;
	const awayTeamId = fixture?.teams.away.id;
	const leagueId = fixture?.league.id;
	const season = fixture?.league.season;
	const fixtureId = fixture?.fixture.id;

	const enabled = Boolean(
		homeTeamId && awayTeamId && leagueId && season && fixtureId,
	);

	const results = useQueries({
		queries: [
			// Home team fixtures
			{
				...teamFixturesQuery({ teamId: homeTeamId ?? 0, last: 50 }),
				enabled,
			},
			// Away team fixtures
			{
				...teamFixturesQuery({ teamId: awayTeamId ?? 0, last: 50 }),
				enabled,
			},
			// Home team statistics
			{
				...teamStatisticsQuery({
					league: leagueId ?? 0,
					season: season ?? 0,
					team: homeTeamId ?? 0,
				}),
				enabled,
			},
			// Away team statistics
			{
				...teamStatisticsQuery({
					league: leagueId ?? 0,
					season: season ?? 0,
					team: awayTeamId ?? 0,
				}),
				enabled,
			},
			// H2H fixtures
			{
				...h2hFixturesQuery({
					team1: homeTeamId ?? 0,
					team2: awayTeamId ?? 0,
					last: 20,
				}),
				enabled,
			},
			// Injuries
			{
				...injuriesQuery({ fixtureId: fixtureId ?? 0, season: season ?? 0 }),
				enabled,
			},
			// Standings
			{
				...standingsQuery({
					league: leagueId ?? 0,
					season: season ?? 0,
				}),
				enabled,
			},
		],
	});

	const [
		homeTeamFixtures,
		awayTeamFixtures,
		homeTeamStats,
		awayTeamStats,
		h2hFixtures,
		injuries,
		standings,
	] = results;

	const isLoading = results.some((r) => r.isLoading);
	const isError = results.some((r) => r.isError);
	const errors = results.filter((r) => r.error).map((r) => r.error);

	return {
		// Individual query results
		homeTeamFixtures,
		awayTeamFixtures,
		homeTeamStats,
		awayTeamStats,
		h2hFixtures,
		injuries,
		standings,
		// Aggregate states
		isLoading,
		isError,
		errors,
	};
}

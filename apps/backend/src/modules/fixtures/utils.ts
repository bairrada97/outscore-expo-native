import type {
  Fixture,
  FixtureStatusShort,
  FormattedCountry,
  FormattedFixturesResponse,
  FormattedMatch,
} from '@outscore/shared-types';
import { formatDateInTimezone } from './timezone.utils';

/**
 * Filter fixtures to only include those that match the requested date in the user's timezone
 * This handles the edge case where users in different timezones request the same date
 * but should receive different sets of matches based on their local day
 */
export const filterFixturesByTimezone = (
  fixtures: Fixture[],
  requestedDate: string,
  timezone: string
): Fixture[] => {
  // Early return if timezone is UTC
  if (timezone === 'UTC') {
    return fixtures;
  }

  // Create a map to store fixtures by their local date in the target timezone
  const fixturesByLocalDate = new Map<string, Fixture[]>();

  // Process each fixture once and group by local date
  fixtures.forEach((fixture) => {
    const localDate = formatDateInTimezone(fixture.fixture.date, timezone, 'yyyy-MM-dd');

    if (!fixturesByLocalDate.has(localDate)) {
      fixturesByLocalDate.set(localDate, []);
    }
    fixturesByLocalDate.get(localDate)?.push(fixture);
  });

  // Return only fixtures for the requested date
  return fixturesByLocalDate.get(requestedDate) || [];
};

/**
 * Format the fixtures data for client consumption
 * Groups fixtures by Country → League → Matches
 */
export const formatFixtures = (
  fixtures: Fixture[],
  timezone: string = 'UTC'
): FormattedFixturesResponse => {
  
  const countryMap = new Map<string, FormattedCountry>();

  // Process fixtures in a single pass
  fixtures.forEach((fixture) => {
    const countryName = fixture.league.country;
    let country = countryMap.get(countryName);

    if (!country) {
      country = {
        name: countryName,
        flag: fixture.league.flag,
        leagues: [],
      };
      countryMap.set(countryName, country);
    }

    // Find league or create new one
    let league = country.leagues.find((existingLeague) => existingLeague.id === fixture.league.id);
    if (!league) {
      league = {
        id: fixture.league.id,
        name: fixture.league.name,
        logo: fixture.league.logo,
        matches: [],
      };
      country.leagues.push(league);
    }

    // Format match time and date based on timezone
    const formattedTime = formatDateInTimezone(fixture.fixture.date, timezone, 'HH:mm');
    const localDate = formatDateInTimezone(fixture.fixture.date, timezone, 'yyyy-MM-dd');

    // Add match to league
    const match: FormattedMatch = {
      id: fixture.fixture.id,
      date: localDate,
      time: formattedTime,
      timestamp: Math.floor(new Date(fixture.fixture.date).getTime() / 1000),
      timezone: fixture.fixture.timezone,
      status: {
        short: fixture.fixture.status.short as FixtureStatusShort,
        long: fixture.fixture.status.long,
        elapsed: fixture.fixture.status.elapsed,
      },
      teams: {
        home: {
          id: fixture.teams.home.id,
          name: fixture.teams.home.name,
          logo: fixture.teams.home.logo,
          winner: fixture.teams.home.winner,
        },
        away: {
          id: fixture.teams.away.id,
          name: fixture.teams.away.name,
          logo: fixture.teams.away.logo,
          winner: fixture.teams.away.winner,
        },
      },
      score: {
        fulltime: {
          home: fixture.score.fulltime.home,
          away: fixture.score.fulltime.away,
        },
        penalty: {
          home: fixture.score.penalty.home,
          away: fixture.score.penalty.away,
        },
      },
      goals: {
        home: fixture.goals.home,
        away: fixture.goals.away,
      },
    };

    league.matches.push(match);
  });

  // Convert map to array and sort once
  const countries = Array.from(countryMap.values());
  countries.sort((countryA, countryB) => countryA.name.localeCompare(countryB.name));

  // Sort leagues and matches in a single pass
  countries.forEach((country) => {
    country.leagues.sort((leagueA, leagueB) => leagueA.name.localeCompare(leagueB.name));
    country.leagues.forEach((league) => {
      league.matches.sort((matchA, matchB) => matchA.timestamp - matchB.timestamp);
    });
  });

  return countries;
};

/**
 * Count total matches in formatted fixtures response
 */
export const countMatches = (fixtures: FormattedFixturesResponse): number => {
  let count = 0;
  fixtures.forEach((country) => {
    country.leagues.forEach((league) => {
      count += league.matches.length;
    });
  });
  return count;
};


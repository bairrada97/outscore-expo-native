import type {
  Fixture,
  FixtureStatusShort,
  FormattedCountry,
  FormattedFixturesResponse,
  FormattedMatch,
} from '@outscore/shared-types';
import { FINISHED_STATUSES } from '../cache';
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

/**
 * Get the estimated finish time of a fixture
 * Returns null if the fixture is not finished or timestamp cannot be determined
 * 
 * For finished matches, we estimate finish time as:
 * - FT/AET: match start + 2 hours (accounts for 90 min + stoppage + potential ET)
 * - PEN: match start + 2.5 hours
 */
export const getFixtureFinishTime = (fixture: Fixture): number | null => {
  const status = fixture.fixture.status.short;
  
  if (!FINISHED_STATUSES.includes(status)) {
    return null;
  }

  const startTimestamp = fixture.fixture.timestamp;
  if (!startTimestamp) {
    return null;
  }

  // Estimate finish time based on status
  switch (status) {
    case 'PEN':
    case 'AET':
      // Penalty/Extra time games: ~2.5 hours after start
      return startTimestamp + (2.5 * 60 * 60);
    case 'FT':
    default:
      // Regular finish: ~2 hours after start
      return startTimestamp + (2 * 60 * 60);
  }
};

/**
 * Check if cache should be invalidated for fixtures that contain recently finished matches
 * Returns true if any fixture finished more than 10 minutes ago
 * 
 * This is used for team fixtures, H2H fixtures, and injuries endpoints
 * to ensure we fetch fresh data after matches complete
 */
export const shouldInvalidateFixtureCache = (fixtures: Fixture[]): boolean => {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const TEN_MINUTES = 10 * 60; // 10 minutes in seconds

  for (const fixture of fixtures) {
    const finishTime = getFixtureFinishTime(fixture);
    
    if (finishTime !== null) {
      const timeSinceFinish = nowSeconds - finishTime;
      
      // If fixture finished more than 10 minutes ago, we should refresh cache
      // This ensures the latest match data is included
      if (timeSinceFinish > TEN_MINUTES) {
        console.log(
          `🔄 [Cache] Fixture ${fixture.fixture.id} finished ${Math.round(timeSinceFinish / 60)} minutes ago, invalidating cache`
        );
        return true;
      }
    }
  }

  return false;
};

/**
 * Check if cache should be invalidated for a single fixture (used for injuries endpoint)
 * Returns true if the fixture finished more than 10 minutes ago
 */
export const shouldInvalidateSingleFixtureCache = (
  fixtureTimestamp: number,
  fixtureStatus: string
): boolean => {
  if (!FINISHED_STATUSES.includes(fixtureStatus)) {
    return false;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const TEN_MINUTES = 10 * 60;

  // Estimate finish time: match start + 2 hours
  const estimatedFinishTime = fixtureTimestamp + (2 * 60 * 60);
  const timeSinceFinish = nowSeconds - estimatedFinishTime;

  return timeSinceFinish > TEN_MINUTES;
};

/**
 * Parse H2H parameter in format "team1-team2"
 * Returns null if format is invalid
 */
export const parseH2HParam = (h2h: string): { team1: number; team2: number } | null => {
  if (!h2h || typeof h2h !== 'string') {
    return null;
  }

  const parts = h2h.split('-');
  
  if (parts.length !== 2) {
    return null;
  }

  const team1 = parseInt(parts[0], 10);
  const team2 = parseInt(parts[1], 10);

  if (Number.isNaN(team1) || Number.isNaN(team2) || team1 <= 0 || team2 <= 0) {
    return null;
  }

  return { team1, team2 };
};


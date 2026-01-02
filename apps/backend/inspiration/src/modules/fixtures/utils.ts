import { format, isBefore, startOfDay } from 'date-fns';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import { 
  Fixture, 
  FormattedFixturesResponse,
  FormattedCountry,
  FormattedMatch,
  FixtureStatusShort
} from '@outscore/shared-types';
import { formatDateInTimezone } from './timezone.utils';

// Constants
export const TODAY_UPDATE_INTERVAL = 15;

// Date utility functions
export const isToday = (date: string): boolean => {
  const now = new Date();
  const utcNow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const today = format(utcNow, 'yyyy-MM-dd');
  return date === today;
};

export const isFuture = (date: string): boolean => {
  const now = new Date();
  const utcNow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const targetDate = new Date(date);
  return targetDate > utcNow;
};

export const isPast = (date: string): boolean => {
  const now = new Date();
  const utcNow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const targetDate = new Date(date);
  return targetDate < utcNow;
};

export const isWithinDisplayRange = (date: string): boolean => {
  const now = new Date();
  const utcNow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const targetDate = new Date(date);
  
  // Calculate dates 2 days before and 2 days after today
  const twoDaysBefore = new Date(utcNow);
  twoDaysBefore.setDate(utcNow.getDate() - 2);
  
  const twoDaysAfter = new Date(utcNow);
  twoDaysAfter.setDate(utcNow.getDate() + 2);
  
  // Check if targetDate is within this range (inclusive)
  return targetDate >= twoDaysBefore && targetDate <= twoDaysAfter;
};

/**
 * Filters fixtures to only include those that match the requested date in the user's timezone
 * This solves the specific edge case where users in different timezones request the same date
 * but should receive different sets of matches based on their local day
 * 
 * @param fixtures List of all fixtures for the date range (typically in UTC)
 * @param requestedDate The date requested by the user (format: YYYY-MM-DD)
 * @param timezone The user's timezone (e.g. "America/Detroit", "Asia/Tokyo")
 * @returns Filtered array of fixtures that match the requested date in the user's timezone
 */
export const filterFixturesByTimezone = (fixtures: Fixture[], requestedDate: string, timezone: string): Fixture[] => {
  // Early return if timezone is UTC
  if (timezone === 'UTC') {
    return fixtures;
  }

  // Create a map to store fixtures by their local date in the target timezone
  const fixturesByLocalDate = new Map<string, Fixture[]>();

  // Process each fixture once and group by local date
  fixtures.forEach(fixture => {
    // Use the fixture's date directly without creating a new Date object
    const localDate = formatDateInTimezone(fixture.fixture.date, timezone, 'yyyy-MM-dd');
    
    if (!fixturesByLocalDate.has(localDate)) {
      fixturesByLocalDate.set(localDate, []);
    }
    fixturesByLocalDate.get(localDate)?.push(fixture);
  });

  // Return only fixtures for the requested date
  return fixturesByLocalDate.get(requestedDate) || [];
};

// Format the fixtures data for client consumption
export const formatFixtures = (fixtures: Fixture[], timezone: string = 'UTC'): FormattedFixturesResponse => {
  // Pre-allocate maps for O(1) lookups
  const countryMap = new Map<string, FormattedCountry>();
  
  // Process fixtures in a single pass
  fixtures.forEach((fixture) => {
    const countryName = fixture.league.country;
    let country = countryMap.get(countryName);
    
    if (!country) {
      country = {
        name: countryName,
        flag: fixture.league.flag,
        leagues: []
      };
      countryMap.set(countryName, country);
    }
    
    // Find league or create new one
    let league = country.leagues.find(l => l.id === fixture.league.id);
    if (!league) {
      league = {
        id: fixture.league.id,
        name: fixture.league.name,
        logo: fixture.league.logo,
        matches: []
      };
      country.leagues.push(league);
    }
    
    // Format match time and date based on timezone
    const formattedTime = formatDateInTimezone(fixture.fixture.date, timezone, 'HH:mm');
    const localDate = formatDateInTimezone(fixture.fixture.date, timezone, 'yyyy-MM-dd');
    
    // Add match to league
    league.matches.push({
      id: fixture.fixture.id,
      date: localDate,
      time: formattedTime,
      timestamp: Math.floor(new Date(fixture.fixture.date).getTime() / 1000),
      timezone: fixture.fixture.timezone,
      status: {
        short: fixture.fixture.status.short as FixtureStatusShort,
        long: fixture.fixture.status.long,
        elapsed: fixture.fixture.status.elapsed
      },
      teams: {
        home: {
          id: fixture.teams.home.id,
          name: fixture.teams.home.name,
          logo: fixture.teams.home.logo,
          winner: fixture.teams.home.winner
        },
        away: {
          id: fixture.teams.away.id,
          name: fixture.teams.away.name,
          logo: fixture.teams.away.logo,
          winner: fixture.teams.away.winner
        }
      },
      score: {
        fulltime: {
          home: fixture.score.fulltime.home,
          away: fixture.score.fulltime.away,
        },
        penalty: {
          home: fixture.score.penalty.home,
          away: fixture.score.penalty.away,
        }
      },
      goals: {
        home: fixture.goals.home,
        away: fixture.goals.away
      }
    });
  });
  
  // Convert map to array and sort once
  const countries = Array.from(countryMap.values());
  countries.sort((a, b) => a.name.localeCompare(b.name));
  
  // Sort leagues and matches in a single pass
  countries.forEach(country => {
    country.leagues.sort((a, b) => a.name.localeCompare(b.name));
    country.leagues.forEach(league => {
      league.matches.sort((a, b) => a.timestamp - b.timestamp);
    });
  });
  
  return countries;
};
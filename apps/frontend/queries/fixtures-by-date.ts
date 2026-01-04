import {
  API_BASE_URL,
  FIFTEEN_SECONDS_CACHE,
  ONE_DAY_CACHE,
  ONE_HOUR_CACHE,
  ONE_WEEK_CACHE,
} from '@/utils/constants';
import type { FormattedCountry } from '@outscore/shared-types';
import { isBefore, isSameDay } from 'date-fns';

/**
 * Query key factory for fixtures
 */
export function createFixturesQueryKey(date: string, timezone?: string): string[] {
  return ['fixtures-by-date', date, timezone || 'UTC'];
}

/**
 * Fetch fixtures from the API
 */
async function fetchFixtures({
  date,
  timezone,
  live,
}: {
  date: string;
  timezone?: string;
  live?: 'all';
}): Promise<FormattedCountry[]> {
  const params = new URLSearchParams();
  params.set('date', date);

  if (timezone) params.set('timezone', timezone);
  if (live) params.set('live', live);

  const response = await fetch(`${API_BASE_URL}/fixtures?${params.toString()}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch fixtures: ${response.statusText}`);
  }
  
  const json = await response.json() as { data: FormattedCountry[] };
  return json.data as FormattedCountry[];
}

/**
 * Query options for fixtures by date
 */
export interface FixturesQueryParams {
  date: string;
  timezone?: string;
  live?: 'all';
}

/**
 * Create query options for fixtures
 */
export function fixturesByDateQuery({ date, timezone, live }: FixturesQueryParams) {
  const queryKey = createFixturesQueryKey(date, timezone);
  
  const queryFn = async (): Promise<FormattedCountry[]> => {
    return fetchFixtures({ date, timezone, live });
  };
  
  // Determine cache settings based on date type
  const requestDate = new Date(date);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  
  let staleTime = 0;
  let refetchInterval: number | undefined = undefined;
  let gcTime = 0;
  let refetchOnMount: boolean | 'always' = true;
  let refetchOnWindowFocus = false;
  
  if (isSameDay(requestDate, today)) {
    // TODAY: Always fetch fresh data
    staleTime = 0;
    refetchInterval = FIFTEEN_SECONDS_CACHE;
    gcTime = 0;
    refetchOnMount = 'always';
    refetchOnWindowFocus = true;
  } else if (isSameDay(requestDate, yesterday)) {
    // YESTERDAY: Cache with refresh on mount
    staleTime = ONE_HOUR_CACHE;
    gcTime = ONE_DAY_CACHE;
    refetchOnMount = true;
    refetchOnWindowFocus = false;
  } else if (isSameDay(requestDate, tomorrow)) {
    // TOMORROW: Cache until first match starts
    staleTime = ONE_HOUR_CACHE;
    gcTime = ONE_DAY_CACHE;
    refetchOnMount = true;
    refetchOnWindowFocus = true;
  } else if (isBefore(requestDate, today)) {
    // OLDER PAST: Long cache
    staleTime = ONE_DAY_CACHE;
    gcTime = ONE_WEEK_CACHE;
    refetchOnMount = true;
    refetchOnWindowFocus = false;
  } else {
    // FUTURE: Regular cache
    staleTime = ONE_HOUR_CACHE;
    gcTime = 3 * ONE_DAY_CACHE;
    refetchOnMount = true;
    refetchOnWindowFocus = false;
  }
  
  return {
    queryKey,
    queryFn,
    staleTime,
    refetchInterval,
    gcTime,
    refetchOnMount,
    refetchOnWindowFocus,
  };
}


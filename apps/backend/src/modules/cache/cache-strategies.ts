import { format } from 'date-fns';
import type { CacheStrategyConfig, ResourceType } from './types';
import { SWR, TTL } from './types';

// Live match statuses
export const LIVE_STATUSES = ['LIVE', '1H', '2H', 'HT', 'ET', 'BT', 'P'];
// Not started status
export const NOT_STARTED_STATUSES = ['NS', 'TBD'];
// Finished statuses
export const FINISHED_STATUSES = ['FT', 'AET', 'PEN', 'PST', 'CANC', 'ABD', 'AWD', 'WO'];

/**
 * Get current UTC date string
 */
export const getCurrentUtcDate = (): string => {
  const now = new Date();
  return format(
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())),
    'yyyy-MM-dd'
  );
};

/**
 * Get yesterday's UTC date string
 */
export const getYesterdayUtcDate = (): string => {
  const now = new Date();
  const yesterday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
  return format(yesterday, 'yyyy-MM-dd');
};

/**
 * Get tomorrow's UTC date string
 */
export const getTomorrowUtcDate = (): string => {
  const now = new Date();
  const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return format(tomorrow, 'yyyy-MM-dd');
};

/**
 * Dynamic TTL for fixtures by date
 */
export const getFixturesTTL = (date: string, isLive: boolean): number => {
  if (isLive) {
    return TTL.SHORT;
  }

  const today = getCurrentUtcDate();
  const yesterday = getYesterdayUtcDate();
  const tomorrow = getTomorrowUtcDate();

  // Today, yesterday, and tomorrow use frequent refresh
  if (date === today || date === yesterday || date === tomorrow) {
    return TTL.SHORT;
  }

  // Historical data uses long-term caching
  if (date < yesterday) {
    return TTL.LONG;
  }

  // Future data uses standard caching
  return TTL.STANDARD;
};

/**
 * Dynamic TTL for fixture detail based on match status and time until match
 * 
 * TTL Strategy:
 * - LIVE matches: 15 seconds (real-time updates)
 * - FINISHED matches: Indefinite (7 days, cleanup handles removal)
 * - NOT_STARTED:
 *   - <= 45 min before: 15s (lineups appear)
 *   - <= 1 hour before: 15s (active pre-match)
 *   - <= 8 hours before: 1 hour (fetch until 1h before match)
 *   - <= 24 hours before: 1 hour
 *   - <= 7 days before: 6 hours
 *   - > 7 days before: 24 hours
 */
export const getFixtureDetailTTL = (
  params: Record<string, string>,
  data?: unknown
): number => {
  // Extract status and timestamp from data if it has the expected structure
  const fixtureData = data as { 
    fixture?: { 
      status?: { short?: string }; 
      timestamp?: number;
    } 
  } | undefined;
  
  const status = fixtureData?.fixture?.status?.short || params.status;
  const matchTimestamp = fixtureData?.fixture?.timestamp 
    ? fixtureData.fixture.timestamp 
    : params.timestamp 
      ? parseInt(params.timestamp, 10) 
      : undefined;

  if (!status) {
    return TTL.SHORT; // Default to short if unknown
  }

  // LIVE matches: 15 seconds for real-time updates
  if (LIVE_STATUSES.includes(status)) {
    return TTL.LIVE;
  }

  // FINISHED matches: cache indefinitely (7 days, cleanup handles removal)
  if (FINISHED_STATUSES.includes(status)) {
    return TTL.INDEFINITE;
  }

  // NOT_STARTED: Dynamic TTL based on time until match
  if (NOT_STARTED_STATUSES.includes(status)) {
    if (!matchTimestamp) {
      return TTL.MEDIUM; // Default to 5 minutes if no timestamp
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    const timeUntilMatch = matchTimestamp - nowSeconds;

    // Match has passed but status not updated yet
    if (timeUntilMatch <= 0) {
      return TTL.SHORT;
    }

    // 45 minutes before: lineups appear
    if (timeUntilMatch <= 45 * 60) {
      return TTL.SHORT;
    }

    // 1 hour before: active pre-match period
    if (timeUntilMatch <= 60 * 60) {
      return TTL.SHORT;
    }

    // 8 hours before: fetch every hour until 1h before match
    if (timeUntilMatch <= 8 * 60 * 60) {
      return TTL.STANDARD; // 1 hour
    }

    // 24 hours before: fetch every hour
    if (timeUntilMatch <= 24 * 60 * 60) {
      return TTL.STANDARD; // 1 hour
    }

    // 7 days before: fetch every 6 hours
    if (timeUntilMatch <= 7 * 24 * 60 * 60) {
      return TTL.SIX_HOURS;
    }

    // More than 7 days away: fetch every 24 hours
    return TTL.LONG;
  }

  return TTL.SHORT; // Default: 15 seconds (safe for unknown statuses)
};

/**
 * Check if date is "hot" (should be in KV for fast access)
 */
export const isHotDate = (date: string): boolean => {
  const today = getCurrentUtcDate();
  const yesterday = getYesterdayUtcDate();
  const tomorrow = getTomorrowUtcDate();

  return date === today || date === yesterday || date === tomorrow;
};

/**
 * Cache strategies for each resource type
 */
export const CACHE_STRATEGIES: Record<ResourceType, CacheStrategyConfig> = {
  fixtures: {
    resourceType: 'fixtures',
    ttlMode: 'dynamic',
    dynamicTTL: (params) => getFixturesTTL(params.date, params.live === 'true'),
    swr: SWR.SHORT,
    useKV: false, // Disabled: KV requires 60s min TTL, but fixtures need 15s for live updates
    useR2: true,
    useEdge: true,
    keyGenerator: (params) => {
      const base = `fixtures:${params.date}`;
      const tz = params.timezone ? `:${params.timezone}` : ':UTC';
      const live = params.live === 'true' ? ':live' : '';
      return `${base}${tz}${live}`;
    },
  },

  fixtureDetail: {
    resourceType: 'fixtureDetail',
    ttlMode: 'dynamic',
    dynamicTTL: getFixtureDetailTTL,
    swr: SWR.SHORT,
    useKV: false, // Disabled: KV requires 60s min TTL, but live matches need 15s
    useR2: true,
    useEdge: true,
    keyGenerator: (params) => `fixture-details/fixture-${params.fixtureId}.json`,
  },

  teams: {
    resourceType: 'teams',
    ttlMode: 'static',
    staticTTL: TTL.LONG, // 24 hours
    useKV: false, // Not needed for static data
    useR2: true,
    useEdge: true,
    keyGenerator: (params) => `teams:${params.teamId}`,
  },

  leagues: {
    resourceType: 'leagues',
    ttlMode: 'static',
    staticTTL: TTL.LONG, // 24 hours
    useKV: false,
    useR2: true,
    useEdge: true,
    keyGenerator: (params) => `leagues:${params.leagueId}`,
  },

  standings: {
    resourceType: 'standings',
    ttlMode: 'static',
    staticTTL: TTL.STANDARD, // 1 hour
    useKV: false,
    useR2: true,
    useEdge: true,
    keyGenerator: (params) => `standings:${params.leagueId}:${params.season}`,
  },
};

/**
 * Get TTL for a resource based on its strategy
 */
export const getTTLForResource = <T>(
  resourceType: ResourceType,
  params: Record<string, string>,
  data?: T
): number => {
  const strategy = CACHE_STRATEGIES[resourceType];

  if (!strategy) {
    throw new Error(
      `Cache strategy not found for resource type: "${resourceType}". ` +
        `Available types: ${Object.keys(CACHE_STRATEGIES).join(', ')}`
    );
  }

  switch (strategy.ttlMode) {
    case 'static':
      if (typeof strategy.staticTTL !== 'number') {
        throw new Error(
          `Invalid cache strategy for resource type "${resourceType}": ` +
            `ttlMode is "static" but staticTTL is not a number (got ${typeof strategy.staticTTL})`
        );
      }
      return strategy.staticTTL;

    case 'dynamic':
      if (typeof strategy.dynamicTTL !== 'function') {
        throw new Error(
          `Invalid cache strategy for resource type "${resourceType}": ` +
            `ttlMode is "dynamic" but dynamicTTL is not a function (got ${typeof strategy.dynamicTTL})`
        );
      }
      return strategy.dynamicTTL(params, data);

    default:
      throw new Error(
        `Invalid cache strategy for resource type "${resourceType}": ` +
          `unknown ttlMode "${(strategy as CacheStrategyConfig).ttlMode}". Expected "static" or "dynamic"`
      );
  }
};

/**
 * Get cache key for a resource
 */
export const getCacheKey = (
  resourceType: ResourceType,
  params: Record<string, string>
): string => {
  const strategy = CACHE_STRATEGIES[resourceType];
  return strategy.keyGenerator(params);
};

/**
 * Get strategy config for a resource type
 */
export const getStrategy = (resourceType: ResourceType): CacheStrategyConfig => {
  return CACHE_STRATEGIES[resourceType];
};


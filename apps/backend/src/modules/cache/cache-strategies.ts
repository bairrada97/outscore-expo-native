import { format } from 'date-fns';
import type { CacheStrategyConfig, ResourceType } from './types';
import { SWR, TTL } from './types';

// Live match statuses
const LIVE_STATUSES = ['LIVE', '1H', '2H', 'HT', 'ET', 'BT', 'P'];
// Not started status
const NOT_STARTED_STATUSES = ['NS', 'TBD'];
// Finished statuses
const FINISHED_STATUSES = ['FT', 'AET', 'PEN', 'PST', 'CANC', 'ABD', 'AWD', 'WO'];

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
 * Dynamic TTL for fixture detail based on match status
 */
export const getFixtureDetailTTL = (
  params: Record<string, string>,
  data?: unknown
): number => {
  // Extract status from data if it has the expected structure
  const fixtureData = data as { fixture?: { status?: { short?: string } } } | undefined;
  const status = fixtureData?.fixture?.status?.short || params.status;

  if (!status) {
    return TTL.SHORT; // Default to short if unknown
  }

  if (LIVE_STATUSES.includes(status)) {
    return TTL.SHORT; // Live: 15 seconds
  }

  if (NOT_STARTED_STATUSES.includes(status)) {
    return TTL.MEDIUM; // Not started: 5 minutes
  }

  if (FINISHED_STATUSES.includes(status)) {
    return TTL.LONG; // Finished: 24 hours
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
    useKV: true,
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
    useKV: true, // Hot during live matches
    useR2: true,
    useEdge: true,
    keyGenerator: (params) => `fixture:${params.fixtureId}`,
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

  if (strategy.ttlMode === 'static') {
    return strategy.staticTTL!;
  }

  return strategy.dynamicTTL!(params, data);
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


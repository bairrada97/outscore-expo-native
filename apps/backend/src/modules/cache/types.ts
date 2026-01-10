export interface CacheConfig {
  ttl: number;
  swr?: number;
  metadata?: Record<string, string>;
}

export interface CacheMeta {
  updatedAt: string;
  ttl: number;
  metadata?: Record<string, string>;
}

export interface CacheResult<T> {
  data: T | null;
  source: 'edge' | 'kv' | 'r2' | 'api' | 'none';
  forceRefresh?: boolean;
  meta?: CacheMeta;
  isStale?: boolean;
}

export enum CacheLocation {
  TODAY = 'today',
  HISTORICAL = 'historical',
  FUTURE = 'future',
}

export const TTL = {
  LIVE: 15, // 15 seconds for live matches - matches frontend refresh interval
  SHORT: 20, // 20 seconds for Edge Cache (slightly longer than 15s scheduler for buffer)
  MEDIUM: 300, // 5 minutes
  STANDARD: 3600, // 1 hour
  SIX_HOURS: 21600, // 6 hours - for future fixtures (1-7 days away)
  LONG: 86400, // 24 hours
  INDEFINITE: 604800, // 7 days - for finished matches (cleanup handles removal)
  KV_MIN: 60, // Cloudflare KV minimum (for resources that use KV)
  R2_TODAY: 300, // 5 minutes for R2 staleness window - allows eventual consistency tolerance despite 15s refresh interval (R2 serves as fallback when Edge Cache expires, providing buffer for network delays and scheduler backoff)
} as const;

export const SWR = {
  SHORT: 0, // No stale data for live matches - freshness is critical!
  STANDARD: 7200,
} as const;

// Resource types for generic caching
export type ResourceType =
  | 'fixtures'
  | 'fixtureDetail'
  | 'teams'
  | 'leagues'
  | 'standings'
  | 'teamFixtures'
  | 'teamStatistics'
  | 'h2hFixtures'
  | 'injuries';


export type TTLMode = 'static' | 'dynamic';


export interface CacheStrategyConfig {
  resourceType: ResourceType;
  ttlMode: TTLMode;
  staticTTL?: number;
  dynamicTTL?: (params: Record<string, string>, data?: unknown) => number;
  swr?: number;
  useKV: boolean;
  useR2: boolean;
  useEdge: boolean;
  keyGenerator: (params: Record<string, string>) => string;
}


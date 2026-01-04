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
  SHORT: 20, // 20 seconds for Edge Cache (slightly longer than 15s scheduler for buffer)
  MEDIUM: 300,
  STANDARD: 3600,
  LONG: 86400,
  KV_MIN: 60, // Cloudflare KV minimum (for resources that use KV)
  R2_TODAY: 300, // 5 minutes for R2 staleness (but R2 is refreshed every 15s, so always fresh)
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
  | 'standings';


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


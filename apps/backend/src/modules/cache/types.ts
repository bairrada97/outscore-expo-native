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
  SHORT: 15, // 15 seconds for live/today's data
  MEDIUM: 300,
  STANDARD: 3600,
  LONG: 86400,
  KV_MIN: 60, // Cloudflare KV minimum (for resources that use KV)
} as const;

export const SWR = {
  SHORT: 30,
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


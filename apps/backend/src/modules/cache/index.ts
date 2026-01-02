// Types
export type { CacheProvider, R2CacheProvider } from './provider.interface';
export * from './types';

// Providers
export {
  createEdgeCacheProvider,
  generateEdgeCacheKey,
  invalidateEdgeCacheForDate,
  parseEdgeCacheKey
} from './edge-cache';

export {
  createKVCacheProvider,
  deleteKVEntriesForDate,
  generateKVCacheKey
} from './kv-provider';

export {
  cleanupR2Duplicates,
  createR2CacheProvider,
  generateR2CacheKey,
  parseR2CacheKey
} from './r2-provider';

// Cache Strategies
export {
  CACHE_STRATEGIES,
  getCacheKey, getCurrentUtcDate, getFixtureDetailTTL,
  getFixturesTTL,
  getStrategy, getTomorrowUtcDate, getTTLForResource, getYesterdayUtcDate, isHotDate
} from './cache-strategies';

// Fixtures-specific strategy
export {
  checkFixturesDateTransition,
  getFixturesCacheLocation,
  getFixturesR2Key,
  handleFixturesDateTransition,
  type FixturesCacheEnv
} from './fixtures-strategy';

// Generic Cache Manager
export {
  cacheGet,
  cacheSet,
  cacheSetEdgeOnly,
  isStale,
  withDeduplication,
  type CacheEnv
} from './cache-manager';

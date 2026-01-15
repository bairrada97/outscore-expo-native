// Types
export type { CacheProvider, R2CacheProvider } from './provider.interface';
export * from './types';

// Admin routes
export { createCacheAdminRoutes } from './cache-admin.routes';

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
  FINISHED_STATUSES,
  getCacheKey,
  getCurrentUtcDate,
  getFixtureDetailTTL,
  getFixturesTTL,
  getStrategy,
  getTomorrowUtcDate,
  getTTLForResource,
  getYesterdayUtcDate,
  isHotDate,
  LIVE_STATUSES,
  NOT_STARTED_STATUSES
} from './cache-strategies';

// Fixtures-specific strategy
export {
  checkFixturesDateTransition,
  cleanupOldCacheData,
  cleanupOldFixtureDetails,
  getFixturesCacheLocation,
  getFixturesR2Key,
  handleFixturesDateTransition,
  type FixturesCacheEnv
} from './fixtures-strategy';

// Generic Cache Manager
export {
  cacheGet,
  cacheDelete,
  cacheSet,
  cacheSetEdgeOnly,
  isStale,
  withDeduplication,
  type CacheEnv
} from './cache-manager';

import {
  getCacheKey,
  getStrategy,
  getTTLForResource
} from './cache-strategies';
import { createEdgeCacheProvider } from './edge-cache';
import {
  checkFixturesDateTransition,
  getFixturesCacheLocation,
  getFixturesR2Key,
} from './fixtures-strategy';
import { createKVCacheProvider } from './kv-provider';
import { createR2CacheProvider } from './r2-provider';
import type { CacheConfig, CacheMeta, CacheResult, ResourceType } from './types';

/**
 * In-flight request tracking for deduplication
 */
const inFlightRequests = new Map<string, Promise<unknown>>();


export interface CacheEnv {
  FOOTBALL_KV: KVNamespace;
  FOOTBALL_CACHE: R2Bucket;
}

// =============================================================================
// GENERIC CACHE OPERATIONS
// =============================================================================

/**
 * Generic cache get operation
 * Checks cache layers based on resource strategy: Edge → KV → R2
 */
export const cacheGet = async <T>(
  env: CacheEnv,
  resourceType: ResourceType,
  params: Record<string, string>
): Promise<CacheResult<T>> => {
  const strategy = getStrategy(resourceType);
  const cacheKey = getCacheKey(resourceType, params);

  // 1. Check Edge Cache
  if (strategy.useEdge) {
    const edgeCache = createEdgeCacheProvider<T>();
    const edgeResult = await edgeCache.get(cacheKey);
    if (edgeResult.data) {
      return {
        data: edgeResult.data,
        source: 'edge',
        meta: edgeResult.meta ?? undefined,
      };
    }
  }

  // 2. Check KV (for resources that use it)
  if (strategy.useKV) {
    const kvCache = createKVCacheProvider<T>(env.FOOTBALL_KV);
    const kvResult = await kvCache.get(cacheKey);
    if (kvResult.data) {
      return {
        data: kvResult.data,
        source: 'kv',
        meta: kvResult.meta ?? undefined,
      };
    }
  }

  // 3. Check R2
  if (strategy.useR2) {
    const r2Cache = createR2CacheProvider<T>(env.FOOTBALL_CACHE);

    // For fixtures, use folder structure
    let r2Key = cacheKey;
    if (resourceType === 'fixtures') {
      const location = getFixturesCacheLocation(params.date);
      r2Key = getFixturesR2Key(location, params.date, params.live === 'true');
    }

    const r2Result = await r2Cache.get(r2Key);
    if (r2Result.data) {
      return {
        data: r2Result.data,
        source: 'r2',
        meta: r2Result.meta ?? undefined,
      };
    }
  }

  return { data: null, source: 'none' };
};

/**
 * Generic cache set operation
 * Stores in cache layers based on resource strategy
 */
export const cacheSet = async <T>(
  env: CacheEnv,
  resourceType: ResourceType,
  params: Record<string, string>,
  data: T
): Promise<boolean> => {
  const strategy = getStrategy(resourceType);
  const cacheKey = getCacheKey(resourceType, params);
  const ttl = getTTLForResource(resourceType, params, data);
  const config: CacheConfig = { ttl, swr: strategy.swr };

  let success = true;

  // 1. Store in Edge Cache
  if (strategy.useEdge) {
    const edgeCache = createEdgeCacheProvider<T>();
    const edgeSuccess = await edgeCache.set(cacheKey, data, config);
    if (!edgeSuccess) success = false;
  }

  // 2. Store in KV (for resources that use it)
  if (strategy.useKV) {
    const kvCache = createKVCacheProvider<T>(env.FOOTBALL_KV);
    const kvSuccess = await kvCache.set(cacheKey, data, config);
    if (!kvSuccess) success = false;
  }

  // 3. Store in R2
  if (strategy.useR2) {
    const r2Cache = createR2CacheProvider<T>(env.FOOTBALL_CACHE);

    // For fixtures, use folder structure
    let r2Key = cacheKey;
    if (resourceType === 'fixtures') {
      const location = getFixturesCacheLocation(params.date);
      r2Key = getFixturesR2Key(location, params.date, params.live === 'true');
    }

    const r2Success = await r2Cache.set(r2Key, data, config);
    if (!r2Success) success = false;
  }

  return success;
};

/**
 * Store data in Edge Cache only (for transformed timezone-specific data)
 */
export const cacheSetEdgeOnly = async <T>(
  resourceType: ResourceType,
  params: Record<string, string>,
  data: T
): Promise<boolean> => {
  const cacheKey = getCacheKey(resourceType, params);
  const ttl = getTTLForResource(resourceType, params, data);
  const strategy = getStrategy(resourceType);
  const config: CacheConfig = { ttl, swr: strategy.swr };

  const edgeCache = createEdgeCacheProvider<T>();
  return edgeCache.set(cacheKey, data, config);
};

// =============================================================================
// REQUEST DEDUPLICATION
// =============================================================================

/**
 * Request deduplication wrapper
 * Prevents duplicate API calls for the same cache key
 */
export const withDeduplication = async <T>(
  cacheKey: string,
  fetchFn: () => Promise<T>
): Promise<T> => {
  const existing = inFlightRequests.get(cacheKey) as Promise<T> | undefined;
  if (existing) {
    console.log(`🔄 [Dedup] Reusing in-flight request for ${cacheKey}`);
    return existing;
  }

  const promise = fetchFn().finally(() => {
    inFlightRequests.delete(cacheKey);
  });

  inFlightRequests.set(cacheKey, promise);
  console.log(`🚀 [Dedup] New request for ${cacheKey}`);

  return promise;
};

// =============================================================================
// STALENESS CHECK
// =============================================================================

/**
 * Check if cache data is stale based on TTL
 */
export const isStale = (
  meta: CacheMeta | undefined | null,
  resourceType: ResourceType,
  params: Record<string, string>
): boolean => {
  if (!meta) return true;

  const ttl = getTTLForResource(resourceType, params);
  const updatedAt = new Date(meta.updatedAt).getTime();
  const now = Date.now();
  const age = (now - updatedAt) / 1000;

  return age > ttl;
};

// =============================================================================
// FIXTURES-SPECIFIC EXPORTS (for backwards compatibility)
// =============================================================================

export { checkFixturesDateTransition };

// Re-export strategy helpers
  export {
    getCurrentUtcDate,
    getFixturesTTL,
    getTomorrowUtcDate,
    getYesterdayUtcDate
  } from './cache-strategies';

export {
  getFixturesCacheLocation,
  handleFixturesDateTransition
} from './fixtures-strategy';


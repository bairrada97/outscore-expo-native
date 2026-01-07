import {
    getCacheKey,
    getStrategy,
    getTTLForResource
} from './cache-strategies';
import { createEdgeCacheProvider, generateEdgeCacheKey } from './edge-cache';
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

/**
 * Convert a plain cache key to a proper Edge Cache URL
 * Edge Cache API requires fully-qualified URLs
 */
const toEdgeCacheUrl = (cacheKey: string, params: Record<string, string>): string => {
  // For fixtures, use the params to generate a proper URL
  if (cacheKey.startsWith('fixtures:')) {
    return generateEdgeCacheKey({
      date: params.date || '',
      timezone: params.timezone || 'UTC',
      live: params.live === 'true',
    });
  }
  // For fixture details, use fixture ID
  if (cacheKey.startsWith('fixture-details/')) {
    return `https://api.outscore.live/fixtures?id=${params.fixtureId}`;
  }
  // For other resources, create a generic URL
  return `https://api.outscore.live/cache/${encodeURIComponent(cacheKey)}`;
};


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

  console.log(`🔍 [Cache] Checking cache for key: ${cacheKey} (type: ${resourceType})`);

  // 1. Check Edge Cache (requires URL format)
  if (strategy.useEdge) {
    const edgeCacheUrl = toEdgeCacheUrl(cacheKey, params);
    const edgeCache = createEdgeCacheProvider<T>();
    const edgeResult = await edgeCache.get(edgeCacheUrl);
    if (edgeResult.data) {
      console.log(`✅ [Cache] Edge cache HIT for ${edgeCacheUrl}`);
      return {
        data: edgeResult.data,
        source: 'edge',
        meta: edgeResult.meta ?? undefined,
      };
    }
    console.log(`❌ [Cache] Edge cache MISS for ${edgeCacheUrl}`);
  }

  // 2. Check KV (for resources that use it)
  if (strategy.useKV) {
    const kvCache = createKVCacheProvider<T>(env.FOOTBALL_KV);
    const kvResult = await kvCache.get(cacheKey);
    if (kvResult.data) {
      console.log(`✅ [Cache] KV cache HIT for ${cacheKey}`);
      return {
        data: kvResult.data,
        source: 'kv',
        meta: kvResult.meta ?? undefined,
      };
    }
    console.log(`❌ [Cache] KV cache MISS for ${cacheKey}`);
  }

  // 3. Check R2
  if (strategy.useR2) {
    const r2Cache = createR2CacheProvider<T>(env.FOOTBALL_CACHE);

    // Determine R2 key based on resource type
    let r2Key = cacheKey;
    if (resourceType === 'fixtures') {
      const location = getFixturesCacheLocation(params.date);
      r2Key = getFixturesR2Key(location, params.date, params.live === 'true');
    } else if (resourceType === 'fixtureDetail') {
      // Fixture details use the key generator directly (fixture-details/fixture-{id}.json)
      r2Key = cacheKey;
    }

    const r2Result = await r2Cache.get(r2Key);
    if (r2Result.data) {
      console.log(`✅ [Cache] R2 cache HIT for ${r2Key}`);
      return {
        data: r2Result.data,
        source: 'r2',
        meta: r2Result.meta ?? undefined,
      };
    }
    console.log(`❌ [Cache] R2 cache MISS for ${r2Key}`);
  }

  console.log(`❌ [Cache] All cache layers MISS for ${cacheKey}`);
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

  console.log(`💾 [Cache] Storing in cache layers for key: ${cacheKey} (TTL: ${ttl}s)`);

  let success = true;

  // 1. Store in Edge Cache (requires URL format)
  if (strategy.useEdge) {
    const edgeCacheUrl = toEdgeCacheUrl(cacheKey, params);
    const edgeCache = createEdgeCacheProvider<T>();
    const edgeSuccess = await edgeCache.set(edgeCacheUrl, data, config);
    if (edgeSuccess) {
      console.log(`✅ [Cache] Stored in Edge cache: ${edgeCacheUrl}`);
    } else {
      console.log(`❌ [Cache] Failed to store in Edge cache: ${edgeCacheUrl}`);
      success = false;
    }
  }

  // 2. Store in KV (for resources that use it)
  if (strategy.useKV) {
    const kvCache = createKVCacheProvider<T>(env.FOOTBALL_KV);
    const kvSuccess = await kvCache.set(cacheKey, data, config);
    if (kvSuccess) {
      console.log(`✅ [Cache] Stored in KV cache: ${cacheKey}`);
    } else {
      console.log(`❌ [Cache] Failed to store in KV cache: ${cacheKey}`);
      success = false;
    }
  }

  // 3. Store in R2
  if (strategy.useR2) {
    const r2Cache = createR2CacheProvider<T>(env.FOOTBALL_CACHE);

    // Determine R2 key based on resource type
    let r2Key = cacheKey;
    if (resourceType === 'fixtures') {
      const location = getFixturesCacheLocation(params.date);
      r2Key = getFixturesR2Key(location, params.date, params.live === 'true');
    } else if (resourceType === 'fixtureDetail') {
      // Fixture details use the key generator directly (fixture-details/fixture-{id}.json)
      r2Key = cacheKey;
    }

    const r2Success = await r2Cache.set(r2Key, data, config);
    if (r2Success) {
      console.log(`✅ [Cache] Stored in R2 cache: ${r2Key}`);
    } else {
      console.log(`❌ [Cache] Failed to store in R2 cache: ${r2Key}`);
      success = false;
    }
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
  const edgeCacheUrl = toEdgeCacheUrl(cacheKey, params);
  const ttl = getTTLForResource(resourceType, params, data);
  const strategy = getStrategy(resourceType);
  const config: CacheConfig = { ttl, swr: strategy.swr };

  const edgeCache = createEdgeCacheProvider<T>();
  return edgeCache.set(edgeCacheUrl, data, config);
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
 * For R2 (cold storage), uses a longer staleness window
 */
export const isStale = (
  meta: CacheMeta | undefined | null,
  resourceType: ResourceType,
  params: Record<string, string>
): boolean => {
  if (!meta) return true;

  // For R2 cold storage, use a longer staleness window (5 minutes)
  // This allows R2 to serve data even when Edge Cache expires after 30s
  // The scheduler refreshes data every 15s, so 5 min staleness is safe
  const isR2Staleness = params._r2Staleness === 'true';
  const ttl = isR2Staleness ? 300 : getTTLForResource(resourceType, params);
  
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


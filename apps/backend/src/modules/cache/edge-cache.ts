import type { CacheProvider } from './provider.interface';
import type { CacheConfig, CacheMeta } from './types';

/**
 * Edge Cache provider using Cloudflare Cache API
 * 
 * This is the fastest cache layer, storing transformed responses per timezone.
 * Uses the Cache API which is available at the edge.
 */

/**
 * Get the default Cloudflare Cache instance
 * Cloudflare Workers exposes caches.default which isn't in the standard CacheStorage type
 */
const getDefaultCache = (): Cache => {
  return (caches as unknown as { default: Cache }).default;
};

/**
 * Generate a cache key for Edge Cache
 */
export const generateEdgeCacheKey = ({
  date,
  timezone,
  live = false,
  baseUrl = 'https://api.outscore.live',
}: {
  date: string;
  timezone: string;
  live?: boolean;
  baseUrl?: string;
}): string => {
  // Cache API requires a valid URL as key
  const params = new URLSearchParams({
    date,
    timezone,
    ...(live && { live: 'true' }),
  });
  return `${baseUrl}/fixtures?${params.toString()}`;
};

export const parseEdgeCacheKey = (
  key: string
): { date: string; timezone: string; live: boolean } | null => {
  try {
    const url = new URL(key);
    const date = url.searchParams.get('date');
    const timezone = url.searchParams.get('timezone');
    const live = url.searchParams.get('live') === 'true';

    if (!date || !timezone) return null;

    return { date, timezone, live };
  } catch {
    return null;
  }
};

export const createEdgeCacheProvider = <T = unknown>(): CacheProvider<T> => {
  const set = async (
    key: string,
    data: T,
    config: CacheConfig
  ): Promise<boolean> => {
    try {
      const cache = getDefaultCache();
      const jsonData = JSON.stringify(data);

      let cacheControl = `public, max-age=${config.ttl}`;
      if (config.swr) {
        cacheControl += `, stale-while-revalidate=${config.swr}`;
      }

      const response = new Response(jsonData, {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': cacheControl,
          'X-Cache-Updated-At': new Date().toISOString(),
          'X-Cache-TTL': config.ttl.toString(),
          ...(config.metadata &&
            Object.fromEntries(
              Object.entries(config.metadata).map(([key, value]) => [
                `X-Cache-Meta-${key}`,
                value,
              ])
            )),
        },
      });

      await cache.put(key, response);

      console.log(
        `✅ [Edge Cache] Stored ${key} with TTL ${config.ttl}s${config.swr ? ` + SWR ${config.swr}s` : ''}`
      );
      return true;
    } catch (error) {
      console.error(`❌ [Edge Cache] Error storing ${key}:`, error);
      return false;
    }
  };

  const get = async (
    key: string
  ): Promise<{ data: T | null; meta: CacheMeta | null }> => {
    try {
      const cache = getDefaultCache();
      const response = await cache.match(key);

      if (!response) {
        console.log(`❓ [Edge Cache] Miss for ${key}`);
        return { data: null, meta: null };
      }

      // Check if response is stale (using CF-Cache-Status if available)
      const cacheStatus = response.headers.get('CF-Cache-Status');
      const isStale = cacheStatus === 'STALE';

      if (isStale) {
        console.log(`⏳ [Edge Cache] Stale hit for ${key}`);
      } else {
        console.log(`✅ [Edge Cache] Hit for ${key}`);
      }

      const data = (await response.json()) as T;

      const meta: CacheMeta = {
        updatedAt:
          response.headers.get('X-Cache-Updated-At') || new Date().toISOString(),
        ttl: parseInt(response.headers.get('X-Cache-TTL') || '0', 10),
        metadata: {},
      };

      response.headers.forEach((value, key) => {
        if (key.startsWith('x-cache-meta-')) {
          const metaKey = key.replace('x-cache-meta-', '');
          if (meta.metadata) {
            meta.metadata[metaKey] = value;
          }
        }
      });

      return { data, meta };
    } catch (error) {
      console.error(`❌ [Edge Cache] Error retrieving ${key}:`, error);
      return { data: null, meta: null };
    }
  };

  const exists = async (key: string): Promise<boolean> => {
    try {
      const cache = getDefaultCache();
      const response = await cache.match(key);
      return response !== undefined;
    } catch {
      return false;
    }
  };

  const deleteItem = async (key: string): Promise<boolean> => {
    try {
      const cache = getDefaultCache();
      const deleted = await cache.delete(key);
      if (deleted) {
        console.log(`🗑️ [Edge Cache] Deleted ${key}`);
      }
      return deleted;
    } catch (error) {
      console.error(`❌ [Edge Cache] Error deleting ${key}:`, error);
      return false;
    }
  };

  return {
    set,
    get,
    exists,
    delete: deleteItem,
  };
};

export const invalidateEdgeCacheForDate = async (
  date: string,
  timezones: string[],
  baseUrl = 'https://api.outscore.live'
): Promise<void> => {
  const cache = getDefaultCache();

  for (const timezone of timezones) {
    // Invalidate both live and non-live entries
    for (const live of [false, true]) {
      const key = generateEdgeCacheKey({ date, timezone, live, baseUrl });
      try {
        await cache.delete(key);
        console.log(`🗑️ [Edge Cache] Invalidated ${key}`);
      } catch (error) {
        console.error(`❌ [Edge Cache] Error invalidating ${key}:`, error);
      }
    }
  }
};


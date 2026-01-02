import type { CacheProvider } from './provider.interface';
import type { CacheConfig, CacheMeta } from './types';

/**
 * KV Cache provider using Cloudflare KV
 * 
 * This is the middle cache layer for hot data (today's matches).
 * Provides ~10-20ms reads, faster than R2 but slower than Edge Cache.
 * Stores raw UTC data (not timezone-transformed).
 */

export const generateKVCacheKey = ({
  date,
  live = false,
}: {
  date: string;
  live?: boolean;
}): string => {
  return live ? `fixtures:${date}:live` : `fixtures:${date}`;
};

/**
 * Creates a KV Cache provider
 */
export const createKVCacheProvider = <T = unknown>(
  kv: KVNamespace
): CacheProvider<T> => {

  const set = async (
    key: string,
    data: T,
    config: CacheConfig
  ): Promise<boolean> => {
    try {
      const jsonData = JSON.stringify(data);
      const dataSize = new TextEncoder().encode(jsonData).length;

      console.log(
        `📊 [KV] Data size for ${key}: ${(dataSize / 1024).toFixed(2)} KB`
      );

      // Check KV size limit (25MB)
      if (dataSize > 25 * 1024 * 1024) {
        console.error(`❌ [KV] Data too large for ${key} (${dataSize} bytes)`);
        return false;
      }

      const metadata = {
        updatedAt: new Date().toISOString(),
        ttl: config.ttl,
        ...config.metadata,
      };

      // Store with expiration TTL
      await kv.put(key, jsonData, {
        expirationTtl: config.ttl,
        metadata,
      });

      console.log(`✅ [KV] Stored ${key} with TTL ${config.ttl}s`);
      return true;
    } catch (error) {
      console.error(`❌ [KV] Error storing ${key}:`, error);
      return false;
    }
  };

  const get = async (
    key: string
  ): Promise<{ data: T | null; meta: CacheMeta | null }> => {
    try {
      console.log(`🔍 [KV] Retrieving ${key}`);

      const result = await kv.getWithMetadata<Record<string, unknown>>(key, {
        type: 'text',
      });

      if (!result.value) {
        console.log(`❓ [KV] Miss for ${key}`);
        return { data: null, meta: null };
      }

      const data = JSON.parse(result.value) as T;

      const kvMeta = result.metadata || {};
      const meta: CacheMeta = {
        updatedAt: (kvMeta.updatedAt as string) || new Date().toISOString(),
        ttl: (kvMeta.ttl as number) || 0,
        metadata: kvMeta as Record<string, string>,
      };

      console.log(`✅ [KV] Hit for ${key}`);
      return { data, meta };
    } catch (error) {
      console.error(`❌ [KV] Error retrieving ${key}:`, error);
      return { data: null, meta: null };
    }
  };

  const exists = async (key: string): Promise<boolean> => {
    try {
      const result = await kv.get(key);
      return result !== null;
    } catch {
      return false;
    }
  };

  const deleteItem = async (key: string): Promise<boolean> => {
    try {
      await kv.delete(key);
      console.log(`🗑️ [KV] Deleted ${key}`);
      return true;
    } catch (error) {
      console.error(`❌ [KV] Error deleting ${key}:`, error);
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

/**
 * Delete all KV entries for a specific date
 * This is used during date transitions
 */
export const deleteKVEntriesForDate = async (
  kv: KVNamespace,
  date: string
): Promise<void> => {
  const keys = [`fixtures:${date}`, `fixtures:${date}:live`];

  for (const key of keys) {
    try {
      await kv.delete(key);
      console.log(`🗑️ [KV] Deleted ${key}`);
    } catch (error) {
      console.error(`❌ [KV] Error deleting ${key}:`, error);
    }
  }
};


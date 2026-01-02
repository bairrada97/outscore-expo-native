import type { R2CacheProvider } from './provider.interface';
import type { CacheConfig, CacheLocation, CacheMeta } from './types';

/**
 * R2 Cache provider using Cloudflare R2
 * 
 * This is the cold storage layer for fixtures data.
 * Provides ~50-100ms reads, stores raw UTC data.
 * Used for historical and future data, and as backup for hot data.
 */

/**
 * Generate a cache key for R2
 */
export const generateR2CacheKey = ({
  location,
  date,
  live = false,
}: {
  location: CacheLocation | string;
  date: string;
  live?: boolean;
}): string => {
  const suffix = live ? '-live' : '';
  return `${location}/fixtures-${date}${suffix}.json`;
};


export const parseR2CacheKey = (
  key: string
): { location: string; date: string; live: boolean } | null => {
  const match = key.match(/^(today|historical|future)\/fixtures-(\d{4}-\d{2}-\d{2})(-live)?\.json$/);
  if (!match) return null;

  return {
    location: match[1],
    date: match[2],
    live: match[3] === '-live',
  };
};


export const createR2CacheProvider = <T = unknown>(
  r2Bucket: R2Bucket
): R2CacheProvider<T> => {

  const set = async (
    key: string,
    data: T,
    config: CacheConfig
  ): Promise<boolean> => {
    try {
      const jsonData = JSON.stringify(data);
      const dataSize = new TextEncoder().encode(jsonData).length;

      console.log(
        `📊 [R2] Data size for ${key}: ${(dataSize / 1024 / 1024).toFixed(2)} MB`
      );

      
      await r2Bucket.put(key, jsonData, {
        httpMetadata: {
          contentType: 'application/json',
        },
        customMetadata: {
          updatedAt: new Date().toISOString(),
          ttl: config.ttl.toString(),
          ...config.metadata,
        },
      });

      console.log(`✅ [R2] Stored ${key} with TTL ${config.ttl}s`);
      return true;
    } catch (error) {
      console.error(`❌ [R2] Error storing ${key}:`, error);
      return false;
    }
  };


  const get = async (
    key: string
  ): Promise<{ data: T | null; meta: CacheMeta | null }> => {
    try {
      console.log(`🔍 [R2] Retrieving ${key}`);

      const object = await r2Bucket.get(key);

      if (!object) {
        console.log(`❓ [R2] Miss for ${key}`);
        return { data: null, meta: null };
      }

     
      const rawData = await object.text();
      const data = JSON.parse(rawData) as T;

     
      const customMetadata = object.customMetadata || {};
      const meta: CacheMeta = {
        updatedAt: customMetadata.updatedAt || new Date().toISOString(),
        ttl: parseInt(customMetadata.ttl || '0', 10),
        metadata: customMetadata,
      };

      console.log(`✅ [R2] Hit for ${key}`);
      return { data, meta };
    } catch (error) {
      console.error(`❌ [R2] Error retrieving ${key}:`, error);
      return { data: null, meta: null };
    }
  };

  const exists = async (key: string): Promise<boolean> => {
    try {
      const headObject = await r2Bucket.head(key);
      return headObject !== null;
    } catch {
      return false;
    }
  };

  const deleteItem = async (key: string): Promise<boolean> => {
    try {
      await r2Bucket.delete(key);
      console.log(`🗑️ [R2] Deleted ${key}`);
      return true;
    } catch (error) {
      console.error(`❌ [R2] Error deleting ${key}:`, error);
      return false;
    }
  };


  const move = async (
    sourceKey: string,
    destinationKey: string
  ): Promise<boolean> => {
    try {
      console.log(`🔄 [R2] Moving ${sourceKey} to ${destinationKey}`);

      // 1. Get source object
      const sourceObject = await r2Bucket.get(sourceKey);
      if (!sourceObject) {
        console.log(`❓ [R2] Source object ${sourceKey} not found`);
        return false;
      }

      // 2. Read data and metadata
      const data = await sourceObject.text();
      const customMetadata = sourceObject.customMetadata || {};

      // 3. Copy to destination with updated metadata
      await r2Bucket.put(destinationKey, data, {
        httpMetadata: {
          contentType: 'application/json',
        },
        customMetadata: {
          ...customMetadata,
          movedAt: new Date().toISOString(),
          originalKey: sourceKey,
        },
      });

      // 4. Verify destination exists
      const destExists = await exists(destinationKey);
      if (!destExists) {
        console.error(`❌ [R2] Failed to verify destination ${destinationKey}`);
        return false;
      }

      // 5. Delete source
      await r2Bucket.delete(sourceKey);

      // 6. Verify source is deleted
      const sourceStillExists = await exists(sourceKey);
      if (sourceStillExists) {
        console.error(`⚠️ [R2] Source ${sourceKey} still exists after delete, retrying...`);
        await r2Bucket.delete(sourceKey);
      }

      console.log(`✅ [R2] Successfully moved ${sourceKey} to ${destinationKey}`);
      return true;
    } catch (error) {
      console.error(`❌ [R2] Error moving ${sourceKey} to ${destinationKey}:`, error);
      return false;
    }
  };

  /**
   * List all keys with a given prefix
   */
  const list = async (prefix: string): Promise<string[]> => {
    try {
      const objects = await r2Bucket.list({ prefix });
      return objects.objects.map((obj) => obj.key);
    } catch (error) {
      console.error(`❌ [R2] Error listing keys with prefix ${prefix}:`, error);
      return [];
    }
  };

  return {
    set,
    get,
    exists,
    delete: deleteItem,
    move,
    list,
  };
};

/**
 * Clean up duplicates for a date across all locations
 * Ensures only one reference exists per date
 */
export const cleanupR2Duplicates = async (
  r2Bucket: R2Bucket,
  date: string,
  correctLocation: CacheLocation | string
): Promise<void> => {
  const locations = ['today', 'historical', 'future'];
  const provider = createR2CacheProvider(r2Bucket);

  for (const location of locations) {
    if (location === correctLocation) continue;

    const key = generateR2CacheKey({ location, date, live: false });
    const liveKey = generateR2CacheKey({ location, date, live: true });

    // Check and delete non-live key
    if (await provider.exists(key)) {
      console.log(`🗑️ [R2] Cleaning up duplicate ${key} (should be in ${correctLocation})`);
      await provider.delete(key);
    }

    // Check and delete live key
    if (await provider.exists(liveKey)) {
      console.log(`🗑️ [R2] Cleaning up duplicate ${liveKey} (should be in ${correctLocation})`);
      await provider.delete(liveKey);
    }
  }
};


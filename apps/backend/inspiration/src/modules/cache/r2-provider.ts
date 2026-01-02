import { CacheProvider } from './provider.interface';
import { CacheConfig, CacheMeta } from './types';
import type { R2Bucket } from '@cloudflare/workers-types';

/**
 * Creates an R2 cache provider that implements the CacheProvider interface
 */

// Cache TTL presets that can be used by strategies
export const TTL = {
  SHORT: 15, // 15 seconds
  STANDARD: 3600, // 1 hour
  LONG: 86400 // 1 day
};


export const createR2CacheProvider = <T = any>(r2Bucket: R2Bucket): CacheProvider<T> => {
  /**
   * Store data in R2
   */
  const set = async (key: string, data: T, config: CacheConfig): Promise<boolean> => {
    try {
      const jsonData = JSON.stringify(data);
      const dataSize = new TextEncoder().encode(jsonData).length;
      console.log(`📊 [R2] Data size for ${key}: ${(dataSize / 1024 / 1024).toFixed(2)} MB`);
      
      // Store fixtures in R2 with metadata
      const metadata = {
        contentType: 'application/json',
        customMetadata: {
          updatedAt: new Date().toISOString(),
          ttl: config.ttl.toString(),
          ...config.metadata,
        }
      };
      
      await r2Bucket.put(key, jsonData, { httpMetadata: metadata });
      console.log(`✅ [R2] Successfully stored ${key} at ${new Date().toISOString()}`);
      return true;
    } catch (error) {
      console.error(`❌ [R2] Error storing ${key}:`, error);
      return false;
    }
  };

  /**
   * Retrieve data from R2
   */
  const get = async (key: string): Promise<{ data: T | null; meta: CacheMeta | null }> => {
    try {
      console.log(`🔍 [R2] Retrieving ${key}`);
      const object = await r2Bucket.get(key);
      
      if (!object) {
        console.log(`❓ [R2] No data found for ${key}`);
        return { data: null, meta: null };
      }
      
      // Extract data
      const rawData = await object.text();
      const data = JSON.parse(rawData) as T;
      
      // Extract metadata
      const customMetadata = object.customMetadata || {};
      const meta: CacheMeta = {
        updatedAt: customMetadata.updatedAt || new Date().toISOString(),
        ttl: parseInt(customMetadata.ttl || '0', 10),
        metadata: { ...customMetadata }
      };
      
      console.log(`✅ [R2] Successfully retrieved ${key}`);
      return { data, meta };
    } catch (error) {
      console.error(`❌ [R2] Error retrieving ${key}:`, error);
      return { data: null, meta: null };
    }
  };

  /**
   * Check if a key exists in R2
   */
  const exists = async (key: string): Promise<boolean> => {
    try {
      console.log(`🔍 [R2] Checking if ${key} exists`);
      const headObject = await r2Bucket.head(key);
      const exists = headObject !== null;
      console.log(`🔍 [R2] ${key} ${exists ? 'exists' : 'does not exist'}`);
      return exists;
    } catch (error) {
      console.error(`❌ [R2] Error checking if ${key} exists:`, error);
      return false;
    }
  };

  /**
   * Move data from one key to another in R2
   */
  const move = async (sourceKey: string, destinationKey: string): Promise<boolean> => {
    try {
      console.log(`🔄 [R2] Moving ${sourceKey} to ${destinationKey}`);
      
      // Get object from source key
      const sourceObject = await r2Bucket.get(sourceKey);
      if (!sourceObject) {
        console.log(`❓ [R2] Source object ${sourceKey} not found`);
        return false;
      }
      
      // Read data and metadata
      const data = await sourceObject.text();
      const customMetadata = sourceObject.customMetadata || {};
      
      // Create metadata for new object
      const metadata = {
        contentType: 'application/json',
        customMetadata: {
          ...customMetadata,
          movedAt: new Date().toISOString(),
          originalKey: sourceKey
        }
      };
      
      // Store at new location
      await r2Bucket.put(destinationKey, data, { httpMetadata: metadata });
      
      // Delete old object
      await r2Bucket.delete(sourceKey);
      
      console.log(`✅ [R2] Successfully moved ${sourceKey} to ${destinationKey}`);
      return true;
    } catch (error) {
      console.error(`❌ [R2] Error moving ${sourceKey} to ${destinationKey}:`, error);
      return false;
    }
  };

  /**
   * Delete data from R2
   */
  const deleteItem = async (key: string): Promise<boolean> => {
    try {
      console.log(`🗑️ [R2] Deleting ${key}`);
      await r2Bucket.delete(key);
      console.log(`✅ [R2] Successfully deleted ${key}`);
      return true;
    } catch (error) {
      console.error(`❌ [R2] Error deleting ${key}:`, error);
      return false;
    }
  };

  return {
    set,
    get,
    exists,
    move,
    delete: deleteItem
  };
}; 
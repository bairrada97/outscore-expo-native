import { CacheConfig, CacheMeta } from './types';


/**
 * CacheProvider defines the contract for all cache implementations
 */
export type CacheProvider<T = any> = {
  /**
   * Store data in the cache
   */
  set: (key: string, data: T, config: CacheConfig) => Promise<boolean>;
  
  /**
   * Retrieve data from the cache
   */
  get: (key: string) => Promise<{ data: T | null; meta: CacheMeta | null }>;
  
  /**
   * Check if a key exists in the cache
   */
  exists: (key: string) => Promise<boolean>;
  
  /**
   * Move data from one key to another
   */
  move: (sourceKey: string, destinationKey: string) => Promise<boolean>;
  
  /**
   * Delete data from the cache
   */
  delete: (key: string) => Promise<boolean>;
} 
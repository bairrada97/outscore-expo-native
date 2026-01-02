import type { CacheConfig, CacheMeta } from './types';

/**
 * CacheProvider defines the contract for all cache implementations
 */
export interface CacheProvider<T = unknown> {
  set: (key: string, data: T, config: CacheConfig) => Promise<boolean>;
  get: (key: string) => Promise<{ data: T | null; meta: CacheMeta | null }>;
  exists: (key: string) => Promise<boolean>;
  delete: (key: string) => Promise<boolean>;
}

export interface R2CacheProvider<T = unknown> extends CacheProvider<T> {
  move: (sourceKey: string, destinationKey: string) => Promise<boolean>;

  /**
   * List all keys with a given prefix
   */
  list: (prefix: string) => Promise<string[]>;
}


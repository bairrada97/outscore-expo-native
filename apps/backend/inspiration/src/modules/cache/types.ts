/**
 * Cache configuration options
 */
export interface CacheConfig {
  /**
   * Time-to-live in seconds
   */
  ttl: number;
  
  /**
   * Optional metadata to store alongside the cached data
   */
  metadata?: Record<string, string>;
}

/**
 * Cache metadata returned with get operations
 */
export interface CacheMeta {
  /**
   * When the cache entry was last updated
   */
  updatedAt: string;
  
  /**
   * The TTL value this cache entry was stored with
   */
  ttl: number;
  
  /**
   * Any additional metadata stored with the entry
   */
  metadata?: Record<string, string>;
}

/**
 * Cache strategies determine how data is cached and retrieved
 */
export enum CacheStrategy {
  /**
   * Cache with standard TTL, retrieve without checking freshness
   */
  STANDARD = 'standard',
  
  /**
   * Cache with short TTL, frequently refresh from source
   */
  FREQUENT_REFRESH = 'frequent_refresh',
  
  /**
   * Cache with long TTL, rarely refresh from source
   */
  LONG_TERM = 'long_term'
}

/**
 * Strategy result containing both the strategy and TTL
 */
export interface StrategyResult {
  /**
   * The cache strategy to use
   */
  strategy: CacheStrategy;
  
  /**
   * Time-to-live in seconds
   */
  ttl: number;
}

/**
 * Generic cache strategy function
 * Each endpoint can implement their own version with relevant parameters
 */
export type CacheStrategyFn = (...args: any[]) => StrategyResult;

/**
 * Response from cache operations that includes source information
 */
export interface CacheResult<T> {
  /**
   * The data retrieved from cache or null if not found
   */
  data: T | null;
  
  /**
   * Where the data was retrieved from (cache, API, etc.)
   */
  source: 'Cache' | 'API' | 'None';
  
  /**
   * Flag indicating a forced refresh is needed
   */
  forceRefresh?: boolean;
  
  /**
   * Metadata about the cached item
   */
  meta?: CacheMeta;
} 
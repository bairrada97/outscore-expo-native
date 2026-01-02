// Define the RateLimit interface for Cloudflare's rate limiter
interface RateLimit {
  limit(options: { key: string }): Promise<{
    success: boolean;
    limit: number;
    reset: number;
    remaining?: number;
  }>;
}

// Add type declaration for hono-rate-limiter/cloudflare
declare module '@hono-rate-limiter/cloudflare' {
  import { Context, MiddlewareHandler } from 'hono';
  
  export interface CloudflareRateLimiterOptions<T> {
    /**
     * Function to access the rate limiter binding from the context
     */
    rateLimitBinding: (c: Context<T>) => RateLimit;
    
    /**
     * Function to generate a key for rate limiting
     */
    keyGenerator: (c: Context<T>) => string;
  }
  
  /**
   * Creates a rate limiter middleware for Hono using Cloudflare's rate limiter
   */
  export function cloudflareRateLimiter<T>(
    options: CloudflareRateLimiterOptions<T>
  ): MiddlewareHandler<T>;
} 
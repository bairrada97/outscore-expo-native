import type { Context, MiddlewareHandler } from 'hono';

/**
 * Rate limiter configuration
 */
interface RateLimiterConfig {
  /**
   * Maximum number of requests allowed in the window
   */
  limit: number;

  /**
   * Time window in seconds
   */
  windowSec: number;

  /**
   * Key generator function - defaults to IP-based
   */
  keyGenerator?: (context: Context) => string;

  /**
   * Skip rate limiting for certain requests
   */
  skip?: (context: Context) => boolean;
}

/**
 * In-memory rate limit store (per worker instance)
 * Note: In production with multiple workers, use KV or Durable Objects
 */
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

/**
 * Maximum entries to prevent unbounded memory growth
 * When exceeded, triggers a cleanup of expired entries
 */
const MAX_ENTRIES = 10000;

/**
 * Clean up expired entries from the store
 * Called lazily when the store exceeds MAX_ENTRIES
 */
const cleanupExpiredEntries = (now: number): void => {
  for (const [rateLimitKey, rateLimitEntry] of rateLimitStore.entries()) {
    if (rateLimitEntry.resetAt < now) {
      rateLimitStore.delete(rateLimitKey);
    }
  }
};

/**
 * Get client IP from request
 */
const getClientIp = (context: Context): string => {
  // Cloudflare provides the connecting IP
  const cfIp = context.req.raw.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp;

  // Fallback to X-Forwarded-For
  const forwardedFor = context.req.raw.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();

  // Fallback to X-Real-IP
  const realIp = context.req.raw.headers.get('x-real-ip');
  if (realIp) return realIp;

  return 'unknown';
};

/**
 * Rate limiter middleware using fixed window algorithm
 */
export const rateLimiter = (config: RateLimiterConfig): MiddlewareHandler => {
  const { limit, windowSec, keyGenerator, skip } = config;
  const windowMs = windowSec * 1000;

  return async (context, next) => {
    // Check if we should skip rate limiting
    if (skip?.(context)) {
      await next();
      return;
    }

    const key = keyGenerator ? keyGenerator(context) : getClientIp(context);
    const now = Date.now();

    // Lazy cleanup: remove expired entries when store exceeds max size
    if (rateLimitStore.size > MAX_ENTRIES) {
      cleanupExpiredEntries(now);
    }

    // Get or create rate limit entry
    let entry = rateLimitStore.get(key);

    if (!entry || entry.resetAt < now) {
      // Create new window
      entry = {
        count: 0,
        resetAt: now + windowMs,
      };
    }

    entry.count++;
    rateLimitStore.set(key, entry);

    // Calculate remaining and reset time
    const remaining = Math.max(0, limit - entry.count);
    const resetSeconds = Math.ceil((entry.resetAt - now) / 1000);

    // Set rate limit headers
    context.header('X-RateLimit-Limit', limit.toString());
    context.header('X-RateLimit-Remaining', remaining.toString());
    context.header('X-RateLimit-Reset', resetSeconds.toString());

    // Check if over limit
    if (entry.count > limit) {
      console.log(`⚠️ [RateLimit] Exceeded for ${key}: ${entry.count}/${limit}`);

      context.header('Retry-After', resetSeconds.toString());

      return context.json(
        {
          error: 'rate_limit_exceeded',
          message: 'Too many requests. Please try again later.',
          retryAfter: resetSeconds,
        },
        429
      );
    }

    await next();
  };
};

/**
 * Per-endpoint rate limiter factory
 */
export const createEndpointRateLimiter = (
  endpoint: string,
  limit: number,
  windowSec: number
): MiddlewareHandler => {
  return rateLimiter({
    limit,
    windowSec,
    keyGenerator: (context) => `${endpoint}:${getClientIp(context)}`,
  });
};

/**
 * Fixtures endpoint rate limiter (60 requests/minute)
 */
export const fixturesRateLimiter = createEndpointRateLimiter('/fixtures', 60, 60);

/**
 * Live fixtures endpoint rate limiter (30 requests/minute)
 */
export const liveFixturesRateLimiter = createEndpointRateLimiter('/fixtures?live', 30, 60);


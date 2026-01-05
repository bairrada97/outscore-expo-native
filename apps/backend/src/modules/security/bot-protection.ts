import type { MiddlewareHandler } from 'hono';

/**
 * Configuration options for bot protection
 */
interface BotProtectionOptions {
  /**
   * Block requests with no user agent
   */
  blockEmptyUserAgent?: boolean;

  /**
   * Block common bot user agents
   */
  blockKnownBots?: boolean;

  /**
   * Custom list of user agent strings to block
   */
  blockedUserAgents?: string[];

  /**
   * Whether to check the cf-connecting-ip header (Cloudflare specific)
   */
  checkCloudflareIp?: boolean;

  /**
   * Force enable Cloudflare strict checking regardless of environment
   * If not set, will check NODE_ENV === 'production' or ENABLE_CLOUDFLARE_CHECK env var
   */
  forceCloudflareCheck?: boolean;
}

/**
 * Common bot patterns to block
 */
const knownBotPatterns = [
  'bot',
  'spider',
  'crawl',
  'scrape',
  'headless',
  'selenium',
  'phantomjs',
  'puppeteer',
  'semrush',
  'ahrefs',
  'dotbot',
  'bingbot',
  'yandex',
  'baidu',
  'python-requests',
  'go-http-client',
  'wget',
  'curl',
];

/**
 * Simple middleware to block known bots and scrapers based on user agents
 */
export const botProtection = (options: BotProtectionOptions = {}): MiddlewareHandler => {
  const {
    blockEmptyUserAgent = true,
    blockKnownBots = true,
    blockedUserAgents = [],
    checkCloudflareIp = true,
    forceCloudflareCheck,
  } = options;

  // Combine custom and known bot patterns
  const patterns = blockKnownBots ? [...knownBotPatterns, ...blockedUserAgents] : blockedUserAgents;

  // Track if we've logged the strict check activation message (per worker instance)
  let hasLoggedStrictCheckActivation = false;

  return async (context, next) => {
    // Determine if we should enforce strict Cloudflare checking
    // Check in order: forceCloudflareCheck option > ENABLE_CLOUDFLARE_CHECK env > NODE_ENV === 'production'
    const env = (context.env as { NODE_ENV?: string; ENABLE_CLOUDFLARE_CHECK?: string }) || {};
    const isProduction = env.NODE_ENV === 'production';
    const cloudflareCheckEnabled = env.ENABLE_CLOUDFLARE_CHECK === 'true' || env.ENABLE_CLOUDFLARE_CHECK === '1';
    const shouldEnforceStrictCloudflareCheck = forceCloudflareCheck ?? cloudflareCheckEnabled ?? isProduction;

    // Log once when stricter check is active (per worker instance)
    if (checkCloudflareIp && shouldEnforceStrictCloudflareCheck && !hasLoggedStrictCheckActivation) {
      const reason = forceCloudflareCheck
        ? 'forceCloudflareCheck option enabled'
        : cloudflareCheckEnabled
        ? 'ENABLE_CLOUDFLARE_CHECK env var enabled'
        : 'production mode (NODE_ENV=production)';
      console.log(`🔒 [Bot] Cloudflare strict header check is ACTIVE (${reason})`);
      hasLoggedStrictCheckActivation = true;
    }

    const userAgent = context.req.header('user-agent') || '';

    // Block empty user agents if configured
    if (blockEmptyUserAgent && !userAgent) {
      console.log(`🤖 [Bot] Blocked: Empty user agent`);
      return context.json(
        {
          error: 'access_denied',
          message: 'Access denied',
        },
        403
      );
    }

    // Check for bot patterns in user agent
    const lowerUA = userAgent.toLowerCase();
    for (const pattern of patterns) {
      if (lowerUA.includes(pattern.toLowerCase())) {
        console.log(`🤖 [Bot] Blocked: Pattern "${pattern}" matched in "${userAgent}"`);
        return context.json(
          {
            error: 'access_denied',
            message: 'Access denied',
          },
          403
        );
      }
    }

    // Cloudflare specific IP check
    if (checkCloudflareIp) {
      const cfIp = context.req.raw.headers.get('cf-connecting-ip');
      const isCf = context.req.raw.headers.get('cf-ray');

      // If we're behind Cloudflare but there's no CF-Connecting-IP, it's suspicious
      if (isCf && !cfIp) {
        if (shouldEnforceStrictCloudflareCheck) {
          // In production or when explicitly enabled, block the request
          console.log(`🤖 [Bot] Blocked: Missing CF-Connecting-IP header (strict check active)`);
          return context.json(
            {
              error: 'access_denied',
              message: 'Access denied',
            },
            403
          );
        } else {
          // In non-production, log a warning but allow the request
          console.warn(`⚠️ [Bot] Warning: Missing CF-Connecting-IP header detected but not blocking (non-production mode). Request from: ${context.req.header('user-agent') || 'unknown'}`);
        }
      }
    }

    await next();
  };
};


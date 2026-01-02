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
  'python-requests',
  'go-http-client',
  'wget',
  'curl',
  'selenium',
  'phantomjs',
  'puppeteer',
  'semrush',
  'ahrefs',
  'dotbot',
  'bingbot',
  'yandex',
  'baidu',
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
  } = options;

  // Combine custom and known bot patterns
  const patterns = blockKnownBots ? [...knownBotPatterns, ...blockedUserAgents] : blockedUserAgents;

  return async (context, next) => {
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
        console.log(`🤖 [Bot] Blocked: Missing CF-Connecting-IP header`);
        return context.json(
          {
            error: 'access_denied',
            message: 'Access denied',
          },
          403
        );
      }
    }

    await next();
  };
};


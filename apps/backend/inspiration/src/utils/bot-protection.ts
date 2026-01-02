import { MiddlewareHandler } from 'hono';

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
 * Simple middleware to block known bots and scrapers based on user agents
 * 
 * This isn't foolproof since user agents can be spoofed, but it blocks
 * basic scraping attempts
 */
export function botProtection(options: BotProtectionOptions = {}): MiddlewareHandler {
  const {
    blockEmptyUserAgent = true,
    blockKnownBots = true,
    blockedUserAgents = [],
    checkCloudflareIp = true
  } = options;
  
  // Common bot user agents to block
  const knownBots = blockKnownBots ? [
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
    'puppeteer'
  ] : [];
  
  // Combine custom and known bot patterns
  const patterns = [...knownBots, ...blockedUserAgents];
  
  return async (c, next) => {
    // Get user agent
    const userAgent = c.req.header('user-agent') || '';
    
    // Block empty user agents if configured
    if (blockEmptyUserAgent && !userAgent) {
      return c.json({
        error: 'access_denied',
        message: 'Access denied'
      }, 403);
    }
    
    // Check for bot patterns in user agent
    const lowerUA = userAgent.toLowerCase();
    for (const pattern of patterns) {
      if (lowerUA.includes(pattern)) {
        return c.json({
          error: 'access_denied',
          message: 'Access denied'
        }, 403);
      }
    }
    
    // Cloudflare specific IP check
    if (checkCloudflareIp) {
      // Some DDoS attacks don't have Cloudflare IP headers
      const cfIp = c.req.raw.headers.get('cf-connecting-ip');
      if (!cfIp) {
        // If we're in Cloudflare and there's no CF-Connecting-IP, it's suspicious
        const isCf = c.req.raw.headers.get('cf-ray');
        if (isCf) {
          return c.json({
            error: 'access_denied',
            message: 'Access denied'
          }, 403);
        }
      }
    }
    
    await next();
  };
} 
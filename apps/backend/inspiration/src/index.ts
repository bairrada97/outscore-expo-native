import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { secureHeaders } from 'hono/secure-headers';

import { format } from 'date-fns';
import { z } from 'zod';
import { fixturesService, isValidTimezone } from './modules';
import { getUtcDateInfo } from './modules/fixtures/date.utils';
import { botProtection } from './utils';

interface Env {
  FOOTBALL_CACHE: R2Bucket;
  FOOTBALL_API_URL: string;
  RAPIDAPI_KEY: string;
  API_KEY_SECRET: string;
  OUTSCORE_RATE_LIMITER: any; // Cloudflare rate limiter binding
  APPROVED_ORIGINS: string;
}

// Define approved origins to be consistent
// Make it a let instead of const so it can be updated from environment
let approvedOrigins = ['https://outscore.live', 'http://localhost:3000', 'http://localhost:8081', "http://10.0.2.2:3000", "exp://,expo-development-client://"];

const app = new Hono<{ Bindings: Env }>();

// Add secure headers middleware
app.use('*', secureHeaders({
  strictTransportSecurity: 'max-age=63072000; includeSubDomains; preload',
  xContentTypeOptions: 'nosniff',
  xFrameOptions: 'DENY',
  xXssProtection: '1; mode=block'
}));

// Bot protection to block common scrapers and bots
// Skip for health checks
app.use('*', async (c, next) => {
  if (c.req.path === '/health') {
    await next();
    return;
  }
  
  // Apply bot protection middleware
  await botProtection({
    // Exclude some legit bots if needed
    blockedUserAgents: ['semrush', 'ahrefs']
  })(c, next);
});

// CORS middleware with origin-based authentication
app.use('*', async (c, next) => {
  // Get approved origins from environment
  const envOrigins = c.env.APPROVED_ORIGINS;
  if (envOrigins) {
    approvedOrigins = envOrigins.split(',');
  }
  
  // Get the request origin
  const origin = c.req.header('origin');
  
  // Handle OPTIONS requests with appropriate CORS headers
  if (c.req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
        'Access-Control-Max-Age': '86400', // 24 hours
      }
    });
  }
  
  // If health check, skip auth entirely
  if (c.req.path === '/health') {
    await next();
    return;
  }
  
  // Temporarily allow all origins
  await next();
  return;
});

// Health check
app.get('/health', (c) => c.json({ status: 'ok' }));

// Fixtures routes
const dateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
  timezone: z.string()
    .refine(
      (tz) => isValidTimezone(tz),
      { message: "Invalid timezone provided" }
    )
    .default("UTC"),
  live: z.enum(['all']).optional(),
});

// Function to refresh today's fixtures (called by scheduled cron handler)
async function refreshTodayFixtures(env: any) {
  try {
    console.log('🔄 BACKGROUND: Automatically refreshing today\'s fixtures data');
    
    // Get current UTC date
    const now = new Date();
    const utcNow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const today = format(utcNow, 'yyyy-MM-dd');
    
    // Get date info
    const dateInfo = getUtcDateInfo({ date: today });
    
    // Force refresh from API
    console.log(`🌐 BACKGROUND: Fetching fresh fixtures for ${dateInfo.utcToday} from API`);
    
    // Create a mock ExecutionContext
    const mockCtx = {
      waitUntil: (promise: Promise<any>) => {
        // This would normally extend the lifetime of the worker
        return promise.catch(err => {
          console.error('Error in background refresh waitUntil:', err);
        });
      }
    };
    
    // Fetch fresh data for today
    await fixturesService.getFixtures({
      date: dateInfo.utcToday,
      timezone: 'UTC',
      live: undefined,
      env,
      ctx: mockCtx
    });
    
    console.log('✅ BACKGROUND: Successfully refreshed today\'s fixtures data');
  } catch (error) {
    console.error('❌ BACKGROUND: Error refreshing today\'s fixtures:', error);
  }
}

app.get('/fixtures', zValidator('query', dateSchema), async (c) => {
  // Parse date and timezone from query
  const { date, timezone = 'UTC', live } = c.req.valid('query');
  
  // Get request start time for timing
  const requestStartTime = performance.now();
  
  try {
    let queryDate = date;

    // Get fixtures from service
    const { data: fixtures, source, originalMatchCount } = await fixturesService.getFixtures({
      date: queryDate, 
      timezone, 
      live,
      env: c.env,
      ctx: c.executionCtx
    });
    
    // Count total matches across all leagues for testing purposes
    let filteredMatchCount = 0;
    fixtures.forEach(country => {
      country.leagues.forEach(league => {
        filteredMatchCount += league.matches.length;
      });
    });
    
    // Add detailed comparison logging to help debug timezone issues
    console.log(`📊 MATCH COUNTS: originalCount=${originalMatchCount}, afterTimezoneProcessing=${filteredMatchCount}, timezone=${timezone}`);
    console.log(`   This shows our timezone filtering: ${timezone === 'UTC' ? 'in UTC we show all UTC matches' : 'we filter to only show matches that occur on the local date in ' + timezone}`);

    // Calculate load time for headers
    const responseTime = (performance.now() - requestStartTime).toFixed(2);
    
    // // Set standard headers
    // c.header('X-Response-Time', `${responseTime}ms`);
    // c.header('X-User-Timezone', timezone);
    // c.header('X-Requested-Date', queryDate);
    // c.header('X-Source', source);
    
    // // Set data age text based on source and whether it's today's data
    // let dataAge = 'Unknown';
    // if (source === 'API') {
    //   dataAge = '<15s';
    // } else if (source === 'R2') {
    //   if (isUtcToday) {
    //     dataAge = '<20s';
    //   } else {
    //     dataAge = '<1h';
    //   }
    // }
    // c.header('X-Data-Age', dataAge);
    
    // // Set TTL header
    // const ttl = isUtcToday ? 20 : 3600;
    // c.header('X-TTL', `${ttl}s`);
    
    // // Set Cache-Control header to match our desired cache policy
    // if (isUtcToday) {
    //   // For today's data, use no-cache to force browser to revalidate with server on each request
    //   // This allows our worker to decide to use its cache or not, but prevents browser caching
    //   c.header('Cache-Control', 'no-cache, must-revalidate, max-age=0');
    //   c.header('Pragma', 'no-cache');
    //   c.header('Expires', '0');
    // } else if (isDateInThreeDayWindow) {
    //   // For yesterday/tomorrow, also use no-store but with a longer stale-while-revalidate for CF
    //   c.header('Cache-Control', 'no-cache, must-revalidate, max-age=0'); 
    //   c.header('Pragma', 'no-cache');
    //   c.header('Expires', '0');
    // } else {
    //   // For older dates, allow longer caching
    //   c.header('Cache-Control', 'public, max-age=3600, stale-while-revalidate=7200');
    // }
    
    return c.json({
      status: 'success',
      date: queryDate,
      timezone,
      source,
      matchCount: {
        original: originalMatchCount,
        filtered: filteredMatchCount
      },
      data: fixtures
    });
  } catch (error) {
    console.error('Error fetching fixtures:', error);
    return c.json({
      status: 'error',
      message: 'Failed to fetch fixtures',
      error: error instanceof Error ? error.message : String(error),
      matchCount: {
        original: 0,
        filtered: 0
      }
    }, 500);
  }
});

export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
    // Get the origin from the request
    const origin = request.headers.get('Origin') || '';
    
    // Handle OPTIONS request for CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
          'Access-Control-Max-Age': '86400', // 24 hours
        },
      });
    }

    // Create request context with timing info
    const requestStartTime = performance.now();
    
    // Process the request with the Hono app
    const response = await app.fetch(request, env, ctx);
    
    // Add response time
    const responseTime = (performance.now() - requestStartTime).toFixed(2);
    response.headers.set('X-Response-Time', `${responseTime}ms`);
    
    // Add CORS headers for all origins
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
    response.headers.set('Access-Control-Expose-Headers', 'X-Response-Time, X-Source, X-TTL, X-UTC-Today, X-User-Timezone, X-Requested-Date, X-Is-UTC-Today, X-In-Three-Day-Window, X-Cache-Status, X-Data-Age, Cache-Control, Pragma, Expires');
    
    // Return final response
    return response;
  },
  
  // Initialize the worker - runs once when the worker starts
  async scheduled(event: any, env: any, ctx: ExecutionContext) {
    console.log(`⚡ Scheduled event triggered: ${event.cron}`);
    // Refresh data on schedule
    refreshTodayFixtures(env).catch(err => {
      console.error('Error in scheduled refresh:', err);
    });
  }
};
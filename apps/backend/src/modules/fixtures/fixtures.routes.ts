import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { isValidTimezone } from '../timezones';
import { fixturesService, type FixturesEnv } from './fixtures.service';


export const createFixturesRoutes = () => {
  const fixtures = new Hono<{ Bindings: FixturesEnv }>();

  // Combined schema that handles both fixture list and fixture detail
  const fixturesQuerySchema = z.object({
    // Fixture detail parameter (when present, returns single fixture)
    id: z
      .string()
      .regex(/^\d+$/, 'Fixture ID must be a number')
      .transform((val) => parseInt(val, 10))
      .optional(),
    // Fixture list parameters
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
      .optional(),
    timezone: z
      .string()
      .refine((tz) => isValidTimezone(tz), {
        message: 'Invalid timezone provided',
      })
      .default('UTC'),
    live: z.enum(['all']).optional(),
  });

  /**
   * GET /fixtures - Unified fixtures endpoint
   * - /fixtures?id={fixtureId} - Get single fixture detail
   * - /fixtures?date=2026-01-01 - List fixtures by date
   * - /fixtures?live=all - List live fixtures
   */
  fixtures.get('/', zValidator('query', fixturesQuerySchema), async (context) => {
    const { id: fixtureId, date, timezone, live } = context.req.valid('query');
    const requestStartTime = performance.now();

    // Route to fixture detail handler if 'id' is present
    if (fixtureId !== undefined) {
      return handleFixtureDetail(context, fixtureId, requestStartTime);
    }

    // Otherwise, handle fixtures list
    return handleFixturesList(context, date, timezone, live, requestStartTime);
  });

  return fixtures;
};

/**
 * Handle fixture detail request
 */
async function handleFixtureDetail(
  context: Parameters<Parameters<ReturnType<typeof Hono.prototype.get>>[1]>[0],
  fixtureId: number,
  requestStartTime: number
) {
  try {
    const result = await fixturesService.getFixtureDetail({
      fixtureId,
      env: context.env,
      ctx: context.executionCtx,
    });

    const responseTime = (performance.now() - requestStartTime).toFixed(2);
    const fixture = result.data.response[0];

    console.log(
      `📊 [FixtureDetail] fixtureId=${fixtureId}, ` +
        `source=${result.source}, time=${responseTime}ms`
    );

    // Set cache headers based on fixture status
    if (fixture) {
      const status = fixture.fixture.status.short;
      const timestamp = fixture.fixture.timestamp;
      const nowSeconds = Math.floor(Date.now() / 1000);
      const timeUntilMatch = timestamp - nowSeconds;

      // Live statuses
      const liveStatuses = ['LIVE', '1H', '2H', 'HT', 'ET', 'BT', 'P'];
      // Finished statuses
      const finishedStatuses = ['FT', 'AET', 'PEN', 'PST', 'CANC', 'ABD', 'AWD', 'WO'];

      if (liveStatuses.includes(status)) {
        // Live: short cache
        context.header('Cache-Control', 'public, max-age=15, stale-while-revalidate=30');
      } else if (finishedStatuses.includes(status)) {
        // Finished: long cache (7 days)
        context.header('Cache-Control', 'public, max-age=604800');
      } else if (timeUntilMatch <= 45 * 60) {
        // 45 min before match: short cache (lineups)
        context.header('Cache-Control', 'public, max-age=15, stale-while-revalidate=30');
      } else if (timeUntilMatch <= 8 * 60 * 60) {
        // 8 hours before: 1 hour cache
        context.header('Cache-Control', 'public, max-age=3600, stale-while-revalidate=7200');
      } else if (timeUntilMatch <= 7 * 24 * 60 * 60) {
        // 7 days before: 6 hour cache
        context.header('Cache-Control', 'public, max-age=21600, stale-while-revalidate=43200');
      } else {
        // Further future: 24 hour cache
        context.header('Cache-Control', 'public, max-age=86400, stale-while-revalidate=172800');
      }
    } else {
      // Fixture not found: short cache
      context.header('Cache-Control', 'public, max-age=60');
    }

    // Add custom headers for debugging
    context.header('X-Source', result.source);

    return context.json({
      status: 'success',
      source: result.source,
      data: result.data,
    });
  } catch (error) {
    console.error('❌ [FixtureDetail] Error:', error);

    let errorMessage = 'Failed to fetch fixture detail';
    let statusCode: 500 | 429 | 502 = 500;

    if (error instanceof Error) {
      if (error.message.includes('API rate limit')) {
        errorMessage = 'API rate limit exceeded. Please try again later.';
        statusCode = 429;
      } else if (error.message.includes('API request failed')) {
        errorMessage = 'External API request failed. Please try again later.';
        statusCode = 502;
      }
    }

    return context.json(
      {
        status: 'error',
        message: errorMessage,
        error: error instanceof Error ? error.message : String(error),
      },
      statusCode
    );
  }
}

/**
 * Handle fixtures list request
 */
async function handleFixturesList(
  context: Parameters<Parameters<ReturnType<typeof Hono.prototype.get>>[1]>[0],
  date: string | undefined,
  timezone: string,
  live: 'all' | undefined,
  requestStartTime: number
) {
  try {
    const result = await fixturesService.getFixtures({
      date,
      timezone,
      live,
      env: context.env,
      ctx: context.executionCtx,
    });

    // Count filtered matches
    let filteredMatchCount = 0;
    result.data.forEach((country) => {
      country.leagues.forEach((league) => {
        filteredMatchCount += league.matches.length;
      });
    });

    const responseTime = (performance.now() - requestStartTime).toFixed(2);

    console.log(
      `📊 [Response] date=${date || 'today'}, timezone=${timezone}, ` +
        `source=${result.source}, originalCount=${result.originalMatchCount}, ` +
        `filteredCount=${filteredMatchCount}, time=${responseTime}ms`
    );

    // Set cache headers based on data freshness
    const isToday = !date || date === new Date().toISOString().split('T')[0];
    if (isToday || live === 'all') {
      // Today's data or live: short cache with stale-while-revalidate
      context.header('Cache-Control', 'public, max-age=15, stale-while-revalidate=30');
    } else if (date && date > new Date().toISOString().split('T')[0]) {
      // Future data: moderate cache
      context.header('Cache-Control', 'public, max-age=3600, stale-while-revalidate=7200');
    } else {
      // Historical data: long cache
      context.header('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    }

    // Add custom headers for debugging
    context.header('X-Source', result.source);
    context.header('X-Timezone', timezone);

    return context.json({
      status: 'success',
      date: date || new Date().toISOString().split('T')[0],
      timezone,
      source: result.source,
      matchCount: {
        original: result.originalMatchCount,
        filtered: filteredMatchCount,
      },
      data: result.data,
    });
  } catch (error) {
    console.error('❌ [Fixtures] Error:', error);

    let errorMessage = 'Failed to fetch fixtures';
    let statusCode: 500 | 429 | 502 | 400 = 500;

    if (error instanceof Error) {
      if (error.message.includes('API rate limit')) {
        errorMessage = 'API rate limit exceeded. Please try again later.';
        statusCode = 429;
      } else if (error.message.includes('API request failed')) {
        errorMessage = 'External API request failed. Please try again later.';
        statusCode = 502;
      } else if (error.message.includes('Invalid timezone')) {
        errorMessage = error.message;
        statusCode = 400;
      }
    }

    return context.json(
      {
        status: 'error',
        message: errorMessage,
        error: error instanceof Error ? error.message : String(error),
      },
      statusCode
    );
  }
}

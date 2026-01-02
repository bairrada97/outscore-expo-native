import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { isValidTimezone } from '../timezones';
import { fixturesService, type FixturesEnv } from './fixtures.service';


export const createFixturesRoutes = () => {
  const fixtures = new Hono<{ Bindings: FixturesEnv }>();

  const fixturesQuerySchema = z.object({
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


  fixtures.get('/', zValidator('query', fixturesQuerySchema), async (context) => {
    const { date, timezone, live } = context.req.valid('query');
    const requestStartTime = performance.now();

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
      let statusCode = 500;

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
  });

  return fixtures;
};


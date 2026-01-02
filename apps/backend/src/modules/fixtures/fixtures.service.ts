import type { Fixture, FormattedFixturesResponse } from '@outscore/shared-types';
import { getFootballApiFixtures } from '../../pkg/util/football-api';
import {
  type CacheEnv,
  cacheGet,
  cacheSet,
  cacheSetEdgeOnly,
  checkFixturesDateTransition,
  getCacheKey,
  isStale,
  withDeduplication,
} from '../cache';
import { getUtcDateInfo, normalizeToUtcDate } from './date.utils';
import { getCurrentHourInTimezone, getDatesToFetch } from './timezone.utils';
import { filterFixturesByTimezone, formatFixtures } from './utils';

export interface FixturesEnv extends CacheEnv {
  FOOTBALL_API_URL: string;
  RAPIDAPI_KEY: string;
}

export interface FixturesServiceResult {
  data: FormattedFixturesResponse;
  source: string;
  originalMatchCount: number;
}

export const fixturesService = {
  async getFixtures({
    date,
    timezone = 'UTC',
    live,
    env,
    ctx,
  }: {
    date?: string;
    timezone: string;
    live?: 'all';
    env: FixturesEnv;
    ctx: ExecutionContext;
  }): Promise<FixturesServiceResult> {
    // Check for date transitions
    await checkFixturesDateTransition(env);

    // Handle live fixtures
    if (live === 'all') {
      return this.getLiveFixtures({ timezone, env, ctx });
    }

    // Normalize the requested date
    const requestedDate = normalizeToUtcDate(date);
    const dateInfo = getUtcDateInfo(requestedDate);

    console.log(
      `📆 [Fixtures] Request: date=${requestedDate}, timezone=${timezone}, isToday=${dateInfo.isToday}`
    );

    // Generate cache key for deduplication
    const dedupKey = getCacheKey('fixtures', { date: requestedDate, timezone, live: 'false' });

    return withDeduplication(dedupKey, async () => {
      // 1. Check Edge Cache for timezone-transformed response
      const edgeCacheParams = { date: requestedDate, timezone, live: 'false' };
      const edgeResult = await cacheGet<FormattedFixturesResponse>(
        env,
        'fixtures',
        edgeCacheParams
      );

      if (edgeResult.source === 'edge' && edgeResult.data) {
        console.log(`✅ [Fixtures] Edge Cache hit for ${requestedDate}:${timezone}`);
        return {
          data: edgeResult.data,
          source: 'Edge Cache',
          originalMatchCount: this.countOriginalMatches(edgeResult.data),
        };
      }

      // 2. Check KV/R2 for raw UTC data
      let rawFixtures: Fixture[] | null = null;
      let source = 'API';

      const rawParams = { date: requestedDate, live: 'false' };
      const rawResult = await cacheGet<Fixture[]>(env, 'fixtures', rawParams);

      if (rawResult.data && rawResult.source !== 'none' && rawResult.source !== 'edge') {
        rawFixtures = rawResult.data;
        source = rawResult.source === 'kv' ? 'KV' : 'R2';
        console.log(`✅ [Fixtures] ${source} hit for ${requestedDate}`);
      }

      // 3. For non-UTC timezones, we may need adjacent dates
      const needsAdjacentDates = timezone !== 'UTC' && !rawFixtures;
      let allFixtures: Fixture[] = [];

      if (needsAdjacentDates || !rawFixtures) {
        // Determine which dates to fetch
        let datesToFetch: string[] = [requestedDate];

        if (timezone !== 'UTC') {
          const currentHour = getCurrentHourInTimezone(timezone);
          const strategy = getDatesToFetch(requestedDate, timezone, currentHour);
          datesToFetch = strategy.datesToFetch;
          console.log(`🌍 [Fixtures] ${strategy.reason}`);
        }

        console.log(`🗓️ [Fixtures] Fetching dates: ${datesToFetch.join(', ')}`);

        // Fetch all dates
        const fetchResults = await Promise.all(
          datesToFetch.map((fetchDate) =>
            this.fetchDateFixtures({ date: fetchDate, env, ctx })
          )
        );

        // Combine results
        allFixtures = fetchResults.flatMap((result) => result.fixtures);
        source = fetchResults.some((fetchResult) => fetchResult.source === 'API') ? 'API' : source;

        console.log(`📊 [Fixtures] Total fixtures: ${allFixtures.length}`);
      } else {
        allFixtures = rawFixtures;
      }

      // 4. Save original count before filtering
      const originalMatchCount = allFixtures.length;

      // 5. Apply timezone filtering
      if (timezone !== 'UTC') {
        console.log(`🌐 [Fixtures] Filtering for timezone ${timezone}`);
        allFixtures = filterFixturesByTimezone(allFixtures, requestedDate, timezone);
      }

      // 6. Transform to grouped structure
      const formattedData = formatFixtures(allFixtures, timezone);

      // 7. Cache the transformed response in Edge Cache (non-blocking)
      ctx.waitUntil(
        cacheSetEdgeOnly('fixtures', edgeCacheParams, formattedData).catch((err) =>
          console.error(`❌ [Fixtures] Failed to cache in Edge:`, err)
        )
      );

      return {
        data: formattedData,
        source,
        originalMatchCount,
      };
    });
  },

  /**
   * Get live fixtures
   */
  async getLiveFixtures({
    timezone,
    env,
    ctx,
  }: {
    timezone: string;
    env: FixturesEnv;
    ctx: ExecutionContext;
  }): Promise<FixturesServiceResult> {
    const dateInfo = getUtcDateInfo(normalizeToUtcDate());
    const today = dateInfo.utcToday;

    console.log(`🔴 [Fixtures] Live request, timezone=${timezone}`);

    // Generate cache key for deduplication
    const dedupKey = getCacheKey('fixtures', { date: today, timezone, live: 'true' });

    return withDeduplication(dedupKey, async () => {
      // 1. Check Edge Cache
      const edgeCacheParams = { date: today, timezone, live: 'true' };
      const edgeResult = await cacheGet<FormattedFixturesResponse>(
        env,
        'fixtures',
        edgeCacheParams
      );

      if (edgeResult.source === 'edge' && edgeResult.data) {
        console.log(`✅ [Fixtures] Edge Cache hit for live:${timezone}`);
        return {
          data: edgeResult.data,
          source: 'Edge Cache',
          originalMatchCount: this.countOriginalMatches(edgeResult.data),
        };
      }

      // 2. Check KV/R2 for raw live data
      let rawFixtures: Fixture[] | null = null;
      let source = 'API';

      const rawParams = { date: today, live: 'true' };
      const rawResult = await cacheGet<Fixture[]>(env, 'fixtures', rawParams);

      if (rawResult.data && rawResult.source !== 'none' && rawResult.source !== 'edge') {
        rawFixtures = rawResult.data;
        source = rawResult.source === 'kv' ? 'KV' : 'R2';

        // Check if data is stale
        if (!isStale(rawResult.meta, 'fixtures', rawParams)) {
          console.log(`✅ [Fixtures] ${source} hit for live`);
        } else {
          console.log(`⏳ [Fixtures] ${source} data is stale, fetching fresh`);
          rawFixtures = null;
        }
      }

      // 3. Fetch from API if needed
      if (!rawFixtures) {
        console.log(`🌐 [Fixtures] Fetching live from API`);
        const response = await getFootballApiFixtures(
          today,
          'live',
          env.FOOTBALL_API_URL,
          env.RAPIDAPI_KEY
        );
        rawFixtures = response.response;
        source = 'API';

        // Cache raw data (non-blocking)
        ctx.waitUntil(
          cacheSet(env, 'fixtures', rawParams, rawFixtures).catch((err) =>
            console.error(`❌ [Fixtures] Failed to cache live data:`, err)
          )
        );
      }

      // 4. Save original count
      const originalMatchCount = rawFixtures.length;

      // 5. Apply timezone filtering
      let filteredFixtures = rawFixtures;
      if (timezone !== 'UTC') {
        filteredFixtures = filterFixturesByTimezone(rawFixtures, today, timezone);
      }

      // 6. Transform
      const formattedData = formatFixtures(filteredFixtures, timezone);

      // 7. Cache in Edge (non-blocking)
      ctx.waitUntil(
        cacheSetEdgeOnly('fixtures', edgeCacheParams, formattedData).catch((err) =>
          console.error(`❌ [Fixtures] Failed to cache live in Edge:`, err)
        )
      );

      return {
        data: formattedData,
        source,
        originalMatchCount,
      };
    });
  },

  /**
   * Fetch fixtures for a single date (from cache or API)
   */
  async fetchDateFixtures({
    date,
    env,
    ctx,
  }: {
    date: string;
    env: FixturesEnv;
    ctx: ExecutionContext;
  }): Promise<{ fixtures: Fixture[]; source: string }> {
    const params = { date, live: 'false' };

    // Check cache first (KV/R2 for raw UTC data)
    const cacheResult = await cacheGet<Fixture[]>(env, 'fixtures', params);

    if (cacheResult.data && cacheResult.source !== 'none' && cacheResult.source !== 'edge') {
      // Check if stale
      if (!isStale(cacheResult.meta, 'fixtures', params)) {
        return {
          fixtures: cacheResult.data,
          source: cacheResult.source === 'kv' ? 'KV' : 'R2',
        };
      }
      console.log(`⏳ [Fixtures] Cache data for ${date} is stale`);
    }

    // Fetch from API
    console.log(`🌐 [Fixtures] Fetching ${date} from API`);
    const response = await getFootballApiFixtures(
      date,
      undefined,
      env.FOOTBALL_API_URL,
      env.RAPIDAPI_KEY
    );

    // Cache raw data (non-blocking)
    ctx.waitUntil(
      cacheSet(env, 'fixtures', params, response.response).catch((err) =>
        console.error(`❌ [Fixtures] Failed to cache ${date}:`, err)
      )
    );

    return {
      fixtures: response.response,
      source: 'API',
    };
  },

  /**
   * Count matches in formatted response
   */
  countOriginalMatches(data: FormattedFixturesResponse): number {
    let count = 0;
    data.forEach((country) => {
      country.leagues.forEach((league) => {
        count += league.matches.length;
      });
    });
    return count;
  },
};

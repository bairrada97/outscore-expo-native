import type { Fixture, FixturesResponse, FormattedFixturesResponse } from '@outscore/shared-types';
import { getFootballApiFixtureDetail, getFootballApiFixtures } from '../../pkg/util/football-api';
import {
  type CacheEnv,
  type CacheResult,
  cacheGet,
  cacheSet,
  cacheSetEdgeOnly,
  checkFixturesDateTransition,
  createR2CacheProvider,
  getCacheKey,
  getCurrentUtcDate,
  getTomorrowUtcDate,
  getYesterdayUtcDate,
  isStale,
  LIVE_STATUSES,
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

export interface FixtureDetailServiceResult {
  data: FixturesResponse;
  source: string;
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

      // 2. Determine which dates to fetch based on timezone
      // Non-UTC timezones may need adjacent dates to show all fixtures for the local date
      let datesToFetch: string[] = [requestedDate];
      let source = 'KV';

      if (timezone !== 'UTC') {
        const currentHour = getCurrentHourInTimezone(timezone);
        const strategy = getDatesToFetch(requestedDate, timezone, currentHour);
        datesToFetch = strategy.datesToFetch;
        console.log(`🌍 [Fixtures] ${strategy.reason}`);
      }

      console.log(`🗓️ [Fixtures] Fetching dates: ${datesToFetch.join(', ')}`);

      // 3. Fetch all required dates (will use cache when available)
      const fetchResults = await Promise.all(
        datesToFetch.map((fetchDate) =>
          this.fetchDateFixtures({ date: fetchDate, env, ctx })
        )
      );

      // Combine results
      let allFixtures = fetchResults.flatMap((result) => result.fixtures);
      source = fetchResults.some((r) => r.source === 'API')
        ? 'API'
        : fetchResults.some((r) => r.source === 'Stale Cache')
          ? 'Stale Cache'
          : fetchResults[0]?.source ?? 'KV';

      console.log(`📊 [Fixtures] Total fixtures: ${allFixtures.length}`)

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
      let staleFixtures: Fixture[] | null = null;
      let source = 'API';

      const rawParams = { date: today, live: 'true' };
      const rawResult = await cacheGet<Fixture[]>(env, 'fixtures', rawParams);

      if (rawResult.data && rawResult.source !== 'none' && rawResult.source !== 'edge') {
        const cachedSource = rawResult.source === 'kv' ? 'KV' : 'R2';

        // For R2 (cold storage), use a longer staleness window
        const isR2 = rawResult.source === 'r2';
        const staleCheckParams = isR2 ? { ...rawParams, _r2Staleness: 'true' } : rawParams;

        // Check if data is stale
        if (!isStale(rawResult.meta, 'fixtures', staleCheckParams)) {
          rawFixtures = rawResult.data;
          source = cachedSource;
          console.log(`✅ [Fixtures] ${source} hit for live`);
        } else {
          // Keep stale data as fallback
          staleFixtures = rawResult.data;
          console.log(`⏳ [Fixtures] ${cachedSource} data is stale, fetching fresh`);
        }
      }

      // 3. Fetch from API if needed
      if (!rawFixtures) {
        console.log(`🌐 [Fixtures] Fetching live from API`);
        try {
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
        } catch (error) {
          console.error(`❌ [Fixtures] API fetch failed for live:`, error);

          // Fall back to stale data if available
          if (staleFixtures) {
            console.log(`⚠️ [Fixtures] Using stale data as fallback for live`);
            rawFixtures = staleFixtures;
            source = 'Stale Cache';
          } else {
            throw error;
          }
        }
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
    // Explicitly set timezone to UTC for raw data storage/retrieval
    const params = { date, live: 'false', timezone: 'UTC' };

    console.log(`🔍 [Fixtures] Checking cache for date: ${date} (params: ${JSON.stringify(params)})`);

    // Check cache first (KV/R2 for raw UTC data)
    const cacheResult = await cacheGet<Fixture[]>(env, 'fixtures', params);
    let staleFixtures: Fixture[] | null = null;

    if (cacheResult.data && cacheResult.source !== 'none' && cacheResult.source !== 'edge') {
      const isR2 = cacheResult.source === 'r2';
      const staleCheckParams = isR2 ? { ...params, _r2Staleness: 'true' } : params;
      
      // For R2 on hot dates (today/yesterday/tomorrow), check actual age
      // Scheduler refreshes every 15s, so R2 should be fresh
      // If older than 2 minutes, scheduler likely failed - fetch from API
      if (isR2 && cacheResult.meta) {
        const updatedAt = new Date(cacheResult.meta.updatedAt).getTime();
        const now = Date.now();
        const ageSeconds = (now - updatedAt) / 1000;
        
        // Check if it's a hot date (today/yesterday/tomorrow)
        const today = getCurrentUtcDate();
        const yesterday = getYesterdayUtcDate();
        const tomorrow = getTomorrowUtcDate();
        const isHotDate = date === today || date === yesterday || date === tomorrow;
        
        // For hot dates, R2 should be fresh (within 2 minutes max)
        // If older, scheduler likely failed - fetch fresh from API
        if (isHotDate && ageSeconds > 120) {
          console.log(`⏳ [Fixtures] R2 data for ${date} is too old (${ageSeconds.toFixed(0)}s), fetching fresh from API`);
          staleFixtures = cacheResult.data; // Keep as fallback if API fails
        } else if (!isStale(cacheResult.meta, 'fixtures', staleCheckParams)) {
          console.log(`✅ [Fixtures] Cache hit from ${cacheResult.source} for ${date} (age: ${ageSeconds.toFixed(0)}s)`);
          return {
            fixtures: cacheResult.data,
            source: cacheResult.source === 'kv' ? 'KV' : 'R2',
          };
        } else {
          // Stale but acceptable for non-hot dates
          staleFixtures = cacheResult.data;
          console.log(`⏳ [Fixtures] R2 data for ${date} is stale (age: ${ageSeconds.toFixed(0)}s), keeping as fallback`);
        }
      } else if (!isStale(cacheResult.meta, 'fixtures', staleCheckParams)) {
        // Non-R2 cache (KV)
        console.log(`✅ [Fixtures] Cache hit from ${cacheResult.source} for ${date}`);
        return {
          fixtures: cacheResult.data,
          source: cacheResult.source === 'kv' ? 'KV' : 'R2',
        };
      } else {
        staleFixtures = cacheResult.data;
        console.log(`⏳ [Fixtures] Cache data for ${date} is stale`);
      }
    }

    // Fetch from API
    console.log(`🌐 [Fixtures] Fetching ${date} from API`);
    try {
      const response = await getFootballApiFixtures(
        date,
        undefined,
        env.FOOTBALL_API_URL,
        env.RAPIDAPI_KEY
      );

      // Cache raw data (non-blocking but ensure it completes)
      // Note: Using waitUntil means it won't block the response, but cache should be set
      ctx.waitUntil(
        cacheSet(env, 'fixtures', params, response.response)
          .then((success) => {
            if (success) {
              console.log(`✅ [Fixtures] Successfully cached ${date} in all layers`);
            } else {
              console.warn(`⚠️ [Fixtures] Some cache layers failed for ${date}`);
            }
          })
          .catch((err) => {
            console.error(`❌ [Fixtures] Failed to cache ${date}:`, err);
          })
      );

      return {
        fixtures: response.response,
        source: 'API',
      };
    } catch (error) {
      console.error(`❌ [Fixtures] API fetch failed for ${date}:`, error);

      // Fall back to stale data if available
      if (staleFixtures) {
        console.log(`⚠️ [Fixtures] Using stale data as fallback for ${date}`);
        return {
          fixtures: staleFixtures,
          source: 'Stale Cache',
        };
      }

      throw error;
    }
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

  /**
   * Get fixture detail by ID
   * Caching strategy:
   * - LIVE: 15s TTL
   * - FINISHED: Indefinite (7 days, cleanup handles removal)
   * - NOT_STARTED: Dynamic based on time until match
   */
  async getFixtureDetail({
    fixtureId,
    env,
    ctx,
  }: {
    fixtureId: number;
    env: FixturesEnv;
    ctx: ExecutionContext;
  }): Promise<FixtureDetailServiceResult> {
    console.log(`🔍 [FixtureDetail] Request: fixtureId=${fixtureId}`);

    // Generate cache key for deduplication
    const dedupKey = getCacheKey('fixtureDetail', { fixtureId: fixtureId.toString() });

    return withDeduplication(dedupKey, async () => {
      const params = { fixtureId: fixtureId.toString() };

      // Hybrid lookup strategy:
      // Step 1 - Fast Path: Try common dates (today, yesterday, tomorrow) first
      // This covers 80-90% of requests with minimal overhead
      const today = getCurrentUtcDate();
      const yesterday = getYesterdayUtcDate();
      const tomorrow = getTomorrowUtcDate();
      const commonDates = [today, yesterday, tomorrow];

      let edgeResult: CacheResult<FixturesResponse> = { data: null, source: 'none' };
      
      // Fast path: Try common dates first
      for (const date of commonDates) {
        const paramsWithDate = { ...params, date };
        const result = await cacheGet<FixturesResponse>(env, 'fixtureDetail', paramsWithDate);
        if (result.data) {
          edgeResult = result;
          break; // Found cached data, stop searching
        }
      }

      // Step 2 - Slow Path: If not found in common dates, use delimiter to list all date folders
      // This handles edge cases (historical/future fixtures) efficiently
      if (!edgeResult.data) {
        try {
          const r2Provider = createR2CacheProvider(env.FOOTBALL_CACHE);
          const dateFolders = await r2Provider.listFolders('fixture-details/');
          
          // Extract dates from folder names (e.g., "fixture-details/2025-01-15/" -> "2025-01-15")
          const datesToTry = dateFolders
            .map(folder => folder.match(/fixture-details\/(\d{4}-\d{2}-\d{2})\//)?.[1])
            .filter((date): date is string => Boolean(date))
            .sort()
            .reverse(); // Most recent first for better cache hit probability
          
          // Try each date until we find a cache hit
          for (const date of datesToTry) {
            // Skip dates we already tried in fast path
            if (commonDates.includes(date)) continue;
            
            const paramsWithDate = { ...params, date };
            const result = await cacheGet<FixturesResponse>(env, 'fixtureDetail', paramsWithDate);
            if (result.data) {
              edgeResult = result;
              break; // Found cached data, stop searching
            }
          }
        } catch (error) {
          console.error(`❌ [FixtureDetail] Error listing date folders for fixture ${fixtureId}:`, error);
          // Continue to API fetch if folder listing fails
        }
      }

      if (edgeResult.source === 'edge' && edgeResult.data) {
        console.log(`✅ [FixtureDetail] Edge Cache hit for fixture ${fixtureId}`);
        return {
          data: edgeResult.data,
          source: 'Edge Cache',
        };
      }

      // 2. Check R2 for cached response
      let staleData: FixturesResponse | null = null;
      
      if (edgeResult.data && edgeResult.source === 'r2') {
        // Extract status from cached data to determine if it's LIVE
        const cachedFixture = edgeResult.data.response?.[0];
        const cachedStatus = cachedFixture?.fixture?.status?.short;
        const isLiveMatch = cachedStatus && LIVE_STATUSES.includes(cachedStatus);
        
        if (isLiveMatch) {
          // For LIVE matches, skip R2 - we need fresh data from API
          // Keep R2 data only as fallback if API fails
          staleData = edgeResult.data;
          console.log(`⏳ [FixtureDetail] R2 has LIVE match data for ${fixtureId}, fetching fresh from API`);
        } else {
          // For non-LIVE matches, check if R2 data is stale
          // Extract timestamp from cached data for proper TTL calculation
          const cachedTimestamp = cachedFixture?.fixture?.timestamp?.toString();
          const staleCheckParams = {
            ...params,
            status: cachedStatus || '',
            timestamp: cachedTimestamp || '',
          };
          
          if (!isStale(edgeResult.meta, 'fixtureDetail', staleCheckParams)) {
            console.log(`✅ [FixtureDetail] R2 Cache hit for fixture ${fixtureId}`);
            return {
              data: edgeResult.data,
              source: 'R2',
            };
          }
          // Keep stale data as fallback
          staleData = edgeResult.data;
          console.log(`⏳ [FixtureDetail] R2 data is stale for fixture ${fixtureId}`);
        }
      }

      // 3. Fetch from API
      console.log(`🌐 [FixtureDetail] Fetching fixture ${fixtureId} from API`);
      try {
        const response = await getFootballApiFixtureDetail(
          fixtureId,
          env.FOOTBALL_API_URL,
          env.RAPIDAPI_KEY
        );

        // Extract status and timestamp for TTL calculation
        const fixture = response.response[0];
        const status = fixture?.fixture?.status?.short || '';
        const timestamp = fixture?.fixture?.timestamp?.toString() || '';
        
        // Extract date from fixture (UTC date in YYYY-MM-DD format)
        let fixtureDate: string;
        if (fixture?.fixture?.date) {
          // Parse ISO date string and extract UTC date (YYYY-MM-DD)
          const dateObj = new Date(fixture.fixture.date);
          const year = dateObj.getUTCFullYear();
          const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
          const day = String(dateObj.getUTCDate()).padStart(2, '0');
          fixtureDate = `${year}-${month}-${day}`;
        } else {
          // Fallback: use current UTC date if date is missing
          const now = new Date();
          const utcNow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
          fixtureDate = utcNow.toISOString().split('T')[0];
        }

        // Cache response (non-blocking)
        ctx.waitUntil(
          cacheSet(env, 'fixtureDetail', { ...params, date: fixtureDate, status, timestamp }, response)
            .then((success) => {
              if (success) {
                console.log(`✅ [FixtureDetail] Successfully cached fixture ${fixtureId}`);
              } else {
                console.warn(`⚠️ [FixtureDetail] Some cache layers failed for fixture ${fixtureId}`);
              }
            })
            .catch((err) => {
              console.error(`❌ [FixtureDetail] Failed to cache fixture ${fixtureId}:`, err);
            })
        );

        return {
          data: response,
          source: 'API',
        };
      } catch (error) {
        console.error(`❌ [FixtureDetail] API fetch failed for fixture ${fixtureId}:`, error);

        // Fall back to stale data if available
        if (staleData) {
          console.log(`⚠️ [FixtureDetail] Using stale data as fallback for fixture ${fixtureId}`);
          return {
            data: staleData,
            source: 'Stale Cache',
          };
        }

        throw error;
      }
    });
  },
};

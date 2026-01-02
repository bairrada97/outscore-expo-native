import { getFootballApiFixtures } from '../../pkg/util/football-api';
import {
  type CacheEnv,
  cacheSet,
  cacheSetEdgeOnly,
  checkFixturesDateTransition,
  getCurrentUtcDate,
  getTomorrowUtcDate,
} from '../cache';
import { filterFixturesByTimezone, formatFixtures } from '../fixtures';
import { commonTimezones } from '../timezones';

export interface SchedulerEnv extends CacheEnv {
  FOOTBALL_API_URL: string;
  RAPIDAPI_KEY: string;
}

/**
 * Refresh today's fixtures data in all cache layers
 * Called by Cloudflare Cron Triggers every 15 seconds
 */
export const refreshTodayFixtures = async (env: SchedulerEnv): Promise<void> => {
  const startTime = performance.now();
  const today = getCurrentUtcDate();

  console.log(`🔄 [Scheduler] Starting refresh for ${today}`);

  try {
    // 1. Check for date transition
    await checkFixturesDateTransition(env);

    // 2. Fetch fresh data from API
    console.log(`🌐 [Scheduler] Fetching fixtures for ${today} from API`);
    const response = await getFootballApiFixtures(
      today,
      undefined,
      env.FOOTBALL_API_URL,
      env.RAPIDAPI_KEY
    );

    const fixtures = response.response;
    console.log(`✅ [Scheduler] Received ${fixtures.length} fixtures`);

    // 3. Store raw UTC data in KV + R2
    await cacheSet(env, 'fixtures', { date: today, live: 'false' }, fixtures);

    // 4. Pre-generate transformed responses for common timezones
    // This warms the Edge Cache for popular timezones
    const transformPromises = commonTimezones.map(async (timezone) => {
      try {
        const filtered = filterFixturesByTimezone(fixtures, today, timezone);
        const formatted = formatFixtures(filtered, timezone);
        await cacheSetEdgeOnly('fixtures', { date: today, timezone, live: 'false' }, formatted);
        console.log(`✅ [Scheduler] Cached Edge response for ${timezone}`);
      } catch (err) {
        console.error(`❌ [Scheduler] Failed to cache for ${timezone}:`, err);
      }
    });

    await Promise.all(transformPromises);

    const duration = (performance.now() - startTime).toFixed(2);
    console.log(`✅ [Scheduler] Refresh completed in ${duration}ms`);
  } catch (error) {
    console.error(`❌ [Scheduler] Refresh failed:`, error);
    throw error;
  }
};

/**
 * Refresh live fixtures data
 * Called more frequently for live match updates
 */
export const refreshLiveFixtures = async (env: SchedulerEnv): Promise<void> => {
  const startTime = performance.now();
  const today = getCurrentUtcDate();

  console.log(`🔴 [Scheduler] Starting live refresh`);

  try {
    // 1. Fetch live fixtures from API
    console.log(`🌐 [Scheduler] Fetching live fixtures from API`);
    const response = await getFootballApiFixtures(
      today,
      'live',
      env.FOOTBALL_API_URL,
      env.RAPIDAPI_KEY
    );

    const fixtures = response.response;
    console.log(`✅ [Scheduler] Received ${fixtures.length} live fixtures`);

    // 2. Store raw UTC live data
    await cacheSet(env, 'fixtures', { date: today, live: 'true' }, fixtures);

    // 3. Pre-generate transformed responses for common timezones
    const transformPromises = commonTimezones.map(async (timezone) => {
      try {
        const filtered = filterFixturesByTimezone(fixtures, today, timezone);
        const formatted = formatFixtures(filtered, timezone);
        await cacheSetEdgeOnly('fixtures', { date: today, timezone, live: 'true' }, formatted);
      } catch (err) {
        console.error(`❌ [Scheduler] Failed to cache live for ${timezone}:`, err);
      }
    });

    await Promise.all(transformPromises);

    const duration = (performance.now() - startTime).toFixed(2);
    console.log(`✅ [Scheduler] Live refresh completed in ${duration}ms`);
  } catch (error) {
    console.error(`❌ [Scheduler] Live refresh failed:`, error);
    throw error;
  }
};

/**
 * Pre-fetch tomorrow's fixtures
 * Called once daily to warm the cache
 */
export const prefetchTomorrowFixtures = async (env: SchedulerEnv): Promise<void> => {
  const tomorrowStr = getTomorrowUtcDate();

  console.log(`📅 [Scheduler] Pre-fetching fixtures for tomorrow (${tomorrowStr})`);

  try {
    const response = await getFootballApiFixtures(
      tomorrowStr,
      undefined,
      env.FOOTBALL_API_URL,
      env.RAPIDAPI_KEY
    );

    const fixtures = response.response;
    console.log(`✅ [Scheduler] Received ${fixtures.length} fixtures for tomorrow`);

    // Store in R2 (cold storage for future dates)
    await cacheSet(env, 'fixtures', { date: tomorrowStr, live: 'false' }, fixtures);

    console.log(`✅ [Scheduler] Pre-fetch for tomorrow completed`);
  } catch (error) {
    console.error(`❌ [Scheduler] Pre-fetch for tomorrow failed:`, error);
  }
};

/**
 * Scheduled event handler for Cloudflare Workers
 */
export const handleScheduledEvent = async (
  event: ScheduledEvent,
  env: SchedulerEnv
): Promise<void> => {
  console.log(`⚡ [Scheduler] Triggered at ${new Date(event.scheduledTime).toISOString()}`);

  // Only refresh regular fixtures - live fixtures are fetched on-demand
  await refreshTodayFixtures(env);
};

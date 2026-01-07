import { getFootballApiFixtures } from '../../pkg/util/football-api';
import {
  type CacheEnv,
  cacheSet,
  cacheSetEdgeOnly,
  checkFixturesDateTransition,
  cleanupOldCacheData,
  cleanupOldFixtureDetails,
  getCurrentUtcDate,
  getTomorrowUtcDate,
} from '../cache';
import { filterFixturesByTimezone, formatFixtures } from '../fixtures';
import { commonTimezones } from '../timezones';

export interface SchedulerEnv extends CacheEnv {
  FOOTBALL_API_URL: string;
  RAPIDAPI_KEY: string;
  REFRESH_SCHEDULER_DO?: DurableObjectNamespace;
}

/**
 * Refresh today's fixtures data in all cache layers
 * Called by Durable Object alarm every 15 seconds
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
 * Acts as a failsafe to ensure the DO alarm chain is running
 */
export const handleScheduledEvent = async (
  event: ScheduledEvent,
  env: SchedulerEnv
): Promise<void> => {
  const scheduledTime = new Date(event.scheduledTime);
  console.log(`⚡ [Scheduler] Cron triggered at ${scheduledTime.toISOString()}`);

  // Run cleanup once per day at 2 AM UTC
  const hour = scheduledTime.getUTCHours();
  const minute = scheduledTime.getUTCMinutes();
  if (hour === 2 && minute < 5) {
    console.log(`🧹 [Scheduler] Running daily cleanup`);
    
    // Clean up old fixtures cache data (30 days historical, 14 days future)
    try {
      const fixturesResult = await cleanupOldCacheData(env, 30, 14);
      console.log(`✅ [Scheduler] Fixtures cleanup completed: deleted ${fixturesResult.deleted} files, ${fixturesResult.errors} errors`);
    } catch (error) {
      console.error(`❌ [Scheduler] Fixtures cleanup failed:`, error);
    }

    // Clean up old fixture details (7 days retention)
    try {
      const detailsResult = await cleanupOldFixtureDetails(env, 7);
      console.log(`✅ [Scheduler] Fixture details cleanup completed: deleted ${detailsResult.deleted} files, ${detailsResult.errors} errors`);
    } catch (error) {
      console.error(`❌ [Scheduler] Fixture details cleanup failed:`, error);
    }
  }

  if (!env.REFRESH_SCHEDULER_DO) {
    // Fallback: if DO not configured, refresh directly
    console.log(`⚠️ [Scheduler] REFRESH_SCHEDULER_DO not configured, refreshing directly`);
    await refreshTodayFixtures(env);
    return;
  }

  // Ensure the DO alarm chain is running (it handles 15-second refreshes)
  const id = env.REFRESH_SCHEDULER_DO.idFromName('default');
  const stub = env.REFRESH_SCHEDULER_DO.get(id);

  try {
    const response = await stub.fetch(new Request('https://do/ensure', { method: 'POST' }));
    const result = await response.json() as { started: boolean; nextAlarm: number };

    if (result.started) {
      console.log(`🚀 [Scheduler] Started DO alarm chain`);
    } else {
      console.log(`✅ [Scheduler] DO alarm chain already running, next alarm at ${new Date(result.nextAlarm).toISOString()}`);
    }
  } catch (error) {
    console.error(`❌ [Scheduler] Failed to ensure DO alarm chain:`, error);
    // Fallback: refresh directly on error
    await refreshTodayFixtures(env);
  }
};

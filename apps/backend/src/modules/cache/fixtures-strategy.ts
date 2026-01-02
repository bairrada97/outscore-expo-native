import { addDays, format, parseISO } from 'date-fns';
import { commonTimezones } from '../timezones';
import {
  getCurrentUtcDate,
  getTomorrowUtcDate,
  getYesterdayUtcDate,
  isHotDate,
} from './cache-strategies';
import { invalidateEdgeCacheForDate } from './edge-cache';
import { deleteKVEntriesForDate } from './kv-provider';
import type { R2CacheProvider } from './provider.interface';
import { cleanupR2Duplicates, createR2CacheProvider } from './r2-provider';
import { CacheLocation } from './types';

export interface FixturesCacheEnv {
  FOOTBALL_KV: KVNamespace;
  FOOTBALL_CACHE: R2Bucket;
}

/**
 * KV key for tracking date transitions
 */
const DATE_TRANSITION_KEY = 'fixtures:date-transition:current-utc-date';

/**
 * Get cache location for fixtures based on date
 */
export const getFixturesCacheLocation = (date: string): CacheLocation => {
  const today = getCurrentUtcDate();

  if (date === today) {
    return CacheLocation.TODAY;
  }

  if (date < today) {
    return CacheLocation.HISTORICAL;
  }

  return CacheLocation.FUTURE;
};

/**
 * Generate R2 key for fixtures (with folder structure)
 */
export const getFixturesR2Key = (
  location: CacheLocation | string,
  date: string,
  live: boolean
): string => {
  const suffix = live ? '-live' : '';
  return `${location}/fixtures-${date}${suffix}.json`;
};

/**
 * Move fixtures data to historical folder
 */
const moveToHistorical = async (
  r2Provider: R2CacheProvider,
  date: string
): Promise<void> => {
  const sourceKey = getFixturesR2Key('today', date, false);
  const destKey = getFixturesR2Key('historical', date, false);

  if (await r2Provider.exists(sourceKey)) {
    console.log(`📦 [R2] Moving ${date} from today to historical`);
    await r2Provider.move(sourceKey, destKey);
  }

  // Also move live data
  const sourceLiveKey = getFixturesR2Key('today', date, true);
  const destLiveKey = getFixturesR2Key('historical', date, true);

  if (await r2Provider.exists(sourceLiveKey)) {
    console.log(`📦 [R2] Moving ${date} live data from today to historical`);
    await r2Provider.move(sourceLiveKey, destLiveKey);
  }
};

/**
 * Move fixtures data from future to today folder
 */
const moveFromFuture = async (
  r2Provider: R2CacheProvider,
  date: string
): Promise<void> => {
  const sourceKey = getFixturesR2Key('future', date, false);
  const destKey = getFixturesR2Key('today', date, false);

  if (await r2Provider.exists(sourceKey)) {
    // Check if destination already exists (duplicate)
    if (await r2Provider.exists(destKey)) {
      console.log(
        `⚠️ [R2] Duplicate found: ${date} exists in both future and today. Keeping today, deleting future.`
      );
      await r2Provider.delete(sourceKey);
    } else {
      console.log(`📦 [R2] Moving ${date} from future to today`);
      await r2Provider.move(sourceKey, destKey);
    }
  }
};

/**
 * Ensure date is in future folder (not today)
 */
const ensureInFuture = async (
  r2Provider: R2CacheProvider,
  date: string
): Promise<void> => {
  const todayKey = getFixturesR2Key('today', date, false);
  const futureKey = getFixturesR2Key('future', date, false);

  if (await r2Provider.exists(todayKey)) {
    console.log(`⚠️ [R2] Found ${date} in today folder (should be future). Moving...`);
    await r2Provider.move(todayKey, futureKey);
  }
};

/**
 * Handle date transition - move fixtures files between folders
 * Each step is wrapped in try-catch to ensure all steps are attempted
 * even if some fail, preventing inconsistent state
 */
export const handleFixturesDateTransition = async (
  env: FixturesCacheEnv,
  oldDate: string,
  newDate: string
): Promise<void> => {
  console.log(`🔄 [Fixtures] Handling date transition from ${oldDate} to ${newDate}`);

  const r2Provider = createR2CacheProvider(env.FOOTBALL_CACHE);
  // Parse newDate and calculate tomorrow using date-fns (handles month/year boundaries correctly)
  const date = parseISO(newDate);
  const tomorrow = format(addDays(date, 1), 'yyyy-MM-dd');

  const errors: Array<{ step: string; error: unknown }> = [];

  // 1. Move old "today" to "historical"
  try {
    await moveToHistorical(r2Provider, oldDate);
  } catch (error) {
    console.error(`❌ [Fixtures] Failed to move ${oldDate} to historical:`, error);
    errors.push({ step: 'moveToHistorical', error });
  }

  // 2. Move "future" today to "today"
  try {
    await moveFromFuture(r2Provider, newDate);
  } catch (error) {
    console.error(`❌ [Fixtures] Failed to move ${newDate} from future:`, error);
    errors.push({ step: 'moveFromFuture', error });
  }

  // 3. Ensure tomorrow is in "future" folder
  try {
    await ensureInFuture(r2Provider, tomorrow);
  } catch (error) {
    console.error(`❌ [Fixtures] Failed to ensure ${tomorrow} is in future:`, error);
    errors.push({ step: 'ensureInFuture', error });
  }

  // 4. Clean up any duplicates
  try {
    await cleanupR2Duplicates(env.FOOTBALL_CACHE, oldDate, 'historical');
  } catch (error) {
    console.error(`❌ [Fixtures] Failed to cleanup duplicates for ${oldDate}:`, error);
    errors.push({ step: 'cleanupR2Duplicates-oldDate', error });
  }

  try {
    await cleanupR2Duplicates(env.FOOTBALL_CACHE, newDate, 'today');
  } catch (error) {
    console.error(`❌ [Fixtures] Failed to cleanup duplicates for ${newDate}:`, error);
    errors.push({ step: 'cleanupR2Duplicates-newDate', error });
  }

  try {
    await cleanupR2Duplicates(env.FOOTBALL_CACHE, tomorrow, 'future');
  } catch (error) {
    console.error(`❌ [Fixtures] Failed to cleanup duplicates for ${tomorrow}:`, error);
    errors.push({ step: 'cleanupR2Duplicates-tomorrow', error });
  }

  // 5. Clean up KV entries for old date
  try {
    await deleteKVEntriesForDate(env.FOOTBALL_KV, oldDate);
  } catch (error) {
    console.error(`❌ [Fixtures] Failed to delete KV entries for ${oldDate}:`, error);
    errors.push({ step: 'deleteKVEntriesForDate', error });
  }

  // 6. Invalidate Edge Cache for transitioning dates
  try {
    await invalidateEdgeCacheForDate(oldDate, commonTimezones);
  } catch (error) {
    console.error(`❌ [Fixtures] Failed to invalidate edge cache for ${oldDate}:`, error);
    errors.push({ step: 'invalidateEdgeCacheForDate-oldDate', error });
  }

  try {
    await invalidateEdgeCacheForDate(newDate, commonTimezones);
  } catch (error) {
    console.error(`❌ [Fixtures] Failed to invalidate edge cache for ${newDate}:`, error);
    errors.push({ step: 'invalidateEdgeCacheForDate-newDate', error });
  }

  if (errors.length > 0) {
    console.warn(`⚠️ [Fixtures] Date transition completed with ${errors.length} error(s)`);
  } else {
    console.log(`✅ [Fixtures] Date transition completed successfully`);
  }
};

/**
 * Check and handle fixtures date transition using KV-backed state
 */
export const checkFixturesDateTransition = async (
  env: FixturesCacheEnv
): Promise<boolean> => {
  const newDate = getCurrentUtcDate();
  const storedDate = await env.FOOTBALL_KV.get(DATE_TRANSITION_KEY);

  if (storedDate === null) {
    await env.FOOTBALL_KV.put(DATE_TRANSITION_KEY, newDate);
    return false;
  }

  if (storedDate !== newDate) {
    await env.FOOTBALL_KV.put(DATE_TRANSITION_KEY, newDate);
    await handleFixturesDateTransition(env, storedDate, newDate);
    return true;
  }

  return false;
};

// Re-export helpers from cache-strategies for backwards compatibility
export { getCurrentUtcDate, getTomorrowUtcDate, getYesterdayUtcDate, isHotDate };


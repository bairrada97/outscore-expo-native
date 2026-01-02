import { format } from 'date-fns';
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
import type { CacheLocation } from './types';

export interface FixturesCacheEnv {
  FOOTBALL_KV: KVNamespace;
  FOOTBALL_CACHE: R2Bucket;
}

/**
 * Current UTC date tracking for date transitions
 */
let currentUtcDate: string | null = null;

/**
 * Get cache location for fixtures based on date
 */
export const getFixturesCacheLocation = (date: string): CacheLocation => {
  const today = getCurrentUtcDate();

  if (date === today) {
    return 'today' as CacheLocation;
  }

  if (date < today) {
    return 'historical' as CacheLocation;
  }

  return 'future' as CacheLocation;
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
 */
export const handleFixturesDateTransition = async (
  env: FixturesCacheEnv,
  oldDate: string,
  newDate: string
): Promise<void> => {
  console.log(`🔄 [Fixtures] Handling date transition from ${oldDate} to ${newDate}`);

  const r2Provider = createR2CacheProvider(env.FOOTBALL_CACHE);
  const tomorrow = format(new Date(new Date(newDate).getTime() + 86400000), 'yyyy-MM-dd');

  // 1. Move old "today" to "historical"
  await moveToHistorical(r2Provider, oldDate);

  // 2. Move "future" today to "today"
  await moveFromFuture(r2Provider, newDate);

  // 3. Ensure tomorrow is in "future" folder
  await ensureInFuture(r2Provider, tomorrow);

  // 4. Clean up any duplicates
  await cleanupR2Duplicates(env.FOOTBALL_CACHE, oldDate, 'historical');
  await cleanupR2Duplicates(env.FOOTBALL_CACHE, newDate, 'today');
  await cleanupR2Duplicates(env.FOOTBALL_CACHE, tomorrow, 'future');

  // 5. Clean up KV entries for old date
  await deleteKVEntriesForDate(env.FOOTBALL_KV, oldDate);

  // 6. Invalidate Edge Cache for transitioning dates
  await invalidateEdgeCacheForDate(oldDate, commonTimezones);
  await invalidateEdgeCacheForDate(newDate, commonTimezones);

  console.log(`✅ [Fixtures] Date transition completed`);
};

/**
 * Check and handle fixtures date transition
 */
export const checkFixturesDateTransition = async (
  env: FixturesCacheEnv
): Promise<boolean> => {
  const newDate = getCurrentUtcDate();

  if (currentUtcDate === null) {
    currentUtcDate = newDate;
    return false;
  }

  if (currentUtcDate !== newDate) {
    const oldDate = currentUtcDate;
    currentUtcDate = newDate;

    await handleFixturesDateTransition(env, oldDate, newDate);
    return true;
  }

  return false;
};

// Re-export helpers from cache-strategies for backwards compatibility
export { getCurrentUtcDate, getTomorrowUtcDate, getYesterdayUtcDate, isHotDate };


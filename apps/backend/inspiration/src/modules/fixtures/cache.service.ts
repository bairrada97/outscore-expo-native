import { format } from 'date-fns';
import { Fixture } from '@outscore/shared-types';
import { createR2CacheProvider, TTL } from '../cache';
import { CacheConfig, CacheResult, CacheStrategy, StrategyResult } from '../cache/types';
import { CacheProvider} from '../cache/provider.interface';
import { getUtcDateInfo, getCurrentUtcDateString } from './date.utils';

// In-memory state for tracking updates (fixtures-specific)
let lastUpdateTimestamp = 0;

// Initialize with current UTC date
let currentDateString = getCurrentUtcDateString();

// Fixture-specific cache location prefixes 
export enum FixturesCacheLocation {
  TODAY = 'today',
  HISTORICAL = 'historical',
  FUTURE = 'future'
}

/**
 * Gets the appropriate cache key for fixtures data
 */
export const getFixturesCacheKey = ({
  prefix,
  date,
  isLive = false
}: {
  prefix: FixturesCacheLocation;
  date: string;
  isLive?: boolean;
}): string => {
  const tag = isLive ? '-live' : '';
  return `${prefix}/fixtures-${date}${tag}.json`;
};

/**
 * Determines which fixture-specific cache location should be used for the given date
 * This compares the requested date with the current UTC date to determine
 * if it should be stored in TODAY, HISTORICAL, or FUTURE folders
 * 
 * CRITICAL: This function is no longer used. Instead, we use direct string comparison.
 * It is kept for backwards compatibility only.
 */
export const getFixturesCacheLocation = (date: string): FixturesCacheLocation => {
  console.warn('⚠️ DEPRECATED: getFixturesCacheLocation is deprecated, use direct string comparison instead');
  
  // Get current UTC date for comparison
  const currentUtcDate = getCurrentUtcDateString();
  
  // Compare the requested date with current UTC today
  if (date === currentUtcDate) {
    return FixturesCacheLocation.TODAY;
  }
   
  // If request date is before UTC today, it's historical
  if (date < currentUtcDate) {
    return FixturesCacheLocation.HISTORICAL;
  }
  
  // If request date is after UTC today, it's future
  return FixturesCacheLocation.FUTURE;
};

/**
 * Handle fixtures data migrations when date changes
 */
export const handleFixturesDateTransition = async <T>({
  oldDate,
  newDate,
  env,
  provider
}: {
  oldDate: string;
  newDate: string;
  env: any;
  provider: CacheProvider<T>;
}): Promise<void> => {
  try {
    console.log(`🔄 Handling fixtures date transition from ${oldDate} to ${newDate}`);
    
    // Get date info based on the new current UTC date
    const { yesterdayStr, tomorrowStr } = getUtcDateInfo({ date: newDate });
    
    console.log(`📆 Date reference points: yesterday=${yesterdayStr}, today=${newDate}, tomorrow=${tomorrowStr}`);
    
    // CRITICAL: First check if there might be data in both the future and today folders
    // for the same date (this would be the bug we're fixing)
    
    // Check if the new date (today) has data in the future folder
    const todayInFutureKey = getFixturesCacheKey({ prefix: FixturesCacheLocation.FUTURE, date: newDate });
    const todayInFutureExists = await provider.exists(todayInFutureKey);
    
    // Check if new date has data in today folder already
    const todayInTodayKey = getFixturesCacheKey({ prefix: FixturesCacheLocation.TODAY, date: newDate });
    const todayInTodayExists = await provider.exists(todayInTodayKey);
    
    // If both exist, this is a problem - we have duplicated data
    if (todayInFutureExists && todayInTodayExists) {
      console.log(`⚠️ CRITICAL: Found duplicate data for ${newDate} in both FUTURE and TODAY folders. Fixing...`);
      
      // Delete the future copy and keep the today copy
      await provider.delete(todayInFutureKey);
      console.log(`🗑️ Deleted duplicate data for ${newDate} from FUTURE folder`);
    }
    // If only future exists, move it to today
    else if (todayInFutureExists) {
      console.log(`📦 Moving today's data (${newDate}) from future to today folder`);
      await provider.move(todayInFutureKey, todayInTodayKey);
    }
    
    // Now handle the old date (yesterday)
    // Move previous day's data to historical if it exists
    const oldFixturesKey = getFixturesCacheKey({ prefix: FixturesCacheLocation.TODAY, date: oldDate });
    const oldExists = await provider.exists(oldFixturesKey);
    
    if (oldExists) {
      console.log(`📦 Moving previous day (${oldDate}) to historical folder`);
      const newKey = getFixturesCacheKey({ prefix: FixturesCacheLocation.HISTORICAL, date: oldDate });
      await provider.move(oldFixturesKey, newKey);
      
      // CRITICAL: Double-check and delete from today folder if it still exists
      const stillExistsInToday = await provider.exists(oldFixturesKey);
      if (stillExistsInToday) {
        console.log(`🗑️ Cleaning up duplicate data for ${oldDate} from TODAY folder`);
        await provider.delete(oldFixturesKey);
      }
    }
    
    // Finally, check if tomorrow's data exists and should be fixed
    // Check for tomorrow in both folders
    const tomorrowInFutureKey = getFixturesCacheKey({ prefix: FixturesCacheLocation.FUTURE, date: tomorrowStr });
    const tomorrowInTodayKey = getFixturesCacheKey({ prefix: FixturesCacheLocation.TODAY, date: tomorrowStr });
    
    const tomorrowInFutureExists = await provider.exists(tomorrowInFutureKey);
    const tomorrowInTodayExists = await provider.exists(tomorrowInTodayKey);
    
    // If data for tomorrow is in TODAY, this is wrong - move it to FUTURE
    if (tomorrowInTodayExists) {
      console.log(`⚠️ CRITICAL: Found data for tomorrow (${tomorrowStr}) in TODAY folder. Moving to FUTURE...`);
      await provider.move(tomorrowInTodayKey, tomorrowInFutureKey);
    }
    
    console.log('✅ Fixtures date transition handling completed');
  } catch (err) {
    console.error('❌ Error during fixtures date transition:', err instanceof Error ? err.message : String(err));
  }
};

/**
 * Fixture-specific cache strategy that decides caching behavior
 * based on date proximity and live status
 */
export const getFixturesCacheStrategy = ({
  date,
  isLive
}: {
  date: string;
  isLive: boolean;
}): StrategyResult => {
  // For live data, always use frequent refresh
  if (isLive) {
    return { strategy: CacheStrategy.FREQUENT_REFRESH, ttl: TTL.SHORT };
  }
  
  // Get current UTC date as the reference point
  const currentUtcDate = getCurrentUtcDateString();
  
  // Use shared date utility to calculate date info with current UTC date as reference
  const { utcToday, yesterdayStr, tomorrowStr } = getUtcDateInfo({ date: currentUtcDate });
  
  // For today, yesterday, and tomorrow, use frequent refresh
  const isDateInThreeDayWindow = date === yesterdayStr || date === utcToday || date === tomorrowStr;
  if (isDateInThreeDayWindow) {
    return { strategy: CacheStrategy.FREQUENT_REFRESH, ttl: TTL.SHORT };
  }
  
  // Parse dates for comparison
  const requestDate = new Date(date);
  const utcNowDate = new Date(utcToday);
  
  // For historical data, use long-term caching
  if (requestDate < utcNowDate) {
    return { strategy: CacheStrategy.LONG_TERM, ttl: TTL.STANDARD };
  }
  
  // For future data, use standard caching
  return { strategy: CacheStrategy.STANDARD, ttl: TTL.STANDARD };
};

/**
 * Check if the date has changed and handle transition if needed
 */
export const checkDateTransition = async ({
  env,
  provider
}: {
  env: any;
  provider: CacheProvider<any>;
}): Promise<boolean> => {
  // Always use UTC for getting the current date
  const nowDateString = getCurrentUtcDateString();
  
  if (nowDateString !== currentDateString) {
    console.log(`📆 Date transition detected from ${currentDateString || 'initial'} to ${nowDateString}`);
    
    // CRITICAL: Clear in-memory update timestamp to force refresh
    lastUpdateTimestamp = 0;
    console.log(`⚠️ [CRITICAL FIX] Reset lastUpdateTimestamp to force data refresh after date transition`);
    
    // Trigger date transition handling
    if (currentDateString) {
      try {
        // Use date transition handler from date utilities
        await handleFixturesDateTransition({ oldDate: currentDateString, newDate: nowDateString, env, provider });
      } catch (err) {
        console.error('❌ Error during fixtures date transition:', err);
      }
    }
    
    // Update current date
    currentDateString = nowDateString;
    
    // Return true to indicate a date transition occurred
    return true;
  }
  
  // No date transition
  return false;
};

/**
 * Cache fixtures for a specific date
 */
export const cacheFixtures = async ({
  date,
  fixtures,
  env,
  ctx,
  live = false,
  forceUpdate = false,
  locationOverride
}: {
  date: string;
  fixtures: Fixture[];
  env: any;
  ctx: any;
  live?: boolean;
  forceUpdate?: boolean;
  locationOverride?: 'today' | 'historical' | 'future';
}): Promise<boolean> => {
  // Create the cache provider
  const provider = createR2CacheProvider(env.FOOTBALL_CACHE);
  
  // Normalize live flag
  const isLive = !!live;
  
  // Check for date transition - this might reset caches
  const dateTransitionOccurred = await checkDateTransition({ env, provider });
  if (dateTransitionOccurred) {
    console.log('📅 Date transition occurred, using fresh cache settings');
    // Force update is implicit due to lastUpdateTimestamp reset
  }
  
  // Get current UTC date for folder placement decision
  const currentUtcDate = getCurrentUtcDateString();
  
  // CRITICAL: Use locationOverride if provided, otherwise determine folder location automatically
  let cacheLocation: FixturesCacheLocation;
  
  if (locationOverride) {
    // Override the location with explicitly provided value
    switch (locationOverride) {
      case 'today':
        cacheLocation = FixturesCacheLocation.TODAY;
        break;
      case 'historical':
        cacheLocation = FixturesCacheLocation.HISTORICAL;
        break;
      case 'future':
        cacheLocation = FixturesCacheLocation.FUTURE;
        break;
    }
    console.log(`📂 [OVERRIDE] Using ${locationOverride} folder for ${date} as explicitly specified`);
  } else {
    // Use string comparison to ensure accurate date placement
    if (date > currentUtcDate) {
      cacheLocation = FixturesCacheLocation.FUTURE;
      console.log(`📂 [FIXED LOGIC] Using FUTURE folder for ${date} (UTC today: ${currentUtcDate})`);
    } else if (date < currentUtcDate) {
      cacheLocation = FixturesCacheLocation.HISTORICAL;
      console.log(`📂 [FIXED LOGIC] Using HISTORICAL folder for ${date} (UTC today: ${currentUtcDate})`);
    } else {
      cacheLocation = FixturesCacheLocation.TODAY;
      console.log(`📂 [FIXED LOGIC] Using TODAY folder for ${date} (UTC today: ${currentUtcDate})`);
    }
  }
  
  // Get strategy and TTL
  const { strategy, ttl } = getFixturesCacheStrategy({ date, isLive });
  
  const startTime = performance.now();
  console.log(`📝 Starting fixtures cache operation for ${isLive ? 'live ' : ''}matches on ${date}`);
  
  try {
    // Create cache key
    const key = getFixturesCacheKey({ prefix: cacheLocation, date, isLive });
    console.log(`🔑 Using cache key: ${key}`);
    
    // Update timestamp for frequent refresh items
    if (strategy === CacheStrategy.FREQUENT_REFRESH) {
      lastUpdateTimestamp = Date.now();
      console.log(`⏱️ Setting last update timestamp: ${new Date(lastUpdateTimestamp).toISOString()}`);
    }
    
    // Prepare metadata
    const metadata: Record<string, string> = {
      date,
      location: cacheLocation,
      strategy,
      isLive: isLive ? 'true' : 'false',
      forceUpdate: forceUpdate ? 'true' : 'false'
    };
    
    // Cache with config
    const config: CacheConfig = {
      ttl,
      metadata
    };
    
    const success = await provider.set(key, fixtures, config);
    
    const duration = (performance.now() - startTime).toFixed(2);
    if (success) {
      console.log(`✅ Successfully cached ${fixtures.length} fixtures in ${duration}ms with TTL ${ttl}s`);
    } else {
      console.error(`❌ Failed to cache fixtures after ${duration}ms`);
    }
    
    return success;
  } catch (error) {
    console.error(`❌ Error during fixtures caching:`, error);
    throw error;
  }
};

// Get fixtures from storage
export const getFixturesFromStorage = async ({
  date,
  env,
  live = false,
  locationOverride
}: {
  date: string;
  env: any;
  live?: boolean;
  locationOverride?: 'today' | 'historical' | 'future';
}): Promise<{ fixtures: Fixture[] | null; source: string; forceRefresh?: boolean }> => {
  // Create the cache provider
  const provider = createR2CacheProvider(env.FOOTBALL_CACHE);
  
  // Normalize live flag
  const isLive = !!live;
  
  // Check for date transition - this might reset caches and move files
  const dateTransitionOccurred = await checkDateTransition({ env, provider });
  if (dateTransitionOccurred) {
    console.log('📅 Date transition occurred, forcing cache refresh');
    // Return to force an API refresh
    return { fixtures: null, source: 'None', forceRefresh: true };
  }
  
  // Get current UTC date for validation
  const currentUtcDate = getCurrentUtcDateString();
  
  // CRITICAL: Use locationOverride if provided, otherwise determine folder location automatically
  let cacheLocation: FixturesCacheLocation;
  
  if (locationOverride) {
    // Override the location with explicitly provided value
    switch (locationOverride) {
      case 'today':
        cacheLocation = FixturesCacheLocation.TODAY;
        break;
      case 'historical':
        cacheLocation = FixturesCacheLocation.HISTORICAL;
        break;
      case 'future':
        cacheLocation = FixturesCacheLocation.FUTURE;
        break;
    }
    console.log(`🔍 [OVERRIDE] Looking in ${locationOverride} folder for ${date} as explicitly specified`);
  } else {
    // Use string comparison to ensure accurate date placement
    if (date > currentUtcDate) {
      cacheLocation = FixturesCacheLocation.FUTURE;
      console.log(`🔍 [FIXED LOGIC] Looking in FUTURE folder for ${date} (UTC today: ${currentUtcDate})`);
    } else if (date < currentUtcDate) {
      cacheLocation = FixturesCacheLocation.HISTORICAL;
      console.log(`🔍 [FIXED LOGIC] Looking in HISTORICAL folder for ${date} (UTC today: ${currentUtcDate})`);
    } else {
      cacheLocation = FixturesCacheLocation.TODAY;
      console.log(`🔍 [FIXED LOGIC] Looking in TODAY folder for ${date} (UTC today: ${currentUtcDate})`);
    }
  }
  
  // Get strategy and TTL
  const { strategy, ttl } = getFixturesCacheStrategy({ date, isLive });
  
  const startTime = performance.now();
  console.log(`🔍 Retrieving fixtures for ${date}${isLive ? ' (live)' : ''}`);
  
  try {
    // Create cache key
    const key = getFixturesCacheKey({ prefix: cacheLocation, date, isLive });
    
    // For frequent refresh, check if we need to force refresh
    if (strategy === CacheStrategy.FREQUENT_REFRESH) {
      const currentTime = Date.now();
      const timeSinceLastUpdate = currentTime - lastUpdateTimestamp;
      console.log(`⏱️ Time since last update: ${Math.floor(timeSinceLastUpdate / 1000)}s`);
      
      // Force API refresh if:
      // 1. We've never updated (lastUpdateTimestamp is 0)
      // 2. It's been more than the TTL since last update
      const forceRefresh = (lastUpdateTimestamp === 0) || 
                  (timeSinceLastUpdate > ttl * 1000);
      
      if (forceRefresh) {
        if (lastUpdateTimestamp === 0) {
          console.log(`⚠️ FORCING REFRESH: No previous update detected`);
        } else {
          console.log(`⚠️ FORCING REFRESH: It's been more than ${ttl}s since last update`);
        }
        return { fixtures: null, source: 'None', forceRefresh: true };
      }
    }
    
    // Get from cache
    const result = await provider.get(key);
    const duration = (performance.now() - startTime).toFixed(2);
    
    if (result.data) {
      console.log(`✅ Successfully retrieved fixtures from cache in ${duration}ms`);
      return { 
        fixtures: result.data as unknown as Fixture[], 
        source: 'R2',
        forceRefresh: false
      };
    }
    
    console.log(`❓ No cached fixtures found for ${date} (${duration}ms)`);
    return { fixtures: null, source: 'None', forceRefresh: false };
  } catch (error) {
    console.error(`❌ Error retrieving fixtures:`, error);
    return { fixtures: null, source: 'Error', forceRefresh: true };
  }
};
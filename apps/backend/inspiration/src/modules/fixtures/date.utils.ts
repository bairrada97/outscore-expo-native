import { format } from 'date-fns';
import { createR2CacheProvider } from '../cache';
import { handleFixturesDateTransition } from './cache.service';

/**
 * If no date is provided, returns the current UTC date
 * Otherwise, returns the original date string without modification
 * This ensures we respect the user's requested date
 */
export const normalizeToUtcDate = (dateStr?: string): string => {
  if (!dateStr) {
    // Get current UTC date if no date provided
    const now = new Date();
    // Create a UTC date with time set to 00:00:00
    const utcNow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    return format(utcNow, 'yyyy-MM-dd');
  }
  
  // If a date string is provided, use it directly without any conversion
  // This preserves the user's requested date exactly as specified
  return dateStr.trim();
};

/**
 * Get current UTC date string in yyyy-MM-dd format
 */
export const getCurrentUtcDateString = (): string => {
  const now = new Date();
  const utcNow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return format(utcNow, 'yyyy-MM-dd');
};

// Get UTC date information for the current request
export const getUtcDateInfo = ({
  date
}: {
  date: string;
}): {
  utcToday: string;
  yesterdayStr: string;
  tomorrowStr: string;
  isDateInThreeDayWindow: boolean;
  isTodayData: boolean;
} => {
  // Create UTC date objects using current time
  const now = new Date();
  const utcNow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const utcToday = format(utcNow, 'yyyy-MM-dd');
  
  // Calculate yesterday and tomorrow in UTC
  const utcYesterday = new Date(utcNow);
  utcYesterday.setDate(utcNow.getDate() - 1);
  const yesterdayStr = format(utcYesterday, 'yyyy-MM-dd');
  
  const utcTomorrow = new Date(utcNow);
  utcTomorrow.setDate(utcNow.getDate() + 1);
  const tomorrowStr = format(utcTomorrow, 'yyyy-MM-dd');
  
  // Compare the provided date against our UTC reference points
  // This will correctly identify if a provided date is yesterday/today/tomorrow in UTC terms
  const isDateInThreeDayWindow = date === yesterdayStr || date === utcToday || date === tomorrowStr;
  const isTodayData = date === utcToday;
  
  // Enhanced logging for debugging
  console.log(`🗓️ [DEBUG] Date comparison: input=${date}, utcToday=${utcToday}, match=${date === utcToday}`);
  
  return {
    utcToday,
    yesterdayStr,
    tomorrowStr,
    isDateInThreeDayWindow,
    isTodayData
  };
};

// Handle date transitions between days
export const handleDateTransition = async (oldDate: string, newDate: string, env: any): Promise<void> => {
  try {
    console.log(`🔄 Handling date transition from ${oldDate} to ${newDate}`);
    
    if (!env) {
      console.error('❌ Environment reference not available for migration');
      return;
    }
    
    // Create provider directly
    const r2Provider = createR2CacheProvider(env.FOOTBALL_CACHE);
    
    // Use shared date utility to get date info
    const dateInfo = getUtcDateInfo({ date: newDate });
    const { yesterdayStr, tomorrowStr } = dateInfo;
    
    console.log(`📆 Date reference points: yesterday=${yesterdayStr}, today=${newDate}, tomorrow=${tomorrowStr}`);
    
    // Use the fixtures-specific date transition handler directly
    await handleFixturesDateTransition({
      oldDate,
      newDate,
      env,
      provider: r2Provider
    });
    
    console.log('✅ Date transition handling completed');
  } catch (err) {
    console.error('❌ Error during date transition:', err instanceof Error ? err.message : String(err));
  }
}; 
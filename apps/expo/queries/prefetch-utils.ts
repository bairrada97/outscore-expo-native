import { QueryClient } from '@tanstack/react-query';
import { fixturesByDateQuery, createQueryKey } from './fixture-by-date-query';
import { getFormattedDateRange } from '@/utils/date-utils';
import { getDeviceTimeZone } from '@/utils/store-user-timezone';
import { format, isSameDay } from 'date-fns';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Prefetches fixture data for the date range (5 days)
 * 
 * @param queryClient The React Query client instance
 * @returns Promise resolving to true when complete (even on error)
 */
export const prefetchFixtureData = async (queryClient: QueryClient): Promise<boolean> => {
  try {
    // Always generate dates based on current date to ensure fresh date range
    // This ensures that when a new day comes, we properly shift the 5-day window
    const now = new Date();
    const formattedDates = getFormattedDateRange(now);
    
    // Get today, yesterday, and tomorrow for comparison
    const today = now;
    const todayStr = format(today, 'yyyy-MM-dd');
    
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = format(yesterday, 'yyyy-MM-dd');
    
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = format(tomorrow, 'yyyy-MM-dd');
    
    // Get user's timezone directly from their device using our utility
    const userTimezone = getDeviceTimeZone();
    
    console.log(`===== PREFETCH STARTED =====`);
    console.log(`Date: ${todayStr}, timezone: ${userTimezone}`);
    console.log(`Date range: ${formattedDates.join(', ')}`);
    console.log(`Special dates: Yesterday=${yesterdayStr}, Today=${todayStr}, Tomorrow=${tomorrowStr}`);
    
    let cachedDatesCount = 0;
    let freshFetchCount = 0;
    
    // Process each date
    const prefetchPromises = formattedDates.map(date => {
      const queryKey = createQueryKey(date, userTimezone);
      const requestDate = new Date(date);
      
      // TODAY'S matches: Always fetch fresh
      if (isSameDay(requestDate, today)) {
        console.log(`${date}: Today's matches - forcing fresh fetch`);
        freshFetchCount++;
        
        // First remove any existing cached data for today
        queryClient.removeQueries({ queryKey });
        
        // Then fetch fresh data
        const query = fixturesByDateQuery({ 
          date,
          timezone: userTimezone
        });
        return queryClient.prefetchQuery(query);
      }
      
      // YESTERDAY'S matches: Use cache if available
      if (isSameDay(requestDate, yesterday)) {
        // Check cache first
        const cachedData = queryClient.getQueryData(queryKey);
        
        if (cachedData) {
          console.log(`${date}: Using cached data for yesterday's matches`);
          cachedDatesCount++;
          return Promise.resolve();
        }
        
        console.log(`${date}: Fetching yesterday's matches (not in cache)`);
        freshFetchCount++;
        
        const query = fixturesByDateQuery({ 
          date,
          timezone: userTimezone
        });
        return queryClient.prefetchQuery(query);
      }
      
      // TOMORROW'S matches: Check if first match has started
      if (isSameDay(requestDate, tomorrow)) {
        const checkFirstMatchStarted = async () => {
          // Try to get the first match time for tomorrow
          const firstMatchKey = `firstMatch_${date}`;
          const firstMatchTimestamp = await AsyncStorage.getItem(firstMatchKey);
          
          if (firstMatchTimestamp) {
            const firstMatchTime = parseInt(firstMatchTimestamp, 10);
            const currentTime = Date.now();
            
            // If first match has started, fetch fresh
            if (currentTime >= firstMatchTime) {
              console.log(`${date}: Tomorrow's first match has started, fetching fresh data`);
              freshFetchCount++;
              
              // Remove existing cache
              queryClient.removeQueries({ queryKey });
              
              // Clear stored first match time
              await AsyncStorage.removeItem(firstMatchKey);
              
              // Fetch fresh data
              const query = fixturesByDateQuery({ 
                date,
                timezone: userTimezone
              });
              return queryClient.prefetchQuery(query);
            }
          }
          
          // Otherwise check if we have cache
          const cachedData = queryClient.getQueryData(queryKey);
          
          if (cachedData) {
            console.log(`${date}: Using cached data for tomorrow's matches`);
            cachedDatesCount++;
            return;
          }
          
          // No cache, fetch fresh
          console.log(`${date}: Fetching tomorrow's matches (not in cache)`);
          freshFetchCount++;
          
          const query = fixturesByDateQuery({ 
            date,
            timezone: userTimezone
          });
          return queryClient.prefetchQuery(query);
        };
        
        return checkFirstMatchStarted();
      }
      
      // OTHER DATES: Use cache if available
      const cachedData = queryClient.getQueryData(queryKey);
      
      if (cachedData) {
        console.log(`${date}: Using cached data`);
        cachedDatesCount++;
        return Promise.resolve();
      }
      
      // Not in cache, fetch it
      console.log(`${date}: Fetching new data`);
      freshFetchCount++;
      
      const query = fixturesByDateQuery({ 
        date,
        timezone: userTimezone
      });
      return queryClient.prefetchQuery(query);
    });
    
    // Wait for all prefetch operations to complete
    await Promise.all(prefetchPromises);
    
    console.log(`===== PREFETCH COMPLETE =====`);
    console.log(`From cache: ${cachedDatesCount} days, Fresh fetches: ${freshFetchCount} days`);
    return true;
  } catch (error) {
    console.error("Error prefetching fixture data:", error);
    return true; // Return true even on error so the app still loads
  }
};  
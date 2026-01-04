import { format, isSameDay, isAfter, isBefore, parseISO, startOfDay } from 'date-fns'
import { FIFTEEN_SECONDS_CACHE, ONE_DAY_CACHE, ONE_MINUTE_CACHE } from '@/utils/constants'
import { getFixturesByDate } from './get-fixtures-by-date'
import { FormattedCountry, FormattedMatch } from '../../../packages/shared-types/dist';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Define cache constants
const ONE_HOUR_CACHE = 60 * 60 * 1000; // 1 hour in milliseconds
const FIVE_MINUTES_CACHE = 5 * 60 * 1000; // 5 minutes in milliseconds
const THIRTY_SECONDS_CACHE = 30 * 1000; // 30 seconds
const INFINITE_CACHE = Infinity; // For data that should be cached forever
// Adding a constant for historical matches (1 week)
const ONE_WEEK_CACHE = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

// Define the query parameters type
interface FixtureQueryParams {
	date: string;
	timezone?: string; 
}

// Create a key for the query that includes timezone
export const createQueryKey = (date: string, timezone?: string) => {
	return ['fixtures-by-date', date, timezone || 'UTC'];
};

// Helper to find the first match time of the day from fixture data
const getFirstMatchTimeOfDay = (fixtures: FormattedCountry[]): Date | null => {
	// Flatten all matches from all countries and leagues
	const allMatches: FormattedMatch[] = [];
	
	fixtures.forEach(country => {
		country.leagues.forEach(league => {
			allMatches.push(...league.matches);
		});
	});
	
	if (allMatches.length === 0) return null;
	
	// Sort by timestamp and get the earliest match
	allMatches.sort((a, b) => a.timestamp - b.timestamp);
	
	// Return the time of the first match
	return new Date(allMatches[0].timestamp * 1000);
};

export const fixturesByDateQuery = (args: FixtureQueryParams) => {
	const queryDate = args.date;
	const timezone = args.timezone || 'UTC';
	
	// Include timezone in query key to avoid duplicate caching
	const queryKey = createQueryKey(queryDate, timezone);
	
	const queryFn = async (): Promise<FormattedCountry[]> => {
		console.log(`Executing query for ${queryDate} in ${timezone} timezone`);
		const data = await getFixturesByDate({
			date: queryDate,
			timezone: timezone
		});
		
		// Store first match time if this is tomorrow's data
		// This is used for conditional invalidation
		const tomorrow = new Date();
		tomorrow.setDate(tomorrow.getDate() + 1);
		const isTomorrow = isSameDay(new Date(queryDate), tomorrow);
		
		if (isTomorrow) {
			try {
				const firstMatchTime = getFirstMatchTimeOfDay(data);
				if (firstMatchTime) {
					console.log(`First match for ${queryDate} starts at:`, firstMatchTime.toISOString());
					// Store first match time for tomorrow in AsyncStorage
					// We'll use this to invalidate cache when that time comes
					const key = `firstMatch_${queryDate}`;
					const timestamp = firstMatchTime.getTime().toString();
					// Store timestamp in AsyncStorage (no longer using dynamic import)
					AsyncStorage.setItem(key, timestamp).catch(err => {
						console.error("Error storing match time:", err);
					});
				}
			} catch (err) {
				console.error("Error processing match times:", err);
			}
		}
		
		return data;
	};
	
	// Determine staleTime and cache duration based on date type
	let staleTime = 0; // Default for most dates
	let refetchInterval = undefined;
	let cacheTime = 0; // Default cache time
	let refetchOnMount = true; // Default to true to reduce automatic refetches
	let refetchOnWindowFocus = false;
	
	// Get today's date for comparison
	const requestDate = new Date(queryDate);
	const today = new Date();
	const yesterday = new Date();
	yesterday.setDate(today.getDate() - 1);
	const tomorrow = new Date();
	tomorrow.setDate(today.getDate() + 1);
	
	if (isSameDay(requestDate, today)) {
		// TODAY'S MATCHES: Don't cache at client side, always get fresh data
		staleTime = 0; // Always stale
		refetchInterval = FIFTEEN_SECONDS_CACHE; // Refetch every 15 seconds
		cacheTime = 0; // Don't cache
		refetchOnMount = true; // Always refetch on mount
		refetchOnWindowFocus = true; // Always refetch on focus
		console.log(`${queryDate}: Today's matches - no client caching`);
	} else if (isSameDay(requestDate, yesterday)) {
		// YESTERDAY'S MATCHES: Cache for a day, but do refetch once on mount to get final scores
		staleTime = ONE_HOUR_CACHE; // Stale after 1 hour  
		cacheTime = ONE_DAY_CACHE; // Cache for one day
		refetchOnMount = true; // Refetch once on mount to ensure we have final scores
		refetchOnWindowFocus = false; // Don't refetch on focus
		console.log(`${queryDate}: Yesterday's matches - limited caching with refresh on mount`);
	} else if (isSameDay(requestDate, tomorrow)) {
		// TOMORROW'S MATCHES: Cache until first match starts
		staleTime = ONE_HOUR_CACHE; // Stale after 1 hour
		cacheTime = ONE_DAY_CACHE; // Cache for one day max
		refetchOnMount = true; // Refetch on mount to check if first match started
		refetchOnWindowFocus = true; // Check if first match started when app comes to foreground
		console.log(`${queryDate}: Tomorrow's matches - cache until first match`);
	} else if (isBefore(requestDate, today)) {
		// OLDER PAST MATCHES: Cache with a finite time instead of forever
		// This ensures historical matches will eventually be refreshed
		staleTime = ONE_DAY_CACHE; // Stale after one day
		cacheTime = ONE_WEEK_CACHE; // Cache for up to a week
		refetchOnMount = true; // Refetch once on mount to ensure we have final data
		refetchOnWindowFocus = false; // Don't refetch on focus
		console.log(`${queryDate}: Older past matches - cached with weekly refresh`);
	} else {
		// FUTURE MATCHES (beyond tomorrow): Cache with regular updates
		staleTime = ONE_HOUR_CACHE; // Stale after 1 hour
		cacheTime = 3 * ONE_DAY_CACHE; // Cache for up to 3 days
		refetchOnMount = true; // Refetch on mount
		refetchOnWindowFocus = false; // Don't refetch on focus
		console.log(`${queryDate}: Future matches - regular cache`);
	}
	
	return { 
		queryKey, 
		queryFn, 
		staleTime,
		refetchInterval,
		// Configure cache time (how long React Query keeps the data)
		gcTime: cacheTime,
		// Only refetch when necessary based on date type
		refetchOnMount,
		refetchOnWindowFocus
	};
};
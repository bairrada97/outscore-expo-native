import {
	DarkTheme,
	DefaultTheme,
	NavigationContainer,
	ThemeProvider,
} from '@react-navigation/native'

import { useFonts } from 'expo-font'
import { Stack } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { useEffect, useState } from 'react'
import 'react-native-reanimated'
import React from 'react'
import { isSameDay, format } from 'date-fns'
import { AppState, AppStateStatus } from 'react-native'

import { useColorScheme } from '@/hooks/useColorScheme'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { TimeZoneProvider, useTimeZone } from '@/context/timezone-context'
import {
	focusManager,
	QueryClient,
	QueryClientProvider,
	QueryCache,
} from '@tanstack/react-query'
import { PaperProvider } from 'react-native-paper'
import { SafeAreaView } from 'react-native-safe-area-context'
import { isWeb } from '@gluestack-ui/nativewind-utils/IsWeb'
import { useOnlineManager } from '@/hooks/useOnlineManager'
import { useAppState } from '@/hooks/useAppState'
import { SourceSansPro_400Regular } from '@expo-google-fonts/source-sans-pro'
import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider'
import { Header } from '@/components/Header/Header'
import '../global.css'
import { Heading } from '@/components/ui/heading'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
	persistQueryClient,
	PersistQueryClientProvider,
} from '@tanstack/react-query-persist-client'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { prefetchFixtureData } from '@/queries/prefetch-utils'
import { createQueryKey } from '@/queries/fixture-by-date-query'

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync()

function onAppStateChange(status: AppStateStatus) {
	// React Query already supports in web browser refetch on window focus by default
	if (!isWeb) {
		focusManager.setFocused(status === 'active')
	}
}

// Setup persistent queries with appropriate defaults
const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			// Keep fetched data in memory for a longer time
			gcTime: 1000 * 60 * 60 * 24, // 24 hours
			// Don't retry forever to avoid excessive API requests
			retry: 2,
			// Keep normal refetch behavior controlled by individual queries
			refetchOnReconnect: true,
			// Add this setting to improve caching behavior
			staleTime: 1000 * 60 * 5, // 5 minutes for most data
		},
	},
})

// Define app version for cache busting
const APP_VERSION = '1.0.0'; // Update this when making breaking changes to the cache structure

// Create the persister for AsyncStorage with more robust configuration
const asyncStoragePersister = createAsyncStoragePersister({
	storage: AsyncStorage,
	key: 'outscore-query-cache',
	serialize: data => JSON.stringify(data),
	deserialize: data => JSON.parse(data),
	throttleTime: 500, // Faster persistence
})

// Set up persistence options
const persistOptions = {
	persister: asyncStoragePersister,
	maxAge: 14 * 24 * 60 * 60 * 1000, // Keep persisted data for 14 days
	buster: APP_VERSION, // Added to prevent old versions from hydrating
	dehydrateOptions: {
		shouldDehydrateQuery: (query: any) => {
			// Don't persist today's data
			const isFixturesQuery = Array.isArray(query.queryKey) && query.queryKey[0] === 'fixtures-by-date';
			if (isFixturesQuery) {
				const date = query.queryKey[1] as string;
				const today = format(new Date(), 'yyyy-MM-dd');
				if (date === today) {
					console.log(`Not persisting today's data: ${date}`);
					return false;
				}
			}
			return true;
		}
	}
}

// Track the date to detect day changes between app uses
const LAST_TODAY_DATE_KEY = 'lastTodayDate';

// App content that depends on the TimeZone being loaded
function AppContent() {
	const { timeZone, isLoading } = useTimeZone();
	const [dataLoaded, setDataLoaded] = useState(false);
	const [prefetchStarted, setPrefetchStarted] = useState(false);
	
	// Debug: Check cache on startup
	useEffect(() => {
		const debugCacheState = async () => {
			try {
				const cacheData = await AsyncStorage.getItem('outscore-query-cache');
				if (cacheData) {
					console.log('Found cached data in AsyncStorage');
					
					// Check if cache contains fixture data
					const parsedCache = JSON.parse(cacheData);
					const queryKeys = Object.keys(parsedCache.clientState.queries || {});
					const fixtureQueries = queryKeys.filter(key => key.includes('fixtures-by-date'));
					
					console.log(`Cache contains ${fixtureQueries.length} fixture queries`);
					fixtureQueries.forEach(key => {
						console.log(`- Cached query: ${key}`);
					});
				} else {
					console.log('No cache data found in AsyncStorage');
				}
			} catch (error) {
				console.error('Error checking cache:', error);
			}
		};
		
		debugCacheState();
	}, []);
	
	// Check if tomorrow's first match has started when app comes into focus
	useEffect(() => {
		// Function to check if tomorrow's match has started
		const checkTomorrowMatchStarted = async () => {
			try {
				// Calculate tomorrow's date
				const tomorrow = new Date();
				tomorrow.setDate(tomorrow.getDate() + 1);
				const tomorrowFormatted = format(tomorrow, 'yyyy-MM-dd');
				
				// Try to get the first match time for tomorrow
				const firstMatchKey = `firstMatch_${tomorrowFormatted}`;
				const firstMatchTimestamp = await AsyncStorage.getItem(firstMatchKey);
				
				if (firstMatchTimestamp) {
					const firstMatchTime = parseInt(firstMatchTimestamp, 10);
					const now = Date.now();
					
					// If the first match has already started, invalidate tomorrow's cache
					if (now >= firstMatchTime) {
						console.log('App focused: Tomorrow\'s first match has started, invalidating cache');
						
						// Get tomorrow's query key
						const tomorrowQuery = createQueryKey(tomorrowFormatted, timeZone);
						
						// Remove the cached data for tomorrow
						queryClient.removeQueries({ queryKey: tomorrowQuery });
						
						// Clear the stored first match time
						await AsyncStorage.removeItem(firstMatchKey);
						
						console.log('Tomorrow\'s fixture cache invalidated on app focus');
					}
				}
			} catch (error) {
				console.error('Error checking tomorrow\'s matches on app focus:', error);
			}
		};
		
		// Set up app state change listener
		const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
			if (nextAppState === 'active') {
				console.log('App has come to the foreground, checking matches');
				checkTomorrowMatchStarted();
			}
		});
		
		// Run once on mount too
		checkTomorrowMatchStarted();
		
		// Clean up listener on unmount
		return () => {
			subscription.remove();
		};
	}, [timeZone]); // Depend on timezone to re-run if it changes
	
	// Check for date change when the app is loaded
	useEffect(() => {
		const checkDateChange = async () => {
			try {
				// Get today's date formatted as YYYY-MM-DD for consistency
				const todayFormatted = format(new Date(), 'yyyy-MM-dd');
				
				// Get the last stored "today" date
				const lastTodayDate = await AsyncStorage.getItem(LAST_TODAY_DATE_KEY);
				
				console.log('Current date:', todayFormatted, 'Last stored date:', lastTodayDate || 'none');
				
				// If we have a stored date and it's different from today
				if (lastTodayDate && lastTodayDate !== todayFormatted) {
					console.log('Day changed from', lastTodayDate, 'to', todayFormatted);
					
					// When the date changes, we need new fixtures for the new date range
					console.log('Invalidating fixture queries due to date change');
					try {
						queryClient.invalidateQueries({
							predicate: (query) => {
								return Array.isArray(query.queryKey) && 
									query.queryKey[0] === 'fixtures-by-date';
							}
						});
					} catch (invalidateError) {
						console.error('Error invalidating queries:', invalidateError);
					}
				}
				
				// Check if tomorrow's first match has started (on app load)
				// This handles the case when the app was closed during the day and reopened
				const checkTomorrowMatches = async () => {
					// Calculate tomorrow's date
					const tomorrow = new Date();
					tomorrow.setDate(tomorrow.getDate() + 1);
					const tomorrowFormatted = format(tomorrow, 'yyyy-MM-dd');
					
					// Try to get the first match time for tomorrow
					const firstMatchKey = `firstMatch_${tomorrowFormatted}`;
					const firstMatchTimestamp = await AsyncStorage.getItem(firstMatchKey);
					
					if (firstMatchTimestamp) {
						const firstMatchTime = parseInt(firstMatchTimestamp, 10);
						const now = Date.now();
						
						console.log(`Tomorrow's first match time: ${new Date(firstMatchTime).toISOString()}`);
						console.log(`Current time: ${new Date(now).toISOString()}`);
						
						// If the first match has already started, invalidate tomorrow's cache
						if (now >= firstMatchTime) {
							console.log('Tomorrow\'s first match has started, invalidating cache');
							
							// Get tomorrow's query key
							const tomorrowQuery = createQueryKey(tomorrowFormatted, timeZone);
							
							// Remove the cached data for tomorrow
							queryClient.removeQueries({ queryKey: tomorrowQuery });
							
							// Clear the stored first match time
							await AsyncStorage.removeItem(firstMatchKey);
							
							console.log('Tomorrow\'s fixture cache invalidated');
						} else {
							// First match hasn't started yet, log time until match
							const timeUntilMatch = Math.round((firstMatchTime - now) / 60000);
							console.log(`Tomorrow's first match starts in ${timeUntilMatch} minutes`);
						}
					} else {
						console.log('No stored time for tomorrow\'s first match');
					}
				};
				
				// Execute the check
				await checkTomorrowMatches().catch(error => {
					console.error('Error checking tomorrow\'s matches:', error);
				});
				
				// Always store today's date for future comparison
				try {
					await AsyncStorage.setItem(LAST_TODAY_DATE_KEY, todayFormatted);
					console.log('Stored today\'s date:', todayFormatted);
				} catch (storeError) {
					console.error('Error storing today\'s date:', storeError);
				}
				
				// Always reset prefetch status to ensure we load with current date
				setPrefetchStarted(false);
				
			} catch (error) {
				console.error('Error in date change check:', error);
				// Ensure prefetch still happens even if date check fails
				setPrefetchStarted(false);
			}
		};
		
		checkDateChange();
	}, [timeZone]);
	
	// Prefetch data only once after timezone is loaded
	useEffect(() => {
		if (!isLoading && timeZone && !prefetchStarted) {
			setPrefetchStarted(true);
			console.log("TimeZone loaded, prefetching with timezone:", timeZone);
			
			prefetchFixtureData(queryClient).then(success => {
				console.log("Prefetch completed with timezone:", timeZone);
				setDataLoaded(success);
			}).catch(error => {
				console.error("Prefetch error:", error);
				// Still mark as loaded to prevent app from hanging
				setDataLoaded(true);
			});
		}
	}, [isLoading, timeZone, prefetchStarted]);
	
	// Hide splash screen when ready
	useEffect(() => {
		if (dataLoaded && !isLoading) {
			SplashScreen.hideAsync();
		}
	}, [dataLoaded, isLoading]);
	
	if (isLoading || !dataLoaded) {
		return null;
	}
	
	return (
		<Stack>
			<Stack.Screen
				name="(tabs)"
				options={{
					header: ({ route }) => (
						<Header
							classNames="sticky z-[9999]"
							innerContainerClassName=" justify-between"
						>
							<Heading variant="title-01" className="text-neu-01">
								Football Matches
							</Heading>
							<Header.RightIcons>
								<></>
							</Header.RightIcons>
						</Header>
					),
				}}
			/>
			<Stack.Screen name="+not-found" />
		</Stack>
	);
}

export default function RootLayout() {
	useOnlineManager()
	useAppState(onAppStateChange)
	const colorScheme = useColorScheme()

	const [fontsLoaded, fontsError] = useFonts({
		sourceSansPro_regular: SourceSansPro_400Regular,
	})

	// Show splash screen until fonts are loaded
	useEffect(() => {
		if (fontsLoaded || fontsError) {
			// Note: The splash screen will be hidden in AppContent when data is loaded
			console.log("Fonts loaded, waiting for data to load...");
		}
	}, [fontsLoaded, fontsError])

	if (!fontsLoaded && !fontsError) {
		return null;
	}
	
	return (
		<PersistQueryClientProvider
			client={queryClient}
			persistOptions={persistOptions}
		>
			<GestureHandlerRootView
				style={{ flex: 1, maxWidth: 800, margin: 'auto', width: '100%' }}
			>
				<TimeZoneProvider>
					<GluestackUIProvider mode="light">
						<ThemeProvider
							value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}
						>
							<PaperProvider>
								<SafeAreaView
									className="m-auto w-full max-w-[800px]"
									style={{ flex: 1 }}
								>
									<AppContent />
								</SafeAreaView>
							</PaperProvider>
						</ThemeProvider>
					</GluestackUIProvider>
				</TimeZoneProvider>
			</GestureHandlerRootView>
		</PersistQueryClientProvider>
	)
}  

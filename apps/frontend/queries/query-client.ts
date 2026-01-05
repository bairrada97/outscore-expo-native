import { FIVE_MINUTES_CACHE, ONE_DAY_CACHE } from "@/utils/constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { type Query, QueryClient } from "@tanstack/react-query";
import { Platform } from "react-native";

/**
 * Create and configure the React Query client
 */
export function createQueryClient(): QueryClient {
	return new QueryClient({
		defaultOptions: {
			queries: {
				// Keep fetched data in memory for 24 hours
				gcTime: ONE_DAY_CACHE,
				// Retry failed requests twice
				retry: 2,
				// Refetch on reconnect to ensure fresh data
				refetchOnReconnect: true,
				// Default stale time of 5 minutes
				staleTime: FIVE_MINUTES_CACHE,
				// Don't refetch on window focus by default (controlled per query)
				refetchOnWindowFocus: false,
			},
		},
	});
}

/**
 * Create the AsyncStorage persister for React Query
 * On web, returns a no-op persister to avoid AsyncStorage overhead
 */
export function createQueryPersister() {
	// Skip persistence on web - reduces bundle size and avoids AsyncStorage polyfill overhead
	if (Platform.OS === "web") {
		return createAsyncStoragePersister({
			storage: {
				getItem: async () => null,
				setItem: async () => {},
				removeItem: async () => {},
			} as any,
			key: "outscore-query-cache",
		});
	}

	try {
		return createAsyncStoragePersister({
			storage: AsyncStorage,
			key: "outscore-query-cache",
			serialize: (data) => {
				try {
					return JSON.stringify(data);
				} catch (error) {
					console.warn("Failed to serialize query cache:", error);
					return "{}";
				}
			},
			deserialize: (data) => {
				try {
					return JSON.parse(data);
				} catch (error) {
					console.warn("Failed to deserialize query cache:", error);
					return {};
				}
			},
			throttleTime: 500,
		});
	} catch (error) {
		console.warn("Failed to create query persister:", error);
		// Return a no-op persister if AsyncStorage fails
		return createAsyncStoragePersister({
			storage: {
				getItem: async () => null,
				setItem: async () => {},
				removeItem: async () => {},
			} as any,
			key: "outscore-query-cache",
		});
	}
}

/**
 * App version for cache busting
 */
export const APP_VERSION = "1.0.0";

/**
 * Persist options for the query client
 */
export function createPersistOptions(
	persister: ReturnType<typeof createQueryPersister>,
) {
	return {
		persister,
		maxAge: 14 * ONE_DAY_CACHE, // Keep persisted data for 14 days
		buster: APP_VERSION,
		dehydrateOptions: {
			shouldDehydrateQuery: (query: Query) => {
				// Don't persist today's fixture data (should always be fresh)
				const queryKey = query.queryKey;
				const isFixturesQuery =
					Array.isArray(queryKey) && queryKey[0] === "fixtures-by-date";

				if (isFixturesQuery) {
					const date = queryKey[1] as string;
					const today = new Date().toISOString().split("T")[0];
					if (date === today) {
						return false; // Don't persist today's data
					}
				}

				return true;
			},
		},
	};
}

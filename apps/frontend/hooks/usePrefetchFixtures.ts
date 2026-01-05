import { useTimeZone } from "@/context/timezone-context";
import { fixturesByDateQuery } from "@/queries/fixtures-by-date";
import { formatDateForApi, getDateRange } from "@/utils/date-utils";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Platform } from "react-native";

/**
 * Prefetch fixtures for all date tabs in the background.
 * Uses idle time on web (requestIdleCallback) and after interactions on native.
 *
 * React Query's prefetchQuery handles:
 * - Deduplication (won't refetch if already in-flight)
 * - Respects staleTime (won't refetch fresh data)
 * - Retry logic (from query options)
 */
export function usePrefetchFixtures() {
	const queryClient = useQueryClient();
	const { timeZone } = useTimeZone();

	useEffect(() => {
		const prefetchDates = () => {
			const dates = getDateRange(new Date());

			// Prefetch all dates - React Query handles deduplication
			for (const date of dates) {
				const dateStr = formatDateForApi(date);
				queryClient.prefetchQuery(
					fixturesByDateQuery({ date: dateStr, timezone: timeZone }),
				);
			}
		};

		// Schedule prefetching during idle time on web
		if (Platform.OS === "web" && "requestIdleCallback" in globalThis) {
			type IdleCallback = typeof globalThis & {
				requestIdleCallback: (
					cb: () => void,
					opts?: { timeout: number },
				) => number;
				cancelIdleCallback: (id: number) => void;
			};
			const global = globalThis as IdleCallback;
			const idleId = global.requestIdleCallback(() => prefetchDates(), {
				timeout: 2000,
			});
			return () => global.cancelIdleCallback(idleId);
		}

		// On native, start prefetching immediately with a small delay
		// to allow the initial render to complete first
		const timeoutId = setTimeout(prefetchDates, 100);
		return () => clearTimeout(timeoutId);
	}, [queryClient, timeZone]);
}

import { useTimeZone } from "@/context/timezone-context";
import { fixturesByDateQuery } from "@/queries/fixtures-by-date";
import { formatDateForApi, getDateRange } from "@/utils/date-utils";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { InteractionManager, Platform } from "react-native";

/**
 * Prefetch fixtures for all date tabs in the background.
 * Uses idle time on web (requestIdleCallback) and after interactions on native.
 */
export function usePrefetchFixtures() {
	const queryClient = useQueryClient();
	const { timeZone } = useTimeZone();

	useEffect(() => {
		const prefetchDates = () => {
			const dates = getDateRange(new Date());

			// Prefetch all dates with low priority
			dates.forEach((date) => {
				const dateStr = formatDateForApi(date);
				queryClient.prefetchQuery(
					fixturesByDateQuery({ date: dateStr, timezone: timeZone }),
				);
			});
		};

		// Schedule prefetching during idle time
		if (
			Platform.OS === "web" &&
			typeof globalThis !== "undefined" &&
			"requestIdleCallback" in globalThis
		) {
			const idleId = (
				globalThis as typeof globalThis & {
					requestIdleCallback: (
						cb: () => void,
						opts?: { timeout: number },
					) => number;
					cancelIdleCallback: (id: number) => void;
				}
			).requestIdleCallback(() => prefetchDates(), {
				timeout: 2000, // Max wait 2 seconds
			});
			return () =>
				(
					globalThis as typeof globalThis & {
						cancelIdleCallback: (id: number) => void;
					}
				).cancelIdleCallback(idleId);
		}

		// On native, run after interactions complete
		const task = InteractionManager.runAfterInteractions(() => {
			prefetchDates();
		});

		return () => task.cancel();
	}, [queryClient, timeZone]);
}

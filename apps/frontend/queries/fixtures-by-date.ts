import {
	API_BASE_URL,
	FIFTEEN_SECONDS_CACHE,
	ONE_DAY_CACHE,
	ONE_HOUR_CACHE,
	ONE_WEEK_CACHE,
} from "@/utils/constants";
import type { FormattedCountry } from "@outscore/shared-types";
import { isBefore, isSameDay } from "date-fns";

/**
 * Query key factory for fixtures
 */
export function createFixturesQueryKey(
	date: string,
	timezone?: string,
): string[] {
	return ["fixtures-by-date", date, timezone || "UTC"];
}

/**
 * Custom error class to include HTTP status for retry logic
 */
class FetchError extends Error {
	constructor(
		message: string,
		public status: number,
	) {
		super(message);
		this.name = "FetchError";
	}
}

/**
 * Fetch fixtures from the API
 */
async function fetchFixtures({
	date,
	timezone,
	live,
	signal,
	timeoutMs = 30000,
}: {
	date: string;
	timezone?: string;
	live?: "all";
	signal?: AbortSignal;
	timeoutMs?: number;
}): Promise<FormattedCountry[]> {
	const params = new URLSearchParams();
	params.set("date", date);

	if (timezone) params.set("timezone", timezone);
	if (live) params.set("live", live);

	// Create AbortController for timeout if no signal provided
	const controller = signal ? null : new AbortController();
	const abortSignal = signal ?? controller!.signal;

	// Set up timeout if no external signal provided
	let timeoutId: NodeJS.Timeout | null = null;
	if (!signal && timeoutMs > 0) {
		timeoutId = setTimeout(() => {
			controller!.abort();
		}, timeoutMs);
	}

	try {
		const url = new URL("/fixtures", API_BASE_URL);
		url.search = params.toString();
		const response = await fetch(url.toString(), {
			signal: abortSignal,
		});

		if (timeoutId) clearTimeout(timeoutId);

		if (!response.ok) {
			throw new FetchError(
				`Failed to fetch fixtures: ${response.statusText}`,
				response.status,
			);
		}

		const json = (await response.json()) as { data: FormattedCountry[] };
		return json.data as FormattedCountry[];
	} catch (error) {
		if (timeoutId) clearTimeout(timeoutId);
		if (error instanceof Error && error.name === "AbortError") {
			throw new FetchError("Request timeout or aborted", 408);
		}
		throw error;
	}
}

/**
 * Query options for fixtures by date
 */
export interface FixturesQueryParams {
	date: string;
	timezone?: string;
	live?: "all";
}

/**
 * Create query options for fixtures
 */
export function fixturesByDateQuery({
	date,
	timezone,
	live,
}: FixturesQueryParams) {
	const queryKey = createFixturesQueryKey(date, timezone);

	const queryFn = async ({
		signal,
	}: {
		signal?: AbortSignal;
	}): Promise<FormattedCountry[]> => {
		return fetchFixtures({ date, timezone, live, signal });
	};

	// Determine cache settings based on date type
	const requestDate = new Date(date);
	const today = new Date();
	const yesterday = new Date();
	yesterday.setDate(today.getDate() - 1);
	const tomorrow = new Date();
	tomorrow.setDate(today.getDate() + 1);

	let staleTime = 0;
	let refetchInterval: number | undefined;
	let gcTime = 0;
	let refetchOnMount: boolean | "always" = true;
	let refetchOnWindowFocus = false;

	if (isSameDay(requestDate, today)) {
		// TODAY: Cache for 15s to match backend refresh interval
		// This prevents duplicate requests when switching tabs within the refresh window
		// Refetch interval is offset by 2s to avoid racing with Edge Cache expiry (15s TTL)
		staleTime = FIFTEEN_SECONDS_CACHE;
		refetchInterval = FIFTEEN_SECONDS_CACHE + 2000; // 17s to avoid Edge Cache race
		gcTime = FIFTEEN_SECONDS_CACHE * 4; // Keep in memory for 1 minute
		refetchOnMount = true; // Only refetch if stale
		refetchOnWindowFocus = true;
	} else if (isSameDay(requestDate, yesterday)) {
		// YESTERDAY: Cache with refresh on mount
		staleTime = ONE_HOUR_CACHE;
		gcTime = ONE_DAY_CACHE;
		refetchOnMount = true;
		refetchOnWindowFocus = false;
	} else if (isSameDay(requestDate, tomorrow)) {
		// TOMORROW: Cache until first match starts
		staleTime = ONE_HOUR_CACHE;
		gcTime = ONE_DAY_CACHE;
		refetchOnMount = true;
		refetchOnWindowFocus = true;
	} else if (isBefore(requestDate, today)) {
		// OLDER PAST: Long cache
		staleTime = ONE_DAY_CACHE;
		gcTime = ONE_WEEK_CACHE;
		refetchOnMount = true;
		refetchOnWindowFocus = false;
	} else {
		// FUTURE: Regular cache
		staleTime = ONE_HOUR_CACHE;
		gcTime = 3 * ONE_DAY_CACHE;
		refetchOnMount = true;
		refetchOnWindowFocus = false;
	}

	return {
		queryKey,
		queryFn,
		staleTime,
		refetchInterval,
		gcTime,
		refetchOnMount,
		refetchOnWindowFocus,
		// Retry configuration using React Query's built-in support
		retry: (failureCount: number, error: Error) => {
			// Only retry on 503 (Service Unavailable) or 429 (Rate Limited)
			if (error instanceof FetchError) {
				return (
					(error.status === 503 || error.status === 429) && failureCount < 3
				);
			}
			// Retry network errors up to 3 times
			return failureCount < 3;
		},
		retryDelay: (attemptIndex: number) => {
			// Exponential backoff: 1s, 2s, 4s (capped at 5s)
			return Math.min(1000 * 2 ** attemptIndex, 5000);
		},
	};
}

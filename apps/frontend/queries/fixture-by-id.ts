import {
	API_BASE_URL,
	FIFTEEN_SECONDS_CACHE,
	ONE_DAY_CACHE,
	ONE_HOUR_CACHE,
	ONE_WEEK_CACHE,
	SIX_HOURS_CACHE,
} from "@/utils/constants";
import { FetchError, fetchJsonWithTimeout } from "@/utils/fetch-with-timeout";
import {
	FIXTURE_IS_FINISHED_STATUS,
	FIXTURE_IS_LIVE_STATUS,
} from "@/utils/fixtures-status-constants";
import type { FixturesResponse } from "@outscore/shared-types";
import { format } from "date-fns";

/**
 * Query key factory for fixture detail
 */
export function createFixtureQueryKey(fixtureId: number): string[] {
	return ["fixture", String(fixtureId)];
}

/**
 * Fetch fixture detail from the API
 */
async function fetchFixtureDetail({
	fixtureId,
	signal,
	timeoutMs = 30000,
}: {
	fixtureId: number;
	signal?: AbortSignal;
	timeoutMs?: number;
}): Promise<FixturesResponse> {
	const params = new URLSearchParams();
	params.set("id", String(fixtureId));

	const url = new URL("/fixtures", API_BASE_URL);
	url.search = params.toString();

	const json = await fetchJsonWithTimeout<{ data: FixturesResponse }>({
		url: url.toString(),
		signal,
		timeoutMs,
		errorMessage: "Failed to fetch fixture detail",
	});

	return json.data;
}

/**
 * Calculate refetch interval based on match status and time until match
 *
 * Strategy:
 * - LIVE: 17s (15s + 2s buffer)
 * - FINISHED: false (stop polling)
 * - NOT_STARTED:
 *   - <= 45 min before: 17s (lineups appear)
 *   - <= 1 hour before: 17s (active pre-match)
 *   - <= 8 hours before: 1 hour
 *   - > 8 hours: false (no polling)
 * - Midnight UTC handling: If match is today and within 1 hour of midnight,
 *   schedule refetch at midnight to detect date transitions
 */
function getRefetchInterval(
	status: string | undefined,
	matchTimestamp: number | undefined,
): number | false {
	if (!status || !matchTimestamp) {
		return false;
	}

	// LIVE matches: poll every 17s (15s + buffer) - check FIRST
	// This takes priority over midnight transition logic
	if (FIXTURE_IS_LIVE_STATUS.includes(status)) {
		return FIFTEEN_SECONDS_CACHE + 2000;
	}

	const nowMs = Date.now();
	const nowSeconds = nowMs / 1000;
	const timeUntilMatch = matchTimestamp - nowSeconds;
	const matchDate = new Date(matchTimestamp * 1000);

	// Calculate time until next midnight UTC
	const nextMidnight = new Date();
	nextMidnight.setUTCHours(24, 0, 0, 0);
	const msUntilMidnight = nextMidnight.getTime() - nowMs;

	// Check if match is today
	const isToday =
		format(matchDate, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");

	// If match is today and we're within 1 hour of midnight UTC
	// Schedule refetch at midnight to handle date transition
	// (Only for non-LIVE matches, since LIVE is handled above)
	if (isToday && msUntilMidnight < 3600000 && msUntilMidnight > 0) {
		// Fire at midnight + 1s buffer, max 1 min
		return Math.min(msUntilMidnight + 1000, 60000);
	}

	// FINISHED matches: stop polling
	if (FIXTURE_IS_FINISHED_STATUS.includes(status)) {
		return false;
	}

	// NOT_STARTED: dynamic based on time until match
	if (status === "NS" || status === "TBD") {
		// Match has passed but status not updated yet
		if (timeUntilMatch <= 0) {
			return FIFTEEN_SECONDS_CACHE + 2000;
		}

		// 45 minutes before: lineups appear
		if (timeUntilMatch <= 45 * 60) {
			return FIFTEEN_SECONDS_CACHE + 2000;
		}

		// 1 hour before: active pre-match period
		if (timeUntilMatch <= 60 * 60) {
			return FIFTEEN_SECONDS_CACHE + 2000;
		}

		// 8 hours before: refetch every hour
		if (timeUntilMatch <= 8 * 60 * 60) {
			return ONE_HOUR_CACHE;
		}

		// Further future: no polling
		return false;
	}

	// Default: no polling
	return false;
}

/**
 * Calculate stale time based on match status and time until match
 */
function getStaleTime(
	status: string | undefined,
	matchTimestamp: number | undefined,
): number {
	if (!status || !matchTimestamp) {
		return FIFTEEN_SECONDS_CACHE;
	}

	const nowSeconds = Date.now() / 1000;
	const timeUntilMatch = matchTimestamp - nowSeconds;

	// LIVE matches: 15s stale time
	if (FIXTURE_IS_LIVE_STATUS.includes(status)) {
		return FIFTEEN_SECONDS_CACHE;
	}

	// FINISHED matches: 1 day stale time
	if (FIXTURE_IS_FINISHED_STATUS.includes(status)) {
		return ONE_DAY_CACHE;
	}

	// NOT_STARTED: dynamic based on time until match
	if (status === "NS" || status === "TBD") {
		// Match has passed but status not updated
		if (timeUntilMatch <= 0) {
			return FIFTEEN_SECONDS_CACHE;
		}

		// 1 hour before: 15s stale time
		if (timeUntilMatch <= 60 * 60) {
			return FIFTEEN_SECONDS_CACHE;
		}

		// 8 hours before: 1 hour stale time
		if (timeUntilMatch <= 8 * 60 * 60) {
			return ONE_HOUR_CACHE;
		}

		// 24 hours before: 1 hour stale time
		if (timeUntilMatch <= 24 * 60 * 60) {
			return ONE_HOUR_CACHE;
		}

		// 7 days before: 6 hour stale time
		if (timeUntilMatch <= 7 * 24 * 60 * 60) {
			return SIX_HOURS_CACHE;
		}

		// Further future: 1 day stale time
		return ONE_DAY_CACHE;
	}

	// Default: 15s (safe for unknown statuses)
	return FIFTEEN_SECONDS_CACHE;
}

/**
 * Query options for fixture detail
 */
export interface FixtureDetailQueryParams {
	fixtureId: number;
}

/**
 * Create query options for fixture detail
 *
 * This query uses dynamic refetchInterval based on the fixture's status
 * and time until match. The interval is calculated on each refetch by
 * passing a function to React Query.
 */
export function fixtureByIdQuery({ fixtureId }: FixtureDetailQueryParams) {
	const queryKey = createFixtureQueryKey(fixtureId);

	const queryFn = async ({
		signal,
	}: {
		signal?: AbortSignal;
	}): Promise<FixturesResponse> => {
		return fetchFixtureDetail({ fixtureId, signal });
	};

	return {
		queryKey,
		queryFn,
		// Initial values - will be overridden by refetchInterval function
		staleTime: FIFTEEN_SECONDS_CACHE,
		gcTime: ONE_WEEK_CACHE,
		refetchOnMount: true as const,
		refetchOnWindowFocus: true,
		refetchIntervalInBackground: false,
		// Retry configuration
		retry: (failureCount: number, error: Error) => {
			if (error instanceof FetchError) {
				return (
					(error.status === 503 || error.status === 429) && failureCount < 3
				);
			}
			return failureCount < 3;
		},
		retryDelay: (attemptIndex: number) => {
			return Math.min(1000 * 2 ** attemptIndex, 5000);
		},
	};
}

/**
 * Get dynamic query options based on current fixture data
 * Used to calculate refetchInterval as a function
 */
export function getFixtureRefetchInterval(
	data: FixturesResponse | undefined,
): number | false {
	const fixture = data?.response?.[0];
	if (!fixture) return false;

	const status = fixture.fixture.status.short;
	const matchTimestamp = fixture.fixture.timestamp;

	return getRefetchInterval(status, matchTimestamp);
}

/**
 * Get dynamic stale time based on current fixture data
 */
export function getFixtureStaleTime(
	data: FixturesResponse | undefined,
): number {
	const fixture = data?.response?.[0];
	if (!fixture) return FIFTEEN_SECONDS_CACHE;

	const status = fixture.fixture.status.short;
	const matchTimestamp = fixture.fixture.timestamp;

	return getStaleTime(status, matchTimestamp);
}

/**
 * Check if fixture status indicates match is live
 */
export function isFixtureLive(data: FixturesResponse | undefined): boolean {
	const fixture = data?.response?.[0];
	if (!fixture) return false;
	return FIXTURE_IS_LIVE_STATUS.includes(fixture.fixture.status.short);
}

/**
 * Check if fixture status indicates match is finished
 */
export function isFixtureFinished(data: FixturesResponse | undefined): boolean {
	const fixture = data?.response?.[0];
	if (!fixture) return false;
	return FIXTURE_IS_FINISHED_STATUS.includes(fixture.fixture.status.short);
}

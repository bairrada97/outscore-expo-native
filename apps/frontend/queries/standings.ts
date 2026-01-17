import { API_BASE_URL, ONE_DAY_CACHE, ONE_HOUR_CACHE } from "@/utils/constants";
import type { StandingsResponse } from "@outscore/shared-types";

/**
 * Query key factory for standings
 */
export function createStandingsQueryKey(
	league: number,
	season: number,
): (string | number)[] {
	return ["standings", league, season];
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
 * Fetch standings from the API
 */
async function fetchStandings({
	league,
	season,
	signal,
	timeoutMs = 30000,
}: {
	league: number;
	season: number;
	signal?: AbortSignal;
	timeoutMs?: number;
}): Promise<StandingsResponse> {
	const params = new URLSearchParams();
	params.set("league", String(league));
	params.set("season", String(season));

	const controller = signal ? null : new AbortController();
	const abortSignal = signal ?? controller?.signal;

	let timeoutId: ReturnType<typeof setTimeout> | null = null;
	if (!signal && timeoutMs > 0 && controller) {
		timeoutId = setTimeout(() => {
			controller.abort();
		}, timeoutMs);
	}

	try {
		const url = new URL("/standings", API_BASE_URL);
		url.search = params.toString();
		const fetchOptions: RequestInit = {
			signal: abortSignal as RequestInit["signal"],
		};
		const response = await fetch(url.toString(), fetchOptions);

		if (timeoutId) clearTimeout(timeoutId);

		if (!response.ok) {
			throw new FetchError(
				`Failed to fetch standings: ${response.statusText}`,
				response.status,
			);
		}

		const json = (await response.json()) as { data: StandingsResponse };
		return json.data;
	} catch (error) {
		if (timeoutId) clearTimeout(timeoutId);
		if (error instanceof Error && error.name === "AbortError") {
			throw new FetchError("Request timeout or aborted", 408);
		}
		throw error;
	}
}

/**
 * Query options for standings
 */
export interface StandingsQueryParams {
	league: number;
	season: number;
}

/**
 * Create query options for standings
 */
export function standingsQuery({ league, season }: StandingsQueryParams) {
	const queryKey = createStandingsQueryKey(league, season);

	const queryFn = async ({
		signal,
	}: {
		signal?: AbortSignal;
	}): Promise<StandingsResponse> => {
		return fetchStandings({ league, season, signal });
	};

	return {
		queryKey,
		queryFn,
		staleTime: ONE_HOUR_CACHE,
		gcTime: ONE_DAY_CACHE,
		refetchOnMount: true,
		refetchOnWindowFocus: false,
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


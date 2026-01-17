import { API_BASE_URL, ONE_DAY_CACHE, ONE_HOUR_CACHE } from "@/utils/constants";
import type { TeamStatisticsResponse } from "@outscore/shared-types";

/**
 * Query key factory for team statistics
 */
export function createTeamStatisticsQueryKey(
	league: number,
	season: number,
	team: number,
): (string | number)[] {
	return ["teamStatistics", league, season, team];
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
 * Fetch team statistics from the API
 */
async function fetchTeamStatistics({
	league,
	season,
	team,
	signal,
	timeoutMs = 30000,
}: {
	league: number;
	season: number;
	team: number;
	signal?: AbortSignal;
	timeoutMs?: number;
}): Promise<TeamStatisticsResponse> {
	const params = new URLSearchParams();
	params.set("league", String(league));
	params.set("season", String(season));
	params.set("team", String(team));

	const controller = signal ? null : new AbortController();
	const abortSignal = signal ?? controller?.signal;

	let timeoutId: ReturnType<typeof setTimeout> | null = null;
	if (!signal && timeoutMs > 0 && controller) {
		timeoutId = setTimeout(() => {
			controller.abort();
		}, timeoutMs);
	}

	try {
		const url = new URL("/teams/statistics", API_BASE_URL);
		url.search = params.toString();
		const fetchOptions: RequestInit = {
			signal: abortSignal as RequestInit["signal"],
		};
		const response = await fetch(url.toString(), fetchOptions);

		if (timeoutId) clearTimeout(timeoutId);

		if (!response.ok) {
			throw new FetchError(
				`Failed to fetch team statistics: ${response.statusText}`,
				response.status,
			);
		}

		const json = (await response.json()) as { data: TeamStatisticsResponse };
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
 * Query options for team statistics
 */
export interface TeamStatisticsQueryParams {
	league: number;
	season: number;
	team: number;
}

/**
 * Create query options for team statistics
 */
export function teamStatisticsQuery({
	league,
	season,
	team,
}: TeamStatisticsQueryParams) {
	const queryKey = createTeamStatisticsQueryKey(league, season, team);

	const queryFn = async ({
		signal,
	}: {
		signal?: AbortSignal;
	}): Promise<TeamStatisticsResponse> => {
		return fetchTeamStatistics({ league, season, team, signal });
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

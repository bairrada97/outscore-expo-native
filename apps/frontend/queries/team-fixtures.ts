import { API_BASE_URL, ONE_DAY_CACHE, ONE_HOUR_CACHE } from "@/utils/constants";
import type { FixturesResponse } from "@outscore/shared-types";

/**
 * Query key factory for team fixtures
 */
export function createTeamFixturesQueryKey(
	teamId: number,
	last: number,
): (string | number)[] {
	return ["teamFixtures", teamId, last];
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
 * Fetch team fixtures from the API
 */
async function fetchTeamFixtures({
	teamId,
	last,
	signal,
	timeoutMs = 30000,
}: {
	teamId: number;
	last: number;
	signal?: AbortSignal;
	timeoutMs?: number;
}): Promise<FixturesResponse> {
	const params = new URLSearchParams();
	params.set("team", String(teamId));
	params.set("last", String(last));

	const controller = signal ? null : new AbortController();
	const abortSignal = signal ?? controller?.signal;

	let timeoutId: ReturnType<typeof setTimeout> | null = null;
	if (!signal && timeoutMs > 0 && controller) {
		timeoutId = setTimeout(() => {
			controller.abort();
		}, timeoutMs);
	}

	try {
		const url = new URL("/fixtures", API_BASE_URL);
		url.search = params.toString();
		const fetchOptions: RequestInit = {
			signal: abortSignal as RequestInit["signal"],
		};
		const response = await fetch(url.toString(), fetchOptions);

		if (timeoutId) clearTimeout(timeoutId);

		if (!response.ok) {
			throw new FetchError(
				`Failed to fetch team fixtures: ${response.statusText}`,
				response.status,
			);
		}

		const json = (await response.json()) as { data: FixturesResponse };
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
 * Query options for team fixtures
 */
export interface TeamFixturesQueryParams {
	teamId: number;
	last?: number;
}

/**
 * Create query options for team fixtures
 */
export function teamFixturesQuery({ teamId, last = 50 }: TeamFixturesQueryParams) {
	const queryKey = createTeamFixturesQueryKey(teamId, last);

	const queryFn = async ({
		signal,
	}: {
		signal?: AbortSignal;
	}): Promise<FixturesResponse> => {
		return fetchTeamFixtures({ teamId, last, signal });
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


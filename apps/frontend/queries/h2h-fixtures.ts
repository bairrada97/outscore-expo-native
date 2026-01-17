import { API_BASE_URL, ONE_DAY_CACHE, ONE_HOUR_CACHE } from "@/utils/constants";
import type { FixturesResponse } from "@outscore/shared-types";

/**
 * Query key factory for H2H fixtures
 */
export function createH2HFixturesQueryKey(
	team1: number,
	team2: number,
	last: number,
): (string | number)[] {
	return ["h2hFixtures", team1, team2, last];
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
 * Fetch H2H fixtures from the API
 */
async function fetchH2HFixtures({
	team1,
	team2,
	last,
	signal,
	timeoutMs = 30000,
}: {
	team1: number;
	team2: number;
	last: number;
	signal?: AbortSignal;
	timeoutMs?: number;
}): Promise<FixturesResponse> {
	const params = new URLSearchParams();
	params.set("h2h", `${team1}-${team2}`);
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
		const url = new URL("/fixtures/headtohead", API_BASE_URL);
		url.search = params.toString();
		const fetchOptions: RequestInit = {
			signal: abortSignal as RequestInit["signal"],
		};
		const response = await fetch(url.toString(), fetchOptions);

		if (timeoutId) clearTimeout(timeoutId);

		if (!response.ok) {
			throw new FetchError(
				`Failed to fetch H2H fixtures: ${response.statusText}`,
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
 * Query options for H2H fixtures
 */
export interface H2HFixturesQueryParams {
	team1: number;
	team2: number;
	last?: number;
}

/**
 * Create query options for H2H fixtures
 */
export function h2hFixturesQuery({
	team1,
	team2,
	last = 20,
}: H2HFixturesQueryParams) {
	const queryKey = createH2HFixturesQueryKey(team1, team2, last);

	const queryFn = async ({
		signal,
	}: {
		signal?: AbortSignal;
	}): Promise<FixturesResponse> => {
		return fetchH2HFixtures({ team1, team2, last, signal });
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

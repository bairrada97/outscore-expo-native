import { API_BASE_URL, ONE_DAY_CACHE, ONE_HOUR_CACHE } from "@/utils/constants";
import type { InjuriesResponse } from "@outscore/shared-types";

/**
 * Query key factory for injuries
 */
export function createInjuriesQueryKey(
	fixtureId: number,
	season: number,
): (string | number)[] {
	return ["injuries", fixtureId, season];
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
 * Fetch injuries from the API
 */
async function fetchInjuries({
	fixtureId,
	season,
	signal,
	timeoutMs = 30000,
}: {
	fixtureId: number;
	season: number;
	signal?: AbortSignal;
	timeoutMs?: number;
}): Promise<InjuriesResponse> {
	const params = new URLSearchParams();
	params.set("fixture", String(fixtureId));
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
		const url = new URL("/fixtures/injuries", API_BASE_URL);
		url.search = params.toString();
		const fetchOptions: RequestInit = {
			signal: abortSignal as RequestInit["signal"],
		};
		const response = await fetch(url.toString(), fetchOptions);

		if (timeoutId) clearTimeout(timeoutId);

		if (!response.ok) {
			throw new FetchError(
				`Failed to fetch injuries: ${response.statusText}`,
				response.status,
			);
		}

		const json = (await response.json()) as { data: InjuriesResponse };
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
 * Query options for injuries
 */
export interface InjuriesQueryParams {
	fixtureId: number;
	season: number;
}

/**
 * Create query options for injuries
 */
export function injuriesQuery({ fixtureId, season }: InjuriesQueryParams) {
	const queryKey = createInjuriesQueryKey(fixtureId, season);

	const queryFn = async ({
		signal,
	}: {
		signal?: AbortSignal;
	}): Promise<InjuriesResponse> => {
		return fetchInjuries({ fixtureId, season, signal });
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

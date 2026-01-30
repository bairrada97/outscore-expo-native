import { API_BASE_URL, ONE_HOUR_CACHE } from "@/utils/constants";
import { FetchError, fetchJsonWithTimeout } from "@/utils/fetch-with-timeout";
import type {
	RawFixtureForDisplay,
	RawStandingsForDisplay,
} from "./insights-by-fixture-id";

/**
 * Fixture context data (H2H, team fixtures, standings)
 * Independent of insights - works for any match status
 */
export type FixtureContextResponse = {
	h2hFixtures: RawFixtureForDisplay[];
	homeTeamFixtures: RawFixtureForDisplay[];
	awayTeamFixtures: RawFixtureForDisplay[];
	standings?: RawStandingsForDisplay;
};

/**
 * Query key factory for fixture context
 */
export function createFixtureContextQueryKey(fixtureId: number): string[] {
	return ["fixture-context", String(fixtureId)];
}

async function fetchFixtureContext({
	fixtureId,
}: {
	fixtureId: number;
}): Promise<FixtureContextResponse> {
	const url = new URL(`/fixtures/${fixtureId}/context`, API_BASE_URL);

	const response = await fetchJsonWithTimeout<{
		status: string;
		data: FixtureContextResponse;
	}>({
		url: url.toString(),
		timeoutMs: 15000,
		errorMessage: "Failed to fetch fixture context",
	});

	if (response.status !== "success" || !response.data) {
		throw new FetchError(`Failed to fetch fixture context from ${url}`, 500);
	}

	return response.data;
}

/**
 * React Query options for fixture context
 */
export function fixtureContextQuery({ fixtureId }: { fixtureId: number }) {
	return {
		queryKey: createFixtureContextQueryKey(fixtureId),
		queryFn: () => fetchFixtureContext({ fixtureId }),
		staleTime: ONE_HOUR_CACHE,
		gcTime: ONE_HOUR_CACHE * 2,
		enabled: Number.isFinite(fixtureId) && fixtureId > 0,
		retry: 2,
	};
}

import { API_BASE_URL, FIFTEEN_SECONDS_CACHE, ONE_WEEK_CACHE } from "@/utils/constants";

/**
 * Minimal typing for the insights response we render in the fixture screen.
 * (Backend types are not shared with the frontend package.)
 */
export type BettingInsightsResponse = {
  fixtureId: number;
  match: {
    homeTeam: string;
    awayTeam: string;
    league: string;
    date: string;
    status: string;
  };
  predictions: Array<{
    market: string;
    line?: number;
    probabilities: Record<string, number | undefined>;
    confidence?: "HIGH" | "MEDIUM" | "LOW";
  }>;
  homeInsights?: Array<{ text: string }>;
  awayInsights?: Array<{ text: string }>;
  h2hInsights?: Array<{ text: string }>;
  overallConfidence?: "HIGH" | "MEDIUM" | "LOW";
  generatedAt?: string;
};

/**
 * Query key factory for fixture insights
 */
export function createFixtureInsightsQueryKey(fixtureId: number): string[] {
  return ["fixture-insights", String(fixtureId)];
}

class FetchError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "FetchError";
  }
}

async function fetchFixtureInsights({
  fixtureId,
  signal,
  timeoutMs = 30000,
}: {
  fixtureId: number;
  signal?: AbortSignal;
  timeoutMs?: number;
}): Promise<BettingInsightsResponse> {
  const controller = signal ? null : new AbortController();
  const abortSignal = signal ?? controller?.signal;

  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  if (!signal && timeoutMs > 0 && controller) {
    timeoutId = setTimeout(() => {
      controller.abort();
    }, timeoutMs);
  }

  try {
    const url = new URL(`/fixtures/${fixtureId}/insights`, API_BASE_URL);
    const response = await fetch(url.toString(), {
      signal: abortSignal as RequestInit["signal"],
    });

    if (timeoutId) clearTimeout(timeoutId);

    if (!response.ok) {
      throw new FetchError(
        `Failed to fetch fixture insights: ${response.statusText}`,
        response.status,
      );
    }

    const json = (await response.json()) as { data: BettingInsightsResponse };
    return json.data;
  } catch (error) {
    if (timeoutId) clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new FetchError("Request timeout or aborted", 408);
    }
    throw error;
  }
}

export interface FixtureInsightsQueryParams {
  fixtureId: number;
}

export function insightsByFixtureIdQuery({ fixtureId }: FixtureInsightsQueryParams) {
  const queryKey = createFixtureInsightsQueryKey(fixtureId);

  const queryFn = async ({ signal }: { signal?: AbortSignal }) => {
    return fetchFixtureInsights({ fixtureId, signal });
  };

  return {
    queryKey,
    queryFn,
    staleTime: FIFTEEN_SECONDS_CACHE,
    gcTime: ONE_WEEK_CACHE,
    refetchOnMount: true as const,
    refetchOnWindowFocus: true,
    refetchIntervalInBackground: false,
    retry: (failureCount: number, error: Error) => {
      if (error instanceof FetchError) {
        return (error.status === 503 || error.status === 429) && failureCount < 3;
      }
      return failureCount < 3;
    },
    retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 5000),
  };
}





import { API_BASE_URL, FIFTEEN_SECONDS_CACHE, ONE_WEEK_CACHE } from "@/utils/constants";
import { FetchError, fetchJsonWithTimeout } from "@/utils/fetch-with-timeout";

/**
 * Minimal typing for the insights response we render in the fixture screen.
 * (Backend types are not shared with the frontend package.)
 */
/**
 * Raw fixture data for H2H display (from insights response)
 */
export type RawFixtureForDisplay = {
  id: number;
  date: string;
  timestamp: number;
  status: {
    short: string;
    long: string;
  };
  teams: {
    home: {
      id: number;
      name: string;
      logo: string;
      winner: boolean | null;
    };
    away: {
      id: number;
      name: string;
      logo: string;
      winner: boolean | null;
    };
  };
  goals: {
    home: number | null;
    away: number | null;
  };
  score: {
    fulltime: {
      home: number | null;
      away: number | null;
    };
    penalty: {
      home: number | null;
      away: number | null;
    };
  };
  league: {
    id: number;
    name: string;
    season: number;
  };
};

/**
 * Raw standings data for standings display (from insights response)
 */
export type RawStandingsForDisplay = {
  leagueId: number;
  season: number;
  rows: Array<{
    rank: number;
    team: {
      id: number;
      name: string;
      logo?: string;
    };
    points: number;
    goalsDiff: number;
    played: number;
    win: number;
    draw: number;
    loss: number;
    goalsFor: number;
    goalsAgainst: number;
    form: string | null;
    description: string | null;
  }>;
};

export type BettingInsightsResponse = {
  fixtureId: number;
  match: {
    homeTeam: string;
    awayTeam: string;
    league: string;
    date: string;
    status: string;
  };
  homeTeamContext?: {
    dna?: {
      /**
       * How often this team goes over each goal line (0-100).
       * Keys are stringified lines like "2.5".
       */
      goalLineOverPct?: Record<string, number | undefined>;
      /**
       * How often this team lands BTTS = Yes (0-100).
       */
      bttsYesPct?: number;
    };
  };
  awayTeamContext?: {
    dna?: {
      /**
       * How often this team goes over each goal line (0-100).
       * Keys are stringified lines like "2.5".
       */
      goalLineOverPct?: Record<string, number | undefined>;
      /**
       * How often this team lands BTTS = Yes (0-100).
       */
      bttsYesPct?: number;
    };
  };
  simulations?: Array<{
    scenarioType: string;
    line?: number;
    probabilityDistribution: Record<string, number | undefined>;
    signalStrength?: "Strong" | "Moderate" | "Balanced" | "Weak";
    modelReliability?: "HIGH" | "MEDIUM" | "LOW";
    insights?: Array<{
      text: string;
      parts?: Array<{ text: string; bold?: boolean }>;
      emoji?: string;
      category?: string;
      severity?: string;
    }>;
    mostProbableOutcome?: string;
  }>;
  homeInsights?: Array<{
    text: string;
    parts?: Array<{ text: string; bold?: boolean }>;
    category?: string;
    severity?: string;
  }>;
  awayInsights?: Array<{
    text: string;
    parts?: Array<{ text: string; bold?: boolean }>;
    category?: string;
    severity?: string;
  }>;
  h2hInsights?: Array<{
    text: string;
    parts?: Array<{ text: string; bold?: boolean }>;
    category?: string;
    severity?: string;
  }>;
  matchFacts?: Array<{
    id: string;
    title: string;
    value: string;
    subtitle?: string;
    side?: "HOME" | "AWAY" | "BOTH";
    icon?: string;
  }>;
  keyInsights?: {
    home: Array<{
      text: string;
      parts?: Array<{ text: string; bold?: boolean }>;
      category?: string;
      severity?: string;
    }>;
    away: Array<{
      text: string;
      parts?: Array<{ text: string; bold?: boolean }>;
      category?: string;
      severity?: string;
    }>;
  };
  overallConfidence?: "HIGH" | "MEDIUM" | "LOW";
  generatedAt?: string;
  /** Raw H2H fixtures for H2H tab display */
  h2hFixtures?: RawFixtureForDisplay[];
  /** Raw home team fixtures for H2H tab display */
  homeTeamFixtures?: RawFixtureForDisplay[];
  /** Raw away team fixtures for H2H tab display */
  awayTeamFixtures?: RawFixtureForDisplay[];
  /** Raw standings for standings tab display */
  standings?: RawStandingsForDisplay;
};

/**
 * Query key factory for fixture insights
 */
export function createFixtureInsightsQueryKey(fixtureId: number): string[] {
  return ["fixture-insights", String(fixtureId)];
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
  const url = new URL(`/fixtures/${fixtureId}/insights`, API_BASE_URL);

  const json = await fetchJsonWithTimeout<{ data: BettingInsightsResponse }>({
    url: url.toString(),
    signal,
    timeoutMs,
    errorMessage: "Failed to fetch fixture insights",
  });

  return json.data;
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





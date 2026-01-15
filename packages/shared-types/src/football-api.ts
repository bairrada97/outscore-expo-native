/**
 * API Response Types
 */

/**
 * Fixture Event types (goals, cards, substitutions, VAR decisions)
 */
export interface FixtureEvent {
  time: {
    elapsed: number;
    extra: number | null;
  };
  team: {
    id: number;
    name: string;
    logo: string;
  };
  player: {
    id: number | null;
    name: string | null;
  };
  assist: {
    id: number | null;
    name: string | null;
  };
  type: 'Goal' | 'Card' | 'subst' | 'Var';
  detail: string;
  comments: string | null;
}

export interface Fixture {
  fixture: {
    id: number;
    referee: string | null;
    timezone: string;
    date: string;
    timestamp: number;
    periods: {
      first: number | null;
      second: number | null;
    };
    venue: {
      id: number | null;
      name: string;
      city: string;
    };
    status: {
      long: string;
      short: FixtureStatusShort;
      elapsed: number | null;
    };
  };
  league: {
    id: number;
    name: string;
    country: string;
    logo: string;
    flag: string | null;
    season: number;
    round: string;
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
    halftime: {
      home: number | null;
      away: number | null;
    };
    fulltime: {
      home: number | null;
      away: number | null;
    };
    extratime: {
      home: number | null;
      away: number | null;
    };
    penalty: {
      home: number | null;
      away: number | null;
    };
  };
  events?: FixtureEvent[];
}

export interface FixturesResponse {
  get: string;
  parameters: Record<string, string>;
  // API-Football returns an array of error strings/objects depending on endpoint.
  // Keep it permissive but avoid `any`.
  errors: unknown[];
  results: number;
  paging: {
    current: number;
    total: number;
  };
  response: Fixture[];
}

/**
 * Formatted Response Types
 */

export interface FormattedMatch {
  id: number;
  date: string;
  time: string;
  timestamp: number;
  timezone: string;
  status: {
    long: string;
    short: FixtureStatusShort; 
    elapsed: number | null;
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
  goals: {
    home: number | null;
    away: number | null;
  };
}

export interface FormattedLeague {
  id: number;
  name: string;
  logo: string;
  matches: FormattedMatch[];
}

export interface FormattedCountry {
  name: string;
  flag: string | null;
  leagues: FormattedLeague[];
}

export type FormattedFixturesResponse = FormattedCountry[]; 

/**
 * Fixture status constants for classification
 */
export const FIXTURE_STATUS = {
  // API-Football status.short values
  // Notes:
  // - 'SUSP' (suspended) and 'INT' (interrupted) are treated as "live-ish" for polling/classification.
  // - 'AWD' (awarded) is treated as finished.
  LIVE: ['1H', '2H', 'HT', 'ET', 'INT', 'BT', 'P', 'SUSP'],
  FINISHED: ['FT', 'AET', 'PEN', 'AWD'],
  NOT_STARTED: ['NS'],
  CANCELLED: ['CANC', 'PST', 'ABD', 'WO', 'TBD'],
} as const;

/**
 * Derived types from FIXTURE_STATUS to avoid drift
 */
type LiveStatus = typeof FIXTURE_STATUS.LIVE[number];
type FinishedStatus = typeof FIXTURE_STATUS.FINISHED[number];
type NotStartedStatus = typeof FIXTURE_STATUS.NOT_STARTED[number];
type CancelledStatus = typeof FIXTURE_STATUS.CANCELLED[number];

/**
 * Union type derived from FIXTURE_STATUS constant
 */
export type FixtureStatusShort = LiveStatus | FinishedStatus | NotStartedStatus | CancelledStatus;

/**
 * Check if a fixture status indicates the match is live
 */
export function isLiveStatus(status: FixtureStatusShort): status is LiveStatus {
  return (FIXTURE_STATUS.LIVE as readonly string[]).includes(status);
}

/**
 * Check if a fixture status indicates the match is finished
 */
export function isFinishedStatus(status: FixtureStatusShort): status is FinishedStatus {
  return (FIXTURE_STATUS.FINISHED as readonly string[]).includes(status);
}

/**
 * Check if a fixture status indicates the match has not started
 */
export function isNotStartedStatus(status: FixtureStatusShort): status is NotStartedStatus {
  return (FIXTURE_STATUS.NOT_STARTED as readonly string[]).includes(status);
}

// ============================================================================
// STANDINGS RESPONSE TYPES
// ============================================================================

/**
 * API-Football /standings endpoint response
 */
export interface StandingsResponse {
  get: "standings";
  parameters: {
    league: string;
    season: string;
  };
  errors: unknown[];
  results: number;
  paging: {
    current: number;
    total: number;
  };
  response: Array<{
    league: StandingsLeague;
  }>;
}

/**
 * League data within standings response
 */
export interface StandingsLeague {
  id: number;
  name: string;
  country: string;
  logo: string;
  flag: string | null;
  season: number;
  /**
   * 2D array structure:
   * - Outer array: different tables/groups (e.g., overall table, group stages)
   * - Inner array: rows within that table/group
   */
  standings: StandingsRow[][];
}

/**
 * Single row in a standings table
 */
export interface StandingsRow {
  rank: number;
  team: StandingsTeamRef;
  points: number;
  goalsDiff: number;
  group: string | null;
  form: string | null;
  status: string | null;
  description: string | null;
  all: StandingsRecord;
  home: StandingsRecord;
  away: StandingsRecord;
  update: string;
}

/**
 * Team reference in standings
 */
export interface StandingsTeamRef {
  id: number;
  name: string;
  logo: string;
}

/**
 * Record statistics (all/home/away)
 */
export interface StandingsRecord {
  played: number;
  win: number;
  draw: number;
  lose: number;
  goals: {
    for: number;
    against: number;
  };
}
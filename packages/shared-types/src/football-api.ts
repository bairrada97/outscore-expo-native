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
  errors: any[];
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
  LIVE: ['1H', '2H', 'HT', 'ET', 'INT', 'BT', 'P'],
  FINISHED: ['FT', 'AET', 'PEN'],
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

/**
 * Team Statistics Response Types
 * Endpoint: /teams/statistics?league={league}&season={season}&team={team}
 */
export interface GoalMinuteStats {
  '0-15': { total: number | null; percentage: string | null };
  '16-30': { total: number | null; percentage: string | null };
  '31-45': { total: number | null; percentage: string | null };
  '46-60': { total: number | null; percentage: string | null };
  '61-75': { total: number | null; percentage: string | null };
  '76-90': { total: number | null; percentage: string | null };
  '91-105': { total: number | null; percentage: string | null };
  '106-120': { total: number | null; percentage: string | null };
}

export interface UnderOverStats {
  '0.5': { over: number; under: number };
  '1.5': { over: number; under: number };
  '2.5': { over: number; under: number };
  '3.5': { over: number; under: number };
  '4.5': { over: number; under: number };
}

export interface TeamStatistics {
  league: {
    id: number;
    name: string;
    country: string;
    logo: string;
    flag: string | null;
    season: number;
  };
  team: {
    id: number;
    name: string;
    logo: string;
  };
  form: string | null;
  fixtures: {
    played: { home: number; away: number; total: number };
    wins: { home: number; away: number; total: number };
    draws: { home: number; away: number; total: number };
    loses: { home: number; away: number; total: number };
  };
  goals: {
    for: {
      total: { home: number; away: number; total: number };
      average: { home: string; away: string; total: string };
      minute: GoalMinuteStats;
      under_over: UnderOverStats;
    };
    against: {
      total: { home: number; away: number; total: number };
      average: { home: string; away: string; total: string };
      minute: GoalMinuteStats;
      under_over: UnderOverStats;
    };
  };
  biggest: {
    streak: { wins: number; draws: number; loses: number };
    wins: { home: string | null; away: string | null };
    loses: { home: string | null; away: string | null };
    goals: {
      for: { home: number; away: number };
      against: { home: number; away: number };
    };
  };
  clean_sheet: { home: number; away: number; total: number };
  failed_to_score: { home: number; away: number; total: number };
  penalty: {
    scored: { total: number; percentage: string };
    missed: { total: number; percentage: string };
    total: number;
  };
  lineups: Array<{
    formation: string;
    played: number;
  }>;
  cards: {
    yellow: GoalMinuteStats;
    red: GoalMinuteStats;
  };
}

export interface TeamStatisticsResponse {
  get: string;
  parameters: Record<string, string>;
  errors: any[];
  results: number;
  paging: {
    current: number;
    total: number;
  };
  response: TeamStatistics;
}

/**
 * Injuries Response Types
 * Endpoint: /injuries?fixture={fixtureId}
 */
export interface Injury {
  player: {
    id: number;
    name: string;
    photo: string;
    type: string;
    reason: string;
  };
  team: {
    id: number;
    name: string;
    logo: string;
  };
  fixture: {
    id: number;
    timezone: string;
    date: string;
    timestamp: number;
  };
  league: {
    id: number;
    season: number;
    name: string;
    country: string;
    logo: string;
    flag: string | null;
  };
}

export interface InjuriesResponse {
  get: string;
  parameters: Record<string, string>;
  errors: any[];
  results: number;
  paging: {
    current: number;
    total: number;
  };
  response: Injury[];
}

/**
 * Standings Response Types
 * Endpoint: /standings?league={league}&season={season}
 */
export interface StandingTeam {
  rank: number;
  team: {
    id: number;
    name: string;
    logo: string;
  };
  points: number;
  goalsDiff: number;
  group: string;
  form: string;
  status: string;
  description: string | null;
  all: {
    played: number;
    win: number;
    draw: number;
    lose: number;
    goals: {
      for: number;
      against: number;
    };
  };
  home: {
    played: number;
    win: number;
    draw: number;
    lose: number;
    goals: {
      for: number;
      against: number;
    };
  };
  away: {
    played: number;
    win: number;
    draw: number;
    lose: number;
    goals: {
      for: number;
      against: number;
    };
  };
  update: string;
}

export interface StandingsLeague {
  id: number;
  name: string;
  country: string;
  logo: string;
  flag: string | null;
  season: number;
  standings: StandingTeam[][];
}

export interface StandingsResponse {
  get: string;
  parameters: Record<string, string>;
  errors: any[];
  results: number;
  paging: {
    current: number;
    total: number;
  };
  response: Array<{
    league: StandingsLeague;
  }>;
}
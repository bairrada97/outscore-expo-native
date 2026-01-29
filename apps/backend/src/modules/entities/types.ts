/**
 * D1 Entity Types
 *
 * TypeScript types matching the D1 schema for canonical entities.
 * These types represent the stored form in the database.
 */

// ============================================================================
// PROVIDER TYPES
// ============================================================================

export type Provider = 'api_football' | 'sportmonks';
export type TeamEloSource = 'api_football' | 'clubelo' | 'uefa';
export type EntityType = 'league' | 'team' | 'player';

// ============================================================================
// LEAGUE
// ============================================================================

export interface League {
  id: number;
  name: string;
  country: string | null;
  logo: string | null;
  flag: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeagueInsert {
  name: string;
  country?: string | null;
  logo?: string | null;
  flag?: string | null;
}

// ============================================================================
// TEAM
// ============================================================================

export interface Team {
  id: number;
  name: string;
  logo: string | null;
  country: string | null;
  created_at: string;
  updated_at: string;
}

export interface TeamInsert {
  name: string;
  logo?: string | null;
  country?: string | null;
}

// ============================================================================
// EXTERNAL ID MAPPING
// ============================================================================

export interface ExternalId {
  id: number;
  provider: Provider;
  entity_type: EntityType;
  provider_id: string;
  internal_id: number;
  match_confidence: number | null;
  match_method: string | null;
  created_at: string;
}

export interface ExternalIdInsert {
  provider: Provider;
  entity_type: EntityType;
  provider_id: string;
  internal_id: number;
  match_confidence?: number | null;
  match_method?: string | null;
}

// ============================================================================
// ELO RATINGS
// ============================================================================

export interface TeamEloRating {
  id: number;
  team_id: number;
  as_of_date: string;
  elo: number;
  games: number;
  last_fixture_provider: Provider;
  last_fixture_id: string;
  updated_at: string;
}

export interface TeamEloRatingInsert {
  team_id: number;
  as_of_date: string;
  elo: number;
  games: number;
  last_fixture_provider: Provider;
  last_fixture_id: string;
}

export interface TeamEloCurrent {
  team_id: number;
  elo: number;
  games: number;
  as_of_date: string;
  source: TeamEloSource;
  updated_at: string;
}

export interface TeamEloCurrentUpsert {
  team_id: number;
  elo: number;
  games: number;
  as_of_date: string;
  source?: TeamEloSource;
}

// ============================================================================
// LEAGUE STATS (SCORING PROFILE)
// ============================================================================

export interface LeagueStats {
  provider: Provider;
  league_id: number;
  season: number;
  matches: number;
  avg_goals: number;
  over_2_5_rate: number;
  btts_rate: number;
  home_goals_avg: number;
  away_goals_avg: number;
  updated_at: string;
}

export interface LeagueStatsUpsert {
  provider?: Provider;
  league_id: number;
  season: number;
  matches: number;
  avg_goals: number;
  over_2_5_rate: number;
  btts_rate: number;
  home_goals_avg: number;
  away_goals_avg: number;
}

// ============================================================================
// UEFA COEFFICIENTS
// ============================================================================

export interface UefaAssociationCoefficient {
  country_code: string;
  as_of_season: number;
  rank: number | null;
  coefficient5y: number | null;
  created_at: string;
  updated_at: string;
}

export interface UefaAssociationCoefficientInsert {
  country_code: string;
  as_of_season: number;
  rank?: number | null;
  coefficient5y?: number | null;
}

export interface UefaClubCoefficient {
  uefa_club_key: string;
  as_of_season: number;
  name: string;
  country_code: string | null;
  coefficient: number | null;
  created_at: string;
  updated_at: string;
}

export interface UefaClubCoefficientInsert {
  uefa_club_key: string;
  as_of_season: number;
  name: string;
  country_code?: string | null;
  coefficient?: number | null;
}

export interface UefaClubTeamMap {
  uefa_club_key: string;
  as_of_season: number;
  api_football_team_id: number;
  team_id: number | null;
  confidence: number | null;
  method: string | null;
  created_at: string;
  updated_at: string;
}

export interface UefaClubTeamMapInsert {
  uefa_club_key: string;
  as_of_season: number;
  api_football_team_id: number;
  team_id?: number | null;
  confidence?: number | null;
  method?: string | null;
}

// ============================================================================
// TEAM SEASON CONTEXT
// ============================================================================

export interface TeamSeasonContext {
  id: number;
  team_id: number;
  league_id: number;
  season: number;

  // Provenance
  provider: Provider;
  fetched_at: string;
  computed_at: string;
  algo_version: string | null;
  weights_version: string | null;

  // TeamStatistics
  form: string | null;
  games_played: number;
  avg_goals_scored: number;
  avg_goals_conceded: number;
  home_avg_scored: number;
  home_avg_conceded: number;
  away_avg_scored: number;
  away_avg_conceded: number;

  // Mind Layer
  mind_tier: number | null;
  mind_efficiency_index: number | null;
  mind_avg_points_per_game: number | null;
  mind_goal_difference: number | null;
  mind_match_count: number | null;
  mind_has_sufficient_data: number; // 0 or 1

  // Mood Layer
  mood_tier: number | null;
  mood_mind_mood_gap: number | null;
  mood_is_sleeping_giant: number; // 0 or 1
  mood_is_over_performer: number; // 0 or 1
  mood_is_one_season_wonder: number; // 0 or 1
  mood_form_string: string | null;
  mood_last_10_points: number | null;
  mood_last_10_goals_scored: number | null;
  mood_last_10_goals_conceded: number | null;

  // DNA Layer (columns)
  dna_most_played_formation: string | null;
  dna_clean_sheet_percentage: number | null;
  dna_failed_to_score_percentage: number | null;
  dna_btts_yes_rate: number | null;
  dna_is_late_starter: number; // 0 or 1
  dna_first_half_goal_percentage: number | null;
  dna_avg_goals_per_game: number | null;
  dna_avg_goals_conceded_per_game: number | null;

  // DNA Layer (JSON)
  dna_formation_frequency_json: string | null;
  dna_goal_line_over_pct_json: string | null;
  dna_goal_minutes_scoring_json: string | null;
  dna_goal_minutes_conceding_json: string | null;
  dna_danger_zones_json: string | null;

  // Safety Flags
  safety_regression_risk: number; // 0 or 1
  safety_motivation_clash: number; // 0 or 1
  safety_live_dog: number; // 0 or 1
  safety_motivation: string | null;
  safety_consecutive_wins: number;

  // Metadata
  days_since_last_match: number | null;
  seasons_in_league: number;

  created_at: string;
  updated_at: string;
}

export interface TeamSeasonContextInsert {
  team_id: number;
  league_id: number;
  season: number;
  provider?: Provider;
  fetched_at: string;
  computed_at: string;
  algo_version?: string | null;
  weights_version?: string | null;

  // TeamStatistics
  form?: string | null;
  games_played?: number;
  avg_goals_scored?: number;
  avg_goals_conceded?: number;
  home_avg_scored?: number;
  home_avg_conceded?: number;
  away_avg_scored?: number;
  away_avg_conceded?: number;

  // Mind Layer
  mind_tier?: number | null;
  mind_efficiency_index?: number | null;
  mind_avg_points_per_game?: number | null;
  mind_goal_difference?: number | null;
  mind_match_count?: number | null;
  mind_has_sufficient_data?: number;

  // Mood Layer
  mood_tier?: number | null;
  mood_mind_mood_gap?: number | null;
  mood_is_sleeping_giant?: number;
  mood_is_over_performer?: number;
  mood_is_one_season_wonder?: number;
  mood_form_string?: string | null;
  mood_last_10_points?: number | null;
  mood_last_10_goals_scored?: number | null;
  mood_last_10_goals_conceded?: number | null;

  // DNA Layer (columns)
  dna_most_played_formation?: string | null;
  dna_clean_sheet_percentage?: number | null;
  dna_failed_to_score_percentage?: number | null;
  dna_btts_yes_rate?: number | null;
  dna_is_late_starter?: number;
  dna_first_half_goal_percentage?: number | null;
  dna_avg_goals_per_game?: number | null;
  dna_avg_goals_conceded_per_game?: number | null;

  // DNA Layer (JSON)
  dna_formation_frequency_json?: string | null;
  dna_goal_line_over_pct_json?: string | null;
  dna_goal_minutes_scoring_json?: string | null;
  dna_goal_minutes_conceding_json?: string | null;
  dna_danger_zones_json?: string | null;

  // Safety Flags
  safety_regression_risk?: number;
  safety_motivation_clash?: number;
  safety_live_dog?: number;
  safety_motivation?: string | null;
  safety_consecutive_wins?: number;

  // Metadata
  days_since_last_match?: number | null;
  seasons_in_league?: number;
}

// ============================================================================
// STANDINGS
// ============================================================================

export interface StandingsCurrent {
  id: number;
  league_id: number;
  season: number;
  provider: Provider;
  fetched_at: string;
  updated_at: string;
}

export interface StandingsCurrentRow {
  id: number;
  league_id: number;
  season: number;
  team_id: number;
  rank: number;
  points: number;
  played: number;
  win: number;
  draw: number;
  loss: number;
  goals_for: number;
  goals_against: number;
  goal_diff: number;
  form: string | null;
  /** Group/stage label. Stored as non-null in DB ('' when not applicable). */
  group_name: string;
  description: string | null;
  // Denormalized for faster reads (no JOINs needed)
  team_name: string | null;
  league_name: string | null;
  updated_at: string;
}

export interface StandingsCurrentRowInsert {
  league_id: number;
  season: number;
  team_id: number;
  rank: number;
  points?: number;
  played?: number;
  win?: number;
  draw?: number;
  loss?: number;
  goals_for?: number;
  goals_against?: number;
  goal_diff?: number;
  form?: string | null;
  /** Group/stage label. Use '' when not applicable. */
  group_name?: string | null;
  description?: string | null;
  // Denormalized for faster reads (no JOINs needed)
  team_name?: string | null;
  league_name?: string | null;
}

// ============================================================================
// INSIGHTS SNAPSHOT
// ============================================================================

export interface InsightsSnapshot {
  id: number;
  fixture_id: number;
  generated_at: string;
  source_provider: Provider;
  fixture_status_at_generation: string;
  inputs_snapshot_json: string;
  // Standings-only signature for regeneration detection
  // Format: "{season}|{home_rank},{away_rank}|{home_pf},{away_pf}|{home_pcl},{away_pcl}|{home_pr},{away_pr}"
  standings_signature: string | null;
  created_at: string;
}

export interface InsightsSnapshotInsert {
  fixture_id: number;
  generated_at: string;
  source_provider?: Provider;
  fixture_status_at_generation: string;
  inputs_snapshot_json: string;
  // Standings-only signature for regeneration detection
  standings_signature?: string | null;
}

/**
 * Parsed inputs snapshot structure
 * Contains the frozen context used at Insights generation time
 */
export interface InputsSnapshotData {
  // Standings-derived
  home_rank: number;
  away_rank: number;
  home_points_from_first: number;
  away_points_from_first: number;
  home_points_from_cl: number;
  away_points_from_cl: number;
  home_points_from_relegation: number;
  away_points_from_relegation: number;

  // Form
  home_form: string;
  away_form: string;

  // Mind
  home_mind_tier: number;
  away_mind_tier: number;
  home_efficiency_index: number;
  away_efficiency_index: number;

  // Mood
  home_mood_tier: number;
  away_mood_tier: number;
  home_is_sleeping_giant: boolean;
  away_is_sleeping_giant: boolean;
  home_is_over_performer: boolean;
  away_is_over_performer: boolean;

  // Safety
  home_motivation: string;
  away_motivation: string;

  // DNA summary
  home_btts_rate: number;
  away_btts_rate: number;
  home_most_played_formation: string;
  away_most_played_formation: string;

  // Metadata
  snapshot_version: string;
}

// ============================================================================
// H2H CACHE
// ============================================================================

export interface H2HCache {
  id: number;
  pair_key: string;
  team_a_id: number;
  team_b_id: number;
  last_n: number;
  provider: Provider;
  fetched_at: string;
  expires_at: string;
  h2h_data_json: string;
  created_at: string;
  updated_at: string;
}

export interface H2HCacheInsert {
  pair_key: string;
  team_a_id: number;
  team_b_id: number;
  last_n?: number;
  provider?: Provider;
  fetched_at: string;
  expires_at: string;
  h2h_data_json: string;
}

/**
 * Parsed H2H data structure
 */
export interface H2HCacheData {
  totalMeetings: number;
  teamAWins: number;
  teamBWins: number;
  draws: number;
  teamAGoals: number;
  teamBGoals: number;
  bttsCount: number;
  over25Count: number;
  // Last N matches summary
  matches: Array<{
    fixtureId: number;
    date: string;
    homeTeamId: number;
    homeTeamName: string;
    awayTeamId: number;
    awayTeamName: string;
    homeGoals: number;
    awayGoals: number;
    leagueId: number;
    leagueName: string;
    season: number;
  }>;
}

/** Default H2H cache TTL: 2 days in milliseconds */
export const H2H_CACHE_TTL_MS = 2 * 24 * 60 * 60 * 1000;

// ============================================================================
// INJURIES CACHE
// ============================================================================

/**
 * Injuries cache row stored in D1
 * Keyed by fixture_id since we fetch injuries per fixture
 */
export interface InjuriesCacheRow {
  fixture_id: number;
  home_team_ext_id: number;
  away_team_ext_id: number;
  provider: Provider;
  fetched_at: string;
  expires_at: string;
  injuries_json: string;
}

/**
 * Parsed injury for storage
 */
export interface CachedInjury {
  playerId: number;
  playerName: string;
  teamId: number;
  status: 'OUT' | 'DOUBTFUL' | 'QUESTIONABLE';
  reason: string;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
}

/**
 * Parsed injuries cache data structure
 */
export interface InjuriesCacheData {
  fixtureId: number;
  homeTeamId: number;
  awayTeamId: number;
  homeInjuries: CachedInjury[];
  awayInjuries: CachedInjury[];
  fetchedAt: number;
}

/** Default injuries cache TTL: 24 hours (API recommends 1 call/day) */
export const INJURIES_CACHE_TTL_MS = 24 * 60 * 60 * 1000;


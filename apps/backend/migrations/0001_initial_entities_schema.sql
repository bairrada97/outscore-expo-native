-- Outscore D1 Schema: Canonical Entities
-- Migration: 0001_initial_entities_schema
-- Description: Creates tables for leagues, teams, external ID mappings, 
--              team season context (Mind/Mood/DNA), standings, and insights snapshots

-- ============================================================================
-- LEAGUES
-- ============================================================================

CREATE TABLE IF NOT EXISTS leagues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    country TEXT,
    logo TEXT,
    flag TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_leagues_country ON leagues(country);
CREATE INDEX IF NOT EXISTS idx_leagues_name ON leagues(name);

-- ============================================================================
-- TEAMS
-- ============================================================================

CREATE TABLE IF NOT EXISTS teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    logo TEXT,
    country TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_teams_country ON teams(country);
CREATE INDEX IF NOT EXISTS idx_teams_name ON teams(name);

-- ============================================================================
-- EXTERNAL IDS (Provider ID Mapping)
-- Supports multi-provider merging: API-Football, Sportmonks, etc.
-- ============================================================================

CREATE TABLE IF NOT EXISTS external_ids (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider TEXT NOT NULL,           -- 'api_football', 'sportmonks', etc.
    entity_type TEXT NOT NULL,        -- 'league', 'team', 'player' (future)
    provider_id TEXT NOT NULL,        -- ID from the provider
    internal_id INTEGER NOT NULL,     -- FK to leagues.id or teams.id
    match_confidence REAL,            -- 0.0-1.0 confidence of mapping
    match_method TEXT,                -- 'exact_name', 'fuzzy', 'manual', etc.
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(provider, entity_type, provider_id)
);

CREATE INDEX IF NOT EXISTS idx_external_ids_lookup ON external_ids(provider, entity_type, provider_id);
CREATE INDEX IF NOT EXISTS idx_external_ids_internal ON external_ids(entity_type, internal_id);

-- ============================================================================
-- TEAM SEASON CONTEXT (Mind/Mood/DNA + Statistics)
-- One row per team per league per season with derived algorithm fields
-- ============================================================================

CREATE TABLE IF NOT EXISTS team_season_context (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id INTEGER NOT NULL,
    league_id INTEGER NOT NULL,
    season INTEGER NOT NULL,
    
    -- Provenance
    provider TEXT NOT NULL DEFAULT 'api_football',
    fetched_at TEXT NOT NULL,
    computed_at TEXT NOT NULL,
    algo_version TEXT,
    weights_version TEXT,
    
    -- TeamStatistics (hot columns for queries)
    form TEXT,                        -- e.g., "WWDLW"
    games_played INTEGER DEFAULT 0,
    avg_goals_scored REAL DEFAULT 0,
    avg_goals_conceded REAL DEFAULT 0,
    home_avg_scored REAL DEFAULT 0,
    home_avg_conceded REAL DEFAULT 0,
    away_avg_scored REAL DEFAULT 0,
    away_avg_conceded REAL DEFAULT 0,
    
    -- Mind Layer (hot columns)
    mind_tier INTEGER,                -- 1-4
    mind_efficiency_index REAL,
    mind_avg_points_per_game REAL,
    mind_goal_difference INTEGER,
    mind_match_count INTEGER,
    mind_has_sufficient_data INTEGER DEFAULT 0,  -- boolean
    
    -- Mood Layer (hot columns)
    mood_tier INTEGER,                -- 1-4
    mood_mind_mood_gap INTEGER,
    mood_is_sleeping_giant INTEGER DEFAULT 0,     -- boolean
    mood_is_over_performer INTEGER DEFAULT 0,     -- boolean
    mood_is_one_season_wonder INTEGER DEFAULT 0,  -- boolean
    mood_form_string TEXT,
    mood_last_10_points INTEGER,
    mood_last_10_goals_scored INTEGER,
    mood_last_10_goals_conceded INTEGER,
    
    -- DNA Layer (hot columns for key fields)
    dna_most_played_formation TEXT,
    dna_clean_sheet_percentage REAL,
    dna_failed_to_score_percentage REAL,
    dna_btts_yes_rate REAL,
    dna_is_late_starter INTEGER DEFAULT 0,        -- boolean
    dna_first_half_goal_percentage REAL,
    dna_avg_goals_per_game REAL,
    dna_avg_goals_conceded_per_game REAL,
    
    -- DNA Layer (JSON for complex/evolving structures)
    dna_formation_frequency_json TEXT,   -- JSON: Record<string, number>
    dna_goal_line_over_pct_json TEXT,    -- JSON: GoalLineOverPctMap
    dna_goal_minutes_scoring_json TEXT,  -- JSON: GoalMinuteDistribution
    dna_goal_minutes_conceding_json TEXT,-- JSON: GoalMinuteDistribution
    dna_danger_zones_json TEXT,          -- JSON: DangerZone[]
    
    -- Safety Flags
    safety_regression_risk INTEGER DEFAULT 0,     -- boolean
    safety_motivation_clash INTEGER DEFAULT 0,    -- boolean
    safety_live_dog INTEGER DEFAULT 0,            -- boolean
    safety_motivation TEXT,                       -- MotivationLevel
    safety_consecutive_wins INTEGER DEFAULT 0,
    
    -- Metadata
    days_since_last_match INTEGER,
    seasons_in_league INTEGER DEFAULT 1,
    
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    
    UNIQUE(team_id, league_id, season),
    FOREIGN KEY (team_id) REFERENCES teams(id),
    FOREIGN KEY (league_id) REFERENCES leagues(id)
);

CREATE INDEX IF NOT EXISTS idx_team_season_context_lookup ON team_season_context(team_id, league_id, season);
CREATE INDEX IF NOT EXISTS idx_team_season_context_league_season ON team_season_context(league_id, season);

-- ============================================================================
-- STANDINGS (Latest-only per league+season)
-- ============================================================================

CREATE TABLE IF NOT EXISTS standings_current (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    league_id INTEGER NOT NULL,
    season INTEGER NOT NULL,
    provider TEXT NOT NULL DEFAULT 'api_football',
    fetched_at TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    
    UNIQUE(league_id, season),
    FOREIGN KEY (league_id) REFERENCES leagues(id)
);

CREATE INDEX IF NOT EXISTS idx_standings_current_lookup ON standings_current(league_id, season);

CREATE TABLE IF NOT EXISTS standings_current_row (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    league_id INTEGER NOT NULL,
    season INTEGER NOT NULL,
    team_id INTEGER NOT NULL,
    
    -- Standing data
    rank INTEGER NOT NULL,
    points INTEGER NOT NULL DEFAULT 0,
    played INTEGER NOT NULL DEFAULT 0,
    win INTEGER NOT NULL DEFAULT 0,
    draw INTEGER NOT NULL DEFAULT 0,
    loss INTEGER NOT NULL DEFAULT 0,
    goals_for INTEGER NOT NULL DEFAULT 0,
    goals_against INTEGER NOT NULL DEFAULT 0,
    goal_diff INTEGER NOT NULL DEFAULT 0,
    form TEXT,                        -- e.g., "WWDLW"
    
    -- Optional (for cup groups, relegation/promotion status)
    group_name TEXT,
    description TEXT,                 -- e.g., "Champions League", "Relegation"
    
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    
    UNIQUE(league_id, season, team_id),
    FOREIGN KEY (league_id) REFERENCES leagues(id),
    FOREIGN KEY (team_id) REFERENCES teams(id)
);

CREATE INDEX IF NOT EXISTS idx_standings_row_lookup ON standings_current_row(league_id, season);
CREATE INDEX IF NOT EXISTS idx_standings_row_team ON standings_current_row(team_id, season);
CREATE INDEX IF NOT EXISTS idx_standings_row_rank ON standings_current_row(league_id, season, rank);

-- ============================================================================
-- INSIGHTS SNAPSHOT (Frozen per-fixture context)
-- Stores the exact inputs used at generation time so Insights never change
-- ============================================================================

CREATE TABLE IF NOT EXISTS insights_snapshot (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fixture_id INTEGER NOT NULL UNIQUE,  -- Provider fixture ID (API-Football)
    generated_at TEXT NOT NULL,
    source_provider TEXT NOT NULL DEFAULT 'api_football',
    fixture_status_at_generation TEXT NOT NULL,  -- NS, 1H, HT, 2H, FT, etc.
    
    -- Frozen inputs snapshot (JSON blob)
    -- Contains: home_rank, away_rank, points_from_first, points_from_cl, 
    -- points_from_relegation, form strings, Mind/Mood/DNA key values
    inputs_snapshot_json TEXT NOT NULL,
    
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_insights_snapshot_fixture ON insights_snapshot(fixture_id);
CREATE INDEX IF NOT EXISTS idx_insights_snapshot_generated ON insights_snapshot(generated_at);




-- Outscore D1 Schema: League Stats
-- Migration: 0011_add_league_stats
-- Description: Stores league scoring profiles for season-weighted adjustments

CREATE TABLE IF NOT EXISTS league_stats (
    provider TEXT NOT NULL,
    league_id INTEGER NOT NULL,
    season INTEGER NOT NULL,
    matches INTEGER NOT NULL DEFAULT 0,
    avg_goals REAL NOT NULL DEFAULT 0,
    over_2_5_rate REAL NOT NULL DEFAULT 0,
    btts_rate REAL NOT NULL DEFAULT 0,
    home_goals_avg REAL NOT NULL DEFAULT 0,
    away_goals_avg REAL NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (provider, league_id, season)
);

CREATE INDEX IF NOT EXISTS idx_league_stats_lookup
    ON league_stats(provider, league_id, season);

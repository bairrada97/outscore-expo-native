-- Outscore D1 Schema: Team Elo Ratings
-- Migration: 0009_add_team_elo_ratings
-- Description: Adds Elo rating snapshots with idempotency guardrails

CREATE TABLE IF NOT EXISTS team_elo_ratings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id INTEGER NOT NULL,
    as_of_date TEXT NOT NULL,
    elo REAL NOT NULL,
    games INTEGER NOT NULL DEFAULT 0,
    last_fixture_provider TEXT NOT NULL DEFAULT 'api_football',
    last_fixture_id TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(team_id, last_fixture_provider, last_fixture_id),
    FOREIGN KEY (team_id) REFERENCES teams(id)
);

CREATE INDEX IF NOT EXISTS idx_team_elo_team_date
    ON team_elo_ratings(team_id, as_of_date DESC);
CREATE INDEX IF NOT EXISTS idx_team_elo_fixture
    ON team_elo_ratings(team_id, last_fixture_provider, last_fixture_id);

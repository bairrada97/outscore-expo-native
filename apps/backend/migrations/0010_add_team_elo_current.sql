-- Outscore D1 Schema: Current Team Elo
-- Migration: 0010_add_team_elo_current
-- Description: Stores latest Elo snapshot per team for fast reads

CREATE TABLE IF NOT EXISTS team_elo_current (
    team_id INTEGER PRIMARY KEY,
    elo REAL NOT NULL,
    games INTEGER NOT NULL DEFAULT 0,
    as_of_date TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (team_id) REFERENCES teams(id)
);

CREATE INDEX IF NOT EXISTS idx_team_elo_current_date
    ON team_elo_current(as_of_date DESC);

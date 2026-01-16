-- Migration: 0006_standings_unique_per_group
-- Description: Support competitions with multiple standings tables (stages/groups)
--              by making standings_current_row unique per (league_id, season, team_id, group_name).
--
-- Notes:
-- - SQLite/D1 cannot alter UNIQUE constraints in-place reliably.
-- - We rebuild the table, preserving existing columns (including denormalized names).

CREATE TABLE IF NOT EXISTS standings_current_row_new (
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
    form TEXT,

    -- Group/stage table label (required for group-based leagues)
    -- Important: keep non-null so UNIQUE works consistently
    group_name TEXT NOT NULL DEFAULT '',
    description TEXT,

    -- Denormalized for faster reads (no JOINs needed)
    team_name TEXT,
    league_name TEXT,

    updated_at TEXT NOT NULL DEFAULT (datetime('now')),

    UNIQUE(league_id, season, team_id, group_name),
    FOREIGN KEY (league_id) REFERENCES leagues(id),
    FOREIGN KEY (team_id) REFERENCES teams(id)
);

-- Copy existing data over (coerce NULL group_name -> '')
INSERT INTO standings_current_row_new (
  id, league_id, season, team_id,
  rank, points, played, win, draw, loss,
  goals_for, goals_against, goal_diff, form,
  group_name, description, team_name, league_name,
  updated_at
)
SELECT
  id, league_id, season, team_id,
  rank, points, played, win, draw, loss,
  goals_for, goals_against, goal_diff, form,
  COALESCE(group_name, ''), description, team_name, league_name,
  updated_at
FROM standings_current_row;

DROP TABLE standings_current_row;
ALTER TABLE standings_current_row_new RENAME TO standings_current_row;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_standings_row_lookup ON standings_current_row(league_id, season);
CREATE INDEX IF NOT EXISTS idx_standings_row_team ON standings_current_row(team_id, season);
CREATE INDEX IF NOT EXISTS idx_standings_row_rank ON standings_current_row(league_id, season, rank);
CREATE INDEX IF NOT EXISTS idx_standings_row_group_rank ON standings_current_row(league_id, season, group_name, rank);





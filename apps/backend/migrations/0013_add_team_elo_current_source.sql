-- Outscore D1 Schema: Team Elo Source
-- Migration: 0013_add_team_elo_current_source
-- Description: Track source of current Elo (api_football vs clubelo vs uefa)

ALTER TABLE team_elo_current
  ADD COLUMN source TEXT NOT NULL DEFAULT 'api_football';

-- Backfill existing rows to the default source
UPDATE team_elo_current
  SET source = 'api_football'
  WHERE source IS NULL;

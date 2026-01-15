-- Migration: 0003_add_standings_signature
-- Description: Add standings_signature column to insights_snapshot for standings-driven regeneration
--              The signature captures standings-derived inputs that trigger re-generation when changed

-- Add standings_signature column
-- Format: "{season}|{home_rank},{away_rank}|{home_pf},{away_pf}|{home_pcl},{away_pcl}|{home_pr},{away_pr}"
-- where pf = points_from_first, pcl = points_from_cl, pr = points_from_relegation
ALTER TABLE insights_snapshot ADD COLUMN standings_signature TEXT;

-- Index for efficient lookups when checking if regeneration is needed
-- We'll query by fixture_id and compare signature
CREATE INDEX IF NOT EXISTS idx_insights_snapshot_signature ON insights_snapshot(fixture_id, standings_signature);



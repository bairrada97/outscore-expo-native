-- Migration: 0002_add_names_to_standings
-- Description: Denormalize standings_current_row by adding team_name and league_name
--              for faster reads without JOINs

-- Add team_name column (redundant but faster reads)
ALTER TABLE standings_current_row ADD COLUMN team_name TEXT;

-- Add league_name column (redundant but faster reads)
ALTER TABLE standings_current_row ADD COLUMN league_name TEXT;

-- Note: Existing rows will have NULL for these columns until re-populated
-- New standings inserts will populate these fields





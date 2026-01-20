-- Outscore D1 Schema: UEFA Priors
-- Migration: 0008_add_uefa_priors
-- Description: Adds UEFA association + club coefficients and club-team mapping

-- ============================================================================
-- UEFA ASSOCIATION COEFFICIENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS uefa_association_coefficients (
    country_code TEXT NOT NULL,
    as_of_season INTEGER NOT NULL,
    rank INTEGER,
    coefficient5y REAL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (country_code, as_of_season)
);

CREATE INDEX IF NOT EXISTS idx_uefa_association_country
    ON uefa_association_coefficients(country_code);
CREATE INDEX IF NOT EXISTS idx_uefa_association_season
    ON uefa_association_coefficients(as_of_season);

-- ============================================================================
-- UEFA CLUB COEFFICIENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS uefa_club_coefficients (
    uefa_club_key TEXT NOT NULL,
    as_of_season INTEGER NOT NULL,
    name TEXT NOT NULL,
    country_code TEXT,
    coefficient REAL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (uefa_club_key, as_of_season)
);

CREATE INDEX IF NOT EXISTS idx_uefa_club_key
    ON uefa_club_coefficients(uefa_club_key);
CREATE INDEX IF NOT EXISTS idx_uefa_club_country
    ON uefa_club_coefficients(country_code);
CREATE INDEX IF NOT EXISTS idx_uefa_club_season
    ON uefa_club_coefficients(as_of_season);

-- ============================================================================
-- UEFA CLUB -> TEAM MAP (API-Football to internal team_id)
-- ============================================================================

CREATE TABLE IF NOT EXISTS uefa_club_team_map (
    uefa_club_key TEXT NOT NULL,
    as_of_season INTEGER NOT NULL,
    api_football_team_id INTEGER NOT NULL,
    team_id INTEGER,
    confidence REAL,
    method TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (uefa_club_key, as_of_season),
    FOREIGN KEY (team_id) REFERENCES teams(id)
);

CREATE INDEX IF NOT EXISTS idx_uefa_club_map_api_id
    ON uefa_club_team_map(api_football_team_id);
CREATE INDEX IF NOT EXISTS idx_uefa_club_map_team_id
    ON uefa_club_team_map(team_id);

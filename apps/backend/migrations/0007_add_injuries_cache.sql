-- Migration: Add injuries_cache table
-- Purpose: Cache injury data from API-Football per fixture
-- TTL: 24 hours (API recommends 1 call/day, updates every 4 hours)

-- ============================================================================
-- CREATE INJURIES_CACHE TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS injuries_cache (
    -- Primary key is fixture_id (one cache entry per fixture)
    fixture_id INTEGER PRIMARY KEY,

    -- Team external IDs (API-Football IDs)
    home_team_ext_id INTEGER NOT NULL,
    away_team_ext_id INTEGER NOT NULL,

    -- Provider (for multi-provider support)
    provider TEXT NOT NULL DEFAULT 'api_football',

    -- Cache timestamps
    fetched_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,

    -- JSON blob containing injuries for both teams
    -- Structure: { homeInjuries: [...], awayInjuries: [...] }
    injuries_json TEXT NOT NULL,

    -- Audit timestamps
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Index for expiration queries (cleanup stale entries)
CREATE INDEX IF NOT EXISTS idx_injuries_cache_expires_at
ON injuries_cache(expires_at);

-- Index for team lookups (if needed for invalidation)
CREATE INDEX IF NOT EXISTS idx_injuries_cache_home_team
ON injuries_cache(home_team_ext_id);

CREATE INDEX IF NOT EXISTS idx_injuries_cache_away_team
ON injuries_cache(away_team_ext_id);

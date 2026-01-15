-- Migration: 0004_add_h2h_cache
-- Description: Add H2H (head-to-head) cache table for storing cached H2H data
--              TTL: 1-2 days (H2H only changes when the same teams play each other again)

CREATE TABLE IF NOT EXISTS h2h_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    -- Normalized pair key: always uses smaller_id first (e.g., "33-40" not "40-33")
    pair_key TEXT NOT NULL UNIQUE,
    team_a_id INTEGER NOT NULL,
    team_b_id INTEGER NOT NULL,
    last_n INTEGER NOT NULL DEFAULT 5,
    
    -- Cached data
    provider TEXT NOT NULL DEFAULT 'api_football',
    fetched_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    
    -- Processed H2H data (JSON)
    -- Contains: matches array, stats summary (total_meetings, team_a_wins, draws, etc.)
    h2h_data_json TEXT NOT NULL,
    
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_h2h_cache_pair ON h2h_cache(pair_key);
CREATE INDEX IF NOT EXISTS idx_h2h_cache_expires ON h2h_cache(expires_at);



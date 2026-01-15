-- Migration: 0005_h2h_cache_unique_pair_lastn
-- Description: Change H2H cache uniqueness from pair_key-only to (pair_key, last_n)
--              so different "last N" queries don't overwrite each other.

-- D1/SQLite cannot alter UNIQUE constraints in-place reliably, so we:
-- 1) Create a new table with the desired constraint
-- 2) Copy data
-- 3) Drop old table
-- 4) Rename new table

CREATE TABLE IF NOT EXISTS h2h_cache_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    -- Normalized pair key: always uses smaller_id first (e.g., "33-40" not "40-33")
    pair_key TEXT NOT NULL,
    team_a_id INTEGER NOT NULL,
    team_b_id INTEGER NOT NULL,
    last_n INTEGER NOT NULL DEFAULT 5,
    
    -- Cached data
    provider TEXT NOT NULL DEFAULT 'api_football',
    fetched_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    
    -- Processed H2H data (JSON)
    h2h_data_json TEXT NOT NULL,
    
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),

    UNIQUE(pair_key, last_n)
);

-- Copy existing data (if any)
INSERT INTO h2h_cache_new (
  id, pair_key, team_a_id, team_b_id, last_n, provider, fetched_at, expires_at, h2h_data_json, created_at, updated_at
)
SELECT
  id, pair_key, team_a_id, team_b_id, last_n, provider, fetched_at, expires_at, h2h_data_json, created_at, updated_at
FROM h2h_cache;

-- Replace old table
DROP TABLE h2h_cache;
ALTER TABLE h2h_cache_new RENAME TO h2h_cache;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_h2h_cache_pair ON h2h_cache(pair_key);
CREATE INDEX IF NOT EXISTS idx_h2h_cache_expires ON h2h_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_h2h_cache_pair_lastn ON h2h_cache(pair_key, last_n);




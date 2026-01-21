-- Outscore D1 Schema: Backtest runs
-- Migration: 0012_add_backtest_runs
-- Description: Stores backtest run metadata + references to R2 artifacts

CREATE TABLE backtest_runs (
    run_id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    r2_prefix TEXT NOT NULL,
    config_json TEXT NOT NULL,
    metrics_json TEXT NOT NULL
);

CREATE INDEX idx_backtest_runs_created_at
    ON backtest_runs(created_at DESC);

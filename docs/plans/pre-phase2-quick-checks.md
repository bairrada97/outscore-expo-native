## Pre-Phase2 Quick Checks (Gate 1 + Mini Backtest)

### Goal
Before moving into **Product/Algo Phase 2**, add the minimum **data-quality safety rails** and a **basic backtest harness** so future tuning is measurable and we stop shipping regressions caused by bad upstream data.

### Scope
- **In scope**: data-quality guards + warnings, plus a minimal backtest runner that persists artifacts to **R2** and run metadata to **D1**
- **Out of scope**: full Elo pipeline, full ML training, major model redesign

---

## 1) Data-Quality Guards (must-have)

### 1.1 Add `sanityWarnings` collection (exposed for now)
- [x] Add a small array of warning strings that the pipeline can append to when inputs look suspicious
- [x] Plumb warnings through to logs and **expose in the API response for now** (testing/debugging)
- [ ] **Future**: hide behind a debug flag (env var or query param) before production rollout
- Target files:
  - `apps/backend/src/modules/betting-insights/services/insights.service.ts`
  - `apps/backend/src/modules/betting-insights/types.ts`

### 1.2 Expand guards for common real-world edge cases (with regression tests)
- [x] **Standings missing/partial**
  - For LEAGUE matches when standings are missing: add warning + downgrade confidence
- [x] **Tiny-sample stats**
  - Extend tiny-sample protections beyond cups (any competition where `gamesPlayed` too small)
  - Add sanity bounds (e.g., `avgGoalsScored > 4.0` => warning + fallback)
- [x] **Low match history / promoted teams**
  - If Mind/Mood sample sizes below thresholds: force `modelReliability` down and add warning
- [x] **Round parsing / season timing**
  - If `roundNumber` can’t be derived and match is LEAGUE: don’t apply early/end-of-season logic; warn

### 1.3 Add invariant checks (warn, don’t throw)
- [x] avgGoalsScored/Conceded within reasonable bounds
- [x] home/away averages not coming from 0-sample splits
- [x] probability distributions sum ≈ 100
- [x] extreme adjustments (e.g., totalAdjustment > X) flagged

---

## 2) Minimal Backtest Harness (measurable iteration)

### 2.1 Data source
- [x] Use API-Football fixtures in a fixed window, by `league+season` (optional date range)
- [x] Backtest only finished matches (`FT/AET/PEN`)

### 2.2 Backtest job design
- [x] Add a Worker cron or admin-triggered route that:
  - selects backtest definition (leagueIds, season(s), date window, markets)
  - replays fixtures and generates predictions using current code paths
  - computes per-market metrics

### 2.3 Metrics (start minimal)
Per market (at least BTTS + Over 2.5):
- [x] Brier score
- [x] Log loss
- [x] Calibration bins (e.g., 10 bins)
- [x] Coverage by confidence level (HIGH/MEDIUM/LOW)

### 2.3.5 Invariants + anomaly reporting (to catch logic/data bugs)
- [x] Add invariant checks during the backtest loop. Instead of failing the run, **count + persist** violations so we can spot bugs fast.

Suggested checks (per fixture):
- Probability distributions sum to ~100 (±0.5) and no NaN values
- No `undefined`/NaN factor scores
- Team goal rates/averages within sane bounds (avoid tiny-sample explosions)
- Detect suspicious `teams/statistics` usage (`gamesPlayed < N` or 0-sample home/away splits) and record a warning
- Consistency checks for insights/patterns (e.g., prevent contradictory venue claims from H2H patterns)

Artifacts to write (R2 prefix `backtests/{runId}/`):
- `anomalies_summary.json` (counts by check + top affected leagues)
- `anomalies.jsonl` (one line per failing fixture with fixtureId, league/season/date, probabilities, factorScores, triggered patterns/insights)
- optional: `outliers.jsonl` (top-N by totalAdjustment magnitude, capsHit frequency, biggest surprise vs outcome)

### 2.4 Persist artifacts (R2) + run metadata (D1)
- [x] R2 prefix: `backtests/{runId}/`
  - `metrics.json`
  - `config.json` (weights/config hash + code version)
  - optional `predictions.jsonl`
- [x] D1 table: `backtest_runs`
  - `run_id` (PK), `created_at`, `code_version`, `r2_prefix`, headline metrics

### 2.5 Access / visibility
- [x] Add a simple endpoint to list last N runs from D1 and return R2 keys for download

---

## 3) Acceptance Criteria (before Phase 2)
- Data-quality warnings trigger on known bad inputs (cup tiny sample, missing standings, extreme goal rates)
- Backtest runs end-to-end for at least 1–2 leagues and stores artifacts in R2
- You can compare headline metrics across runs/commits
- Backtest produces `anomalies_summary.json` + `anomalies.jsonl` and you can inspect at least the top-N anomaly fixtures

---

## Execution Tasks (ordered)
1. ✅ Introduce `sanityWarnings` and expose in response for now
2. ✅ Add additional guards + invariants + regression tests
3. ✅ Add D1 `backtest_runs` schema + define R2 artifact layout
4. ✅ Implement minimal backtest runner for BTTS + Over 2.5 (Brier/logloss + calibration bins + invariants/anomaly reporting)
5. ✅ Persist artifacts to R2 + metadata to D1; add list/download endpoint



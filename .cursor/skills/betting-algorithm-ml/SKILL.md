---
name: betting-algorithm-ml
description: Use when working on betting insights algorithm logic, simulations, calibrations, or ML feature engineering and models.
version: 1.0.0
license: MIT
---

# Betting Algorithm + ML Implementation

**You MUST use this skill for changes to betting insights logic, simulations, calibration, or ML training/inference.**

## References

- `docs/betting-insights-algorithm.md` -- Full algorithm design and roadmap
- `docs/betting-insights-data-requirements.md` -- Manual data prerequisites and checklists
- `docs/implementation-plans/*` -- Implementation tasks, timelines, milestones, and checklists

## When to Use

- Adjusting match outcome (1X2) or goals markets logic
- Updating BTTS, Over/Under, or match outcome simulations
- Changing calibration or probability caps
- Editing ML feature engineering, training, or inference
- Importing/exporting LightGBM models and metrics

## Core Entry Points

**Backend algorithm + simulations**
- `apps/backend/src/modules/betting-insights/config/algorithm-config.ts`
- `apps/backend/src/modules/betting-insights/config/match-outcome-calibration.ts`
- `apps/backend/src/modules/betting-insights/simulations/*.ts`

**ML inference in backend**
- `apps/backend/src/modules/betting-insights/ml/models.ts`
- `apps/backend/src/modules/betting-insights/ml/compute-features.ts`
- `apps/backend/src/modules/betting-insights/ml/lightgbm-inference.ts`

**ML training + data prep**
- `ml/feature-engineering/`
- `ml/targets/create-targets.py`
- `ml/models/export-to-json.py`
- `ml/models/output/` (models, metrics, summaries)

## Key Rules

- **Honor the manual data checkpoint.** If implementation depends on league IDs, mappings, or keyword lists, confirm the checklist in `docs/betting-insights-data-requirements.md` has been completed. Use the exact confirmation string:
  "I have completed all manual data requirements and am ready to proceed with implementation."
- **Keep probability units consistent.** Backend predictions return percentages (0–100). Do not mix with 0–1 unless you convert at boundaries.
- **Update both artifacts and registry.** When retraining models, export JSON and ensure `apps/backend/src/modules/betting-insights/ml/models.ts` imports the new files.
- **Preserve market coverage.** Maintain parity across `1x2`, `btts`, and `ou_1_5`/`ou_2_5`/`ou_3_5`.
- **Document calibration changes.** If you adjust calibration or caps, note the rationale in the same file.

## Decision Guide

```
User asks about algorithm weights, caps, or market logic
  -> Update config files under config/

User asks about match outcome, BTTS, or total goals logic
  -> Update simulations under simulations/

User asks about ML features or model inputs
  -> Update ml/compute-features.ts and ml/feature-engineering/

User asks about ML model behavior or performance
  -> Update model artifacts in ml/models/output/ and import in ml/models.ts
```

## Common Mistakes

**Wrong: Mixing 0–1 and 0–100 probabilities**
```ts
return { home: prediction.home, draw: prediction.draw, away: prediction.away };
```

**Right: Convert to percentages consistently**
```ts
return {
  home: prediction.home * 100,
  draw: prediction.draw * 100,
  away: prediction.away * 100,
};
```

## Recent Changes: ClubElo + ML Debugging

### ClubElo ingestion + source ownership
- **Current Elo table:** `team_elo_current` now tracks `source` to prevent internal Elo refresh from overwriting ClubElo values.
- **Sources:** `clubelo`, `api_football`, `uefa`.
- **Scheduler guard:** `refresh-scheduler.ts` only updates rows when `source != 'clubelo'`.
- **Import behavior:** ClubElo import writes `source = clubelo` and `games = 50` (full confidence).
- **Why:** Ensures inference uses external ClubElo scale consistently with training.

### Team ID resolution in insights
- Insights requests use API-Football team IDs.
- Elo rows are stored by **internal team IDs**, so `resolveExternalId` is required before `getCurrentTeamElo`.

### LightGBM inference fix (critical)
- **Bug:** shrinkage was applied twice in JS inference (`leaf_value * tree.shrinkage`).
- **Fix:** remove shrinkage multiplier in `computeRawScores` (JSON `leaf_value` already includes shrinkage).
- **Symptom:** flat probabilities skewing toward 33/33/33 despite strong feature signals.

### ML debug output
- Insights response can include `mlDebug` with:
  - `matchOutcome.rawPrediction`
  - `matchOutcome.features` (feature vector used by ML)
- Useful to verify model inputs and confirm inference matches training.

## Example Invocations

User: "Tune match outcome confidence or probability caps"
-> Update `apps/backend/src/modules/betting-insights/config/algorithm-config.ts`

User: "Rework BTTS prediction logic"
-> Update `apps/backend/src/modules/betting-insights/simulations/simulate-btts.ts`

User: "Add a new feature to ML training"
-> Update `ml/feature-engineering/` and `apps/backend/src/modules/betting-insights/ml/compute-features.ts`

User: "Replace model artifacts after retraining"
-> Export JSON in `ml/models/output/` and update imports in `apps/backend/src/modules/betting-insights/ml/models.ts`

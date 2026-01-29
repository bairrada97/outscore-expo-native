# ML Data Pipeline (Phase 1 Prereqs)

This folder contains scripts to acquire, clean, validate, and feature-engineer historical match data for ML Phase 1.

## Directory layout

- `ml/data-acquisition/` — download + clean + validate + team name mapping
- `ml/feature-engineering/` — feature builders for training sets
- `ml/config/` — league + column configuration
- `ml/utils/` — CSV + date utilities

## Usage (Bun)

### 1) Download historical dataset
```bash
bun ml/data-acquisition/download-historical-data.ts --url <csv-or-zip-url> --out ml/data/raw/historical.csv
```

### 2) Build team name mapping (optional)
Provide a canonical list (API-Football or your own).
```bash
bun ml/data-acquisition/team-name-mapping.ts \
  --input ml/data/raw/historical.csv \
  --canonical ml/data/api-team-names.json \
  --out ml/data/team-name-map.json \
  --overrides ml/config/team-name-overrides.json
```

### 2.1) Export canonical team names from D1 (recommended)
```bash
bun apps/backend/scripts/export-team-names.ts \
  --db ENTITIES_DB \
  --config apps/backend/wrangler.toml \
  --remote \
  --league-ids 39,140,135,78,61,94,88 \
  --out ml/data/api-team-names.json
```

### 3) Clean dataset
```bash
bun ml/data-acquisition/clean-historical-data.ts \
  --input ml/data/raw/historical.csv \
  --team-map ml/data/team-name-map.json \
  --out ml/data/cleaned
```

### 4) Validate cleaned data
```bash
bun ml/data-acquisition/validate-data.ts \
  --input ml/data/cleaned/matches.jsonl \
  --out ml/data/cleaned/validation.json
```

### 5) Build training features (baseline)
```bash
bun ml/feature-engineering/build-training-set.ts \
  --input ml/data/cleaned/matches.jsonl \
  --out ml/data/features \
  --min-history 5
```

## ML Phase 2 (LightGBM + Optuna)

These scripts train models to learn feature weights for each market.

### Python setup
```bash
python -m pip install -r ml/requirements.txt
```

### 6) Create targets (including ranges, cards, corners)
```bash
python ml/targets/create-targets.py \
  --features ml/data/features/training.csv \
  --raw ml/data/raw/historical.csv \
  --team-map ml/data/team-name-map.json \
  --out ml/data/features/training_with_targets.csv
```

This step now includes H2H features (overall + venue split, last 5 meetings).

### 7) Train markets with Optuna
```bash
python ml/models/train-markets.py \
  --input ml/data/features/training_with_targets.csv \
  --out-dir ml/models/output \
  --trials 30 \
  --train-end 2022 \
  --val 2023 \
  --test-start 2024
```

### 8) Extract ML factor weights (grouped)
```bash
python ml/models/extract-weights.py \
  --model-dir ml/models/output \
  --out ml/models/output/weights.json
```

## Notes
- League filtering uses `ml/config/leagues.ts`. Add or tweak league names there.
- Column detection uses `ml/config/columns.ts`. Add candidates if your dataset uses different headers.
- Team mapping uses normalized keys. Update `ml/data/team-name-map.json` after review.
- Override aliases live in `ml/config/team-name-overrides.json`.

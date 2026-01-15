# ML Phase 1: Historical Data Integration & Feature Engineering

**Reference:** See "ML Phase 1" sections (1.1-1.6) in `betting-insights-algorithm.md`

## Overview

ML Phase 1 focuses on acquiring, cleaning, and engineering features from historical data for ML model training. **Important:** The ML models trained from this data are ONLY used to learn optimal weights for factors - they are NOT used for direct predictions. This phase prepares the dataset that will be used to train the ML models in ML Phase 2, which will learn optimal weights via LightGBM + Optuna.

## Dependencies

- None (foundation phase for ML training)

## Sub-Phases

### ML 1.1 Data Acquisition & Cleaning

**Reference:** See "1.1 Data Acquisition & Cleaning" in `betting-insights-algorithm.md`

**Goal:** Download and clean historical dataset for ML training

#### Sub-tasks:

1. **Dataset Download**
   - Download from: https://github.com/xgabora/Club-Football-Match-Data-2000-2025
   - MIT-licensed, league-only matches 2000-2025
   - Verify data integrity and completeness

2. **Data Cleaning Pipeline**
   - Handle NaNs: Impute missing values (median for numeric, mode for categorical)
   - Standardize team names: Create team name mapping table (see ML 1.1.1)
   - Convert dates: Ensure consistent date format, handle timezone issues
   - Filter to major leagues: Top 5 leagues + Portuguese League, Eredivisie
   - Remove duplicates: Identify and remove duplicate matches
   - Validate data integrity: Check for impossible scores, future dates, etc.

#### Files to Create:

- `ml/data-acquisition/download-historical-data.py` - Data download script
- `ml/data-acquisition/clean-historical-data.py` - Data cleaning pipeline
- `ml/data-acquisition/validate-data.py` - Data validation script

#### Validation Criteria:

- ✅ Dataset downloaded successfully
- ✅ All NaNs handled appropriately
- ✅ Team names standardized
- ✅ Dates converted correctly
- ✅ Only major leagues included
- ✅ Duplicates removed
- ✅ Data integrity validated

---

### ML 1.1.1 Team Name Standardization & Mapping

**Reference:** See "1.1.1 Team Name Standardization" in `betting-insights-algorithm.md`

**Goal:** Create automated team name mapping system for combining historical and API-Football data

#### Sub-tasks:

1. **Mapping Service Implementation**
   - Build mapping table per league using API-Football standings endpoint
   - Cache mappings persistently (KV/database)
   - Use cached mappings for fast normalization during retraining

2. **Fuzzy Matching**
   - Implement Levenshtein distance calculation
   - Auto-map high-confidence matches (≥85% similarity)
   - Log medium/low confidence matches for review

3. **Normalization Functions**
   - Normalize team names for comparison (remove FC, SC, etc.)
   - Handle name variations and common prefixes/suffixes

#### Files to Create:

- `ml/data-acquisition/team-name-mapping.py` - Team name mapping service
- `ml/data-acquisition/fuzzy-matching.py` - Fuzzy matching utilities
- `ml/data-acquisition/team-name-normalizer.py` - Name normalization

#### Validation Criteria:

- ✅ Mapping table built correctly
- ✅ High-confidence matches auto-mapped
- ✅ Medium/low confidence matches logged for review
- ✅ Normalization handles common variations
- ✅ Mappings cached persistently

---

### ML 1.2 Feature Engineering - Form Calculations

**Reference:** See "1.2 Feature Engineering - Form" in `betting-insights-algorithm.md`

**Goal:** Engineer form-related features for ML training

#### Sub-tasks:

1. **Form String Generation**
   - Generate form strings (WWDLW) for last N matches
   - Weight recent matches more heavily
   - Handle home/away form separately

2. **Form Score Calculation**
   - Calculate weighted form scores
   - Apply exponential decay (alpha: 0.8-0.9)
   - Recent games multiplier (1.5x), mid games (1.2x), old games (1.0x)

3. **Points Calculation**
   - Calculate points per game
   - Calculate points from CL/relegation/first place
   - Calculate goal difference

#### Files to Create:

- `ml/feature-engineering/form-features.py` - Form calculation features
- `ml/feature-engineering/weighted-form.py` - Weighted form scoring

#### Validation Criteria:

- ✅ Form strings generated correctly
- ✅ Form scores calculated with proper weighting
- ✅ Points calculations accurate
- ✅ Home/away form handled separately

---

### ML 1.2.5 Opponent-Adjusted Rate Stats

**Reference:** See "1.2.5 Opponent-Adjusted Rate Stats" in `betting-insights-algorithm.md`

**Goal:** Calculate opponent-adjusted scoring/defensive rates

#### Sub-tasks:

1. **Opponent Tier Assignment**
   - Assign tiers to opponents based on Efficiency Index
   - Use Mind tier from historical data

2. **Weighted Rate Calculation**
   - Weight goals scored by opponent tier
   - Weight goals conceded by opponent tier
   - Goals vs Tier 1 teams worth more

#### Files to Create:

- `ml/feature-engineering/opponent-adjusted-stats.py` - Opponent-adjusted calculations

#### Validation Criteria:

- ✅ Opponent tiers assigned correctly
- ✅ Weighted rates calculated correctly
- ✅ Tier weighting appropriate

---

### ML 1.3 Feature Engineering - Mind/Mood/DNA Layers

**Reference:** See "1.3 Mind/Mood/DNA Layers" in `betting-insights-algorithm.md`

**Goal:** Engineer Mind, Mood, and DNA layer features for ML training

#### Why This Matters:

These features are INPUT to the ML models. The ML models learn:
- **Which Mind/Mood/DNA features are most predictive** (feature importance)
- **How much weight to give each feature** (optimal weights)
- **Which features matter most for which markets** (market-specific weights)

**Example:** ML might learn:
- For BTTS: `dna_under25Percentage` is very important (30% weight), `mind_tier` is less important (5% weight)
- For Match Result: `mind_tier` is very important (25% weight), `mood_tier` is important (20% weight)
- For Over/Under Goals @2.5: `dna_goalLineOverPct_2_5` is critical (35% weight), `mood_tier` is less important (10% weight)

**Benefit:** Instead of guessing weights (e.g., "Mind should be 20%"), ML learns optimal weights from historical data. These learned weights improve rule-based predictions.

#### Sub-tasks:

1. **Mind Layer Features**
   - Efficiency Index (EI) calculation
   - Tier categorization (1-4)
   - Last 50 matches analysis
   - **ML learns:** How important is baseline quality vs recent form?

2. **Mood Layer Features**
   - Recent form tier (last 10 matches)
   - Mind/Mood gap detection
   - Sleeping Giant / Over-Performer flags
   - **ML learns:** How much weight should recent momentum get?

3. **DNA Layer Features**
   - Most played formation
   - Formation frequency
   - Over/Under goals percentages per line (e.g., `goalLineOverPct` for 0.5..5.5)
   - Clean sheet percentage
   - Failed to score percentage
   - Late starter pattern
   - **ML learns:** Which technical trends are most predictive for each market?

#### Files to Create:

- `ml/feature-engineering/mind-features.py` - Mind layer features
- `ml/feature-engineering/mood-features.py` - Mood layer features
- `ml/feature-engineering/dna-features.py` - DNA layer features

#### Validation Criteria:

- ✅ Efficiency Index calculated correctly
- ✅ Tiers assigned correctly
- ✅ Mind/Mood gap detected correctly
- ✅ DNA features calculated correctly
- ✅ Features match production features (Week-by-Week Phase 1)
- ✅ ML can learn meaningful weights from these features

---

### ML 1.4 Feature Engineering - Match Context Features

**Reference:** See "1.4 Match Context Features" in `betting-insights-algorithm.md`

**Goal:** Engineer match context features

#### Sub-tasks:

1. **Match Type Features**
   - League vs Cup vs International vs Friendly
   - Knockout stage detection
   - Importance level

2. **Venue Features**
   - Home/Away flag
   - Neutral venue detection
   - Derby/rivalry detection

3. **Timing Features**
   - Round number
   - Early season flag (<5 rounds)
   - Days since last match
   - Post-international break flag
   - End-of-season flag

4. **Formation Features**
   - Match formation
   - Formation stability score
   - Formation similarity to most played

#### Files to Create:

- `ml/feature-engineering/match-context-features.py` - Match context features

#### Validation Criteria:

- ✅ Match type detected correctly
- ✅ Venue features accurate
- ✅ Timing features calculated correctly
- ✅ Formation features accurate

---

### ML 1.4.5 Probabilistic Safety Flags

**Reference:** See "1.4.5 Probabilistic Safety Flags" in `betting-insights-algorithm.md`

**Goal:** Engineer safety flag features

#### Sub-tasks:

1. **Regression Risk Detection**
   - Detect over-performing teams
   - Calculate regression probability

2. **Motivation Clash Detection**
   - Detect motivation mismatches
   - Calculate motivation scores

3. **Live Dog Detection**
   - Detect bottom teams showing form
   - Calculate live dog probability

#### Files to Create:

- `ml/feature-engineering/safety-flags.py` - Safety flag features

#### Validation Criteria:

- ✅ Regression risk detected correctly
- ✅ Motivation clash detected correctly
- ✅ Live dog detected correctly

---

### ML 1.5 Data Quality Assessment & Handling

**Reference:** See "1.5 Data Quality Assessment" in `betting-insights-algorithm.md`

**Goal:** Assess data quality and handle edge cases

#### Sub-tasks:

1. **Data Quality Checks**
   - Check for missing data
   - Check for outliers
   - Check for data drift

2. **Edge Case Handling**
   - Promoted teams / new teams
   - One-season wonder detection
   - Data quality edge cases

3. **Automated Anomaly Detection**
   - Detect anomalies automatically
   - Flag for review

#### Files to Create:

- `ml/data-quality/assess-data-quality.py` - Data quality assessment
- `ml/data-quality/handle-edge-cases.py` - Edge case handling
- `ml/data-quality/anomaly-detection.py` - Anomaly detection

#### Validation Criteria:

- ✅ Data quality assessed correctly
- ✅ Edge cases handled appropriately
- ✅ Anomalies detected correctly

---

### ML 1.6 Centralized Configuration Architecture

**Reference:** See "1.6 Centralized Configuration" in `betting-insights-algorithm.md`

**Goal:** Create centralized configuration for all tunable parameters

#### Sub-tasks:

1. **Configuration Structure**
   - Form weighting configuration
   - H2H recency weighting configuration
   - Market weights configuration
   - Tier thresholds configuration
   - Adjustment factors configuration

2. **Configuration File**
   - Create config file/class
   - Make all parameters tunable
   - Enable A/B testing

#### Files to Create:

- `ml/config/algorithm-config.py` - Centralized configuration
- `ml/config/config-schema.py` - Configuration schema/validation

#### Validation Criteria:

- ✅ Configuration structure complete
- ✅ All parameters tunable
- ✅ A/B testing enabled
- ✅ Configuration validated

---

## Key Data Structures

### Feature Set

```python
features = {
    # Form Features
    'home_form_score': float,
    'away_form_score': float,
    'home_points_per_game': float,
    'away_points_per_game': float,
    
    # H2H Features
    'h2h_home_wins': int,
    'h2h_away_wins': int,
    'h2h_draws': int,
    'h2h_btts_percentage': float,
    'h2h_avg_goals': float,
    
    # Mind/Mood/DNA Features
    'home_mind_tier': int,
    'away_mind_tier': int,
    'home_mood_tier': int,
    'away_mood_tier': int,
    'home_dna_formation': str,
    'away_dna_formation': str,
    'home_goalLineOverPct_2_5': float,
    'away_goalLineOverPct_2_5': float,
    
    # Match Context Features
    'match_type': str,
    'is_early_season': bool,
    'days_since_last_match_home': int,
    'days_since_last_match_away': int,
    'is_neutral_venue': bool,
    'is_derby': bool,
    
    # Safety Flags
    'home_regression_risk': bool,
    'away_regression_risk': bool,
    'motivation_clash': bool,
    'home_live_dog': bool,
    'away_live_dog': bool,
}
```

## Implementation Checklist

### Data Acquisition & Cleaning
- [ ] Download historical dataset
- [ ] Implement data cleaning pipeline
- [ ] Handle NaNs
- [ ] Standardize team names
- [ ] Convert dates
- [ ] Filter to major leagues
- [ ] Remove duplicates
- [ ] Validate data integrity

### Team Name Mapping
- [ ] Implement mapping service
- [ ] Implement fuzzy matching
- [ ] Implement normalization
- [ ] Cache mappings

### Feature Engineering
- [ ] Implement form features
- [ ] Implement opponent-adjusted stats
- [ ] Implement Mind/Mood/DNA features
- [ ] Implement match context features
- [ ] Implement safety flags

### Data Quality
- [ ] Assess data quality
- [ ] Handle edge cases
- [ ] Implement anomaly detection

### Configuration
- [ ] Create configuration structure
- [ ] Create configuration file
- [ ] Enable A/B testing

### Testing
- [ ] Unit tests for data cleaning
- [ ] Unit tests for feature engineering
- [ ] Integration tests for full pipeline
- [ ] Validate feature distributions
- [ ] Check for data leakage

## Notes

- Historical data is from GitHub (2000-2025)
- Team name mapping is critical for combining historical + API-Football data
- All features must be available at prediction time (no future data leakage)
- Configuration should be easily tunable for A/B testing
- Feature engineering should be reproducible and documented
- Data quality assessment should catch issues early

## Flow: ML Training → Production

1. **ML Phase 1:** Engineer Mind/Mood/DNA features for historical training data
2. **ML Phase 2:** Train models to learn optimal weights for these features
3. **ML Phase 3:** Extract learned weights from models
4. **Week-by-Week Phase 1:** Engineer same Mind/Mood/DNA features for production (real-time)
5. **Week-by-Week Phase 4:** Use ML-learned weights with production features to calculate base probability
6. **Result:** Production predictions use ML-learned optimal weights, improving accuracy

**Key Point:** The same features are engineered in both ML training (historical data) and production (real-time), ensuring ML-learned weights can be applied directly to production predictions.


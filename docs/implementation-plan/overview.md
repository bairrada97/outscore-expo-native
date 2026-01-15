# Betting Insights Algorithm - Implementation Overview

## High-Level Architecture

This document provides an overview of the complete implementation plan for the Betting Insights Algorithm. The implementation is organized into **week-by-week phases** that build upon each other systematically.

## ⚠️ PRE-IMPLEMENTATION CHECKPOINT

**CRITICAL:** Before starting **Phase 1** (Core Data Layer), you **MUST** complete all manual data requirements.

**See:** `docs/betting-insights-data-requirements.md` for the complete list of required manual data.

**The implementation will NOT proceed until you explicitly confirm:**
- ✅ All manual data has been added/verified
- ✅ All league IDs are correct
- ✅ All keyword lists are complete
- ✅ All mappings are populated

**When ready to implement, explicitly state:** "I have completed all manual data requirements and am ready to proceed with implementation."

This checkpoint ensures that the implementation can proceed smoothly without missing critical configuration data.

## Phase Structure

### Week-by-Week Implementation Phases

1. **Phase 1: Core Data Layer (Week 1)**
   - See: `phase1.md` for detailed implementation plan
   - Reference: "Phase 1: Core Data Layer" section in `betting-insights-algorithm.md`
   - Data fetching and caching
   - Stats calculation
   - Foundation for all subsequent phases

2. **Phase 2: Pattern Detection (Week 1-2)**
   - See: `phase2.md` for detailed implementation plan
   - Reference: "Phase 2: Pattern Detection" section in `betting-insights-algorithm.md`
   - Automatic pattern detection
   - Team and H2H pattern analysis

3. **Phase 3: Insight Generation (Week 2)**
   - See: `phase3.md` for detailed implementation plan
   - Reference: "Phase 3: Insight Generation" section in `betting-insights-algorithm.md`
   - Convert patterns to human-readable insights
   - Template-based insight generation

4. **Phase 3.5: Match Type Detection & Cup/League Adjustments**
   - See: `phase3.5.md` for detailed implementation plan
   - Reference: "Phase 3.5: Match Type Detection" section in `betting-insights-algorithm.md`
   - Match type detection (league, cup, international, friendly)
   - Match type-specific weight adjustments
   - Neutral venue detection
   - Derby/rivalry detection
   - Post-international break effects
   - End-of-season dynamics
   - League-specific characteristics
   - International match handling

5. **Phase 4: Scenario Simulations (Week 2-3)**
   - See: `phase4.md` for detailed implementation plan
   - Reference: "Phase 4: Market Predictions" section in `betting-insights-algorithm.md`
   - BothTeamsToScore simulation
   - TotalGoalsOverUnder simulation (includes line)
   - MatchOutcome simulation
   - FirstHalfActivity simulation
   - Related scenario suggestions

6. **Phase 4.5: Probability Swing Caps & Asymmetric Weighting**
   - See: `phase4.5.md` for detailed implementation plan
   - Reference: "Phase 4.5: Probability Swing Caps" section in `betting-insights-algorithm.md`
   - Hard probability swing caps
   - Confidence downgrade on large swings
   - Asymmetric weighting system
   - Kelly-aware confidence
   - Production monitoring

7. **Phase 4.6: Algorithm Refinements**
   - See: `phase4.6.md` for detailed implementation plan
   - Reference: "Phase 4.6: Algorithm Refinements" section in `betting-insights-algorithm.md`
   - Match Result prediction refinement
   - Rest advantage integration
   - Opponent quality weighting
   - Weighted scoring rate
   - Fixture congestion

8. **Phase 4.7: Team News & Injuries Integration**
   - See: `phase4.7.md` for detailed implementation plan
   - Injury data processing from pre-implemented endpoints
   - Player importance calculation using statistics
   - Market-specific injury adjustments
   - Integration into simulation functions

9. **Phase 5: API Endpoint (Week 3)**
   - See: `phase5.md` for detailed implementation plan
   - Main API endpoint implementation
   - Response structure
   - Caching strategy (reuses existing fixtures TTL behavior)

### Future Phases (Post-MVP)

10. **Phase 6: Odds Integration & Pricing (Deferred)**
    - See: `phase6-odds-pricing.md` for detailed roadmap
    - **Status:** DEFERRED - not blocking MVP
    - Odds ingestion and normalization
    - Value/edge computation vs market odds
    - Market coherence constraints
    - Kelly Criterion integration with real odds

## ML Model Training Phases (Separate Implementation)

These phases focus specifically on ML model training and are implemented separately from the week-by-week phases:

- **ML Phase 1: Historical Data Integration & Feature Engineering**
  - See: `ml-phase1.md` for detailed implementation plan
  - Reference: "ML Phase 1" sections (1.1-1.6) in `betting-insights-algorithm.md`
  - Data acquisition & cleaning (1.1)
  - Team name standardization (1.1.1)
  - Feature engineering - form calculations (1.2)
  - Opponent-adjusted rate stats (1.2.5)
  - Mind/Mood/DNA layers (1.3)
  - Match context features (1.4)
  - Probabilistic safety flags (1.4.5)
  - Data quality assessment (1.5)
  - Centralized configuration (1.6)

- **ML Phase 2: Machine Learning Model Development**
  - See: `ml-phase2.md` for detailed implementation plan
  - Reference: "ML Phase 2" sections (2.1-2.4) in `betting-insights-algorithm.md`
  - Target variables (2.1)
  - Model selection & training (2.2)
  - Optuna hyperparameter tuning (2.2.5)
  - Model evaluation metrics (2.3)
  - Class imbalance handling (2.3.5)
  - Model calibration (2.4)

- **ML Phase 3: ML Integration Architecture**
  - See: `ml-phase3.md` for detailed implementation plan
  - Reference: "ML Phase 3" sections (3.1-3.3.5) in `betting-insights-algorithm.md`
  - ML integration strategy (3.1)
  - Feature importance analysis (3.2)
  - Model retraining schedule (3.3)
  - Concept drift detection (3.3.5)

- **ML Phase 4: Backtesting & Validation**
  - See: `ml-phase4.md` for detailed implementation plan
  - Reference: "ML Phase 4" sections (4.1-4.3) in `betting-insights-algorithm.md`
  - Validation framework (4.1)
  - Enforcement & monitoring (4.1.4)
  - Adjustment interaction analysis (4.1.5)
  - Backtesting framework (4.2)
  - Edge case testing (4.3)

- **ML Phase 5: Advanced Features**
  - See: `ml-phase5.md` for detailed implementation plan
  - Reference: "ML Phase 5" sections (5.1-5.3) in `betting-insights-algorithm.md`
  - Additional features (5.1)
  - Market-specific models (5.2)
  - Real-time model updates (5.3)

- **ML Phase 6: Risk Management & Confidence Intervals**
  - See: `ml-phase6.md` for detailed implementation plan
  - Reference: "ML Phase 6" sections (6.1-6.3) in `betting-insights-algorithm.md`
  - Prediction confidence intervals (6.1)
  - Risk-adjusted simulations (6.2)
  - Model monitoring & alerting (6.3)

## Dependencies

```
Phase 1 (Core Data Layer)
  └─> Phase 2 (Pattern Detection)
      └─> Phase 3 (Insight Generation)
          └─> Phase 3.5 (Match Type Detection)
              └─> Phase 4 (Market Predictions)
                  └─> Phase 4.5 (Probability Caps & Asymmetry)
                      └─> Phase 4.6 (Algorithm Refinements)
                          └─> Phase 4.7 (Team News & Injuries)
                              └─> Phase 5 (API Endpoint)
```

## ML Usage Clarification

**Important:** ML (LightGBM + Optuna) is ONLY used to learn optimal weights for factors, NOT for making simulations.

**How ML is Used:**
1. **ML Training (ML Phases 1-2):** Train LightGBM models on historical data to learn which factor weights work best
2. **Weight Extraction (ML Phase 3):** Extract feature importance/weights from trained models
3. **Weight Storage:** Store ML-learned weights in configuration file
4. **Rule-Based Predictions (Week-by-Week Phases):** Use ML-learned weights in rule-based prediction calculations
5. **Rule-Based Adjustments:** Apply contextual/safety adjustments on top of ML-weighted base simulations

**Final Prediction Formula:**
```
baseProbability = calculateBasePrediction(features, mlLearnedWeights)
finalProbability = baseProbability + Σ(ruleBasedAdjustments)
```

**Why This Approach:**
- ML learns optimal historical patterns (what weights work best)
- Rules handle edge cases ML can't learn (rest days, early season, formation instability, etc.)
- Transparent: Shows base prediction and all adjustments
- Flexible: Easy to add new rule-based adjustments

## Key Concepts

### Three-Layer Data Strategy (Mind, Mood, DNA)

- **Mind (Baseline Quality - 50 matches):** Defines team's "True Tier" using Efficiency Index
- **Mood (Recent Momentum - 10 matches):** Captures recent form and momentum
- **DNA (Technical Trends - Season Stats):** Technical patterns (formations, goal timing, etc.)

### Core Markets

1. **BTTS (Both Teams to Score)**
2. **Over/Under 2.5 Goals**
3. **Match Result (1X2)**
4. **First Half Result**

### Key Features

- Team name standardization & mapping
- Formation stability detection
- Rest advantage calculation
- Opponent-adjusted stats
- Match type detection
- Safety flags (regression risk, motivation clash, live dog)
- Mind/Mood gap detection (sleeping giant, over-performer)
- Team news & injuries integration (player importance, market adjustments)

## Success Criteria

### ML Model Performance Targets

**Top 5 Leagues:**
- BTTS Model: Brier Score < 0.20, Log-Loss < 0.60, ROC-AUC > 0.70
- Over/Under Goals Models (per line): Brier Score < 0.22, Log-Loss < 0.65, ROC-AUC > 0.68
- Match Result Model: Multi-class Brier Score < 0.50, Log-Loss < 1.20
- First Half Model: Brier Score < 0.22, Log-Loss < 0.65

**Lower Leagues:**
- Slightly relaxed thresholds (+0.05-0.10)

### Validation Requirements

- Minimum 2% accuracy improvement
- Statistical significance (p < 0.05)
- Pass all edge case tests
- No performance degradation in any scenario

## Implementation Notes

- All phases build incrementally
- Each phase includes validation criteria
- Reference line numbers point to original markdown for detailed specifications
- Files created are tracked per phase
- Dependencies are clearly marked


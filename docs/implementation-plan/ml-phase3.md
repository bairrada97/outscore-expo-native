# ML Phase 3: ML Integration Architecture

**Reference:** See "ML Phase 3" sections (3.1-3.3.5) in `betting-insights-algorithm.md`

## Overview

ML Phase 3 focuses on extracting weights from trained ML models and integrating them into the production system. **Important:** ML is ONLY used to learn optimal weights - predictions remain rule-based. This phase implements Option A: ML learns optimal weights for main factors (via LightGBM + Optuna), weights are extracted and stored in config, then rule-based predictions use these ML-learned weights. Rule-based adjustments handle contextual/safety factors that ML can't learn. This phase also includes feature importance analysis, retraining schedules, and concept drift detection.

## Dependencies

- **ML Phase 2:** Machine Learning Model Development (Trained models)

## Sub-Phases

### ML 3.1 ML Integration Strategy: Option A

**Reference:** See "3.1 ML Integration Strategy" in `betting-insights-algorithm.md`

**Goal:** Implement hybrid ML + rule-based approach

#### Sub-tasks:

1. **ML Model Output Extraction**
   - Extract feature importance/weights from trained models
   - Convert to market-specific weights
   - Store weights in configuration file

2. **Weight Extraction**
   - Extract weights for: recentForm, h2h, homeAdvantage, scoringRate, defensiveForm, etc.
   - Different weights per market (BTTS, Over25, MatchResult, FirstHalf)
   - Normalize weights to sum to 1.0

3. **Configuration Update**
   - Update `config/algorithm-config.ts` with ML-learned weights
   - Make weights easily updatable
   - Version control weight changes

#### Architecture:

**Phase 1: ML Model Output (Pre-trained)**
- ML model learns optimal weights from historical data
- Outputs weights for each factor
- Weights stored in configuration

**Phase 2: Base Prediction (Using ML Weights)**
- Calculate base probability using ML-learned weights
- Features × ML weights = base prediction

**Phase 3: Rule-Based Adjustments (Contextual/Safety)**
- Apply adjustments for factors ML can't learn:
  - Rest days, early season, low H2H
  - Formation instability, safety flags
  - Mind/Mood gap, match type

**Final Prediction:**
- `finalProbability = baseProbability + Σ(ruleAdjustments)`

#### Files to Create:

- `ml/integration/extract-weights.py` - Extract weights from models
- `ml/integration/update-config.py` - Update configuration with ML weights
- `apps/backend/src/modules/betting-insights/config/ml-weights.ts` - ML-learned weights config

#### Validation Criteria:

- ✅ Weights extracted correctly from models
- ✅ Weights normalized correctly
- ✅ Configuration updated correctly
- ✅ Weights improve base predictions
- ✅ Rule-based adjustments still work

---

### ML 3.2 Feature Importance Analysis

**Reference:** See "3.2 Feature Importance Analysis" in `betting-insights-algorithm.md`

**Goal:** Analyze which features ML models find most predictive

#### Sub-tasks:

1. **Feature Importance Extraction**
   - Extract feature importance from LightGBM models
   - Rank features by importance
   - Compare across markets

2. **Comparison with Rule-Based Weights**
   - Compare ML feature importance with current rule-based weights
   - Identify discrepancies
   - Adjust rule-based weights if ML shows different patterns

3. **Feature Removal**
   - Remove features with near-zero importance
   - Document removed features
   - Retrain models without removed features

#### Files to Create:

- `ml/analysis/feature-importance.py` - Feature importance analysis
- `ml/analysis/compare-weights.py` - Compare ML vs rule-based weights

#### Validation Criteria:

- ✅ Feature importance extracted correctly
- ✅ Features ranked correctly
- ✅ Comparison with rule-based weights done
- ✅ Low-importance features identified
- ✅ Model performance maintained after feature removal

---

### ML 3.3 Model Retraining Schedule

**Reference:** See "3.3 Model Retraining Schedule" in `betting-insights-algorithm.md`

**Goal:** Implement retraining schedule for models

#### Sub-tasks:

1. **Retraining Frequency**
   - Weekly retraining: Update with latest match results
   - Seasonal retraining: Full retrain at start of each season
   - Feature update retraining: Retrain when adding new features

2. **Minimum Batch Size Check**
   - Skip retraining if batch too small (<2,000 unique matches)
   - Prevents noise from small datasets
   - Log skipped retraining attempts

3. **Incremental Learning** (Optional)
   - Consider online learning approaches
   - Or: Batch retraining with rolling window

4. **Team Name Mapping for Retraining**
   - Use team name mapping when combining historical + API-Football data
   - Normalize API-Football names to historical format
   - Ensure consistent naming across datasets

#### Files to Create:

- `ml/retraining/retrain-scheduler.py` - Retraining scheduler
- `ml/retraining/batch-size-check.py` - Batch size validation
- `ml/retraining/incremental-learning.py` - Incremental learning (optional)

#### Validation Criteria:

- ✅ Retraining scheduled correctly
- ✅ Batch size check works
- ✅ Team name mapping used correctly
- ✅ Retraining improves model performance
- ✅ Skipped retraining logged

---

### ML 3.3.5 Concept Drift Detection

**Reference:** See "3.3.5 Concept Drift Detection" in `betting-insights-algorithm.md`

**Goal:** Detect when model performance degrades due to concept drift

#### Sub-tasks:

1. **Performance-Based Drift Detection**
   - Monitor accuracy and Brier score over rolling window
   - Detect drops in performance
   - Alert when performance degrades

2. **Baseline Metrics**
   - Store baseline metrics from last retraining
   - Compare current metrics to baseline
   - Calculate change in metrics

3. **Drift Detection Logic**
   - Accuracy drop threshold: 2%
   - Brier score increase threshold: 0.02
   - Consecutive failures: 2
   - Trigger retraining when drift detected

4. **Adaptive Retraining**
   - Trigger retraining when drift detected
   - Instead of fixed weekly schedule
   - More efficient and responsive

#### Files to Create:

- `ml/monitoring/concept-drift-detector.py` - Concept drift detection
- `ml/monitoring/performance-monitor.py` - Performance monitoring
- `ml/monitoring/drift-alerts.py` - Drift alert system

#### Validation Criteria:

- ✅ Performance monitored correctly
- ✅ Baseline metrics stored correctly
- ✅ Drift detected correctly
- ✅ Alerts triggered appropriately
- ✅ Adaptive retraining works

---

## Key Data Structures

### ML Weights Configuration

```typescript
interface MLWeights {
  btts: {
    scoringRate: number;
    h2h: number;
    defensiveForm: number;
    recentForm: number;
    // ... other factors
  };
  over25: {
    avgGoalsPerGame: number;
    recentForm: number;
    h2h: number;
    defensiveWeakness: number;
    // ... other factors
  };
  matchResult: {
    recentForm: number;
    h2h: number;
    homeAdvantage: number;
    motivation: number;
    rest: number;
    leaguePosition: number;
    // ... other factors
  };
  firstHalf: {
    firstHalfScoring: number;
    slowStarters: number;
    recentForm: number;
    h2h: number;
    // ... other factors
  };
}
```

## Implementation Checklist

### ML Integration Strategy
- [ ] Extract weights from trained models
- [ ] Normalize weights
- [ ] Update configuration with ML weights
- [ ] Test base predictions with ML weights
- [ ] Verify rule-based adjustments still work

### Feature Importance Analysis
- [ ] Extract feature importance
- [ ] Rank features
- [ ] Compare with rule-based weights
- [ ] Remove low-importance features
- [ ] Retrain models if needed

### Retraining Schedule
- [ ] Implement weekly retraining
- [ ] Implement seasonal retraining
- [ ] Implement feature update retraining
- [ ] Implement batch size check
- [ ] Implement team name mapping for retraining

### Concept Drift Detection
- [ ] Implement performance monitoring
- [ ] Implement baseline storage
- [ ] Implement drift detection logic
- [ ] Implement adaptive retraining
- [ ] Test drift detection

### Testing
- [ ] Unit tests for weight extraction
- [ ] Unit tests for feature importance
- [ ] Unit tests for retraining scheduler
- [ ] Unit tests for drift detection
- [ ] Integration tests for full pipeline

## Notes

- **CRITICAL:** ML is ONLY for learning weights, NOT for predictions
- ML models train to learn optimal factor weights (recentForm, h2h, homeAdvantage, etc.)
- Weights are extracted from model feature importance
- Extracted weights stored in config and used by rule-based predictions
- Rule-based predictions (Week-by-Week Phase 4) use ML-learned weights for base probability
- Rule-based adjustments handle edge cases ML can't learn
- Feature importance helps identify which features matter most
- Retraining keeps weights up-to-date as new data arrives
- Concept drift detection triggers adaptive retraining
- Team name mapping critical for retraining (combining datasets)
- Minimum batch size prevents noise from small datasets
- Adaptive retraining more efficient than fixed schedule

## Integration with Week-by-Week Phases

- ML weights used in Phase 4 (Market Predictions) for base predictions
- Rule-based adjustments from Phase 3.5 applied on top of ML base
- Feature importance can inform Phase 1 feature engineering
- Retraining schedule runs independently of week-by-week phases
- Concept drift detection monitors production performance


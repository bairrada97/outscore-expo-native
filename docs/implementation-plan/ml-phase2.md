# ML Phase 2: Machine Learning Model Development

**Reference:** Lines 3330-4005 in `betting-insights-algorithm.md`

## Overview

ML Phase 2 focuses on training ML models (LightGBM) for each betting market. **Important:** These models are NOT used for direct predictions. Instead, they learn optimal weights for factors (recentForm, h2h, homeAdvantage, etc.) which are then extracted and used in rule-based predictions. This phase includes target variable creation, model selection, hyperparameter tuning with Optuna, evaluation metrics, class imbalance handling, and model calibration.

## Dependencies

- **ML Phase 1:** Historical Data Integration & Feature Engineering (Features ready)

## Sub-Phases

### ML 2.1 Target Variables for ML Training

**Reference:** Lines 3332-3356

**Goal:** Create target variables for each betting market

#### Sub-tasks:

1. **BTTS Target Variables**
   - `BTTS_Yes`: Binary (1 if both teams scored, 0 otherwise)
   - `BTTS_No`: Binary (inverse of BTTS_Yes)

2. **Over/Under 2.5 Target Variables**
   - `Over25_Yes`: Binary (1 if total goals > 2.5, 0 otherwise)
   - `Under25_Yes`: Binary (inverse of Over25_Yes)

3. **Match Result Target Variables**
   - `HomeWin`: Binary (1 if home team won, 0 otherwise)
   - `Draw`: Binary (1 if draw, 0 otherwise)
   - `AwayWin`: Binary (1 if away team won, 0 otherwise)
   - Multi-class: 0 (Home), 1 (Draw), 2 (Away)

4. **First Half Target Variables**
   - `FirstHalfGoals_Yes`: Binary (1 if goals scored in first half, 0 otherwise)
   - `FirstHalfGoals_No`: Binary (inverse)

5. **Additional Regression Targets**
   - `Goal_Total`: Continuous (total goals in match)
   - `HomeGoals`: Continuous (home team goals)
   - `AwayGoals`: Continuous (away team goals)
   - `FirstHalfGoals`: Continuous (goals in first half)

#### Files to Create:

- `ml/targets/create-targets.py` - Target variable creation
- `ml/targets/target-schema.py` - Target variable schema

#### Validation Criteria:

- ✅ All target variables created correctly
- ✅ Binary targets are 0/1
- ✅ Multi-class targets are 0/1/2
- ✅ Regression targets are continuous
- ✅ No data leakage in targets

---

### ML 2.2 Model Selection & Training

**Reference:** Lines 3357-3384

**Goal:** Select and train LightGBM models for each market

#### Sub-tasks:

1. **Model Architecture**
   - BTTS Model: Binary classification (LightGBM)
   - Over25 Model: Binary classification (LightGBM)
   - Match Result Model: Multi-class classification (LightGBM, 3 classes)
   - First Half Model: Binary classification (LightGBM)
   - Goal Prediction Model: Regression (LightGBM)

2. **Training Strategy**
   - Time-based split: Train on 2003-2023, validate on 2025, test on 2026
   - Cross-validation: Use time-series cross-validation (walk-forward validation)
   - Early stopping: Prevent overfitting with validation set monitoring

3. **Feature Selection**
   - Use only features available at prediction time
   - Exclude: Injuries (unless proxied), weather (unless available), referee (unless historical pattern)
   - Include: All Mind/Mood/DNA features, H2H features, contextual features

#### Files to Create:

- `ml/models/train-btts-model.py` - BTTS model training
- `ml/models/train-over25-model.py` - Over 2.5 model training
- `ml/models/train-match-result-model.py` - Match Result model training
- `ml/models/train-first-half-model.py` - First Half model training
- `ml/models/train-goal-prediction-model.py` - Goal prediction model training
- `ml/models/base-trainer.py` - Base training utilities

#### Validation Criteria:

- ✅ Models train successfully
- ✅ Time-based split correct
- ✅ Cross-validation works
- ✅ Early stopping prevents overfitting
- ✅ Feature selection correct (no leakage)

---

### ML 2.2.5 Optuna Hyperparameter Tuning

**Reference:** Lines 3385-3701

**Goal:** Optimize hyperparameters using Optuna

#### Sub-tasks:

1. **Optuna Study Setup**
   - Create study with TPE sampler
   - Set direction (minimize Brier score, maximize accuracy)
   - Enable pruning with MedianPruner

2. **Hyperparameter Search Space**
   - `num_leaves`: 10-300
   - `learning_rate`: 0.01-0.3 (log scale)
   - `feature_fraction`: 0.4-1.0
   - `bagging_fraction`: 0.4-1.0
   - `bagging_freq`: 1-7
   - `min_child_samples`: 5-100
   - `min_child_weight`: 0.001-10 (log scale)
   - `reg_alpha`: 0.0-10.0 (log scale)
   - `reg_lambda`: 0.0-10.0 (log scale)
   - `max_depth`: 3-15

3. **Objective Function**
   - Train model with suggested hyperparameters
   - Evaluate on validation set
   - Return metric (Brier score, log-loss, accuracy, ROC-AUC)

4. **Study Execution**
   - Run N trials (default: 100)
   - Store study results
   - Get best hyperparameters

#### Files to Create:

- `ml/hyperparameter-tuning/optuna-setup.py` - Optuna study setup
- `ml/hyperparameter-tuning/objective-functions.py` - Objective functions
- `ml/hyperparameter-tuning/run-tuning.py` - Run hyperparameter tuning

#### Validation Criteria:

- ✅ Optuna study created correctly
- ✅ Hyperparameter search space appropriate
- ✅ Objective function works correctly
- ✅ Best hyperparameters found
- ✅ Study results stored for reproducibility

---

### ML 2.3 Model Evaluation Metrics

**Reference:** Lines 3701-3724

**Goal:** Evaluate models using appropriate metrics

#### Sub-tasks:

1. **Classification Metrics (BTTS, Over25, First Half)**
   - Brier Score (lower is better - measures calibration)
   - Log-Loss (lower is better - penalizes confident wrong predictions)
   - ROC-AUC (higher is better - measures discrimination)
   - Precision/Recall (per class)
   - Accuracy (overall correctness)

2. **Multi-class Metrics (Match Result)**
   - Multi-class Brier Score
   - Multi-class Log-Loss
   - Per-class Accuracy (Home/Draw/Away separately)

3. **Regression Metrics (Goal Prediction)**
   - MAE (Mean Absolute Error)
   - RMSE (Root Mean Squared Error)
   - R² Score

4. **Baseline Comparison**
   - Compare vs current hard-coded weights
   - Compare vs simple baselines (always predict most common outcome)
   - Compare vs bookmaker odds (if available)

#### Files to Create:

- `ml/evaluation/classification-metrics.py` - Classification metrics
- `ml/evaluation/multiclass-metrics.py` - Multi-class metrics
- `ml/evaluation/regression-metrics.py` - Regression metrics
- `ml/evaluation/baseline-comparison.py` - Baseline comparison

#### Validation Criteria:

- ✅ All metrics calculated correctly
- ✅ Baseline comparison shows improvement
- ✅ Metrics meet success criteria (see overview.md)

---

### ML 2.3.5 Class Imbalance Handling

**Reference:** Lines 3724-3994

**Goal:** Handle class imbalance in Match Result predictions

#### Sub-tasks:

1. **Class Weight Calculation**
   - Calculate class weights based on class frequency
   - Inverse frequency weighting: `weight = total_samples / (n_classes * class_count)`

2. **LightGBM Integration**
   - Use `class_weight='balanced'` or custom weights
   - Apply to Match Result model

3. **Alternative: Focal Loss** (Advanced)
   - Implement focal loss for severe imbalance
   - Focus learning on hard examples

#### Files to Create:

- `ml/models/class-imbalance-handling.py` - Class imbalance utilities
- Extend Match Result model training to use class weights

#### Validation Criteria:

- ✅ Class weights calculated correctly
- ✅ Match Result model uses class weights
- ✅ Draw prediction accuracy improves
- ✅ Overall accuracy improves by 1-3%

---

### ML 2.4 Model Calibration

**Reference:** Lines 3994-4004

**Goal:** Calibrate model probabilities

#### Sub-tasks:

1. **Probability Calibration**
   - Use Platt Scaling or Isotonic Regression
   - Calibrate probabilities to match actual frequencies
   - Critical for betting applications

2. **Calibration Validation**
   - Plot calibration curves (predicted vs actual probabilities)
   - Calculate Expected Calibration Error (ECE)
   - Ensure probabilities are well-calibrated

#### Files to Create:

- `ml/calibration/calibrate-models.py` - Model calibration
- `ml/calibration/calibration-validation.py` - Calibration validation

#### Validation Criteria:

- ✅ Models calibrated correctly
- ✅ Calibration curves show good fit
- ✅ ECE < 0.05
- ✅ Probabilities match actual frequencies

---

## Key Data Structures

### Model Configuration

```python
model_config = {
    'btts': {
        'objective': 'binary',
        'metric': 'binary_logloss',
        'num_leaves': 31,
        'learning_rate': 0.05,
        # ... best hyperparameters from Optuna
    },
    'over25': {
        'objective': 'binary',
        'metric': 'binary_logloss',
        # ... best hyperparameters
    },
    'match_result': {
        'objective': 'multiclass',
        'num_class': 3,
        'class_weight': 'balanced',
        # ... best hyperparameters
    },
    'first_half': {
        'objective': 'binary',
        'metric': 'binary_logloss',
        # ... best hyperparameters
    },
}
```

## Implementation Checklist

### Target Variables
- [ ] Create BTTS targets
- [ ] Create Over 2.5 targets
- [ ] Create Match Result targets
- [ ] Create First Half targets
- [ ] Create regression targets

### Model Training
- [ ] Train BTTS model
- [ ] Train Over 2.5 model
- [ ] Train Match Result model
- [ ] Train First Half model
- [ ] Train Goal Prediction model

### Hyperparameter Tuning
- [ ] Set up Optuna studies
- [ ] Define search spaces
- [ ] Implement objective functions
- [ ] Run tuning for all models
- [ ] Store best hyperparameters

### Evaluation
- [ ] Calculate classification metrics
- [ ] Calculate multi-class metrics
- [ ] Calculate regression metrics
- [ ] Compare vs baselines
- [ ] Verify success criteria met

### Class Imbalance
- [ ] Calculate class weights
- [ ] Apply to Match Result model
- [ ] Verify improvement

### Calibration
- [ ] Calibrate all models
- [ ] Validate calibration
- [ ] Store calibration parameters

### Testing
- [ ] Unit tests for target creation
- [ ] Unit tests for model training
- [ ] Unit tests for evaluation
- [ ] Integration tests for full pipeline
- [ ] Validate model performance

## Notes

- **CRITICAL:** ML models are ONLY for learning optimal weights, NOT for making predictions
- Models train on historical data to learn which factor weights work best
- Feature importance/weights are extracted from trained models (see ML Phase 3)
- Extracted weights are used in rule-based predictions (Week-by-Week Phase 4)
- LightGBM chosen for fast CPU training (important for retraining)
- Time-series cross-validation prevents data leakage
- Hyperparameter tuning with Optuna optimizes for Brier score (calibration)
- Class imbalance handling critical for Match Result (draws are rare)
- Model calibration helps ensure learned weights are well-calibrated
- All models should meet success criteria before weight extraction

## Success Criteria

**Top 5 Leagues:**
- BTTS Model: Brier Score < 0.20, Log-Loss < 0.60, ROC-AUC > 0.70
- Over25 Model: Brier Score < 0.22, Log-Loss < 0.65, ROC-AUC > 0.68
- Match Result Model: Multi-class Brier Score < 0.50, Log-Loss < 1.20
- First Half Model: Brier Score < 0.22, Log-Loss < 0.65

**Lower Leagues:**
- Slightly relaxed thresholds (+0.05-0.10)


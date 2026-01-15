# Phase 4.5: Probability Swing Caps & Asymmetric Weighting

**Reference:** See "Phase 4.5: Probability Swing Caps" section in `betting-insights-algorithm.md`

## Overview

Phase 4.5 implements probability swing caps and asymmetric weighting to prevent wild probability swings and optimize for profitability rather than just accuracy. This phase ensures predictions remain reasonable and confidence levels match probability movements.

## Dependencies

- **Phase 4:** Market Predictions (Prediction functions)

## Sub-Phases

### 4.5.1 Hard Probability Swing Cap

**Reference:** See "4.5.1 Hard Probability Swing Cap" in `betting-insights-algorithm.md`

**Goal:** Prevent wild probability swings from base probability

#### Sub-tasks:

1. **Global Hard Cap Implementation**
   - Maximum swing: ±22% from base probability (configurable)
   - Absolute bounds: Never below 20%, never above 80%
   - Apply to all markets

2. **Swing Calculation**
   - Calculate total adjustment magnitude
   - Cap adjustment to max swing
   - Apply absolute probability bounds

#### Files to Create:

- `apps/backend/src/modules/betting-insights/utils/probability-caps.ts` - Probability capping logic
- `apps/backend/src/modules/betting-insights/config/algorithm-config.ts` - Configuration with caps

#### Validation Criteria:

- ✅ Total swing never exceeds ±22%
- ✅ Probabilities never go below 20% or above 80%
- ✅ Caps apply to all markets
- ✅ Configuration is easily adjustable

---

### 4.5.2 Confidence Downgrade on Large Swings

**Reference:** See "4.5.2 Confidence Downgrade" in `betting-insights-algorithm.md`

**Goal:** Downgrade confidence when large swings occur

#### Sub-tasks:

1. **Swing Magnitude Monitoring**
   - Track total adjustment magnitude
   - Track number of adjustments

2. **Confidence Downgrade Logic**
   - Swing >15%: Downgrade by 2 levels (HIGH → LOW, MEDIUM → LOW)
   - Swing 10-15%: Downgrade by 1 level (HIGH → MEDIUM, MEDIUM → LOW)
   - Many adjustments (>4): Slight downgrade (HIGH → MEDIUM)

#### Files to Create:

- `apps/backend/src/modules/betting-insights/utils/confidence-downgrade.ts` - Confidence downgrade logic
- Extend `apps/backend/src/modules/betting-insights/config/algorithm-config.ts` - Add confidence downgrade config

#### Validation Criteria:

- ✅ Confidence downgrades correctly based on swing magnitude
- ✅ Many adjustments trigger downgrade
- ✅ Confidence never increases due to swings
- ✅ Downgrade thresholds are configurable

---

### 4.5.3 Asymmetric Weighting System

**Reference:** See "4.5.3 Asymmetric Weighting System" in `betting-insights-algorithm.md`

**Goal:** Apply different caps for upward vs downward moves based on market odds and risk/reward

#### Sub-tasks:

1. **Market-Specific Asymmetric Configuration**
   - BTTS: Upward cap 12%, downward cap 20% (stricter on upward)
   - Over 2.5: Upward cap 18%, downward cap 15% (more lenient on upward)
   - Match Result: Upward cap 10%, downward cap 25% (very strict on favorites, lenient on underdogs)
   - First Half: Upward cap 15%, downward cap 18% (balanced)

2. **Direction Detection**
   - Detect if adjustment is upward or downward
   - Apply appropriate cap based on direction

3. **Risk Multiplier Application**
   - Apply risk multipliers for false positives/negatives
   - Penalize false positives more for low-odds markets

#### Files to Create:

- `apps/backend/src/modules/betting-insights/utils/asymmetric-weighting.ts` - Asymmetric weighting logic
- `apps/backend/src/modules/betting-insights/config/asymmetric-config.ts` - Asymmetric configuration

#### Validation Criteria:

- ✅ Upward moves capped differently than downward moves
- ✅ Market-specific caps applied correctly
- ✅ Risk multipliers work correctly
- ✅ Configuration is easily adjustable

---

### 4.5.4 Kelly-Aware Confidence

**Reference:** See "4.5.4 Kelly-Aware Confidence" in `betting-insights-algorithm.md`

**Goal:** Adjust confidence based on Kelly Criterion for optimal bet sizing

#### Sub-tasks:

1. **Kelly Criterion Calculation**
   - Calculate optimal bet size based on probability and odds
   - Adjust confidence based on Kelly fraction

2. **Confidence Adjustment**
   - High Kelly fraction → Higher confidence
   - Low Kelly fraction → Lower confidence

#### Files to Create:

- `apps/backend/src/modules/betting-insights/utils/kelly-confidence.ts` - Kelly-aware confidence (optional, advanced)

#### Validation Criteria:

- ✅ Kelly fraction calculated correctly
- ✅ Confidence adjusted appropriately
- ✅ Works with or without odds data

---

### 4.5.5 Cumulative Caps & Overcorrection Detection

**Reference:** See "4.5.5 Cumulative Caps" in `betting-insights-algorithm.md`

**Goal:** Prevent same-type adjustment stacking and detect overcorrection

#### Sub-tasks:

1. **Cumulative Caps Implementation**
   - `applyCumulativeCaps()` - Prevents same-type adjustments from stacking
   - Groups adjustments by type (formation, injuries, DNA, safety, rest)
   - Applies cumulative caps per type:
     - Formation: ±15% total
     - Injuries: ±15% total
     - DNA: ±8% total
     - Safety: ±12% total
     - Rest: ±5% total

2. **Overcorrection Detection**
   - `detectOvercorrection()` - Detects conflicting/excessive adjustments
   - Checks for too many adjustments (>5)
   - Checks for large total swing (>18%)
   - Checks for conflicting adjustments (positive + negative both >8%)
   - Checks for multiple high-impact adjustments of same type
   - Returns reduction factor (0-1) and reason

#### Files to Create:

- `apps/backend/src/modules/betting-insights/utils/cumulative-caps.ts` - Cumulative caps logic
- `apps/backend/src/modules/betting-insights/utils/overcorrection-detection.ts` - Overcorrection detection

#### Validation Criteria:

- ✅ Cumulative caps prevent same-type stacking
- ✅ Overcorrection detection triggers correctly
- ✅ Reduction factors applied appropriately
- ✅ Warnings logged when overcorrection detected

---

### 4.5.6 Unified Helper Function

**Reference:** See "4.5.6 Unified Helper Function" in `betting-insights-algorithm.md`

**Goal:** Create single helper function for all caps, asymmetry, and overcorrection protection

#### Sub-tasks:

1. **Unified Function Implementation**
   - `applyCappedAsymmetricAdjustments()` - Single function for all caps
   - Handles cumulative caps, overcorrection detection, hard cap, asymmetric caps
   - Returns final probability, total adjustment, capped adjustments, and overcorrection warning
   - Updated `CappedAdjustmentResult` interface includes `overcorrectionWarning?: string`

2. **Integration**
   - Update all prediction functions to use unified helper
   - Ensure all adjustments collected in array before applying
   - Ensure consistent application across markets

#### Files to Create:

- `apps/backend/src/modules/betting-insights/utils/capped-adjustments.ts` - Unified helper function

#### Validation Criteria:

- ✅ All caps applied correctly (cumulative, hard cap, asymmetric)
- ✅ Overcorrection detection integrated
- ✅ Asymmetric weighting works
- ✅ Confidence downgrade works
- ✅ Easy to use in all prediction functions
- ✅ All adjustments go through unified function (no direct additions)

---

### 4.5.7 Production Monitoring & Auto-Correction

**Reference:** See "4.5.7 Production Monitoring" in `betting-insights-algorithm.md`

**Goal:** Monitor production predictions and auto-correct issues

#### Sub-tasks:

1. **Monitoring Implementation**
   - Track probability swing distribution
   - Track confidence distribution
   - Alert if swings exceed caps
   - Track Brier score

2. **Auto-Correction**
   - Auto-disable adjustments if performance degrades
   - Auto-adjust caps if needed
   - Log anomalies for review

#### Files to Create:

- `apps/backend/src/modules/betting-insights/monitoring/probability-monitor.ts` - Production monitoring
- `apps/backend/src/modules/betting-insights/monitoring/auto-correction.ts` - Auto-correction logic

#### Validation Criteria:

- ✅ Monitoring tracks key metrics
- ✅ Alerts trigger correctly
- ✅ Auto-correction works safely
- ✅ Logs are comprehensive

---

## Key Data Structures

### ProbabilityCapsConfig Interface

```typescript
interface ProbabilityCapsConfig {
  maxSwing: number;        // Max ±22% swing from base
  minProb: number;         // Never below 20%
  maxProb: number;         // Never above 80%
}

interface ConfidenceDowngradeConfig {
  largeSwingThreshold: number;      // 15%
  mediumSwingThreshold: number;     // 10%
  manyAdjustmentsThreshold: number; // 4
}

interface AsymmetricConfig {
  market: string;
  direction: 'UP' | 'DOWN';
  maxAdjustment: number;
  riskMultiplier: number;
  falsePositivePenalty: number;
  falseNegativePenalty: number;
}
```

## Implementation Checklist

### Hard Probability Swing Cap
- [ ] Implement `applyProbabilityCap()` function
- [ ] Implement global hard cap (±22%)
- [ ] Implement absolute bounds (20-80%)
- [ ] Add to configuration

### Confidence Downgrade
- [ ] Implement `calculateConfidenceWithSwing()` function
- [ ] Implement swing magnitude tracking
- [ ] Implement adjustment count tracking
- [ ] Implement downgrade logic
- [ ] Add to configuration

### Asymmetric Weighting
- [ ] Create asymmetric configuration for all markets
- [ ] Implement direction detection
- [ ] Implement market-specific caps
- [ ] Implement risk multipliers
- [ ] Test with various scenarios

### Cumulative Caps & Overcorrection Detection
- [ ] Implement `applyCumulativeCaps()` function
- [ ] Implement `detectOvercorrection()` function
- [ ] Test cumulative caps prevent same-type stacking
- [ ] Test overcorrection detection triggers correctly
- [ ] Test reduction factors applied appropriately

### Unified Helper Function
- [ ] Implement `applyCappedAsymmetricAdjustments()` function
- [ ] Integrate cumulative caps into unified function
- [ ] Integrate overcorrection detection into unified function
- [ ] Integrate hard cap, asymmetric caps, confidence downgrade
- [ ] Update `CappedAdjustmentResult` interface with `overcorrectionWarning`
- [ ] Update BTTS prediction to collect adjustments in array and use helper
- [ ] Update Over 2.5 prediction to collect adjustments in array and use helper
- [ ] Update Match Result prediction to collect adjustments in array and use helper
- [ ] Update First Half prediction to collect adjustments in array and use helper
- [ ] Ensure NO direct adjustment additions (all through unified function)

### Production Monitoring
- [ ] Implement probability swing tracking
- [ ] Implement confidence distribution tracking
- [ ] Implement alert system
- [ ] Implement auto-correction (optional)

### Testing
- [ ] Unit tests for probability caps
- [ ] Unit tests for confidence downgrade
- [ ] Unit tests for asymmetric weighting
- [ ] Unit tests for cumulative caps
- [ ] Unit tests for overcorrection detection
- [ ] Unit tests for unified helper
- [ ] Test edge cases (many adjustments, large swings, conflicting adjustments)
- [ ] Test same-type adjustment stacking prevention
- [ ] Integration tests with prediction functions
- [ ] Test configuration changes

## Acceptance Gates (Before Phase 5)

Before proceeding to Phase 5, the following acceptance criteria must be met:

### Calibration Validation
- [ ] **Post-cap Brier score ≤ pre-cap Brier score** - Caps should not degrade calibration
- [ ] **Per-market ECE < 0.10** - After caps, probabilities still well-calibrated
- [ ] **Swing distribution documented** - Know how often caps are hit

### Cap Effectiveness
- [ ] **Cap-hit rate < 15%** - Caps should not be triggered too often (indicates base predictions need tuning)
- [ ] **Overcorrection rate < 5%** - Very few predictions should trigger overcorrection detection
- [ ] **Confidence distribution reasonable** - Not all HIGH or all LOW

### Kill-Switch Criteria (Production)

The following thresholds should trigger investigation or auto-disable:

| Metric | Warning | Critical (Auto-Disable) |
|--------|---------|------------------------|
| Brier Score Increase | +0.02 vs baseline | +0.05 vs baseline |
| ECE Increase | +0.03 vs baseline | +0.08 vs baseline |
| Cap-Hit Rate | >20% | >35% |
| Overcorrection Rate | >10% | >20% |
| Swing >20% Rate | >5% | >15% |

### Feature Flags
- [ ] **Per-adjustment-type disable flags** - Ability to disable formation, injury, match-type, etc. independently
- [ ] **Global cap disable flag** - Fallback to uncapped predictions if caps cause issues
- [ ] **Monitoring dashboard** - Real-time visibility into cap/swing metrics

## Notes

- Hard cap prevents wild swings (e.g., 68% → 42% becomes 68% → 46%)
- Cumulative caps prevent same-type adjustments from stacking (e.g., multiple formation adjustments)
- Overcorrection detection reduces conflicting/excessive adjustments automatically
- Asymmetric weighting optimizes for profitability (stricter on low-odds favorites)
- Confidence downgrade prevents mismatched confidence-probability
- Unified helper ensures consistent application across all prediction functions
- **CRITICAL:** All adjustments must be collected in array and applied through unified function - NO direct additions
- Production monitoring ensures caps hold in live environment
- All thresholds are configurable for easy tuning
- Safe launch values provided in algorithm document

## Safe Launch Configuration

```typescript
const SAFE_LAUNCH_CONFIG = {
  probabilityCaps: {
    maxSwing: 22,
    minProb: 20,
    maxProb: 80,
  },
  confidenceDowngrade: {
    largeSwingThreshold: 15,
    mediumSwingThreshold: 10,
    manyAdjustmentsThreshold: 4,
  },
  asymmetricWeighting: {
    btts: { upMax: 12, downMax: 20 },
    overUnderGoals: { upMax: 18, downMax: 15 },
    matchResult: { upMax: 10, downMax: 25 },
    firstHalf: { upMax: 15, downMax: 18 },
  },
};
```


# Phase 4: Market Predictions (Week 2-3)

**Reference:** Lines 9445-10318 in `betting-insights-algorithm.md`

## Overview

Phase 4 implements probability calculations for all betting markets (BTTS, Over/Under 2.5, Match Result, First Half). This phase combines all previous phases' data and patterns to generate accurate predictions with confidence levels.

## Dependencies

- **Phase 1:** Core Data Layer (TeamData, H2HData, helper functions)
- **Phase 2:** Pattern Detection (Patterns)
- **Phase 3:** Insight Generation (Insights)
- **Phase 3.5:** Match Type Detection (Match type adjustments)

## Sub-Phases

### 4.1 BTTS Prediction

**Reference:** Lines 5797-5893

**Goal:** Predict probability of Both Teams to Score

#### Sub-tasks:

1. **Factor Calculation**
   - Scoring Rate (25%): Calculate percentage of matches with goals scored
   - Defensive Form (20%): Calculate clean sheet percentage (lower = better for BTTS)
   - Recent Form (35%): Overall form including goals scored/conceded
   - H2H BTTS (25%): Recency-weighted BTTS percentage from H2H matches
   - Home Advantage (10%): Less relevant for BTTS
   - Motivation (15%): Must-win teams more attacking
   - Rest Days (8%): Tired teams defend worse

2. **Weight Adjustment**
   - Apply match type adjustments (Phase 3.5)
   - Apply rest day adjustments
   - Apply early season adjustments
   - Apply low H2H adjustments

3. **Probability Calculation**
   - Combine weighted factors
   - Convert to probability using sigmoid function
   - Apply conservatism adjustment
   - Apply formation stability adjustments (40% less impact)

4. **Safety Flags**
   - Detect regression risk
   - Detect motivation clash
   - Detect live dog patterns

#### Files to Create:

- `apps/backend/src/modules/betting-insights/predictions/predict-btts.ts` - BTTS prediction logic
- Extend `apps/backend/src/modules/betting-insights/utils/weight-adjustments.ts` - Add BTTS-specific adjustments

#### Validation Criteria:

- ✅ Scoring rate calculated correctly
- ✅ Defensive form impacts BTTS appropriately
- ✅ H2H BTTS uses recency weighting
- ✅ Motivation impacts BTTS correctly
- ✅ Rest days impact BTTS correctly
- ✅ Formation stability has 40% less impact
- ✅ Probability range is reasonable (20-80%)

---

### 4.2 Over/Under 2.5 Goals Prediction

**Reference:** Lines 5896-5994

**Goal:** Predict probability of Over 2.5 goals

#### Sub-tasks:

1. **Factor Calculation**
   - Average Goals Per Game (30%): Combined scoring rate
   - Defensive Weakness (25%): Goals conceded per game
   - Recent Form (30%): Over 2.5 in recent matches
   - H2H Goals (20%): Recency-weighted average goals in H2H
   - Home Advantage (12%): Home teams score more
   - Motivation (10%): Must-win games higher scoring
   - Rest Days (8%): Fatigue increases late goals

2. **Weight Adjustment**
   - Apply match type adjustments
   - Apply rest day adjustments
   - Apply early season adjustments

3. **Probability Calculation**
   - Combine weighted factors
   - Convert to probability
   - Apply formation stability adjustments (40% less impact)

#### Files to Create:

- `apps/backend/src/modules/betting-insights/predictions/predict-over25.ts` - Over 2.5 prediction logic

#### Validation Criteria:

- ✅ Average goals calculated correctly
- ✅ Defensive weakness impacts Over 2.5 appropriately
- ✅ H2H goals use recency weighting
- ✅ Motivation impacts Over 2.5 correctly
- ✅ Formation stability has 40% less impact
- ✅ Probability range is reasonable

---

### 4.3 Match Result Prediction

**Reference:** Lines 5997-6014, 11551-12242

**Goal:** Predict probability of Home Win, Draw, Away Win

#### Sub-tasks:

1. **Factor Calculation** (Critical - Full Implementation)
   - Recent Form Comparison (30%): Compare home vs away form
   - H2H Record (25%): Win percentages from H2H
   - Dynamic Home Advantage (20%): Based on home/away stats
   - Motivation (18%): Who wants it more
   - Rest Advantage (12%): Days since last match difference
   - League Position Gap (10%): Quality difference

2. **Base Probability Calculation**
   - Calculate home win probability from factors
   - Calculate away win probability (inverse)
   - Calculate draw probability (from H2H, adjusted for form similarity)

3. **Adjustments**
   - Apply Mind/Mood gap adjustments (sleeping giant, over-performer)
   - Apply motivation clash adjustments
   - Apply formation stability adjustments (full impact)
   - Apply safety flags

4. **Normalization**
   - Ensure probabilities sum to 100%
   - Ensure probabilities are positive
   - Apply probability caps (Phase 4.5)

#### Files to Create:

- `apps/backend/src/modules/betting-insights/predictions/predict-match-result.ts` - Match Result prediction logic
- `apps/backend/src/modules/betting-insights/utils/form-score.ts` - Form score calculation
- `apps/backend/src/modules/betting-insights/utils/home-advantage.ts` - Dynamic home advantage calculation
- `apps/backend/src/modules/betting-insights/utils/motivation-score.ts` - Motivation score calculation
- `apps/backend/src/modules/betting-insights/utils/rest-score.ts` - Rest advantage calculation
- `apps/backend/src/modules/betting-insights/utils/position-score.ts` - League position score calculation

#### Validation Criteria:

- ✅ All factors used (not simplified)
- ✅ Home advantage is dynamic (not fixed)
- ✅ Probabilities sum to 100%
- ✅ Sleeping giant/over-performer adjustments work
- ✅ Formation stability has full impact
- ✅ Probability range is reasonable

---

### 4.4 First Half Prediction

**Reference:** Lines 6017-6046

**Goal:** Predict probability of goals in first half

#### Sub-tasks:

1. **Factor Calculation**
   - First Half Scoring Rate (40%): Percentage of matches with first-half goals
   - Slow Starters Pattern (30%): Teams that rarely score early
   - Recent Form (25%): Overall form matters
   - H2H First Half (20%): First-half patterns in H2H
   - Home Advantage (15%): Home teams start faster
   - Motivation (10%): High-stakes games start cautious

2. **Weight Adjustment**
   - Apply match type adjustments
   - Apply early season adjustments

3. **Probability Calculation**
   - Combine weighted factors
   - Apply formation stability adjustments (20% less impact)

#### Files to Create:

- `apps/backend/src/modules/betting-insights/predictions/predict-first-half.ts` - First Half prediction logic

#### Validation Criteria:

- ✅ First half scoring rate calculated correctly
- ✅ Slow starters pattern detected
- ✅ H2H first half patterns used
- ✅ Formation stability has 20% less impact
- ✅ Probability range is reasonable

---

### 4.5 Alternative Bet Suggestions

**Reference:** Lines 12244-13241

**Goal:** Suggest safer alternative bets for every prediction

#### Sub-tasks:

1. **Safer Alternatives Detection**
   - Find markets with higher probability than primary
   - Calculate probability gain
   - Adjust thresholds based on confidence level

2. **Correlated Markets Detection**
   - Find markets correlated with primary prediction
   - Calculate correlation scores
   - Suggest complementary markets

3. **Alternative Bet Generation**
   - Generate AlternativeBet objects
   - Include relationship type (SAFER, CORRELATED, COMPLEMENTARY, MORE_AGGRESSIVE)
   - Sort by relationship priority and probability

#### Files to Create:

- `apps/backend/src/modules/betting-insights/predictions/alternative-bets.ts` - Alternative bet suggestion logic

#### Validation Criteria:

- ✅ Alternatives are always safer (higher probability) unless MORE_AGGRESSIVE
- ✅ MORE_AGGRESSIVE only for HIGH confidence
- ✅ Alternatives sorted correctly (SAFER first)
- ✅ Probability gain thresholds work correctly

---

## Key Data Structures

### MarketPrediction Interface

```typescript
interface MarketPrediction {
  market: 'MATCH_RESULT' | 'BTTS' | 'OVER_25' | 'FIRST_HALF' | string;
  probabilities: {
    home?: number;
    draw?: number;
    away?: number;
    yes?: number;
    no?: number;
  };
  rating: 'VERY_LIKELY' | 'LIKELY' | 'NEUTRAL' | 'UNLIKELY' | 'VERY_UNLIKELY';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  insights: Insight[];
  conflictingSignals?: ConflictingSignal[];
  recommendation?: string;
  alternatives?: AlternativeBet[];
}

interface AlternativeBet {
  market: string;
  probability: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  reason: string;
  relationship: 'SAFER' | 'MORE_AGGRESSIVE' | 'CORRELATED' | 'COMPLEMENTARY';
  probabilityGain?: number;
  correlation?: number;
  oddsEstimate?: number;
}
```

## Implementation Checklist

### BTTS Prediction
- [ ] Implement `predictBTTS()` function
- [ ] Calculate scoring rate factor
- [ ] Calculate defensive form factor
- [ ] Calculate H2H BTTS with recency weighting
- [ ] Apply weight adjustments
- [ ] Apply formation stability (40% impact)
- [ ] Convert to probability

### Over 2.5 Prediction
- [ ] Implement `predictOver25()` function
- [ ] Calculate average goals factor
- [ ] Calculate defensive weakness factor
- [ ] Calculate H2H goals with recency weighting
- [ ] Apply weight adjustments
- [ ] Apply formation stability (40% impact)
- [ ] Convert to probability

### Match Result Prediction
- [ ] Implement `predictMatchResult()` function (FULL implementation)
- [ ] Calculate form score comparison
- [ ] Calculate H2H record
- [ ] Calculate dynamic home advantage
- [ ] Calculate motivation score
- [ ] Calculate rest advantage
- [ ] Calculate position gap score
- [ ] Apply Mind/Mood gap adjustments
- [ ] Apply formation stability (full impact)
- [ ] Normalize probabilities to 100%

### First Half Prediction
- [ ] Implement `predictFirstHalf()` function
- [ ] Calculate first half scoring rate
- [ ] Detect slow starters pattern
- [ ] Calculate H2H first half patterns
- [ ] Apply weight adjustments
- [ ] Apply formation stability (20% impact)
- [ ] Convert to probability

### Alternative Bet Suggestions
- [ ] Implement `suggestAlternativeBets()` function
- [ ] Implement `findSaferAlternatives()` function
- [ ] Implement `findCorrelatedAlternatives()` function
- [ ] Implement `findComplementaryAlternatives()` function
- [ ] Sort alternatives correctly

### Testing
- [ ] Unit tests for each prediction function
- [ ] Test with various team data scenarios
- [ ] Test edge cases (low data, early season)
- [ ] Verify probabilities are reasonable (20-80%)
- [ ] Verify Match Result probabilities sum to 100%
- [ ] Test weight adjustments
- [ ] Test formation stability impacts
- [ ] Test alternative bet suggestions

## Notes

- BTTS and Over 2.5 use similar factors but different weights
- Match Result is most complex - requires all factors
- First Half focuses on early scoring patterns
- Formation stability has different impact per market (40% for BTTS/Over25, full for Match Result, 20% for First Half)
- All predictions should use recency-weighted H2H data
- Weight adjustments from Phase 3.5 must be applied
- Alternative bets must always be safer unless MORE_AGGRESSIVE (HIGH confidence only)
- Probabilities will be capped in Phase 4.5


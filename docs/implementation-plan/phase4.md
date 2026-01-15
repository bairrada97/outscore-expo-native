# Phase 4: Scenario Simulations (Week 2-3)

**Reference:** See "Phase 4: Market Predictions" section in `betting-insights-algorithm.md`

## Overview

Phase 4 implements probability calculations for key football scenarios (BothTeamsToScore, TotalGoalsOverUnder, MatchOutcome, FirstHalfActivity). This phase combines all previous phases' data and patterns to generate simulations with model reliability levels.

## Dependencies

- **Phase 1:** Core Data Layer (TeamData, H2HData, helper functions)
- **Phase 2:** Pattern Detection (Patterns)
- **Phase 3:** Insight Generation (Insights)
- **Phase 3.5:** Match Type Detection (Match type adjustments)

## Sub-Phases

### 4.1 BTTS Prediction

**Reference:** See "4.1 BTTS Prediction" in `betting-insights-algorithm.md`

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

- `apps/backend/src/modules/betting-insights/simulations/simulate-btts.ts` - BothTeamsToScore simulation logic
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

### 4.2 Over/Under Goals Prediction (multi-line)

**Reference:** See "4.2 Over/Under Goals Prediction" in `betting-insights-algorithm.md`

**Goal:** Predict probabilities for Over/Under goals across lines (0.5, 1.5, 2.5, 3.5, 4.5, 5.5)

#### Sub-tasks:

1. **Factor Calculation**
   - Average Goals Per Game (30%): Combined scoring rate
   - Defensive Weakness (25%): Goals conceded per game
   - Recent Form (30%): Over \(line\) in recent matches
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

- `apps/backend/src/modules/betting-insights/simulations/simulate-total-goals-over-under.ts` - TotalGoalsOverUnder simulation logic (multi-line)

#### Validation Criteria:

- ✅ Average goals calculated correctly
- ✅ Defensive weakness impacts Over/Under appropriately (line-aware)
- ✅ H2H goals use recency weighting
- ✅ Motivation impacts Over/Under correctly (line-aware)
- ✅ Formation stability has 40% less impact
- ✅ Probability range is reasonable

---

### 4.3 Match Result Prediction

**Reference:** See "4.3 Match Result Prediction" in `betting-insights-algorithm.md`

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

- `apps/backend/src/modules/betting-insights/simulations/simulate-match-outcome.ts` - MatchOutcome simulation logic
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

**Reference:** See "4.4 First Half Prediction" in `betting-insights-algorithm.md`

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

- `apps/backend/src/modules/betting-insights/simulations/simulate-first-half-activity.ts` - FirstHalfActivity simulation logic

#### Validation Criteria:

- ✅ First half scoring rate calculated correctly
- ✅ Slow starters pattern detected
- ✅ H2H first half patterns used
- ✅ Formation stability has 20% less impact
- ✅ Probability range is reasonable

---

### 4.5 Alternative Bet Suggestions

**Reference:** See "Alternative Bet Suggestions" in `betting-insights-algorithm.md`

**Goal:** Suggest related scenarios for every simulation (neutral reframing)

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
   - Generate related scenario objects
   - Keep relationships neutral (e.g., nearby lines / often-moves-together) or omit when using minimal schema
   - Sort by relationship priority and probability

#### Files to Create:

- `apps/backend/src/modules/betting-insights/simulations/related-scenarios.ts` - Related scenario suggestion logic

#### Validation Criteria:

- ✅ Alternatives are always safer (higher probability) unless MORE_AGGRESSIVE
- ✅ MORE_AGGRESSIVE only for HIGH confidence
- ✅ Alternatives sorted correctly (SAFER first)
- ✅ Probability gain thresholds work correctly

---

## Key Data Structures

### Simulation Interface

```typescript
interface Simulation {
  scenarioType: 'BothTeamsToScore' | 'TotalGoalsOverUnder' | 'MatchOutcome' | 'FirstHalfActivity';
  line?: 0.5 | 1.5 | 2.5 | 3.5 | 4.5 | 5.5; // Only for TotalGoalsOverUnder
  probabilityDistribution: {
    home?: number;
    draw?: number;
    away?: number;
    yes?: number;
    no?: number;
    over?: number;
    under?: number;
  };
  signalStrength: 'Strong' | 'Moderate' | 'Balanced' | 'Weak';
  modelReliability: 'HIGH' | 'MEDIUM' | 'LOW';
  mostProbableOutcome: string;
  insights: Insight[];
  conflictingSignals?: ConflictingSignal[];
  relatedScenarios?: Array<{
    scenarioType: string;
    line?: number;
    probability: number;
    modelReliability: 'HIGH' | 'MEDIUM' | 'LOW';
    rationale: string;
    mostProbableOutcome: string;
  }>;
  modelReliabilityBreakdown?: { level: string; reasons: string[] };
}
```

## Implementation Checklist

### BothTeamsToScore Simulation
- [ ] Implement `simulateBTTS()` function
- [ ] Calculate scoring rate factor
- [ ] Calculate defensive form factor
- [ ] Calculate H2H BTTS with recency weighting
- [ ] Apply weight adjustments
- [ ] Apply formation stability (40% impact)
- [ ] Convert to probability

### TotalGoalsOverUnder Simulation (multi-line)
- [ ] Implement `simulateTotalGoalsOverUnder()` function (one simulation per line)
- [ ] Calculate average goals factor
- [ ] Calculate defensive weakness factor
- [ ] Calculate H2H goals with recency weighting
- [ ] Apply weight adjustments
- [ ] Apply formation stability (40% impact)
- [ ] Convert to probability

### MatchOutcome Simulation
- [ ] Implement `simulateMatchOutcome()` function (FULL implementation)
- [ ] Calculate form score comparison
- [ ] Calculate H2H record
- [ ] Calculate dynamic home advantage
- [ ] Calculate motivation score
- [ ] Calculate rest advantage
- [ ] Calculate position gap score
- [ ] Apply Mind/Mood gap adjustments
- [ ] Apply formation stability (full impact)
- [ ] Normalize probabilities to 100%

### FirstHalfActivity Simulation
- [ ] Implement `simulateFirstHalfActivity()` function
- [ ] Calculate first half scoring rate
- [ ] Detect slow starters pattern
- [ ] Calculate H2H first half patterns
- [ ] Apply weight adjustments
- [ ] Apply formation stability (20% impact)
- [ ] Convert to probability

### Alternative Bet Suggestions
- [ ] Implement `attachRelatedScenarios()` function
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

## Acceptance Gates (Before Phase 4.5)

Before proceeding to Phase 4.5, the following acceptance criteria must be met:

### Calibration Check
- [ ] **Per-market Brier score baseline established** - Calculate Brier score on validation set for each market
- [ ] **Reliability curve generated** - Plot predicted probability vs actual outcomes for each market
- [ ] **ECE (Expected Calibration Error) < 0.10** - Probabilities should be well-calibrated

### Probability Bounds
- [ ] **All probabilities in 20-80% range** (before caps)
- [ ] **Match Result probabilities sum to 100%** (±0.1% tolerance)
- [ ] **No extreme simulations without supporting evidence**

### Data Quality
- [ ] **Graceful handling of missing data** - Predictions should not crash on partial data
- [ ] **Edge case behavior documented** - Early season, low H2H, new teams

## Notes

- BTTS and Over/Under Goals use similar factors but different weights
- Match Result is most complex - requires all factors
- First Half focuses on early scoring patterns
- Formation stability has different impact per market (40% for BTTS/Over25, full for Match Result, 20% for First Half)
- All simulations should use recency-weighted H2H data
- Weight adjustments from Phase 3.5 must be applied
- Alternative bets must always be safer unless MORE_AGGRESSIVE (HIGH confidence only)
- Probabilities will be capped in Phase 4.5


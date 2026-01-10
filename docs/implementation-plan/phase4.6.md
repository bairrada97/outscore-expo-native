# Phase 4.6: Algorithm Refinements

**Reference:** Lines 11547-12242 in `betting-insights-algorithm.md`

## Overview

Phase 4.6 implements critical refinements to improve prediction accuracy. This phase focuses on enhancing Match Result prediction, integrating rest advantage, opponent quality weighting, weighted scoring rate, and fixture congestion handling.

## Dependencies

- **Phase 4:** Market Predictions (Prediction functions)
- **Phase 4.5:** Probability Caps & Asymmetric Weighting (Caps and adjustments)

## Sub-Phases

### 4.6.1 Match Result Prediction Refinement (Critical)

**Reference:** Lines 11551-11911

**Goal:** Replace simplified Match Result prediction with full implementation using all factors

#### Sub-tasks:

1. **Form Score Calculation**
   - Calculate form score for home team (last home matches)
   - Calculate form score for away team (last away matches)
   - Compare form scores to get form difference

2. **H2H Record Calculation**
   - Calculate home team win percentage
   - Calculate away team win percentage
   - Calculate draw percentage
   - Use recency-weighted percentages

3. **Dynamic Home Advantage**
   - Calculate based on home/away stats
   - Not fixed value - varies by team
   - Use league average as baseline

4. **Motivation Score Calculation**
   - Calculate motivation for home team
   - Calculate motivation for away team
   - Compare motivations to get advantage

5. **Rest Advantage Calculation**
   - Calculate days since last match for both teams
   - Calculate rest difference
   - Convert to score (-20 to +20)

6. **League Position Score**
   - Calculate position gap
   - Adjust for league position (bigger gap at top = more significant)
   - Convert to score

7. **Full Probability Calculation**
   - Combine all factors with weights
   - Calculate home/away/draw probabilities
   - Apply adjustments (Mind/Mood gap, safety flags)
   - Normalize to 100%

#### Files to Create:

- `apps/backend/src/modules/betting-insights/predictions/predict-match-result.ts` - Replace with full implementation
- `apps/backend/src/modules/betting-insights/utils/form-score.ts` - Form score calculation
- `apps/backend/src/modules/betting-insights/utils/home-advantage.ts` - Dynamic home advantage
- `apps/backend/src/modules/betting-insights/utils/motivation-score.ts` - Motivation score
- `apps/backend/src/modules/betting-insights/utils/rest-score.ts` - Rest advantage score
- `apps/backend/src/modules/betting-insights/utils/position-score.ts` - League position score

#### Validation Criteria:

- ✅ All factors used (not simplified)
- ✅ Form score comparison works correctly
- ✅ H2H record uses recency weighting
- ✅ Home advantage is dynamic
- ✅ Probabilities sum to 100%
- ✅ Accuracy improves by 3-5% vs simplified version

---

### 4.6.2 Rest Advantage Integration (High Priority)

**Reference:** Lines 11911-11963

**Goal:** Integrate rest advantage into all prediction functions

#### Sub-tasks:

1. **Rest Advantage Calculation**
   - Calculate days since last match for both teams
   - Calculate rest difference
   - Convert to adjustment value

2. **Integration into Predictions**
   - Add rest advantage to BTTS prediction
   - Add rest advantage to Over 2.5 prediction
   - Add rest advantage to Match Result prediction (already in 4.6.1)
   - Add rest advantage to First Half prediction

3. **Weight Adjustment**
   - Adjust weights based on rest days
   - Reduce recent form weight if rest >10 days
   - Increase H2H/historical weight if rest >10 days

#### Files to Create:

- Extend `apps/backend/src/modules/betting-insights/utils/rest-score.ts` - Add to all predictions
- Extend `apps/backend/src/modules/betting-insights/utils/weight-adjustments.ts` - Add rest adjustments

#### Validation Criteria:

- ✅ Rest advantage calculated correctly
- ✅ Integrated into all prediction functions
- ✅ Weight adjustments work correctly
- ✅ Accuracy improves by 1-2%

---

### 4.6.3 Opponent Quality Weighting (High Priority)

**Reference:** Lines 11963-12033

**Goal:** Weight scoring rates by opponent quality

#### Sub-tasks:

1. **Opponent Tier Detection**
   - Get opponent tier for each match
   - Use Mind tier from Phase 1

2. **Weighted Scoring Rate**
   - Weight goals scored by opponent tier
   - Goals vs Tier 1 teams worth more
   - Goals vs Tier 4 teams worth less

3. **Integration**
   - Use weighted scoring rate in BTTS prediction
   - Use weighted scoring rate in Over 2.5 prediction
   - Use weighted scoring rate in Match Result prediction

#### Files to Create:

- `apps/backend/src/modules/betting-insights/utils/opponent-weighting.ts` - Opponent quality weighting
- Extend `apps/backend/src/modules/betting-insights/predictions/` - Use weighted rates

#### Validation Criteria:

- ✅ Opponent tiers detected correctly
- ✅ Weighted scoring rates calculated correctly
- ✅ Integrated into predictions
- ✅ Accuracy improves by 2-3%

---

### 4.6.4 Weighted Scoring Rate (Medium Priority)

**Reference:** Lines 12033-12084

**Goal:** Replace simple percentage calculations with weighted scoring rates

#### Sub-tasks:

1. **Recency Weighting**
   - Weight recent matches more than older matches
   - Use exponential decay

2. **Opponent Quality Weighting**
   - Weight by opponent tier (from 4.6.3)

3. **Venue Weighting**
   - Weight home/away matches appropriately

4. **Integration**
   - Replace simple percentages with weighted rates
   - Use in all prediction functions

#### Files to Create:

- `apps/backend/src/modules/betting-insights/utils/weighted-rates.ts` - Weighted rate calculations
- Extend prediction functions to use weighted rates

#### Validation Criteria:

- ✅ Recency weighting works correctly
- ✅ Opponent quality weighting works correctly
- ✅ Venue weighting works correctly
- ✅ Weighted rates more accurate than simple percentages
- ✅ Accuracy improves by 1%

---

### 4.6.5 Fixture Congestion (Medium Priority)

**Reference:** Lines 12084-12202

**Goal:** Account for fixture congestion in predictions

#### Sub-tasks:

1. **Congestion Detection**
   - Calculate matches played in last 7/14/21 days
   - Detect congested schedules

2. **Weight Adjustments**
   - Reduce recent form weight if congested
   - Increase fatigue factor
   - Adjust goal expectations

3. **Integration**
   - Add congestion factor to all predictions
   - Adjust weights based on congestion

#### Files to Create:

- `apps/backend/src/modules/betting-insights/utils/fixture-congestion.ts` - Congestion detection and adjustments
- Extend prediction functions to use congestion factor

#### Validation Criteria:

- ✅ Congestion detected correctly
- ✅ Weight adjustments work correctly
- ✅ Integrated into predictions
- ✅ Accuracy improves by 1%

---

## Implementation Priority

### Critical (Before Launch)
1. **Match Result Prediction Refinement** - 1-2 days, +3-5% accuracy

### High Priority (Within 1 Month)
2. **Rest Advantage Integration** - 2-3 hours, +1-2% accuracy
3. **Opponent Quality Weighting** - 1 day, +2-3% accuracy

### Medium Priority (Nice to Have)
4. **Weighted Scoring Rate** - 4-6 hours, +1% accuracy
5. **Fixture Congestion** - 1 day, +1% accuracy

## Implementation Checklist

### Match Result Refinement
- [ ] Implement form score calculation
- [ ] Implement H2H record calculation
- [ ] Implement dynamic home advantage
- [ ] Implement motivation score
- [ ] Implement rest advantage score
- [ ] Implement league position score
- [ ] Replace simplified prediction with full implementation
- [ ] Test accuracy improvement

### Rest Advantage Integration
- [ ] Integrate rest advantage into BTTS
- [ ] Integrate rest advantage into Over 2.5
- [ ] Integrate rest advantage into First Half
- [ ] Implement weight adjustments for rest days
- [ ] Test accuracy improvement

### Opponent Quality Weighting
- [ ] Implement opponent tier detection
- [ ] Implement weighted scoring rate calculation
- [ ] Integrate into BTTS prediction
- [ ] Integrate into Over 2.5 prediction
- [ ] Integrate into Match Result prediction
- [ ] Test accuracy improvement

### Weighted Scoring Rate
- [ ] Implement recency weighting
- [ ] Implement opponent quality weighting
- [ ] Implement venue weighting
- [ ] Replace simple percentages with weighted rates
- [ ] Test accuracy improvement

### Fixture Congestion
- [ ] Implement congestion detection
- [ ] Implement congestion-based weight adjustments
- [ ] Integrate into all predictions
- [ ] Test accuracy improvement

### Testing
- [ ] Unit tests for all new functions
- [ ] Integration tests with prediction functions
- [ ] Accuracy comparison tests (before/after)
- [ ] Test edge cases
- [ ] Verify all factors work together correctly

## Notes

- Match Result refinement is CRITICAL - must be done before launch
- Rest advantage and opponent quality are high priority for accuracy gains
- Weighted scoring rate and fixture congestion are nice-to-have improvements
- All refinements should be validated against historical data
- Accuracy improvements are estimates - actual results may vary
- Integration order: Match Result → Rest Advantage → Opponent Quality → Weighted Rates → Congestion


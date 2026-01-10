# Phase 3.5: Match Type Detection & Cup/League Adjustments

**Reference:** See "Phase 3.5: Match Type Detection" section in `betting-insights-algorithm.md`

## Overview

Phase 3.5 implements match type detection (league, cup, international, friendly) and applies type-specific weight adjustments to predictions. This phase also handles neutral venues, derby matches, post-international break effects, end-of-season dynamics, and league-specific characteristics.

## Dependencies

- **Phase 1:** Core Data Layer (Match data structures, helper functions)
- **Phase 2:** Pattern Detection (Pattern types)
- **Phase 3:** Insight Generation (Insight system)

## Sub-Phases

### 3.5.1 Match Type Detection

**Reference:** See "3.5.1 Match Type Detection" in `betting-insights-algorithm.md`

**Goal:** Detect match type from league name and round information

#### Sub-tasks:

1. **International Competition Detection**
   - Detect international competitions (Champions League, Europa League, World Cup, etc.)
   - Keywords: 'champions league', 'europa', 'world cup', 'copa libertadores', etc.

2. **Cup Competition Detection**
   - Detect domestic cup competitions (FA Cup, Copa del Rey, etc.)
   - Keywords: 'cup', 'fa cup', 'copa del rey', 'knockout', 'playoff', etc.

3. **Knockout Stage Detection**
   - Detect knockout stages (round of 16, quarter-final, semi-final, final)
   - Keywords: 'round of', 'quarter', 'semi', 'final', 'playoff'

4. **Friendly Match Detection**
   - Detect friendly/preseason matches
   - Keywords: 'friendly', 'preseason'

5. **Importance Level Calculation**
   - Calculate importance: LOW, MEDIUM, HIGH, CRITICAL
   - Finals = CRITICAL, Semi/Quarter = HIGH, Early rounds = MEDIUM

#### Match Types:

- `LEAGUE` - Regular league matches
- `CUP` - Domestic cup competitions
- `INTERNATIONAL` - International competitions
- `FRIENDLY` - Friendly/preseason matches

#### Files to Create:

- `apps/backend/src/modules/betting-insights/analysis/match-type-detector.ts` - Match type detection logic
- `apps/backend/src/modules/betting-insights/types.ts` - Add MatchType interface

#### Validation Criteria:

- ✅ International competitions detected correctly
- ✅ Cup competitions detected correctly
- ✅ Knockout stages identified correctly
- ✅ Friendly matches filtered correctly
- ✅ Importance levels calculated correctly (CRITICAL for finals, HIGH for semi/quarter)
- ✅ League matches default correctly

---

### 3.5.2 Match Type Weight Adjustments

**Reference:** See "3.5.2 Match Type Weight Adjustments" in `betting-insights-algorithm.md`

**Goal:** Apply weight adjustments based on match type

#### Sub-tasks:

1. **Cup Match Adjustments**
   - Knockout matches: Reduce goal-scoring factors (15% reduction), increase motivation weight (50% increase), reduce form weight (10% reduction)
   - Early cup rounds: Less impact (8% goal reduction, 5% form reduction)

2. **International Match Adjustments**
   - Reduce recent form weight (15% reduction) - form less reliable
   - Reduce home advantage (10% reduction) - neutral venues common
   - Increase motivation weight (30% increase) - highly valued competitions
   - Reduce goal-scoring factors slightly (8% reduction) - more tactical
   - Increase H2H weight (20% increase) - more relevant in international context

3. **Friendly Match Adjustments**
   - Reduce all weights by 30% - very unpredictable

#### Files to Create:

- `apps/backend/src/modules/betting-insights/utils/weight-adjustments.ts` - Weight adjustment functions
- Extend `apps/backend/src/modules/betting-insights/analysis/match-type-detector.ts` - Add adjustment logic

#### Validation Criteria:

- ✅ Cup knockout adjustments applied correctly
- ✅ International match adjustments applied correctly
- ✅ Friendly match adjustments applied correctly
- ✅ Weight adjustments are multiplicative (not additive)
- ✅ Adjusted weights remain positive
- ✅ Weights are redistributed appropriately

---

### 3.5.3 International Match Handling

**Reference:** See "3.5.3 International Match Handling" in `betting-insights-algorithm.md`

**Goal:** Handle international matches with domestic league context

#### Sub-tasks:

1. **Domestic League Detection**
   - Get domestic league for each team in international match
   - Use domestic league data for team analysis

2. **H2H Filtering**
   - Filter H2H to international competition only
   - Include all leagues for domestic matches

#### Files to Create:

- `apps/backend/src/modules/betting-insights/data/team-domestic-league.ts` - Domestic league detection
- Extend `apps/backend/src/modules/betting-insights/data/team-data.ts` - Add domestic league support

#### Validation Criteria:

- ✅ Domestic leagues detected correctly for international teams
- ✅ Team data fetched using domestic league context
- ✅ H2H filtered correctly (international vs all leagues)
- ✅ Fallback handling when domestic league not found

---

### 3.5.4 Neutral Venue Detection

**Reference:** See "3.5.4 Neutral Venue Detection" in `betting-insights-algorithm.md`

**Goal:** Detect neutral venues for domestic cup finals, playoffs, and super cups

#### Sub-tasks:

1. **Round Name Detection**
   - Detect neutral venues by round name keywords
   - Keywords: 'final', 'semi-final', 'playoff', 'super cup'

2. **Venue Mismatch Detection** (Optional)
   - Compare match venue with home team's usual stadium
   - Detect when venue doesn't match team's home stadium
   - Requires stadium mapping data

3. **Home Advantage Reduction**
   - Reduce home advantage for neutral venues
   - Similar to international match handling

#### Files to Create:

- `apps/backend/src/modules/betting-insights/analysis/neutral-venue-detector.ts` - Neutral venue detection
- `apps/backend/src/modules/betting-insights/data/stadium-mapping.ts` - Stadium mapping (optional)

#### Validation Criteria:

- ✅ Neutral venues detected by round name
- ✅ Home advantage reduced for neutral venues
- ✅ Stadium mismatch detection works (if implemented)
- ✅ Handles missing stadium data gracefully

---

### 3.5.5 Derby/Rivalry Matches Detection

**Reference:** See "3.5.5 Derby/Rivalry Detection" in `betting-insights-algorithm.md`

**Goal:** Detect derby and rivalry matches

#### Sub-tasks:

1. **Derby Detection**
   - Identify local derbies (same city/region)
   - Identify historical rivalries
   - Use team location data or predefined rivalry list

2. **Weight Adjustments**
   - Increase motivation weight
   - Reduce form weight (derbies are unpredictable)
   - Adjust goal-scoring expectations

#### Files to Create:

- `apps/backend/src/modules/betting-insights/analysis/derby-detector.ts` - Derby/rivalry detection
- `apps/backend/src/modules/betting-insights/data/rivalries.ts` - Rivalry mapping data

#### Validation Criteria:

- ✅ Derby matches detected correctly
- ✅ Rivalry matches detected correctly
- ✅ Weight adjustments applied appropriately
- ✅ Handles missing location/rivalry data

---

### 3.5.6 Post-International Break Effects

**Reference:** See "3.5.6 Post-International Break Effects" in `betting-insights-algorithm.md`

**Goal:** Detect matches after international breaks and apply adjustments

#### Sub-tasks:

1. **International Break Detection**
   - Detect matches within 3-5 days after international break
   - Check for players returning from international duty

2. **Weight Adjustments**
   - Reduce recent form weight (players tired/absent)
   - Increase historical data weight
   - Adjust for key player availability

#### Files to Create:

- `apps/backend/src/modules/betting-insights/analysis/international-break-detector.ts` - International break detection
- Extend `apps/backend/src/modules/betting-insights/utils/weight-adjustments.ts` - Add break adjustments

#### Validation Criteria:

- ✅ International breaks detected correctly
- ✅ Post-break matches identified
- ✅ Weight adjustments applied appropriately
- ✅ Handles missing international break data

---

### 3.5.7 End-of-Season Specific Dynamics

**Reference:** See "3.5.7 End-of-Season Dynamics" in `betting-insights-algorithm.md`

**Goal:** Detect end-of-season matches and apply specific adjustments

#### Sub-tasks:

1. **End-of-Season Detection**
   - Detect matches in last 3-5 rounds of season
   - Identify teams with nothing to play for vs teams fighting for position

2. **Motivation Adjustments**
   - Increase motivation weight for teams with something to play for
   - Reduce form weight for teams with nothing to play for
   - Adjust for relegation battles, title races, European qualification

#### Files to Create:

- `apps/backend/src/modules/betting-insights/analysis/end-of-season-detector.ts` - End-of-season detection
- Extend `apps/backend/src/modules/betting-insights/utils/weight-adjustments.ts` - Add end-of-season adjustments

#### Validation Criteria:

- ✅ End-of-season matches detected correctly
- ✅ Team motivation calculated correctly
- ✅ Weight adjustments applied appropriately
- ✅ Handles different league structures (different round counts)

---

### 3.5.8 League-Specific Characteristics

**Reference:** See "3.5.8 League-Specific Characteristics" in `betting-insights-algorithm.md`

**Goal:** Apply league-specific adjustments based on playing style

#### Sub-tasks:

1. **League Style Detection**
   - Identify league characteristics (defensive, attacking, balanced)
   - Map leagues to style categories

2. **Goal Expectation Adjustments**
   - Adjust goal-scoring expectations per league
   - Example: Serie A more defensive, Premier League more attacking

#### Files to Create:

- `apps/backend/src/modules/betting-insights/analysis/league-characteristics.ts` - League style detection
- `apps/backend/src/modules/betting-insights/data/league-styles.ts` - League style mapping

#### Validation Criteria:

- ✅ League styles detected correctly
- ✅ Goal expectations adjusted appropriately
- ✅ Handles unknown leagues gracefully
- ✅ Adjustments are subtle (5-10% range)

---

## Key Data Structures

### MatchType Interface

```typescript
interface MatchType {
  type: 'LEAGUE' | 'CUP' | 'FRIENDLY' | 'INTERNATIONAL';
  importance: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  isKnockout: boolean;
}
```

## Implementation Checklist

### Match Type Detection
- [ ] Implement `detectMatchType()` function
- [ ] Implement international competition detection
- [ ] Implement cup competition detection
- [ ] Implement knockout stage detection
- [ ] Implement friendly match detection
- [ ] Implement importance level calculation

### Weight Adjustments
- [ ] Implement `adjustWeightsForMatchType()` function
- [ ] Implement cup match adjustments
- [ ] Implement international match adjustments
- [ ] Implement friendly match adjustments
- [ ] Test weight redistribution logic

### International Match Handling
- [ ] Implement domestic league detection
- [ ] Implement H2H filtering for international matches
- [ ] Test with various international competitions

### Neutral Venue Detection
- [ ] Implement round name detection
- [ ] Implement venue mismatch detection (optional)
- [ ] Implement home advantage reduction

### Derby/Rivalry Detection
- [ ] Implement derby detection
- [ ] Implement rivalry detection
- [ ] Create rivalry mapping data

### Post-International Break Effects
- [ ] Implement international break detection
- [ ] Implement post-break adjustments

### End-of-Season Dynamics
- [ ] Implement end-of-season detection
- [ ] Implement motivation adjustments

### League-Specific Characteristics
- [ ] Implement league style detection
- [ ] Create league style mapping
- [ ] Implement goal expectation adjustments

### Testing
- [ ] Unit tests for match type detection
- [ ] Unit tests for weight adjustments
- [ ] Test with various match types
- [ ] Test edge cases (missing data, unknown leagues)
- [ ] Verify weight adjustments are correct
- [ ] Integration tests with prediction system

## Notes

- Match type detection uses keyword matching - may need refinement for edge cases
- Weight adjustments are multiplicative to maintain relative proportions
- International matches require special handling for domestic league context
- Neutral venue detection improves accuracy for cup finals
- Derby/rivalry detection adds context but requires data maintenance
- Post-international break effects are subtle but important
- End-of-season dynamics significantly impact motivation
- League-specific characteristics provide fine-tuning for accuracy
- All adjustments should be validated against historical data


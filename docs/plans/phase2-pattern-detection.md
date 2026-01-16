# Phase 2: Pattern Detection (Week 1-2)

**Reference:** See "Phase 2: Pattern Detection" section in `betting-insights-algorithm.md`

## Overview

Phase 2 implements automatic pattern detection for teams and head-to-head matchups. Patterns are detected from team statistics, recent form, and H2H data to identify notable trends that will inform predictions and insights.

## Dependencies

- **Phase 1:** Core Data Layer (TeamData, H2HData structures, helper functions)

## Sub-Phases

### 2.1 Team Pattern Detection

**Reference:** See "2.1 Team Pattern Detection" in `betting-insights-algorithm.md`

**Goal:** Detect patterns in team performance data (form streaks, scoring patterns, defensive issues, etc.)

#### Sub-tasks:

1. **Consecutive Result Counting**
   - Count consecutive wins, draws, losses
   - Helper: `countConsecutiveResults()`

2. **Scoring Streak Detection**
   - Detect consecutive matches with goals scored
   - Helper: `countConsecutiveMatchesWithGoals()`

3. **Clean Sheet Drought Detection**
   - Count consecutive matches without clean sheets
   - Helper: `countConsecutiveMatchesWithoutCleanSheet()`

4. **First Half Weakness Detection**
   - Calculate percentage of matches with first-half goals
   - Detect teams that rarely score in first half

5. **High Scoring Form Detection**
   - Detect teams averaging 2.5+ goals per game
   - Severity based on average (2.5 = MEDIUM, 3.0+ = HIGH)

6. **Defensive Weakness Detection**
   - Detect teams conceding 2.0+ goals per game
   - Severity based on average (2.0 = MEDIUM, 2.5+ = HIGH)

7. **Mind/Mood Pattern Detection**
   - Sleeping Giant (Mind Tier 1, Mood Tier 4) - already detected in Phase 1
   - Over-Performer (Mind Tier 4, Mood Tier 1) - already detected in Phase 1
   - Integration with Phase 1 data

#### Pattern Types:

- `LONG_LOSING_STREAK` - 5+ consecutive losses
- `LONG_WINNING_STREAK` - 5+ consecutive wins
- `SCORING_STREAK` - 5+ consecutive matches with goals
- `CLEAN_SHEET_DROUGHT` - 8+ matches without clean sheet
- `FIRST_HALF_WEAKNESS` - <30% of matches with first-half goals
- `HIGH_SCORING_FORM` - Averaging 2.5+ goals per game
- `DEFENSIVE_WEAKNESS` - Averaging 2.0+ goals conceded average
- `SLEEPING_GIANT` - Tier 1 quality, Tier 4 form
- `OVER_PERFORMER` - Tier 4 quality, Tier 1 form

#### Files to Create:

- `apps/backend/src/modules/betting-insights/analysis/pattern-detector.ts` - Main pattern detection logic
- `apps/backend/src/modules/betting-insights/utils/streak-helpers.ts` - Streak counting helpers
- `apps/backend/src/modules/betting-insights/types.ts` - Add Pattern and PatternType interfaces

#### Validation Criteria:

- ✅ All streak patterns detected correctly
- ✅ Severity levels match thresholds (CRITICAL for 8+ losing streak, HIGH for 5-7)
- ✅ First half weakness correctly calculated (<30% threshold)
- ✅ High scoring form detected at 2.5+ goals average
- ✅ Defensive weakness detected at 2.0+ goals conceded average
- ✅ Sleeping Giant and Over-Performer patterns correctly identified
- ✅ Patterns include correct priority scores (100 for losing streak, 95 for winning streak, etc.)

---

### 2.2 H2H Pattern Detection

**Reference:** See "2.2 H2H Pattern Detection" in `betting-insights-algorithm.md`

**Goal:** Detect patterns in head-to-head matchups between teams

#### Sub-tasks:

1. **BTTS Streak Detection**
   - Count consecutive BTTS matches in H2H
   - Detect high BTTS percentage (≥70%)
   - Helper: `countConsecutiveBTTS()`

2. **H2H Dominance Detection**
   - Detect when one team dominates (≥70% win rate)
   - Identify dominant team (home or away)

#### Pattern Types:

- `BTTS_STREAK` - 3+ consecutive BTTS or ≥70% BTTS rate
- `H2H_DOMINANCE` - One team wins ≥70% of H2H matches

#### Files to Create:

- `apps/backend/src/modules/betting-insights/analysis/h2h-pattern-detector.ts` - H2H pattern detection
- Extend `apps/backend/src/modules/betting-insights/utils/streak-helpers.ts` - Add BTTS streak counting

#### Validation Criteria:

- ✅ BTTS streak detected for 3+ consecutive matches
- ✅ High BTTS percentage (≥70%) detected even without streak
- ✅ H2H dominance detected when win rate ≥70%
- ✅ Dominant team correctly identified (home vs away)
- ✅ Patterns include correct priority scores (90 for BTTS streak, 85 for H2H dominance)

---

## Key Data Structures

### Pattern Interface

```typescript
interface Pattern {
  type: PatternType;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  priority: number;
  data: any;
}

type PatternType =
  | 'LONG_LOSING_STREAK'
  | 'LONG_WINNING_STREAK'
  | 'SCORING_STREAK'
  | 'CLEAN_SHEET_DROUGHT'
  | 'HOME_FORM_COLLAPSE'
  | 'AWAY_DOMINANCE'
  | 'H2H_DOMINANCE'
  | 'BTTS_STREAK'
  | 'FIRST_HALF_WEAKNESS'
  | 'HIGH_SCORING_FORM'
  | 'DEFENSIVE_WEAKNESS'
  | 'SLEEPING_GIANT'
  | 'OVER_PERFORMER'
  | 'FORMATION_INSTABILITY'
  | 'REGRESSION_RISK';
```

## Implementation Checklist

### Team Pattern Detection
- [ ] Implement `detectPatterns()` function
- [ ] Implement `countConsecutiveResults()`
- [ ] Implement `countConsecutiveMatchesWithGoals()`
- [ ] Implement `countConsecutiveMatchesWithoutCleanSheet()`
- [ ] Implement first half weakness detection
- [ ] Implement high scoring form detection
- [ ] Implement defensive weakness detection
- [ ] Integrate sleeping giant/over-performer from Phase 1

### H2H Pattern Detection
- [ ] Implement `detectH2HPatterns()` function
- [ ] Implement `countConsecutiveBTTS()`
- [ ] Implement H2H dominance detection

### Testing
- [ ] Unit tests for streak counting functions
- [ ] Unit tests for pattern detection logic
- [ ] Test with various team data scenarios
- [ ] Test edge cases (empty matches, single match, etc.)
- [ ] Verify severity levels match thresholds
- [ ] Verify priority scores are correct

## Notes

- Patterns are detected from TeamData and H2HData structures from Phase 1
- Severity levels: CRITICAL (8+ losing streak, 12+ clean sheet drought), HIGH (5-7 losing streak, 8-11 clean sheet drought), MEDIUM (other patterns)
- Priority scores determine order when displaying insights (higher = more important)
- Formation instability is detected in match context (Phase 3.5), not here
- All pattern detection should handle edge cases (empty arrays, insufficient data)




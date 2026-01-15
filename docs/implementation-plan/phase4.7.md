# Phase 4.7: Team News & Injuries Integration

**Reference:** See "Phase 4.7: Team News & Injuries Integration" section in `betting-insights-algorithm.md`

## Overview

Phase 4.7 integrates injury data into the betting insights simulations. It uses pre-implemented API endpoints to fetch injury data and squad statistics, calculates player importance scores, and applies scenario-specific adjustments to simulations.

## Dependencies

- **Phase 4:** Scenario Simulations (Simulation functions)
- **Phase 4.5:** Probability Caps & Asymmetric Weighting (Unified adjustment function)
- **Phase 4.6:** Algorithm Refinements (Rest advantage, opponent quality)
- **Pre-implemented Endpoints:**
  - `/fixtures?id={fixtureId}`
  - `/teams/statistics?team={teamId}&league={leagueId}&season={season}`
  - `/players?team={teamId}&season={season}`
  - `/injuries?fixture={fixtureId}` or `/injuries?team={teamId}&season={season}`

## Sub-Phases

### 4.7.1 Pre-Implementation Requirements

**Goal:** Verify all required endpoints are available before implementing injury adjustments

#### Validation Checklist:

- ✅ Fixture ID endpoint returns match details
- ✅ Team statistics endpoint returns squad performance data
- ✅ Players endpoint returns player statistics (rating, minutes, goals, assists)
- ✅ Injuries endpoint returns current injuries with player details

**Note:** All endpoints should already be pre-implemented. Phase 4.7 consumes these endpoints—it does not implement them.

---

### 4.7.2 Injury Data Processing

**Reference:** See "4.7.2 Injury Data Processing" in `betting-insights-algorithm.md`

**Goal:** Fetch and process injury data from pre-implemented endpoints

#### Sub-tasks:

1. **Get Injuries from Endpoint**
   - Fetch injuries for fixture or team/season
   - Filter to relevant injuries (current, not historical)

2. **Get Squad Statistics**
   - Fetch player statistics from players endpoint
   - Filter to injured players (player.injured = true)
   - Extract rating, minutes, goals, assists, key passes

3. **Map Injuries to Algorithm Format**
   - For each injured player:
     - Extract player statistics (if available)
     - Calculate importance score
     - Determine impact category (CRITICAL/HIGH/MEDIUM/LOW)
   - Return structured `AlgorithmInjury[]`

#### Key Interfaces:

```typescript
interface AlgorithmInjury {
  playerId: number;
  playerName: string;
  position: string;
  reason: string;
  status: 'Out' | 'Doubtful' | 'Minor';
  importanceScore: number; // 0-100
  importanceSource: 'STATISTICS' | 'FALLBACK';
  isKeyPlayer: boolean; // importanceScore >= 50
  impactCategory: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
}

interface PlayerStatistics {
  playerId: number;
  playerName: string;
  position: string;
  appearances: number;
  lineups: number;
  minutesPlayed: number;
  goals: number;
  assists: number;
  rating: number; // 0-10
  captain: boolean;
  keyPasses: number;
  shotsOnTarget: number;
}
```

#### Files to Create:

- `apps/backend/src/modules/betting-insights/data/injuries.ts` - Injury data fetching and processing

#### Validation Criteria:

- ✅ Injuries fetched correctly from endpoint
- ✅ Player statistics matched to injuries
- ✅ Importance scores calculated correctly
- ✅ Impact categories assigned correctly
- ✅ Fallback importance used when statistics unavailable

---

### 4.7.3 Player Importance Calculation

**Reference:** See "4.7.3 Player Importance Calculation" in `betting-insights-algorithm.md`

**Goal:** Calculate importance score (0-100) for injured players based on statistics

#### Importance Score Factors (0-100 points total):

1. **Rating (0-35 points)** - Most important factor
   - Rating ≥ 8.0: 35 points (Elite)
   - Rating ≥ 7.5: 28 points (Very good)
   - Rating ≥ 7.0: 22 points (Good)
   - Rating ≥ 6.5: 15 points (Average)
   - Rating ≥ 6.0: 8 points (Below average)
   - Rating > 0: 3 points (Poor)

2. **Playing Time (0-25 points)**
   - Minutes ratio ≥ 85%: 25 points (Regular starter)
   - Minutes ratio ≥ 60%: 18 points (Regular rotation)
   - Minutes ratio ≥ 30%: 10 points (Occasional)
   - Minutes ratio ≥ 10%: 5 points (Rarely plays)
   - Minutes ratio < 10%: 1 point (Bench player)

3. **Starter Status (0-10 points)**
   - Start ratio ≥ 90%: 10 points
   - Start ratio ≥ 70%: 7 points
   - Start ratio ≥ 50%: 4 points
   - Start ratio < 50%: 1 point

4. **Goals Contribution (0-15 points)**
   - Goals/game ≥ 0.5: 15 points (Top scorer)
   - Goals/game ≥ 0.3: 12 points
   - Goals/game ≥ 0.15: 8 points
   - Goals/game > 0: 4 points

5. **Assists Contribution (0-10 points)**
   - Assists/game ≥ 0.4: 10 points (Key creator)
   - Assists/game ≥ 0.25: 7 points
   - Assists/game ≥ 0.1: 4 points
   - Assists/game > 0: 2 points

6. **Key Passes (0-5 points)**
   - Key passes/game ≥ 2.5: 5 points
   - Key passes/game ≥ 1.5: 3 points
   - Key passes/game ≥ 0.5: 1 point

7. **Captain Status (0-5 points)**
   - Captain: 5 points

8. **Position Multiplier (0-5 points)**
   - Higher weight for attackers, medium for defenders, lower for midfielders

9. **Injury Type (0-5 points)**
   - Cruciate/ACL: 5 points (Serious)
   - Fracture: 4 points
   - Muscle: 2 points

10. **Status Multiplier**
    - Out: 1.0x (Full impact)
    - Doubtful: 0.6x (60% impact)
    - Minor: 0.3x (30% impact)

#### Filtering Rules:

- Filter out injuries with importance < 20 (bench players)
- Include "Out" status for all importance levels
- Include "Doubtful" only if importance ≥ 40
- Include "Minor" only if importance ≥ 70

#### Files to Create:

- `apps/backend/src/modules/betting-insights/utils/player-importance.ts` - Importance calculation

#### Validation Criteria:

- ✅ All 10 factors calculated correctly
- ✅ Status multiplier applied correctly
- ✅ Score bounded to 0-100
- ✅ Filtering rules applied correctly
- ✅ High-importance players correctly identified as key players

---

### 4.7.4 Market-Specific Injury Adjustments

**Reference:** See "4.7.4 Market-Specific Adjustments" in `betting-insights-algorithm.md`

**Goal:** Calculate adjustments for each market based on injury data

#### BTTS Adjustments:

- **Missing attackers:** Reduce BTTS probability
  - Adjustment: `-(avgImportance / 10)` percentage points
  - Example: 80 importance attacker out = -8% BTTS
- **Missing defenders:** Increase BTTS probability
  - Adjustment: `+(avgImportance / 15)` percentage points
  - Example: 60 importance defender out = +4% BTTS
- **Cap:** ±15%

#### Over/Under Goals (multi-line) Adjustments:

- **Missing attackers:** Reduce Over \(line\) probability
  - Adjustment: `-(totalAttackerImportance / 12)`
- **Missing defenders:** Increase Over \(line\) probability
  - Adjustment: `+(totalDefenderImportance / 18)`
- **Cap:** ±12%

#### Match Result Adjustments:

- **Missing critical players:** Reduce win probability
  - Critical players out: -3% per player
  - High importance players out: -2% per player
- **Cap:** ±10%

#### Key Interface:

```typescript
interface InjuryAdjustments {
  bttsAdjustment: number; // -15 to +15
  overUnderGoalsAdjustmentByLine: Record<string, number>; // keys: "0.5"|"1.5"|...|"5.5" (each -12 to +12)
  matchResultHomeAdjustment: number; // -10 to +10
  matchResultAwayAdjustment: number; // -10 to +10
  insights: Insight[];
}
```

#### Files to Create:

- `apps/backend/src/modules/betting-insights/adjustments/injury-adjustments.ts` - Market-specific adjustments

#### Validation Criteria:

- ✅ BTTS adjustments calculated correctly
- ✅ Over 2.5 adjustments calculated correctly
- ✅ Match Result adjustments calculated correctly
- ✅ Caps applied correctly (±15%, ±12%, ±10%)
- ✅ Insights generated for significant injuries

---

### 4.7.5 Integration into Prediction Functions

**Goal:** Integrate injury adjustments into Phase 4 prediction functions via the unified adjustment helper

#### Sub-tasks:

1. **Fetch injuries at prediction time**
   - Call `getInjuriesForAlgorithm()` during insight generation
   - Pass home/away team injuries to adjustment calculator

2. **Calculate adjustments**
   - Call `calculateInjuryAdjustments(homeInjuries, awayInjuries)`
   - Get per-market adjustments

3. **Apply via unified helper**
   - Add injury adjustments to the adjustments array passed to `applyCappedAsymmetricAdjustments()`
   - Adjustments should have type: `'INJURY'`
   - Cumulative caps (Phase 4.5) will prevent stacking

4. **Include insights in response**
   - Add injury-related insights to the insights array

#### Files to Modify:

- `apps/backend/src/modules/betting-insights/simulations/simulate-btts.ts` - Add injury adjustment
- `apps/backend/src/modules/betting-insights/simulations/simulate-total-goals-over-under.ts` - Add injury adjustment
- `apps/backend/src/modules/betting-insights/simulations/simulate-match-outcome.ts` - Add injury adjustment

#### Validation Criteria:

- ✅ Injuries fetched during prediction
- ✅ Adjustments applied via unified helper (not directly)
- ✅ Cumulative caps prevent excessive stacking
- ✅ Insights included in response
- ✅ No errors when injuries endpoint unavailable (graceful fallback)

---

## Implementation Checklist

### Pre-Implementation
- [ ] Verify injuries endpoint is working
- [ ] Verify players endpoint returns statistics
- [ ] Verify team statistics endpoint is available

### Injury Data Processing
- [ ] Implement `getInjuriesForAlgorithm()`
- [ ] Implement injury-to-algorithm mapping
- [ ] Handle missing player statistics (fallback)
- [ ] Test with various fixture IDs

### Player Importance Calculation
- [ ] Implement all 10 importance factors
- [ ] Implement status multiplier
- [ ] Implement filtering rules
- [ ] Test with various player profiles

### Market-Specific Adjustments
- [ ] Implement BTTS adjustment calculation
- [ ] Implement Over 2.5 adjustment calculation
- [ ] Implement Match Result adjustment calculation
- [ ] Implement adjustment caps
- [ ] Generate injury insights

### Integration
- [ ] Integrate into BTTS prediction
- [ ] Integrate into Over 2.5 prediction
- [ ] Integrate into Match Result prediction
- [ ] Test unified helper integration
- [ ] Test cumulative caps work correctly
- [ ] Test graceful fallback on errors

### Testing
- [ ] Unit tests for importance calculation
- [ ] Unit tests for adjustment calculation
- [ ] Integration tests with real injury data
- [ ] Test edge cases (no injuries, all bench players, etc.)
- [ ] Test fallback behavior

---

## Notes

- Injury adjustments go through the unified `applyCappedAsymmetricAdjustments()` helper (Phase 4.5)
- Cumulative caps prevent same-type adjustments from stacking excessively
- The adjustment type for injuries should be `'INJURY'` with a cumulative cap of ±15%
- Graceful fallback: if injuries endpoint fails, simulations should continue without injury adjustments
- Importance calculation uses statistics when available, fallback when not
- Only "Out" status injuries should significantly impact simulations


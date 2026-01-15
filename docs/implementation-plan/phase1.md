# Phase 1: Core Data Layer (Week 1)

**Reference:** See "Phase 1: Core Data Layer" section in `betting-insights-algorithm.md`

## ⚠️ PRE-IMPLEMENTATION CHECKPOINT

**CRITICAL:** Before starting Phase 1 implementation, you **MUST** complete all manual data requirements.

**See:** `docs/betting-insights-data-requirements.md` for the complete list.

**The implementation will NOT proceed until you explicitly confirm:**
- ✅ All manual data has been added/verified
- ✅ All league IDs are correct
- ✅ All keyword lists are complete
- ✅ All mappings are populated

**When ready to implement, explicitly state:** "I have completed all manual data requirements and am ready to proceed with implementation."

## Overview

Phase 1 establishes the foundation for all subsequent phases by implementing data fetching, caching, and statistics calculation. This phase provides the core data structures and helper functions that all other phases depend on.

## Dependencies

- None (foundation phase)
- **Manual Data Requirements:** All data from `betting-insights-data-requirements.md` must be completed

## Sub-Phases

### 1.1 Data Fetching Functions

**Reference:** See "1.1 Data Fetching Functions" in `betting-insights-algorithm.md`

**Goal:** Implement data fetching functions with proper filtering, caching, and helper utilities.

#### Sub-tasks:

1. **Filter Non-Friendly Matches**
   - Filter out friendly matches from API responses
   - Helper: `filterNonFriendlyMatches()`

2. **Round Number Extraction**
   - Extract round number from league.round string
   - Handle various formats: "Regular Season - 3", "Matchday 5", "Round 2"
   - Helper: `extractRoundNumber()`

3. **Early Season Detection**
   - Check if match is in early season (< 5 rounds)
   - Helper: `isEarlySeason()`

4. **H2H Recency Weighting**
   - Calculate recency weights for H2H matches using days-based decay
   - Within-season boost (1.2x multiplier)
   - Recent months boost (last 3 months get 1.1x multiplier)
   - Helper: `calculateH2HRecencyWeights()`
   - Helper: `isSameSeasonHelper()`

5. **Weighted Average Calculation**
   - Calculate weighted averages for H2H stats
   - Helper: `calculateWeightedAverage()`

6. **Efficiency Index Calculation**
   - Calculate Efficiency Index (EI) for Mind layer
   - Formula: `EI = (Avg Points per Game) + (Goal Difference / 10)`
   - Helper: `calculateEfficiencyIndex()`

7. **Tier Categorization**
   - Categorize teams into tiers (1-4) based on Efficiency Index
   - Tier thresholds: 1 (≥2.0), 2 (≥1.5), 3 (≥1.0), 4 (<1.0)
   - Helper: `categorizeTier()`
   - Helper: `calculateMoodTier()`

8. **Seasons in League Calculation**
   - Get number of seasons team has been in current league
   - Helper: `getSeasonsInCurrentLeague()`

9. **One-Season Wonder Detection**
   - Detect one-season wonder pattern (recently promoted team overperforming)
   - Helper: `detectOneSeasonWonder()`

10. **Mind vs Mood Gap Detection**
    - Detect sleeping giant and over-performer patterns
    - Helper: `detectMoodVsMindGap()`

11. **Formation Frequency Calculation**
    - Calculate formation frequency from matches
    - Helper: `calculateFormationFrequency()`

#### Files to Create:

- `apps/backend/src/modules/betting-insights/` - New module for betting insights
  - `index.ts` - Module exports
  - `data/team-data.ts` - Main data fetching functions
  - `utils/helpers.ts` - Helper functions (round extraction, early season, etc.)
  - `utils/h2h-helpers.ts` - H2H-specific helpers
  - `utils/tier-helpers.ts` - Tier and efficiency index helpers
  - `types.ts` - TypeScript interfaces and types

#### Validation Criteria:

- ✅ All helper functions return correct values for test cases
- ✅ Friendly matches are properly filtered
- ✅ Round numbers extracted correctly from various formats
- ✅ Early season detection works for rounds 1-5
- ✅ H2H recency weights decrease exponentially with time
- ✅ Within-season matches get boost
- ✅ Efficiency Index calculated correctly
- ✅ Tier categorization matches expected thresholds
- ✅ One-season wonder detection identifies correct patterns

---

### 1.2 Stats Calculation

**Reference:** See "1.2 Stats Calculation" in `betting-insights-algorithm.md`

**Goal:** Implement comprehensive statistics calculation with formation normalization and similarity detection.

#### Sub-tasks:

1. **Team Statistics Fetching**
   - Fetch team statistics from backend endpoint
   - Cache with 24-hour TTL
   - Handle API failures gracefully
   - Helper: `fetchTeamStatistics()`

2. **Formation Normalization System**
   - Map formation variations to canonical forms
   - Handle API inconsistencies (e.g., "4-1-2-3" → "4-3-3")
   - Helper: `normalizeFormation()`
   - Constant: `FORMATION_CANONICAL_MAP`

3. **Formation Parsing**
   - Parse formation into structural components (defenders, midfielders, forwards)
   - Helper: `parseFormation()`

4. **Formation Similarity Detection**
   - Calculate similarity score between formations (0-1)
   - Based on structural similarity
   - Helper: `calculateFormationSimilarity()`

5. **Formation Stability Calculation**
   - Calculate formation stability score
   - Detect experimental formations
   - Account for early season context
   - Helper: `calculateFormationStability()`

6. **Stats Aggregation**
   - Calculate `goalLineOverPct` for lines: 0.5, 1.5, 2.5, 3.5, 4.5, 5.5
   - Calculate cleanSheetPercentage, failedToScorePercentage
   - Aggregate goal minutes data
   - Calculate formation frequency

#### Files to Create:

- `apps/backend/src/modules/betting-insights/` - Continue building module
  - `utils/stats-calculator.ts` - Stats calculation functions
  - `utils/formation-helpers.ts` - Formation normalization and similarity
  - `data/team-statistics.ts` - Team statistics fetching

**Note:** If extended API client functions are needed, add them to:
- `apps/backend/src/pkg/util/football-api.ts` - Extend existing API client with team statistics methods

#### Validation Criteria:

- ✅ Team statistics fetched and cached correctly
- ✅ Formation normalization handles all common variations
- ✅ Similar formations (e.g., "4-3-3" vs "4-1-2-3") get high similarity scores
- ✅ Formation stability correctly identifies experimental formations
- ✅ Early season context reduces stability penalties
- ✅ All percentage calculations are accurate
- ✅ Goal minutes data aggregated correctly

---

## Key Data Structures

### TeamData Interface

```typescript
interface TeamData {
  id: number;
  name: string;
  stats: {
    form: string; // "WWDLW"
    leaguePosition: number;
    avgGoalsScored: number;
    avgGoalsConceded: number;
    homeAvgScored: number;
    homeAvgConceded: number;
    awayAvgScored: number;
    awayAvgConceded: number;
    pointsFromCL: number;
    pointsFromRelegation: number;
    pointsFromFirst: number;
  };
  mind: {
    efficiencyIndex: number;
    tier: 1 | 2 | 3 | 4;
  };
  mood: {
    tier: 1 | 2 | 3 | 4;
    mindMoodGap: number;
    isSleepingGiant: boolean;
    isOverPerformer: boolean;
    isOneSeasonWonder: boolean;
  };
  dna: {
    mostPlayedFormation: string;
    formationFrequency: Record<string, number>;
      goalLineOverPct: Record<string, number>; // keys: "0.5"|"1.5"|...|"5.5"
    cleanSheetPercentage: number;
    failedToScorePercentage: number;
    lateStarter: boolean;
  };
  lastHomeMatches: Match[];
  lastAwayMatches: Match[];
  daysSinceLastMatch: number;
  safetyFlags: SafetyFlags;
}
```

### H2HData Interface

```typescript
interface H2HData {
  matches: Match[];
  h2hMatchCount: number;
  homeTeamWins: number;
  awayTeamWins: number;
  draws: number;
  bttsCount: number;
  bttsPercentage: number;
  goalLineOverCount: Record<string, number>; // keys: "0.5"|"1.5"|...|"5.5"
  goalLineOverPct: Record<string, number>;   // keys: "0.5"|"1.5"|...|"5.5"
  avgGoals: number;
}
```

### Match Interface

```typescript
interface Match {
  id: number;
  date: string;
  homeTeam: { id: number; name: string };
  awayTeam: { id: number; name: string };
  score: {
    home: number | null;
    away: number | null;
  };
  result: 'W' | 'D' | 'L'; // From team perspective
  goalsScored: number;
  goalsConceded: number;
  firstHalfGoals?: number;
  league: {
    id: number;
    name: string;
    round?: string;
  };
  season: string;
  formation?: string;
}
```

## Implementation Checklist

### Data Fetching Functions
- [ ] Implement `filterNonFriendlyMatches()`
- [ ] Implement `extractRoundNumber()`
- [ ] Implement `isEarlySeason()`
- [ ] Implement `calculateH2HRecencyWeights()`
- [ ] Implement `isSameSeasonHelper()`
- [ ] Implement `calculateWeightedAverage()`
- [ ] Implement `calculateEfficiencyIndex()`
- [ ] Implement `categorizeTier()`
- [ ] Implement `calculateMoodTier()`
- [ ] Implement `getSeasonsInCurrentLeague()`
- [ ] Implement `detectOneSeasonWonder()`
- [ ] Implement `detectMoodVsMindGap()`
- [ ] Implement `calculateFormationFrequency()`

### Stats Calculation
- [ ] Implement `fetchTeamStatistics()`
- [ ] Create `FORMATION_CANONICAL_MAP`
- [ ] Implement `normalizeFormation()`
- [ ] Implement `parseFormation()`
- [ ] Implement `calculateFormationSimilarity()`
- [ ] Implement `calculateFormationStability()`
- [ ] Implement stats aggregation functions

### Testing
- [ ] Unit tests for all helper functions
- [ ] Integration tests for data fetching
- [ ] Test formation normalization with various inputs
- [ ] Test formation similarity detection
- [ ] Test early season detection
- [ ] Test H2H recency weighting
- [ ] Test tier categorization
- [ ] Test one-season wonder detection

## Module Structure

Following the backend architecture pattern, Phase 1 creates a new `betting-insights` module:

```
apps/backend/src/modules/betting-insights/
├── index.ts                    # Module exports (routes, services)
├── types.ts                    # TypeScript interfaces (TeamData, H2HData, Match, etc.)
│
├── data/
│   ├── team-data.ts            # Main data fetching functions
│   └── team-statistics.ts      # Team statistics fetching
│
└── utils/
    ├── helpers.ts              # General helpers (round extraction, early season, etc.)
    ├── h2h-helpers.ts          # H2H-specific helpers
    ├── tier-helpers.ts         # Tier and efficiency index helpers
    ├── stats-calculator.ts     # Stats calculation functions
    └── formation-helpers.ts    # Formation normalization and similarity
```

**Integration Points:**
- Uses existing `src/pkg/util/football-api.ts` for API calls (may extend with team statistics methods)
- Follows same caching patterns as `modules/fixtures/`
- Uses Cloudflare Cache API (Edge Cache) and R2 for caching (aligned with existing cache strategies)
- Can leverage existing `src/utils/metrics.ts` for logging
- Follows same module pattern: `index.ts` for exports, organized subdirectories

## Notes

- All data fetching should include proper error handling
- Caching strategy: 1 hour for match data, 24 hours for season stats
- Use Cloudflare Cache API (Edge Cache) for transformed responses
- Use R2 storage for raw API data (similar to fixtures module)
- Formation normalization is critical to prevent false instability flags
- Early season context should be considered in all calculations
- H2H recency weighting uses days-based decay for more granular control
- Follow existing module patterns: `index.ts` exports, `types.ts` for interfaces, `utils/` for helpers


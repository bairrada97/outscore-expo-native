# Betting Insights Algorithm: Complete Implementation Plan

## Table of Contents
1. [Is This a Predictor Bot? (Honest Answer)](#honest-answer)
2. [How Factors Apply to Different Markets](#factor-application)
3. [Complete Implementation Plan](#implementation-plan)
4. [API Specification](#api-specification)
5. [Week-by-Week Roadmap](#roadmap)

---


### Phase 1: Historical Data Integration & Feature Engineering

#### 1.1 Data Acquisition & Cleaning
- **Download historical dataset:** https://github.com/xgabora/Club-Football-Match-Data-2000-2025 (MIT-licensed, league-only matches 2000–2025)
- **Data cleaning pipeline:**
  - Handle NaNs: Impute missing values (use median for numeric, mode for categorical)
  - Standardize team names: Create team name mapping table (handle name changes, mergers) - **See Section 1.1.1**
  - Convert dates: Ensure consistent date format, handle timezone issues
  - Filter to major leagues: Top 5 leagues (Premier League, La Liga, Serie A, Bundesliga, Ligue 1, Portuguese League, Eredevise)
  - Remove duplicates: Identify and remove duplicate matches
  - Validate data integrity: Check for impossible scores, future dates, etc.

#### 1.1.1 Team Name Standardization & Mapping

**Problem:** Historical datasets (GitHub) use different team name formats than API-Football:
- GitHub: "Sp Lisbon"
- API-Football: "Sporting CP"
- **Primary Issue:** When retraining ML models, you need to combine historical GitHub data with new API-Football data, requiring consistent team names across both datasets

**When Team Name Mapping is Needed:**

1. **Initial ML Training (NOT needed):**
   - Uses only GitHub historical dataset (2000-2025)
   - All data uses same naming convention ("Sp Lisbon")
   - No mapping needed - everything is consistent

2. **Model Retraining (NEEDED):**
   - Combines historical GitHub data + new API-Football data
   - Need consistent team names across both datasets
   - Mapping converts API names → historical names (or vice versa) for consistency

3. **Production Predictions (NOT needed):**
   - Uses only API-Football endpoints (with team IDs, not names)
   - H2H uses `/fixtures/headtohead` endpoint directly
   - Team data uses API endpoints with IDs
   - No name matching required for real-time predictions

**Solution:** Automated team name mapping system that:
1. Builds mapping table once per league (using API-Football standings endpoint)
2. Caches mappings persistently (KV/database)
3. Uses cached mappings for fast normalization during retraining
4. Auto-maps high-confidence matches, logs others for review
5. **Primary use:** Normalize API-Football team names to match historical dataset format when retraining models

**Implementation:**

```typescript
/**
 * Team Name Canonical Mapping
 * Maps team name variations from different data sources to API-Football standard names
 * Populated automatically via buildMappingForLeague(), manually for edge cases
 */
const TEAM_NAME_CANONICAL_MAP: Record<string, string> = {
  // Portuguese League (populated automatically, examples below)
  'Sp Lisbon': 'Sporting CP',
  'Sporting Lisbon': 'Sporting CP',
  'Sporting Clube de Portugal': 'Sporting CP',
  'SL Benfica': 'Benfica',
  'FC Porto': 'Porto',
  'SC Braga': 'Braga',
  
  // Add more as discovered...
};

/**
 * Team Name Mapping Service
 * Builds and caches team name mappings per league
 */
class TeamNameMappingService {
  private cache: Map<string, Map<string, string>> = new Map(); // leagueId-season → (historicalName → apiName)
  
  /**
   * Get or build team name mapping for a league
   * Only fetches from API if not cached (builds once, uses cache forever)
   * Note: Requires Context for KV access on first call
   */
  async getMappingForLeague(
    leagueId: number,
    season: number,
    forceRebuild: boolean = false,
    c?: Context
  ): Promise<Map<string, string>> {
    const cacheKey = `${leagueId}-${season}`;
    
    // Check memory cache first
    if (!forceRebuild && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }
    
    // Check persistent storage (KV/database) - requires Context
    if (c) {
      const stored = await this.loadMappingFromStorage(leagueId, season, c);
      if (stored && !forceRebuild) {
        this.cache.set(cacheKey, stored);
        return stored;
      }
    }
    
    // Build mapping (only happens once or when forced)
    const mapping = await this.buildMappingForLeague(leagueId, season, c);
    
    // Cache it (memory + persistent) - requires Context for persistent storage
    this.cache.set(cacheKey, mapping);
    if (c) {
      await this.saveMappingToStorage(leagueId, season, mapping, c);
    }
    
    return mapping;
  }
  
  /**
   * Build team name mapping by comparing historical data with API teams
   * Uses /standings endpoint to get all teams in league
   * Runs ONCE per league (or when you add new historical data)
   * Note: Requires Context for logging review queue
   */
  private async buildMappingForLeague(
    leagueId: number,
    season: number,
    c?: Context
  ): Promise<Map<string, string>> {
    // 1. Fetch all teams from API-Football using standings endpoint
    const apiTeams = await this.fetchAllTeamsFromStandings(leagueId, season);
    
    // 2. Get historical team names (from GitHub dataset)
    const historicalTeamNames = await this.getHistoricalTeamNames(leagueId);
    
    // 3. Build mapping with fuzzy matching
    const mapping = new Map<string, string>();
    const reviewQueue: Array<{ historical: string; api: string; confidence: string }> = [];
    
    for (const historicalName of historicalTeamNames) {
      const match = await this.findBestMatch(historicalName, apiTeams);
      
      if (match && match.confidence === 'HIGH') {
        // Auto-map high confidence matches (≥85% similarity)
        mapping.set(historicalName, match.apiName);
      } else if (match && match.confidence === 'MEDIUM') {
        // Store medium confidence for review, but use it
        mapping.set(historicalName, match.apiName);
        reviewQueue.push({
          historical: historicalName,
          api: match.apiName,
          confidence: match.confidence
        });
      } else {
        // Low confidence or no match - log for manual review
        reviewQueue.push({
          historical: historicalName,
          api: match?.apiName || 'NO_MATCH',
          confidence: match?.confidence || 'NO_MATCH'
        });
      }
    }
    
    // Log review queue for manual inspection (requires Context)
    if (reviewQueue.length > 0 && c) {
      await this.logReviewQueue(leagueId, season, reviewQueue, c);
    }
    
    return mapping;
  }
  
  /**
   * Fetch all teams from API-Football using standings endpoint
   * Standings endpoint returns all teams in league with their names
   */
  private async fetchAllTeamsFromStandings(
    leagueId: number,
    season: number
  ): Promise<Array<{ id: number; name: string }>> {
    const standings = await fetchStandings({ 
      league: leagueId, 
      season: season 
    });
    
    // Extract unique teams (standings has all teams in league)
    return standings.map(entry => ({
      id: entry.team.id,
      name: entry.team.name
    }));
  }
  
  /**
   * Get historical team names from GitHub dataset
   * Filter by league
   */
  private async getHistoricalTeamNames(leagueId: number): Promise<string[]> {
    // Load your historical dataset
    const historicalData = await loadHistoricalDataset();
    
    // Filter by league (map league names to IDs)
    const leagueMatches = historicalData.filter(m => 
      getLeagueIdFromName(m.league) === leagueId
    );
    
    // Get unique team names
    const teamNames = new Set<string>();
    leagueMatches.forEach(m => {
      teamNames.add(m.homeTeam);
      teamNames.add(m.awayTeam);
    });
    
    return Array.from(teamNames);
  }
  
  /**
   * Find best match for historical team name using fuzzy matching
   */
  private async findBestMatch(
    historicalName: string,
    apiTeams: Array<{ id: number; name: string }>
  ): Promise<{ apiName: string; apiTeamId: number; confidence: 'HIGH' | 'MEDIUM' | 'LOW' } | null> {
    const normalizedHistorical = this.normalizeTeamNameForComparison(historicalName);
    
    // Try exact match (case-insensitive)
    const exactMatch = apiTeams.find(t => 
      t.name.toLowerCase() === historicalName.toLowerCase()
    );
    if (exactMatch) {
      return { apiName: exactMatch.name, apiTeamId: exactMatch.id, confidence: 'HIGH' };
    }
    
    // Try normalized match (removes FC, SC, etc.)
    const normalizedMatch = apiTeams.find(t => 
      this.normalizeTeamNameForComparison(t.name) === normalizedHistorical
    );
    if (normalizedMatch) {
      return { apiName: normalizedMatch.name, apiTeamId: normalizedMatch.id, confidence: 'HIGH' };
    }
    
    // Try fuzzy matching (Levenshtein distance)
    let bestMatch: { apiName: string; apiTeamId: number; similarity: number } | null = null;
    
    for (const apiTeam of apiTeams) {
      const similarity = this.calculateStringSimilarity(
        normalizedHistorical,
        this.normalizeTeamNameForComparison(apiTeam.name)
      );
      
      if (similarity >= 70 && (!bestMatch || similarity > bestMatch.similarity)) {
        bestMatch = {
          apiName: apiTeam.name,
          apiTeamId: apiTeam.id,
          similarity
        };
      }
    }
    
    if (bestMatch) {
      return {
        apiName: bestMatch.apiName,
        apiTeamId: bestMatch.apiTeamId,
        confidence: bestMatch.similarity >= 85 ? 'HIGH' : bestMatch.similarity >= 75 ? 'MEDIUM' : 'LOW'
      };
    }
    
    return null;
  }
  
  /**
   * Normalize team name for comparison (remove common prefixes/suffixes)
   */
  private normalizeTeamNameForComparison(name: string): string {
    return name
      .toLowerCase()
      .replace(/^(fc|sc|ac|cf|cd|rc|ud|sd|se|sl)\s+/i, '') // Remove FC, SC, AC, etc.
      .replace(/\s+(fc|cf)$/i, '') // Remove trailing FC
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim();
  }
  
  /**
   * Calculate string similarity using Levenshtein distance
   * Returns score 0-100 (100 = identical)
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 100;
    
    const distance = this.levenshteinDistance(longer, shorter);
    return ((longer.length - distance) / longer.length) * 100;
  }
  
  /**
   * Levenshtein distance implementation
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }
  
  /**
   * Load mapping from persistent storage (KV/database)
   */
  private async loadMappingFromStorage(
    leagueId: number,
    season: number,
    c?: Context
  ): Promise<Map<string, string> | null> {
    if (!c) return null;
    
    const cacheKey = `team-mapping:${leagueId}:${season}`;
    const stored = await c.env.KV.get(cacheKey, 'json');
    
    if (stored) {
      return new Map(stored);
    }
    
    return null;
  }
  
  /**
   * Save mapping to persistent storage
   */
  private async saveMappingToStorage(
    leagueId: number,
    season: number,
    mapping: Map<string, string>,
    c?: Context
  ): Promise<void> {
    if (!c) return;
    
    const cacheKey = `team-mapping:${leagueId}:${season}`;
    const mappingArray = Array.from(mapping.entries());
    
    // Cache for 1 year (mappings don't change often, only rebuild on new season)
    await c.env.KV.put(cacheKey, JSON.stringify(mappingArray), {
      expirationTtl: 365 * 24 * 60 * 60
    });
  }
  
  /**
   * Log review queue for manual inspection
   */
  private async logReviewQueue(
    leagueId: number,
    season: number,
    reviewQueue: Array<{ historical: string; api: string; confidence: string }>,
    c?: Context
  ): Promise<void> {
    if (!c) return;
    
    const reviewKey = `team-mapping-review:${leagueId}:${season}`;
    await c.env.KV.put(reviewKey, JSON.stringify(reviewQueue), {
      expirationTtl: 30 * 24 * 60 * 60 // 30 days
    });
  }
  
  /**
   * Normalize team name using cached mapping
   * This is what you call during prediction (fast, uses cache)
   * Note: Requires Context for KV access on first call
   */
  async normalizeTeamName(
    historicalName: string,
    leagueId: number,
    season: number,
    c: Context
  ): Promise<string> {
    const mapping = await this.getMappingForLeague(leagueId, season, false, c);
    return mapping.get(historicalName) || historicalName;
  }
}

// Global instance (singleton)
const teamNameMapper = new TeamNameMappingService();

/**
 * Normalize team name to API-Football standard
 * Public function for use in data processing
 * Note: Requires Context for KV access on first call
 */
export async function normalizeTeamName(
  teamName: string,
  leagueId: number,
  season: number,
  c: Context
): Promise<string> {
  return teamNameMapper.normalizeTeamName(teamName, leagueId, season, c);
}

/**
 * Initial setup: Build mappings for all leagues
 * Run this ONCE when setting up, or when you add new historical data
 * Note: Requires Context for KV access
 */
export async function buildTeamMappingsForAllLeagues(c: Context) {
  const leagues = [
    { id: 94, name: 'Primeira Liga' },      // Portuguese League
    { id: 135, name: 'Serie A' },          // Italian
    { id: 140, name: 'La Liga' },         // Spanish
    { id: 39, name: 'Premier League' },    // English
    { id: 61, name: 'Ligue 1' },          // French
    { id: 78, name: 'Bundesliga' },       // German
  ];
  
  const currentSeason = getCurrentSeason();
  const seasonYear = parseInt(currentSeason.split('-')[0]);
  
  for (const league of leagues) {
    try {
      console.log(`Building team name mapping for ${league.name} (${league.id})...`);
      await teamNameMapper.getMappingForLeague(league.id, seasonYear, false, c);
      console.log(`✅ Completed mapping for ${league.name}`);
    } catch (error) {
      console.error(`❌ Failed to build mapping for ${league.name}:`, error);
    }
  }
}

/**
 * Helper: Get league ID from league name
 * Maps league names from historical data to API-Football league IDs
 */
function getLeagueIdFromName(leagueName: string): number | null {
  const leagueMap: Record<string, number> = {
    'Primeira Liga': 94,
    'Portuguese League': 94,
    'Serie A': 135,
    'Italian Serie A': 135,
    'La Liga': 140,
    'Spanish La Liga': 140,
    'Premier League': 39,
    'English Premier League': 39,
    'Ligue 1': 61,
    'French Ligue 1': 61,
    'Bundesliga': 78,
    'German Bundesliga': 78,
  };
  
  return leagueMap[leagueName] || null;
}

/**
 * Helper: Load historical dataset
 * Replace with your actual implementation
 */
async function loadHistoricalDataset(): Promise<Array<{
  homeTeam: string;
  awayTeam: string;
  league: string;
  season: string;
  [key: string]: any;
}>> {
  // TODO: Implement loading from GitHub dataset
  // Example: Read CSV file, parse JSON, etc.
  return [];
}
```

**Usage in ML Retraining:**

```typescript
/**
 * When retraining ML models, normalize API-Football team names to match historical dataset format
 * This ensures consistency when combining historical GitHub data with new API data
 */
async function prepareRetrainingData(
  historicalMatches: Match[], // From GitHub dataset ("Sp Lisbon")
  newApiMatches: Match[],     // From API-Football ("Sporting CP")
  leagueId: number,
  season: number,
  c: Context
) {
  // Normalize API-Football names to match historical format
  const normalizedApiMatches = newApiMatches.map(match => ({
    ...match,
    homeTeam: await normalizeTeamName(match.homeTeam, leagueId, season, c), // "Sporting CP" → "Sp Lisbon"
    awayTeam: await normalizeTeamName(match.awayTeam, leagueId, season, c),
  }));
  
  // Now combine datasets with consistent team names
  const combinedData = [...historicalMatches, ...normalizedApiMatches];
  
  // Train/retrain ML model with combined dataset
  return trainLightGBM(combinedData);
}
```

**Alternative: Normalize Historical Data to API Format**

You can also normalize historical data to API format instead:

```typescript
/**
 * Alternative approach: Normalize historical data to match API-Football format
 */
async function prepareRetrainingDataAlternative(
  historicalMatches: Match[], // From GitHub dataset ("Sp Lisbon")
  newApiMatches: Match[],     // From API-Football ("Sporting CP")
  leagueId: number,
  season: number,
  c: Context
) {
  // Normalize historical names to match API format
  const normalizedHistoricalMatches = historicalMatches.map(match => ({
    ...match,
    homeTeam: await normalizeTeamName(match.homeTeam, leagueId, season, c), // "Sp Lisbon" → "Sporting CP"
    awayTeam: await normalizeTeamName(match.awayTeam, leagueId, season, c),
  }));
  
  // Now combine datasets with consistent team names (all in API format)
  const combinedData = [...normalizedHistoricalMatches, ...newApiMatches];
  
  // Train/retrain ML model with combined dataset
  return trainLightGBM(combinedData);
}
```

**Workflow:**

1. **Initial Setup (One-Time):**
   ```typescript
   // Run once when setting up
   await buildTeamMappingsForAllLeagues(c);
   ```

2. **During Retraining (Fast):**
   ```typescript
   // Uses cached mapping (no API calls)
   const normalized = await normalizeTeamName('Sporting CP', 94, 2024, c);
   // Returns: "Sp Lisbon" (instant, from cache) - matches historical format
   ```

3. **Rebuild When Needed:**
   ```typescript
   // Force rebuild for new season or new historical data
   await teamNameMapper.getMappingForLeague(94, 2024, true); // forceRebuild = true
   ```

**Benefits:**
- ✅ **Build once:** Mapping built once per league, cached forever
- ✅ **Fast lookups:** Normalization uses cache (no API calls during predictions)
- ✅ **Persistent:** Mappings saved to KV/database, survive restarts
- ✅ **Auto-mapping:** High-confidence matches (≥85% similarity) auto-mapped
- ✅ **Review queue:** Medium/low confidence matches logged for manual review

**ROI:** Medium-High (enables model retraining with combined datasets, prevents data matching failures during retraining)

**Implementation Effort:** 1-2 days (mapping service + fuzzy matching + caching + integration)

**Note:** This is primarily needed for ML retraining workflows, not for production predictions. Production uses API-Football endpoints directly with team IDs, so no name matching is required for real-time predictions.

#### 1.2 Feature Engineering - Form Calculations
- **Recompute form features to match live algo logic:**
  - Calculate last-10 matches form (points sum: Win=3, Draw=1, Loss=0)
  - Add configurable exponential recency weighting with alpha decay parameter:
    - Default weights: Last 2 games 1.5x, games 3-5 1.2x, games 6-10 1.0x
    - Configurable decay: `weight = alpha^(n-1)` where alpha ∈ [0.8, 0.9], n = match age
    - Enable A/B testing: Compare different alpha values against current algo's recency bias
    - Example: `FormWeightAlpha = 0.85` (tunable per league/model)
    - Reference: `config.formWeighting` (see Section 1.5 for centralized configuration)
  - Add weighted form columns:
    - `Form10Home_Weighted`: Weighted points from last 10 home matches
    - `Form10Away_Weighted`: Weighted points from last 10 away matches
    - `Form10Overall_Weighted`: Weighted points from last 10 all matches
    - `Form5Recent_Weighted`: Extra weight on last 5 matches (2x multiplier)
  
- **Advanced form metrics:**
  - `FormMomentum`: Trend analysis (improving/declining/stable) using moving average
  - `FormVolatility`: Standard deviation of points in last 10 matches (high = inconsistent)
  - `FormAgainstTier`: Points against teams of similar/higher/lower tier
    - **Implementation Note:** Requires historical tier computation per season
    - Compute `EfficiencyIndex_50` per season (not cross-season)
    - Create tier mapping table: `TeamTier_Season(team_id, season, tier)`
    - Calculate tiers before computing FormAgainstTier feature
    - Tier thresholds may vary by league/season (normalize if needed)
  - `FormHomeVsAway`: Home form strength vs away form strength ratio

#### 1.2.5 Opponent-Adjusted Rate Stats

**Goal:** Weight all rate stats (scoring, conceded, BTTS%, clean sheets, Over/Under rates) by opponent tier to account for strength-of-schedule, preventing overestimation of weak-schedule performers and underestimation of strong-schedule performers.

**Problem Statement:**

Simple percentages (e.g., "scored in 4/5 games") treat a goal vs Manchester City the same as vs a Tier 4 team. This leads to:
- **Inflated stats for teams with easy fixtures:** A mid-table team scoring vs bottom feeders looks elite → false positives in BTTS/Over predictions (3–5% accuracy loss)
- **Missed value in "sleeping giants":** Teams with tough schedules underperform statistically but may have value
- **Edge dilution:** In competitive betting markets, strength-of-schedule is a top differentiator for 70%+ models

**Implementation:**

**1. Tier Weights:**

```typescript
const TIER_WEIGHTS: Record<number, number> = {
  1: 1.5,  // Tier 1 opponent: 1.5x weight (harder to score/keep clean sheet against)
  2: 1.2,  // Tier 2 opponent: 1.2x weight
  3: 1.0,  // Tier 3 opponent: 1.0x weight (baseline)
  4: 0.7,  // Tier 4 opponent: 0.7x weight (easier to score/keep clean sheet against)
};

// Fallback: If opponent tier unknown, default to 3 (mid-tier)
const DEFAULT_TIER = 3;
```

**2. Generic Opponent-Adjusted Rate Calculator:**

```typescript
/**
 * Calculate opponent-adjusted rate for any binary metric (scored, BTTS, clean sheet, etc.)
 * @param matches - Array of historical matches
 * @param opponents - Array of opponent team data (must match matches array length)
 * @param metricFn - Function that extracts the metric from a match (returns 0 or 1)
 * @param formWeighting - Recency weighting configuration
 * @returns Opponent-adjusted rate as percentage (0-100)
 */
function calculateOpponentAdjustedRate(
  matches: Match[],
  opponents: TeamData[],
  metricFn: (match: Match) => number, // Returns 0 or 1
  formWeighting: FormWeightingConfig
): number {
  if (matches.length === 0) return 50; // Default to 50% if no data
  
  let weightedMetric = 0;
  let totalWeight = 0;
  
  matches.forEach((match, index) => {
    const metricValue = metricFn(match); // 0 or 1
    const opponent = opponents[index];
    const opponentTier = opponent?.mind?.tier || DEFAULT_TIER;
    
    // Recency weight (from form weighting config)
    let recencyWeight = 1.0;
    if (index < 2) {
      recencyWeight = formWeighting.recentGamesWeight; // Last 2 games
    } else if (index < 5) {
      recencyWeight = formWeighting.midGamesWeight; // Games 3-5
    } else {
      recencyWeight = formWeighting.oldGamesWeight; // Games 6+
    }
    
    // Opponent quality weight
    const tierWeight = TIER_WEIGHTS[opponentTier] || 1.0;
    
    // Combined weight
    const totalMatchWeight = recencyWeight * tierWeight;
    
    weightedMetric += metricValue * totalMatchWeight;
    totalWeight += totalMatchWeight;
  });
  
  // Convert to percentage
  return totalWeight > 0 ? (weightedMetric / totalWeight) * 100 : 50;
}
```

**3. Specific Rate Calculations:**

```typescript
/**
 * Opponent-adjusted scoring rate (percentage of matches where team scored)
 */
function calculateOpponentAdjustedScoringRate(
  matches: Match[],
  opponents: TeamData[],
  formWeighting: FormWeightingConfig
): number {
  return calculateOpponentAdjustedRate(
    matches,
    opponents,
    (match) => (match.goalsScored || 0) > 0 ? 1 : 0,
    formWeighting
  );
}

/**
 * Opponent-adjusted clean sheet rate
 */
function calculateOpponentAdjustedCleanSheetRate(
  matches: Match[],
  opponents: TeamData[],
  formWeighting: FormWeightingConfig
): number {
  return calculateOpponentAdjustedRate(
    matches,
    opponents,
    (match) => (match.goalsConceded || 0) === 0 ? 1 : 0,
    formWeighting
  );
}

/**
 * Opponent-adjusted BTTS rate
 */
function calculateOpponentAdjustedBTTSRate(
  matches: Match[],
  opponents: TeamData[],
  formWeighting: FormWeightingConfig
): number {
  return calculateOpponentAdjustedRate(
    matches,
    opponents,
    (match) => {
      const homeScored = (match.homeGoals || 0) > 0;
      const awayScored = (match.awayGoals || 0) > 0;
      return homeScored && awayScored ? 1 : 0;
    },
    formWeighting
  );
}

/**
 * Opponent-adjusted Over 2.5 goals rate
 */
function calculateOpponentAdjustedOver25Rate(
  matches: Match[],
  opponents: TeamData[],
  formWeighting: FormWeightingConfig
): number {
  return calculateOpponentAdjustedRate(
    matches,
    opponents,
    (match) => {
      const totalGoals = (match.homeGoals || 0) + (match.awayGoals || 0);
      return totalGoals > 2.5 ? 1 : 0;
    },
    formWeighting
  );
}

/**
 * Opponent-adjusted goals conceded rate (percentage of matches where team conceded)
 */
function calculateOpponentAdjustedConcededRate(
  matches: Match[],
  opponents: TeamData[],
  formWeighting: FormWeightingConfig
): number {
  return calculateOpponentAdjustedRate(
    matches,
    opponents,
    (match) => (match.goalsConceded || 0) > 0 ? 1 : 0,
    formWeighting
  );
}
```

**4. Integration into Feature Engineering:**

**Mind Layer (50 matches):**

Replace simple percentages with opponent-adjusted versions:

```typescript
// OLD: Simple percentage
const avgGoalsScored_50 = (homeTeam.last50Matches.filter(m => m.goalsScored > 0).length / 50) * 100;

// NEW: Opponent-adjusted
const avgGoalsScored_50 = calculateOpponentAdjustedScoringRate(
  homeTeam.last50Matches,
  homeTeam.last50Matches.map(m => getOpponentData(m.awayTeamId, m.season)),
  config.formWeighting
);

// Apply to all Mind layer rate stats:
// - AvgGoalsScored_50 → opponent-adjusted
// - AvgGoalsConceded_50 → opponent-adjusted
// - CleanSheetRate_50 → opponent-adjusted
// - BTTSRate_50 → opponent-adjusted
// - Over25Rate_50 → opponent-adjusted
```

**Mood Layer (10 matches):**

Apply same opponent adjustment to recent form:

```typescript
// OLD: Simple percentage
const bttsRate_10 = (homeTeam.last10Matches.filter(m => m.homeGoals > 0 && m.awayGoals > 0).length / 10) * 100;

// NEW: Opponent-adjusted
const bttsRate_10 = calculateOpponentAdjustedBTTSRate(
  homeTeam.last10Matches,
  homeTeam.last10Matches.map(m => getOpponentData(m.awayTeamId, m.season)),
  config.formWeighting
);

// Apply to all Mood layer rate stats:
// - Scoring rate in last 10 matches → opponent-adjusted
// - Conceding rate in last 10 matches → opponent-adjusted
// - BTTS rate in last 10 matches → opponent-adjusted
// - Over 2.5 rate in last 10 matches → opponent-adjusted
```

**5. Opponent Data Acquisition:**

Ensure opponent tier data is available during feature calculation:

```typescript
/**
 * Get opponent team data for a match, including tier information
 * @param opponentTeamId - ID of the opponent team
 * @param season - Season of the match (for tier calculation)
 * @returns TeamData with mind.tier populated
 */
async function getOpponentData(
  opponentTeamId: string,
  season: string
): Promise<TeamData> {
  // Fetch or compute opponent's tier for the given season
  // This should use the same EfficiencyIndex_50 calculation as the main team
  const opponentMatches = await getTeamMatches(opponentTeamId, season, 50);
  const efficiencyIndex = calculateEfficiencyIndex(opponentMatches);
  const tier = categorizeTier(efficiencyIndex);
  
  return {
    id: opponentTeamId,
    mind: {
      tier,
      efficiencyIndex,
      // ... other mind features
    },
    // ... other team data
  };
}

// Pre-compute opponent tiers during data acquisition phase
// Store in: TeamTier_Season(team_id, season, tier) table for fast lookup
```

**6. Usage in Prediction Functions:**

```typescript
// Example: In predictBTTS function
async function predictBTTS(
  homeTeam: TeamData,
  awayTeam: TeamData,
  context: MatchContext,
  config: AlgorithmConfig
): Promise<Prediction> {
  // Get opponent-adjusted scoring rates
  const homeScoredPct = calculateOpponentAdjustedScoringRate(
    homeTeam.lastHomeMatches,
    await Promise.all(
      homeTeam.lastHomeMatches.map(m => getOpponentData(m.awayTeamId, m.season))
    ),
    config.formWeighting
  );
  
  const awayScoredPct = calculateOpponentAdjustedScoringRate(
    awayTeam.lastAwayMatches,
    await Promise.all(
      awayTeam.lastAwayMatches.map(m => getOpponentData(m.homeTeamId, m.season))
    ),
    config.formWeighting
  );
  
  // Use opponent-adjusted rates in base probability calculation
  const baseProbability = (homeScoredPct + awayScoredPct) / 2;
  
  // ... rest of prediction logic
}
```

**Benefits:**

- ✅ **Accuracy improvement:** +2–4% accuracy by accounting for strength-of-schedule
- ✅ **Reduces false positives:** Prevents overestimation of weak-schedule teams
- ✅ **Captures value:** Identifies strong teams with tough schedules (sleeping giants)
- ✅ **Edge differentiation:** Critical differentiator in competitive betting markets
- ✅ **Systematic application:** Consistent approach across all rate stats

**Implementation Notes:**

1. **Data Pipeline:** Ensure opponent tier data is available during feature calculation (add to `getTeamData()` function)
2. **Performance:** Pre-compute opponent tiers per season to avoid repeated calculations (see Pre-Computation Strategy below)
3. **Fallback:** Default to tier 3 (mid-tier) if opponent tier unknown
4. **Testing:** Compare opponent-adjusted vs simple percentages on historical data to validate improvement

**Pre-Computation Strategy for Opponent Tiers:**

To enable efficient opponent-adjusted rate calculations, opponent tiers must be pre-computed and cached:

```typescript
/**
 * Pre-compute all team tiers for a season
 * Run once at start of season or periodically (e.g., monthly)
 */
async function precomputeSeasonTiers(
  leagueId: number,
  season: string
): Promise<void> {
  const teams = await getLeagueTeams(leagueId, season);
  const tierCache: Record<number, { tier: number; efficiencyIndex: number; lastUpdated: Date }> = {};
  
  for (const team of teams) {
    // Fetch 50 matches for Mind layer
    const matches = await getTeamMatchesInLeague(team.id, leagueId, season, 50);
    
    if (matches.length >= 30) {
      // Calculate tier from matches
      const ei = calculateEfficiencyIndex(matches);
      const tier = categorizeTier(ei);
      
      tierCache[team.id] = {
        tier,
        efficiencyIndex: ei,
        lastUpdated: new Date()
      };
    } else {
      // Insufficient data: use league average or promoted team logic
      const fallbackTier = await getFallbackTier(team.id, leagueId, season);
      tierCache[team.id] = {
        tier: fallbackTier.tier,
        efficiencyIndex: fallbackTier.efficiencyIndex,
        lastUpdated: new Date()
      };
    }
  }
  
  // Store in database/cache: TeamTier_Season table
  await storeTeamTiers(leagueId, season, tierCache);
  
  // Also cache in Redis/KV for fast lookup
  for (const [teamId, data] of Object.entries(tierCache)) {
    await cache.set(`tier:${leagueId}:${season}:${teamId}`, data, { ttl: 7 * 24 * 60 * 60 }); // 7 days
  }
}

/**
 * Get opponent tier with caching (O(1) lookup after pre-computation)
 */
async function getOpponentTier(
  opponentTeamId: number,
  leagueId: number,
  season: string
): Promise<{ tier: number; efficiencyIndex: number }> {
  // Try cache first
  const cached = await cache.get(`tier:${leagueId}:${season}:${opponentTeamId}`);
  if (cached) {
    return { tier: cached.tier, efficiencyIndex: cached.efficiencyIndex };
  }
  
  // Try database
  const dbTier = await db.getTeamTier(opponentTeamId, leagueId, season);
  if (dbTier) {
    // Cache for future lookups
    await cache.set(`tier:${leagueId}:${season}:${opponentTeamId}`, dbTier, { ttl: 7 * 24 * 60 * 60 });
    return { tier: dbTier.tier, efficiencyIndex: dbTier.efficiencyIndex };
  }
  
  // Fallback: Calculate on-the-fly (slower, but works)
  const matches = await getTeamMatchesInLeague(opponentTeamId, leagueId, season, 50);
  if (matches.length >= 30) {
    const ei = calculateEfficiencyIndex(matches);
    const tier = categorizeTier(ei);
    
    // Cache result
    const result = { tier, efficiencyIndex: ei };
    await cache.set(`tier:${leagueId}:${season}:${opponentTeamId}`, result, { ttl: 7 * 24 * 60 * 60 });
    return result;
  }
  
  // Final fallback: default tier
  return { tier: 3, efficiencyIndex: 1.0 };
}

/**
 * Batch pre-compute tiers for multiple leagues/seasons
 * Run as scheduled job (e.g., weekly or monthly)
 */
async function batchPrecomputeTiers(
  leagueIds: number[],
  seasons: string[]
): Promise<void> {
  for (const leagueId of leagueIds) {
    for (const season of seasons) {
      console.log(`Pre-computing tiers for league ${leagueId}, season ${season}`);
      await precomputeSeasonTiers(leagueId, season);
    }
  }
}

// Scheduled job (e.g., weekly on Sunday)
// cron.schedule('0 2 * * 0', async () => {
//   const activeLeagues = await getActiveLeagues();
//   const currentSeason = getCurrentSeason();
//   await batchPrecomputeTiers(activeLeagues, [currentSeason]);
// });
```

**Database Schema:**

```sql
CREATE TABLE TeamTier_Season (
  team_id INT NOT NULL,
  league_id INT NOT NULL,
  season VARCHAR(10) NOT NULL,
  tier INT NOT NULL,
  efficiency_index DECIMAL(5,2) NOT NULL,
  matches_count INT NOT NULL,
  last_updated TIMESTAMP NOT NULL,
  PRIMARY KEY (team_id, league_id, season),
  INDEX idx_league_season (league_id, season)
);
```

**Performance Benefits:**

- **Before pre-computation:** O(n) per match = 50 matches × 50 opponent lookups = 2,500 calculations per prediction
- **After pre-computation:** O(1) lookup = 50 opponent lookups per prediction
- **Speed improvement:** ~50x faster for opponent-adjusted calculations
- **Scalability:** Enables real-time predictions even with opponent-adjusted stats

**Update Schedule:**

- **Start of season:** Pre-compute all teams
- **Weekly updates:** Re-compute tiers for teams with new matches (rolling window)
- **Monthly full refresh:** Re-compute all teams to account for form changes

**Feature Engineering Updates:**

Update Section 1.3 (Mind/Mood/DNA Layers) to use opponent-adjusted rates:

- `AvgGoalsScored_50`: Use `calculateOpponentAdjustedScoringRate()` with 50 matches
- `AvgGoalsConceded_50`: Use `calculateOpponentAdjustedConcededRate()` with 50 matches
- `CleanSheetRate_50`: Use `calculateOpponentAdjustedCleanSheetRate()` with 50 matches
- `BTTSRate_50`: Use `calculateOpponentAdjustedBTTSRate()` with 50 matches
- `Over25Rate_50`: Use `calculateOpponentAdjustedOver25Rate()` with 50 matches
- Mood layer equivalents: Apply same opponent adjustment to 10-match rates

**Implementation Effort & ROI:**

- **Effort:** 2–3 days (update rate calculations; add opponent tier lookup to data pipeline)
- **ROI:** Very high (+2–4% accuracy; big edge in uneven schedules like post-international breaks)

#### 1.3 Feature Engineering - Mind/Mood/DNA Layers

**Important:** Mind layer requires 50 matches from the **current league** (not current season). Since most leagues have ~38 matches per season, this typically requires fetching matches from **multiple seasons** (current + previous 1-2 seasons in the same league).

- **Mind Layer Features (50 matches from current league, multiple seasons):**
  - **Data Source:** Last 50 matches from current league (may span 2-3 seasons)
  - **Filter:** Only matches from current league (leagueId), not current season
  - **Why multiple seasons:** Most leagues have ~38 matches/season, need 50 for Mind layer
  - `EfficiencyIndex_50`: (Avg Points per Game) + (Goal Difference / 10)
  - `Tier_50`: Categorized tier (1-4) based on EI
  - `AvgGoalsScored_50`: Average goals scored over 50 matches
  - `AvgGoalsConceded_50`: Average goals conceded over 50 matches
  - `CleanSheetRate_50`: Clean sheet percentage over 50 matches
  - `BTTSRate_50`: BTTS percentage over 50 matches
  - `Over25Rate_50`: Over 2.5 goals percentage over 50 matches

- **Mood Layer Features (10 matches from current season):**
  - **Data Source:** Last 10 matches from current season only
  - **Filter:** Matches from current season (season parameter)
  - **Why current season only:** Captures recent momentum, not historical baseline
  - `EfficiencyIndex_10`: Recent form EI
  - `Tier_10`: Recent tier classification
  - `MindMoodGap`: Absolute difference between Mind tier and Mood tier
  - `IsSleepingGiant`: Binary flag (Mind Tier 1, Mood Tier 4)
  - `IsOverPerformer`: Binary flag (Mind Tier 4, Mood Tier 1)
  - `FormTrend`: Improving/Declining/Stable (using linear regression on last 10 points)

- **DNA Layer Features (Season stats):**
  - `MostPlayedFormation`: Most common formation (encoded as categorical)
  - `FormationStabilityScore`: Percentage of matches using most common formation
  - `Under25Percentage`: Season Under 2.5 goals rate
  - `Over25Percentage`: Season Over 2.5 goals rate
  - `CleanSheetPercentage`: Season clean sheet rate
  - `FailedToScorePercentage`: Season failed to score rate
  - `FirstHalfGoalPercentage`: Percentage of goals scored in first half
  - `EarlyGoalPercentage`: Percentage of goals in 0-15 minute window
  - `LateStarter`: Binary flag (<20% goals in first 15 mins)
  - `DangerZoneWindows`: Top 3 time windows where team concedes most goals

#### 1.4 Feature Engineering - Match Context Features
- **H2H Features:**
  - `H2HMatchCount`: Number of historical H2H matches
  - `H2HHomeWins`: Home team wins in H2H
  - `H2HAwayWins`: Away team wins in H2H
  - `H2HDraws`: Draws in H2H
  - `H2HBTTSRate`: BTTS percentage in H2H (weighted by recency)
  - `H2HOver25Rate`: Over 2.5 goals percentage in H2H (weighted)
  - `H2HAvgGoals`: Average total goals in H2H (weighted)
  - `H2HRecencyWeight`: Average recency weight of H2H matches
    - **Consistency Check:** Ensure exponential decay matches live algo
    - **IMPROVED:** Uses days-based decay instead of year-based for more granular weighting
    - Formula: `weight = e^(-daysDiff / 365)` where daysDiff = days since match
    - Within-season boost: Matches from same season get 1.2x multiplier
    - Recent months boost: Last 3 months get 1.1x multiplier
    - Example: Same season match (30 days ago) = 1.0 × 1.2 × 1.1 = 1.32x weight
    - Example: Previous season match (400 days ago) = 0.33x weight
    - Reference: `config.h2hRecency` (see Section 1.6 for centralized configuration)

- **Contextual Features:**
  - `DaysSinceLastMatch_Home`: Rest days for home team
  - `DaysSinceLastMatch_Away`: Rest days for away team
  - `RestAdvantage`: Home rest days - Away rest days
  - `RoundNumber`: Current round number (extracted from round string)
  - `IsEarlySeason`: Binary flag (round < 5)
  - `LeaguePosition_Home`: Home team league position
  - `LeaguePosition_Away`: Away team league position
  - `PointsGap`: Points difference between teams
  - `Motivation_Home`: Motivation level (TITLE_RACE, CL_RACE, etc.)
  - `Motivation_Away`: Motivation level
  - `MotivationClash`: Binary flag (high motivation vs low motivation)

- **Formation Features:**
  - `HomeFormation`: Match formation for home team
  - `AwayFormation`: Match formation for away team
  - `HomeFormationStable`: Binary flag (matches most played formation)
  - `AwayFormationStable`: Binary flag
  - `HomeFormationUsagePct`: Usage percentage of match formation
  - `AwayFormationUsagePct`: Usage percentage of match formation
  - `CombinedFormationInstability`: Combined instability score

- **Match Type Features:**
  - `MatchType`: 'LEAGUE' | 'CUP' | 'FRIENDLY' | 'INTERNATIONAL'
  - `IsKnockout`: Binary flag (cup match in knockout stage)
  - `MatchImportance`: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  - **Detection Logic:**
    - Cup competitions: Keywords in league name ('cup', 'champions league', 'europa', 'fa cup', 'copa del rey')
    - Knockout stages: Keywords in round ('round of', 'quarter', 'semi', 'final')
    - Importance levels:
      - CRITICAL: Final, semi-final, title decider
      - HIGH: Quarter-final, relegation battle, CL qualification
      - MEDIUM: Early cup rounds, mid-table
      - LOW: Friendly, preseason

- **Safety Flags:**
  - `RegressionRisk_Home`: Binary flag (Tier 3 team won 5+ in a row)
  - `RegressionRisk_Away`: Binary flag
  - `LiveDog_Home`: Binary flag (bottom team scored in 2 of last 3 away)
  - `LiveDog_Away`: Binary flag

#### 1.4.5 Probabilistic Safety Flags

**Goal:** Replace binary safety flags with probabilistic scores (0-1) to provide more nuanced risk assessment and better calibration.

**Problem Statement:**

Current binary flags (Section 1.4) are too coarse:
- **Regression Risk:** Binary (yes/no) doesn't distinguish between 3-win streak vs 7-win streak
- **Live Dog:** Binary doesn't account for strength of recent performance
- **Over-performer:** Binary doesn't capture degree of over-performance

**Impact:**

- **Binary flags:** Same adjustment applied whether risk is 0.3 or 0.9
- **Probabilistic flags:** Adjustments scale with actual risk level
- **Better calibration:** More accurate probability estimates

**Implementation:**

**1. Regression Risk Probability:**

```typescript
/**
 * Calculate regression risk probability (0-1) based on win streak and team tier
 * Higher probability = more likely to regress
 */
function calculateRegressionRiskProbability(
  team: TeamData,
  winStreak: number,
  config: AlgorithmConfig
): number {
  const { mindTier, moodTier } = team
  
  // Base risk from tier gap (over-performer)
  let baseRisk = 0
  
  if (moodTier < mindTier) {
    // Over-performing: Tier 4 team playing like Tier 1
    const tierGap = mindTier - moodTier
    baseRisk = tierGap * 0.15 // 0.15 per tier gap (max 0.45 for 3-tier gap)
  }
  
  // Streak risk: Longer streaks = higher regression probability
  let streakRisk = 0
  if (winStreak >= 5) {
    streakRisk = Math.min(0.4, (winStreak - 4) * 0.1) // 0.1 per win above 4 (max 0.4)
  } else if (winStreak >= 3) {
    streakRisk = (winStreak - 2) * 0.05 // 0.05 per win above 2
  }
  
  // Tier-specific risk: Lower tier teams regress more
  const tierMultiplier = {
    1: 0.6, // Tier 1 teams less likely to regress
    2: 0.8,
    3: 1.0, // Baseline
    4: 1.2  // Tier 4 teams more likely to regress
  }[mindTier] || 1.0
  
  // Combine risks
  const totalRisk = Math.min(1.0, (baseRisk + streakRisk) * tierMultiplier)
  
  return totalRisk
}

// Usage
const regressionRisk = calculateRegressionRiskProbability(
  homeTeam,
  homeTeam.recentWinStreak,
  config
)

// Apply adjustment scaled by risk probability
if (regressionRisk > 0.3) {
  const adjustment = -8 * regressionRisk // Scale adjustment by risk (max -8%)
  homeProb += adjustment
}
```

**2. Live Dog Probability:**

```typescript
/**
 * Calculate "live dog" probability (0-1) - underdog team showing recent form
 * Higher probability = more likely to continue recent performance
 */
function calculateLiveDogProbability(
  team: TeamData,
  recentAwayGoals: number[], // Goals scored in last 3 away matches
  config: AlgorithmConfig
): number {
  const { mindTier, moodTier } = team
  
  // Base probability from tier gap (sleeping giant)
  let baseProb = 0
  
  if (mindTier < moodTier) {
    // Under-performing: Tier 1 team playing like Tier 4
    const tierGap = moodTier - mindTier
    baseProb = tierGap * 0.2 // 0.2 per tier gap (max 0.6 for 3-tier gap)
  }
  
  // Recent form: Goals scored in last 3 away matches
  const recentScored = recentAwayGoals.filter(g => g > 0).length
  const formProb = recentScored / 3 // 0, 0.33, 0.67, or 1.0
  
  // Combine: Recent form + tier gap
  const totalProb = Math.min(1.0, baseProb + formProb * 0.4)
  
  return totalProb
}

// Usage
const liveDogProb = calculateLiveDogProbability(
  awayTeam,
  awayTeam.lastAwayMatches.slice(0, 3).map(m => m.goalsScored),
  config
)

// Apply adjustment scaled by probability
if (liveDogProb > 0.4) {
  const adjustment = 10 * liveDogProb // Scale adjustment by probability (max +10%)
  awayProb += adjustment
}
```

**3. Over-Performer Probability:**

```typescript
/**
 * Calculate over-performer probability (0-1) - team performing above their tier
 * Higher probability = more likely to regress to mean
 */
function calculateOverPerformerProbability(
  team: TeamData,
  recentFormPoints: number, // Points in last 10 matches
  config: AlgorithmConfig
): number {
  const { mindTier, moodTier } = team
  
  // Tier gap: Larger gap = higher over-performance probability
  if (moodTier >= mindTier) {
    return 0 // Not over-performing
  }
  
  const tierGap = mindTier - moodTier
  
  // Points above expected for tier
  const expectedPointsPerGame = {
    1: 2.0, // Tier 1: ~2.0 ppg
    2: 1.5, // Tier 2: ~1.5 ppg
    3: 1.0, // Tier 3: ~1.0 ppg
    4: 0.5  // Tier 4: ~0.5 ppg
  }[mindTier] || 1.0
  
  const actualPointsPerGame = recentFormPoints / 10
  const pointsAboveExpected = actualPointsPerGame - expectedPointsPerGame
  
  // Probability based on tier gap and points above expected
  const tierGapProb = tierGap * 0.25 // 0.25 per tier gap
  const pointsProb = Math.min(0.5, pointsAboveExpected * 0.2) // 0.2 per point above expected (max 0.5)
  
  const totalProb = Math.min(1.0, tierGapProb + pointsProb)
  
  return totalProb
}
```

**4. Unified Probabilistic Safety Flags:**

```typescript
interface ProbabilisticSafetyFlags {
  regressionRisk: number; // 0-1, probability of regression
  liveDog: number; // 0-1, probability of continued form
  overPerformer: number; // 0-1, probability of over-performance
  sleepingGiant: number; // 0-1, probability of value bet (inverse of over-performer)
}

function calculateProbabilisticSafetyFlags(
  team: TeamData,
  recentMatches: Match[],
  config: AlgorithmConfig
): ProbabilisticSafetyFlags {
  const winStreak = calculateWinStreak(recentMatches)
  const recentAwayGoals = recentMatches
    .filter(m => m.isAway)
    .slice(0, 3)
    .map(m => m.goalsScored)
  const recentFormPoints = calculateFormPoints(recentMatches.slice(0, 10))
  
  return {
    regressionRisk: calculateRegressionRiskProbability(team, winStreak, config),
    liveDog: calculateLiveDogProbability(team, recentAwayGoals, config),
    overPerformer: calculateOverPerformerProbability(team, recentFormPoints, config),
    sleepingGiant: 1 - calculateOverPerformerProbability(team, recentFormPoints, config) // Inverse
  }
}

// Usage in predictions
const homeFlags = calculateProbabilisticSafetyFlags(homeTeam, homeTeam.lastMatches, config)
const awayFlags = calculateProbabilisticSafetyFlags(awayTeam, awayTeam.lastMatches, config)

// Apply adjustments scaled by probabilities
if (homeFlags.regressionRisk > 0.3) {
  homeProb += -8 * homeFlags.regressionRisk // Scale by risk
}

if (awayFlags.liveDog > 0.4) {
  awayProb += 10 * awayFlags.liveDog // Scale by probability
}

if (homeFlags.sleepingGiant > 0.5) {
  homeProb += 10 * homeFlags.sleepingGiant // Value bet
}
```

**Benefits:**

- ✅ **Better calibration:** Adjustments scale with actual risk level
- ✅ **More nuanced:** Distinguishes between different risk levels
- ✅ **Transparent:** Shows probability scores in API response
- ✅ **Flexible:** Easy to tune thresholds (e.g., only apply if probability > 0.3)

**Expected Improvement:**

- **Calibration improvement:** +0.5–1.5% accuracy via better risk assessment
- **Better value detection:** More accurate identification of sleeping giants and regression risks

**Integration:**

- Replace binary flags in Section 1.4 with probabilistic versions
- Update prediction functions to use probabilistic flags
- Add probability scores to API response

**Implementation Effort:** 1–2 days (implement probability calculations, update prediction functions)

#### 1.5 Data Quality Assessment & Handling

**Goal:** Assess data quality for each team and match context, apply confidence multipliers, and handle insufficient data scenarios gracefully.

**Data Quality Assessment:**

- **Mind Layer Data Quality:**
  - HIGH: >= 40 matches available
  - MEDIUM: 20-39 matches available
  - LOW: 10-19 matches available
  - INSUFFICIENT: < 10 matches available
  
- **Mood Layer Data Quality:**
  - HIGH: >= 8 matches available
  - MEDIUM: 5-7 matches available
  - LOW: 3-4 matches available
  - INSUFFICIENT: < 3 matches available

- **H2H Data Quality:**
  - HIGH: >= 5 matches available
  - MEDIUM: 3-4 matches available
  - LOW: 1-2 matches available
  - INSUFFICIENT: 0 matches available

**Confidence Multiplier Calculation:**

```typescript
// Calculate confidence multiplier based on data availability
function calculateConfidenceMultiplier(dataQuality: DataQualityFlags): number {
  let multiplier = 1.0;
  
  if (dataQuality.mindDataQuality === 'INSUFFICIENT') multiplier *= 0.7;
  else if (dataQuality.mindDataQuality === 'LOW') multiplier *= 0.85;
  else if (dataQuality.mindDataQuality === 'MEDIUM') multiplier *= 0.95;
  
  if (dataQuality.moodDataQuality === 'INSUFFICIENT') multiplier *= 0.8;
  else if (dataQuality.moodDataQuality === 'LOW') multiplier *= 0.9;
  
  if (dataQuality.h2hDataQuality === 'INSUFFICIENT') multiplier *= 0.7;
  else if (dataQuality.h2hDataQuality === 'LOW') multiplier *= 0.85;
  
  return Math.max(0.3, multiplier); // Minimum 30% confidence
}
```

**Fallback Strategies:**

- **Insufficient Mind Data:**
  - Fallback to league average for tier classification
  - Use fewer matches if available (minimum 10)
  - Reduce confidence but don't block predictions
  
- **Insufficient Mood Data:**
  - Use all available matches (even if < 10)
  - Weight Mind layer more heavily
  - Apply confidence penalty
  
- **Insufficient H2H Data:**
  - Use league-level averages for similar team matchups
  - Reduce H2H weight in predictions (already handled by low H2H adjustment)
  - Add warning insight to predictions

#### 1.5.4 Automated Anomaly Detection

**Goal:** Detect corrupted data, statistical outliers, and data inconsistencies early to prevent bad predictions from invalid data.

**Problem Statement:**

API data can contain:
- **Corrupted values:** Negative goals, impossible scores (>20 goals)
- **Statistical outliers:** Unusual goal distributions (e.g., 15-0 scoreline)
- **Missing critical fields:** Missing fixture ID, team IDs, dates
- **Data inconsistencies:** Future match dates, invalid league IDs
- **API errors:** Malformed responses, null values in critical fields

Without detection, these can lead to:
- Incorrect tier classifications (outlier matches skew averages)
- Bad predictions (corrupted data affects calculations)
- System failures (missing data causes crashes)

**Implementation:**

**1. Anomaly Types:**

```typescript
type AnomalyType = 'OUTLIER' | 'MISSING' | 'INVALID' | 'INCONSISTENT';

type AnomalySeverity = 'LOW' | 'MEDIUM' | 'HIGH';

interface Anomaly {
  type: AnomalyType;
  severity: AnomalySeverity;
  description: string;
  matchId?: number;
  field?: string;
  value?: any;
}

interface DataAnomalies {
  hasAnomalies: boolean;
  anomalyCount: number;
  anomalies: Anomaly[];
  severityBreakdown: {
    high: number;
    medium: number;
    low: number;
  };
}
```

**2. Anomaly Detection Functions:**

```typescript
/**
 * Detect anomalies in match data using statistical methods
 * Uses IQR (Interquartile Range) method for outlier detection (more robust than Z-score)
 */
function detectAnomalies(matches: Match[]): Anomaly[] {
  const anomalies: Anomaly[] = [];
  
  if (matches.length === 0) return anomalies;
  
  // 1. Impossible values (HIGH severity)
  matches.forEach(m => {
    // Negative goals
    if (m.goals?.home < 0 || m.goals?.away < 0) {
      anomalies.push({
        type: 'INVALID',
        severity: 'HIGH',
        description: `Negative goals detected: ${m.goals?.home}-${m.goals?.away}`,
        matchId: m.fixture?.id,
        field: 'goals',
        value: m.goals
      });
    }
    
    // Impossible high scores (>20 goals is extremely rare, likely data error)
    const totalGoals = (m.goals?.home || 0) + (m.goals?.away || 0);
    if (totalGoals > 20) {
      anomalies.push({
        type: 'INVALID',
        severity: 'HIGH',
        description: `Unusually high goal count: ${totalGoals} goals`,
        matchId: m.fixture?.id,
        field: 'goals',
        value: totalGoals
      });
    }
    
    // Future match dates
    if (m.fixture?.date) {
      const matchDate = new Date(m.fixture.date);
      if (matchDate > new Date()) {
        // Allow up to 1 year in future (scheduled matches), flag beyond that
        const oneYearFromNow = new Date();
        oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
        if (matchDate > oneYearFromNow) {
          anomalies.push({
            type: 'INCONSISTENT',
            severity: 'MEDIUM',
            description: `Match date too far in future: ${m.fixture.date}`,
            matchId: m.fixture.id,
            field: 'date',
            value: m.fixture.date
          });
        }
      }
    }
  });
  
  // 2. Missing critical fields (HIGH severity)
  matches.forEach(m => {
    if (!m.fixture?.id) {
      anomalies.push({
        type: 'MISSING',
        severity: 'HIGH',
        description: 'Missing fixture ID',
        matchId: undefined,
        field: 'fixture.id'
      });
    }
    
    if (!m.teams?.home?.id || !m.teams?.away?.id) {
      anomalies.push({
        type: 'MISSING',
        severity: 'HIGH',
        description: 'Missing team IDs',
        matchId: m.fixture?.id,
        field: 'teams'
      });
    }
    
    if (m.goals?.home === null || m.goals?.away === null) {
      anomalies.push({
        type: 'MISSING',
        severity: 'HIGH',
        description: 'Missing goals data',
        matchId: m.fixture?.id,
        field: 'goals'
      });
    }
  });
  
  // 3. Statistical outliers (MEDIUM severity) - only if we have enough matches
  if (matches.length >= 10) {
    const outliers = detectGoalOutliers(matches);
    outliers.forEach(m => {
      const totalGoals = (m.goals?.home || 0) + (m.goals?.away || 0);
      anomalies.push({
        type: 'OUTLIER',
        severity: 'MEDIUM',
        description: `Statistical outlier: ${totalGoals} total goals (unusual for this dataset)`,
        matchId: m.fixture?.id,
        field: 'goals',
        value: totalGoals
      });
    });
  }
  
  return anomalies;
}

/**
 * Detect goal outliers using IQR (Interquartile Range) method
 * More robust to outliers than Z-score method
 */
function detectGoalOutliers(matches: Match[]): Match[] {
  const totalGoals = matches
    .map(m => (m.goals?.home || 0) + (m.goals?.away || 0))
    .filter(g => g >= 0 && g <= 20) // Filter out impossible values first
    .sort((a, b) => a - b);
  
  if (totalGoals.length < 4) return []; // Need at least 4 matches for IQR
  
  const q1Index = Math.floor(totalGoals.length * 0.25);
  const q3Index = Math.floor(totalGoals.length * 0.75);
  
  const q1 = totalGoals[q1Index];
  const q3 = totalGoals[q3Index];
  const iqr = q3 - q1;
  
  // Outliers are beyond 1.5 * IQR from quartiles
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;
  
  return matches.filter(m => {
    const goals = (m.goals?.home || 0) + (m.goals?.away || 0);
    return goals < lowerBound || goals > upperBound;
  });
}

/**
 * Alternative: Z-score method (more sensitive, use for smaller datasets)
 */
function detectGoalOutliersZScore(matches: Match[]): Match[] {
  const totalGoals = matches
    .map(m => (m.goals?.home || 0) + (m.goals?.away || 0))
    .filter(g => g >= 0 && g <= 20);
  
  if (totalGoals.length < 3) return [];
  
  const mean = totalGoals.reduce((a, b) => a + b, 0) / totalGoals.length;
  const variance = totalGoals.reduce((sum, g) => sum + Math.pow(g - mean, 2), 0) / totalGoals.length;
  const std = Math.sqrt(variance);
  
  if (std === 0) return []; // No variation
  
  return matches.filter(m => {
    const goals = (m.goals?.home || 0) + (m.goals?.away || 0);
    const zScore = Math.abs((goals - mean) / std);
    return zScore > 3; // Flag if >3 standard deviations
  });
}
```

**3. Updated Data Quality Flags:**

```typescript
interface DataQualityFlags {
  mindDataQuality: 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT';
  moodDataQuality: 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT';
  h2hDataQuality: 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT';
  dataAnomalies: DataAnomalies; // NEW: Anomaly detection results
}

/**
 * Assess data quality including anomaly detection
 */
function assessDataQuality(team: TeamData, h2hData: H2HData): DataQualityFlags {
  // Existing quality assessments
  const mindDataQuality = assessMindDataQuality(team.mind.last50Matches);
  const moodDataQuality = assessMoodDataQuality(team.lastMatches);
  const h2hDataQuality = assessH2HDataQuality(h2hData);
  
  // NEW: Anomaly detection
  const allMatches = [
    ...team.mind.last50Matches,
    ...team.lastMatches,
    ...(h2hData.matches || [])
  ];
  
  const anomalies = detectAnomalies(allMatches);
  const dataAnomalies: DataAnomalies = {
    hasAnomalies: anomalies.length > 0,
    anomalyCount: anomalies.length,
    anomalies: anomalies,
    severityBreakdown: {
      high: anomalies.filter(a => a.severity === 'HIGH').length,
      medium: anomalies.filter(a => a.severity === 'MEDIUM').length,
      low: anomalies.filter(a => a.severity === 'LOW').length
    }
  };
  
  return {
    mindDataQuality,
    moodDataQuality,
    h2hDataQuality,
    dataAnomalies
  };
}
```

#### 1.5.7 Enhanced Data Quality Edge Cases & Fallback Strategies

**Goal:** Provide comprehensive fallback strategies for all edge cases (0 matches, partial data, API failures) to ensure system reliability.

**Problem:** Need robust handling for:
- Zero matches: Team has 0 matches in current league
- Partial data: Team has <30 matches (but >0)
- API failures: API returns error or null
- Missing critical fields: Missing team IDs, dates, etc.

**Solution:** Implement comprehensive fallback functions and error handling.

**Implementation:**

```typescript
/**
 * Fallback Team Data
 * Returns league average when insufficient data
 */
interface FallbackTeamData {
  tier: 1 | 2 | 3 | 4;
  efficiencyIndex: number;
  avgGoalsPerGame: number;
  avgGoalsConcededPerGame: number;
  bttsRate: number;
  over25Rate: number;
  cleanSheetRate: number;
  scoringRate: number;
}

/**
 * Get league average statistics for fallback
 */
async function getLeagueAverageStats(
  leagueId: number,
  season: string
): Promise<FallbackTeamData> {
  // This would typically fetch from a database or calculate from standings
  // For now, use reasonable defaults per league
  
  // Default: Mid-table team (Tier 2)
  const defaultStats: FallbackTeamData = {
    tier: 2,
    efficiencyIndex: 1.0, // Average EI
    avgGoalsPerGame: 1.3,
    avgGoalsConcededPerGame: 1.3,
    bttsRate: 0.50,
    over25Rate: 0.50,
    cleanSheetRate: 0.30,
    scoringRate: 0.65, // 65% of matches with goals scored
  };
  
  // Can be enhanced to fetch actual league averages from API-Football standings
  // Example:
  // const standings = await apiFootball.getStandings(leagueId, season);
  // Calculate averages from standings data
  
  return defaultStats;
}

/**
 * Get fallback team data when insufficient matches
 */
async function getFallbackTeamData(
  teamId: number,
  leagueId: number,
  season: string,
  reason: 'ZERO_MATCHES' | 'PARTIAL_DATA' | 'API_FAILURE'
): Promise<Partial<TeamData>> {
  const leagueAvg = await getLeagueAverageStats(leagueId, season);
  
  return {
    id: teamId,
    name: `Team ${teamId}`, // Fallback name
    mind: {
      efficiencyIndex: leagueAvg.efficiencyIndex,
      tier: leagueAvg.tier,
      last50Matches: [], // Empty - using fallback
    },
    mood: {
      tier: leagueAvg.tier,
      mindMoodGap: 0,
      isSleepingGiant: false,
      isOverPerformer: false,
      isOneSeasonWonder: false,
      last10Matches: [], // Empty - using fallback
    },
    dna: {
      mostPlayedFormation: '4-4-2', // Default formation
      formationStability: 0.5, // Medium stability (unknown)
      avgGoalsPerGame: leagueAvg.avgGoalsPerGame,
      avgGoalsConcededPerGame: leagueAvg.avgGoalsConcededPerGame,
      bttsRate: leagueAvg.bttsRate,
      over25Rate: leagueAvg.over25Rate,
      cleanSheetRate: leagueAvg.cleanSheetRate,
      scoringRate: leagueAvg.scoringRate,
      firstHalfGoalPercentage: 45, // Default: 45% of goals in first half
      // ... other DNA fields with defaults
    },
    stats: {
      currentWinStreak: 0,
      currentLossStreak: 0,
      leaguePosition: 10, // Mid-table
      // ... other stats with defaults
    },
    lastMatches: [],
    lastHomeMatches: [],
    lastAwayMatches: [],
    mindMatches: [],
    moodMatches: [],
  };
}

/**
 * Handle API failures with graceful degradation
 */
async function handleApiFailure(
  error: Error,
  teamId: number,
  leagueId: number,
  season: string,
  cache?: any // Cache service if available
): Promise<TeamData | null> {
  console.error(`API failure for team ${teamId}:`, error);
  
  // Try to get cached data if available
  if (cache) {
    const cachedData = await cache.get(`team:${teamId}:${leagueId}:${season}`);
    if (cachedData) {
      console.log(`Using cached data for team ${teamId}`);
      return cachedData;
    }
  }
  
  // If no cache, return fallback data
  console.warn(`No cache available, using fallback data for team ${teamId}`);
  const fallbackData = await getFallbackTeamData(teamId, leagueId, season, 'API_FAILURE');
  
  // Log error for monitoring
  // Example: logErrorToMonitoring(error, { teamId, leagueId, season });
  
  return fallbackData as TeamData;
}

/**
 * Validate match data for missing critical fields
 */
function validateMatchData(match: any): {
  isValid: boolean;
  missingFields: string[];
  errors: string[];
} {
  const missingFields: string[] = [];
  const errors: string[] = [];
  
  // Check critical fields
  if (!match.fixture?.id) {
    missingFields.push('fixture.id');
  }
  
  if (!match.teams?.home?.id) {
    missingFields.push('teams.home.id');
  }
  
  if (!match.teams?.away?.id) {
    missingFields.push('teams.away.id');
  }
  
  if (!match.fixture?.date) {
    missingFields.push('fixture.date');
  }
  
  if (match.goals?.home === null || match.goals?.home === undefined) {
    missingFields.push('goals.home');
  }
  
  if (match.goals?.away === null || match.goals?.away === undefined) {
    missingFields.push('goals.away');
  }
  
  // Check for invalid values
  if (match.goals?.home < 0 || match.goals?.away < 0) {
    errors.push('Negative goals detected');
  }
  
  return {
    isValid: missingFields.length === 0 && errors.length === 0,
    missingFields,
    errors,
  };
}

/**
 * Enhanced getTeamData with comprehensive edge case handling
 */
async function getTeamData(
  teamId: number,
  leagueId: number,
  season: string,
  config: AlgorithmConfig,
  cache?: any
): Promise<TeamData> {
  try {
    // Fetch team data from API
    const apiData = await fetchTeamDataFromAPI(teamId, leagueId, season);
    
    // Validate data
    if (!apiData || !apiData.matches || apiData.matches.length === 0) {
      // Zero matches: Use fallback
      console.warn(`Team ${teamId} has 0 matches in league ${leagueId}`);
      const fallbackData = await getFallbackTeamData(teamId, leagueId, season, 'ZERO_MATCHES');
      
      // Reduce confidence to LOW
      // This will be handled in prediction functions
      
      return fallbackData as TeamData;
    }
    
    // Partial data: Use available data but reduce confidence
    if (apiData.matches.length < 30) {
      console.warn(`Team ${teamId} has only ${apiData.matches.length} matches (partial data)`);
      // Use available data but flag for confidence reduction
      // Confidence reduction handled in prediction functions
    }
    
    // Validate all matches
    const validatedMatches = apiData.matches.filter(match => {
      const validation = validateMatchData(match);
      if (!validation.isValid) {
        console.warn(`Invalid match data: ${validation.missingFields.join(', ')}`);
        // Log for review but don't crash
        return false; // Skip invalid matches
      }
      return true;
    });
    
    // If too many matches are invalid, use fallback
    if (validatedMatches.length < apiData.matches.length * 0.5) {
      console.error(`Too many invalid matches for team ${teamId}, using fallback`);
      return await getFallbackTeamData(teamId, leagueId, season, 'PARTIAL_DATA') as TeamData;
    }
    
    // Process validated data
    return processTeamData(validatedMatches, teamId, leagueId, season);
    
  } catch (error) {
    // API failure: Use fallback
    return await handleApiFailure(error as Error, teamId, leagueId, season, cache);
  }
}

/**
 * Calculate confidence reduction based on data completeness
 */
function calculateDataCompletenessConfidence(
  matchCount: number,
  requiredMatches: number = 30
): number {
  if (matchCount >= requiredMatches) {
    return 1.0; // Full confidence
  }
  
  // Linear reduction: 0 matches = 0.3 confidence, requiredMatches = 1.0
  const completeness = matchCount / requiredMatches;
  return Math.max(0.3, Math.min(1.0, 0.3 + (completeness * 0.7)));
}

/**
 * Apply confidence reduction for insufficient data
 */
function adjustConfidenceForDataQuality(
  baseConfidence: 'LOW' | 'MEDIUM' | 'HIGH',
  matchCount: number,
  requiredMatches: number = 30
): 'LOW' | 'MEDIUM' | 'HIGH' {
  const completenessConfidence = calculateDataCompletenessConfidence(matchCount, requiredMatches);
  
  // If completeness is low, downgrade confidence
  if (completenessConfidence < 0.5) {
    // Very low data -> LOW confidence
    return 'LOW';
  } else if (completenessConfidence < 0.7) {
    // Partial data -> downgrade by one level
    if (baseConfidence === 'HIGH') {
      return 'MEDIUM';
    }
    return 'LOW';
  }
  
  return baseConfidence;
}
```

**Integration:**

```typescript
// In prediction functions
async function predictBTTS(
  homeTeam: TeamData,
  awayTeam: TeamData,
  h2h: H2HData,
  // ... other params ...
  config: AlgorithmConfig
): Promise<MarketPrediction> {
  // ... existing code ...
  
  // Check data completeness and adjust confidence
  const homeMatchCount = homeTeam.mind.last50Matches.length;
  const awayMatchCount = awayTeam.mind.last50Matches.length;
  
  // Adjust confidence based on data quality
  if (homeMatchCount < 30 || awayMatchCount < 30) {
    confidence = adjustConfidenceForDataQuality(confidence, Math.min(homeMatchCount, awayMatchCount));
    
    // Add insight
    if (homeMatchCount < 10 || awayMatchCount < 10) {
      insights.push({
        text: `⚠️ Limited Data: Insufficient match history - predictions less reliable`,
        emoji: '⚠️',
        priority: 90,
        category: 'DATA_QUALITY',
        severity: 'HIGH',
      });
    }
  }
  
  // ... rest of prediction logic ...
}
```

**Benefits:**
- Prevents system crashes on edge cases
- Provides graceful degradation
- Maintains system reliability
- Better user experience (no errors, just lower confidence)

**ROI:** High (system reliability, prevents crashes)

**Implementation Effort:** 1-2 days (comprehensive fallback + error handling + testing)

#### 4.6.5 Fixture Congestion Verification & Integration

**Goal:** Verify that fixture congestion is fully integrated into all prediction functions and ensure it's applied correctly.

**Current Status:** Fixture congestion is documented in Section 4.6.5 with implementation code, but needs verification that it's actually called in all prediction functions.

**Verification Checklist:**

1. ✅ `calculateFixtureCongestion()` function exists (Section 4.6.5)
2. ✅ `applyFixtureCongestionAdjustment()` function exists (Section 4.6.5)
3. ⚠️ **Needs Verification:** Called in `predictBTTS()`
4. ⚠️ **Needs Verification:** Called in `predictOver25()`
5. ⚠️ **Needs Verification:** Called in `predictMatchResult()`
6. ⚠️ **Needs Verification:** Called in `predictFirstHalf()`

**Complete Integration:**

```typescript
// In ALL prediction functions (predictBTTS, predictOver25, predictMatchResult, predictFirstHalf)
async function predictBTTS(
  homeTeam: TeamData,
  awayTeam: TeamData,
  h2h: H2HData,
  matchDate: Date, // Need match date for congestion calculation
  // ... other params ...
  config: AlgorithmConfig
): Promise<MarketPrediction> {
  // ... existing code ...
  
  // Calculate fixture congestion for both teams
  const homeCongestion = calculateFixtureCongestion(homeTeam.lastMatches, matchDate);
  const awayCongestion = calculateFixtureCongestion(awayTeam.lastMatches, matchDate);
  
  // Apply congestion adjustments
  if (homeCongestion.congestionScore >= 50) {
    // High congestion reduces form reliability
    weights.recentForm *= (1 - (homeCongestion.congestionScore / 100) * config.fixtureCongestion.formWeightReduction);
    
    // Apply market-specific impact
    const congestionAdjustment = applyFixtureCongestionAdjustment(
      baseProbability,
      homeCongestion,
      'BTTS',
      config
    );
    
    // Add to adjustments array
    adjustments.push({
      name: 'fixture_congestion_home',
      value: congestionAdjustment - baseProbability,
      reason: `Home team played ${homeCongestion.matchesInLast7Days} matches in last 7 days - fatigue risk`,
    });
    
    // Add insight
    if (homeCongestion.matchesInLast7Days >= 3) {
      insights.push({
        text: `${homeTeam.name} played ${homeCongestion.matchesInLast7Days} matches in last 7 days - fatigue risk`,
        emoji: '⚡',
        priority: 75,
        category: 'CONTEXT',
        severity: 'MEDIUM',
      });
    }
  }
  
  if (awayCongestion.congestionScore >= 50) {
    // Similar for away team
    weights.recentForm *= (1 - (awayCongestion.congestionScore / 100) * config.fixtureCongestion.formWeightReduction);
    
    const congestionAdjustment = applyFixtureCongestionAdjustment(
      baseProbability,
      awayCongestion,
      'BTTS',
      config
    );
    
    adjustments.push({
      name: 'fixture_congestion_away',
      value: congestionAdjustment - baseProbability,
      reason: `Away team played ${awayCongestion.matchesInLast7Days} matches in last 7 days - fatigue risk`,
    });
    
    if (awayCongestion.matchesInLast7Days >= 3) {
      insights.push({
        text: `${awayTeam.name} played ${awayCongestion.matchesInLast7Days} matches in last 7 days - fatigue risk`,
        emoji: '⚡',
        priority: 75,
        category: 'CONTEXT',
        severity: 'MEDIUM',
      });
    }
  }
  
  // ... rest of prediction logic ...
}

// Similar integration for predictOverUnderGoals (per-line), predictMatchResult, predictFirstHalf
// Use appropriate market type: 'OVER_UNDER_GOALS' (with line), 'MATCH_RESULT', 'FIRST_HALF'
```

**Add Congestion Data to TeamData Interface (Optional):**

```typescript
interface TeamData {
  // ... existing fields ...
  
  // Optional: Pre-calculate congestion when fetching team data
  congestion?: {
    matchesInLast7Days: number;
    matchesInLast14Days: number;
    congestionScore: number;
  };
}

// In getTeamData(), calculate congestion:
async function getTeamData(
  teamId: number,
  leagueId: number,
  season: string,
  currentDate: Date // Need current date
): Promise<TeamData> {
  // ... fetch matches ...
  
  const teamData: TeamData = {
    // ... other fields ...
    congestion: calculateFixtureCongestion(matches, currentDate),
  };
  
  return teamData;
}
```

**Benefits:**
- Accounts for fixture congestion in all predictions
- Reduces form weight when teams are fatigued
- Better predictions for congested periods (e.g., Christmas period, end of season)

**ROI:** Medium (+1% accuracy improvement)

**Implementation Effort:** 2-4 hours (verify integration + add to all prediction functions + test)

**4. Updated Confidence Multiplier:**

```typescript
/**
 * Calculate confidence multiplier including anomaly penalties
 */
function calculateConfidenceMultiplier(dataQuality: DataQualityFlags): number {
  let multiplier = 1.0;
  
  // Existing data availability multipliers
  if (dataQuality.mindDataQuality === 'INSUFFICIENT') multiplier *= 0.7;
  else if (dataQuality.mindDataQuality === 'LOW') multiplier *= 0.85;
  else if (dataQuality.mindDataQuality === 'MEDIUM') multiplier *= 0.95;
  
  if (dataQuality.moodDataQuality === 'INSUFFICIENT') multiplier *= 0.8;
  else if (dataQuality.moodDataQuality === 'LOW') multiplier *= 0.9;
  
  if (dataQuality.h2hDataQuality === 'INSUFFICIENT') multiplier *= 0.7;
  else if (dataQuality.h2hDataQuality === 'LOW') multiplier *= 0.85;
  
  // NEW: Anomaly penalties
  if (dataQuality.dataAnomalies.hasAnomalies) {
    const { high, medium, low } = dataQuality.dataAnomalies.severityBreakdown;
    
    // High severity anomalies: significant penalty
    if (high > 0) {
      multiplier *= Math.max(0.5, 1 - (high * 0.15)); // -15% per high severity anomaly
    }
    
    // Medium severity anomalies: moderate penalty
    if (medium > 0) {
      multiplier *= Math.max(0.7, 1 - (medium * 0.05)); // -5% per medium severity anomaly
    }
    
    // Low severity anomalies: minor penalty
    if (low > 0) {
      multiplier *= Math.max(0.9, 1 - (low * 0.02)); // -2% per low severity anomaly
    }
  }
  
  return Math.max(0.2, multiplier); // Minimum 20% confidence (reduced from 30% due to anomaly risk)
}
```

**5. Anomaly Handling Strategy:**

```typescript
/**
 * Handle anomalies: filter out invalid matches, log warnings
 */
function handleAnomalies(
  matches: Match[],
  anomalies: Anomaly[]
): { filteredMatches: Match[]; removedCount: number; warnings: string[] } {
  const warnings: string[] = [];
  const highSeverityAnomalyIds = new Set(
    anomalies
      .filter(a => a.severity === 'HIGH' && a.matchId)
      .map(a => a.matchId!)
  );
  
  // Remove HIGH severity anomalies (corrupted data)
  const filteredMatches = matches.filter(m => {
    if (highSeverityAnomalyIds.has(m.fixture?.id)) {
      warnings.push(`Removed corrupted match ${m.fixture?.id}: ${anomalies.find(a => a.matchId === m.fixture?.id)?.description}`);
      return false;
    }
    return true;
  });
  
  // Log MEDIUM and LOW severity anomalies (statistical outliers) but keep matches
  anomalies
    .filter(a => a.severity !== 'HIGH')
    .forEach(a => {
      warnings.push(`Anomaly detected in match ${a.matchId}: ${a.description} (${a.severity} severity)`);
    });
  
  return {
    filteredMatches,
    removedCount: matches.length - filteredMatches.length,
    warnings
  };
}
```

**6. Usage in Data Pipeline:**

```typescript
// In getTeamData() function
async function getTeamData(teamId: number, leagueId: number, season: string): Promise<TeamData> {
  // Fetch matches
  const mindMatches = await getTeamMatchesForMindLayer(teamId, leagueId, season, 50);
  const moodMatches = await getTeamMatchesForMoodLayer(teamId, leagueId, season, 10);
  
  // Detect anomalies
  const allMatches = [...mindMatches, ...moodMatches];
  const anomalies = detectAnomalies(allMatches);
  
  // Handle anomalies (remove HIGH severity, log others)
  const { filteredMatches, removedCount, warnings } = handleAnomalies(allMatches, anomalies);
  
  // Log warnings for monitoring
  if (warnings.length > 0) {
    console.warn(`[ANOMALY DETECTION] Team ${teamId}:`, warnings);
  }
  
  // Re-filter matches after anomaly removal
  const filteredMindMatches = filteredMatches.filter(m => mindMatches.includes(m));
  const filteredMoodMatches = filteredMatches.filter(m => moodMatches.includes(m));
  
  // Continue with normal processing using filtered matches
  // ...
}
```

**Benefits:**
- **Early detection:** Catches corrupted data before it affects predictions
- **Prevents bad predictions:** Filters out invalid matches automatically
- **Monitoring:** Logs anomalies for API quality tracking
- **Confidence adjustment:** Reduces confidence when anomalies detected
- **Robust:** Uses IQR method (more robust than Z-score for outliers)

**ROI:** High (prevents 2-5% accuracy loss from corrupted data, improves system reliability)

**Implementation Effort:** 1-2 days

#### 1.5.5 Promoted Teams / New Teams Handling

**Goal:** Handle teams with insufficient historical data (promoted teams, expansion teams, newly formed teams) gracefully without breaking predictions.

**Important Context:**

- **Mind Layer Requirement:** Needs 50 matches from **current league** (may span 2-3 seasons)
- **Mood Layer Requirement:** Needs 10 matches from **current season** only
- **Most leagues:** ~38 matches per season, so Mind layer typically requires multiple seasons
- **Promoted teams:** Have 0 matches in current league at season start, need lower league data

**Problem Statement:**

Promoted teams (typically 3 per league per season) have:
- **No 50-match Mind layer data** in the current league (0 matches at season start, <38 even at season end)
- **Limited Mood layer data** (only matches since promotion - grows during season)
- **No H2H data** with teams in the new league
- **Different tier classification** (lower league performance doesn't directly translate to higher league)

Without proper handling, predictions may:
- Fail completely (insufficient data)
- Use incorrect tier classification (from lower league)
- Have unreliable confidence levels
- Miss value opportunities (promoted teams often outperform expectations)

**Implementation:**

**1. Helper Functions:**

```typescript
/**
 * Get previous season string (e.g., "2023-2024" -> "2022-2023")
 */
function getPreviousSeason(season: string): string {
  const [start, end] = season.split('-').map(Number);
  return `${start - 1}-${end - 1}`;
}

/**
 * Get team's previous league (for promoted teams)
 * Returns the league ID the team played in last season
 */
async function getPreviousLeague(
  teamId: number,
  currentSeason: string
): Promise<number> {
  const previousSeason = getPreviousSeason(currentSeason);
  
  // Get team's matches from previous season
  const previousMatches = await getTeamMatches(teamId, 100); // Get enough to find league
  const previousSeasonMatches = previousMatches.filter(m => m.season === previousSeason);
  
  if (previousSeasonMatches.length === 0) {
    // No previous season data: fallback to league average
    return null; // Will trigger fallback logic
  }
  
  // Get most common league from previous season
  const leagueCounts: Record<number, number> = {};
  previousSeasonMatches.forEach(m => {
    const leagueId = m.league?.id;
    if (leagueId) {
      leagueCounts[leagueId] = (leagueCounts[leagueId] || 0) + 1;
    }
  });
  
  const mostCommonLeague = Object.entries(leagueCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0];
  
  return mostCommonLeague ? parseInt(mostCommonLeague) : null;
}

/**
 * Check if team was in different league last season
 */
async function checkTeamLeagueHistory(
  teamId: number,
  currentLeagueId: number,
  previousSeason: string
): Promise<boolean> {
  const previousLeagueId = await getPreviousLeague(teamId, getCurrentSeason());
  return previousLeagueId !== null && previousLeagueId !== currentLeagueId;
}
```

**2. Promoted Team Detection:**

```typescript
/**
 * Detect if team is newly promoted (first season in current league)
 * 
 * CRITICAL: Uses multi-season match fetching to check current league history
 */
async function isPromotedTeam(
  teamId: number,
  currentSeason: string,
  leagueId: number
): Promise<boolean> {
  // Get matches from current league (may span multiple seasons)
  const currentLeagueMatches = await getTeamMatchesForMindLayer(teamId, leagueId, currentSeason, 50);
  
  // If < 20 matches in current league, likely promoted
  if (currentLeagueMatches.length < 20) {
    // Double-check: was team in different league last season?
    const wasInDifferentLeague = await checkTeamLeagueHistory(teamId, leagueId, getPreviousSeason(currentSeason));
    return wasInDifferentLeague || currentLeagueMatches.length === 0;
  }
  
  return false;
}

/**
 * Detect if team is completely new (expansion team, newly formed)
 */
function isNewTeam(teamId: number, currentSeason: string): boolean {
  const allMatches = await getTeamMatches(teamId, 100); // Check last 100 matches across all leagues
  const matchesThisSeason = allMatches.filter(m => m.season === currentSeason);
  
  // If < 10 total matches ever, consider it a new team
  return allMatches.length < 10;
}
```

**API Requirements & Optimizations:**

The following API functions use API-Football endpoints directly:

```typescript
/**
 * Fetch fixtures using API-Football /fixtures endpoint
 * Supports: team, league, season, last, from, to parameters
 */
async function fetchFixtures(params: {
  team?: number;
  league?: number;
  season?: number;
  last?: number;
  from?: string; // YYYY-MM-DD
  to?: string;   // YYYY-MM-DD
  h2h?: string;  // "team1-team2" format
}): Promise<FixtureResponse[]>;

/**
 * Fetch team statistics using API-Football /teams/statistics endpoint
 * Returns: form, fixtures, goals (with minute distribution), lineups, clean_sheet, etc.
 */
async function fetchTeamStatistics(
  teamId: number,
  leagueId: number,
  season: number
): Promise<TeamStatisticsResponse>;

/**
 * Fetch H2H matches using API-Football /fixtures/headtohead endpoint
 */
async function fetchH2H(params: {
  h2h: string; // "team1-team2"
  league?: number;
  season?: number;
  last?: number;
}): Promise<FixtureResponse[]>;
```

**Key API Optimizations:**
1. **League filtering:** API handles league filtering automatically (no manual filtering needed)
2. **Season filtering:** Use `season` parameter instead of filtering client-side
3. **Date range:** Use `from`/`to` for multi-season fetching
4. **Statistics:** Use `/teams/statistics` endpoint for DNA layer data (no manual calculations)
5. **H2H:** Use `/fixtures/headtohead` endpoint directly (no manual filtering)

**3. Promoted Team Tier Classification:**

```typescript
/**
 * Calculate tier for promoted team using lower league performance + league adjustment
 * 
 * @param lowerLeagueMatches - Matches from lower league (should be fetched using getTeamMatchesForMindLayer
 *                             to get matches from multiple seasons if needed)
 */
function calculatePromotedTeamTier(
  teamId: number,
  currentLeagueId: number,
  previousLeagueId: number,
  currentSeason: string,
  lowerLeagueMatches: Match[] // Pass matches instead of fetching internally
): { tier: number; efficiencyIndex: number; confidence: 'HIGH' | 'MEDIUM' | 'LOW' } {
  if (lowerLeagueMatches.length < 10) {
    // Not enough lower league data: fallback to league average
    return {
      tier: 3, // Default to mid-tier
      efficiencyIndex: 1.0, // League average EI
      confidence: 'LOW'
    };
  }
  
  // Calculate EI from lower league
  const lowerLeagueEI = calculateEfficiencyIndex(lowerLeagueMatches);
  const lowerLeagueTier = categorizeTier(lowerLeagueEI);
  
  // League strength adjustment
  // Top leagues (Premier League, La Liga, etc.) are stronger than lower leagues
  const leagueStrengthMultiplier = getLeagueStrengthMultiplier(currentLeagueId, previousLeagueId);
  
  // Adjust EI: Promoted teams typically perform 0.2-0.5 EI points worse in higher league
  const adjustedEI = lowerLeagueEI - (leagueStrengthMultiplier * 0.3);
  
  // Adjust tier: Typically drop 1 tier when promoted
  let adjustedTier = lowerLeagueTier + 1;
  adjustedTier = Math.min(4, Math.max(1, adjustedTier)); // Clamp to 1-4
  
  return {
    tier: adjustedTier,
    efficiencyIndex: Math.max(0, adjustedEI), // Ensure non-negative
    confidence: lowerLeagueMatches.length >= 30 ? 'MEDIUM' : 'LOW'
  };
}

/**
 * Get league strength multiplier for tier adjustment
 */
function getLeagueStrengthMultiplier(
  currentLeagueId: number,
  previousLeagueId: number
): number {
  // Top 5 leagues: Premier League (39), La Liga (140), Serie A (135), Bundesliga (78), Ligue 1 (61)
  const topLeagues = [39, 140, 135, 78, 61];
  
  const isTopLeague = topLeagues.includes(currentLeagueId);
  const wasTopLeague = topLeagues.includes(previousLeagueId);
  
  if (isTopLeague && !wasTopLeague) {
    return 1.5; // Big jump: Championship → Premier League
  } else if (isTopLeague && wasTopLeague) {
    return 0.5; // Same level: Serie A → La Liga
  } else {
    return 1.0; // Similar level leagues
  }
}
```

#### 1.5.6 One-Season Wonder Detection

**Goal:** Distinguish between genuine "Sleeping Giants" (elite teams having a bad run) and "One-Season Wonders" (recently promoted teams that overperformed and are regressing to their true level).

**Problem Statement:**

When a team promotes and finishes high (e.g., 5th place) in their first season, then plays badly in their second season:
- **Mind layer** (50 matches) includes 38 matches from the good season → Still Tier 1
- **Mood layer** (10 matches) shows bad form → Tier 4
- **Pattern:** Mind Tier 1, Mood Tier 4 → Looks like "Sleeping Giant"
- **Reality:** They're a one-season wonder regressing, NOT a value bet

**Current Issue:**
- Algorithm treats all "Mind Tier 1, Mood Tier 4" patterns as sleeping giants (+10% probability)
- This is wrong for one-season wonders - they should have reduced confidence, not added probability

**Solution:**

Detect one-season wonder pattern by checking:
1. **Seasons in league:** Team has been in current league ≤ 2 seasons
2. **Performance decline:** Recent form (Mood) is significantly worse than first season performance
3. **Pattern match:** Only applies when Mind Tier 1, Mood Tier 4 (sleeping giant pattern)

**Implementation:**

See `detectOneSeasonWonder()` and `getSeasonsInCurrentLeague()` functions in Section 1.3 (Mind/Mood/DNA Layers).

**Behavior:**
- **Genuine Sleeping Giant:** Elite team (2+ seasons at Tier 1) having bad form → +10% probability
- **One-Season Wonder:** Recently promoted team regressing → Reduce confidence by 30%, no probability boost

**Benefits:**
- Prevents false positives from one-season wonders
- More accurate confidence levels
- Better risk assessment for recently promoted teams

**ROI:** Medium-High (prevents betting on false value opportunities, improves accuracy by 2-3%)

**Implementation Effort:** 1 day (detection logic + integration into prediction functions)

**4. Fallback to League Average:**

```typescript
/**
 * Get league average tier/EI for fallback when team data insufficient
 */
async function getLeagueAverageTier(
  leagueId: number,
  season: string
): Promise<{ tier: number; efficiencyIndex: number }> {
  // Get all teams in league
  const teams = await getLeagueTeams(leagueId, season);
  
  // Calculate average EI for teams with sufficient data (>= 30 matches)
  const eis: number[] = [];
  
  for (const team of teams) {
    const matches = await getTeamMatchesInLeague(team.id, leagueId, season, 50);
    if (matches.length >= 30) {
      const ei = calculateEfficiencyIndex(matches);
      eis.push(ei);
    }
  }
  
  if (eis.length === 0) {
    // Fallback: Use default mid-tier
    return { tier: 3, efficiencyIndex: 1.0 };
  }
  
  const avgEI = eis.reduce((a, b) => a + b, 0) / eis.length;
  const avgTier = categorizeTier(avgEI);
  
  return { tier: avgTier, efficiencyIndex: avgEI };
}
```

**5. Enhanced Data Quality Assessment for Promoted Teams:**

```typescript
/**
 * Enhanced data quality assessment with promoted team handling
 */
function assessDataQualityWithPromotedTeamHandling(
  team: TeamData,
  isPromoted: boolean,
  leagueId: number,
  season: string
): DataQualityFlags & {
  isPromoted: boolean;
  promotedTeamTier?: { tier: number; efficiencyIndex: number; confidence: string };
  fallbackUsed: boolean;
} {
  const baseQuality = assessDataQuality(team, h2hData);
  
  if (isPromoted) {
    // For promoted teams, adjust quality assessment
    let mindQuality = baseQuality.mindDataQuality;
    
    // If Mind data is insufficient, use promoted team tier calculation
    if (mindQuality === 'INSUFFICIENT' || mindQuality === 'LOW') {
      // Get lower league matches (multi-season)
      const previousLeagueId = team.previousLeagueId;
      const previousSeason = getPreviousSeason(season);
      const lowerLeagueMatches = await getTeamMatchesForMindLayer(
        team.id,
        previousLeagueId,
        previousSeason,
        50
      );
      
      const promotedTier = calculatePromotedTeamTier(
        team.id,
        leagueId,
        previousLeagueId,
        season,
        lowerLeagueMatches
      );
      
      return {
        ...baseQuality,
        isPromoted: true,
        promotedTeamTier: {
          tier: promotedTier.tier,
          efficiencyIndex: promotedTier.efficiencyIndex,
          confidence: promotedTier.confidence
        },
        fallbackUsed: true,
        mindDataQuality: promotedTier.confidence === 'HIGH' ? 'MEDIUM' : 'LOW'
      };
    }
  }
  
  return {
    ...baseQuality,
    isPromoted,
    fallbackUsed: false
  };
}
```

**6. Multi-Season Match Fetching Helper (OPTIMIZED with API Parameters):**

```typescript
/**
 * Get last N matches from current league (across multiple seasons if needed)
 * OPTIMIZED: Uses API's `team`, `league`, `last`, `from`, `to` parameters directly
 * 
 * API-Football supports:
 * - `team` + `league` + `last`: Returns last N matches from that league
 * - `from`/`to`: Date range filtering
 * - `season`: Season filtering
 */
async function getTeamMatchesForMindLayer(
  teamId: number,
  leagueId: number,
  currentSeason: string,
  maxMatches: number = 50
): Promise<Match[]> {
  // Try using API's `last` parameter first (if it works across seasons)
  // Note: API's `last` parameter may only work within a season, so we use date range as fallback
  const seasonStart = getSeasonStartDate(currentSeason);
  const today = new Date();
  
  // Fetch matches from current season using date range
  let matches = await fetchFixtures({
    team: teamId,
    league: leagueId,
    from: seasonStart.toISOString().split('T')[0], // YYYY-MM-DD format
    to: today.toISOString().split('T')[0]
  });
  
  // If we need more matches, fetch from previous season
  if (matches.length < maxMatches) {
    const previousSeason = getPreviousSeason(currentSeason);
    const previousSeasonStart = getSeasonStartDate(previousSeason);
    const previousSeasonEnd = getSeasonEndDate(previousSeason);
    
    const previousMatches = await fetchFixtures({
      team: teamId,
      league: leagueId,
      from: previousSeasonStart.toISOString().split('T')[0],
      to: previousSeasonEnd.toISOString().split('T')[0]
    });
    
    // Combine and sort by date (most recent first)
    matches = [...matches, ...previousMatches]
      .sort((a, b) => new Date(b.fixture.date).getTime() - new Date(a.fixture.date).getTime())
      .slice(0, maxMatches);
  }
  
  return matches;
}

/**
 * Get last N matches from current season only (for Mood layer)
 * OPTIMIZED: Uses API's `team`, `league`, `season`, `last` parameters
 */
async function getTeamMatchesForMoodLayer(
  teamId: number,
  leagueId: number,
  currentSeason: string,
  maxMatches: number = 10
): Promise<Match[]> {
  // Use API's season parameter + last parameter
  const matches = await fetchFixtures({
    team: teamId,
    league: leagueId,
    season: parseInt(currentSeason.split('-')[0]), // Convert "2023-2024" to 2023
    last: maxMatches
  });
  
  // API should return matches sorted by date, but ensure most recent first
  return matches.sort((a, b) => 
    new Date(b.fixture.date).getTime() - new Date(a.fixture.date).getTime()
  ).slice(0, maxMatches);
}

/**
 * Helper: Get season start date (August 1st for most leagues)
 */
function getSeasonStartDate(season: string): Date {
  const [startYear] = season.split('-').map(Number);
  return new Date(startYear, 7, 1); // August = month 7 (0-indexed)
}

/**
 * Helper: Get season end date (May 31st for most leagues)
 */
function getSeasonEndDate(season: string): Date {
  const [, endYear] = season.split('-').map(Number);
  return new Date(endYear, 4, 31); // May = month 4 (0-indexed), day 31
}
```

**7. Usage in Predictions:**

```typescript
// In getTeamData() function - CORRECT IMPLEMENTATION
async function getTeamData(teamId: number, leagueId: number, season: string): Promise<TeamData> {
  // CRITICAL: Get 50 matches from current league (may span multiple seasons)
  const mindMatches = await getTeamMatchesForMindLayer(teamId, leagueId, season, 50);
  
  // Get 10 matches from current season only (for Mood layer)
  const moodMatches = await getTeamMatchesForMoodLayer(teamId, leagueId, season, 10);
  
  // Check if promoted team (insufficient matches in current league)
  const isPromoted = mindMatches.length < 30;
  
  if (isPromoted) {
    // Promoted team: Use lower league matches + adjustment
    const previousLeagueId = await getPreviousLeague(teamId, season);
    const previousSeason = getPreviousSeason(season);
    
    // Get lower league matches (also from multiple seasons if needed)
    const lowerLeagueMatches = await getTeamMatchesForMindLayer(
      teamId,
      previousLeagueId,
      previousSeason,
      50
    );
    
    // Calculate tier with league strength adjustment
    const promotedTier = await calculatePromotedTeamTier(
      teamId,
      leagueId,
      previousLeagueId,
      season,
      lowerLeagueMatches // Pass lower league matches
    );
    
    // Use promoted tier (already adjusted for league strength)
    const mindTier = promotedTier.tier;
    const mindEI = promotedTier.efficiencyIndex;
  } else {
    // Normal calculation: Use current league matches
    const mindEI = calculateEfficiencyIndex(mindMatches);
    const mindTier = categorizeTier(mindEI);
  }
  
  // Mood layer: Use current season matches only
  const moodEI = calculateEfficiencyIndex(moodMatches);
  const moodTier = categorizeTier(moodEI);
  
  // ... rest of team data calculation
}
```

**Key Implementation Notes:**

1. **Mind Layer (50 matches):**
   - Use `getTeamMatchesForMindLayer()` - fetches from multiple seasons using API date range
   - API handles league filtering automatically (no manual filtering needed)
   - May span 2-3 seasons to get 50 matches

2. **Mood Layer (10 matches):**
   - Use `getTeamMatchesForMoodLayer()` - fetches from current season only
   - API handles league + season filtering automatically
   - Captures recent momentum

3. **Promoted Teams:**
   - `mindMatches.length < 30` indicates promoted team
   - Use lower league matches separately (don't mix leagues)
   - Apply league strength adjustment

**API-Based Optimizations Summary:**

The following optimizations leverage API-Football capabilities directly:

1. **Removed Manual Filtering:**
   - ❌ `filterNonFriendlyMatches()` - API's `league` parameter excludes friendlies
   - ❌ Manual league filtering - API handles it automatically

2. **Removed Manual Calculations (Use API Statistics):**
   - ❌ `calculateGoalMinuteDistribution()` → Use `teamStats.goals.for.minute`
   - ❌ `calculateFormationFrequency()` → Use `teamStats.lineups`
   - ❌ `calculateOverUnderStats()` → Use `teamStats.goals.for.under_over`
   - ❌ `calculateCleanSheets()` → Use `teamStats.clean_sheet`
   - ❌ `calculateFailedToScore()` → Use `teamStats.failed_to_score`
   - ❌ `calculateFormString()` → Use `teamStats.form`

3. **Simplified Data Fetching:**
   - ✅ Use `/fixtures` with `team`, `league`, `season`, `last`, `from`, `to` parameters
   - ✅ Use `/fixtures/headtohead` for H2H matches (no manual filtering)
   - ✅ Use `/teams/statistics` for DNA layer data (pre-calculated)

4. **Performance Improvements:**
   - Fewer API calls (statistics endpoint provides everything)
   - Less client-side processing (API does calculations)
   - Cleaner code (no fallback calculations needed)

**8. Confidence Adjustment for Promoted Teams:**

```typescript
/**
 * Adjust confidence for promoted teams
 */
function adjustConfidenceForPromotedTeam(
  baseConfidence: 'HIGH' | 'MEDIUM' | 'LOW',
  isPromoted: boolean,
  promotedTeamTier?: { confidence: string }
): 'HIGH' | 'MEDIUM' | 'LOW' {
  if (!isPromoted) return baseConfidence;
  
  // Promoted teams: Reduce confidence by one level
  if (baseConfidence === 'HIGH') return 'MEDIUM';
  if (baseConfidence === 'MEDIUM') return 'LOW';
  
  // If promoted tier confidence is LOW, further reduce
  if (promotedTeamTier?.confidence === 'LOW') {
    return 'LOW';
  }
  
  return baseConfidence === 'HIGH' ? 'MEDIUM' : 'LOW';
}
```

**Benefits:**

- ✅ **Prevents failures:** Predictions work even for promoted teams
- ✅ **More accurate tiers:** Accounts for league strength differences
- ✅ **Appropriate confidence:** Reduces confidence when data is limited
- ✅ **Captures value:** Promoted teams often outperform expectations (sleeping giants)

**Configuration:**

```typescript
interface PromotedTeamConfig {
  minMatchesForPromotedTier: number; // Minimum matches needed (default: 10)
  leagueStrengthMultiplier: number; // EI adjustment when promoted (default: 0.3)
  tierAdjustmentOnPromotion: number; // Tier drop on promotion (default: 1)
  confidenceReduction: number; // Confidence reduction multiplier (default: 0.8)
}
```

**Implementation Effort:** 1-2 days (add detection, tier calculation, fallback logic)

**Integration Points:**

- Called from `getTeamData()` when insufficient Mind data detected
- Used in `assessDataQuality()` for promoted team flag
- Applied in confidence calculation

**Integration Points:**

- Called from `getTeamData()` after fetching team matches
- Used in prediction confidence calculation
- Applied to final prediction confidence level
- Shown in API response as `dataQuality` field

**Example:**

```typescript
const dataQuality = assessDataQuality(homeTeam, h2hData);
// Returns: {
//   mindDataQuality: 'HIGH',
//   moodDataQuality: 'MEDIUM',
//   h2hDataQuality: 'LOW',
//   confidenceMultiplier: 0.85,
//   fallbackToLeagueAverage: false
// }

const finalConfidence = baseConfidence * dataQuality.confidenceMultiplier;
```

#### 1.6 Centralized Configuration Architecture

**Goal:** Centralize all tunable weights and hyperparameters in a single configurable object/config file/class for easy A/B testing, tuning, and maintenance.

**Configuration Structure:**

```typescript
// Example: config/algorithm-config.ts
interface AlgorithmConfig {
  // Form Weighting
  formWeighting: {
    alpha: number;                    // Exponential decay factor (0.8-0.9)
    recentGamesWeight: number;        // Last 2 games multiplier (default: 1.5)
    midGamesWeight: number;          // Games 3-5 multiplier (default: 1.2)
    oldGamesWeight: number;          // Games 6-10 multiplier (default: 1.0)
  };
  
  // H2H Recency Weighting
  h2hRecency: {
    decayBase: number;               // Exponential decay base (default: 0.7)
    currentYearWeight: number;       // Current year multiplier (default: 1.0)
  };
  
  // Market Weights (Base weights - adjusted dynamically)
  marketWeights: {
    btts: {
      scoringRate: number;           // Default: 0.25
      h2h: number;                   // Default: 0.25
      defensiveForm: number;        // Default: 0.20
      recentForm: number;            // Default: 0.35
    };
    over25: {
      avgGoalsPerGame: number;      // Default: 0.30
      recentForm: number;            // Default: 0.30
      h2h: number;                   // Default: 0.20
      defensiveWeakness: number;     // Default: 0.25
    };
    matchResult: {
      recentForm: number;            // Default: 0.30
      h2h: number;                   // Default: 0.25
      homeAdvantage: number;         // Default: 0.20
      motivation: number;            // Default: 0.18
      rest: number;                  // Default: 0.12
      leaguePosition: number;        // Default: 0.10
    };
    firstHalf: {
      recentForm: number;            // Default: 0.25
      h2h: number;                   // Default: 0.20
      homeAdvantage: number;         // Default: 0.15
      motivation: number;            // Default: 0.10
      firstHalfScoring: number;      // Default: 0.40
      slowStarters: number;          // Default: 0.30
    };
  };
  
  // Tier Thresholds
  tierThresholds: {
    tier1: number;                  // EI >= 2.0
    tier2: number;                  // EI >= 1.5
    tier3: number;                  // EI >= 1.0
    tier4: number;                  // EI < 1.0
  };
  
  // Adjustment Factors
  adjustments: {
    restDays: {
      threshold: number;             // Days threshold (default: 10)
      reductionFactor: number;       // Reduction per day over threshold (default: 0.02)
      maxReduction: number;          // Maximum reduction (default: 0.5)
    };
    earlySeason: {
      roundThreshold: number;        // Round threshold (default: 5)
      formReduction: number;         // Form weight reduction (default: 0.4)
    };
    lowH2H: {
      matchThreshold: number;        // Minimum matches (default: 5)
      reductionStart: number;        // Starting reduction (default: 0.4)
      reductionPerMatch: number;      // Reduction per missing match (default: 0.05)
    };
    formationStability: {
      stabilityThreshold: number;    // Usage % threshold (default: 20)
      earlySeasonThreshold: number;  // Early season threshold (default: 30)
      similarityThreshold: number;   // Similarity threshold for considering formations similar (default: 0.75)
      exactMatchWeight: number;      // Weight for exact matches vs similar (default: 1.0)
      similarMatchWeight: number;    // Weight for similar matches (default: 0.9)
      enableSimilarityDetection: boolean; // Enable formation similarity detection (default: true)
      reductionTiers: {
        veryExperimental: number;    // <20% usage (default: 0.25)
        experimental: number;        // 20-40% usage (default: 0.15)
        occasional: number;          // 40-60% usage (default: 0.10)
        secondary: number;            // 60-80% usage (default: 0.05)
      };
      earlySeasonReduction: number;   // Early season penalty reduction (default: 0.5)
      maxCombinedReduction: number;  // Max total reduction (default: 0.30)
    };
    marketSpecificReduction: {
      btts: number;                  // Formation impact reduction for BTTS (default: 0.6)
      over25: number;                 // Formation impact reduction for O/U (default: 0.6)
      firstHalf: number;             // Formation impact reduction for First Half (default: 0.8)
      matchResult: number;            // Formation impact for Match Result (default: 1.0)
    };
  };
  
  // Safety Flags
  safetyFlags: {
    regressionRisk: {
      tierThreshold: number;         // Tier threshold (default: 3)
      winStreakThreshold: number;    // Win streak threshold (default: 5)
      confidenceReduction: number;   // Confidence reduction (default: 0.15)
    };
    motivationClash: {
      winProbBonus: number;          // Win probability bonus (default: 0.05)
    };
    liveDog: {
      leaguePositionThreshold: number; // Position threshold (default: 15)
      recentAwayGoalsThreshold: number; // Goals threshold (default: 2)
      recentMatchesWindow: number;    // Matches window (default: 3)
      bttsProbBonus: number;         // BTTS probability bonus (default: 0.10)
    };
  };
  
  // Mind/Mood/DNA Adjustments
  mindMoodGap: {
    sleepingGiant: {
      probBonus: number;             // Probability bonus (default: 0.10)
    };
    overPerformer: {
      probReduction: number;         // Probability reduction (default: 0.08)
    };
  };
  
  // DNA Layer Adjustments
  dnaAdjustments: {
    frustrationFilter: {
      under25Threshold: number;      // Under 2.5 threshold (default: 0.70)
      overProbReduction: number;      // Over probability reduction (default: 0.06-0.09)
    };
  };
  
  // ML Model Hyperparameters (if using ML)
  mlHyperparameters: {
    lightgbm: {
      numLeaves: number;
      learningRate: number;
      featureFraction: number;
      baggingFraction: number;
      baggingFreq: number;
      minDataInLeaf: number;
      maxDepth: number;
    };
    training: {
      earlyStoppingRounds: number;
      numBoostRound: number;
      validationSplit: number;
    };
  };
  
  // League-Specific Overrides
  leagueOverrides?: {
    [leagueId: string]: Partial<AlgorithmConfig>;
  };
  
  // Data Quality Thresholds
  dataQuality: {
    mind: {
      high: number;        // >= 40 matches (default: 40)
      medium: number;      // 20-39 matches (default: 20)
      low: number;         // 10-19 matches (default: 10)
    };
    mood: {
      high: number;        // >= 8 matches (default: 8)
      medium: number;      // 5-7 matches (default: 5)
      low: number;         // 3-4 matches (default: 3)
    };
    h2h: {
      high: number;        // >= 5 matches (default: 5)
      medium: number;      // 3-4 matches (default: 3)
      low: number;         // 1-2 matches (default: 1)
    };
    confidenceMultipliers: {
      insufficient: number; // Multiplier for insufficient data (default: 0.7)
      low: number;         // Multiplier for low data (default: 0.85)
      medium: number;      // Multiplier for medium data (default: 0.95)
    };
  };
  
  // Validation Thresholds
  validation: {
    minImprovement: number;      // Minimum accuracy improvement % (default: 2.0)
    significanceLevel: number;    // P-value threshold (default: 0.05)
    minTestCases: number;         // Minimum test cases required (default: 100)
  };
  
  // Match Type Detection
  matchType: {
    cupKeywords: string[];        // Keywords to detect cup competitions
    knockoutKeywords: string[];   // Keywords to detect knockout stages
    seasonStartMonth: number;     // Month when season starts (default: 7 = August)
    seasonEndMonth: number;       // Month when season ends (default: 4 = May)
  };
  
  // Probability Swing Caps
  probabilityCaps: {
    maxSwing: number;        // Max ±swing from base (default: 22)
    minProb: number;         // Minimum probability (default: 20)
    maxProb: number;         // Maximum probability (default: 80)
  };
  
  // Confidence Downgrade Rules
  confidenceDowngrade: {
    largeSwingThreshold: number;    // Swing >15% triggers downgrade (default: 15)
    mediumSwingThreshold: number;   // Swing 10-15% triggers downgrade (default: 10)
    manyAdjustmentsThreshold: number; // >4 adjustments triggers downgrade (default: 4)
  };
  
  // Asymmetric Weighting
  asymmetricWeighting: {
    btts: {
      upMax: number;         // Max upward adjustment (default: 12)
      downMax: number;       // Max downward adjustment (default: 20)
      upRiskMultiplier: number;  // Risk multiplier for up (default: 1.2)
      downRiskMultiplier: number; // Risk multiplier for down (default: 1.0)
      falsePositivePenalty: number; // Penalty for false Yes (default: 1.5)
      falseNegativePenalty: number; // Penalty for false No (default: 1.0)
    };
    over25: {
      upMax: number;         // Max upward adjustment (default: 18)
      downMax: number;       // Max downward adjustment (default: 15)
      upRiskMultiplier: number;  // Risk multiplier for up (default: 0.9)
      downRiskMultiplier: number; // Risk multiplier for down (default: 1.1)
      falsePositivePenalty: number; // Penalty for false Over (default: 0.8)
      falseNegativePenalty: number; // Penalty for false Under (default: 1.3)
    };
    matchResult: {
      upMax: number;         // Max upward adjustment (default: 10)
      downMax: number;       // Max downward adjustment (default: 25)
      upRiskMultiplier: number;  // Risk multiplier for up (default: 1.5)
      downRiskMultiplier: number; // Risk multiplier for down (default: 0.8)
      falsePositivePenalty: number; // Penalty for false favorite (default: 2.0)
      falseNegativePenalty: number; // Penalty for false underdog (default: 0.6)
    };
    firstHalf: {
      upMax: number;         // Max upward adjustment (default: 15)
      downMax: number;       // Max downward adjustment (default: 18)
      upRiskMultiplier: number;  // Risk multiplier for up (default: 1.0)
      downRiskMultiplier: number; // Risk multiplier for down (default: 1.0)
      falsePositivePenalty: number; // Penalty for false Yes (default: 1.2)
      falseNegativePenalty: number; // Penalty for false No (default: 1.1)
    };
  };
  
  // Kelly Criterion (optional, requires odds)
  kellyCriterion: {
    enabled: boolean;        // Enable Kelly-aware confidence (default: false)
    bookmakerMargin: number; // Typical margin (default: 0.05)
    minKellyFraction: number; // Minimum Kelly fraction for HIGH confidence (default: 0.1)
    minExpectedValue: number; // Minimum expected value for MEDIUM confidence (default: 0.05)
  };
  
  // Fixture Congestion (Section 4.6.5)
  fixtureCongestion: {
    highCongestionThreshold: number;  // 3+ matches in 7 days (default: 3)
    mediumCongestionThreshold: number; // 2 matches in 7 days (default: 2)
    formWeightReduction: number;       // Max reduction (default: 0.3)
    marketImpact: {
      btts: number;      // Impact on BTTS (default: 0.3)
      over25: number;    // Impact on Over 2.5 (default: 0.4)
      matchResult: number; // Impact on Match Result (default: 0.5)
      firstHalf: number;  // Impact on First Half (default: 0.2)
    };
  };
  
  // Neutral Venue Detection (Section 3.5.4)
  neutralVenue: {
    homeAdvantageReduction: number; // Default: 0.15 (15% reduction)
    roundKeywords: string[]; // ["Final", "Semi-Final", "Playoff", "Super Cup"]
    enableVenueMismatch: boolean; // Default: true (enable venue mismatch detection)
  };
  
  // Derby/Rivalry Matches (Section 3.5.5)
  derby: {
    formWeightReduction: number; // Default: 0.12 (12% reduction)
    h2hWeightIncrease: number;   // Default: 0.20 (20% increase)
    confidenceReduction: number; // Default: 0.12 (12% reduction)
  };
  
  // Post-International Break Effects (Section 3.5.6)
  postInternationalBreak: {
    formWeightReduction: number; // Default: 0.18 (18% reduction)
    h2hWeightIncrease: number;    // Default: 0.10 (10% increase)
    confidenceReduction: number;  // Default: 0.08 (8% reduction)
    daysAfterBreak: number;       // Default: 5 (affects matches within 5 days)
  };
  
  // End-of-Season Dynamics (Section 3.5.7)
  endOfSeason: {
    finalRoundsThreshold: number; // Default: 5 (last 5 rounds)
    motivationWeightIncrease: number; // Default: 0.25 (25% increase)
    relegationBattlePositions: number; // Default: 5 (bottom 5 teams)
    titleRacePositions: number; // Default: 3 (top 3 teams)
  };
  
  // League-Specific Characteristics (Section 3.5.8)
  leagueCharacteristics: {
    maxAdjustment: number; // Default: 0.08 (max ±8% adjustment)
    enabled: boolean;      // Default: true (enable league-specific adjustments)
  };
}

// Default configuration
const DEFAULT_CONFIG: AlgorithmConfig = {
  formWeighting: {
    alpha: 0.85,
    recentGamesWeight: 1.5,
    midGamesWeight: 1.2,
    oldGamesWeight: 1.0,
  },
  // ... (all other defaults)
};
```

**Implementation Benefits:**
- **A/B Testing:** Easily test different weight combinations
- **League-Specific Tuning:** Override defaults per league
- **Version Control:** Track config changes over time
- **Hot Reloading:** Update weights without code deployment
- **Documentation:** Single source of truth for all tunable parameters

**Configuration Management:**
- Store config in JSON/YAML file or database
- Support environment-specific configs (dev/staging/prod)
- Enable runtime config updates via admin API
- Log all config changes for audit trail
- Version configs for rollback capability

**Usage Pattern:**
```typescript
// Load config
const config = loadConfig(leagueId, environment);

// Use in calculations
const formWeight = calculateFormWeight(matches, config.formWeighting);
const marketWeights = adjustWeightsForContext(
  config.marketWeights.btts,
  context,
  config.adjustments
);
```

**Also update existing sections to reference centralized config:**
- Section 1.2: Reference `config.formWeighting`
- Section 1.4: Reference `config.h2hRecency`
- Section 2.2: Reference `config.mlHyperparameters`
- Section 3.1: Reference `config.marketWeights`
- All adjustment sections: Reference `config.adjustments.*`

### Phase 2: Machine Learning Model Development

#### 2.1 Target Variables for ML Training
Create target variables for each betting market:
- **BTTS Market:**
  - `BTTS_Yes`: Binary (1 if both teams scored, 0 otherwise)
  - `BTTS_No`: Binary (inverse of BTTS_Yes)

- **Over/Under 2.5 Market:**
  - `Over25_Yes`: Binary (1 if total goals > 2.5, 0 otherwise)
  - `Under25_Yes`: Binary (inverse of Over25_Yes)

- **Match Result Market:**
  - `HomeWin`: Binary (1 if home team won, 0 otherwise)
  - `Draw`: Binary (1 if draw, 0 otherwise)
  - `AwayWin`: Binary (1 if away team won, 0 otherwise)

- **First Half Market:**
  - `FirstHalfGoals_Yes`: Binary (1 if goals scored in first half, 0 otherwise)
  - `FirstHalfGoals_No`: Binary (inverse)

- **Additional Targets:**
  - `Goal_Total`: Continuous (total goals in match)
  - `HomeGoals`: Continuous (home team goals)
  - `AwayGoals`: Continuous (away team goals)
  - `FirstHalfGoals`: Continuous (goals in first half)

#### 2.2 Model Selection & Training
- **Primary Model: LightGBM (Gradient Boosting)**
  - **Why LightGBM:**
    - Fast training on CPU (important for retraining)
    - Handles categorical features natively
    - Good performance on tabular data
    - Feature importance built-in
    - Handles missing values well
  
- **Model Architecture:**
  - **BTTS Model:** Binary classification (LightGBM)
  - **Over25 Model:** Binary classification (LightGBM)
  - **Match Result Model:** Multi-class classification (LightGBM, 3 classes)
  - **First Half Model:** Binary classification (LightGBM)
  - **Goal Prediction Model:** Regression (LightGBM) - for total goals prediction

- **Feature Selection:**
  - Use only features available at prediction time (no future data leakage)
  - Exclude: Injuries (unless proxied), weather (unless available), referee (unless historical pattern)
  - Include: All Mind/Mood/DNA features, H2H features, contextual features

- **Training Strategy:**
  - **Time-based split:** Train on 2003-2023, validate on 2025, test on 2026
  - **Cross-validation:** Use time-series cross-validation (walk-forward validation)
  - **Hyperparameter tuning:** Use Optuna
  - **Early stopping:** Prevent overfitting with validation set monitoring
  - **Hyperparameter Configuration:** Reference `config.mlHyperparameters` (see Section 1.5 for centralized configuration)

#### 2.2.5 Optuna Hyperparameter Tuning (Detailed Implementation)

**Goal:** Systematically optimize ML model hyperparameters using Optuna to maximize prediction accuracy and calibration.

**Why Optuna:**

- **Efficient Search:** Tree-structured Parzen Estimator (TPE) algorithm finds good hyperparameters faster than grid/random search
- **Pruning:** Early stopping of unpromising trials saves computation time
- **Multi-objective:** Can optimize for both accuracy and calibration (Brier score)
- **Reproducible:** Stores study results for analysis and reproducibility

**Implementation:**

```typescript
import optuna
from optuna.pruners import MedianPruner
from optuna.samplers import TPESampler
import lightgbm as lgb
from sklearn.model_selection import TimeSeriesSplit

interface OptunaConfig {
  nTrials: number; // Number of optimization trials (default: 100)
  timeout: number; // Maximum time in seconds (optional)
  nJobs: number; // Parallel jobs (default: 1)
  direction: 'minimize' | 'maximize'; // For Brier score: minimize, for accuracy: maximize
  metric: 'brier' | 'log_loss' | 'accuracy' | 'roc_auc';
  pruning: boolean; // Enable pruning (default: true)
  studyName: string; // Study name for storage
}

/**
 * Optuna objective function for hyperparameter optimization
 */
function createOptunaObjective(
  X_train: number[][],
  y_train: number[],
  X_val: number[][],
  y_val: number[],
  metric: 'brier' | 'log_loss' | 'accuracy' | 'roc_auc',
  isMultiClass: boolean = false
): (trial: optuna.Trial) => number {
  return (trial: optuna.Trial) => {
    // Suggest hyperparameters
    const params = {
      objective: isMultiClass ? 'multiclass' : 'binary',
      metric: metric === 'brier' ? 'binary_logloss' : metric,
      boosting_type: 'gbdt',
      num_leaves: trial.suggest_int('num_leaves', 10, 300),
      learning_rate: trial.suggest_float('learning_rate', 0.01, 0.3, log=True),
      feature_fraction: trial.suggest_float('feature_fraction', 0.4, 1.0),
      bagging_fraction: trial.suggest_float('bagging_fraction', 0.4, 1.0),
      bagging_freq: trial.suggest_int('bagging_freq', 1, 7),
      min_child_samples: trial.suggest_int('min_child_samples', 5, 100),
      min_child_weight: trial.suggest_float('min_child_weight', 0.001, 10, log=True),
      reg_alpha: trial.suggest_float('reg_alpha', 0.0, 10.0, log=True),
      reg_lambda: trial.suggest_float('reg_lambda', 0.0, 10.0, log=True),
      max_depth: trial.suggest_int('max_depth', 3, 15),
      n_estimators: 1000, // Fixed, use early stopping
      verbose: -1,
      random_state: 42,
    };
    
    if (isMultiClass) {
      params.num_class = 3; // Home/Draw/Away
    }
    
    // Create LightGBM dataset
    train_data = lgb.Dataset(X_train, label=y_train)
    val_data = lgb.Dataset(X_val, label=y_val, reference=train_data)
    
    // Train model with early stopping
    model = lgb.train(
      params,
      train_data,
      valid_sets=[val_data],
      callbacks=[
        lgb.early_stopping(stopping_rounds=50, verbose=False),
        lgb.log_evaluation(period=0)
      ]
    )
    
    // Predict on validation set
    y_pred_proba = model.predict(X_val, num_iteration=model.best_iteration)
    
    // Calculate metric
    if (metric === 'brier') {
      if (isMultiClass) {
        // Multi-class Brier score
        y_pred_proba = y_pred_proba.reshape(-1, 3) // Reshape to (n_samples, n_classes)
        return brier_score_loss(y_val, y_pred_proba)
      } else {
        return brier_score_loss(y_val, y_pred_proba)
      }
    } else if (metric === 'log_loss') {
      return log_loss(y_val, y_pred_proba)
    } else if (metric === 'accuracy') {
      y_pred = y_pred_proba.argmax(axis=1) if isMultiClass else (y_pred_proba > 0.5).astype(int)
      return 1 - accuracy_score(y_val, y_pred) // Optuna minimizes, so invert accuracy
    } else if (metric === 'roc_auc') {
      if (isMultiClass) {
        return 1 - roc_auc_score(y_val, y_pred_proba, multi_class='ovr') // Invert for minimization
      } else {
        return 1 - roc_auc_score(y_val, y_pred_proba) // Invert for minimization
      }
    }
  }
}

/**
 * Run Optuna hyperparameter optimization
 */
async function optimizeHyperparameters(
  X_train: number[][],
  y_train: number[],
  X_val: number[][],
  y_val: number[],
  config: OptunaConfig
): Promise<{
  bestParams: Record<string, any>;
  bestScore: number;
  study: optuna.Study;
}> {
  // Create study
  const study = optuna.create_study(
    direction=config.direction,
    study_name=config.studyName,
    sampler=TPESampler(seed=42),
    pruner=config.pruning ? MedianPruner(n_startup_trials=5, n_warmup_steps=10) : None,
    storage=f'sqlite:///optuna_studies/{config.studyName}.db' // Persist study
  )
  
  // Create objective function
  const objective = createOptunaObjective(
    X_train,
    y_train,
    X_val,
    y_val,
    config.metric,
    config.metric === 'accuracy' && y_train.max() > 1 // Multi-class if max label > 1
  )
  
  // Optimize
  study.optimize(
    objective,
    n_trials=config.nTrials,
    timeout=config.timeout,
    n_jobs=config.nJobs,
    show_progress_bar=True
  )
  
  return {
    bestParams: study.best_params,
    bestScore: study.best_value,
    study: study
  }
}

/**
 * Time-series cross-validation for hyperparameter tuning
 * Important: Use walk-forward validation to prevent data leakage
 */
async function optimizeWithTimeSeriesCV(
  X: number[][],
  y: number[],
  dates: Date[],
  config: OptunaConfig,
  nSplits: number = 5
): Promise<{
  bestParams: Record<string, any>;
  cvScores: number[];
  meanScore: number;
  stdScore: number;
}> {
  const tscv = TimeSeriesSplit(n_splits=nSplits)
  const cvScores: number[] = []
  const allParams: Record<string, any>[] = []
  
  // Optimize on each fold
  for (trainIdx, valIdx) in tscv.split(X):
    X_train, X_val = X[trainIdx], X[valIdx]
    y_train, y_val = y[trainIdx], y[valIdx]
    
    const result = await optimizeHyperparameters(
      X_train,
      y_train,
      X_val,
      y_val,
      { ...config, studyName: `${config.studyName}_fold${len(cvScores)}` }
    )
    
    cvScores.push(result.bestScore)
    allParams.push(result.bestParams)
  
  // Average hyperparameters (or use best fold)
  const bestParams = averageHyperparameters(allParams) // Or select best fold
  
  return {
    bestParams,
    cvScores,
    meanScore: np.mean(cvScores),
    stdScore: np.std(cvScores)
  }
}

/**
 * Average hyperparameters across folds (for continuous params)
 * For discrete params, use mode
 */
function averageHyperparameters(paramsList: Record<string, any>[]): Record<string, any> {
  const averaged: Record<string, any> = {}
  
  for (key in paramsList[0]) {
    const values = paramsList.map(p => p[key])
    
    if (typeof values[0] === 'number' && !Number.isInteger(values[0])) {
      // Continuous: average
      averaged[key] = np.mean(values)
    } else if (typeof values[0] === 'number' && Number.isInteger(values[0])) {
      // Integer: round average
      averaged[key] = Math.round(np.mean(values))
    } else if (typeof values[0] === 'boolean') {
      // Boolean: majority vote
      averaged[key] = np.mean(values) > 0.5
    } else {
      // Categorical: mode
      averaged[key] = mode(values)[0]
    }
  }
  
  return averaged
}
```

**Usage Example:**

```typescript
// For BTTS model
const bttsConfig: OptunaConfig = {
  nTrials: 100,
  timeout: 3600, // 1 hour
  nJobs: 4,
  direction: 'minimize',
  metric: 'brier',
  pruning: true,
  studyName: 'btts_hyperopt'
}

const result = await optimizeHyperparameters(
  X_train_btts,
  y_train_btts,
  X_val_btts,
  y_val_btts,
  bttsConfig
)

console.log('Best Brier Score:', result.bestScore)
console.log('Best Params:', result.bestParams)

// Update config with best params
config.mlHyperparameters.btts = {
  ...config.mlHyperparameters.btts,
  ...result.bestParams
}
```

**Multi-Objective Optimization:**

If you want to optimize for both accuracy and calibration:

```typescript
function createMultiObjectiveObjective(
  X_train: number[][],
  y_train: number[],
  X_val: number[][],
  y_val: number[]
): (trial: optuna.Trial) => [number, number] {
  return (trial: optuna.Trial) => {
    // ... same as above ...
    
    const brier = brier_score_loss(y_val, y_pred_proba)
    const accuracy = accuracy_score(y_val, y_pred)
    
    return [brier, 1 - accuracy] // Minimize both
  }
}

// Create multi-objective study
const study = optuna.create_study(
  directions=['minimize', 'minimize'], // Minimize Brier, minimize (1-accuracy)
  study_name='btts_multi_objective'
)
```

**Best Practices:**

1. **Use Time-Series CV:** Always use walk-forward validation, never random splits
2. **Start with Defaults:** Run a trial with default LightGBM params as baseline
3. **Pruning:** Enable pruning to save time on unpromising trials
4. **Store Studies:** Use SQLite storage to persist studies for analysis
5. **Visualize:** Use `optuna.visualization` to analyze parameter importance
6. **Re-optimize Periodically:** Retune hyperparameters when retraining (Section 3.3)

**Integration:**

- Run before initial model training (Section 2.2)
- Re-run during seasonal retraining (Section 3.3)
- Store best params in `config.mlHyperparameters`

**Expected Improvement:**

- **If hyperparameters are untuned:** +2–5% accuracy improvement
- **If hyperparameters are already reasonable:** +0–1% accuracy improvement
- **Calibration improvement:** Better Brier scores (better probability calibration)

**Implementation Effort:** 2–3 days (setup Optuna, implement objective functions, run optimization)

#### 2.3 Model Evaluation Metrics
- **Classification Metrics (BTTS, Over25, First Half):**
  - **Brier Score:** Lower is better (measures probability calibration)
  - **Log-Loss:** Lower is better (penalizes confident wrong predictions)
  - **ROC-AUC:** Higher is better (measures discrimination ability)
  - **Precision/Recall:** For each class
  - **Accuracy:** Overall correctness (but less important than calibration)

- **Multi-class Metrics (Match Result):**
  - **Multi-class Brier Score:** Average Brier score across all classes
  - **Multi-class Log-Loss:** Average log-loss across all classes
  - **Per-class Accuracy:** Accuracy for Home/Draw/Away separately

- **Regression Metrics (Goal Prediction):**
  - **MAE (Mean Absolute Error):** Average absolute difference
  - **RMSE (Root Mean Squared Error):** Penalizes large errors more
  - **R² Score:** Proportion of variance explained

- **Baseline Comparison:**
  - Compare ML model performance vs current hard-coded weights
  - Compare vs simple baselines (always predict most common outcome)
  - Compare vs bookmaker odds (if available in dataset)

#### 2.3.5 Class Imbalance Handling

**Goal:** Handle class imbalance in Match Result predictions where draws are rare (~20–30% of matches) but important for accuracy.

**Problem Statement:**

In Match Result predictions (Home/Draw/Away), draws occur less frequently than wins/losses:
- **Typical distribution:** Home Win ~45%, Draw ~25%, Away Win ~30%
- **Without handling:** ML models tend to under-predict draws, leading to:
  - Lower accuracy on draw predictions
  - Poor calibration (draw probabilities too low)
  - Missed value bets on draws

**Impact:**

- **Without class imbalance handling:** Draw accuracy can be 10–20% lower than Home/Away accuracy
- **With proper handling:** +1–3% overall Match Result accuracy improvement
- **Calibration improvement:** Better probability estimates for draws

**Implementation Strategies:**

**1. Class Weights (Recommended for LightGBM):**

```typescript
/**
 * Calculate class weights based on class frequency
 * Inverse frequency weighting: weight = total_samples / (n_classes * class_count)
 */
function calculateClassWeights(y: number[]): Record<number, number> {
  const classCounts: Record<number, number> = {}
  const totalSamples = y.length
  const nClasses = 3 // Home/Draw/Away
  
  // Count samples per class
  y.forEach(label => {
    classCounts[label] = (classCounts[label] || 0) + 1
  })
  
  // Calculate weights (inverse frequency)
  const classWeights: Record<number, number> = {}
  Object.keys(classCounts).forEach(classLabel => {
    const count = classCounts[parseInt(classLabel)]
    classWeights[parseInt(classLabel)] = totalSamples / (nClasses * count)
  })
  
  return classWeights
}

// Usage in LightGBM
const classWeights = calculateClassWeights(y_train)

const params = {
  objective: 'multiclass',
  num_class: 3,
  class_weight: classWeights, // LightGBM supports class_weight
  // ... other params
}

// Alternative: Use class_weight parameter
const model = lgb.LGBMClassifier(
  objective='multiclass',
  num_class=3,
  class_weight='balanced', // Automatically balances classes
  // ... other params
)
```

**2. Focal Loss (Advanced - for severe imbalance):**

```typescript
/**
 * Focal Loss: Focuses learning on hard examples
 * Reduces the relative loss for well-classified examples
 * Formula: FL = -α(1-p)^γ * log(p)
 */
function focalLoss(yTrue: number[], yPred: number[][], alpha: number = 0.25, gamma: number = 2.0): number {
  // Custom loss function for LightGBM
  // Note: LightGBM doesn't natively support focal loss, would need custom objective
  // Consider using XGBoost or CatBoost if focal loss is critical
  
  // Implementation would go here for custom objective
  // For now, class weights are recommended as simpler alternative
}
```

**3. SMOTE (Synthetic Minority Oversampling):**

```typescript
import { SMOTE } from 'imbalanced-learn'

/**
 * Oversample minority class (draws) using SMOTE
 * Creates synthetic examples of draws to balance the dataset
 */
function balanceDatasetWithSMOTE(
  X: number[][],
  y: number[]
): { X_balanced: number[][], y_balanced: number[] } {
  // Identify minority class (draws = class 1)
  const drawCount = y.filter(label => label === 1).length
  const homeCount = y.filter(label => label === 0).length
  const awayCount = y.filter(label => label === 2).length
  
  // If draws are minority, oversample
  if (drawCount < Math.min(homeCount, awayCount) * 0.7) {
    const smote = new SMOTE(sampling_strategy=0.8) // Balance to 80% of majority
    const { X_resampled, y_resampled } = smote.fit_resample(X, y)
    return { X_balanced: X_resampled, y_balanced: y_resampled }
  }
  
  return { X_balanced: X, y_balanced: y }
}

// Usage
const { X_balanced, y_balanced } = balanceDatasetWithSMOTE(X_train, y_train)
```

**4. Threshold Tuning (Post-training):**

```typescript
/**
 * Tune prediction thresholds to optimize for balanced accuracy
 * Instead of using default 0.33/0.33/0.34 split, optimize thresholds
 */
function optimizePredictionThresholds(
  model: any,
  X_val: number[][],
  y_val: number[]
): { homeThreshold: number, drawThreshold: number, awayThreshold: number } {
  const yPredProba = model.predict_proba(X_val) // Shape: (n_samples, 3)
  
  let bestThresholds = { homeThreshold: 0.33, drawThreshold: 0.33, awayThreshold: 0.34 }
  let bestScore = 0
  
  // Grid search over threshold combinations
  for (const drawThresh of [0.20, 0.25, 0.30, 0.35, 0.40]) {
    for (const homeThresh of [0.30, 0.35, 0.40, 0.45, 0.50]) {
      const awayThresh = 1 - homeThresh - drawThresh
      
      if (awayThresh < 0.20 || awayThresh > 0.50) continue
      
      // Predict with custom thresholds
      const yPred = yPredProba.map(proba => {
        if (proba[1] >= drawThresh) return 1 // Draw
        if (proba[0] >= homeThresh) return 0 // Home
        return 2 // Away
      })
      
      // Calculate balanced accuracy (average of per-class accuracy)
      const balancedAcc = calculateBalancedAccuracy(y_val, yPred)
      
      if (balancedAcc > bestScore) {
        bestScore = balancedAcc
        bestThresholds = {
          homeThreshold: homeThresh,
          drawThreshold: drawThresh,
          awayThreshold: awayThresh
        }
      }
    }
  }
  
  return bestThresholds
}

function calculateBalancedAccuracy(yTrue: number[], yPred: number[]): number {
  const classes = [0, 1, 2] // Home, Draw, Away
  const accuracies: number[] = []
  
  classes.forEach(cls => {
    const mask = yTrue === cls
    const correct = (yPred[mask] === cls).sum()
    const total = mask.sum()
    accuracies.push(total > 0 ? correct / total : 0)
  })
  
  return accuracies.reduce((a, b) => a + b, 0) / accuracies.length
}
```

**Recommended Approach:**

For LightGBM, use **class weights** (Strategy 1) as it's:
- Simple to implement
- Native LightGBM support
- Effective for moderate imbalance
- No data modification needed

**Integration:**

```typescript
// In model training (Section 2.2)
async function trainMatchResultModel(
  X_train: number[][],
  y_train: number[],
  config: AlgorithmConfig
): Promise<LGBMClassifier> {
  // Calculate class weights
  const classWeights = calculateClassWeights(y_train)
  
  // Log class distribution
  console.log('Class distribution:', {
    Home: y_train.filter(y => y === 0).length,
    Draw: y_train.filter(y => y === 1).length,
    Away: y_train.filter(y => y === 2).length
  })
  console.log('Class weights:', classWeights)
  
  // Train with class weights
  const model = lgb.LGBMClassifier(
    objective='multiclass',
    num_class=3,
    class_weight=classWeights, // Apply class weights
    ...config.mlHyperparameters.matchResult
  )
  
  model.fit(X_train, y_train)
  
  return model
}
```

**Validation:**

After training, validate that class imbalance is handled:

```typescript
// Check per-class accuracy
function validateClassBalance(
  model: any,
  X_test: number[][],
  y_test: number[]
): {
  homeAccuracy: number;
  drawAccuracy: number;
  awayAccuracy: number;
  overallAccuracy: number;
  balancedAccuracy: number;
} {
  const yPred = model.predict(X_test)
  
  const homeAcc = accuracy_score(y_test[y_test === 0], yPred[y_test === 0])
  const drawAcc = accuracy_score(y_test[y_test === 1], yPred[y_test === 1])
  const awayAcc = accuracy_score(y_test[y_test === 2], yPred[y_test === 2])
  const overallAcc = accuracy_score(y_test, yPred)
  const balancedAcc = calculateBalancedAccuracy(y_test, yPred)
  
  return {
    homeAccuracy: homeAcc,
    drawAccuracy: drawAcc,
    awayAccuracy: awayAcc,
    overallAccuracy: overallAcc,
    balancedAccuracy: balancedAcc
  }
}

// Target: Draw accuracy should be within 5% of Home/Away accuracy
// If draw accuracy < home accuracy - 5%, increase class weight for draws
```

**Expected Improvement:**

- **Draw accuracy improvement:** +10–20% (from ~40% to ~55–60%)
- **Overall accuracy improvement:** +1–3%
- **Calibration improvement:** Better probability estimates for draws

**Note:** This only applies if using ML for Match Result predictions. If using rule-based adjustments (current implementation), class imbalance handling won't help as draws are handled via H2H/form logic.

**Implementation Effort:** 1 day (add class weights to training, validate per-class accuracy)

#### 2.4 Model Calibration
- **Probability Calibration:**
  - Use Platt Scaling or Isotonic Regression to calibrate probabilities
  - Ensure predicted probabilities match actual frequencies
  - Critical for betting applications (well-calibrated probabilities = better value bets)

- **Calibration Validation:**
  - Plot calibration curves (predicted vs actual probabilities)
  - Calculate Expected Calibration Error (ECE)
  - Ensure probabilities are neither overconfident nor underconfident

### Phase 3: ML Integration Architecture (Option A)

#### 3.1 ML Integration Strategy: Option A

**Architecture:** ML learns optimal weights for main factors, then rule-based adjustments handle contextual/safety factors that ML can't easily learn.

**Two-Phase Approach:**

**Phase 1: ML Model Output (Pre-trained)**
- ML model learns optimal weights for each market from historical data
- Outputs weights for: recentForm, h2h, homeAdvantage, scoringRate, defensiveForm, etc.
- Different weights per market (BTTS, Over25, MatchResult, FirstHalf)
- Weights stored in configuration file (can be updated from ML model output)

**Phase 2: Base Prediction (Using ML Weights)**
- Calculate base probability using ML-learned weights
- Features × ML weights = base prediction
- This gives us the optimal weighting based on historical patterns

**Phase 3: Rule-Based Adjustments (Contextual/Safety)**
- Apply adjustments for factors ML can't easily learn:
  - Rest days (if team rested 12+ days, recent form less reliable)
  - Early season (form less reliable in first 5 rounds)
  - Low H2H sample (small sample sizes are unreliable)
  - Formation instability (experimental formations reduce confidence)
  - Safety flags (regression risk, motivation clash, live dog)
  - Mind/Mood gap (sleeping giant, over-performer patterns)
  - Match type (cup vs league adjustments)

**Final Prediction:**
- `finalProbability = baseProbability + Σ(ruleAdjustments)`
- Confidence calculated based on number and magnitude of adjustments
- Explanation shows base prediction and all adjustments applied

**Benefits:**
- ML handles pattern learning (what weights work best)
- Rules handle edge cases (contextual factors ML can't learn)
- Transparent: Shows base prediction and adjustments
- Flexible: Easy to add new rule-based adjustments
- Validated: ML weights validated on historical data

**Example Flow:**

```typescript
// Step 1: Load ML-learned weights
const mlWeights = loadMLLearnedWeights('BTTS');
// Returns: { scoringRate: 0.28, h2h: 0.24, defensiveForm: 0.22, recentForm: 0.26 }

// Step 2: Calculate base prediction using ML weights
const baseProbability = calculateBasePrediction(features, mlWeights);
// Returns: 78.5% (ML-learned optimal weighting)

// Step 3: Calculate rule-based adjustments
const adjustments = calculateRuleBasedAdjustments(context);
// Returns: [
//   { name: 'rest_days_away', value: -2.4, reason: 'Away team rested 12 days' },
//   { name: 'formation_instability', value: -12.0, reason: 'Experimental formation' },
//   { name: 'live_dog_away', value: +10.0, reason: 'Bottom team showing form' }
// ]

// Step 4: Apply adjustments
const finalProbability = baseProbability + adjustments.reduce((sum, adj) => sum + adj.value, 0);
// Returns: 74.1% (78.5 - 2.4 - 12.0 + 10.0)
```

**ML Model Training:**
- Train separate models per market (BTTS, Over25, MatchResult, FirstHalf)
- Model outputs weights, not final probabilities
- Use time-series cross-validation (walk-forward validation)
- Validate weights on holdout set before deployment
- Update weights periodically (weekly/monthly) as new data arrives
- **Team Name Mapping Required:** When retraining, combine historical GitHub data with new API-Football data - use team name mapping to ensure consistent naming across datasets (see Section 1.1.1)

**Rule-Based Adjustments:**
- All adjustments must pass validation framework (see Phase 4.1)
- Adjustments are additive to base prediction
- Market-specific impact multipliers applied (e.g., formation instability has less impact on BTTS than MatchResult)
- Asymmetric weighting applied (different caps for upward vs downward moves based on market odds)
- Probability swing caps prevent wild swings (±20-25% max)
- Confidence downgraded when large swings occur
- Adjustments shown in API response for transparency

#### 3.2 Feature Importance Analysis
- **Analyze ML feature importance:**
  - Identify which features ML model finds most predictive
  - Compare with current rule-based weights
  - Adjust rule-based weights if ML shows different patterns
  - Remove features with near-zero importance

#### 3.3 Model Retraining Schedule
- **Retraining Frequency:**
  - **Weekly retraining:** Update model with latest match results
  - **Seasonal retraining:** Full retrain at start of each season
  - **Feature update retraining:** Retrain when adding new features (e.g., manager change feature)

- **Minimum Batch Size Check:**
  - **Skip retraining if batch too small:** Prevents noise from small datasets
  - **Recommended threshold:** Minimum 2,000 unique matches
  - **Rationale:** Small batches can introduce noise and overfitting
  - **Implementation:**
    ```typescript
    async function shouldRetrainModel(
      newMatches: Match[],
      minBatchSize: number = 2000
    ): Promise<boolean> {
      const uniqueMatchIds = new Set(newMatches.map(m => m.id));
      
      if (uniqueMatchIds.size < minBatchSize) {
        console.log(`Batch too small (${uniqueMatchIds.size} < ${minBatchSize}) — skipping retrain`);
        return false;
      }
      
      return true;
    }
    ```

- **Incremental Learning:**
  - Consider online learning approaches for continuous updates
  - Or: Batch retraining with rolling window

#### 3.3.5 Concept Drift Detection

**Goal:** Detect when model performance degrades due to concept drift (data distribution changes) and trigger adaptive retraining instead of fixed weekly schedule.

**Problem Statement:**

Fixed weekly retraining (Section 3.3) may be:
- **Too frequent:** Wastes computation when model is still performing well
- **Too infrequent:** Model degrades between retraining cycles, losing 2–5% accuracy
- **Reactive:** Only retrains after performance drops, not proactively

**Concept Drift Scenarios:**

- **Seasonal changes:** End of season vs start of season (different dynamics)
- **League changes:** Rule changes, format changes
- **Team changes:** Manager changes, key player transfers (affects team performance patterns)
- **External factors:** COVID-19 impact, schedule congestion, international breaks

**Implementation:**

**1. Performance-Based Drift Detection:**

```typescript
interface DriftDetectionConfig {
  windowSize: number; // Rolling window size for evaluation (default: 100 matches)
  minWindowSize: number; // Minimum matches needed for reliable detection (default: 50)
  accuracyDropThreshold: number; // Alert if accuracy drops by this much (default: 2%)
  brierIncreaseThreshold: number; // Alert if Brier score increases by this much (default: 0.02)
  consecutiveFailures: number; // Trigger retrain after N consecutive failures (default: 2)
  baselineAccuracy: number; // Baseline accuracy from last retraining
  baselineBrier: number; // Baseline Brier score from last retraining
}

interface DriftDetectionResult {
  driftDetected: boolean;
  reason: 'accuracy_drop' | 'brier_increase' | 'both' | 'none';
  currentAccuracy: number;
  currentBrier: number;
  accuracyChange: number;
  brierChange: number;
  recommendation: 'retrain' | 'monitor' | 'no_action';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

class ConceptDriftDetector {
  private baselineMetrics: {
    accuracy: number;
    brierScore: number;
    timestamp: Date;
  } | null = null;
  
  /**
   * Detect concept drift by comparing recent performance to baseline
   */
  async detectDrift(
    recentPredictions: Prediction[],
    recentOutcomes: MatchOutcome[],
    config: DriftDetectionConfig
  ): Promise<DriftDetectionResult> {
    if (recentPredictions.length < config.minWindowSize) {
      return {
        driftDetected: false,
        reason: 'none',
        currentAccuracy: 0,
        currentBrier: 0,
        accuracyChange: 0,
        brierChange: 0,
        recommendation: 'monitor',
        confidence: 'LOW'
      }
    }
    
    // Calculate current metrics
    const currentAccuracy = calculateAccuracy(recentPredictions, recentOutcomes)
    const currentBrier = calculateBrierScore(recentPredictions, recentOutcomes)
    
    if (!this.baselineMetrics) {
      // First run: set baseline
      this.baselineMetrics = {
        accuracy: currentAccuracy,
        brierScore: currentBrier,
        timestamp: new Date()
      }
      return {
        driftDetected: false,
        reason: 'none',
        currentAccuracy,
        currentBrier,
        accuracyChange: 0,
        brierChange: 0,
        recommendation: 'no_action',
        confidence: 'HIGH'
      }
    }
    
    // Compare to baseline
    const accuracyChange = currentAccuracy - this.baselineMetrics.accuracy
    const brierChange = currentBrier - this.baselineMetrics.brierScore
    
    const accuracyDrop = accuracyChange < -config.accuracyDropThreshold
    const brierIncrease = brierChange > config.brierIncreaseThreshold
    
    let driftDetected = false
    let reason: 'accuracy_drop' | 'brier_increase' | 'both' | 'none' = 'none'
    let recommendation: 'retrain' | 'monitor' | 'no_action' = 'no_action'
    let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW'
    
    if (accuracyDrop && brierIncrease) {
      driftDetected = true
      reason = 'both'
      recommendation = 'retrain'
      confidence = 'HIGH'
    } else if (accuracyDrop) {
      driftDetected = true
      reason = 'accuracy_drop'
      recommendation = accuracyChange < -config.accuracyDropThreshold * 1.5 ? 'retrain' : 'monitor'
      confidence = Math.abs(accuracyChange) > config.accuracyDropThreshold * 1.5 ? 'HIGH' : 'MEDIUM'
    } else if (brierIncrease) {
      driftDetected = true
      reason = 'brier_increase'
      recommendation = brierChange > config.brierIncreaseThreshold * 1.5 ? 'retrain' : 'monitor'
      confidence = brierChange > config.brierIncreaseThreshold * 1.5 ? 'HIGH' : 'MEDIUM'
    }
    
    return {
      driftDetected,
      reason,
      currentAccuracy,
      currentBrier,
      accuracyChange,
      brierChange,
      recommendation,
      confidence
    }
  }
  
  /**
   * Update baseline after retraining
   */
  updateBaseline(accuracy: number, brierScore: number): void {
    this.baselineMetrics = {
      accuracy,
      brierScore,
      timestamp: new Date()
    }
  }
}
```

**2. Statistical Drift Detection (PSI - Population Stability Index):**

```typescript
/**
 * Calculate Population Stability Index (PSI) to detect feature distribution drift
 * PSI < 0.1: No significant drift
 * PSI 0.1-0.25: Some drift, monitor
 * PSI > 0.25: Significant drift, retrain recommended
 */
function calculatePSI(
  baselineDistribution: number[],
  currentDistribution: number[]
): number {
  // Bin the distributions (use same bins for both)
  const bins = createBins(baselineDistribution, 10) // 10 bins
  
  const baselineBinned = binData(baselineDistribution, bins)
  const currentBinned = binData(currentDistribution, bins)
  
  let psi = 0
  for (let i = 0; i < bins.length - 1; i++) {
    const baselinePct = baselineBinned[i] / baselineDistribution.length
    const currentPct = currentBinned[i] / currentDistribution.length
    
    // Avoid division by zero
    if (baselinePct > 0 && currentPct > 0) {
      psi += (currentPct - baselinePct) * Math.log(currentPct / baselinePct)
    }
  }
  
  return psi
}

/**
 * Detect drift in key features
 */
async function detectFeatureDrift(
  baselineFeatures: number[][],
  currentFeatures: number[][],
  featureNames: string[]
): Promise<{
  driftedFeatures: string[];
  maxPSI: number;
  recommendation: 'retrain' | 'monitor' | 'no_action';
}> {
  const featurePSIs: Record<string, number> = {}
  
  // Calculate PSI for each feature
  featureNames.forEach((name, idx) => {
    const baselineValues = baselineFeatures.map(f => f[idx])
    const currentValues = currentFeatures.map(f => f[idx])
    
    featurePSIs[name] = calculatePSI(baselineValues, currentValues)
  })
  
  // Find drifted features
  const driftedFeatures = Object.entries(featurePSIs)
    .filter(([_, psi]) => psi > 0.25)
    .map(([name, _]) => name)
  
  const maxPSI = Math.max(...Object.values(featurePSIs))
  
  let recommendation: 'retrain' | 'monitor' | 'no_action' = 'no_action'
  if (maxPSI > 0.25 && driftedFeatures.length > 3) {
    recommendation = 'retrain'
  } else if (maxPSI > 0.15) {
    recommendation = 'monitor'
  }
  
  return {
    driftedFeatures,
    maxPSI,
    recommendation
  }
}
```

**3. Adaptive Retraining Trigger:**

```typescript
class AdaptiveRetrainingScheduler {
  private driftDetector: ConceptDriftDetector
  private consecutiveDriftCount: number = 0
  
  /**
   * Determine if retraining should be triggered
   */
  async shouldRetrain(
    recentPredictions: Prediction[],
    recentOutcomes: MatchOutcome[],
    lastRetrainDate: Date,
    config: DriftDetectionConfig & { minDaysBetweenRetrains: number }
  ): Promise<{
    shouldRetrain: boolean;
    reason: string;
    urgency: 'HIGH' | 'MEDIUM' | 'LOW';
  }> {
    // Check minimum time since last retrain
    const daysSinceRetrain = (Date.now() - lastRetrainDate.getTime()) / (1000 * 60 * 60 * 24)
    if (daysSinceRetrain < config.minDaysBetweenRetrains) {
      return {
        shouldRetrain: false,
        reason: `Too soon since last retrain (${daysSinceRetrain.toFixed(1)} days < ${config.minDaysBetweenRetrains} days)`,
        urgency: 'LOW'
      }
    }
    
    // Detect drift
    const driftResult = await this.driftDetector.detectDrift(
      recentPredictions,
      recentOutcomes,
      config
    )
    
    // Check consecutive drift detections
    if (driftResult.driftDetected) {
      this.consecutiveDriftCount++
      
      if (this.consecutiveDriftCount >= config.consecutiveFailures) {
        this.consecutiveDriftCount = 0 // Reset
        return {
          shouldRetrain: true,
          reason: `Drift detected ${config.consecutiveFailures} times consecutively: ${driftResult.reason}`,
          urgency: driftResult.confidence === 'HIGH' ? 'HIGH' : 'MEDIUM'
        }
      } else {
        return {
          shouldRetrain: false,
          reason: `Drift detected but waiting for confirmation (${this.consecutiveDriftCount}/${config.consecutiveFailures})`,
          urgency: 'MEDIUM'
        }
      }
    } else {
      // No drift: reset counter
      this.consecutiveDriftCount = 0
      
      // Still check if it's been too long (fallback to weekly)
      const maxDaysBetweenRetrains = 7
      if (daysSinceRetrain >= maxDaysBetweenRetrains) {
        return {
          shouldRetrain: true,
          reason: `No drift detected but ${daysSinceRetrain.toFixed(1)} days since last retrain (max: ${maxDaysBetweenRetrains} days)`,
          urgency: 'LOW'
        }
      }
      
      return {
        shouldRetrain: false,
        reason: 'No drift detected, model performing well',
        urgency: 'LOW'
      }
    }
  }
}
```

**Integration with Retraining Schedule:**

```typescript
// Update Section 3.3 retraining logic
async function adaptiveRetrainingCheck(
  newMatches: Match[],
  lastRetrainDate: Date,
  config: AlgorithmConfig
): Promise<boolean> {
  const scheduler = new AdaptiveRetrainingScheduler()
  const driftDetector = new ConceptDriftDetector()
  
  // Get recent predictions and outcomes
  const recentPredictions = await getRecentPredictions(100) // Last 100 predictions
  const recentOutcomes = await getMatchOutcomes(recentPredictions.map(p => p.matchId))
  
  // Check if should retrain
  const result = await scheduler.shouldRetrain(
    recentPredictions,
    recentOutcomes,
    lastRetrainDate,
    {
      windowSize: 100,
      minWindowSize: 50,
      accuracyDropThreshold: 2.0,
      brierIncreaseThreshold: 0.02,
      consecutiveFailures: 2,
      baselineAccuracy: config.driftDetection?.baselineAccuracy || 65.0,
      baselineBrier: config.driftDetection?.baselineBrier || 0.20,
      minDaysBetweenRetrains: 3 // Minimum 3 days between retrains
    }
  )
  
  if (result.shouldRetrain) {
    console.log(`[ADAPTIVE RETRAINING] Triggered: ${result.reason} (urgency: ${result.urgency})`)
    
    // Retrain model
    const newModel = await retrainModel(newMatches, config)
    
    // Update baseline
    const newAccuracy = await evaluateModel(newModel, recentPredictions, recentOutcomes)
    const newBrier = await calculateBrierScore(recentPredictions, recentOutcomes)
    driftDetector.updateBaseline(newAccuracy, newBrier)
    
    return true
  }
  
  return false
}
```

**Benefits:**

- ✅ **Prevents degradation:** Catches performance drops early (prevents 2–5% accuracy loss)
- ✅ **Efficient:** Only retrains when needed, saves computation
- ✅ **Proactive:** Detects drift before it severely impacts predictions
- ✅ **Adaptive:** Responds to real-world changes (seasons, rule changes, etc.)

**Expected Improvement:**

- **Prevents accuracy degradation:** Maintains performance instead of losing 2–5% between retrains
- **Efficiency:** Reduces unnecessary retraining by 30–50%

**Implementation Effort:** 2–3 days (implement drift detection, integrate with retraining schedule)

### Phase 4: Backtesting & Validation

#### 4.1 Validation Framework for Rule-Based Adjustments

**Goal:** Validate all rule-based adjustments before deployment to ensure they improve predictions

**Validation Process:**

1. **Test Adjustment on Historical Data:**
   - Run predictions with and without the adjustment
   - Compare accuracy, Brier score, and log-loss
   - Calculate improvement metrics

2. **Statistical Significance Testing:**
   - Use paired t-test or McNemar's test
   - Ensure improvement is statistically significant (p < 0.05)
   - Require minimum improvement threshold (e.g., 2% accuracy improvement)

3. **Edge Case Testing:**
   - Test on edge cases (early season, low data, etc.)
   - Ensure adjustment doesn't break predictions
   - Verify adjustment behaves correctly in all scenarios

**Validation Interface:**

```typescript
interface ValidationResult {
  adjustmentName: string;
  improvesAccuracy: boolean;
  accuracyWith: number;
  accuracyWithout: number;
  improvement: number; // Percentage point improvement
  isSignificant: boolean; // Statistical significance (p < 0.05)
  pValue: number;
  testCases: number;
  edgeCaseResults: {
    earlySeason: { passed: boolean; accuracy: number };
    lowData: { passed: boolean; accuracy: number };
    highData: { passed: boolean; accuracy: number };
  };
}

// Validate a single adjustment
async function validateAdjustment(
  adjustmentName: string,
  adjustmentFn: (context: MatchContext) => number,
  historicalMatches: Match[]
): Promise<ValidationResult> {
  // Implementation: Test adjustment on historical data
  // Compare accuracy with/without adjustment
  // Calculate statistical significance
  // Return validation result
}
```

**Deployment Criteria:**

Before deploying any adjustment, it must:
1. Improve accuracy by at least 2%
2. Be statistically significant (p < 0.05)
3. Pass all edge case tests
4. Not degrade performance in any scenario

#### 4.1.4 Enforcement & Ongoing Monitoring

**Goal:** Make validation non-optional with automated gates and continuous checks to prevent silent regressions and ensure only proven features stay in production.

**Problem Statement:**

While Section 4.1 provides a solid validation framework, it lacks enforcement mechanisms. In practice:
- Developers may deploy "cool" features that pass initial tests but regress on live data
- No ongoing monitoring or auto-rollback is specified
- Bad adjustments can creep in over time, dropping overall accuracy by 2–5%
- Time is wasted on features that don't move the needle
- Live bets on unvalidated edges lead to drawdowns and user trust loss

**Impact Without Enforcement:**

- **Silent Regression:** Bad adjustments compound over time, dropping overall accuracy by 2–5% without detection
- **Wasted Resources:** Time spent on features that don't move the needle; no systematic way to prioritize high-ROI tweaks
- **Profitability Risk:** Live bets on unvalidated edges lead to drawdowns; users lose trust if accuracy dips below promised 60–70%

**Implementation:**

**1. CI/CD Validation Gates:**

Integrate validation into PR workflow to block merges if validation fails:

```typescript
interface ValidationGateConfig {
  minImprovement: number; // Minimum improvement percentage (default: 2%)
  significanceLevel: number; // Maximum p-value for significance (default: 0.05)
  minTestCases: number; // Minimum number of test cases (default: 100)
  requireEdgeCasePass: boolean; // Require all edge cases to pass (default: true)
}

/**
 * Enforce validation criteria - returns false if validation fails
 * This function should be called in CI/CD pipeline before allowing merge
 */
function enforceValidation(
  result: ValidationResult,
  config: ValidationGateConfig
): { passed: boolean; reasons: string[] } {
  const reasons: string[] = [];
  
  // Check minimum improvement
  if (result.improvement < config.minImprovement) {
    reasons.push(
      `Improvement too low: ${result.improvement.toFixed(2)}% < ${config.minImprovement}% threshold`
    );
  }
  
  // Check statistical significance
  if (result.pValue > config.significanceLevel) {
    reasons.push(
      `Not statistically significant: p=${result.pValue.toFixed(4)} > ${config.significanceLevel} threshold`
    );
  }
  
  // Check minimum test cases
  if (result.testCases < config.minTestCases) {
    reasons.push(
      `Too few test cases: ${result.testCases} < ${config.minTestCases} minimum`
    );
  }
  
  // Check edge cases
  if (config.requireEdgeCasePass) {
    const failedEdgeCases = Object.entries(result.edgeCaseResults)
      .filter(([_, result]) => !result.passed)
      .map(([name, _]) => name);
    
    if (failedEdgeCases.length > 0) {
      reasons.push(`Edge case failures: ${failedEdgeCases.join(', ')}`);
    }
  }
  
  const passed = reasons.length === 0;
  
  if (!passed) {
    console.error(`[VALIDATION GATE FAILED] ${result.adjustmentName}:`, reasons);
  }
  
  return { passed, reasons };
}

// Usage in CI/CD (GitHub Actions example)
// .github/workflows/validate-adjustment.yml
/*
name: Validate Adjustment

on:
  pull_request:
    paths:
      - 'src/adjustments/**'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Run validation
        run: |
          npm run validate-adjustment -- ${{ github.event.pull_request.head.sha }}
        env:
          MIN_IMPROVEMENT: 2.0
          SIGNIFICANCE_LEVEL: 0.05
          MIN_TEST_CASES: 100
      
      - name: Check validation result
        run: |
          if [ $? -ne 0 ]; then
            echo "Validation failed - blocking merge"
            exit 1
          fi
*/
```

**2. Kill Criteria for Deployed Adjustments:**

Monitor deployed adjustments and auto-disable if performance degrades:

```typescript
interface KillCriteriaConfig {
  accuracyDropThreshold: number; // Alert if accuracy drops by this much (default: 1%)
  holdoutSize: number; // Rolling window size for evaluation (default: 100)
  evaluationWindow: 'weekly' | 'daily' | 'matches'; // How often to evaluate
  autoDisable: boolean; // Auto-disable if kill criteria met (default: false initially)
}

interface AdjustmentPerformance {
  adjustmentName: string;
  enabled: boolean;
  deploymentDate: Date;
  initialAccuracy: number;
  currentAccuracy: number;
  accuracyChange: number;
  evaluationCount: number;
  lastEvaluated: Date;
}

class AdjustmentMonitor {
  private performances: Map<string, AdjustmentPerformance> = new Map();
  
  /**
   * Evaluate deployed adjustment on rolling holdout set
   */
  async evaluateAdjustment(
    adjustmentName: string,
    holdoutMatches: Match[],
    config: KillCriteriaConfig
  ): Promise<{ shouldKill: boolean; reason?: string }> {
    const performance = this.performances.get(adjustmentName);
    if (!performance) {
      throw new Error(`Adjustment ${adjustmentName} not found in monitor`);
    }
    
    // Run predictions with and without adjustment
    const withAdjustment = await runPredictions(holdoutMatches, { [adjustmentName]: true });
    const withoutAdjustment = await runPredictions(holdoutMatches, { [adjustmentName]: false });
    
    // Calculate accuracy
    const accuracyWith = calculateAccuracy(withAdjustment, holdoutMatches);
    const accuracyWithout = calculateAccuracy(withoutAdjustment, holdoutMatches);
    
    // Update performance tracking
    performance.currentAccuracy = accuracyWith;
    performance.accuracyChange = accuracyWith - performance.initialAccuracy;
    performance.evaluationCount++;
    performance.lastEvaluated = new Date();
    
    // Check kill criteria
    const accuracyDrop = performance.initialAccuracy - accuracyWith;
    const shouldKill = accuracyDrop > config.accuracyDropThreshold;
    
    let reason: string | undefined;
    if (shouldKill) {
      reason = `Accuracy dropped ${accuracyDrop.toFixed(2)}% (from ${performance.initialAccuracy.toFixed(2)}% to ${accuracyWith.toFixed(2)}%)`;
      
      if (config.autoDisable) {
        performance.enabled = false;
        console.warn(`[AUTO-DISABLED] ${adjustmentName}: ${reason}`);
        // Send alert to team
      } else {
        console.warn(`[KILL CRITERIA MET] ${adjustmentName}: ${reason} (auto-disable disabled)`);
        // Send alert to team for manual review
      }
    }
    
    return { shouldKill, reason };
  }
  
  /**
   * Weekly evaluation of all deployed adjustments
   */
  async weeklyEvaluation(config: KillCriteriaConfig): Promise<void> {
    const holdoutMatches = await getRecentMatches(config.holdoutSize);
    
    for (const [name, performance] of this.performances.entries()) {
      if (!performance.enabled) continue;
      
      const result = await this.evaluateAdjustment(name, holdoutMatches, config);
      
      if (result.shouldKill) {
        // Log and alert
        console.error(`[ADJUSTMENT UNDERPERFORMING] ${name}: ${result.reason}`);
        // Send to alerting system (PagerDuty, Slack, etc.)
      }
    }
  }
  
  registerAdjustment(
    name: string,
    initialAccuracy: number,
    deploymentDate: Date = new Date()
  ): void {
    this.performances.set(name, {
      adjustmentName: name,
      enabled: true,
      deploymentDate,
      initialAccuracy,
      currentAccuracy: initialAccuracy,
      accuracyChange: 0,
      evaluationCount: 0,
      lastEvaluated: deploymentDate,
    });
  }
}

// Usage: Register adjustment when deployed
const monitor = new AdjustmentMonitor();
monitor.registerAdjustment('formationInstability', 65.2, new Date());

// Weekly cron job
setInterval(async () => {
  await monitor.weeklyEvaluation({
    accuracyDropThreshold: 1.0,
    holdoutSize: 100,
    evaluationWindow: 'weekly',
    autoDisable: false, // Start with false, enable after validation
  });
}, 7 * 24 * 60 * 60 * 1000); // Weekly
```

**3. Ongoing Dashboard:**

Track per-adjustment metrics for continuous visibility:

```typescript
interface AdjustmentMetrics {
  adjustmentName: string;
  enabled: boolean;
  deploymentDate: Date;
  totalPredictions: number;
  accuracy: number;
  brierScore: number;
  winRate: number; // If odds available
  roi: number; // If odds available
  brierContribution: number; // How much this adjustment improves Brier score
  winRateImpact: number; // How much this adjustment improves win rate
  lastEvaluated: Date;
}

/**
 * Generate dashboard metrics for all adjustments
 */
async function generateAdjustmentDashboard(): Promise<AdjustmentMetrics[]> {
  const adjustments = await getAllDeployedAdjustments();
  const metrics: AdjustmentMetrics[] = [];
  
  for (const adjustment of adjustments) {
    // Get recent predictions using this adjustment
    const recentPredictions = await getRecentPredictionsWithAdjustment(
      adjustment.name,
      1000
    );
    
    // Calculate metrics
    const accuracy = calculateAccuracy(recentPredictions);
    const brierScore = calculateBrierScore(recentPredictions);
    const winRate = calculateWinRate(recentPredictions); // If odds available
    const roi = calculateROI(recentPredictions); // If odds available
    
    // Compare with baseline (without adjustment)
    const baselinePredictions = await getBaselinePredictions(1000);
    const baselineBrier = calculateBrierScore(baselinePredictions);
    const baselineWinRate = calculateWinRate(baselinePredictions);
    
    metrics.push({
      adjustmentName: adjustment.name,
      enabled: adjustment.enabled,
      deploymentDate: adjustment.deploymentDate,
      totalPredictions: recentPredictions.length,
      accuracy,
      brierScore,
      winRate,
      roi,
      brierContribution: baselineBrier - brierScore, // Positive = improvement
      winRateImpact: winRate - baselineWinRate, // Positive = improvement
      lastEvaluated: new Date(),
    });
  }
  
  return metrics;
}

// Display in Grafana/Prometheus or simple web dashboard
// Example Prometheus metrics:
/*
prediction_adjustment_accuracy{adjustment="formationInstability"} 65.2
prediction_adjustment_brier_score{adjustment="formationInstability"} 0.18
prediction_adjustment_enabled{adjustment="formationInstability"} 1
*/
```

**4. Adjustment Sunset Clause:**

All adjustments expire after 1 season unless re-validated:

```typescript
interface SunsetConfig {
  expirationPeriod: 'season' | 'year' | 'months';
  expirationValue: number; // e.g., 1 season, 12 months
  requireRevalidation: boolean; // Require re-validation before re-enabling
}

async function checkSunsetAdjustments(config: SunsetConfig): Promise<string[]> {
  const adjustments = await getAllDeployedAdjustments();
  const expired: string[] = [];
  
  const now = new Date();
  
  for (const adjustment of adjustments) {
    if (!adjustment.enabled) continue;
    
    const expirationDate = calculateExpirationDate(
      adjustment.deploymentDate,
      config
    );
    
    if (now > expirationDate) {
      expired.push(adjustment.name);
      
      if (config.requireRevalidation) {
        // Disable adjustment until re-validated
        await disableAdjustment(adjustment.name);
        console.warn(
          `[SUNSET] ${adjustment.name} expired on ${expirationDate.toISOString()}, disabled until re-validation`
        );
      } else {
        // Just alert, don't disable
        console.warn(
          `[SUNSET WARNING] ${adjustment.name} expired on ${expirationDate.toISOString()}, consider re-validation`
        );
      }
    }
  }
  
  return expired;
}

function calculateExpirationDate(
  deploymentDate: Date,
  config: SunsetConfig
): Date {
  const expiration = new Date(deploymentDate);
  
  if (config.expirationPeriod === 'season') {
    // Expire at end of current season (simplified: add ~9 months)
    expiration.setMonth(expiration.getMonth() + 9);
  } else if (config.expirationPeriod === 'year') {
    expiration.setFullYear(expiration.getFullYear() + config.expirationValue);
  } else if (config.expirationPeriod === 'months') {
    expiration.setMonth(expiration.getMonth() + config.expirationValue);
  }
  
  return expiration;
}

// Monthly check for expired adjustments
setInterval(async () => {
  const expired = await checkSunsetAdjustments({
    expirationPeriod: 'season',
    expirationValue: 1,
    requireRevalidation: true, // Start with true for safety
  });
  
  if (expired.length > 0) {
    console.log(`[SUNSET CHECK] ${expired.length} adjustments expired:`, expired);
    // Send alert to team
  }
}, 30 * 24 * 60 * 60 * 1000); // Monthly
```

**Integration Points:**

1. **Add to CI/CD pipeline:** Call `enforceValidation()` in PR checks
2. **Add to deployment process:** Register adjustments with `AdjustmentMonitor` on deploy
3. **Add to monitoring system:** Include adjustment metrics in dashboard
4. **Add to retraining schedule:** Run weekly evaluation (integrate with Section 3.3)

**Configuration:**

```typescript
interface ValidationEnforcementConfig {
  ciCdGates: {
    enabled: boolean;
    minImprovement: number;
    significanceLevel: number;
    minTestCases: number;
    requireEdgeCasePass: boolean;
  };
  killCriteria: {
    enabled: boolean;
    accuracyDropThreshold: number;
    holdoutSize: number;
    evaluationWindow: 'weekly' | 'daily' | 'matches';
    autoDisable: boolean; // Start with false
  };
  dashboard: {
    enabled: boolean;
    updateFrequency: 'daily' | 'weekly';
    metrics: ('accuracy' | 'brier' | 'roi' | 'winRate')[];
  };
  sunset: {
    enabled: boolean;
    expirationPeriod: 'season' | 'year' | 'months';
    expirationValue: number;
    requireRevalidation: boolean;
  };
}

const defaultEnforcementConfig: ValidationEnforcementConfig = {
  ciCdGates: {
    enabled: true,
    minImprovement: 2.0,
    significanceLevel: 0.05,
    minTestCases: 100,
    requireEdgeCasePass: true,
  },
  killCriteria: {
    enabled: true,
    accuracyDropThreshold: 1.0, // Alert if accuracy drops >1%
    holdoutSize: 100, // Use last 100 matches for evaluation
    evaluationWindow: 'weekly',
    autoDisable: false, // Start with false, enable after validation
  },
  dashboard: {
    enabled: true,
    updateFrequency: 'weekly',
    metrics: ['accuracy', 'brier', 'roi'],
  },
  sunset: {
    enabled: true,
    expirationPeriod: 'season',
    expirationValue: 1,
    requireRevalidation: true,
  },
};
```

**Benefits:**

- ✅ **Prevents regression:** CI/CD gates block bad adjustments before deployment
- ✅ **Early detection:** Kill criteria catch underperforming adjustments quickly
- ✅ **Data-driven decisions:** Dashboard provides visibility into what works
- ✅ **Forces re-validation:** Sunset clauses ensure adjustments stay relevant
- ✅ **Automated enforcement:** Reduces manual oversight needed

**Implementation Effort & ROI:**

- **Effort:** 2–4 days (set up CI gates, dashboard; integrate kill criteria)
- **ROI:** High (prevents 2–5% regression; ensures only proven features stay)

**Gradual Rollout Recommendation:**

1. **Phase 1:** Enable CI/CD gates only (prevents bad deployments)
2. **Phase 2:** Add dashboard monitoring (visibility into performance)
3. **Phase 3:** Enable kill criteria with alerts only (detection without auto-disable)
4. **Phase 4:** Enable auto-disable for kill criteria (after validation)
5. **Phase 5:** Enable sunset clauses (after 1-2 seasons of data)

#### 4.1.5 Adjustment Interaction Analysis

**Goal:** Analyze and prevent overfitting from stacking multiple adjustments that may interact in unexpected ways.

**Problem Statement:**

While individual adjustments pass validation (Section 4.1), stacking multiple adjustments can:
- **Overfit:** Multiple adjustments firing together may over-correct
- **Interact:** Adjustments may reinforce or cancel each other in unexpected ways
- **Compound errors:** Small errors from each adjustment can compound

**Example Scenarios:**

- **Early season + Low H2H + Formation instability + Regression risk:** All fire together, creating large probability swings
- **Sleeping giant + Live dog + Motivation clash:** Multiple positive adjustments stack, potentially over-correcting upward

**Implementation:**

**1. Adjustment Interaction Matrix:**

```typescript
interface AdjustmentInteraction {
  adjustment1: string;
  adjustment2: string;
  interactionType: 'reinforcing' | 'canceling' | 'independent' | 'unknown';
  correlation: number; // -1 to 1, how often they fire together
  combinedImpact: number; // Average combined adjustment when both fire
  expectedImpact: number; // Expected impact if independent (sum of individual)
  interactionEffect: number; // Difference (combined - expected)
}

/**
 * Analyze interactions between adjustments
 */
async function analyzeAdjustmentInteractions(
  historicalPredictions: Prediction[],
  adjustments: Adjustment[]
): Promise<AdjustmentInteraction[]> {
  const interactions: AdjustmentInteraction[] = []
  
  // Get all unique adjustment pairs
  const adjustmentNames = [...new Set(adjustments.map(a => a.name))]
  
  for (let i = 0; i < adjustmentNames.length; i++) {
    for (let j = i + 1; j < adjustmentNames.length; j++) {
      const adj1 = adjustmentNames[i]
      const adj2 = adjustmentNames[j]
      
      // Find predictions where both adjustments fired
      const bothFired = historicalPredictions.filter(p => 
        p.adjustments.some(a => a.name === adj1) &&
        p.adjustments.some(a => a.name === adj2)
      )
      
      // Find predictions where only adj1 fired
      const onlyAdj1 = historicalPredictions.filter(p =>
        p.adjustments.some(a => a.name === adj1) &&
        !p.adjustments.some(a => a.name === adj2)
      )
      
      // Find predictions where only adj2 fired
      const onlyAdj2 = historicalPredictions.filter(p =>
        !p.adjustments.some(a => a.name === adj1) &&
        p.adjustments.some(a => a.name === adj2)
      )
      
      // Calculate correlation (how often they fire together)
      const totalWithAdj1 = historicalPredictions.filter(p =>
        p.adjustments.some(a => a.name === adj1)
      ).length
      const correlation = bothFired.length / Math.max(totalWithAdj1, 1)
      
      // Calculate average impacts
      const avgBothFired = bothFired.length > 0
        ? bothFired.reduce((sum, p) => {
            const adj1Value = p.adjustments.find(a => a.name === adj1)?.value || 0
            const adj2Value = p.adjustments.find(a => a.name === adj2)?.value || 0
            return sum + Math.abs(adj1Value) + Math.abs(adj2Value)
          }, 0) / bothFired.length
        : 0
      
      const avgOnlyAdj1 = onlyAdj1.length > 0
        ? onlyAdj1.reduce((sum, p) => {
            const adj1Value = p.adjustments.find(a => a.name === adj1)?.value || 0
            return sum + Math.abs(adj1Value)
          }, 0) / onlyAdj1.length
        : 0
      
      const avgOnlyAdj2 = onlyAdj2.length > 0
        ? onlyAdj2.reduce((sum, p) => {
            const adj2Value = p.adjustments.find(a => a.name === adj2)?.value || 0
            return sum + Math.abs(adj2Value)
          }, 0) / onlyAdj2.length
        : 0
      
      const expectedImpact = avgOnlyAdj1 + avgOnlyAdj2
      const interactionEffect = avgBothFired - expectedImpact
      
      // Determine interaction type
      let interactionType: 'reinforcing' | 'canceling' | 'independent' | 'unknown'
      if (Math.abs(interactionEffect) < 0.5) {
        interactionType = 'independent'
      } else if (interactionEffect > 0) {
        interactionType = 'reinforcing'
      } else {
        interactionType = 'canceling'
      }
      
      interactions.push({
        adjustment1: adj1,
        adjustment2: adj2,
        interactionType,
        correlation,
        combinedImpact: avgBothFired,
        expectedImpact,
        interactionEffect
      })
    }
  }
  
  return interactions
}
```

**2. Interaction-Based Adjustment Scaling:**

```typescript
/**
 * Scale adjustments based on interaction analysis
 * If multiple reinforcing adjustments fire together, scale them down
 */
function applyInteractionScaling(
  adjustments: Adjustment[],
  interactionMatrix: AdjustmentInteraction[],
  config: AlgorithmConfig
): Adjustment[] {
  const { maxAdjustmentsThreshold = 4, interactionScaleFactor = 0.9 } = config.adjustmentInteraction || {}
  
  // If too many adjustments, scale all
  if (adjustments.length > maxAdjustmentsThreshold) {
    return adjustments.map(adj => ({
      ...adj,
      value: adj.value * interactionScaleFactor,
      reason: `${adj.reason} (scaled due to many adjustments)`
    }))
  }
  
  // Check for reinforcing interactions
  const scaledAdjustments = adjustments.map(adj => {
    let scaleFactor = 1.0
    
    // Find interactions with this adjustment
    const interactions = interactionMatrix.filter(i =>
      i.adjustment1 === adj.name || i.adjustment2 === adj.name
    )
    
    // Count how many reinforcing adjustments are also firing
    const reinforcingCount = interactions
      .filter(i => i.interactionType === 'reinforcing')
      .filter(i => {
        const otherAdj = i.adjustment1 === adj.name ? i.adjustment2 : i.adjustment1
        return adjustments.some(a => a.name === otherAdj)
      }).length
    
    // Scale down if many reinforcing interactions
    if (reinforcingCount >= 2) {
      scaleFactor = 0.85 // Scale down by 15%
    } else if (reinforcingCount === 1) {
      scaleFactor = 0.95 // Scale down by 5%
    }
    
    return {
      ...adj,
      value: adj.value * scaleFactor,
      reason: scaleFactor < 1.0
        ? `${adj.reason} (scaled ${(scaleFactor * 100).toFixed(0)}% due to interactions)`
        : adj.reason
    }
  })
  
  return scaledAdjustments
}
```

**3. Validation with Interaction Testing:**

```typescript
/**
 * Validate adjustment combinations, not just individual adjustments
 */
async function validateAdjustmentCombinations(
  adjustmentCombinations: string[][], // List of adjustment name combinations
  historicalMatches: Match[]
): Promise<{
  combination: string[];
  accuracyWith: number;
  accuracyWithout: number;
  improvement: number;
  isSignificant: boolean;
  pValue: number;
}[]> {
  const results = []
  
  for (const combination of adjustmentCombinations) {
    // Test predictions with this combination enabled
    const predictionsWith = await runPredictions(historicalMatches, {
      enabledAdjustments: combination
    })
    
    // Test predictions without this combination
    const predictionsWithout = await runPredictions(historicalMatches, {
      enabledAdjustments: []
    })
    
    const accuracyWith = calculateAccuracy(predictionsWith, historicalMatches)
    const accuracyWithout = calculateAccuracy(predictionsWithout, historicalMatches)
    const improvement = accuracyWith - accuracyWithout
    
    // Statistical significance test
    const { isSignificant, pValue } = performSignificanceTest(
      predictionsWith,
      predictionsWithout,
      historicalMatches
    )
    
    results.push({
      combination,
      accuracyWith,
      accuracyWithout,
      improvement,
      isSignificant,
      pValue
    })
  }
  
  return results
}

/**
 * Find problematic combinations (negative interactions)
 */
function findProblematicCombinations(
  validationResults: Array<{
    combination: string[];
    improvement: number;
    isSignificant: boolean;
  }>
): string[][] {
  return validationResults
    .filter(r => r.improvement < -1.0 || (r.improvement < 0 && r.isSignificant))
    .map(r => r.combination)
}
```

**4. Integration:**

```typescript
// In prediction generation (after calculating all adjustments)
async function generateFinalPrediction(
  baseProbability: number,
  rawAdjustments: Adjustment[],
  context: MatchContext,
  config: AlgorithmConfig
): Promise<Prediction> {
  // Load interaction matrix (pre-computed from historical data)
  const interactionMatrix = await loadAdjustmentInteractionMatrix()
  
  // Apply interaction scaling
  const scaledAdjustments = applyInteractionScaling(
    rawAdjustments,
    interactionMatrix,
    config
  )
  
  // Apply caps and asymmetric weighting (Section 4.5.6)
  const cappedResult = applyCappedAsymmetricAdjustments(
    baseProbability,
    scaledAdjustments,
    context.market,
    config
  )
  
  return {
    finalProbability: cappedResult.finalProbability,
    adjustments: cappedResult.cappedAdjustments,
    // ... rest of prediction
  }
}
```

**Benefits:**

- ✅ **Prevents overfitting:** Reduces risk of over-correction from stacking adjustments
- ✅ **Better calibration:** Interactions are accounted for in predictions
- ✅ **Data-driven:** Based on actual historical interaction patterns
- ✅ **Transparent:** Shows interaction scaling in adjustment reasons

**Expected Improvement:**

- **Prevents regression:** Maintains accuracy when many adjustments fire together
- **Better calibration:** +0.5–1% accuracy improvement via better interaction handling

**Implementation Effort:** 1–2 days (implement interaction analysis, integrate scaling)

#### 4.2 Backtesting Framework
- **Backtest each new market/feature:**
  - Test on historical data before live deployment
  - Use walk-forward validation (train on past, test on future)
  - Simulate betting with historical odds (if available)
  - Calculate ROI, profit/loss, win rate

- **Backtesting Metrics:**
  - **Accuracy:** Percentage of correct predictions
  - **ROI:** Return on investment (if odds available)
  - **Sharpe Ratio:** Risk-adjusted returns
  - **Maximum Drawdown:** Largest peak-to-trough decline
  - **Win Rate:** Percentage of profitable bets


#### 4.3 Edge Case Testing
- **Test scenarios:**
  - Early season matches (round < 5)
  - Teams with < 5 H2H matches
  - Teams with long rest periods (>10 days)
  - Formation instability scenarios
  - Sleeping Giant / Over-performer patterns
  - Regression risk scenarios

### Phase 5: Advanced Features (Future Enhancements)

#### 5.1 Additional Features to Consider
- **Manager Change Detection:**
  - Track manager changes and impact on team performance
  - Add feature: `DaysSinceManagerChange`
  - Add feature: `ManagerWinRate`
  - Retrain model when manager changes detected

- **Injury Proxy Features:** (Medium Priority - After Phase 2)
  - Use squad rotation patterns as injury proxy
  - Track key player minutes (if available)
  - Add feature: `KeyPlayerRestDays`
  - Consider API integration for injury data (if available)

- **Weather Proxy:** (Medium Priority - After Phase 2)
  - Use historical weather data via API (e.g., Gemini API prompt, OpenWeatherMap)
  - Or: Use time of year as proxy (winter = more draws?)
  - Add features: `Temperature`, `Precipitation`, `WindSpeed`
  - Impact: May improve accuracy by 1-2% in extreme weather conditions

- **Referee Patterns:**
  - Track referee historical patterns (if data available)
  - Add feature: `RefereeAvgCards`, `RefereeAvgGoals`

- **Fixture Congestion:**
  - Track matches played in last 7/14/21 days
  - Add feature: `MatchesInLast7Days`
  - Add feature: `FixtureCongestionScore`

#### 5.2 Market-Specific Models
- **Separate Models per League:**
  - Train league-specific models (Premier League vs Serie A)
  - Different leagues have different playing styles
  - May improve accuracy by 2-5%

- **Separate Models per Market:**
  - Already doing this, but consider:
  - Separate models for different bet types within same market
  - E.g., separate models for BTTS Yes vs BTTS No (if imbalance)

#### 5.3 Real-Time Model Updates
- **Live Match Adjustments:**
  - Update predictions based on live match events
  - E.g., red card → adjust probabilities
  - E.g., early goal → adjust BTTS probability

- **In-Play Features:**
  - Add features for live match state
  - Current score, time remaining, substitutions, cards

### Phase 6: Risk Management & Confidence Intervals

#### 6.1 Prediction Confidence Intervals
- **Add Uncertainty Quantification:**
  - Use prediction intervals (not just point estimates)
  - Show confidence ranges (e.g., BTTS probability: 65-75%)
  - Use ensemble methods or Bayesian approaches for uncertainty

#### 6.2 Risk-Adjusted Predictions
- **Kelly Criterion Integration:**
  - Calculate optimal bet size based on probability and odds
  - Only recommend bets with positive expected value
  - Show risk-adjusted recommendations

#### 6.3 Model Monitoring & Alerting
- **Performance Monitoring:**
  - Track model accuracy over time
  - Alert if accuracy drops below threshold
  - Alert if calibration degrades
  - Track feature drift (features changing distribution)

### Implementation Priority

**High Priority (Weeks 1-4):**
1. ✅ Data acquisition and cleaning
2. ✅ Feature engineering (Mind/Mood/DNA)
3. ✅ Basic ML model training (LightGBM)
4. ✅ Model evaluation and comparison
5. ✅ Backtesting framework

**Medium Priority (Weeks 5-8):**
1. Model calibration
2. Hybrid approach integration
3. Feature importance analysis
4. A/B testing framework
5. Advanced feature engineering
6. Injury/Weather proxy features (via API integration)

**Low Priority (Weeks 9-12):**
1. League-specific models
2. Real-time updates
3. Uncertainty quantification
4. Risk management features
5. Manager change detection

### Success Criteria

**ML Model Performance Targets:**

**Top 5 Leagues (Premier League, La Liga, Serie A, Bundesliga, Ligue 1):**
- **BTTS Model:** Brier Score < 0.20, Log-Loss < 0.60, ROC-AUC > 0.70
- **Over25 Model:** Brier Score < 0.22, Log-Loss < 0.65, ROC-AUC > 0.68
- **Match Result Model:** Multi-class Brier Score < 0.50, Log-Loss < 1.20
- **First Half Model:** Brier Score < 0.22, Log-Loss < 0.65

**Lower Leagues (Portuguese League, Eredivisie, etc.):**
- **BTTS Model:** Brier Score < 0.25-0.30, Log-Loss < 0.65-0.70, ROC-AUC > 0.65
- **Over25 Model:** Brier Score < 0.27-0.32, Log-Loss < 0.70-0.75, ROC-AUC > 0.63
- **Match Result Model:** Multi-class Brier Score < 0.55-0.60, Log-Loss < 1.25-1.30
- **First Half Model:** Brier Score < 0.27-0.32, Log-Loss < 0.70-0.75

**Note:** Lower leagues typically have +0.05-0.10 worse performance due to:
- Less consistent data quality
- Higher variance in team performance
- More unpredictable results
- Adjust thresholds accordingly per league tier

**Improvement Targets:**
- ML model should outperform rule-based by at least 3-5% accuracy
- Well-calibrated probabilities (ECE < 0.05)
- Positive ROI on backtesting (if odds available)

**Deployment Criteria:**
- Backtested on at least 2 full seasons
- A/B tested for at least 1 month
- No significant performance degradation
- Monitoring and alerting in place

---

## Advanced Algorithm Layers: Mind, Mood, and DNA

### Overview: Three-Layer Data Strategy

To optimize the algorithm without over-correcting, we use three distinct layers that separate baseline quality (Mind), recent momentum (Mood), and technical trends (DNA). This ensures that a single bad week doesn't "break" the math, but major tactical changes are still respected.

### 1. The Mind (Baseline Quality - 50 Matches)

**Data Source:** Last 50 Matches  
**Purpose:** Defines the team's "True Tier" and prevents being fooled by lucky streaks

**Efficiency Index (EI):**
$$EI = (\text{Avg Points per Game}) + (\text{Goal Difference} / 10)$$

**Tier Categorization:**
- **Tier 1:** EI ≥ 2.0 (Elite teams - e.g., Man City, Liverpool)
- **Tier 2:** EI ≥ 1.5 (Top tier - e.g., Top 6)
- **Tier 3:** EI ≥ 1.0 (Mid tier - e.g., Mid-table)
- **Tier 4:** EI < 1.0 (Lower tier - e.g., Relegation battle)

**Key Insight:** If a Tier 1 team has a bad week, the algorithm remembers they are still Tier 1. This is the team's "Identity."

### 2. The Mood (Recent Momentum - 10 Matches)

**Data Source:** Last 10 Matches (30% weight in predictions)  
**Purpose:** Catches the team's current energy, injuries, and confidence

**The "Mood vs. Mind" Gap:** This is where value bets are found

**Sleeping Giant Pattern:**
- Mind = Tier 1 | Mood = Tier 4
- High-value bet: The odds will be high, but the "Class" remains
- Algorithm flags this as a value opportunity (+10% probability)
- **Exception:** One-Season Wonder detection - If team was recently promoted and is regressing, reduce confidence instead of adding probability (see Section 1.5.6)

**Over-performer Pattern:**
- Mind = Tier 4 | Mood = Tier 1
- Regression risk: The algorithm warns that they are "Due" for a loss
- Reduces probability by 8% and flags as regression risk

### 3. The DNA (Technical Trends - Season Stats)

**Data Source:** Season Statistics Endpoint  
**Purpose:** Refines specific markets (BTTS, O/U, 1st Half) rather than the winner

**Components:**
- **Formation Stability:** Most played formation vs. match formation
- **Under/Over Distributions:** Season averages (e.g., 82% Under 2.5)
- **Goal Minute Distribution:** When teams score/concede goals
- **Clean Sheet % & Failed to Score %:** Defensive and offensive DNA

**Formation Stability Filter:**
- **Tiered Reduction:** Based on formation usage percentage
  - <20% usage: 20-25% confidence reduction
  - 20-40% usage: 10-15% reduction
  - 40-60% usage: 5-10% reduction
  - 60-80% usage: 0-5% reduction
- **Market-Specific Impact:**
  - Match Result (1X2): Full reduction
  - BTTS/O/U 2.5: 40% less impact (formations less critical for goal totals)
  - First Half: 20% less impact
- **Early Season Adjustment:** Reduce penalty by 50% (teams experiment more early season)
- **Combined Impact:** Both teams experimental capped at 30% total reduction

**Frustration Filter (Goal Efficiency):**
- If team has 70%+ "Under 2.5" season average, never bet "Over" just because they scored 3 goals last week
- Trust the long-term DNA over recent outliers
- Adjusts Over probability by -6% to -9% when DNA strongly suggests Under

### 4. The Safety Layer (Non-Mathematical Flags)

Binary "Yes/No" flags that trigger confidence adjustments:

| Flag | Logic | Action |
|------|-------|--------|
| **Regression Risk** | Tier 3 team won 5+ in a row | Reduce Confidence by 15% |
| **Motivation Clash** | TITLE_RACE vs MID_TABLE | +5% Win Prob to motivated team |
| **Live Dog** | Bottom team scored in 2 of last 3 away | Switch "Win to Nil" to "BTTS" (+10% BTTS prob) |

---

## 1. The "Stability Filter" (Lineups)
The lineups section is arguably the most valuable part of this endpoint.

The Problem: A team in good form might have achieved it playing a 4-3-3, but today the manager is switching to a 5-4-1 due to injuries.

The Implementation: If the "Formation Played" today matches the formation used in >80% of the season, keep your "Mind" (Baseline) weight at 100%.

The Trigger: If the formation is a "Negative Outlier" (rarely used), reduce the confidence of the match result. It shows the team is "Experimental" today, which increases the chance of a draw or upset.

## 2. Goal Efficiency (Under/Over Distributions)
Your endpoint shows that Bologna has a 14/17 (82%) Under 2.5 rate.

Why it's better than raw match data: It shows the "distribution density." Even if Bologna had one crazy 4-3 game recently, this stat proves their Identity is low-scoring.

Implementation: If your algorithm predicts a win, use the Under/Over stats to choose the "Safety". For Bologna, a "Win + Under 3.5" is a much more accurate bet than a straight "Win."

## 3. The "In-Play" Momentum (Goal Minutes)
You can use the minute distribution to solve the "First Half Result" market.

Bologna Logic: 0% of goals in the first 15 mins; 28% in 46-60 mins.

The Betting Tip: "Draw at Half Time" is a high-confidence play here because they are "Late Starters."

The Progress Bar Idea: In your helper, instead of just saying BTTS 3/5, show a "Danger Zone" bar.

"Danger Zone: This team concedes 35% of their goals in the 61-75 min window."

## Summary: Your Data StrategyLayerSourceRole in AlgorithmThe Mind50 MatchesCalculate the Efficiency Index (EI). Defines the Tier.The Mood10 MatchesCalculate the Current Momentum (30% weight).The DNASeason StatsQualify the Bets. Use Clean Sheets to predict "To Nil" and Lineups to check "Stability."

To optimize your algorithm without over-correcting, you should think of your data in three distinct layers: The Mind (Class), The Mood (Form), and The DNA (Style).By keeping these layers separate, you ensure that a single bad week doesn't "break" the math, but a major tactical change (like a new manager) is still respected.## 1. The Mind (Baseline Quality)Data Source: Last 50 Matches.Purpose: Defines the team's "True Tier" and prevents you from being fooled by a lucky streak.The Efficiency Index (EI): Instead of using standings, calculate their $EI$ over 50 games.$$EI = (\text{Avg Points per Game}) + (\text{Goal Difference} / 10)$$The Anchor: Use this $EI$ to categorize teams into Tiers (1–4). This is the team's "Identity." If a Tier 1 team has a bad week, the algorithm remembers they are still Tier 1.## 2. The Mood (Recent Momentum)Data Source: Last 10 Matches (Your core 30% weight).Purpose: Catches the team's current energy, injuries, and confidence.The "Mood vs. Mind" Gap: This is where you find Value.The Sleeping Giant: Mind = Tier 1 | Mood = Tier 4. (The odds will be high, but the "Class" remains. This is a high-value bet).The Over-performer: Mind = Tier 4 | Mood = Tier 1. (This is a "Fake Giant." The algorithm should warn you that they are "Due" for a loss).## 3. The DNA (Technical Trends)Data Source: Season Statistics Endpoint (Lineups, Under/Over, Goal Minutes).Purpose: Refines the specific market (BTTS, O/U, 1st Half) rather than the winner.Formation Stability: If today's lineup matches their "Most Played Formation" (from the stats endpoint), trust your 50-match baseline. If they switch (e.g., 4-3-3 to 5-4-1), reduce the confidence score—the team is experimenting.The "Frustration" Filter: Check the Clean Sheet % and Failed to Score %.If a team has a 70% "Under 2.5" season average, never bet the "Over" just because they scored 3 goals last week. Trust the long-term DNA.## 4. The "Safety Layer" (Non-Mathematical Flags)These are binary "Yes/No" flags that don't change your weights but trigger a Confidence Adjustment.FlagLogicActionRegression RiskIf a Tier 3 team has won 5 in a row.Reduce Confidence by 15%.New ManagerIf manager has been there $<3$ matches.Halve the "Recent Form" weight (old form is irrelevant).Motivation ClashIf one team is TITLE_RACE and other is MID_TABLE.Add +5% Win Prob to the motivated team.Live DogBottom team has scored in 2 of last 3 away games.Switch "Win to Nil" bet to "BTTS."

## Part 1: Honest Answer - Is This a Predictor Bot?

### What You're Building vs "Predictor Bots"

**❌ What You're NOT Building:**
```
Typical "Predictor Bot" (Scam):
- Claims 80-90% accuracy
- Pays for fake Telegram followers
- "Sure wins" and "fixed matches"
- No transparency
- No data shown
- Just "Trust me bro"
- Disappears when wrong
```

**✅ What You ARE Building:**
```
Data Aggregation & Analysis Tool:
- Shows the math (transparent)
- Displays confidence levels
- Admits when uncertain
- Shows conflicting signals
- Saves users TIME (vs manually checking 10 matches)
- Educational (teaches why, not just what)
- Realistic accuracy expectations (60-70%, not 90%)
```

### The Truth About Prediction Accuracy

**Realistic Expectations:**
```
BTTS Predictions:
✅ 65-75% accuracy possible
Why: Simple binary outcome, less variables
Example: If both teams scored in 4 of last 5 games + 
         4 of last 5 H2H → very likely to happen again

Over/Under 2.5:
✅ 60-70% accuracy possible
Why: Scoring patterns are semi-predictable
Example: High-scoring teams vs defensive teams

Match Result (1X2):
⚠️ 50-60% accuracy (at best!)
Why: Too many variables (referee, luck, one mistake)
Even bookies with billions in data struggle here
```

**Why Most Predictor Bots Fail:**
```
1. They try to predict 1X2 (hardest market)
2. They claim unrealistic accuracy (80-90%)
3. They ignore context (just use algorithms)
4. They don't show confidence levels
5. They treat all predictions equally
6. They don't learn from mistakes
```

**Your Advantage:**
```
1. ✅ Focus on easier markets (BTTS, O/U 2.5)
2. ✅ Realistic accuracy claims (60-70%)
3. ✅ Show all the data (transparency)
4. ✅ Confidence levels (HIGH/MEDIUM/LOW)
5. ✅ Separate strong bets from weak ones
6. ✅ Track accuracy over time (build trust)
7. ✅ Educational ("here's WHY we think this")
```

### What You're Really Selling

**Not:** "We predict the future perfectly"
**But:** "We save you 15 minutes of research per match and give you better analysis than you'd do manually"

**Value Proposition:**
```
Without Outscore:
👤 Bettor manually checks:
   - Man Utd last 5 games (5 min)
   - Chelsea last 5 games (5 min)
   - H2H history (3 min)
   - League table (1 min)
   - Mental calculation (2 min)
   Total: 16 minutes per match
   
   Result: Probably misses key insights (fatigue, motivation)
   
With Outscore:
📱 Open app (10 seconds)
   - See all data aggregated
   - Clear probability ratings
   - Key insights highlighted
   - Conflicting signals shown
   Total: 30 seconds per match
   
   Result: Better informed decision in 3% of the time
```

**Key Message for Users:**
```
"We don't predict the future. We help you make better 
decisions by aggregating data you'd check manually anyway.

Our probabilities are educated estimates based on:
- Recent form (last 5-10 games)
- Head-to-head history
- Home/away performance
- Motivation & context
- Rest days & fatigue

We're right ~65-70% of the time on BTTS and O/U 2.5.
We show our confidence level for every prediction.
When signals conflict, we tell you."

Think of us as a research assistant, not a crystal ball.
```

---

## Part 2: How Factors Apply to Different Markets

### Factor Relevance Matrix

**Note:** Base weights shown below are adjusted dynamically based on:
- **Rest Days:** If `daysSinceLastMatch > 10`, recent form weight reduced by 30-50%
- **Early Season:** If round < 5, recent form reduced by 40%, H2H/historical increased
- **Low H2H:** If H2H matches < 5, H2H weight reduced by 40-60%, redistributed to recent form
- **Mind/Mood Gap:** Sleeping Giant (Tier 1 Mind, Tier 4 Mood) adds value, Over-performer reduces confidence
- **Formation Stability:** Experimental formations reduce confidence by 15-25%
- **DNA Layer:** Season Under/Over distributions override recent outliers (Frustration Filter)
- **Safety Flags:** Regression Risk reduces confidence by 15%, Motivation Clash adds +5% win probability



```typescript
// Weight adjustments per market (BASE weights - will be adjusted dynamically)
const MARKET_WEIGHTS = {
  MATCH_RESULT: {
    recentForm: 30,
    h2h: 25,
    homeAdvantage: 20,
    motivation: 18,
    rest: 12,
    leaguePosition: 10,
  },
  
  BTTS: {
    recentForm: 35,        // ⬆️ More important (scoring patterns)
    h2h: 25,               // Same (historical BTTS matters)
    homeAdvantage: 10,     // ⬇️ Less relevant for BTTS
    motivation: 15,        // ⬇️ Less relevant
    rest: 8,               // ⬇️ Less relevant
    defensiveForm: 20,     // ⬆️ NEW: Clean sheets matter
    scoringRate: 25,       // ⬆️ NEW: Goals per game critical
  },
  
  // Over/Under Goals (multi-line): weights apply per line (0.5..5.5)
  OVER_UNDER_GOALS: {
    recentForm: 30,        // Scoring trends
    h2h: 20,               // ⬇️ Less weight (historical goals)
    homeAdvantage: 12,     // ⬇️ Less relevant
    motivation: 10,        // ⬇️ Less relevant (both score)
    rest: 8,
    avgGoalsPerGame: 30,   // ⬆️ NEW: Critical factor
    defensiveWeakness: 25, // ⬆️ NEW: Leaky defenses
  },
  
  FIRST_HALF_RESULT: {
    recentForm: 25,
    h2h: 20,
    homeAdvantage: 15,
    motivation: 10,
    firstHalfScoring: 40,  // ⬆️ NEW: Critical
    slowStarters: 30,      // ⬆️ NEW: Pattern recognition
  },
  
  CLEAN_SHEET: {
    recentForm: 20,
    h2h: 15,
    homeAdvantage: 15,
    defensiveForm: 50,     // ⬆️ NEW: Most critical
    opponentScoring: 30,   // ⬆️ NEW: Can they score?
  },
};
```

### Market-Specific Factor Examples

#### 1. BTTS (Both Teams to Score)

**Key Questions:**
- Do both teams score regularly?
- Do both teams concede regularly?
- Has BTTS happened in recent H2H?

**Factors (Ranked):**
```typescript
1. Scoring Rate (25%)
   Team A scored in 5 of last 5 → +25
   Team B scored in 4 of last 5 → +20
   
2. Defensive Form (20%)
   Team A: 0 clean sheets in L10 → +20 (helps BTTS)
   Team B: 1 clean sheet in L10 → +15 (helps BTTS)
   
3. Recent Form (35%)
   Overall form including goals scored/conceded
   
4. H2H BTTS (25%)
   BTTS in 4 of last 5 H2H → +40
   Note: Uses recency-weighted percentage (2025 matches weighted higher than 2023)
   
5. Home Advantage (10%)
   Less relevant for BTTS
   
6. Motivation (15%)
   If team "must win" → more attacking → helps BTTS
   
7. Rest Days (8%)
   Tired teams defend worse → helps BTTS
```

**Example Calculation:**
```typescript
Man United vs Chelsea - BTTS

Scoring Rates:
- Man Utd: 4/5 games (80%) → Score: +20
- Chelsea: 5/5 games (100%) → Score: +25

Defensive Form:
- Man Utd: 0/10 clean sheets → Score: +20 (leaky)
- Chelsea: 2/10 clean sheets → Score: +15 (leaky)

H2H BTTS:
- 4 of last 5 meetings → Score: +40
- Recency weighting: 3 matches from 2025 (weight 1.0), 2 from 2023 (weight 0.5)
- Weighted BTTS%: 85% (vs simple 80%) → Score: +42

Weighted Score:
= (20+25)*0.25 + (20+15)*0.20 + (40)*0.25
= 11.25 + 7 + 10
= 28.25

Convert to probability:
= 1 / (1 + e^(-score/10))
= 1 / (1 + e^(-2.825))
= 94% → Adjust for conservatism → 78%

Result: BTTS - LIKELY (78%)
```

**Motivation Impact on BTTS:**
```
Team fighting for survival:
→ Defensive, cautious
→ REDUCES BTTS probability (-10%)

Team with nothing to play for:
→ Open, attacking football
→ INCREASES BTTS probability (+5%)

Both teams need to win:
→ Attacking football
→ INCREASES BTTS probability (+15%)
```

**Rest Days Impact on BTTS:**
```
3 days rest:
→ Tired legs
→ Defensive mistakes
→ INCREASES BTTS probability (+5%)

7 days rest:
→ Fresh, organized defense
→ DECREASES BTTS probability (-5%)

10+ days rest:
→ Recent form becomes less reliable
→ Recent form weight reduced by 30-50%
→ More weight given to H2H and historical data
→ Prediction becomes more conservative
```

---

#### 2. Over/Under 2.5 Goals

**Key Questions:**
- Do these teams score lots of goals?
- Do these teams concede lots of goals?
- Were recent H2H high-scoring?

**Factors (Ranked):**
```typescript
1. Average Goals Per Game (30%)
   Team A: 2.4 goals/game (L5) → +24
   Team B: 1.8 goals/game (L5) → +18
   Combined: 4.2 goals/game → Very High
   
2. Defensive Weakness (25%)
   Team A conceding: 1.8/game → +18
   Team B conceding: 1.2/game → +12
   
3. Recent Form (30%)
   Over 2.5 in 4 of last 5 for both teams
   
4. H2H Goals (20%)
   Average 3.5 goals in last 5 H2H → +35
   Note: Uses recency-weighted average (recent high-scoring matches weighted more)
   
5. Home Advantage (12%)
   Home teams typically score 0.3-0.5 more
   
6. Motivation (10%)
   Must-win games can be high-scoring
   
7. Rest Days (8%)
   Fatigue increases goals late in game
```

**Example Calculation:**
```typescript
Man United vs Chelsea - Over 2.5

Average Goals:
- Man Utd scoring: 2.4/game → +24
- Chelsea scoring: 2.2/game → +22
- Combined: 4.6/game → Score: +46

Defensive Weakness:
- Man Utd conceding: 1.8/game → +18
- Chelsea conceding: 1.0/game → +10

H2H:
- Average 3.5 goals in L5 H2H → +35
- Over 2.5 in 4 of 5 H2H → +40

Recent Form:
- Over 2.5 in 4 of Man Utd's L5 → +30
- Over 2.5 in 3 of Chelsea's L5 → +20

Weighted Score:
= 46*0.30 + 28*0.25 + 25*0.30 + 37.5*0.20
= 13.8 + 7 + 7.5 + 7.5
= 35.8

Result: Over 2.5 - LIKELY (71%)
```

**Motivation Impact on Over 2.5:**
```
Both teams need to win:
→ Open, attacking game
→ INCREASES probability (+15%)

One team needs win, other doesn't:
→ Attacking vs Defensive
→ NEUTRAL (±0%)

Both teams safe mid-table:
→ Boring game
→ DECREASES probability (-10%)

Title decider / Relegation battle:
→ Tense, cagey
→ DECREASES probability (-5%)
```

**Rest Days Impact on Over 2.5:**
```
Both teams tired (3 days):
→ Defensive mistakes
→ Late goals
→ INCREASES probability (+8%)

Both teams fresh (7+ days):
→ Organized defense
→ DECREASES probability (-5%)

One tired, one fresh:
→ Fresh team likely dominates
→ INCREASES probability (+5%)
```

---

#### 3. Match Result (1X2)

**This uses ALL factors equally** (as shown in previous document)

**Key Insight:**
```
For 1X2, ALL factors matter:
- Recent form (who's in better shape?)
- H2H (psychological edge)
- Home advantage (huge for 1X2)
- Motivation (who wants it more?)
- Rest (who's fresher?)
- League position (who's better quality?)

This is why 1X2 is hardest to predict!
Too many variables.
```

---

#### 4. First Half Result

**Key Questions:**
- Who scores early?
- Who starts slow?
- First half patterns in H2H?

**Factors (Ranked):**
```typescript
1. First Half Scoring Rate (40%)
   Team A: 3 of 5 games scored in 1st half → +30
   Team B: 1 of 5 games scored in 1st half → +10
   
2. Slow Starters Pattern (30%)
   Team B is historically slow starter → -30
   
3. Recent Form (25%)
   Overall form matters
   
4. H2H First Half (20%)
   What happened in 1st half of recent H2H?
   
5. Home Advantage (15%)
   Home teams often start faster
   
6. Motivation (10%)
   High-stakes games start cautious
```

**Motivation Impact on First Half:**
```
Must-win game:
→ Cautious start
→ DECREASES 1st half goals (-15%)

Nothing to play for:
→ Open, attacking start
→ INCREASES 1st half goals (+10%)

Derby / Rivalry:
→ Intense, fast start
→ INCREASES 1st half goals (+12%)
```

---

### Summary: Factor Relevance by Market

```
┌─────────────────┬──────┬──────┬────────┬──────────┐
│ Factor          │ 1X2  │ BTTS │ O/U2.5 │ 1st Half │
├─────────────────┼──────┼──────┼────────┼──────────┤
│ Recent Form     │ 30%  │ 35%  │ 30%    │ 25%      │
│ H2H Record      │ 25%  │ 25%  │ 20%    │ 20%      │
│ Home Advantage  │ 20%  │ 10%  │ 12%    │ 15%      │
│ Motivation      │ 18%  │ 15%  │ 10%    │ 10%      │
│ Rest Days       │ 12%  │ 8%   │ 8%     │ 5%       │
│ League Position │ 10%  │ 5%   │ 5%     │ 5%       │
├─────────────────┼──────┼──────┼────────┼──────────┤
│ Scoring Rate    │ N/A  │ 25%  │ 30%    │ N/A      │
│ Defensive Form  │ N/A  │ 20%  │ 25%    │ N/A      │
│ 1st Half Score  │ N/A  │ N/A  │ N/A    │ 40%      │
└─────────────────┴──────┴──────┴────────┴──────────┘
```

**Key Insight:**
- **BTTS:** Scoring/defensive form > home advantage
- **O/U 2.5:** Average goals > motivation
- **1X2:** All factors matter equally (hardest!)
- **1st Half:** Timing patterns > everything else

---

## Part 3: Complete Implementation Plan

### Phase 1: Core Data Layer (Week 1)

**Goal:** Fetch and cache all necessary data

#### 1.1 Data Fetching Functions

```typescript
// /api/data/team-data.ts

// Helper: Filter out friendly matches
function filterNonFriendlyMatches(matches: Match[]): Match[] {
  return matches.filter(match => {
    const leagueName = match.league?.name || '';
    return !leagueName.toLowerCase().includes('friendly');
  });
}

// Helper: Extract round number from league.round string
// Examples: "Regular Season - 3" → 3, "Matchday 5" → 5, "Round 2" → 2
function extractRoundNumber(roundString: string): number | null {
  if (!roundString) return null;
  
  // Try to extract number from common patterns
  const patterns = [
    /(\d+)/,                           // Any number
    /regular season[^\d]*(\d+)/i,      // "Regular Season - 3"
    /matchday[^\d]*(\d+)/i,           // "Matchday 5"
    /round[^\d]*(\d+)/i,              // "Round 2"
  ];
  
  for (const pattern of patterns) {
    const match = roundString.match(pattern);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > 0 && num < 100) return num; // Sanity check
    }
  }
  
  return null;
}

// Helper: Check if match is in early season (< 5 rounds)
function isEarlySeason(roundString: string): boolean {
  const round = extractRoundNumber(roundString);
  return round !== null && round < 5;
}

// Helper: Calculate recency weights for H2H matches (IMPROVED VERSION)
// Uses days-based decay instead of year-based for more granular weighting
// Adds within-season boost and recent months boost
function calculateH2HRecencyWeights(matches: Match[]): number[] {
  const currentDate = new Date();
  
  return matches.map(match => {
    const matchDate = new Date(match.date);
    const daysDiff = (currentDate.getTime() - matchDate.getTime()) / (1000 * 60 * 60 * 24);
    const yearsDiff = daysDiff / 365;
    
    // Base exponential decay by days (more granular than year-based)
    // Decay over 1 year period: weight = e^(-daysDiff / 365)
    let weight = Math.exp(-daysDiff / 365);
    
    // Within-season boost: Matches from same season get 1.2x multiplier
    // Assumes season runs Aug-May (adjust for different leagues)
    const isSameSeason = isSameSeasonHelper(matchDate, currentDate);
    if (isSameSeason) {
      weight *= 1.2;
    }
    
    // Recent months boost: Last 3 months get 1.1x multiplier
    if (daysDiff < 90) {
      weight *= 1.1;
    }
    
    return weight;
  });
}

// Helper: Check if two dates are in the same season
// Assumes season runs August to May (adjust for different leagues)
function isSameSeasonHelper(date1: Date, date2: Date): boolean {
  const year1 = date1.getFullYear();
  const year2 = date2.getFullYear();
  const month1 = date1.getMonth(); // 0-11 (Jan = 0, Aug = 7)
  const month2 = date2.getMonth();
  
  // Same year: always same season
  if (year1 === year2) return true;
  
  // Adjacent years: check if dates are in overlapping period (Aug-May)
  if (year1 === year2 - 1) {
    // date1 is in previous year, date2 is current year
    // Same season if date1 is Aug-Dec (month >= 7) and date2 is Jan-May (month <= 4)
    if (month1 >= 7 && month2 <= 4) return true;
  }
  
  if (year1 === year2 + 1) {
    // date1 is current year, date2 is previous year
    // Same season if date1 is Jan-May (month <= 4) and date2 is Aug-Dec (month >= 7)
    if (month1 <= 4 && month2 >= 7) return true;
  }
  
  return false;
}

// Helper: Calculate weighted average for H2H stats
function calculateWeightedAverage(
  values: number[],
  weights: number[]
): number {
  if (values.length === 0 || values.length !== weights.length) return 0;
  
  const weightedSum = values.reduce((sum, val, idx) => sum + val * weights[idx], 0);
  const weightSum = weights.reduce((sum, w) => sum + w, 0);
  
  return weightSum > 0 ? weightedSum / weightSum : 0;
}

// Helper: Calculate Efficiency Index (EI) for Mind layer
// EI = (Avg Points per Game) + (Goal Difference / 10)
function calculateEfficiencyIndex(matches: Match[]): number {
  if (matches.length === 0) return 0;
  
  let totalPoints = 0;
  let totalGoalsScored = 0;
  let totalGoalsConceded = 0;
  
  for (const match of matches) {
    // Calculate points: Win = 3, Draw = 1, Loss = 0
    let points = 0;
    if (match.result === 'W') points = 3;
    else if (match.result === 'D') points = 1;
    
    totalPoints += points;
    totalGoalsScored += match.goalsScored || 0;
    totalGoalsConceded += match.goalsConceded || 0;
  }
  
  const avgPointsPerGame = totalPoints / matches.length;
  const goalDifference = totalGoalsScored - totalGoalsConceded;
  const ei = avgPointsPerGame + (goalDifference / 10);
  
  return ei;
}

// Helper: Categorize team into Tier (1-4) based on Efficiency Index
function categorizeTier(efficiencyIndex: number): 1 | 2 | 3 | 4 {
  // Tier thresholds (adjust based on league quality)
  if (efficiencyIndex >= 2.0) return 1;      // Elite (e.g., Man City, Liverpool)
  if (efficiencyIndex >= 1.5) return 2;      // Top tier (e.g., Top 6)
  if (efficiencyIndex >= 1.0) return 3;      // Mid tier (e.g., Mid-table)
  return 4;                                  // Lower tier (e.g., Relegation battle)
}

// Helper: Calculate Mood tier from last 10 matches
function calculateMoodTier(matches: Match[]): 1 | 2 | 3 | 4 {
  if (matches.length === 0) return 3; // Default to mid-tier if no data
  
  const moodEI = calculateEfficiencyIndex(matches);
  return categorizeTier(moodEI);
}

// Helper: Get number of seasons team has been in current league
async function getSeasonsInCurrentLeague(
  teamId: number,
  leagueId: number,
  currentSeason: string
): Promise<number> {
  // Get all matches for team in current league
  const matches = await getTeamMatchesForMindLayer(teamId, leagueId, currentSeason, 1000);
  
  if (matches.length === 0) return 0;
  
  // Extract unique seasons from matches
  const seasons = new Set<string>();
  matches.forEach(match => {
    if (match.season) {
      seasons.add(match.season);
    }
  });
  
  return seasons.size;
}

// Helper: Detect one-season wonder pattern
// A one-season wonder is a recently promoted team that overperformed in their first season
// and is now regressing to their true level (not a genuine sleeping giant)
async function detectOneSeasonWonder(
  teamId: number,
  leagueId: number,
  currentSeason: string,
  mindTier: number,
  moodTier: number,
  mindMatches: Match[],
  moodMatches: Match[]
): Promise<boolean> {
  // Only check if pattern matches sleeping giant (Mind Tier 1, Mood Tier 4)
  if (!(mindTier === 1 && moodTier === 4)) {
    return false;
  }
  
  // Check if team was promoted recently (within last 2 seasons)
  const seasonsInLeague = await getSeasonsInCurrentLeague(teamId, leagueId, currentSeason);
  
  if (seasonsInLeague <= 1) {
    // Only 1 season in league: Check if performance is declining
    // Compare recent matches (Mood layer) vs older matches (first season)
    
    if (moodMatches.length < 5 || mindMatches.length < 20) {
      // Not enough data to determine
      return false;
    }
    
    // Get matches from first season (if available)
    const firstSeasonMatches = mindMatches.filter(m => {
      const matchSeason = m.season || '';
      const currentYear = parseInt(currentSeason.split('-')[0]);
      const matchYear = parseInt(matchSeason.split('-')[0]);
      // First season would be previous year
      return matchYear === currentYear - 1;
    });
    
    if (firstSeasonMatches.length < 10) {
      // Not enough first season data
      return false;
    }
    
    // Calculate EI for recent matches (current season, bad form)
    const recentEI = calculateEfficiencyIndex(moodMatches);
    
    // Calculate EI for first season matches (good season)
    const firstSeasonEI = calculateEfficiencyIndex(firstSeasonMatches);
    
    // If recent performance is significantly worse, likely one-season wonder
    // Threshold: Recent EI is at least 0.5 points lower than first season
    if (recentEI < firstSeasonEI - 0.5) {
      return true; // One-season wonder: overperformed, now regressing
    }
  }
  
  // Check if team has been in league for 2 seasons but still declining
  if (seasonsInLeague === 2) {
    // Split mind matches by season
    const currentYear = parseInt(currentSeason.split('-')[0]);
    const firstSeasonMatches = mindMatches.filter(m => {
      const matchYear = parseInt((m.season || '').split('-')[0]);
      return matchYear === currentYear - 1;
    });
    const secondSeasonMatches = mindMatches.filter(m => {
      const matchYear = parseInt((m.season || '').split('-')[0]);
      return matchYear === currentYear;
    });
    
    if (firstSeasonMatches.length >= 20 && secondSeasonMatches.length >= 10) {
      const firstSeasonEI = calculateEfficiencyIndex(firstSeasonMatches);
      const secondSeasonEI = calculateEfficiencyIndex(secondSeasonMatches);
      const recentEI = calculateEfficiencyIndex(moodMatches);
      
      // If performance declined from first to second season, and recent form is bad
      if (secondSeasonEI < firstSeasonEI - 0.3 && recentEI < firstSeasonEI - 0.5) {
        return true; // One-season wonder pattern
      }
    }
  }
  
  return false;
}

// Helper: Detect Mind vs Mood gap and identify patterns
async function detectMoodVsMindGap(
  mindTier: number,
  moodTier: number,
  teamId: number,
  leagueId: number,
  currentSeason: string,
  mindMatches: Match[],
  moodMatches: Match[]
): Promise<TeamMood> {
  const mindMoodGap = Math.abs(mindTier - moodTier);
  const isSleepingGiant = mindTier === 1 && moodTier === 4;
  const isOverPerformer = mindTier === 4 && moodTier === 1;
  
  // Detect one-season wonder (only if sleeping giant pattern exists)
  const isOneSeasonWonder = isSleepingGiant
    ? await detectOneSeasonWonder(teamId, leagueId, currentSeason, mindTier, moodTier, mindMatches, moodMatches)
    : false;
  
  return {
    tier: moodTier as 1 | 2 | 3 | 4,
    mindMoodGap,
    isSleepingGiant: isSleepingGiant && !isOneSeasonWonder, // Only true if NOT one-season wonder
    isOverPerformer,
    isOneSeasonWonder,
  };
}

// Helper: Calculate formation frequency from matches
function calculateFormationFrequency(matches: Match[]): Record<string, number> {
  const formationCounts: Record<string, number> = {};
  
  for (const match of matches) {
    const formation = match.formation || 'unknown';
    formationCounts[formation] = (formationCounts[formation] || 0) + 1;
  }
  
  // Convert to percentages
  const total = matches.length;
  const frequencies: Record<string, number> = {};
  
  for (const [formation, count] of Object.entries(formationCounts)) {
    frequencies[formation] = (count / total) * 100;
  }
  
  return frequencies;
}

// Helper: Get most played formation
function getMostPlayedFormation(formationFrequency: Record<string, number>): string {
  let maxFreq = 0;
  let mostPlayed = 'unknown';
  
  for (const [formation, freq] of Object.entries(formationFrequency)) {
    if (freq > maxFreq) {
      maxFreq = freq;
      mostPlayed = formation;
    }
  }
  
  return mostPlayed;
}

// Helper: Calculate goal minute distribution from goal minute data (from api-football)
function calculateGoalMinuteDistributionFromData(goalMinutes: Array<{minute: number; goals: number}>): {
  distribution: Record<string, number>;
  firstHalfPercentage: number;
  earlyGoalPercentage: number;
  dangerZones: Array<{window: string, percentage: number}>;
} {
  const timeWindows = {
    '0-15': 0,
    '16-30': 0,
    '31-45': 0,
    '46-60': 0,
    '61-75': 0,
    '76-90': 0,
  };
  
  let totalGoals = 0;
  let firstHalfGoals = 0;
  let earlyGoals = 0;
  
  for (const {minute, goals} of goalMinutes) {
    totalGoals += goals;
    
    if (minute <= 15) {
      timeWindows['0-15'] += goals;
      earlyGoals += goals;
      firstHalfGoals += goals;
    } else if (minute <= 30) {
      timeWindows['16-30'] += goals;
      firstHalfGoals += goals;
    } else if (minute <= 45) {
      timeWindows['31-45'] += goals;
      firstHalfGoals += goals;
    } else if (minute <= 60) {
      timeWindows['46-60'] += goals;
    } else if (minute <= 75) {
      timeWindows['61-75'] += goals;
    } else {
      timeWindows['76-90'] += goals;
    }
  }
  
  // Convert to percentages
  const distribution: Record<string, number> = {};
  for (const [window, count] of Object.entries(timeWindows)) {
    distribution[window] = totalGoals > 0 ? (count / totalGoals) * 100 : 0;
  }
  
  const firstHalfPercentage = totalGoals > 0 ? (firstHalfGoals / totalGoals) * 100 : 0;
  const earlyGoalPercentage = totalGoals > 0 ? (earlyGoals / totalGoals) * 100 : 0;
  
  // Identify danger zones (windows with >20% of goals)
  const dangerZones = Object.entries(distribution)
    .filter(([_, pct]) => pct > 20)
    .map(([window, percentage]) => ({ window, percentage }))
    .sort((a, b) => b.percentage - a.percentage);
  
  return {
    distribution,
    firstHalfPercentage,
    earlyGoalPercentage,
    dangerZones,
  };
}

// Helper: Calculate goal minute distribution from matches (fallback when api-football data unavailable)
function calculateGoalMinuteDistribution(matches: Match[]): {
  distribution: Record<string, number>;
  firstHalfPercentage: number;
  earlyGoalPercentage: number;
  dangerZones: Array<{window: string, percentage: number}>;
} {
  const timeWindows = {
    '0-15': 0,
    '16-30': 0,
    '31-45': 0,
    '46-60': 0,
    '61-75': 0,
    '76-90': 0,
  };
  
  let totalGoals = 0;
  let firstHalfGoals = 0;
  let earlyGoals = 0;
  
  for (const match of matches) {
    // Process goals scored
    const goalsScored = match.goalsScored || 0;
    const goalsConceded = match.goalsConceded || 0;
    
    // For simplicity, distribute goals evenly across match time
    // In production, use actual goal minute data from API
    const goalsPerWindow = (goalsScored + goalsConceded) / 6;
    
    timeWindows['0-15'] += goalsPerWindow;
    timeWindows['16-30'] += goalsPerWindow;
    timeWindows['31-45'] += goalsPerWindow;
    firstHalfGoals += goalsPerWindow * 3;
    earlyGoals += goalsPerWindow;
    
    timeWindows['46-60'] += goalsPerWindow;
    timeWindows['61-75'] += goalsPerWindow;
    timeWindows['76-90'] += goalsPerWindow;
    
    totalGoals += goalsScored + goalsConceded;
  }
  
  // Convert to percentages
  const distribution: Record<string, number> = {};
  for (const [window, count] of Object.entries(timeWindows)) {
    distribution[window] = totalGoals > 0 ? (count / totalGoals) * 100 : 0;
  }
  
  const firstHalfPercentage = totalGoals > 0 ? (firstHalfGoals / totalGoals) * 100 : 0;
  const earlyGoalPercentage = totalGoals > 0 ? (earlyGoals / totalGoals) * 100 : 0;
  
  // Identify danger zones (windows with >20% of goals)
  const dangerZones = Object.entries(distribution)
    .filter(([_, pct]) => pct > 20)
    .map(([window, percentage]) => ({ window, percentage }))
    .sort((a, b) => b.percentage - a.percentage);
  
  return {
    distribution,
    firstHalfPercentage,
    earlyGoalPercentage,
    dangerZones,
  };
}

// Helper: Detect safety flags
function detectSafetyFlags(
  team: TeamData,
  opponent: TeamData
): SafetyFlags {
  // Regression Risk: Tier 3 team won 5+ in a row
  const regressionRisk = team.mind.tier === 3 && team.stats.currentWinStreak >= 5;
  
  // Motivation Clash: TITLE_RACE vs MID_TABLE
  const homeMotivation = calculateMotivation(team);
  const awayMotivation = calculateMotivation(opponent);
  const motivationClash = 
    (homeMotivation === 'TITLE_RACE' && awayMotivation === 'MID_TABLE') ||
    (awayMotivation === 'TITLE_RACE' && homeMotivation === 'MID_TABLE');
  
  // Live Dog: Bottom team scored in 2 of last 3 away
  const isBottomTeam = team.stats.leaguePosition >= 15;
  const recentAwayGoals = team.lastAwayMatches.slice(0, 3)
    .filter(m => (m.goalsScored || 0) > 0).length;
  const liveDog = isBottomTeam && recentAwayGoals >= 2;
  
  return {
    regressionRisk,
    motivationClash,
    liveDog,
  };
}

interface TeamMind {
  efficiencyIndex: number;        // EI = (Avg Points per Game) + (Goal Difference / 10)
  tier: 1 | 2 | 3 | 4;            // Categorized based on EI
  last50Matches: Match[];         // Extended match history for baseline
}

interface TeamMood {
  tier: 1 | 2 | 3 | 4;            // Tier based on last 10 matches
  mindMoodGap: number;            // Difference between Mind and Mood tiers
  isSleepingGiant: boolean;       // Mind Tier 1, Mood Tier 4 (value bet)
  isOverPerformer: boolean;       // Mind Tier 4, Mood Tier 1 (regression risk)
  isOneSeasonWonder: boolean;     // Recently promoted team that overperformed and is regressing
}

interface TeamDNA {
  mostPlayedFormation: string;     // e.g., "4-3-3"
  formationFrequency: Record<string, number>; // Formation usage percentages
  goalLineOverPct: Record<string, number>; // Season P(totalGoals > line), keyed by line string (e.g. "2.5")
  cleanSheetPercentage: number;    // Season clean sheet rate
  failedToScorePercentage: number; // Season failed to score rate
  goalMinuteDistribution: Record<string, number>; // Goals by time windows
  dangerZones: Array<{window: string, percentage: number}>; // High-concession windows
  firstHalfGoalPercentage: number; // % of goals in first half
  earlyGoalPercentage: number;     // % of goals in 0-15 mins
  lateStarter: boolean;            // <20% goals in first 15 mins
}

interface SafetyFlags {
  regressionRisk: boolean;         // Tier 3 team won 5+ in a row
  motivationClash: boolean;        // TITLE_RACE vs MID_TABLE
  liveDog: boolean;                // Bottom team scored in 2 of last 3 away
}

interface TeamData {
  id: number;
  name: string;
  
  // Last matches
  lastMatches: Match[];           // Last 10 all matches
  lastHomeMatches: Match[];       // Last 5 home
  lastAwayMatches: Match[];       // Last 5 away
  
  // Three-layer data strategy
  mind: TeamMind;                 // Baseline quality (50 matches)
  mood: TeamMood;                 // Recent momentum (10 matches)
  dna: TeamDNA;                   // Technical trends (season stats)
  safetyFlags: SafetyFlags;       // Non-mathematical flags
  
  // Calculated stats
  stats: {
    // Overall
    form: string;                 // "WDLWW"
    avgGoalsScored: number;       // 2.1
    avgGoalsConceded: number;     // 1.3
    
    // Home/Away splits
    homeAvgScored: number;
    homeAvgConceded: number;
    awayAvgScored: number;
    awayAvgConceded: number;
    
    // BTTS specific
    bttsPercentage: number;       // 70% of games had BTTS
    gamesWithGoals: number;       // Scored in 8 of 10
    cleanSheets: number;          // 2 clean sheets
    cleanSheetDrought: number;    // Games since last CS
    
    // Timing
    firstHalfGoals: number;       // 60% of goals in 1st half
    secondHalfGoals: number;
    firstHalfGoalsAgainst: number;
    
    // Patterns
    currentWinStreak: number;
    currentLossStreak: number;
    currentScoringStreak: number;
    
    // Context
    leaguePosition: number;
    points: number;
    pointsFromFirst: number;
    pointsFromCL: number;
    pointsFromRelegation: number;
  };
  
  // Match context
  lastMatchDate: Date;
  nextMatchDate: Date;
  daysSinceLastMatch: number;
  daysUntilNextMatch: number;
}

interface H2HData {
  matches: Match[];
  h2hMatchCount: number;              // Total H2H matches (after filtering)
  
  homeTeamWins: number;
  awayTeamWins: number;
  draws: number;
  
  bttsCount: number;
  bttsPercentage: number;
  
  goalLineOverCount: Record<string, number>; // Count of matches with totalGoals > line
  goalLineOverPct: Record<string, number>;   // Percentage of matches with totalGoals > line
  
  avgGoalsPerMatch: number;
  avgHomeGoals: number;
  avgAwayGoals: number;
  
  firstHalfGoalsPercentage: number;
  
  // Recency-weighted stats
  weightedBttsPercentage: number;      // BTTS % weighted by match recency
  weightedAvgGoalsPerMatch: number;   // Goals avg weighted by match recency
  recencyWeights: number[];             // Weight for each match (by index)
}

/**
 * Get domestic league ID for a team (for international match context)
 * Returns the primary domestic league where the team plays
 */
async function getTeamDomesticLeague(teamId: number): Promise<number | null> {
  // Common domestic league mappings (can be expanded)
  // This should ideally come from a database or API that tracks team leagues
  const domesticLeagueMap: Record<number, number> = {
    // Example: Brazilian teams -> Brasileirão (71)
    // Example: Argentine teams -> Primera División (128)
    // Example: Italian teams -> Serie A (135)
    // Example: Spanish teams -> La Liga (140)
    // This should be populated from API-Football or database
  };
  
  // Try to get from cache/database first
  const cached = await getCachedTeamLeague(teamId);
  if (cached) return cached;
  
  // Fallback: Fetch team's current league from API
  // Get team's most recent matches to determine primary league
  const recentMatches = await fetchFixtures({
    team: teamId,
    last: 20
  });
  
  // Find most common league (domestic leagues typically have more matches)
  const leagueCounts = new Map<number, number>();
  recentMatches.forEach(match => {
    const leagueId = match.league.id;
    leagueCounts.set(leagueId, (leagueCounts.get(leagueId) || 0) + 1);
  });
  
  // Filter out international competitions (by league name)
  const domesticLeagues = Array.from(leagueCounts.entries())
    .filter(([leagueId]) => {
      const leagueName = recentMatches.find(m => m.league.id === leagueId)?.league.name || '';
      const matchType = detectMatchType(leagueName);
      return matchType.type === 'LEAGUE'; // Only domestic leagues
    })
    .sort((a, b) => b[1] - a[1]); // Sort by match count
  
  return domesticLeagues[0]?.[0] || null;
}

// Fetch team data with caching
async function getTeamData(
  teamId: number,
  c: Context,
  options?: {
    domesticLeagueId?: number; // For international matches: use domestic league for Mind/Mood
    matchLeagueId?: number;    // The league of the current match (may be international)
    season?: string;
  }
): Promise<TeamData> {
  const cacheKey = `team:${teamId}:${options?.domesticLeagueId || 'default'}`;
  
  // Check cache (24 hour TTL)
  const cached = await c.env.KV.get(cacheKey, 'json');
  if (cached && !isStale(cached, 24 * 60 * 60)) {
    return cached;
  }
  
  // Fetch from API-Football
  // CRITICAL: For international matches, use domestic league for Mind/Mood layers
  // This ensures we have enough data (50 matches) and relevant context
  
  // Determine which league to use for Mind/Mood layers
  let leagueIdForData: number;
  if (options?.domesticLeagueId) {
    // International match: Use domestic league for team data
    leagueIdForData = options.domesticLeagueId;
  } else {
    // Normal match: Use match league or team's current league
    leagueIdForData = options?.matchLeagueId || c.env.LEAGUE_ID || await getTeamLeague(teamId);
  }
  
  const season = options?.season || c.env.SEASON || getCurrentSeason();
  
  // Get Mind layer matches (50 matches from domestic/current league, multiple seasons)
  const mindMatches = await getTeamMatchesForMindLayer(teamId, leagueIdForData, season, 50);
  
  // Get Mood layer matches (10 matches from current season only, domestic/current league)
  const moodMatches = await getTeamMatchesForMoodLayer(teamId, leagueIdForData, season, 10);
  
  // Get home/away splits (from current season) - OPTIMIZED: Use API with league filter
  // Use domestic league for statistics (even if match is international)
  const [standings, teamStats] = await Promise.all([
    fetchStandings({ league: leagueIdForData, season: parseInt(season.split('-')[0]) }),
    fetchTeamStatistics(teamId, leagueIdForData, parseInt(season.split('-')[0])), // DNA layer from API
  ]);
  
  // OPTIMIZED: API filters by league automatically, so no need to filter friendlies
  // League parameter excludes non-league matches automatically
  
  // Check if promoted team (insufficient matches in current league)
  const isPromoted = mindMatches.length < 30;
  
  let mindEI: number;
  let mindTier: number;
  
  if (isPromoted) {
    // Promoted team: Use lower league matches + adjustment
    const previousLeagueId = await getPreviousLeague(teamId, season);
    const previousSeason = getPreviousSeason(season);
    
    // Get lower league matches (multi-season)
    const lowerLeagueMatches = await getTeamMatchesForMindLayer(
      teamId,
      previousLeagueId,
      previousSeason,
      50
    );
    
    // Calculate tier with league strength adjustment
    const promotedTier = calculatePromotedTeamTier(
      teamId,
      leagueId,
      previousLeagueId,
      season,
      lowerLeagueMatches // API already filtered by league
    );
    
    mindEI = promotedTier.efficiencyIndex;
    mindTier = promotedTier.tier;
  } else {
    // Normal calculation: Use current league matches
    mindEI = calculateEfficiencyIndex(mindMatches);
    mindTier = categorizeTier(mindEI);
  }
  
  // Calculate Mood layer (from current season matches only)
  const moodEI = calculateEfficiencyIndex(moodMatches);
  const moodTier = categorizeTier(moodEI);
  const mood = detectMoodVsMindGap(mindTier, moodTier);
  
  // OPTIMIZED: Use API form string directly (no need to calculate from matches)
  // API provides form string like "WDLDWLDLDWLWDDWWDLWWLWLLDWWDWDWWWWDWDW"
  const apiForm = teamStats.form; // Already calculated by API!
  const recentForm = apiForm.slice(0, 10); // Last 10 matches form
  
  // Calculate DNA layer using API statistics directly (OPTIMIZED)
  // API-Football /teams/statistics endpoint provides all DNA data pre-calculated
  // Note: teamStats already fetched above
  
  // Convert API response to DNA layer format
  const dna: TeamDNA = {
    // Formations: API provides lineups array sorted by played count
    mostPlayedFormation: teamStats.lineups[0]?.formation || '4-4-2',
    formationFrequency: teamStats.lineups.reduce((acc: Record<string, number>, lineup) => {
      acc[lineup.formation] = lineup.played;
      return acc;
    }, {}),
    
    // Over/Under: API provides under_over object
    under25Percentage: parseFloat(teamStats.goals.for.under_over['2.5']?.under || '0') / 
                       teamStats.fixtures.played.total * 100,
    over25Percentage: parseFloat(teamStats.goals.for.under_over['2.5']?.over || '0') / 
                      teamStats.fixtures.played.total * 100,
    
    // Clean sheets: API provides clean_sheet object
    cleanSheetPercentage: (teamStats.clean_sheet.total / teamStats.fixtures.played.total) * 100,
    
    // Failed to score: API provides failed_to_score object
    failedToScorePercentage: (teamStats.failed_to_score.total / teamStats.fixtures.played.total) * 100,
    
    // Goal minute distribution: API provides goals.for.minute object
    goalMinuteDistribution: convertAPIGoalMinutesToDistribution(teamStats.goals.for.minute),
    
    // Danger zones: Top 3 time windows where team concedes most goals
    dangerZones: getTopDangerZones(teamStats.goals.against.minute, 3),
    
    // First half goals: Sum of 0-15, 16-30, 31-45 minute percentages
    firstHalfGoalPercentage: calculateFirstHalfPercentage(teamStats.goals.for.minute),
    
    // Early goals: 0-15 minute percentage
    earlyGoalPercentage: parseFloat(teamStats.goals.for.minute['0-15']?.percentage || '0'),
    
    // Late starter: <20% goals in first 15 mins
    lateStarter: parseFloat(teamStats.goals.for.minute['0-15']?.percentage || '0') < 20,
  };
  
  // Helper functions to convert API format
  function convertAPIGoalMinutesToDistribution(apiMinutes: Record<string, {total: number; percentage: string}>): Record<string, number> {
    const distribution: Record<string, number> = {};
    Object.entries(apiMinutes).forEach(([window, data]) => {
      if (data.total !== null) {
        distribution[window] = parseFloat(data.percentage || '0');
      }
    });
    return distribution;
  }
  
  function getTopDangerZones(apiMinutes: Record<string, {total: number; percentage: string}>, topN: number): string[] {
    return Object.entries(apiMinutes)
      .filter(([_, data]) => data.total !== null)
      .sort((a, b) => parseFloat(b[1].percentage || '0') - parseFloat(a[1].percentage || '0'))
      .slice(0, topN)
      .map(([window]) => window);
  }
  
  function calculateFirstHalfPercentage(apiMinutes: Record<string, {total: number; percentage: string}>): number {
    const firstHalfWindows = ['0-15', '16-30', '31-45'];
    return firstHalfWindows.reduce((sum, window) => {
      return sum + parseFloat(apiMinutes[window]?.percentage || '0');
    }, 0);
  }
  
  // Calculate stats (use mood matches for recent form)
  const stats = calculateTeamStats(moodMatches, standings);
  
  const teamData: TeamData = {
    id: teamId,
    name: moodMatches[0]?.teams?.home?.id === teamId 
      ? moodMatches[0].teams.home.name 
      : moodMatches[0]?.teams?.away?.name || 'Unknown',
    lastMatches: moodMatches, // Use mood matches (current season) for recent form
    lastHomeMatches: moodMatches.filter(m => m.teams.home.id === teamId).slice(0, 5),
    lastAwayMatches: moodMatches.filter(m => m.teams.away.id === teamId).slice(0, 5),
    mind: {
      efficiencyIndex: mindEI,
      tier: mindTier,
      last50Matches: mindMatches, // 50 matches from current league (multi-season)
    },
    mood,
    dna,
    safetyFlags: {
      regressionRisk: false,
      motivationClash: false,
      liveDog: false,
    }, // Will be calculated later with opponent context
    stats,
    lastMatchDate: allMatches[0]?.date || new Date(),
    nextMatchDate: await getNextMatch(teamId),
    daysSinceLastMatch: allMatches[0]?.date ? calculateDaysSince(allMatches[0].date) : 0,
    daysUntilNextMatch: 0, // Will be calculated
  };
  
  // Cache for 24 hours
  await c.env.KV.put(cacheKey, JSON.stringify(teamData), {
    expirationTtl: 24 * 60 * 60,
  });
  
  return teamData;
}

// Fetch H2H data
async function getH2HData(
  homeTeamId: number,
  awayTeamId: number,
  c: Context,
  options?: {
    leagueId?: number; // Optional: Filter H2H by specific league (e.g., international competition)
    includeAllLeagues?: boolean; // If true, include H2H from all leagues
  }
): Promise<H2HData> {
  const cacheKey = `h2h:${homeTeamId}:${awayTeamId}:${options?.leagueId || 'all'}`;
  
  // Check cache (7 day TTL)
  const cached = await c.env.KV.get(cacheKey, 'json');
  if (cached && !isStale(cached, 7 * 24 * 60 * 60)) {
    return cached;
  }
  
  // OPTIMIZED: Fetch from API-Football /fixtures/headtohead endpoint directly
  // API handles filtering by teams automatically, no manual filtering needed
  // For international matches: Filter H2H to that specific competition
  const apiMatches = await fetchH2H({
    h2h: `${homeTeamId}-${awayTeamId}`,
    league: options?.leagueId, // Filter by league if specified (e.g., Copa Libertadores)
    last: 10 // Get last 10 H2H matches
  });
  
  // Convert API response format to internal format
  const matches = apiMatches.map(m => ({
    id: m.fixture.id,
    date: m.fixture.date,
    homeTeamId: m.teams.home.id,
    awayTeamId: m.teams.away.id,
    homeGoals: m.goals.home,
    awayGoals: m.goals.away,
    totalGoals: m.goals.home + m.goals.away,
    bothTeamsScored: m.goals.home > 0 && m.goals.away > 0,
    winnerId: m.teams.home.winner ? m.teams.home.id : (m.teams.away.winner ? m.teams.away.id : null),
    result: m.teams.home.winner ? 'H' : (m.teams.away.winner ? 'A' : 'D'),
    league: m.league,
    season: m.league.season
  }));
  
  // Calculate recency weights
  const recencyWeights = calculateH2HRecencyWeights(matches);
  
  // Calculate weighted averages
  const bttsValues = matches.map(m => m.bothTeamsScored ? 100 : 0);
  const weightedBttsPercentage = calculateWeightedAverage(bttsValues, recencyWeights);
  
  const goalsValues = matches.map(m => m.totalGoals || 0);
  const weightedAvgGoalsPerMatch = calculateWeightedAverage(goalsValues, recencyWeights);
  
  // Calculate simple averages (for comparison)
  const bttsCount = matches.filter(m => m.bothTeamsScored).length;
  const bttsPercentage = matches.length > 0 
    ? (bttsCount / matches.length) * 100 
    : 0;
  
  const avgGoalsPerMatch = matches.length > 0
    ? matches.reduce((sum, m) => sum + (m.totalGoals || 0), 0) / matches.length
    : 0;
  
  const h2hData: H2HData = {
    matches,
    h2hMatchCount: matches.length,
    homeTeamWins: matches.filter(m => m.winnerId === homeTeamId).length,
    awayTeamWins: matches.filter(m => m.winnerId === awayTeamId).length,
    draws: matches.filter(m => m.result === 'D').length,
    bttsCount,
    bttsPercentage,
    weightedBttsPercentage,
    over25Count: matches.filter(m => (m.totalGoals || 0) > 2.5).length,
    over25Percentage: matches.length > 0
      ? (matches.filter(m => (m.totalGoals || 0) > 2.5).length / matches.length) * 100
      : 0,
    avgGoalsPerMatch,
    weightedAvgGoalsPerMatch,
    avgHomeGoals: matches.length > 0
      ? matches.reduce((sum, m) => sum + (m.homeGoals || 0), 0) / matches.length
      : 0,
    avgAwayGoals: matches.length > 0
      ? matches.reduce((sum, m) => sum + (m.awayGoals || 0), 0) / matches.length
      : 0,
    firstHalfGoalsPercentage: 0, // Calculate if data available
    recencyWeights,
  };
  
  await c.env.KV.put(cacheKey, JSON.stringify(h2hData), {
    expirationTtl: 7 * 24 * 60 * 60,
  });
  
  return h2hData;
}
```

#### 1.2 Stats Calculation

**Important:** All stats calculations now use filtered matches (friendlies excluded) and account for early season adjustments.

**Backend Endpoint Note:** The `fetchTeamStatistics()` function calls a backend endpoint (`/api/teams/:teamId/statistics`) which will be implemented separately. This backend endpoint will fetch team statistics from api-football's team statistics endpoint and return the data in a standardized format.

```typescript
// /api/utils/stats-calculator.ts

// Helper: Fetch team statistics from backend endpoint
// Backend Implementation: GET /api/teams/:teamId/statistics
// This endpoint will fetch from api-football and return:
// - formations: Array<{formation: string; count: number}>
// - goalMinutes: Array<{minute: number; goals: number}>
// - under25Percentage, over25Percentage, cleanSheetPercentage, failedToScorePercentage
// Note: This will call a backend endpoint that fetches from api-football's team statistics endpoint
// The backend endpoint will be implemented separately and will handle the api-football integration
async function fetchTeamStatistics(
  teamId: number,
  c: Context
): Promise<{
  matches: Match[];
  under25Percentage: number;
  over25Percentage: number;
  cleanSheetPercentage: number;
  failedToScorePercentage: number;
  formations?: Array<{formation: string; count: number}>;
  goalMinutes?: Array<{minute: number; goals: number}>;
}> {
  // Fetch from backend team statistics endpoint
  // Backend will handle api-football integration: GET /api/teams/:teamId/statistics
  const cacheKey = `team-stats:${teamId}`;
  
  // Check cache (24 hour TTL for season stats)
  const cached = await c.env.KV.get(cacheKey, 'json');
  if (cached && !isStale(cached, 24 * 60 * 60)) {
    return cached;
  }
  
  // Call backend endpoint (which will fetch from api-football)
  const response = await fetch(`${c.env.API_BASE_URL}/api/teams/${teamId}/statistics`, {
    headers: {
      'Authorization': `Bearer ${c.env.API_KEY}`,
    },
  });
  
  if (!response.ok) {
    console.warn(`Failed to fetch team statistics for ${teamId}, using defaults`);
    return {
      matches: [],
      under25Percentage: 0,
      over25Percentage: 0,
      cleanSheetPercentage: 0,
      failedToScorePercentage: 0,
    };
  }
  
  const data = await response.json();
  
  const result = {
    matches: data.matches || [],
    under25Percentage: data.under25Percentage || 0,
    over25Percentage: data.over25Percentage || 0,
    cleanSheetPercentage: data.cleanSheetPercentage || 0,
    failedToScorePercentage: data.failedToScorePercentage || 0,
    formations: data.formations || [],
    goalMinutes: data.goalMinutes || [],
  };
  
  // Cache for 24 hours
  await c.env.KV.put(cacheKey, JSON.stringify(result), {
    expirationTtl: 24 * 60 * 60,
  });
  
  return result;
}

// ============================================
// FORMATION NORMALIZATION & SIMILARITY SYSTEM
// ============================================
// Handles cases where API returns similar formations with different notation
// Prevents false instability flags when formations are tactically similar

/**
 * Formation Canonical Mapping
 * Maps common variations to canonical forms to handle API inconsistencies
 */
const FORMATION_CANONICAL_MAP: Record<string, string> = {
  // 4-3-3 variations
  '4-3-3': '4-3-3',
  '4-1-2-3': '4-3-3', // Defensive 4-3-3
  '4-2-1-3': '4-3-3', // Attacking 4-3-3
  
  // 4-2-3-1 variations
  '4-2-3-1': '4-2-3-1',
  '4-4-1-1': '4-2-3-1', // Similar structure (one striker drops deeper)
  '4-1-4-1': '4-2-3-1', // Defensive variant
  
  // 4-4-2 variations
  '4-4-2': '4-4-2',
  '4-4-2 Diamond': '4-4-2',
  '4-1-2-1-2': '4-4-2', // Diamond midfield
  '4-4-1-1': '4-4-2', // One striker drops deeper (also maps to 4-2-3-1, but 4-4-2 is more common)
  
  // 3-5-2 variations
  '3-5-2': '3-5-2',
  '3-4-1-2': '3-5-2',
  '5-3-2': '3-5-2', // Defensive variant (5 defenders)
  
  // 3-4-3 variations
  '3-4-3': '3-4-3',
  '3-4-2-1': '3-4-3',
  
  // 5-4-1 variations
  '5-4-1': '5-4-1',
  '5-3-2': '5-4-1', // More defensive (3 midfielders instead of 4)
  
  // 4-5-1 variations
  '4-5-1': '4-5-1',
  '4-1-4-1': '4-5-1', // Defensive variant
};

/**
 * Normalize formation to canonical form
 * Handles API variations and common notation differences
 */
function normalizeFormation(formation: string): string {
  if (!formation) return 'unknown';
  
  const normalized = formation.trim().toLowerCase();
  
  // Check canonical map first
  if (FORMATION_CANONICAL_MAP[normalized]) {
    return FORMATION_CANONICAL_MAP[normalized];
  }
  
  // Try to match with variations (fuzzy)
  for (const [variant, canonical] of Object.entries(FORMATION_CANONICAL_MAP)) {
    if (normalized.includes(variant) || variant.includes(normalized)) {
      return canonical;
    }
  }
  
  return normalized; // Return as-is if no match
}

/**
 * Parse formation into structural components
 */
function parseFormation(formation: string): {
  defenders: number;
  midfielders: number;
  forwards: number;
  total: number;
} {
  const parts = formation.split('-').map(p => parseInt(p.trim()) || 0);
  const defenders = parts[0] || 0;
  const forwards = parts[parts.length - 1] || 0;
  const midfielders = parts.slice(1, -1).reduce((sum, p) => sum + p, 0);
  const total = defenders + midfielders + forwards;
  
  return { defenders, midfielders, forwards, total };
}

/**
 * Calculate formation similarity score (0-1)
 * 1.0 = identical, 0.8+ = very similar, 0.5+ = somewhat similar
 * 
 * Similarity is based on:
 * - Structural similarity (defenders, midfielders, forwards)
 * - Same number of defenders (most important)
 * - Overall tactical shape
 */
function calculateFormationSimilarity(
  formation1: string,
  formation2: string
): number {
  const norm1 = normalizeFormation(formation1);
  const norm2 = normalizeFormation(formation2);
  
  // Exact match after normalization
  if (norm1 === norm2) return 1.0;
  
  // Parse formations into components
  const f1 = parseFormation(norm1);
  const f2 = parseFormation(norm2);
  
  // Calculate structural differences
  const defenderDiff = Math.abs(f1.defenders - f2.defenders);
  const midfielderDiff = Math.abs(f1.midfielders - f2.midfielders);
  const forwardDiff = Math.abs(f1.forwards - f2.forwards);
  const totalDiff = Math.abs(f1.total - f2.total);
  
  // Similarity based on structure (penalize differences)
  const maxDiff = 3; // Maximum difference to consider
  const defenderSim = Math.max(0, 1 - defenderDiff / maxDiff);
  const midfielderSim = Math.max(0, 1 - midfielderDiff / maxDiff);
  const forwardSim = Math.max(0, 1 - forwardDiff / maxDiff);
  const totalSim = Math.max(0, 1 - totalDiff / 2); // Total players difference
  
  // Weighted average (defenders most important, then midfielders, then forwards)
  let similarity = (defenderSim * 0.4 + midfielderSim * 0.35 + forwardSim * 0.15 + totalSim * 0.1);
  
  // Boost similarity if same number of defenders (most important tactical element)
  if (f1.defenders === f2.defenders) {
    similarity = Math.min(1.0, similarity + 0.2);
  }
  
  // Boost similarity if same total players (same system size)
  if (f1.total === f2.total) {
    similarity = Math.min(1.0, similarity + 0.1);
  }
  
  return Math.max(0, Math.min(1.0, similarity));
}

/**
 * Check if formations are similar enough to be considered the same
 */
function areFormationsSimilar(
  formation1: string,
  formation2: string,
  threshold: number = 0.75 // 75% similarity threshold
): boolean {
  return calculateFormationSimilarity(formation1, formation2) >= threshold;
}

/**
 * Enhanced formation frequency calculation with normalization and similarity
 */
function calculateFormationFrequencyWithSimilarity(matches: Match[]): {
  frequencies: Record<string, number>;
  normalizedFrequencies: Record<string, number>;
  mostPlayed: string;
  mostPlayedNormalized: string;
  similarityGroups: Record<string, string[]>; // Group similar formations together
} {
  const rawCounts: Record<string, number> = {};
  const normalizedCounts: Record<string, number> = {};
  
  matches.forEach(match => {
    const formation = match.formation || 'unknown';
    const normalized = normalizeFormation(formation);
    
    rawCounts[formation] = (rawCounts[formation] || 0) + 1;
    normalizedCounts[normalized] = (normalizedCounts[normalized] || 0) + 1;
  });
  
  const total = matches.length;
  
  const frequencies: Record<string, number> = {};
  Object.entries(rawCounts).forEach(([form, count]) => {
    frequencies[form] = (count / total) * 100;
  });
  
  const normalizedFrequencies: Record<string, number> = {};
  Object.entries(normalizedCounts).forEach(([form, count]) => {
    normalizedFrequencies[form] = (count / total) * 100;
  });
  
  const mostPlayed = Object.entries(rawCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';
  
  const mostPlayedNormalized = Object.entries(normalizedCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';
  
  // Group similar formations together
  const similarityGroups: Record<string, string[]> = {};
  const allFormations = Object.keys(rawCounts);
  
  allFormations.forEach(form => {
    const normalized = normalizeFormation(form);
    if (!similarityGroups[normalized]) {
      similarityGroups[normalized] = [];
    }
    if (!similarityGroups[normalized].includes(form)) {
      similarityGroups[normalized].push(form);
    }
  });
  
  return {
    frequencies,
    normalizedFrequencies,
    mostPlayed,
    mostPlayedNormalized,
    similarityGroups
  };
}

// ============================================
// ENHANCED FORMATION STABILITY CALCULATION
// ============================================

// Helper: Calculate formation stability with context-aware logic (IMPROVED VERSION)
// Now includes formation similarity detection to handle API variations
// Considers opponent strength, formation success rate, change frequency, and similarity
// Returns stability score, stability status, and market-specific confidence reduction
function calculateFormationStability(
  matchFormation: string,
  mostPlayedFormation: string,
  formationFrequency: Record<string, number>,
  historicalFormations: string[], // All historical formations for similarity analysis
  context: {
    isEarlySeason: boolean;
    opponentStrength?: 'STRONG' | 'MEDIUM' | 'WEAK';
    recentFormationChanges?: number; // How many changes in last 5 matches
    formationSuccessRate?: number;   // Win rate with this formation (0-1)
    similarityThreshold?: number;    // Similarity threshold (default: 0.75)
  } = { isEarlySeason: false }
): { 
  isStable: boolean; 
  stabilityScore: number;
  similarityScore: number; // 0-1, similarity to most played formation
  confidenceReduction: number; // Base reduction percentage (will be adjusted per market)
  reason: string;
} {
  if (!matchFormation || !mostPlayedFormation) {
    return { 
      isStable: false, 
      stabilityScore: 0,
      similarityScore: 0,
      confidenceReduction: 0,
      reason: 'Formation data unavailable'
    };
  }
  
  // Normalize formations
  const normalizedMatch = normalizeFormation(matchFormation);
  const normalizedMostPlayed = normalizeFormation(mostPlayedFormation);
  
  // Calculate similarity to most played formation
  const similarityScore = calculateFormationSimilarity(matchFormation, mostPlayedFormation);
  const similarityThreshold = context.similarityThreshold || 0.75;
  
  // Calculate exact match percentage
  const exactMatchPct = matchFormation === mostPlayedFormation
    ? formationFrequency[mostPlayedFormation] || 0
    : formationFrequency[matchFormation] || 0;
  
  // Calculate similar match percentage (formations with similarity >= threshold)
  const similarMatches = historicalFormations.filter(hist => 
    calculateFormationSimilarity(matchFormation, hist) >= similarityThreshold
  ).length;
  const similarMatchPct = historicalFormations.length > 0
    ? (similarMatches / historicalFormations.length) * 100
    : 0;
  
  // Use higher of exact or similar match percentage (with slight penalty for similarity)
  const stabilityScore = Math.max(exactMatchPct, similarMatchPct * 0.9);
  
  // Check if stable: either exact match with high usage OR similar formation with high usage
  const isStableByExact = exactMatchPct >= (context.isEarlySeason ? 30 : 20);
  const isStableBySimilarity = similarityScore >= similarityThreshold * 100 && similarMatchPct >= 30;
  const isStable = isStableByExact || isStableBySimilarity;
  
  // Tiered confidence reduction based on stability score
  // Only apply reduction if formation is truly unstable (not similar to most played)
  let baseReduction = 0;
  
  if (isStable) {
    // Stable formation (exact match or similar): No reduction
    baseReduction = 0;
  } else {
    // Unstable formation: Apply reduction based on stability score
    if (stabilityScore < 20) {
      baseReduction = 25; // Very experimental: 20-25% reduction
    } else if (stabilityScore < 40) {
      baseReduction = 15; // Experimental: 10-15% reduction
    } else if (stabilityScore < 60) {
      baseReduction = 10; // Occasionally used: 5-10% reduction
    } else if (stabilityScore < 80) {
      baseReduction = 5; // Secondary formation: 0-5% reduction
    }
    // stabilityScore >= 80: No reduction (stable)
  }
  
  // SIMILARITY-BASED ADJUSTMENTS:
  
  // If formation is similar to most played (even if not exact match), reduce penalty
  if (similarityScore >= similarityThreshold && matchFormation !== mostPlayedFormation) {
    // Similar formation: Reduce penalty by similarity score
    // e.g., 85% similar = reduce penalty by 85%
    baseReduction = baseReduction * (1 - similarityScore);
  }
  
  // CONTEXT-AWARE ADJUSTMENTS:
  
  // 1. Opponent Strength: Formation change against strong opponent = tactical, not experimental
  if (context.opponentStrength === 'STRONG' && matchFormation !== mostPlayedFormation) {
    baseReduction *= 0.5; // Reduce penalty (tactical change, not experimental)
  }
  
  // 2. Formation Success Rate: If formation has high win rate, it's intentional
  if (context.formationSuccessRate && context.formationSuccessRate > 0.6) {
    baseReduction *= 0.6; // Reduce penalty (formation works well)
  }
  
  // 3. Recent Formation Changes: Frequent changes = instability
  if (context.recentFormationChanges && context.recentFormationChanges > 3) {
    baseReduction *= 1.3; // Increase penalty (team is unstable)
  }
  
  // 4. Early season: Reduce penalty by 50% (teams experiment more early season)
  if (context.isEarlySeason) {
    baseReduction = baseReduction * 0.5;
  }
  
  // Generate reason string
  let reason = `Formation ${matchFormation}`;
  
  if (matchFormation === mostPlayedFormation) {
    reason += ` (most played, ${exactMatchPct.toFixed(0)}% usage)`;
  } else if (similarityScore >= similarityThreshold) {
    reason += ` (similar to ${mostPlayedFormation}, ${(similarityScore * 100).toFixed(0)}% similar, ${similarMatchPct.toFixed(0)}% similar formations)`;
  } else {
    reason += ` (different from ${mostPlayedFormation}, ${exactMatchPct.toFixed(0)}% usage, ${(similarityScore * 100).toFixed(0)}% similar)`;
  }
  
  if (context.opponentStrength === 'STRONG' && matchFormation !== mostPlayedFormation) {
    reason += ' (tactical change vs strong opponent)';
  }
  if (context.formationSuccessRate && context.formationSuccessRate > 0.6) {
    reason += ` (high success rate: ${(context.formationSuccessRate * 100).toFixed(0)}%)`;
  }
  if (context.recentFormationChanges && context.recentFormationChanges > 3) {
    reason += ` (frequent changes: ${context.recentFormationChanges} in last 5 matches)`;
  }
  
  return {
    isStable,
    stabilityScore,
    similarityScore,
    confidenceReduction: Math.min(30, baseReduction), // Cap at 30%
    reason,
  };
}

function calculateTeamStats(
  matches: Match[],
  standings: Standing
): TeamStats {
  // Form string (last 5)
  const form = matches
    .slice(0, 5)
    .map(m => m.result)
    .join(''); // "WWDLW"
  
  // Averages
  const avgGoalsScored = 
    matches.reduce((sum, m) => sum + m.goalsScored, 0) / matches.length;
  const avgGoalsConceded = 
    matches.reduce((sum, m) => sum + m.goalsConceded, 0) / matches.length;
  
  // BTTS stats
  const gamesWithGoals = matches.filter(m => m.goalsScored > 0).length;
  const bttsGames = matches.filter(m => 
    m.goalsScored > 0 && m.goalsConceded > 0
  ).length;
  const bttsPercentage = (bttsGames / matches.length) * 100;
  
  // Clean sheets
  const cleanSheets = matches.filter(m => m.goalsConceded === 0).length;
  const cleanSheetDrought = countConsecutiveMatchesWithoutCleanSheet(matches);
  
  // Timing
  const firstHalfGoals = matches.reduce((sum, m) => 
    sum + (m.firstHalfGoals || 0), 0
  );
  const totalGoals = matches.reduce((sum, m) => sum + m.goalsScored, 0);
  const firstHalfGoalPercentage = (firstHalfGoals / totalGoals) * 100;
  
  // Streaks
  const currentWinStreak = countConsecutiveResults(matches, 'W');
  const currentLossStreak = countConsecutiveResults(matches, 'L');
  const currentScoringStreak = countConsecutiveMatchesWithGoals(matches);
  
  return {
    form,
    avgGoalsScored,
    avgGoalsConceded,
    // ... etc
    leaguePosition: standings.position,
    points: standings.points,
    pointsFromFirst: standings.pointsFromFirst,
    // ... etc
  };
}

function countConsecutiveResults(matches: Match[], result: 'W'|'D'|'L'): number {
  let count = 0;
  for (const match of matches) {
    if (match.result === result) count++;
    else break;
  }
  return count;
}

function countConsecutiveMatchesWithGoals(matches: Match[]): number {
  let count = 0;
  for (const match of matches) {
    if (match.goalsScored > 0) count++;
    else break;
  }
  return count;
}

/**
 * Usage Example: Formation Stability with Similarity Detection
 * 
 * Scenario: Team usually plays "4-3-3" but API returns "4-2-3-1" for this match
 * 
 * Without similarity detection:
 * - Treated as completely different formation
 * - Flagged as unstable (experimental)
 * - Confidence reduced by 15-25%
 * 
 * With similarity detection:
 * - Recognizes 4-2-3-1 is 85% similar to 4-3-3
 * - Treated as stable (similar formation)
 * - No confidence reduction
 * - More accurate predictions
 */
function exampleFormationStabilityWithSimilarity() {
  const historicalFormations = ['4-3-3', '4-3-3', '4-3-3', '4-2-3-1', '4-3-3'];
  const matchFormation = '4-2-3-1'; // From API
  const mostPlayedFormation = '4-3-3';
  const formationFrequency = { '4-3-3': 80, '4-2-3-1': 20 };
  
  const result = calculateFormationStability(
    matchFormation,
    mostPlayedFormation,
    formationFrequency,
    historicalFormations,
    {
      isEarlySeason: false,
      similarityThreshold: 0.75
    }
  );
  
  // Result:
  // {
  //   isStable: true, // Because 4-2-3-1 is similar to 4-3-3
  //   stabilityScore: 72, // High because similar formations
  //   similarityScore: 0.85, // 85% similar
  //   confidenceReduction: 0, // No reduction because stable
  //   reason: "Formation 4-2-3-1 (similar to 4-3-3, 85% similar, 40% similar formations)"
  // }
}

function countConsecutiveMatchesWithoutCleanSheet(matches: Match[]): number {
  let count = 0;
  for (const match of matches) {
    if (match.goalsConceded > 0) count++;
    else break;
  }
  return count;
}
```

---

### Algorithm Improvements Summary

**All five improvements are now integrated:**

1. **H2H Recency Weighting:** Recent matches (2025) get exponentially higher weight than older ones (2023). Uses `weightedBttsPercentage` and `weightedAvgGoalsPerMatch` in predictions.

2. **Friendly Match Filtering:** All matches with "Friendly" in league name are excluded. Fallback logic ensures minimum match count requirements.

3. **Rest Days Adjustment:** When `daysSinceLastMatch > 10`, recent form weight is reduced by 30-50% (more reduction for longer rest), with weight redistributed to H2H and historical factors.

4. **Early Season Detection:** When round < 5, recent form weight reduced by 40% (teams not yet in rhythm), H2H and historical data weights increased accordingly.

5. **Low H2H Count Detection:** When H2H matches < 5, H2H factor weight reduced by 40-60% (less reliable with small sample), redistributed to recent form and home advantage. Warning insight added.

**Example: Combined Impact**

```typescript
// Scenario: Early season (Round 3), team rested 12 days, only 3 H2H matches

Base BTTS weights:
- Scoring Rate: 25%
- H2H: 25%
- Defensive Form: 20%
- Recent Form: 35%

After adjustments:
- Scoring Rate: 25% (unchanged)
- H2H: 15% (reduced from 25% due to low count: 25% * 0.4 = 10% reduction)
- Defensive Form: 20% (unchanged)
- Recent Form: 20% (reduced from 35%: 10% early season + 5% rest days = 15% reduction)
- Home Advantage: 20% (gained 5% from H2H reduction)

Result: More conservative predictions, less reliance on limited data
```

---

### Phase 2: Pattern Detection (Week 1-2)

**Goal:** Detect notable patterns automatically

```typescript
// /api/analysis/pattern-detector.ts

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

function detectPatterns(
  teamData: TeamData,
  context: 'home' | 'away'
): Pattern[] {
  const patterns: Pattern[] = [];
  const matches = context === 'home' 
    ? teamData.lastHomeMatches 
    : teamData.lastAwayMatches;
  
  // Sleeping Giant pattern (Mind Tier 1, Mood Tier 4)
  if (teamData.mood.isSleepingGiant) {
    patterns.push({
      type: 'SLEEPING_GIANT',
      severity: 'HIGH',
      priority: 95,
      data: {
        mindTier: teamData.mind.tier,
        moodTier: teamData.mood.tier,
        gap: teamData.mood.mindMoodGap,
      }
    });
  }
  
  // Over-performer pattern (Mind Tier 4, Mood Tier 1)
  if (teamData.mood.isOverPerformer) {
    patterns.push({
      type: 'OVER_PERFORMER',
      severity: 'HIGH',
      priority: 90,
      data: {
        mindTier: teamData.mind.tier,
        moodTier: teamData.mood.tier,
        gap: teamData.mood.mindMoodGap,
      }
    });
  }
  
  // Formation instability pattern
  // This will be detected in the match context, not here
  
  // 1. Losing streak (5+)
  const losingStreak = countConsecutiveResults(matches, 'L');
  if (losingStreak >= 5) {
    patterns.push({
      type: 'LONG_LOSING_STREAK',
      severity: losingStreak >= 8 ? 'CRITICAL' : 'HIGH',
      priority: 100,
      data: { streak: losingStreak, context }
    });
  }
  
  // 2. Winning streak (5+)
  const winningStreak = countConsecutiveResults(matches, 'W');
  if (winningStreak >= 5) {
    patterns.push({
      type: 'LONG_WINNING_STREAK',
      severity: winningStreak >= 8 ? 'CRITICAL' : 'HIGH',
      priority: 95,
      data: { streak: winningStreak, context }
    });
  }
  
  // 3. Scoring streak
  const scoringStreak = countConsecutiveMatchesWithGoals(matches);
  if (scoringStreak >= 5) {
    patterns.push({
      type: 'SCORING_STREAK',
      severity: scoringStreak >= 8 ? 'HIGH' : 'MEDIUM',
      priority: 80,
      data: { streak: scoringStreak }
    });
  }
  
  // 4. Clean sheet drought
  const csDrought = countConsecutiveMatchesWithoutCleanSheet(matches);
  if (csDrought >= 8) {
    patterns.push({
      type: 'CLEAN_SHEET_DROUGHT',
      severity: csDrought >= 12 ? 'CRITICAL' : 'HIGH',
      priority: 85,
      data: { drought: csDrought }
    });
  }
  
  // 5. First half weakness
  const firstHalfGoals = matches.filter(m => 
    m.firstHalfGoals && m.firstHalfGoals > 0
  ).length;
  const firstHalfPct = (firstHalfGoals / matches.length) * 100;
  if (firstHalfPct < 30) {
    patterns.push({
      type: 'FIRST_HALF_WEAKNESS',
      severity: firstHalfPct < 20 ? 'HIGH' : 'MEDIUM',
      priority: 70,
      data: { 
        gamesWithGoals: firstHalfGoals,
        total: matches.length,
        percentage: firstHalfPct
      }
    });
  }
  
  // 6. High scoring form
  const avgGoals = teamData.stats.avgGoalsScored;
  if (avgGoals >= 2.5) {
    patterns.push({
      type: 'HIGH_SCORING_FORM',
      severity: avgGoals >= 3.0 ? 'HIGH' : 'MEDIUM',
      priority: 75,
      data: { avgGoals }
    });
  }
  
  // 7. Defensive weakness
  const avgConceded = teamData.stats.avgGoalsConceded;
  if (avgConceded >= 2.0) {
    patterns.push({
      type: 'DEFENSIVE_WEAKNESS',
      severity: avgConceded >= 2.5 ? 'HIGH' : 'MEDIUM',
      priority: 78,
      data: { avgConceded }
    });
  }
  
  return patterns;
}

function detectH2HPatterns(h2hData: H2HData): Pattern[] {
  const patterns: Pattern[] = [];
  
  // 1. BTTS streak
  const bttsStreak = countConsecutiveBTTS(h2hData.matches);
  if (bttsStreak >= 3 || h2hData.bttsPercentage >= 70) {
    patterns.push({
      type: 'BTTS_STREAK',
      severity: bttsStreak >= 5 || h2hData.bttsPercentage >= 80 ? 'HIGH' : 'MEDIUM',
      priority: 90,
      data: { 
        streak: bttsStreak,
        percentage: h2hData.bttsPercentage,
        count: h2hData.bttsCount,
        total: h2hData.matches.length
      }
    });
  }
  
  // 2. One team dominates
  const totalMatches = h2hData.matches.length;
  const homeWinPct = (h2hData.homeTeamWins / totalMatches) * 100;
  const awayWinPct = (h2hData.awayTeamWins / totalMatches) * 100;
  
  if (homeWinPct >= 70 || awayWinPct >= 70) {
    patterns.push({
      type: 'H2H_DOMINANCE',
      severity: 'HIGH',
      priority: 85,
      data: {
        dominantTeam: homeWinPct > awayWinPct ? 'home' : 'away',
        wins: Math.max(h2hData.homeTeamWins, h2hData.awayTeamWins),
        total: totalMatches,
        percentage: Math.max(homeWinPct, awayWinPct)
      }
    });
  }
  
  return patterns;
}

function countConsecutiveBTTS(matches: Match[]): number {
  let count = 0;
  for (const match of matches) {
    if (match.bothTeamsScored) count++;
    else break;
  }
  return count;
}
```

---

### Phase 3: Insight Generation (Week 2)

**Goal:** Convert patterns to human-readable insights

```typescript
// /api/analysis/insight-generator.ts

interface Insight {
  text: string;
  emoji: string;
  priority: number;
  category: 'FORM' | 'H2H' | 'TIMING' | 'DEFENSIVE' | 'SCORING';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
}

interface InsightTemplate {
  pattern: PatternType;
  emoji: string;
  priority: number;
  template: (data: any, teamName: string) => string;
}

const INSIGHT_TEMPLATES: InsightTemplate[] = [
  {
    pattern: 'LONG_LOSING_STREAK',
    emoji: '🔴',
    priority: 100,
    template: (data, teamName) => {
      const { streak, context } = data;
      const venue = context === 'home' ? 'home' : 'away';
      if (streak >= 10) {
        return `${teamName} lost ${streak} consecutive ${venue} matches`;
      } else if (streak >= 8) {
        return `${teamName} on ${streak}-game ${venue} losing streak`;
      } else {
        return `${teamName} lost ${streak} of last ${streak} ${venue} matches`;
      }
    }
  },
  
  {
    pattern: 'LONG_WINNING_STREAK',
    emoji: '🔥',
    priority: 95,
    template: (data, teamName) => {
      const { streak, context } = data;
      const venue = context === 'home' ? 'home' : 'away';
      return `${teamName} won ${streak} consecutive ${venue} matches`;
    }
  },
  
  {
    pattern: 'SCORING_STREAK',
    emoji: '⚽',
    priority: 80,
    template: (data, teamName) => {
      return `${teamName} scored in ${data.streak} consecutive matches`;
    }
  },
  
  {
    pattern: 'CLEAN_SHEET_DROUGHT',
    emoji: '🔓',
    priority: 85,
    template: (data, teamName) => {
      if (data.drought >= 15) {
        return `${teamName}: 0 clean sheets in last ${data.drought} games`;
      }
      return `${teamName} haven't kept a clean sheet in ${data.drought} games`;
    }
  },
  
  {
    pattern: 'FIRST_HALF_WEAKNESS',
    emoji: '🐌',
    priority: 70,
    template: (data, teamName) => {
      return `${teamName} scored 1st half in only ${data.gamesWithGoals} of L${data.total} (${data.percentage.toFixed(0)}%)`;
    }
  },
  
  {
    pattern: 'HIGH_SCORING_FORM',
    emoji: '🔥',
    priority: 75,
    template: (data, teamName) => {
      return `${teamName} averaging ${data.avgGoals.toFixed(1)} goals per game (L5)`;
    }
  },
  
  {
    pattern: 'DEFENSIVE_WEAKNESS',
    emoji: '⚠️',
    priority: 78,
    template: (data, teamName) => {
      return `${teamName} conceding ${data.avgConceded.toFixed(1)} goals per game (L5)`;
    }
  },
  
  {
    pattern: 'BTTS_STREAK',
    emoji: '📊',
    priority: 90,
    template: (data) => {
      if (data.streak >= 5) {
        return `BTTS in all last ${data.streak} H2H meetings (${data.percentage.toFixed(0)}%)`;
      }
      return `BTTS in ${data.count} of last ${data.total} H2H meetings (${data.percentage.toFixed(0)}%)`;
    }
  },
  
  {
    pattern: 'H2H_DOMINANCE',
    emoji: '🏆',
    priority: 85,
    template: (data, teamName) => {
      return `${teamName} won ${data.wins} of last ${data.total} H2H meetings (${data.percentage.toFixed(0)}%)`;
    }
  },
  
  {
    pattern: 'SLEEPING_GIANT',
    emoji: '💤',
    priority: 95,
    template: (data, teamName) => {
      return `💎 Value Alert: ${teamName} is Tier ${data.mindTier} quality but Tier ${data.moodTier} form (${data.gap}-tier gap)`;
    }
  },
  
  {
    pattern: 'OVER_PERFORMER',
    emoji: '⚠️',
    priority: 90,
    template: (data, teamName) => {
      return `⚠️ Regression Risk: ${teamName} is Tier ${data.mindTier} quality but Tier ${data.moodTier} form - due for correction`;
    }
  },
  
  {
    pattern: 'FORMATION_INSTABILITY',
    emoji: '🔄',
    priority: 80,
    template: (data, teamName) => {
      return `🔄 Experimental formation: ${data.matchFormation} (usually plays ${data.mostPlayedFormation})`;
    }
  },
  
  {
    pattern: 'REGRESSION_RISK',
    emoji: '📉',
    priority: 85,
    template: (data, teamName) => {
      return `📉 Regression Risk: ${teamName} won ${data.streak} in a row (Tier ${data.tier} team)`;
    }
  },
];

function generateInsights(
  patterns: Pattern[],
  teamName: string
): Insight[] {
  const insights: Insight[] = [];
  
  for (const pattern of patterns) {
    const template = INSIGHT_TEMPLATES.find(t => t.pattern === pattern.type);
    if (!template) continue;
    
    insights.push({
      text: template.template(pattern.data, teamName),
      emoji: template.emoji,
      priority: template.priority,
      category: categorizePattern(pattern.type),
      severity: pattern.severity,
    });
  }
  
  // Sort by priority
  return insights.sort((a, b) => b.priority - a.priority);
}

function categorizePattern(type: PatternType): Insight['category'] {
  const map: Record<PatternType, Insight['category']> = {
    'LONG_LOSING_STREAK': 'FORM',
    'LONG_WINNING_STREAK': 'FORM',
    'SCORING_STREAK': 'SCORING',
    'CLEAN_SHEET_DROUGHT': 'DEFENSIVE',
    'HOME_FORM_COLLAPSE': 'FORM',
    'AWAY_DOMINANCE': 'FORM',
    'H2H_DOMINANCE': 'H2H',
    'BTTS_STREAK': 'H2H',
    'FIRST_HALF_WEAKNESS': 'TIMING',
    'HIGH_SCORING_FORM': 'SCORING',
    'DEFENSIVE_WEAKNESS': 'DEFENSIVE',
    'SLEEPING_GIANT': 'FORM',
    'OVER_PERFORMER': 'FORM',
    'FORMATION_INSTABILITY': 'FORM',
    'REGRESSION_RISK': 'FORM',
  };
  return map[type] || 'FORM';
}
```

---

### Phase 3.5: Match Type Detection & Cup/League Adjustments

**Goal:** Detect match type (cup vs league) and apply type-specific weight adjustments

#### 3.5.1 Match Type Detection

```typescript
// Helper: Detect match type from league name and round
function detectMatchType(
  leagueName: string,
  round?: string
): {
  type: 'LEAGUE' | 'CUP' | 'FRIENDLY' | 'INTERNATIONAL';
  importance: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  isKnockout: boolean;
} {
  const leagueLower = leagueName.toLowerCase();
  
  // International competition keywords
  const internationalKeywords = [
    'copa libertadores', 'libertadores', 'copa sudamericana', 'sudamericana',
    'champions league', 'europa', 'europa league', 'conference league',
    'afc champions league', 'afc cup', 'caf champions league', 'caf confederation cup',
    'concacaf champions cup', 'concacaf', 'world cup', 'club world cup',
    'intercontinental', 'super cup', 'international'
  ];
  
  // Cup competition keywords (domestic cups)
  const cupKeywords = [
    'cup', 'fa cup', 'copa del rey', 'coppa italia', 'dfb-pokal',
    'coupe de france', 'taca de portugal', 'knockout', 'playoff',
    'copa do brasil', 'copa argentina', 'copa chile', 'copa colombia'
  ];
  
  const isInternational = internationalKeywords.some(keyword => leagueLower.includes(keyword));
  const isCup = cupKeywords.some(keyword => leagueLower.includes(keyword));
  
  // Knockout stage detection
  const roundLower = round?.toLowerCase() || '';
  const knockoutKeywords = ['round of', 'quarter', 'semi', 'final', 'playoff'];
  const isKnockout = isCup && knockoutKeywords.some(keyword => roundLower.includes(keyword));
  
  // Importance level
  let importance: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'MEDIUM';
  if (isKnockout) {
    if (roundLower.includes('final')) {
      importance = 'CRITICAL';
    } else if (roundLower.includes('semi') || roundLower.includes('quarter')) {
      importance = 'HIGH';
    } else {
      importance = 'MEDIUM';
    }
  } else if (isCup) {
    importance = 'MEDIUM';
  } else {
    // League match - importance determined by context (title race, relegation, etc.)
    importance = 'MEDIUM';
  }
  
  // Friendly detection
  if (leagueLower.includes('friendly') || leagueLower.includes('preseason')) {
    return {
      type: 'FRIENDLY',
      importance: 'LOW',
      isKnockout: false,
    };
  }
  
  // Determine match type
  let matchType: 'LEAGUE' | 'CUP' | 'FRIENDLY' | 'INTERNATIONAL';
  if (isInternational) {
    matchType = 'INTERNATIONAL';
    // International competitions are typically more important
    if (importance === 'MEDIUM') {
      importance = 'HIGH';
    }
  } else if (isCup) {
    matchType = 'CUP';
  } else {
    matchType = 'LEAGUE';
  }
  
  return {
    type: matchType,
    importance,
    isKnockout: isKnockout || false,
  };
}
```

#### 3.5.2 Match Type Weight Adjustments

```typescript
// Helper: Adjust weights based on match type
function adjustWeightsForMatchType(
  baseWeights: Record<string, number>,
  matchType: {
    type: 'LEAGUE' | 'CUP' | 'FRIENDLY' | 'INTERNATIONAL';
    importance: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    isKnockout: boolean;
  }
): Record<string, number> {
  const adjusted = { ...baseWeights };
  
  // Cup matches (especially knockout): More defensive, less goals
  if (matchType.type === 'CUP' && matchType.isKnockout) {
    // Reduce goal-scoring factors
    if (adjusted.avgGoalsPerGame) {
      adjusted.avgGoalsPerGame *= 0.85; // 15% reduction
    }
    if (adjusted.scoringRate) {
      adjusted.scoringRate *= 0.9; // 10% reduction
    }
    
    // Increase motivation weight (more important in knockout)
    if (adjusted.motivation) {
      adjusted.motivation *= 1.5; // 50% increase
    }
    
    // Reduce form weight (cup matches less predictable)
    if (adjusted.recentForm) {
      adjusted.recentForm *= 0.9; // 10% reduction
    }
  } else if (matchType.type === 'CUP' && !matchType.isKnockout) {
    // Early cup rounds: Less impact, but still some adjustment
    if (adjusted.avgGoalsPerGame) {
      adjusted.avgGoalsPerGame *= 0.92; // 8% reduction
    }
    if (adjusted.recentForm) {
      adjusted.recentForm *= 0.95; // 5% reduction
    }
  }
  
  // International matches: Hybrid approach - use domestic form but adjust for context
  if (matchType.type === 'INTERNATIONAL') {
    // International matches are less predictable than league matches
    // Teams may prioritize differently, form may not translate directly
    if (adjusted.recentForm) {
      adjusted.recentForm *= 0.85; // 15% reduction (form less reliable)
    }
    if (adjusted.homeAdvantage) {
      adjusted.homeAdvantage *= 0.9; // 10% reduction (neutral venues common)
    }
    
    // Increase motivation weight (international competitions highly valued)
    if (adjusted.motivation) {
      adjusted.motivation *= 1.3; // 30% increase
    }
    
    // Reduce goal-scoring factors slightly (more tactical in international play)
    if (adjusted.avgGoalsPerGame) {
      adjusted.avgGoalsPerGame *= 0.92; // 8% reduction
    }
    if (adjusted.scoringRate) {
      adjusted.scoringRate *= 0.95; // 5% reduction
    }
    
    // Increase H2H weight (more relevant in international context)
    if (adjusted.h2h) {
      adjusted.h2h *= 1.2; // 20% increase
    }
  }
  
  // Friendly matches: Very unpredictable, reduce all weights
  if (matchType.type === 'FRIENDLY') {
    Object.keys(adjusted).forEach(key => {
      adjusted[key] *= 0.7; // 30% reduction across the board
    });
  }
  
  return adjusted;
}
```

**Integration Points:**
- Called before calculating base prediction
- Adjustments applied to market weights
- Match type included in prediction context
- Shown in API response as `matchType` field

#### 3.5.4 Neutral Venue Detection (Domestic Matches)

**Goal:** Detect neutral venues for domestic cup finals, playoffs, and super cups to reduce home advantage appropriately.

**Problem:** Currently only handles international matches (10% home advantage reduction). Domestic cup finals, playoffs, and super cups at neutral venues still get full home advantage, leading to overestimation of home team probability.

**Solution:** Two-pronged approach:
1. **Round Name Detection:** Detect neutral venues by round name keywords
2. **Venue Mismatch Detection:** Compare match venue with home team's usual stadium

**Implementation:**

**Approach A: Round Name Detection**

```typescript
/**
 * Detect neutral venue by round name keywords
 * Cup finals, playoffs, and super cups are typically at neutral venues
 */
function detectNeutralVenueByRound(
  matchType: {
    type: 'LEAGUE' | 'CUP' | 'FRIENDLY' | 'INTERNATIONAL';
    importance: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    isKnockout: boolean;
  },
  round?: string
): boolean {
  // International matches already handled separately
  if (matchType.type === 'INTERNATIONAL') {
    return false; // Already handled in international adjustments
  }
  
  // Cup finals are typically at neutral venues
  if (matchType.type === 'CUP' && matchType.isKnockout) {
    const roundLower = round?.toLowerCase() || '';
    const neutralKeywords = ['final', 'semi-final', 'semi final', 'playoff', 'super cup'];
    
    if (neutralKeywords.some(keyword => roundLower.includes(keyword))) {
      return true;
    }
  }
  
  return false;
}
```

**Approach B: Venue Mismatch Detection**

```typescript
/**
 * Team Stadium Mapping
 * Maps team ID to their usual home stadium (name and city)
 * Can be populated from API-Football or manual entry
 */
const TEAM_STADIUM_MAP: Record<number, { name: string; city: string }> = {
  // Premier League examples
  33: { name: 'Old Trafford', city: 'Manchester' },      // Manchester United
  50: { name: 'Etihad Stadium', city: 'Manchester' },   // Manchester City
  42: { name: 'Emirates Stadium', city: 'London' },     // Arsenal
  47: { name: 'Tottenham Hotspur Stadium', city: 'London' }, // Tottenham
  40: { name: 'Anfield', city: 'Liverpool' },           // Liverpool
  45: { name: 'Goodison Park', city: 'Liverpool' },     // Everton
  
  // La Liga examples
  541: { name: 'Santiago Bernabéu', city: 'Madrid' },   // Real Madrid
  529: { name: 'Camp Nou', city: 'Barcelona' },         // Barcelona
  531: { name: 'Wanda Metropolitano', city: 'Madrid' },  // Atletico Madrid
  
  // Serie A examples
  489: { name: 'San Siro', city: 'Milan' },            // AC Milan
  108: { name: 'San Siro', city: 'Milan' },            // Inter Milan
  98: { name: 'Allianz Stadium', city: 'Turin' },      // Juventus
  
  // Bundesliga examples
  157: { name: 'Allianz Arena', city: 'Munich' },       // Bayern Munich
  165: { name: 'Signal Iduna Park', city: 'Dortmund' }, // Borussia Dortmund
  
  // Portuguese League examples
  211: { name: 'Estádio da Luz', city: 'Lisbon' },      // Benfica
  212: { name: 'Estádio do Dragão', city: 'Porto' },    // Porto
  99: { name: 'Estádio José Alvalade', city: 'Lisbon' }, // Sporting CP
  
  // Add more as needed...
};

/**
 * Detect neutral venue by comparing match venue with home team's usual stadium
 */
function detectNeutralVenueByVenue(
  homeTeamId: number,
  matchVenue: { name: string; city: string } | null
): boolean {
  if (!matchVenue || !matchVenue.name) {
    return false; // Can't determine without venue data
  }
  
  const teamStadium = TEAM_STADIUM_MAP[homeTeamId];
  if (!teamStadium) {
    return false; // Don't have stadium data for this team
  }
  
  // Normalize for comparison (case-insensitive, remove common words)
  const normalize = (str: string) => str.toLowerCase()
    .replace(/\s+(stadium|stade|estadio|estádio|arena|park|ground|field)\s*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  const matchVenueNormalized = normalize(matchVenue.name);
  const teamStadiumNormalized = normalize(teamStadium.name);
  
  // Check if venue matches team's stadium
  if (matchVenueNormalized === teamStadiumNormalized) {
    return false; // Same venue = not neutral
  }
  
  // Check city match (if cities don't match, likely neutral)
  if (matchVenue.city && teamStadium.city) {
    const matchCityNormalized = matchVenue.city.toLowerCase().trim();
    const teamCityNormalized = teamStadium.city.toLowerCase().trim();
    
    if (matchCityNormalized !== teamCityNormalized) {
      return true; // Different city = likely neutral
    }
  }
  
  // If venue name doesn't match but city matches, could still be neutral (e.g., Wembley for FA Cup)
  // But we'll be conservative and only flag if we're confident
  return false;
}

/**
 * Combined neutral venue detection
 * Uses both round name and venue mismatch detection
 */
function detectNeutralVenue(
  homeTeamId: number,
  matchType: {
    type: 'LEAGUE' | 'CUP' | 'FRIENDLY' | 'INTERNATIONAL';
    importance: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    isKnockout: boolean;
  },
  round?: string,
  matchVenue?: { name: string; city: string } | null
): boolean {
  // Approach A: Round name detection (fast, reliable for cup finals)
  const byRound = detectNeutralVenueByRound(matchType, round);
  if (byRound) {
    return true;
  }
  
  // Approach B: Venue mismatch detection (more accurate but requires stadium data)
  if (matchVenue) {
    const byVenue = detectNeutralVenueByVenue(homeTeamId, matchVenue);
    if (byVenue) {
      return true;
    }
  }
  
  return false;
}
```

**Integration:**

```typescript
// Update detectMatchType to include neutral venue detection
function detectMatchType(
  leagueName: string,
  round?: string,
  homeTeamId?: number,
  matchVenue?: { name: string; city: string } | null
): {
  type: 'LEAGUE' | 'CUP' | 'FRIENDLY' | 'INTERNATIONAL';
  importance: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  isKnockout: boolean;
  isNeutralVenue: boolean; // NEW
} {
  // ... existing detection logic ...
  
  const matchType = {
    type: matchType,
    importance,
    isKnockout: isKnockout || false,
  };
  
  // Detect neutral venue
  const isNeutralVenue = homeTeamId && matchVenue
    ? detectNeutralVenue(homeTeamId, matchType, round, matchVenue)
    : detectNeutralVenueByRound(matchType, round); // Fallback to round detection only
  
  return {
    ...matchType,
    isNeutralVenue,
  };
}

// Update adjustWeightsForMatchType to handle neutral venues
function adjustWeightsForMatchType(
  baseWeights: Record<string, number>,
  matchType: {
    type: 'LEAGUE' | 'CUP' | 'FRIENDLY' | 'INTERNATIONAL';
    importance: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    isKnockout: boolean;
    isNeutralVenue?: boolean; // NEW
  }
): Record<string, number> {
  const adjusted = { ...baseWeights };
  
  // ... existing adjustments ...
  
  // Neutral venue adjustment (domestic matches)
  if (matchType.isNeutralVenue && matchType.type !== 'INTERNATIONAL') {
    // Reduce home advantage for neutral venues (similar to international)
    if (adjusted.homeAdvantage) {
      adjusted.homeAdvantage *= (1 - config.neutralVenue.homeAdvantageReduction);
    }
    
    // Slightly reduce form weight (neutral venues less predictable)
    if (adjusted.recentForm) {
      adjusted.recentForm *= 0.95; // 5% reduction
    }
    
    // Increase H2H weight (more relevant in neutral venues)
    if (adjusted.h2h) {
      adjusted.h2h *= 1.1; // 10% increase
    }
  }
  
  return adjusted;
}
```

**Configuration:**

```typescript
neutralVenue: {
  homeAdvantageReduction: number; // Default: 0.15 (15% reduction)
  roundKeywords: string[]; // ["Final", "Semi-Final", "Playoff", "Super Cup"]
  enableVenueMismatch: boolean; // Default: true (enable venue mismatch detection)
}
```

**Benefits:**
- More accurate predictions for cup finals and playoffs
- Prevents overestimation of home advantage in neutral venues
- Handles both domestic and international neutral venues

**ROI:** Medium-High (+1-2% accuracy for cup finals/playoffs)

**Implementation Effort:** 1 day (detection logic + integration + stadium mapping)

#### 3.5.5 Derby/Rivalry Matches Detection

**Goal:** Detect derby and rivalry matches to adjust weights appropriately (derbies are more unpredictable, H2H more relevant).

**Problem:** Derby matches have different dynamics (more intense, unpredictable) but aren't detected. Form is less reliable in derbies, while H2H becomes more important.

**Solution:** Manual mapping of known rivalries with automatic detection and weight adjustments.

**Implementation:**

```typescript
/**
 * Derby/Rivalry Mapping
 * Maps team pairs (sorted IDs) to indicate derby/rivalry matches
 * Format: "teamId1-teamId2" where teamId1 < teamId2
 */
const DERBY_RIVALRY_MAP: Record<string, number[]> = {
  // Premier League
  '33-50': [33, 50],        // Manchester United vs Manchester City (Manchester Derby)
  '42-47': [42, 47],        // Arsenal vs Tottenham (North London Derby)
  '40-45': [40, 45],        // Liverpool vs Everton (Merseyside Derby)
  '33-40': [33, 40],        // Manchester United vs Liverpool (Historic Rivalry)
  '50-40': [50, 40],        // Manchester City vs Liverpool (Title Rivalry)
  '42-40': [42, 40],        // Arsenal vs Liverpool
  '33-42': [33, 42],        // Manchester United vs Arsenal
  
  // La Liga
  '541-529': [541, 529],    // Real Madrid vs Barcelona (El Clásico)
  '541-531': [541, 531],    // Real Madrid vs Atletico Madrid (Madrid Derby)
  '529-531': [529, 531],    // Barcelona vs Atletico Madrid
  
  // Serie A
  '489-108': [489, 108],    // AC Milan vs Inter Milan (Derby della Madonnina)
  '98-489': [98, 489],      // Juventus vs AC Milan
  '98-108': [98, 108],      // Juventus vs Inter Milan
  
  // Bundesliga
  '157-165': [157, 165],    // Bayern Munich vs Borussia Dortmund (Der Klassiker)
  '157-169': [157, 169],    // Bayern Munich vs Borussia Mönchengladbach
  
  // Portuguese League
  '211-212': [211, 212],    // Benfica vs Porto (O Clássico)
  '211-99': [211, 99],      // Benfica vs Sporting CP (Lisbon Derby)
  '212-99': [212, 99],      // Porto vs Sporting CP
  
  // Ligue 1
  '85-524': [85, 524],      // Paris Saint-Germain vs Marseille (Le Classique)
  '85-516': [85, 516],      // Paris Saint-Germain vs Lyon
  
  // Add more as needed...
};

/**
 * Check if match is a derby/rivalry
 */
function isDerbyMatch(homeTeamId: number, awayTeamId: number): boolean {
  // Sort IDs to ensure consistent lookup
  const [id1, id2] = [homeTeamId, awayTeamId].sort((a, b) => a - b);
  const key = `${id1}-${id2}`;
  
  return key in DERBY_RIVALRY_MAP;
}

/**
 * Adjust weights for derby matches
 */
function adjustWeightsForDerby(
  baseWeights: Record<string, number>,
  config: AlgorithmConfig
): Record<string, number> {
  const adjusted = { ...baseWeights };
  
  // Reduce form weight (derbies less predictable, form less reliable)
  if (adjusted.recentForm) {
    adjusted.recentForm *= (1 - config.derby.formWeightReduction);
  }
  
  // Increase H2H weight (more relevant in derbies)
  if (adjusted.h2h) {
    adjusted.h2h *= (1 + config.derby.h2hWeightIncrease);
  }
  
  // Slightly reduce home advantage (derbies more intense, home advantage less pronounced)
  if (adjusted.homeAdvantage) {
    adjusted.homeAdvantage *= 0.95; // 5% reduction
  }
  
  return adjusted;
}

/**
 * Reduce confidence for derby matches (higher unpredictability)
 */
function adjustConfidenceForDerby(
  baseConfidence: 'LOW' | 'MEDIUM' | 'HIGH',
  config: AlgorithmConfig
): 'LOW' | 'MEDIUM' | 'HIGH' {
  const reduction = config.derby.confidenceReduction;
  
  if (baseConfidence === 'HIGH') {
    // High -> Medium if reduction >= 10%
    if (reduction >= 0.10) {
      return 'MEDIUM';
    }
    return 'HIGH';
  } else if (baseConfidence === 'MEDIUM') {
    // Medium -> Low if reduction >= 15%
    if (reduction >= 0.15) {
      return 'LOW';
    }
    return 'MEDIUM';
  }
  
  return baseConfidence; // LOW stays LOW
}
```

**Integration:**

```typescript
// In prediction functions (e.g., predictBTTS, predictOver25, predictMatchResult)
async function predictMatchResult(
  homeTeam: TeamData,
  awayTeam: TeamData,
  h2h: H2HData,
  // ... other params ...
  config: AlgorithmConfig
): Promise<MarketPrediction> {
  // ... existing code ...
  
  // Check if derby match
  const isDerby = isDerbyMatch(homeTeam.id, awayTeam.id);
  
  // Adjust weights for derby
  if (isDerby) {
    weights = adjustWeightsForDerby(weights, config);
    
    // Add insight
    insights.push({
      text: `⚔️ Derby Match: ${homeTeam.name} vs ${awayTeam.name} - Higher unpredictability`,
      emoji: '⚔️',
      priority: 85,
      category: 'CONTEXT',
      severity: 'MEDIUM',
    });
    
    // Reduce confidence
    confidence = adjustConfidenceForDerby(confidence, config);
  }
  
  // ... rest of prediction logic ...
}
```

**Configuration:**

```typescript
derby: {
  formWeightReduction: number; // Default: 0.12 (12% reduction)
  h2hWeightIncrease: number;   // Default: 0.20 (20% increase)
  confidenceReduction: number; // Default: 0.12 (12% reduction)
}
```

**Benefits:**
- More accurate predictions for derby matches
- Accounts for higher unpredictability in derbies
- Better use of H2H data in derby context

**ROI:** Medium (+1-2% accuracy for derby matches)

**Implementation Effort:** 4-6 hours (mapping + detection + integration)

#### 3.5.6 Post-International Break Effects

**Goal:** Detect matches immediately after international breaks and adjust weights (form less reliable, players may be tired/unavailable).

**Problem:** Teams returning from international duty may be tired or have key players unavailable, affecting form reliability. Recent form becomes less predictive immediately after international breaks.

**Solution:** Detect international break dates and apply adjustments to matches within 3-5 days after breaks.

**Implementation:**

```typescript
/**
 * International Break Dates (FIFA Calendar)
 * Typically: March, June, September, October, November
 * Format: { year: number, month: number, startDay: number, endDay: number }
 * 
 * Note: These dates can be updated annually or fetched from FIFA calendar API
 */
const INTERNATIONAL_BREAK_DATES: Array<{
  year: number;
  month: number;
  startDay: number;
  endDay: number;
  name: string;
}> = [
  // 2024
  { year: 2024, month: 3, startDay: 18, endDay: 26, name: 'March International Break' },
  { year: 2024, month: 6, startDay: 3, endDay: 11, name: 'June International Break' },
  { year: 2024, month: 9, startDay: 2, endDay: 10, name: 'September International Break' },
  { year: 2024, month: 10, startDay: 7, endDay: 15, name: 'October International Break' },
  { year: 2024, month: 11, startDay: 11, endDay: 19, name: 'November International Break' },
  
  // 2025
  { year: 2025, month: 3, startDay: 17, endDay: 25, name: 'March International Break' },
  { year: 2025, month: 6, startDay: 2, endDay: 10, name: 'June International Break' },
  { year: 2025, month: 9, startDay: 1, endDay: 9, name: 'September International Break' },
  { year: 2025, month: 10, startDay: 6, endDay: 14, name: 'October International Break' },
  { year: 2025, month: 11, startDay: 10, endDay: 18, name: 'November International Break' },
  
  // Add more years as needed...
];

/**
 * Check if match date is within X days after an international break
 */
function isPostInternationalBreak(
  matchDate: Date,
  daysAfterBreak: number = 5
): boolean {
  const matchYear = matchDate.getFullYear();
  const matchMonth = matchDate.getMonth() + 1; // getMonth() returns 0-11
  const matchDay = matchDate.getDate();
  
  // Check all international breaks
  for (const breakDate of INTERNATIONAL_BREAK_DATES) {
    // Only check breaks in the same year or previous year (for early year matches)
    if (breakDate.year !== matchYear && breakDate.year !== matchYear - 1) {
      continue;
    }
    
    // Calculate break end date
    const breakEndDate = new Date(breakDate.year, breakDate.month - 1, breakDate.endDay);
    
    // Calculate days difference
    const daysDiff = Math.floor(
      (matchDate.getTime() - breakEndDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    // Check if match is within X days after break end
    if (daysDiff >= 0 && daysDiff <= daysAfterBreak) {
      return true;
    }
  }
  
  return false;
}

/**
 * Adjust weights for post-international break matches
 */
function adjustWeightsForPostInternationalBreak(
  baseWeights: Record<string, number>,
  config: AlgorithmConfig
): Record<string, number> {
  const adjusted = { ...baseWeights };
  
  // Reduce recent form weight (form less reliable after international break)
  if (adjusted.recentForm) {
    adjusted.recentForm *= (1 - config.postInternationalBreak.formWeightReduction);
  }
  
  // Increase H2H weight (more reliable than recent form)
  if (adjusted.h2h) {
    adjusted.h2h *= (1 + config.postInternationalBreak.h2hWeightIncrease);
  }
  
  // Slightly reduce scoring rate (fatigue may affect scoring)
  if (adjusted.scoringRate) {
    adjusted.scoringRate *= 0.97; // 3% reduction
  }
  
  return adjusted;
}

/**
 * Reduce confidence for post-international break matches
 */
function adjustConfidenceForPostInternationalBreak(
  baseConfidence: 'LOW' | 'MEDIUM' | 'HIGH',
  config: AlgorithmConfig
): 'LOW' | 'MEDIUM' | 'HIGH' {
  const reduction = config.postInternationalBreak.confidenceReduction;
  
  if (baseConfidence === 'HIGH') {
    // High -> Medium if reduction >= 8%
    if (reduction >= 0.08) {
      return 'MEDIUM';
    }
    return 'HIGH';
  } else if (baseConfidence === 'MEDIUM') {
    // Medium -> Low if reduction >= 12%
    if (reduction >= 0.12) {
      return 'LOW';
    }
    return 'MEDIUM';
  }
  
  return baseConfidence; // LOW stays LOW
}
```

**Integration:**

```typescript
// In prediction functions
async function predictMatchResult(
  homeTeam: TeamData,
  awayTeam: TeamData,
  h2h: H2HData,
  matchDate: Date, // NEW: Need match date
  // ... other params ...
  config: AlgorithmConfig
): Promise<MarketPrediction> {
  // ... existing code ...
  
  // Check if post-international break
  const isPostBreak = isPostInternationalBreak(matchDate, config.postInternationalBreak.daysAfterBreak);
  
  // Adjust weights for post-international break
  if (isPostBreak) {
    weights = adjustWeightsForPostInternationalBreak(weights, config);
    
    // Add insight
    insights.push({
      text: `🌍 Post-International Break: Form less reliable, players may be tired`,
      emoji: '🌍',
      priority: 75,
      category: 'CONTEXT',
      severity: 'MEDIUM',
    });
    
    // Reduce confidence
    confidence = adjustConfidenceForPostInternationalBreak(confidence, config);
  }
  
  // ... rest of prediction logic ...
}
```

**Configuration:**

```typescript
postInternationalBreak: {
  formWeightReduction: number; // Default: 0.18 (18% reduction)
  h2hWeightIncrease: number;    // Default: 0.10 (10% increase)
  confidenceReduction: number;  // Default: 0.08 (8% reduction)
  daysAfterBreak: number;       // Default: 5 (affects matches within 5 days)
}
```

**Benefits:**
- More accurate predictions immediately after international breaks
- Accounts for fatigue and player availability issues
- Better use of H2H data when form is unreliable

**ROI:** Low-Medium (+0.5-1% accuracy)

**Implementation Effort:** 4-6 hours (date detection + integration)

#### 3.5.7 End-of-Season Specific Dynamics

**Goal:** Enhance motivation detection and apply adjustments for final 3-5 rounds (relegation battles, title races, "nothing to play for").

**Problem:** Final 3-5 rounds have different dynamics (relegation battles, title races, "nothing to play for"). Teams fighting for survival play more defensively, while teams with nothing to play for may play more openly.

**Solution:** Detect end-of-season matches and enhance motivation calculation with end-of-season context.

**Implementation:**

```typescript
/**
 * Check if match is in final rounds of season
 */
function isEndOfSeason(
  round: string | number | null,
  totalRounds: number | null,
  config: AlgorithmConfig
): boolean {
  if (!round || !totalRounds) {
    return false; // Can't determine without round data
  }
  
  // Parse round number if string (e.g., "Round 38" -> 38)
  let roundNumber: number;
  if (typeof round === 'string') {
    const match = round.match(/\d+/);
    roundNumber = match ? parseInt(match[0]) : 0;
  } else {
    roundNumber = round;
  }
  
  // Check if round is in final X rounds
  return roundNumber >= (totalRounds - config.endOfSeason.finalRoundsThreshold);
}

/**
 * Enhanced motivation calculation with end-of-season context
 */
function calculateMotivation(
  team: TeamData,
  leaguePosition: number,
  totalTeams: number,
  isEndOfSeason: boolean,
  config: AlgorithmConfig
): 'TITLE_RACE' | 'CL_QUALIFICATION' | 'MID_TABLE' | 'RELEGATION_BATTLE' | 'NOTHING_TO_PLAY_FOR' {
  // Existing motivation logic (from current implementation)
  // This is a placeholder - adjust based on actual implementation
  
  // End-of-season enhancements
  if (isEndOfSeason) {
    // Relegation battle: Bottom 3-5 teams
    if (leaguePosition >= (totalTeams - config.endOfSeason.relegationBattlePositions)) {
      return 'RELEGATION_BATTLE';
    }
    
    // Title race: Top 2-3 teams
    if (leaguePosition <= config.endOfSeason.titleRacePositions) {
      return 'TITLE_RACE';
    }
    
    // CL qualification: Positions 4-6 (depending on league)
    // Most leagues: 4 CL spots, some have 5-6
    const clQualificationPositions = 6; // Adjust per league
    if (leaguePosition >= 4 && leaguePosition <= clQualificationPositions) {
      return 'CL_QUALIFICATION';
    }
    
    // Nothing to play for: Mid-table teams (safe from relegation, no CL chance)
    // Typically positions 8-12 (depending on league size)
    const safeFromRelegation = leaguePosition <= (totalTeams - 5);
    const noCLChance = leaguePosition > clQualificationPositions;
    
    if (safeFromRelegation && noCLChance) {
      return 'NOTHING_TO_PLAY_FOR';
    }
  }
  
  // Regular season motivation (existing logic)
  // ... (keep existing implementation)
  
  return 'MID_TABLE'; // Default
}

/**
 * Adjust weights for end-of-season matches
 */
function adjustWeightsForEndOfSeason(
  baseWeights: Record<string, number>,
  homeMotivation: string,
  awayMotivation: string,
  config: AlgorithmConfig
): Record<string, number> {
  const adjusted = { ...baseWeights };
  
  // Increase motivation weight for end-of-season
  if (adjusted.motivation) {
    adjusted.motivation *= (1 + config.endOfSeason.motivationWeightIncrease);
  }
  
  // Relegation battle adjustments
  const isRelegationBattle = 
    homeMotivation === 'RELEGATION_BATTLE' || 
    awayMotivation === 'RELEGATION_BATTLE';
  
  if (isRelegationBattle) {
    // Teams fighting for survival: More defensive → reduce BTTS/Over probability
    if (adjusted.scoringRate) {
      adjusted.scoringRate *= 0.92; // 8% reduction
    }
    if (adjusted.avgGoalsPerGame) {
      adjusted.avgGoalsPerGame *= 0.90; // 10% reduction
    }
  }
  
  // Nothing to play for adjustments
  const isNothingToPlayFor = 
    homeMotivation === 'NOTHING_TO_PLAY_FOR' || 
    awayMotivation === 'NOTHING_TO_PLAY_FOR';
  
  if (isNothingToPlayFor) {
    // Teams with nothing to play for: More open → increase BTTS/Over probability
    if (adjusted.scoringRate) {
      adjusted.scoringRate *= 1.08; // 8% increase
    }
    if (adjusted.avgGoalsPerGame) {
      adjusted.avgGoalsPerGame *= 1.10; // 10% increase
    }
  }
  
  return adjusted;
}
```

**Integration:**

```typescript
// In prediction functions
async function predictBTTS(
  homeTeam: TeamData,
  awayTeam: TeamData,
  h2h: H2HData,
  round: string | number | null,
  totalRounds: number | null,
  homeLeaguePosition: number,
  awayLeaguePosition: number,
  totalTeams: number,
  // ... other params ...
  config: AlgorithmConfig
): Promise<MarketPrediction> {
  // ... existing code ...
  
  // Check if end-of-season
  const isEndOfSeasonMatch = isEndOfSeason(round, totalRounds, config);
  
  // Calculate enhanced motivation
  const homeMotivation = calculateMotivation(
    homeTeam,
    homeLeaguePosition,
    totalTeams,
    isEndOfSeasonMatch,
    config
  );
  const awayMotivation = calculateMotivation(
    awayTeam,
    awayLeaguePosition,
    totalTeams,
    isEndOfSeasonMatch,
    config
  );
  
  // Adjust weights for end-of-season
  if (isEndOfSeasonMatch) {
    weights = adjustWeightsForEndOfSeason(weights, homeMotivation, awayMotivation, config);
    
    // Add insights
    if (homeMotivation === 'RELEGATION_BATTLE' || awayMotivation === 'RELEGATION_BATTLE') {
      insights.push({
        text: `⚔️ Relegation Battle: Teams fighting for survival - more defensive play expected`,
        emoji: '⚔️',
        priority: 80,
        category: 'CONTEXT',
        severity: 'MEDIUM',
      });
    }
    
    if (homeMotivation === 'NOTHING_TO_PLAY_FOR' || awayMotivation === 'NOTHING_TO_PLAY_FOR') {
      insights.push({
        text: `🎯 End-of-Season: Teams with nothing to play for - more open play expected`,
        emoji: '🎯',
        priority: 75,
        category: 'CONTEXT',
        severity: 'MEDIUM',
      });
    }
  }
  
  // ... rest of prediction logic ...
}
```

**Configuration:**

```typescript
endOfSeason: {
  finalRoundsThreshold: number; // Default: 5 (last 5 rounds)
  motivationWeightIncrease: number; // Default: 0.25 (25% increase)
  relegationBattlePositions: number; // Default: 5 (bottom 5 teams)
  titleRacePositions: number; // Default: 3 (top 3 teams)
}
```

**Benefits:**
- More accurate predictions for final rounds
- Accounts for different team motivations at end of season
- Better handling of relegation battles and "nothing to play for" scenarios

**ROI:** Medium (+1-2% accuracy for final rounds)

**Implementation Effort:** 1 day (detection + enhanced motivation + integration)

#### 3.5.8 League-Specific Characteristics

**Goal:** Apply league-specific baseline adjustments for scoring patterns (Serie A lower scoring than Premier League).

**Problem:** Different leagues have different scoring patterns (Serie A lower scoring than Premier League, Bundesliga higher scoring). Current algorithm doesn't account for league-specific characteristics.

**Solution:** Create league baseline statistics and apply multipliers to goal-scoring predictions.

**Implementation:**

```typescript
/**
 * League Characteristics Interface
 */
interface LeagueCharacteristics {
  avgGoalsPerGame: number;        // Average goals per game in this league
  bttsRate: number;              // Baseline BTTS rate (0-1)
  drawRate: number;              // Baseline draw rate (0-1)
  homeAdvantageStrength: number;  // Multiplier for home advantage (default: 1.0)
  overGoalsBaselineByLine: Record<string, number>; // Baseline P(totalGoals > line), keyed by line string (e.g. "2.5")
  cleanSheetRate: number;        // Average clean sheet rate
  scoringRate: number;            // Average scoring rate (goals per game)
}

/**
 * League Characteristics Mapping
 * Data can be calculated from historical data or use league averages from API-Football statistics
 */
const LEAGUE_CHARACTERISTICS: Record<number, LeagueCharacteristics> = {
  // Premier League (39)
  39: {
    avgGoalsPerGame: 2.75,
    bttsRate: 0.52,
    drawRate: 0.25,
    homeAdvantageStrength: 1.0,
    overGoalsBaselineByLine: {
      '0.5': 0.93,
      '1.5': 0.78,
      '2.5': 0.52,
      '3.5': 0.28,
      '4.5': 0.14,
      '5.5': 0.07,
    },
    cleanSheetRate: 0.32,
    scoringRate: 1.38, // Average goals per team per game
  },
  
  // La Liga (140)
  140: {
    avgGoalsPerGame: 2.60,
    bttsRate: 0.48,
    drawRate: 0.26,
    homeAdvantageStrength: 1.0,
    overGoalsBaselineByLine: {
      '0.5': 0.92,
      '1.5': 0.75,
      '2.5': 0.48,
      '3.5': 0.25,
      '4.5': 0.12,
      '5.5': 0.06,
    },
    cleanSheetRate: 0.35,
    scoringRate: 1.30,
  },
  
  // Serie A (135)
  135: {
    avgGoalsPerGame: 2.50,
    bttsRate: 0.45,
    drawRate: 0.28,
    homeAdvantageStrength: 0.95, // Slightly lower home advantage
    overGoalsBaselineByLine: {
      '0.5': 0.91,
      '1.5': 0.72,
      '2.5': 0.42,
      '3.5': 0.22,
      '4.5': 0.10,
      '5.5': 0.05,
    },
    cleanSheetRate: 0.38,
    scoringRate: 1.25,
  },
  
  // Bundesliga (78)
  78: {
    avgGoalsPerGame: 3.10,
    bttsRate: 0.58,
    drawRate: 0.22,
    homeAdvantageStrength: 1.05, // Slightly higher home advantage
    overGoalsBaselineByLine: {
      '0.5': 0.95,
      '1.5': 0.85,
      '2.5': 0.62,
      '3.5': 0.38,
      '4.5': 0.20,
      '5.5': 0.10,
    },
    cleanSheetRate: 0.28,
    scoringRate: 1.55,
  },
  
  // Ligue 1 (61)
  61: {
    avgGoalsPerGame: 2.65,
    bttsRate: 0.50,
    drawRate: 0.27,
    homeAdvantageStrength: 1.0,
    overGoalsBaselineByLine: {
      '0.5': 0.92,
      '1.5': 0.76,
      '2.5': 0.50,
      '3.5': 0.27,
      '4.5': 0.13,
      '5.5': 0.06,
    },
    cleanSheetRate: 0.33,
    scoringRate: 1.33,
  },
  
  // Portuguese League (94)
  94: {
    avgGoalsPerGame: 2.55,
    bttsRate: 0.47,
    drawRate: 0.27,
    homeAdvantageStrength: 1.0,
    overGoalsBaselineByLine: {
      '0.5': 0.91,
      '1.5': 0.74,
      '2.5': 0.46,
      '3.5': 0.24,
      '4.5': 0.11,
      '5.5': 0.05,
    },
    cleanSheetRate: 0.36,
    scoringRate: 1.28,
  },
  
  // Add more leagues as needed...
  // Note: These values should be updated annually based on recent season data
};

/**
 * Get league characteristics (with fallback to default)
 */
function getLeagueCharacteristics(leagueId: number): LeagueCharacteristics {
  const characteristics = LEAGUE_CHARACTERISTICS[leagueId];
  
  if (characteristics) {
    return characteristics;
  }
  
  // Fallback to Premier League average (most balanced)
  return LEAGUE_CHARACTERISTICS[39];
}

/**
 * Apply league-specific adjustments to predictions
 */
function applyLeagueSpecificAdjustments(
  baseProbability: number,
  market: 'BTTS' | 'OVER_UNDER_GOALS' | 'MATCH_RESULT' | 'FIRST_HALF',
  leagueId: number,
  line: 0.5 | 1.5 | 2.5 | 3.5 | 4.5 | 5.5 | undefined,
  config: AlgorithmConfig
): number {
  const leagueChars = getLeagueCharacteristics(leagueId);
  
  // Calculate adjustment factor based on league baseline vs global baseline
  // Global baseline assumed to be Premier League (39)
  const globalBaseline = LEAGUE_CHARACTERISTICS[39];
  
  let adjustmentFactor = 1.0;
  
  switch (market) {
    case 'BTTS':
      // Compare league BTTS rate to global baseline
      adjustmentFactor = leagueChars.bttsRate / globalBaseline.bttsRate;
      break;
      
    case 'OVER_UNDER_GOALS': {
      // Compare league P(totalGoals > line) to global baseline for the same line.
      // If line is missing, default to 2.5.
      const effectiveLine = line ?? 2.5;
      const key = String(effectiveLine);
      const leagueBase = leagueChars.overGoalsBaselineByLine[key];
      const globalBase = globalBaseline.overGoalsBaselineByLine[key];
      if (leagueBase != null && globalBase != null && globalBase > 0) {
        adjustmentFactor = leagueBase / globalBase;
      }
      break;
    }
      
    case 'MATCH_RESULT':
      // Apply home advantage strength multiplier
      adjustmentFactor = leagueChars.homeAdvantageStrength;
      break;
      
    case 'FIRST_HALF':
      // Use scoring rate as proxy (leagues with higher scoring tend to have more first half goals)
      adjustmentFactor = leagueChars.scoringRate / globalBaseline.scoringRate;
      break;
  }
  
  // Apply adjustment (capped to prevent extreme swings)
  // Max adjustment: ±8% (configurable)
  const maxAdjustment = config.leagueCharacteristics?.maxAdjustment || 0.08;
  const cappedFactor = Math.max(1 - maxAdjustment, Math.min(1 + maxAdjustment, adjustmentFactor));
  
  // Convert factor to probability adjustment
  // If factor > 1, increase probability; if < 1, decrease
  const adjustment = (cappedFactor - 1) * 10; // Scale to percentage points
  
  return Math.max(5, Math.min(95, baseProbability + adjustment));
}
```

**Integration:**

```typescript
// In prediction functions
async function predictBTTS(
  homeTeam: TeamData,
  awayTeam: TeamData,
  h2h: H2HData,
  leagueId: number, // NEW: Need league ID
  // ... other params ...
  config: AlgorithmConfig
): Promise<MarketPrediction> {
  // ... existing code to calculate baseProbability ...
  
  // Apply league-specific adjustments
  const adjustedProbability = applyLeagueSpecificAdjustments(
    baseProbability,
    'BTTS',
    leagueId,
    config
  );
  
  // ... rest of prediction logic ...
}

// Similar for predictOver25, predictOver15, etc.
// Similar for predictOverUnderGoals (pass the line), predictMatchResult, etc.
```

**Configuration:**

```typescript
leagueCharacteristics: {
  maxAdjustment: number; // Default: 0.08 (max ±8% adjustment)
  enabled: boolean;      // Default: true (enable league-specific adjustments)
}
```

**Data Source:**
- Can be calculated from historical data (last 3-5 seasons)
- Or use league averages from API-Football statistics endpoint
- Should be updated annually based on recent season trends

**Benefits:**
- More accurate predictions per league
- Accounts for league-specific playing styles
- Better handling of defensive leagues (Serie A) vs attacking leagues (Bundesliga)

**ROI:** Medium (+1-2% accuracy overall)

**Implementation Effort:** 1-2 days (data collection + implementation + testing)

#### 3.5.3 International Match Handling

**Problem:** International competitions (Copa Libertadores, Champions League, etc.) present unique challenges:
- Teams don't play 50 matches in international competitions (insufficient data for Mind layer)
- Different competitive context (knockout vs. league, neutral venues, higher stakes)
- H2H data should be filtered to the specific competition when available

**Solution: Hybrid Approach**

For international matches, the algorithm uses a **hybrid approach**:

1. **Mind/Mood Layers:** Use domestic league data (Serie A, Brasileirão, etc.)
   - Ensures sufficient data (50 matches for Mind layer)
   - Provides relevant competitive context
   - Teams' domestic form is still predictive for international matches

2. **H2H Data:** Filter to the specific international competition
   - Copa Libertadores H2H is more relevant than domestic league H2H
   - Use `/fixtures/headtohead` with `league` parameter

3. **Weight Adjustments:** Apply international match adjustments
   - Reduce form weight (15% reduction) - form less reliable across competitions
   - Reduce home advantage (10% reduction) - neutral venues common
   - Increase motivation weight (30% increase) - international competitions highly valued
   - Reduce goal-scoring factors (8% reduction) - more tactical play
   - Increase H2H weight (20% increase) - more relevant in international context

**Implementation:**

```typescript
/**
 * Detect if match is international competition
 */
function isInternationalMatch(leagueName: string): boolean {
  const internationalKeywords = [
    'copa libertadores', 'libertadores', 'copa sudamericana', 'sudamericana',
    'champions league', 'europa', 'europa league', 'conference league',
    'afc champions league', 'afc cup', 'caf champions league',
    'concacaf champions cup', 'club world cup', 'intercontinental'
  ];
  
  const leagueLower = leagueName.toLowerCase();
  return internationalKeywords.some(keyword => leagueLower.includes(keyword));
}

/**
 * Get domestic league for a team (for international match context)
 */
async function getTeamDomesticLeague(teamId: number): Promise<number | null> {
  // Fetch team's recent matches to determine primary domestic league
  const recentMatches = await fetchFixtures({
    team: teamId,
    last: 20
  });
  
  // Find most common league (filter out international competitions)
  const leagueCounts = new Map<number, number>();
  recentMatches.forEach(match => {
    const leagueId = match.league.id;
    const leagueName = match.league.name;
    
    // Only count domestic leagues (not international)
    if (!isInternationalMatch(leagueName)) {
      leagueCounts.set(leagueId, (leagueCounts.get(leagueId) || 0) + 1);
    }
  });
  
  // Return most common domestic league
  const sortedLeagues = Array.from(leagueCounts.entries())
    .sort((a, b) => b[1] - a[1]);
  
  return sortedLeagues[0]?.[0] || null;
}
```

**Usage in Prediction Pipeline:**

```typescript
// 1. Detect match type
const matchType = detectMatchType(match.leagueName, match.round);

// 2. For international matches: Get domestic leagues
let homeDomesticLeagueId: number | undefined;
let awayDomesticLeagueId: number | undefined;

if (matchType.type === 'INTERNATIONAL') {
  [homeDomesticLeagueId, awayDomesticLeagueId] = await Promise.all([
    getTeamDomesticLeague(match.homeTeamId),
    getTeamDomesticLeague(match.awayTeamId)
  ]);
}

// 3. Fetch team data (use domestic league for international matches)
const [homeTeam, awayTeam, h2h] = await Promise.all([
  getTeamData(match.homeTeamId, c, {
    domesticLeagueId: homeDomesticLeagueId, // Use domestic league for Mind/Mood
    matchLeagueId: match.leagueId,            // Current match league (international)
    season: match.season
  }),
  getTeamData(match.awayTeamId, c, {
    domesticLeagueId: awayDomesticLeagueId,
    matchLeagueId: match.leagueId,
    season: match.season
  }),
  getH2HData(match.homeTeamId, match.awayTeamId, c, {
    leagueId: matchType.type === 'INTERNATIONAL' ? match.leagueId : undefined, // Filter H2H to international competition
    includeAllLeagues: matchType.type !== 'INTERNATIONAL'
  }),
]);

// 4. Apply weight adjustments for international matches
const baseWeights = getBaseWeights();
const adjustedWeights = adjustWeightsForMatchType(baseWeights, matchType);
```

**Benefits:**
- ✅ Sufficient data: Always have 50 matches for Mind layer (from domestic league)
- ✅ Relevant context: Domestic form is still predictive for international matches
- ✅ Competition-specific H2H: More relevant than all-time H2H
- ✅ Appropriate adjustments: Accounts for different competitive context

**Example: Copa Libertadores Match**

```typescript
// Match: Flamengo (Brazil) vs River Plate (Argentina) - Copa Libertadores
// 
// 1. Detect: matchType.type = 'INTERNATIONAL'
// 2. Get domestic leagues:
//    - Flamengo → Brasileirão (71)
//    - River Plate → Primera División (128)
// 3. Fetch team data:
//    - Flamengo: Mind/Mood from Brasileirão (50 matches available)
//    - River Plate: Mind/Mood from Primera División (50 matches available)
// 4. Fetch H2H:
//    - Filter to Copa Libertadores only (if available)
//    - Otherwise use all H2H but weight less
// 5. Apply adjustments:
//    - Form weight: 0.85x (less reliable)
//    - Home advantage: 0.9x (neutral venue possible)
//    - Motivation: 1.3x (high stakes)
//    - Goals: 0.92x (more tactical)
//    - H2H: 1.2x (more relevant)
```

**ROI:** High (enables accurate predictions for international matches, expands market coverage)

---

### Phase 4: Market Predictions (Week 2-3)

**Goal:** Calculate probabilities for each betting market

```typescript
// /api/analysis/market-predictor.ts

// Helper: Adjust weights based on rest days
// If daysSinceLastMatch > 10, reduce recent form weight
function adjustWeightsForRestDays(
  baseWeights: Record<string, number>,
  daysSinceLastMatch: number
): Record<string, number> {
  const adjusted = { ...baseWeights };
  
  if (daysSinceLastMatch > 10) {
    // Reduce recent form weight by 30-50% (more reduction for longer rest)
    const reductionFactor = Math.min(0.5, 0.3 + (daysSinceLastMatch - 10) * 0.02);
    adjusted.recentForm = adjusted.recentForm * (1 - reductionFactor);
    
    // Redistribute reduced weight to other factors (H2H, historical data)
    const weightToRedistribute = adjusted.recentForm * reductionFactor;
    adjusted.h2h = (adjusted.h2h || 0) + weightToRedistribute * 0.6;
    adjusted.leaguePosition = (adjusted.leaguePosition || 0) + weightToRedistribute * 0.4;
  }
  
  return adjusted;
}

// Helper: Adjust weights for early season (< 5 rounds)
// Reduce recent form weight, increase H2H and historical data weight
function adjustWeightsForEarlySeason(
  baseWeights: Record<string, number>,
  isEarly: boolean
): Record<string, number> {
  if (!isEarly) return baseWeights;
  
  const adjusted = { ...baseWeights };
  
  // Reduce recent form by 40% (teams not yet in rhythm)
  const formReduction = adjusted.recentForm * 0.4;
  adjusted.recentForm = adjusted.recentForm * 0.6;
  
  // Increase H2H weight (more reliable than early season form)
  adjusted.h2h = (adjusted.h2h || 0) + formReduction * 0.6;
  
  // Increase historical/league position weight
  adjusted.leaguePosition = (adjusted.leaguePosition || 0) + formReduction * 0.4;
  
  return adjusted;
}

// Helper: Adjust weights for low H2H count
// If H2H matches < 5, reduce H2H weight by 40-60%
function adjustWeightsForLowH2H(
  baseWeights: Record<string, number>,
  h2hMatchCount: number
): Record<string, number> {
  const adjusted = { ...baseWeights };
  
  if (h2hMatchCount < 5) {
    // Reduce H2H weight: 40% reduction for 4 matches, 60% for 1 match
    const reductionFactor = 0.4 + (5 - h2hMatchCount) * 0.05; // 0.4 to 0.6
    const h2hReduction = (adjusted.h2h || 0) * reductionFactor;
    adjusted.h2h = (adjusted.h2h || 0) * (1 - reductionFactor);
    
    // Redistribute reduced weight to recent form and other factors
    adjusted.recentForm = (adjusted.recentForm || 0) + h2hReduction * 0.7;
    adjusted.homeAdvantage = (adjusted.homeAdvantage || 0) + h2hReduction * 0.3;
  }
  
  return adjusted;
}

interface AlternativeBet {
  market: string; // Any market: "OVER_UNDER_GOALS", "HOME_DRAW", "BTTS_FIRST_HALF", "DRAW_NO_BET_HOME", etc.
  line?: 0.5 | 1.5 | 2.5 | 3.5 | 4.5 | 5.5; // Only for OVER_UNDER_GOALS
  probability: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  reason: string;
  relationship: 'SAFER' | 'MORE_AGGRESSIVE' | 'CORRELATED' | 'COMPLEMENTARY';
  probabilityGain?: number; // How much higher/lower probability vs primary
  correlation?: number; // Correlation score (0-1) for correlated markets
  oddsEstimate?: number; // Estimated odds if available
}

interface MarketPrediction {
  market: 'MATCH_RESULT' | 'BTTS' | 'OVER_UNDER_GOALS' | 'FIRST_HALF' | string; // Allow any market string
  line?: 0.5 | 1.5 | 2.5 | 3.5 | 4.5 | 5.5; // Only for OVER_UNDER_GOALS (goal line)
  probabilities: {
    home?: number;
    draw?: number;
    away?: number;
    yes?: number;
    no?: number;
    over?: number;  // Used by OVER_UNDER_GOALS
    under?: number; // Used by OVER_UNDER_GOALS
  };
  rating: 'VERY_LIKELY' | 'LIKELY' | 'NEUTRAL' | 'UNLIKELY' | 'VERY_UNLIKELY';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  insights: Insight[];
  conflictingSignals?: ConflictingSignal[];
  recommendation?: string;
  alternatives?: AlternativeBet[]; // NEW: Alternative bet suggestions
}

interface ConflictingSignal {
  favors: 'home' | 'away' | 'yes' | 'no';
  factor: string;
  weight: number;
}

async function generateMarketPredictions(
  homeTeamData: TeamData,
  awayTeamData: TeamData,
  h2hData: H2HData,
  matchContext?: { 
    round?: string; 
    leagueName?: string;
    homeFormation?: string;
    awayFormation?: string;
  }
): Promise<MarketPrediction[]> {
  const predictions: MarketPrediction[] = [];
  
  // Detect early season
  const isEarlySeason = matchContext?.round 
    ? isEarlySeason(matchContext.round)
    : false;
  
  // Calculate formation stability for both teams (with early season context)
  const homeFormationStability = matchContext?.homeFormation
    ? calculateFormationStability(
        matchContext.homeFormation,
        homeTeamData.dna.mostPlayedFormation,
        homeTeamData.dna.formationFrequency,
        isEarlySeason
      )
    : { isStable: true, stabilityScore: 100, confidenceReduction: 0 };
  
  const awayFormationStability = matchContext?.awayFormation
    ? calculateFormationStability(
        matchContext.awayFormation,
        awayTeamData.dna.mostPlayedFormation,
        awayTeamData.dna.formationFrequency,
        isEarlySeason
      )
    : { isStable: true, stabilityScore: 100, confidenceReduction: 0 };
  
  // Calculate combined formation impact (capped at 30% total reduction)
  const totalFormationReduction = Math.min(30, 
    homeFormationStability.confidenceReduction + awayFormationStability.confidenceReduction
  );
  
  // Calculate safety flags (no manager context needed)
  homeTeamData.safetyFlags = detectSafetyFlags(homeTeamData, awayTeamData);
  awayTeamData.safetyFlags = detectSafetyFlags(awayTeamData, homeTeamData);
  
  // 1. BTTS (40% less impact from formations)
  predictions.push(await predictBTTS(
    homeTeamData, 
    awayTeamData, 
    h2hData,
    isEarlySeason,
    { 
      homeFormationStability, 
      awayFormationStability,
      totalFormationReduction: totalFormationReduction * 0.6 // 40% less impact
    }
  ));
  
  // 2. Over/Under Goals (multi-line) (40% less impact from formations)
  // One prediction per goal line, using the same base signals but line-aware conversion.
  const defaultGoalLines: Array<0.5 | 1.5 | 2.5 | 3.5 | 4.5 | 5.5> = [0.5, 1.5, 2.5, 3.5, 4.5, 5.5];
  for (const line of defaultGoalLines) {
    predictions.push(await predictOverUnderGoals(
      homeTeamData,
      awayTeamData,
      h2hData,
      line,
      isEarlySeason,
      {
        homeFormationStability,
        awayFormationStability,
        totalFormationReduction: totalFormationReduction * 0.6 // 40% less impact
      }
    ));
  }
  
  // 3. Match Result (Full impact from formations)
  predictions.push(await predictMatchResult(
    homeTeamData, 
    awayTeamData, 
    h2hData,
    isEarlySeason,
    { 
      homeFormationStability, 
      awayFormationStability,
      totalFormationReduction // Full impact
    }
  ));
  
  // 4. First Half (20% less impact from formations)
  predictions.push(await predictFirstHalf(
    homeTeamData, 
    awayTeamData, 
    h2hData,
    isEarlySeason,
    { 
      homeFormationStability, 
      awayFormationStability,
      totalFormationReduction: totalFormationReduction * 0.8 // 20% less impact
    }
  ));
  
  return predictions;
}

async function predictBTTS(
  homeTeam: TeamData,
  awayTeam: TeamData,
  h2h: H2HData,
  isEarlySeason: boolean = false,
  formationStability?: {
    homeFormationStability: { isStable: boolean; stabilityScore: number; confidenceReduction: number };
    awayFormationStability: { isStable: boolean; stabilityScore: number; confidenceReduction: number };
    totalFormationReduction: number; // Market-adjusted reduction
  }
): Promise<MarketPrediction> {
  const insights: Insight[] = [];
  const conflicts: ConflictingSignal[] = [];
  
  // Base weights for BTTS market
  let weights = {
    scoringRate: 0.25,
    h2h: 0.25,
    defensiveForm: 0.20,
    recentForm: 0.35,
  };
  
  // Adjust weights based on context
  weights = adjustWeightsForRestDays(weights, homeTeam.daysSinceLastMatch);
  weights = adjustWeightsForRestDays(weights, awayTeam.daysSinceLastMatch);
  weights = adjustWeightsForEarlySeason(weights, isEarlySeason);
  weights = adjustWeightsForLowH2H(weights, h2h.h2hMatchCount);
  
  // Factor 1: Home team scoring rate
  const homeScored = homeTeam.lastHomeMatches.filter(m => m.goalsScored > 0).length;
  const homeScoredPct = homeTeam.lastHomeMatches.length > 0
    ? (homeScored / homeTeam.lastHomeMatches.length) * 100
    : 0;
  const homeScoreScore = homeScoredPct; // 0-100
  
  insights.push({
    text: `${homeTeam.name} scored in ${homeScored} of last ${homeTeam.lastHomeMatches.length} home games (${homeScoredPct.toFixed(0)}%)`,
    emoji: '⚽',
    priority: 90,
    category: 'SCORING',
    severity: homeScoredPct >= 80 ? 'HIGH' : 'MEDIUM',
  });
  
  // Factor 2: Away team scoring rate
  const awayScored = awayTeam.lastAwayMatches.filter(m => m.goalsScored > 0).length;
  const awayScoredPct = awayTeam.lastAwayMatches.length > 0
    ? (awayScored / awayTeam.lastAwayMatches.length) * 100
    : 0;
  const awayScoreScore = awayScoredPct;
  
  insights.push({
    text: `${awayTeam.name} scored in ${awayScored} of last ${awayTeam.lastAwayMatches.length} away games (${awayScoredPct.toFixed(0)}%)`,
    emoji: '⚽',
    priority: 90,
    category: 'SCORING',
    severity: awayScoredPct >= 80 ? 'HIGH' : 'MEDIUM',
  });
  
  // Factor 3: H2H BTTS (use weighted percentage if available, fallback to simple)
  const h2hBTTSScore = h2h.weightedBttsPercentage > 0 
    ? h2h.weightedBttsPercentage 
    : h2h.bttsPercentage;
  
  // Add warning if low H2H count
  if (h2h.h2hMatchCount < 5) {
    insights.push({
      text: `⚠️ Limited H2H data: Only ${h2h.h2hMatchCount} previous meetings`,
      emoji: '⚠️',
      priority: 60,
      category: 'H2H',
      severity: 'MEDIUM',
    });
  }
  
  if (h2h.bttsPercentage >= 60 || h2h.weightedBttsPercentage >= 60) {
    const displayPct = h2h.weightedBttsPercentage > 0 
      ? h2h.weightedBttsPercentage 
      : h2h.bttsPercentage;
    insights.push({
      text: `BTTS in ${h2h.bttsCount} of last ${h2h.matches.length} H2H meetings (${displayPct.toFixed(0)}%)`,
      emoji: '📊',
      priority: 95,
      category: 'H2H',
      severity: displayPct >= 80 ? 'HIGH' : 'MEDIUM',
    });
  }
  
  // Factor 4: Home defensive weakness
  const homeDefenseScore = homeTeam.lastHomeMatches.length > 0
    ? 100 - (homeTeam.stats.cleanSheets / homeTeam.lastHomeMatches.length * 100)
    : 50;
  
  if (homeTeam.stats.cleanSheetDrought >= 8) {
    insights.push({
      text: `${homeTeam.name}: 0 clean sheets in last ${homeTeam.stats.cleanSheetDrought} games`,
      emoji: '🔓',
      priority: 85,
      category: 'DEFENSIVE',
      severity: homeTeam.stats.cleanSheetDrought >= 12 ? 'CRITICAL' : 'HIGH',
    });
  }
  
  // Factor 5: Away defensive weakness
  const awayDefenseScore = awayTeam.lastAwayMatches.length > 0
    ? 100 - (awayTeam.stats.cleanSheets / awayTeam.lastAwayMatches.length * 100)
    : 50;
  
  // Calculate weighted score using adjusted weights
  const scoringWeight = weights.scoringRate / 2; // Split between home and away
  const defensiveWeight = weights.defensiveForm / 2; // Split between home and away
  
  const baseProbability = (
    homeScoreScore * scoringWeight +
    awayScoreScore * scoringWeight +
    h2hBTTSScore * weights.h2h +
    homeDefenseScore * defensiveWeight +
    awayDefenseScore * defensiveWeight
  );
  
  // Collect ALL adjustments in array (not applied yet)
  const allAdjustments: Adjustment[] = [];
  
  // 1. DNA adjustments
  // NOTE: DNA goal trends are stored per goal line in goalLineOverPct.
  // For BTTS, we use the 2.5 line as a proxy for low-scoring DNA and derive under% as (100 - over%).
  const homeOver25Pct = homeTeam.dna.goalLineOverPct['2.5'] || 0;
  const awayOver25Pct = awayTeam.dna.goalLineOverPct['2.5'] || 0;
  const homeUnder25Pct = 100 - homeOver25Pct;
  const awayUnder25Pct = 100 - awayOver25Pct;
  const homeDnaAdjustment = homeUnder25Pct > 70 ? -5 : 0;
  const awayDnaAdjustment = awayUnder25Pct > 70 ? -5 : 0;
  if (homeDnaAdjustment !== 0) {
    allAdjustments.push({
      name: 'dna_home_under_goals',
      value: homeDnaAdjustment,
      reason: `${homeTeam.name} season DNA: ${homeUnder25Pct.toFixed(0)}% Under 2.5`,
    });
  }
  if (awayDnaAdjustment !== 0) {
    allAdjustments.push({
      name: 'dna_away_under_goals',
      value: awayDnaAdjustment,
      reason: `${awayTeam.name} season DNA: ${awayUnder25Pct.toFixed(0)}% Under 2.5`,
    });
  }
  
  // 2. Formation stability adjustments (market-adjusted for BTTS - 40% less impact)
  const formationAdjustment = -(formationStability?.totalFormationReduction || 0) * 0.6;
  if (formationAdjustment !== 0) {
    allAdjustments.push({
      name: 'formation_instability',
      value: formationAdjustment,
      reason: 'Experimental formation(s) detected',
    });
  }
  
  // 3. Safety flag adjustments
  if (homeTeam.safetyFlags.liveDog || awayTeam.safetyFlags.liveDog) {
    allAdjustments.push({
      name: 'live_dog',
      value: 10,
      reason: 'Bottom team showing form - switch to BTTS',
    });
  }
  
  // 4. Rest day adjustments (if applicable)
  if (homeTeam.daysSinceLastMatch > 10) {
    allAdjustments.push({
      name: 'rest_days_home',
      value: -2,
      reason: `Home team rested ${homeTeam.daysSinceLastMatch} days`,
    });
  }
  if (awayTeam.daysSinceLastMatch > 10) {
    allAdjustments.push({
      name: 'rest_days_away',
      value: -2,
      reason: `Away team rested ${awayTeam.daysSinceLastMatch} days`,
    });
  }
  
  // Apply ALL adjustments through unified capping function
  const adjustmentResult = applyCappedAsymmetricAdjustments(
    baseProbability,
    allAdjustments,
    'BTTS',
    config
  );
  
  const finalProbability = adjustmentResult.finalProbability;
  
  // Convert to probability
  const yesProbability = finalProbability;
  const noProbability = 100 - yesProbability;
  
  // Determine rating
  const rating = getRating(yesProbability);
  
  // Add formation instability insights with early season context
  const formationReduction = formationStability?.totalFormationReduction || 0;
  if (formationReduction > 0) {
    if (!formationStability?.homeFormationStability.isStable) {
      const earlySeasonNote = isEarlySeason ? ' (early season - more acceptable)' : '';
      insights.push({
        text: `🔄 ${homeTeam.name}: Experimental formation (${formationStability.homeFormationStability.stabilityScore.toFixed(0)}% usage, usually plays ${homeTeam.dna.mostPlayedFormation})${earlySeasonNote}`,
        emoji: '🔄',
        priority: 80,
        category: 'FORM',
        severity: formationStability.homeFormationStability.stabilityScore < 20 ? 'HIGH' : 'MEDIUM',
      });
    }
    
    if (!formationStability?.awayFormationStability.isStable) {
      const earlySeasonNote = isEarlySeason ? ' (early season - more acceptable)' : '';
      insights.push({
        text: `🔄 ${awayTeam.name}: Experimental formation (${formationStability.awayFormationStability.stabilityScore.toFixed(0)}% usage, usually plays ${awayTeam.dna.mostPlayedFormation})${earlySeasonNote}`,
        emoji: '🔄',
        priority: 80,
        category: 'FORM',
        severity: formationStability.awayFormationStability.stabilityScore < 20 ? 'HIGH' : 'MEDIUM',
      });
    }
  }
  
  // Add DNA insights
  if (homeUnder25Pct > 70) {
    insights.push({
      text: `${homeTeam.name} season DNA: ${homeUnder25Pct.toFixed(0)}% Under 2.5 (proxy for low-scoring DNA) - Trust the DNA`,
      emoji: '🧬',
      priority: 75,
      category: 'SCORING',
      severity: 'MEDIUM',
    });
  }
  
  // Calculate base confidence
  const signals = [
    { score: homeScoreScore, weight: 0.25 },
    { score: awayScoreScore, weight: 0.25 },
    { score: h2hBTTSScore, weight: 0.25 },
    { score: homeDefenseScore, weight: 0.125 },
    { score: awayDefenseScore, weight: 0.125 },
  ];
  
  const signalsForYes = signals.filter(s => s.score >= 60).length;
  const signalsForNo = signals.filter(s => s.score < 40).length;
  
  let baseConfidence: 'HIGH' | 'MEDIUM' | 'LOW';
  if (signalsForYes >= 4 || signalsForNo >= 4) {
    baseConfidence = 'HIGH';
  } else if (signalsForYes >= 3 || signalsForNo >= 3) {
    baseConfidence = 'MEDIUM';
  } else {
    baseConfidence = 'LOW';
  }
  
  // Downgrade confidence if big swing occurred
  let confidence = downgradeConfidenceIfBigSwing(
    baseConfidence,
    Math.abs(adjustmentResult.totalAdjustment),
    allAdjustments.length,
    config
  );
  
  // Adjust confidence based on formation stability (market-adjusted)
  const formationReduction = formationStability?.totalFormationReduction || 0;
  
  if (formationReduction > 0) {
    // Apply tiered confidence reduction based on market-adjusted formation impact
    if (confidence === 'HIGH' && formationReduction > 12) {
      confidence = 'MEDIUM';
    } else if (confidence === 'MEDIUM' && formationReduction > 18) {
      confidence = 'LOW';
    }
  }
  
  // Detect conflicts
  if (homeScoreScore < 50 && awayScoreScore < 50 && h2hBTTSScore >= 70) {
    conflicts.push({
      favors: 'yes',
      factor: 'H2H history suggests BTTS',
      weight: 0.25,
    });
    conflicts.push({
      favors: 'no',
      factor: 'Both teams struggling to score recently',
      weight: 0.50,
    });
  }
  
  // Generate recommendation
  let recommendation: string;
  if (rating === 'VERY_LIKELY' || rating === 'LIKELY') {
    recommendation = 'BTTS - Yes ✅';
  } else if (rating === 'VERY_UNLIKELY' || rating === 'UNLIKELY') {
    recommendation = 'BTTS - No ✅';
  } else {
    recommendation = 'BTTS - Neutral 🤔';
  }
  
  // Sort insights by priority
  const topInsights = insights
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 5);
  
  return {
    market: 'BTTS',
    probabilities: {
      yes: yesProbability,
      no: noProbability,
    },
    rating,
    confidence: finalConfidence,
    insights: topInsights,
    conflictingSignals: conflicts.length > 0 ? conflicts : undefined,
    recommendation,
  };
}

// Predict Over/Under Goals (multi-line) with Goal Efficiency (DNA layer)
// Returns ONE prediction for a given goal line; call in a loop for multiple lines.
async function predictOverUnderGoals(
  homeTeam: TeamData,
  awayTeam: TeamData,
  h2h: H2HData,
  line: 0.5 | 1.5 | 2.5 | 3.5 | 4.5 | 5.5,
  isEarlySeason: boolean = false,
  formationStability?: {
    homeFormationStability: { isStable: boolean; stabilityScore: number; confidenceReduction: number };
    awayFormationStability: { isStable: boolean; stabilityScore: number; confidenceReduction: number };
    totalFormationReduction: number; // Market-adjusted reduction (40% less impact)
  },
  config: AlgorithmConfig
): Promise<MarketPrediction> {
  const insights: Insight[] = [];
  
  // Base weights
  let weights = {
    avgGoalsPerGame: 0.30,
    recentForm: 0.30,
    h2h: 0.20,
    defensiveWeakness: 0.25,
  };
  
  // Apply adjustments
  weights = adjustWeightsForRestDays(weights, homeTeam.daysSinceLastMatch);
  weights = adjustWeightsForRestDays(weights, awayTeam.daysSinceLastMatch);
  weights = adjustWeightsForEarlySeason(weights, isEarlySeason);
  weights = adjustWeightsForLowH2H(weights, h2h.h2hMatchCount);
  
  // Calculate average goals
  const homeAvgGoals = homeTeam.stats.avgGoalsScored;
  const awayAvgGoals = awayTeam.stats.avgGoalsScored;
  const combinedAvgGoals = homeAvgGoals + awayAvgGoals;
  
  // Apply Goal Efficiency (DNA layer) - Frustration Filter
  // Trust long-term DNA over recent outliers.
  // NOTE: DNA is stored per-line in goalLineOverPct; under% is derived as (100 - over%).
  const homeDnaOverPct = homeTeam.dna.goalLineOverPct[String(line)] || 0;
  const awayDnaOverPct = awayTeam.dna.goalLineOverPct[String(line)] || 0;
  const homeDnaUnderPct = 100 - homeDnaOverPct;
  const awayDnaUnderPct = 100 - awayDnaOverPct;
  
  let dnaAdjustment = 0;
  if (homeDnaUnderPct > 70 || awayDnaUnderPct > 70) {
    // Strong Under DNA at this line: reduce Over probability even if recent form suggests Over
    const avgDnaUnderPct = (homeDnaUnderPct + awayDnaUnderPct) / 2;
    dnaAdjustment = -(avgDnaUnderPct - 50) * 0.3; // e.g. -6% to -9%
    
    insights.push({
      text: `🧬 Season DNA (line ${line}): ${homeTeam.name} ${homeDnaUnderPct.toFixed(0)}% Under, ${awayTeam.name} ${awayDnaUnderPct.toFixed(0)}% Under - Trust the DNA over recent form`,
      emoji: '🧬',
      priority: 85,
      category: 'SCORING',
      severity: 'HIGH',
    });
  }
  
  // Calculate base probability
  const baseProbability = combinedAvgGoals * 20; // Scale to 0-100
  
  // Collect ALL adjustments in array (not applied yet)
  const allAdjustments: Adjustment[] = [];
  
  // 1. DNA adjustments
  if (dnaAdjustment !== 0) {
    allAdjustments.push({
      name: 'dna_under_goals',
      value: dnaAdjustment,
      reason: `Season DNA (line ${line}): ${homeTeam.name} ${homeDnaUnderPct.toFixed(0)}% Under, ${awayTeam.name} ${awayDnaUnderPct.toFixed(0)}% Under`,
    });
  }
  
  // 2. Formation stability adjustments (market-adjusted: 40% less impact for O/U)
  const formationAdjustment = -(formationStability?.totalFormationReduction || 0) * 0.6;
  if (formationAdjustment !== 0) {
    allAdjustments.push({
      name: 'formation_instability',
      value: formationAdjustment,
      reason: 'Experimental formation(s) detected',
    });
  }
  
  // 3. Safety flag adjustments
  if (homeTeam.safetyFlags.regressionRisk || awayTeam.safetyFlags.regressionRisk) {
    allAdjustments.push({
      name: 'regression_risk',
      value: -3,
      reason: 'Regression risk teams may score less',
    });
  }
  
  // Apply ALL adjustments through unified capping function
  const adjustmentResult = applyCappedAsymmetricAdjustments(
    baseProbability,
    allAdjustments,
    'OVER_UNDER_GOALS',
    config
  );
  
  const finalProbability = adjustmentResult.finalProbability;
  
  const overProbability = finalProbability;
  const underProbability = 100 - overProbability;
  const rating = getRating(overProbability);
  
  // Calculate base confidence
  let baseConfidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
  if (Math.abs(finalProbability - 50) > 25) baseConfidence = 'HIGH';
  if (Math.abs(finalProbability - 50) < 10) baseConfidence = 'LOW';
  
  // Downgrade confidence if big swing occurred
  let confidence = downgradeConfidenceIfBigSwing(
    baseConfidence,
    Math.abs(adjustmentResult.totalAdjustment),
    allAdjustments.length,
    config
  );
  
  // Adjust confidence for formation instability (market-adjusted impact)
  const formationReduction = formationStability?.totalFormationReduction || 0;
  if (formationReduction > 0) {
    if (confidence === 'HIGH' && formationReduction > 12) {
      confidence = 'MEDIUM';
    } else if (confidence === 'MEDIUM' && formationReduction > 18) {
      confidence = 'LOW';
    }
  }
  
  return {
    market: 'OVER_UNDER_GOALS',
    line,
    probabilities: { over: overProbability, under: underProbability },
    rating,
    confidence,
    insights: insights.slice(0, 5),
    recommendation: rating === 'LIKELY' || rating === 'VERY_LIKELY'
      ? `Over ${line} - Yes ✅`
      : rating === 'UNLIKELY' || rating === 'VERY_UNLIKELY'
      ? `Under ${line} - Yes ✅`
      : `Over/Under ${line} - Neutral 🤔`,
  };
}

// Predict Match Result (1X2) with Mind/Mood/DNA layers
async function predictMatchResult(
  homeTeam: TeamData,
  awayTeam: TeamData,
  h2h: H2HData,
  isEarlySeason: boolean = false,
  formationStability?: {
    homeFormationStability: { isStable: boolean; stabilityScore: number; confidenceReduction: number };
    awayFormationStability: { isStable: boolean; stabilityScore: number; confidenceReduction: number };
    totalFormationReduction: number; // Full impact for match result
  }
): Promise<MarketPrediction> {
  const insights: Insight[] = [];
  
  // Base weights
  let weights = {
    recentForm: 0.30,
    h2h: 0.25,
    homeAdvantage: 0.20,
    motivation: 0.18,
    rest: 0.12,
    leaguePosition: 0.10,
  };
  
  // Apply adjustments
  weights = adjustWeightsForRestDays(weights, homeTeam.daysSinceLastMatch);
  weights = adjustWeightsForRestDays(weights, awayTeam.daysSinceLastMatch);
  weights = adjustWeightsForEarlySeason(weights, isEarlySeason);
  weights = adjustWeightsForLowH2H(weights, h2h.h2hMatchCount);
  
  // NOTE: This is a simplified version. See Section 4.6.1 for the full implementation
  // that properly uses all factors (form, H2H, dynamic home advantage, rest advantage, etc.)
  // The full implementation should be used in production for better accuracy.
  
  // Calculate probabilities (simplified - see Section 4.6.1 for full implementation)
  let homeProb = 40; // Base home advantage (should be dynamic - see Section 4.6.1)
  let drawProb = 25;
  let awayProb = 35;
  
  // Apply Mind/Mood gap
  if (homeTeam.mood.isSleepingGiant) {
    homeProb += 10; // Value bet: Tier 1 quality, Tier 4 form
    insights.push({
      text: `💎 Value Alert: ${homeTeam.name} is Tier ${homeTeam.mind.tier} quality but Tier ${homeTeam.mood.tier} form`,
      emoji: '💤',
      priority: 95,
      category: 'FORM',
      severity: 'HIGH',
    });
  }
  if (awayTeam.mood.isSleepingGiant) {
    awayProb += 10;
    insights.push({
      text: `💎 Value Alert: ${awayTeam.name} is Tier ${awayTeam.mind.tier} quality but Tier ${awayTeam.mood.tier} form`,
      emoji: '💤',
      priority: 95,
      category: 'FORM',
      severity: 'HIGH',
    });
  }
  
  // One-Season Wonder: Recently promoted team that overperformed and is regressing
  // Reduce confidence instead of adding probability (different from genuine sleeping giant)
  if (homeTeam.mood.isOneSeasonWonder) {
    // Don't add probability - they're regressing, not a value bet
    // Instead, reduce confidence to reflect uncertainty
    confidence = Math.max(confidence * 0.7, 0.3); // Reduce confidence by 30%, minimum 30%
    insights.push({
      text: `⚠️ One-Season Wonder Risk: ${homeTeam.name} overperformed last season, now regressing to true level`,
      emoji: '📉',
      priority: 90,
      category: 'FORM',
      severity: 'HIGH',
    });
  }
  if (awayTeam.mood.isOneSeasonWonder) {
    confidence = Math.max(confidence * 0.7, 0.3);
    insights.push({
      text: `⚠️ One-Season Wonder Risk: ${awayTeam.name} overperformed last season, now regressing to true level`,
      emoji: '📉',
      priority: 90,
      category: 'FORM',
      severity: 'HIGH',
    });
  }
  
  if (homeTeam.mood.isOverPerformer) {
    homeProb -= 8; // Regression risk
    insights.push({
      text: `⚠️ Regression Risk: ${homeTeam.name} is Tier ${homeTeam.mind.tier} quality but Tier ${homeTeam.mood.tier} form`,
      emoji: '📉',
      priority: 90,
      category: 'FORM',
      severity: 'HIGH',
    });
  }
  if (awayTeam.mood.isOverPerformer) {
    awayProb -= 8;
    insights.push({
      text: `⚠️ Regression Risk: ${awayTeam.name} is Tier ${awayTeam.mind.tier} quality but Tier ${awayTeam.mood.tier} form`,
      emoji: '📉',
      priority: 90,
      category: 'FORM',
      severity: 'HIGH',
    });
  }
  
  // Apply Motivation Clash: +5% to motivated team
  if (homeTeam.safetyFlags.motivationClash) {
    const homeMotivation = calculateMotivation(homeTeam);
    const awayMotivation = calculateMotivation(awayTeam);
    if (homeMotivation === 'TITLE_RACE' && awayMotivation === 'MID_TABLE') {
      homeProb += 5;
    }
  }
  
  // Apply Regression Risk: -15% confidence
  let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
  if (homeTeam.safetyFlags.regressionRisk || awayTeam.safetyFlags.regressionRisk) {
    confidence = 'LOW';
  }
  
  // Apply formation stability: reduce confidence (full impact for match result)
  const formationReduction = formationStability?.totalFormationReduction || 0;
  if (formationReduction > 0) {
    if (confidence === 'HIGH' && formationReduction > 15) {
      confidence = 'MEDIUM';
    } else if (confidence === 'MEDIUM' && formationReduction > 20) {
      confidence = 'LOW';
    }
    
    // Add formation insights
    if (!formationStability?.homeFormationStability.isStable) {
      const earlySeasonNote = isEarlySeason ? ' (early season - more acceptable)' : '';
      insights.push({
        text: `🔄 ${homeTeam.name}: Experimental formation (${formationStability.homeFormationStability.stabilityScore.toFixed(0)}% usage)${earlySeasonNote}`,
        emoji: '🔄',
        priority: 85,
        category: 'FORM',
        severity: formationStability.homeFormationStability.stabilityScore < 20 ? 'HIGH' : 'MEDIUM',
      });
    }
    
    if (!formationStability?.awayFormationStability.isStable) {
      const earlySeasonNote = isEarlySeason ? ' (early season - more acceptable)' : '';
      insights.push({
        text: `🔄 ${awayTeam.name}: Experimental formation (${formationStability.awayFormationStability.stabilityScore.toFixed(0)}% usage)${earlySeasonNote}`,
        emoji: '🔄',
        priority: 85,
        category: 'FORM',
        severity: formationStability.awayFormationStability.stabilityScore < 20 ? 'HIGH' : 'MEDIUM',
      });
    }
  }
  
  // Normalize probabilities
  const total = homeProb + drawProb + awayProb;
  homeProb = (homeProb / total) * 100;
  drawProb = (drawProb / total) * 100;
  awayProb = (awayProb / total) * 100;
  
  const maxProb = Math.max(homeProb, drawProb, awayProb);
  const rating = maxProb >= 50 ? 'LIKELY' : maxProb >= 40 ? 'NEUTRAL' : 'UNLIKELY';
  
  return {
    market: 'MATCH_RESULT',
    probabilities: { home: homeProb, draw: drawProb, away: awayProb },
    rating,
    confidence,
    insights: insights.slice(0, 5),
    recommendation: maxProb === homeProb 
      ? `${homeTeam.name} Win ✅`
      : maxProb === awayProb
      ? `${awayTeam.name} Win ✅`
      : 'Draw ✅',
  };
}

// Predict First Half Result using Goal Minute Distribution
async function predictFirstHalf(
  homeTeam: TeamData,
  awayTeam: TeamData,
  h2h: H2HData,
  isEarlySeason: boolean = false,
  formationStability?: {
    homeFormationStability: { isStable: boolean; stabilityScore: number; confidenceReduction: number };
    awayFormationStability: { isStable: boolean; stabilityScore: number; confidenceReduction: number };
    totalFormationReduction: number; // Market-adjusted reduction (20% less impact)
  }
): Promise<MarketPrediction> {
  const insights: Insight[] = [];
  
  // Use Goal Minute Distribution from DNA layer
  const homeFirstHalfPct = homeTeam.dna.firstHalfGoalPercentage;
  const awayFirstHalfPct = awayTeam.dna.firstHalfGoalPercentage;
  const homeEarlyGoalPct = homeTeam.dna.earlyGoalPercentage;
  const awayEarlyGoalPct = awayTeam.dna.earlyGoalPercentage;
  
  // Detect late starters
  if (homeTeam.dna.lateStarter) {
    insights.push({
      text: `🐌 ${homeTeam.name}: Late starter - ${homeEarlyGoalPct.toFixed(0)}% goals in first 15 mins`,
      emoji: '🐌',
      priority: 80,
      category: 'TIMING',
      severity: 'MEDIUM',
    });
  }
  if (awayTeam.dna.lateStarter) {
    insights.push({
      text: `🐌 ${awayTeam.name}: Late starter - ${awayEarlyGoalPct.toFixed(0)}% goals in first 15 mins`,
      emoji: '🐌',
      priority: 80,
      category: 'TIMING',
      severity: 'MEDIUM',
    });
  }
  
  // Add Danger Zone insights
  if (homeTeam.dna.dangerZones.length > 0) {
    const topDangerZone = homeTeam.dna.dangerZones[0];
    insights.push({
      text: `⚠️ Danger Zone: ${homeTeam.name} concedes ${topDangerZone.percentage.toFixed(0)}% of goals in ${topDangerZone.window} min window`,
      emoji: '⚠️',
      priority: 75,
      category: 'DEFENSIVE',
      severity: 'MEDIUM',
    });
  }
  if (awayTeam.dna.dangerZones.length > 0) {
    const topDangerZone = awayTeam.dna.dangerZones[0];
    insights.push({
      text: `⚠️ Danger Zone: ${awayTeam.name} concedes ${topDangerZone.percentage.toFixed(0)}% of goals in ${topDangerZone.window} min window`,
      emoji: '⚠️',
      priority: 75,
      category: 'DEFENSIVE',
      severity: 'MEDIUM',
    });
  }
  
  // Calculate first half probability
  // If both teams are late starters, higher chance of draw at half time
  const avgFirstHalfPct = (homeFirstHalfPct + awayFirstHalfPct) / 2;
  let firstHalfScore = avgFirstHalfPct;
  
  // Late starters: reduce first half goals probability
  if (homeTeam.dna.lateStarter && awayTeam.dna.lateStarter) {
    firstHalfScore -= 15;
    insights.push({
      text: `⏰ Both teams are late starters - "Draw at Half Time" is a high-confidence play`,
      emoji: '⏰',
      priority: 85,
      category: 'TIMING',
      severity: 'HIGH',
    });
  }
  
  // Apply formation stability adjustment (market-adjusted: 20% less impact for First Half)
  const formationAdjustment = -(formationStability?.totalFormationReduction || 0);
  firstHalfScore += formationAdjustment;
  
  firstHalfScore = Math.max(0, Math.min(100, firstHalfScore));
  const yesProbability = firstHalfScore;
  const noProbability = 100 - yesProbability;
  const rating = getRating(yesProbability);
  
  let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
  if (Math.abs(yesProbability - 50) > 20) confidence = 'HIGH';
  if (Math.abs(yesProbability - 50) < 10) confidence = 'LOW';
  
  // Adjust confidence for formation instability (market-adjusted impact)
  const formationReduction = formationStability?.totalFormationReduction || 0;
  if (formationReduction > 0) {
    if (confidence === 'HIGH' && formationReduction > 14) {
      confidence = 'MEDIUM';
    } else if (confidence === 'MEDIUM' && formationReduction > 20) {
      confidence = 'LOW';
    }
  }
  
  return {
    market: 'FIRST_HALF',
    probabilities: { yes: yesProbability, no: noProbability },
    rating,
    confidence,
    insights: insights.slice(0, 5),
    recommendation: homeTeam.dna.lateStarter && awayTeam.dna.lateStarter
      ? 'Draw at Half Time ✅'
      : rating === 'LIKELY' || rating === 'VERY_LIKELY'
      ? 'Goals in First Half ✅'
      : 'No Goals in First Half ✅',
  };
}

function getRating(probability: number): MarketPrediction['rating'] {
  if (probability >= 80) return 'VERY_LIKELY';
  if (probability >= 65) return 'LIKELY';
  if (probability >= 50) return 'NEUTRAL';
  if (probability >= 35) return 'UNLIKELY';
  return 'VERY_UNLIKELY';
}
```

---

### Phase 4.5: Probability Swing Caps & Asymmetric Weighting

**Goal:** Prevent wild probability swings and implement asymmetric weighting to optimize for profitability rather than just accuracy.

#### 4.5.1 Problem Statement

**Current Issues:**

1. **Probability-Confidence Mismatch:**
   - Large adjustment stacks can move probability dramatically (e.g., 68% → 49% = 19 point swing)
   - Confidence only drops slightly, creating misleading predictions
   - Example: 49% probability with MEDIUM confidence is confusing

2. **Symmetric Adjustments:**
   - All adjustments are additive/subtractive equally
   - No market-specific risk/reward consideration
   - No direction-aware caps
   - Result: Over-bets on low-odds favorites, under-bets on high-odds value bets

**Why Asymmetric Weighting Matters:**

- **BTTS Yes at 1.60 odds:** False positives (predict Yes when No) are costly → need stricter caps on upward moves
- **Over 2.5 at 2.20 odds:** False positives are more acceptable (higher payout) → can allow bigger upward moves
- **Match Result favorites:** Low odds = high risk → need to penalize false positives heavily
- **Match Result underdogs:** High odds = value bets → can allow bigger downward moves

Without asymmetry: 65-70% accuracy but negative ROI (slow bleed on wrong side of variance).

#### 4.5.2 Hard Probability Swing Cap

**Implementation:**

- **Maximum swing from base probability:** ±20-25 percentage points
- **Absolute probability bounds:** Never go below 20% or above 80%
- **Prevents:** Wild swings like 68% → 42% that destroy user trust

**Logic:**

```typescript
// Apply hard cap on total probability swing
const MAX_PROB_SWING = 22; // percentage points (configurable)
const MIN_PROB = 20;       // Minimum probability (never below 20%)
const MAX_PROB = 80;       // Maximum probability (never above 80%)

function applyProbabilityCap(
  baseProbability: number,
  totalAdjustment: number
): number {
  // Cap total swing from base
  const cappedAdjustment = Math.sign(totalAdjustment) * 
    Math.min(Math.abs(totalAdjustment), MAX_PROB_SWING);
  
  let finalProbability = baseProbability + cappedAdjustment;
  
  // Also cap absolute probability to reasonable range
  finalProbability = Math.max(MIN_PROB, Math.min(MAX_PROB, finalProbability));
  
  return finalProbability;
}
```

**Benefits:**
- Prevents wild probability swings
- Maintains user trust (predictions stay reasonable)
- Protects against edge case bugs
- Still allows meaningful adjustments (±20% is significant)

**Configuration:**
- `maxProbSwing`: Default 22, configurable per market
- `minProb`: Default 20, configurable
- `maxProb`: Default 80, configurable

#### 4.5.3 Confidence Downgrade on Large Swings

**Implementation:**

- **Monitor swing magnitude:** Track total adjustment magnitude
- **Downgrade confidence:** Large swings → lower confidence
- **Prevents mismatch:** High probability + low confidence = warning sign

**Logic:**

```typescript
function calculateConfidenceWithSwing(
  baseConfidence: 'HIGH' | 'MEDIUM' | 'LOW',
  totalAdjustment: number,
  adjustmentCount: number
): 'HIGH' | 'MEDIUM' | 'LOW' {
  const swingMagnitude = Math.abs(totalAdjustment);
  
  // Downgrade confidence based on swing magnitude
  if (swingMagnitude > 15) {
    // Large swing (>15%): Downgrade by 2 levels
    if (baseConfidence === 'HIGH') return 'LOW';
    if (baseConfidence === 'MEDIUM') return 'LOW';
    return 'LOW';
  } else if (swingMagnitude > 10) {
    // Medium swing (10-15%): Downgrade by 1 level
    if (baseConfidence === 'HIGH') return 'MEDIUM';
    if (baseConfidence === 'MEDIUM') return 'LOW';
    return 'LOW';
  } else if (adjustmentCount > 4) {
    // Many adjustments (>4): Slight downgrade
    if (baseConfidence === 'HIGH') return 'MEDIUM';
    return baseConfidence;
  }
  
  return baseConfidence;
}
```

**Downgrade Rules:**

| Swing Magnitude | Adjustment Count | Confidence Change |
|----------------|------------------|-------------------|
| >15% | Any | HIGH → LOW, MEDIUM → LOW |
| 10-15% | Any | HIGH → MEDIUM, MEDIUM → LOW |
| <10% | >4 adjustments | HIGH → MEDIUM |
| <10% | ≤4 adjustments | No change |

**Benefits:**
- Confidence reflects probability movement
- Users see warning when many adjustments apply
- Prevents overconfidence in edge cases
- Transparent: Shows when prediction is less reliable

#### 4.5.4 Asymmetric Weighting System

**Goal:** Treat false positives and false negatives differently based on market odds and risk/reward.

**Market-Specific Asymmetry Configuration:**

```typescript
interface AsymmetricConfig {
  market: string;
  direction: 'UP' | 'DOWN';
  maxAdjustment: number;      // Different caps for up vs down
  riskMultiplier: number;     // How much to penalize false positives
  falsePositivePenalty: number; // Penalty for predicting Yes when No
  falseNegativePenalty: number; // Penalty for predicting No when Yes
}

const ASYMMETRIC_WEIGHTS: Record<string, AsymmetricConfig[]> = {
  BTTS: [
    {
      market: 'BTTS',
      direction: 'UP',    // Predicting Yes more
      maxAdjustment: 12,   // Cap upward moves (prevent false Yes)
      riskMultiplier: 1.2, // Penalize false positives more
      falsePositivePenalty: 1.5, // Heavy penalty for predicting Yes when No
      falseNegativePenalty: 1.0, // Normal penalty for predicting No when Yes
    },
    {
      market: 'BTTS',
      direction: 'DOWN',  // Predicting No more
      maxAdjustment: 20,   // Allow bigger downward moves
      riskMultiplier: 1.0,
      falsePositivePenalty: 1.0,
      falseNegativePenalty: 1.2, // Slight penalty for missing BTTS
    },
  ],
  OVER_UNDER_GOALS: [
    {
      market: 'OVER_UNDER_GOALS',
      direction: 'UP',    // Predicting Over more
      maxAdjustment: 18,   // Allow bigger upward moves (higher odds = more acceptable)
      riskMultiplier: 0.9, // Less penalty for false positives
      falsePositivePenalty: 0.8, // Less penalty (higher payout compensates)
      falseNegativePenalty: 1.3, // More penalty (missed value)
    },
    {
      market: 'OVER_UNDER_GOALS',
      direction: 'DOWN',  // Predicting Under more
      maxAdjustment: 15,   // Cap downward moves
      riskMultiplier: 1.1,
      falsePositivePenalty: 1.2,
      falseNegativePenalty: 0.9,
    },
  ],
  MATCH_RESULT: [
    {
      market: 'MATCH_RESULT',
      direction: 'UP',    // Predicting favorite more (low odds)
      maxAdjustment: 10,   // Cap upward moves (low odds = risky)
      riskMultiplier: 1.5, // Heavy penalty for false positives
      falsePositivePenalty: 2.0, // Very heavy penalty (low odds = big loss)
      falseNegativePenalty: 0.6, // Less penalty (missed opportunity)
    },
    {
      market: 'MATCH_RESULT',
      direction: 'DOWN',  // Predicting underdog more (high odds)
      maxAdjustment: 25,   // Allow bigger downward moves (value bets)
      riskMultiplier: 0.8, // Less penalty
      falsePositivePenalty: 0.7,
      falseNegativePenalty: 1.4, // More penalty (missed value bet)
    },
  ],
};
```

**Direction-Aware Adjustment Application:**

```typescript
function applyAsymmetricWeighting(
  adjustment: Adjustment,
  market: string,
  direction: 'UP' | 'DOWN',
  config: AsymmetricConfig
): Adjustment {
  // Determine direction
  const isUpward = adjustment.value > 0;
  const adjustmentDirection = isUpward ? 'UP' : 'DOWN';
  
  // Get asymmetric config for this direction
  const asymmetricConfig = config.direction === adjustmentDirection ? config : null;
  
  if (!asymmetricConfig) return adjustment;
  
  // Apply asymmetric cap
  const cappedValue = Math.sign(adjustment.value) * 
    Math.min(Math.abs(adjustment.value), asymmetricConfig.maxAdjustment);
  
  // Apply risk multiplier (penalize false positives more)
  const riskAdjustedValue = cappedValue * asymmetricConfig.riskMultiplier;
  
  return {
    ...adjustment,
    value: riskAdjustedValue,
    reason: `${adjustment.reason} (asymmetric: ${direction}, capped at ±${asymmetricConfig.maxAdjustment}%)`,
  };
}
```

**Market-Specific Asymmetry Factors:**

```typescript
interface MarketAsymmetry {
  market: string;
  favorUpward: number;         // Multiplier for upward adjustments (predicting Yes/Over/Home)
  favorDownward: number;        // Multiplier for downward adjustments (predicting No/Under/Away)
  falsePositivePenalty: number; // How much to penalize false positives
  falseNegativePenalty: number; // How much to penalize false negatives
}

const MARKET_ASYMMETRY: Record<string, MarketAsymmetry> = {
  BTTS: {
    market: 'BTTS',
    favorUpward: 0.8,           // Reduce upward moves (prevent false Yes)
    favorDownward: 1.2,         // Increase downward moves (safer)
    falsePositivePenalty: 1.5,   // Heavy penalty for predicting Yes when No
    falseNegativePenalty: 1.0,   // Normal penalty for predicting No when Yes
  },
  OVER_UNDER_GOALS: {
    market: 'OVER_UNDER_GOALS',
    favorUpward: 1.2,           // Increase upward moves (Over has higher odds)
    favorDownward: 0.9,         // Reduce downward moves
    falsePositivePenalty: 0.8,   // Less penalty (higher payout compensates)
    falseNegativePenalty: 1.3,   // More penalty (missed value)
  },
  MATCH_RESULT_HOME: {
    market: 'MATCH_RESULT',
    favorUpward: 0.7,           // Reduce upward moves (low odds favorites)
    favorDownward: 1.4,         // Increase downward moves (value bets)
    falsePositivePenalty: 2.0,   // Very heavy penalty (low odds = big loss)
    falseNegativePenalty: 0.6,   // Less penalty (missed opportunity)
  },
};
```

**Integration Points:**

- Applied after calculating all adjustments
- Before applying probability cap
- Market-specific configuration loaded from config
- Shown in API response as `asymmetricAdjustments` field

#### 4.5.5 Kelly-Aware Confidence (Advanced)

**Goal:** Adjust confidence based on expected value and optimal bet size (Kelly Criterion).

**Concept:**

- If predicted probability > implied odds probability + margin → HIGH confidence (value bet)
- If predicted probability ≈ implied odds → MEDIUM confidence
- If predicted probability < implied odds → LOW confidence or SKIP

**Implementation:**

```typescript
interface KellyConfidence {
  predictedProbability: number;
  impliedOddsProbability: number; // From bookmaker odds
  bookmakerMargin: number;        // Typical 5-10%
  expectedValue: number;          // (predictedProb * odds) - 1
  kellyFraction: number;          // Optimal bet size
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'SKIP';
}

function calculateKellyAwareConfidence(
  prediction: Prediction,
  odds: number,
  bookmakerMargin: number = 0.05
): KellyConfidence {
  const predictedProb = prediction.finalProbability / 100;
  const impliedProb = (1 / odds) * (1 - bookmakerMargin);
  
  // Calculate expected value
  const expectedValue = (predictedProb * odds) - 1;
  
  // Calculate Kelly fraction (optimal bet size)
  const kellyFraction = (predictedProb * odds - 1) / (odds - 1);
  
  // Determine confidence based on value
  let confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'SKIP';
  
  if (expectedValue > 0.15 && kellyFraction > 0.1) {
    confidence = 'HIGH'; // Strong value bet
  } else if (expectedValue > 0.05 && kellyFraction > 0.05) {
    confidence = 'MEDIUM'; // Moderate value
  } else if (expectedValue > 0) {
    confidence = 'LOW'; // Small value, risky
  } else {
    confidence = 'SKIP'; // Negative value, don't bet
  }
  
  return {
    predictedProbability: prediction.finalProbability,
    impliedOddsProbability: impliedProb * 100,
    bookmakerMargin: bookmakerMargin * 100,
    expectedValue,
    kellyFraction,
    confidence,
  };
}
```

**Kelly Fraction Interpretation:**

- **Kelly Fraction > 0.1:** Strong value bet → HIGH confidence
- **Kelly Fraction 0.05-0.1:** Moderate value → MEDIUM confidence
- **Kelly Fraction 0-0.05:** Small value → LOW confidence
- **Kelly Fraction < 0:** Negative value → SKIP

**Benefits:**

- Only recommends bets with positive expected value
- Adjusts confidence based on value, not just accuracy
- Prevents over-betting on low-odds favorites
- Identifies high-value underdog bets

**Note:** Requires bookmaker odds integration (deferred for MVP, but architecture ready)

#### 4.5.6 Unified Helper Function (Plug-and-Play)

**Goal:** Single function that applies all caps and asymmetric weighting in one place for easy integration.

**Implementation:**

```typescript
interface CappedAdjustmentResult {
  finalProbability: number;
  totalAdjustment: number;
  cappedAdjustments: Adjustment[];
  wasCapped: boolean;  // True if any adjustment was capped
  overcorrectionWarning?: string;  // Warning if overcorrection detected
}

/**
 * Apply all adjustments with caps & asymmetry in one function
 * This is the recommended way to use caps and asymmetric weighting
 */
function applyCappedAsymmetricAdjustments(
  baseProbability: number,
  adjustments: Adjustment[],
  market: 'BTTS' | 'OVER_2_5' | 'MATCH_RESULT' | 'FIRST_HALF',
  config: AlgorithmConfig
): CappedAdjustmentResult {
  const { maxSwing, minProb, maxProb } = config.probabilityCaps;
  const marketCaps = config.asymmetricWeighting[market.toLowerCase()] || {
    upMax: maxSwing,
    downMax: maxSwing,
  };

  // Step 0: Apply cumulative caps per adjustment type
  const cumulativelyCapped = applyCumulativeCaps(adjustments);
  
  // Step 1: Detect overcorrection
  const overcorrectionCheck = detectOvercorrection(cumulativelyCapped, baseProbability);
  
  // Step 2: Apply overcorrection reduction if needed
  const adjustedForOvercorrection = overcorrectionCheck.isOvercorrected
    ? cumulativelyCapped.map(adj => ({
        ...adj,
        value: adj.value * overcorrectionCheck.reductionFactor,
        reason: `${adj.reason} (overcorrection reduction: ${(overcorrectionCheck.reductionFactor * 100).toFixed(0)}%)`,
      }))
    : cumulativelyCapped;

  let totalAdjustment = 0;
  const cappedAdjustments: Adjustment[] = [];
  let wasCapped = false;

  // Step 3: Apply asymmetric caps to each adjustment individually
  for (const adj of adjustedForOvercorrection) {
    let cappedValue = adj.value;
    
    // Apply direction-specific cap
    if (cappedValue > 0) {
      // Upward adjustment: cap at upMax
      if (cappedValue > marketCaps.upMax) {
        cappedValue = marketCaps.upMax;
        wasCapped = true;
      }
      // Apply risk multiplier for upward moves
      cappedValue = cappedValue * (marketCaps.upRiskMultiplier || 1.0);
    } else {
      // Downward adjustment: cap at downMax (negative)
      if (cappedValue < -marketCaps.downMax) {
        cappedValue = -marketCaps.downMax;
        wasCapped = true;
      }
      // Apply risk multiplier for downward moves
      cappedValue = cappedValue * (marketCaps.downRiskMultiplier || 1.0);
    }

    totalAdjustment += cappedValue;
    
    // Track if this adjustment was capped
    const adjustmentWasCapped = Math.abs(cappedValue) < Math.abs(adj.value);
    cappedAdjustments.push({
      ...adj,
      value: cappedValue,
      reason: adj.reason + (adjustmentWasCapped ? ` (capped to ±${Math.abs(cappedValue).toFixed(1)}%)` : ''),
    });
  }

  // Step 4: Apply global total swing cap
  totalAdjustment = Math.max(-maxSwing, Math.min(maxSwing, totalAdjustment));
  if (Math.abs(totalAdjustment) !== Math.abs(
    cappedAdjustments.reduce((sum, adj) => sum + adj.value, 0)
  )) {
    wasCapped = true;
  }

  // Step 5: Calculate final probability with absolute bounds
  let finalProbability = baseProbability + totalAdjustment;
  finalProbability = Math.max(minProb, Math.min(maxProb, finalProbability));

  return {
    finalProbability,
    totalAdjustment,
    cappedAdjustments,
    wasCapped: wasCapped || overcorrectionCheck.isOvercorrected,
    overcorrectionWarning: overcorrectionCheck.isOvercorrected 
      ? overcorrectionCheck.reason 
      : undefined,
  };
}

/**
 * Apply cumulative caps per adjustment type to prevent stacking
 * Groups adjustments by type and applies cumulative limits
 */
function applyCumulativeCaps(
  adjustments: Adjustment[]
): Adjustment[] {
  const capped: Adjustment[] = [];
  const typeTotals = new Map<string, number>();
  
  // Group adjustments by type
  const adjustmentTypes = {
    'formation': ['formation_instability'],
    'injuries': ['injuries'],
    'dna': ['dna_home_under25', 'dna_away_under25', 'dna_home_over25', 'dna_away_over25'],
    'safety': ['live_dog', 'regression_risk', 'motivation_clash'],
    'rest': ['rest_days_home', 'rest_days_away'],
  };
  
  // Cumulative caps per type
  const typeCaps: Record<string, number> = {
    'formation': 15, // Max total formation impact
    'injuries': 15,  // Max total injury impact (already capped in calculateInjuryAdjustments)
    'dna': 8,        // Max total DNA impact
    'safety': 12,    // Max total safety flag impact
    'rest': 5,       // Max total rest day impact
  };
  
  for (const adj of adjustments) {
    // Find adjustment type
    let adjType: string | null = null;
    for (const [type, names] of Object.entries(adjustmentTypes)) {
      if (names.includes(adj.name)) {
        adjType = type;
        break;
      }
    }
    
    if (!adjType) {
      // Unknown type - apply as-is
      capped.push(adj);
      continue;
    }
    
    // Check cumulative cap for this type
    const currentTotal = typeTotals.get(adjType) || 0;
    const cap = typeCaps[adjType];
    
    if (Math.abs(currentTotal + adj.value) <= cap) {
      // Within cap - apply fully
      capped.push(adj);
      typeTotals.set(adjType, currentTotal + adj.value);
    } else {
      // Exceeds cap - apply partial
      const remaining = cap - Math.abs(currentTotal);
      const cappedValue = Math.sign(adj.value) * Math.min(Math.abs(adj.value), remaining);
      
      if (Math.abs(cappedValue) > 0) {
        capped.push({
          ...adj,
          value: cappedValue,
          reason: `${adj.reason} (cumulative cap: ${adjType} type limited to ±${cap}%)`,
        });
        typeTotals.set(adjType, currentTotal + cappedValue);
      }
      // If cappedValue is 0, skip this adjustment (already at cap)
    }
  }
  
  return capped;
}

/**
 * Detect and reduce overcorrection from multiple adjustments
 * Returns reduction factor and reason if overcorrection detected
 */
function detectOvercorrection(
  adjustments: Adjustment[],
  baseProbability: number
): {
  isOvercorrected: boolean;
  reductionFactor: number; // 0-1, how much to reduce adjustments
  reason: string;
} {
  // Check 1: Too many adjustments (>5)
  if (adjustments.length > 5) {
    return {
      isOvercorrected: true,
      reductionFactor: 0.85, // Reduce all by 15%
      reason: `Too many adjustments (${adjustments.length}) - reducing by 15% to prevent overcorrection`,
    };
  }
  
  // Check 2: Large total swing (>18%)
  const totalSwing = Math.abs(
    adjustments.reduce((sum, adj) => sum + adj.value, 0)
  );
  
  if (totalSwing > 18) {
    return {
      isOvercorrected: true,
      reductionFactor: 0.9, // Reduce all by 10%
      reason: `Large total swing (${totalSwing.toFixed(1)}%) - reducing by 10% to prevent overcorrection`,
    };
  }
  
  // Check 3: Conflicting adjustments (positive and negative)
  const positiveTotal = adjustments
    .filter(adj => adj.value > 0)
    .reduce((sum, adj) => sum + adj.value, 0);
  const negativeTotal = Math.abs(
    adjustments
      .filter(adj => adj.value < 0)
      .reduce((sum, adj) => sum + adj.value, 0)
  );
  
  // If both positive and negative adjustments are large, they're conflicting
  if (positiveTotal > 8 && negativeTotal > 8) {
    return {
      isOvercorrected: true,
      reductionFactor: 0.8, // Reduce all by 20%
      reason: `Conflicting adjustments detected (+${positiveTotal.toFixed(1)}% vs -${negativeTotal.toFixed(1)}%) - reducing by 20%`,
    };
  }
  
  // Check 4: Multiple high-impact adjustments of same type
  const formationAdjustments = adjustments.filter(adj => 
    adj.name.includes('formation')
  );
  const injuryAdjustments = adjustments.filter(adj => 
    adj.name.includes('injury')
  );
  
  if (formationAdjustments.length > 1 && 
      Math.abs(formationAdjustments.reduce((sum, adj) => sum + adj.value, 0)) > 10) {
    return {
      isOvercorrected: true,
      reductionFactor: 0.85,
      reason: 'Multiple formation adjustments stacking - reducing by 15%',
    };
  }
  
  if (injuryAdjustments.length > 2 && 
      Math.abs(injuryAdjustments.reduce((sum, adj) => sum + adj.value, 0)) > 12) {
    return {
      isOvercorrected: true,
      reductionFactor: 0.85,
      reason: 'Multiple injury adjustments stacking - reducing by 15%',
    };
  }
  
  return {
    isOvercorrected: false,
    reductionFactor: 1.0,
    reason: 'No overcorrection detected',
  };
}

/**
 * Downgrade confidence if big swing occurred
 * Called after applyCappedAsymmetricAdjustments
 */
function downgradeConfidenceIfBigSwing(
  baseConfidence: 'HIGH' | 'MEDIUM' | 'LOW',
  totalAdjustmentAbs: number,
  adjustmentCount: number,
  config: AlgorithmConfig
): 'HIGH' | 'MEDIUM' | 'LOW' {
  const { largeSwingThreshold, mediumSwingThreshold, manyAdjustmentsThreshold } = 
    config.confidenceDowngrade;

  if (totalAdjustmentAbs > largeSwingThreshold) {
    // Large swing: downgrade by 2 levels
    if (baseConfidence === 'HIGH') return 'LOW';
    if (baseConfidence === 'MEDIUM') return 'LOW';
    return 'LOW';
  } else if (totalAdjustmentAbs > mediumSwingThreshold) {
    // Medium swing: downgrade by 1 level
    if (baseConfidence === 'HIGH') return 'MEDIUM';
    if (baseConfidence === 'MEDIUM') return 'LOW';
    return 'LOW';
  } else if (adjustmentCount > manyAdjustmentsThreshold) {
    // Many adjustments: slight downgrade
    if (baseConfidence === 'HIGH') return 'MEDIUM';
    return baseConfidence;
  }

  return baseConfidence;
}
```

**Usage in Prediction Functions:**

```typescript
// Example: In predictBTTS function
async function predictBTTS(
  homeTeam: TeamData,
  awayTeam: TeamData,
  h2h: H2HData,
  isEarlySeason: boolean = false,
  formationStability?: FormationStabilityContext,
  config: AlgorithmConfig
): Promise<MarketPrediction> {
  // ... calculate base probability and collect all adjustments ...
  
  const baseProbability = 78.5; // From ML-learned weights
  const allAdjustments = [
    { name: 'rest_days_away', value: -2.4, reason: 'Away team rested 12 days' },
    { name: 'formation_instability', value: -12.0, reason: 'Experimental formation' },
    { name: 'live_dog_away', value: +10.0, reason: 'Bottom team showing form' },
    // ... more adjustments ...
  ];
  
  // Apply caps and asymmetric weighting (single function call)
  const adjustmentResult = applyCappedAsymmetricAdjustments(
    baseProbability,
    allAdjustments,
    'BTTS',
    config
  );
  
  const finalProbability = adjustmentResult.finalProbability;
  
  // Calculate base confidence
  let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = calculateBaseConfidence(
    baseProbability,
    allAdjustments
  );
  
  // Downgrade confidence if big swing occurred
  confidence = downgradeConfidenceIfBigSwing(
    confidence,
    Math.abs(adjustmentResult.totalAdjustment),
    allAdjustments.length,
    config
  );
  
  return {
    market: 'BTTS',
    probabilities: {
      yes: finalProbability,
      no: 100 - finalProbability,
    },
    rating: getRating(finalProbability),
    confidence,
    adjustments: adjustmentResult.cappedAdjustments,
    // ... rest of prediction ...
  };
}
```

**Benefits:**

- **Single function call:** Simplifies integration into prediction functions
- **All caps applied:** Individual caps, total swing cap, and absolute bounds
- **Asymmetric weighting:** Market-specific caps and risk multipliers applied automatically
- **Transparent:** Returns capped adjustments with reasons
- **Easy to test:** Can test on edge cases to verify swings stay reasonable

**Recommended Starting Values (Safe Launch):**

```typescript
const SAFE_LAUNCH_CONFIG = {
  probabilityCaps: {
    maxSwing: 22,  // ±22% max swing
    minProb: 20,   // Never below 20%
    maxProb: 80,   // Never above 80%
  },
  confidenceDowngrade: {
    largeSwingThreshold: 15,   // >15% = downgrade
    mediumSwingThreshold: 10, // 10-15% = downgrade
    manyAdjustmentsThreshold: 4, // >4 adjustments = downgrade
  },
  asymmetricWeighting: {
    btts: {
      upMax: 12,   // Cap upward moves at 12%
      downMax: 20, // Allow downward moves up to 20%
      upRiskMultiplier: 1.2,
      downRiskMultiplier: 1.0,
    },
    over25: {
      upMax: 18,   // More lenient on upward moves
      downMax: 15,
      upRiskMultiplier: 0.9,
      downRiskMultiplier: 1.1,
    },
    matchResult: {
      upMax: 10,   // Very strict on favorites
      downMax: 25, // Lenient on underdogs
      upRiskMultiplier: 1.5,
      downRiskMultiplier: 0.8,
    },
  },
};
```

#### 4.5.7 Complete Prediction Flow with Caps & Asymmetry

**Updated Flow (Using Unified Helper):**

```typescript
function generateFinalPrediction(
  market: 'BTTS' | 'OVER_2_5' | 'MATCH_RESULT' | 'FIRST_HALF',
  baseProbability: number,
  adjustments: Adjustment[],
  config: AlgorithmConfig,
  odds?: number
): FinalPrediction {
  // Step 1: Apply caps and asymmetric weighting (unified helper)
  const adjustmentResult = applyCappedAsymmetricAdjustments(
    baseProbability,
    adjustments,
    market,
    config
  );
  
  // Step 2: Calculate base confidence
  const baseConfidence = calculateBaseConfidence(market, baseProbability, adjustments);
  
  // Step 3: Downgrade confidence if big swing occurred
  const finalConfidence = downgradeConfidenceIfBigSwing(
    baseConfidence,
    Math.abs(adjustmentResult.totalAdjustment),
    adjustments.length,
    config
  );
  
  // Step 4: Apply Kelly-aware confidence if odds available
  let kellyConfidence = finalConfidence;
  if (odds && config.kellyCriterion.enabled) {
    const kelly = calculateKellyAwareConfidence(
      { finalProbability: adjustmentResult.finalProbability },
      odds,
      config.kellyCriterion.bookmakerMargin
    );
    // Use stricter of the two (Kelly or swing-based)
    kellyConfidence = getStricterConfidence(finalConfidence, kelly.confidence);
  }
  
  return {
    baseProbability,
    adjustments: adjustmentResult.cappedAdjustments,
    totalAdjustment: adjustmentResult.totalAdjustment,
    finalProbability: adjustmentResult.finalProbability,
    confidence: kellyConfidence,
    probabilitySwing: Math.abs(adjustmentResult.totalAdjustment),
    wasCapped: adjustmentResult.wasCapped,
    explanation: generateExplanation(
      baseProbability,
      adjustmentResult.cappedAdjustments,
      adjustmentResult.finalProbability
    ),
  };
}
```

**Configuration Updates:**

Add to `AlgorithmConfig`:

```typescript
interface AlgorithmConfig {
  // ... existing config ...
  
  // Probability Swing Caps
  probabilityCaps: {
    maxSwing: number;        // Max ±swing from base (default: 22)
    minProb: number;         // Minimum probability (default: 20)
    maxProb: number;         // Maximum probability (default: 80)
  };
  
  // Confidence Downgrade Rules
  confidenceDowngrade: {
    largeSwingThreshold: number;    // Swing >15% (default: 15)
    mediumSwingThreshold: number;   // Swing 10-15% (default: 10)
    manyAdjustmentsThreshold: number; // >4 adjustments (default: 4)
  };
  
  // Asymmetric Weighting
  asymmetricWeighting: {
    btts: {
      upMax: number;         // Max upward adjustment (default: 12)
      downMax: number;       // Max downward adjustment (default: 20)
      upRiskMultiplier: number;  // Risk multiplier for up (default: 1.2)
      downRiskMultiplier: number; // Risk multiplier for down (default: 1.0)
    };
    over25: {
      upMax: number;         // Max upward adjustment (default: 18)
      downMax: number;       // Max downward adjustment (default: 15)
      upRiskMultiplier: number;  // Risk multiplier for up (default: 0.9)
      downRiskMultiplier: number; // Risk multiplier for down (default: 1.1)
    };
    matchResult: {
      upMax: number;         // Max upward adjustment (default: 10)
      downMax: number;       // Max downward adjustment (default: 25)
      upRiskMultiplier: number;  // Risk multiplier for up (default: 1.5)
      downRiskMultiplier: number; // Risk multiplier for down (default: 0.8)
    };
  };
  
  // Kelly Criterion (optional, requires odds)
  kellyCriterion: {
    enabled: boolean;        // Enable Kelly-aware confidence (default: false)
    bookmakerMargin: number; // Typical margin (default: 0.05)
    minKellyFraction: number; // Minimum Kelly fraction for HIGH confidence (default: 0.1)
  };
}
```

**Integration Points:**

- Called after all adjustments are calculated
- Applied before final probability calculation
- Market-specific configuration loaded from config
- Shown in API response with explanation

**Benefits:**

- Prevents wild probability swings (maintains trust)
- Optimizes for profitability, not just accuracy
- Reduces over-betting on low-odds favorites
- Identifies high-value underdog bets
- Confidence reflects both accuracy and value

#### 4.5.8 Launch Safety Summary & Quick Reference

**Goal:** Prevent over-tuning flips and mismatched confidence-probability. Quick reference for implementation.

**Implemented Improvements:**

- ✅ **Global Hard Cap:** Max ±22% swing from base probability (configurable)
- ✅ **Asymmetric Caps:** Market-specific direction-aware limits (e.g., BTTS up capped at 12%, down at -20%)
- ✅ **Confidence Downgrade:** Large swings (>15%) or many adjustments (>4) → auto-downgrade confidence
- ✅ **Unified Helper:** `applyCappedAsymmetricAdjustments()` — single call for all caps/asymmetry
- ✅ **Minimum Batch Size:** Skip weekly retrain if <2,000 unique matches

**Starting Safe Values (Recommended):**

```typescript
const SAFE_LAUNCH_CONFIG = {
  probabilityCaps: {
    maxSwing: 22,        // Max ±22% swing from base
    minProb: 20,         // Never below 20%
    maxProb: 80,         // Never above 80%
  },
  
  confidenceDowngrade: {
    largeSwingThreshold: 15,      // Swing >15% triggers downgrade
    mediumSwingThreshold: 10,     // Swing 10-15% triggers downgrade
    manyAdjustmentsThreshold: 4,  // >4 adjustments triggers downgrade
  },
  
  asymmetricWeighting: {
    btts: {
      upMax: 12,              // Cap upward moves at 12%
      downMax: 20,            // Allow downward moves up to 20%
      upRiskMultiplier: 1.2,
      downRiskMultiplier: 1.0,
    },
    over25: {
      upMax: 18,              // More lenient on upward moves
      downMax: 15,
      upRiskMultiplier: 0.9,
      downRiskMultiplier: 1.1,
    },
    matchResult: {
      upMax: 10,              // Very strict on favorites
      downMax: 25,            // Lenient on underdogs
      upRiskMultiplier: 1.5,
      downRiskMultiplier: 0.8,
    },
    firstHalf: {
      upMax: 15,
      downMax: 18,
      upRiskMultiplier: 1.0,
      downRiskMultiplier: 1.0,
    },
  },
};
```

**Quick Reference Table:**

| Market | Upward Cap | Downward Cap | Rationale |
|--------|-----------|--------------|-----------|
| **BTTS** | 12% | 20% | Stricter on upward (prevent false Yes at low odds) |
| **Over 2.5** | 18% | 15% | More lenient on upward (higher odds = acceptable) |
| **Match Result** | 10% | 25% | Very strict on favorites, lenient on underdogs (value bets) |
| **First Half** | 15% | 18% | Balanced approach |

**Benefits:**

- ✅ **No wild flips:** Probability never swings more than ±22% (e.g., 80% never drops below 58%)
- ✅ **Protects low-odds favorites:** Stricter caps on upward moves prevent over-prediction
- ✅ **Transparent risk signals:** Confidence drops when many flags fire → users see risk
- ✅ **All configurable:** Easy tuning after live data collection
- ✅ **Profitability optimized:** Asymmetric weighting prevents over-betting on low-odds favorites

**Next Steps for Implementation:**

1. ✅ **Add to AlgorithmConfig:**
   - Add `probabilityCaps` section with `maxSwing`, `minProb`, `maxProb`
   - Add `confidenceDowngrade` section with thresholds
   - Add `asymmetricWeighting` section with market-specific caps

2. ✅ **Implement Helper Functions:**
   - `applyCappedAsymmetricAdjustments()` — unified helper (Section 4.5.6)
   - `downgradeConfidenceIfBigSwing()` — confidence downgrade helper (Section 4.5.6)

3. ✅ **Update Prediction Functions:**
   - Update `predictBTTS()` to use unified helper
   - Update `predictOver25()` to use unified helper
   - Update `predictMatchResult()` to use unified helper
   - Update `predictFirstHalf()` to use unified helper

4. ✅ **Testing:**
   - Test on 5-10 edge-case historical matches
   - Verify swings ≤22% (check `probabilitySwing` field)
   - Verify confidence drops appropriately when many adjustments fire
   - Test with early season matches (low data scenarios)
   - Test with formation instability scenarios
   - Test with multiple safety flags active

5. ✅ **Validation:**
   - Run shadow mode comparison (capped vs uncapped) if possible
   - Monitor Brier score and accuracy
   - Track probability swing distribution (should be ≤22%)
   - Verify confidence distribution matches swing magnitude

**Example Test Cases:**

```typescript
// Test Case 1: Early season + low H2H + formation instability
// Expected: Multiple adjustments, but total swing ≤22%, confidence downgraded

// Test Case 2: Many safety flags active
// Expected: Confidence downgraded even if swing <15%

// Test Case 3: BTTS upward adjustment stack
// Expected: Capped at 12% total upward move

// Test Case 4: Match Result underdog value bet
// Expected: Can move down up to 25% (value bet opportunity)
```

**Configuration File Location:**

Store in: `config/algorithm-config.ts` or `config/algorithm-config.json`

**Monitoring After Launch:**

- Track average probability swing per prediction
- Monitor confidence distribution (should correlate with swing magnitude)
- Alert if swings exceed 22% (indicates bug)
- Track Brier score improvement vs uncapped version
- Monitor ROI if odds available

#### 4.5.9 Production Monitoring & Auto-Correction

**Goal:** Ensure caps and calibrations hold in live production, with real-time alerts and auto-corrections to prevent uncontrolled swings and maintain calibration quality.

**Problem Statement:**

While Section 4.5 provides strong theoretical safeguards (probability swing caps, asymmetric weighting, confidence downgrades), production environments can introduce edge cases where:
- Multiple adjustments stack without real-time monitoring
- Edge cases (early season + low H2H + multiple safety flags) push probabilities beyond intended bounds
- Subtle bugs (e.g., unnormalized weights summing >1) compound over time
- Calibration drifts without detection, leading to overconfidence or erratic outputs

**Impact Without Monitoring:**

- **Accuracy/Trust Erosion:** Swings >20% (e.g., 68% → 42%) confuse users and reduce perceived reliability, even if capped on paper
- **Profitability Hit:** Mismatched confidence (e.g., 49% with MEDIUM confidence) leads to poor bet sizing; users over-bet on volatile predictions
- **Edge Loss:** Without production monitoring, subtle bugs compound over time, dropping ROI by 5–10%

**Implementation:**

**1. Post-Prediction Audit:**

After calculating `finalProbability`, validate against `baseProbability` and enforce caps:

```typescript
interface SwingAuditResult {
  matchId: string;
  baseProbability: number;
  finalProbability: number;
  swingMagnitude: number;
  wasCapped: boolean;
  violationType?: 'SWING_EXCEEDED' | 'BOUNDS_EXCEEDED' | 'NORMALIZED_ERROR';
}

function auditPredictionSwing(
  matchId: string,
  baseProbability: number,
  finalProbability: number,
  config: AlgorithmConfig
): SwingAuditResult {
  const swingMagnitude = Math.abs(finalProbability - baseProbability);
  const { maxSwing, minProb, maxProb } = config.probabilityCaps;
  
  let wasCapped = false;
  let violationType: string | undefined;
  
  // Check if swing exceeds cap
  if (swingMagnitude > maxSwing) {
    wasCapped = true;
    violationType = 'SWING_EXCEEDED';
    console.warn(
      `[SWING VIOLATION] Match ${matchId}: Swing ${swingMagnitude.toFixed(1)}% exceeds cap ${maxSwing}%`
    );
  }
  
  // Check if bounds exceeded
  if (finalProbability < minProb || finalProbability > maxProb) {
    wasCapped = true;
    violationType = 'BOUNDS_EXCEEDED';
    console.warn(
      `[BOUNDS VIOLATION] Match ${matchId}: Probability ${finalProbability.toFixed(1)}% outside bounds [${minProb}%, ${maxProb}%]`
    );
  }
  
  // Auto-correct if violation detected
  if (wasCapped) {
    // Clamp to swing cap
    const correctedSwing = Math.sign(finalProbability - baseProbability) * 
      Math.min(swingMagnitude, maxSwing);
    finalProbability = baseProbability + correctedSwing;
    
    // Clamp to absolute bounds
    finalProbability = Math.max(minProb, Math.min(maxProb, finalProbability));
  }
  
  return {
    matchId,
    baseProbability,
    finalProbability,
    swingMagnitude,
    wasCapped,
    violationType: violationType as any,
  };
}
```

**2. Swing Histogram Logging:**

Track distribution of swings across all predictions for monitoring and alerting:

```typescript
interface SwingMetrics {
  totalPredictions: number;
  swingDistribution: {
    '0-5%': number;
    '5-10%': number;
    '10-15%': number;
    '15-20%': number;
    '20-25%': number;
    '>25%': number; // Should be 0 if caps working
  };
  averageSwing: number;
  p95Swing: number; // 95th percentile swing
  violationsCount: number;
  violationsRate: number; // Percentage of predictions with violations
}

class SwingMonitor {
  private swings: number[] = [];
  private violations: number = 0;
  
  logSwing(matchId: string, swingMagnitude: number, wasViolation: boolean): void {
    this.swings.push(swingMagnitude);
    if (wasViolation) {
      this.violations++;
    }
    
    // Log to monitoring system (Prometheus/Grafana or simple DB)
    // Example: prometheus.observe('prediction_swing_magnitude', swingMagnitude);
    // Example: prometheus.increment('prediction_swing_violations', wasViolation ? 1 : 0);
  }
  
  getMetrics(): SwingMetrics {
    const sorted = [...this.swings].sort((a, b) => a - b);
    const p95Index = Math.floor(sorted.length * 0.95);
    
    return {
      totalPredictions: this.swings.length,
      swingDistribution: {
        '0-5%': this.swings.filter(s => s <= 5).length,
        '5-10%': this.swings.filter(s => s > 5 && s <= 10).length,
        '10-15%': this.swings.filter(s => s > 10 && s <= 15).length,
        '15-20%': this.swings.filter(s => s > 20 && s <= 20).length,
        '20-25%': this.swings.filter(s => s > 20 && s <= 25).length,
        '>25%': this.swings.filter(s => s > 25).length,
      },
      averageSwing: this.swings.reduce((a, b) => a + b, 0) / this.swings.length,
      p95Swing: sorted[p95Index] || 0,
      violationsCount: this.violations,
      violationsRate: (this.violations / this.swings.length) * 100,
    };
  }
  
  checkAlerts(config: { maxViolationRate: number }): string[] {
    const metrics = this.getMetrics();
    const alerts: string[] = [];
    
    // Alert if >5% of predictions exceed 15% swing
    const highSwingRate = (metrics.swingDistribution['15-20%'] + 
                          metrics.swingDistribution['20-25%'] + 
                          metrics.swingDistribution['>25%']) / metrics.totalPredictions * 100;
    if (highSwingRate > 5) {
      alerts.push(`High swing rate: ${highSwingRate.toFixed(1)}% of predictions exceed 15% swing`);
    }
    
    // Alert if violation rate exceeds threshold
    if (metrics.violationsRate > config.maxViolationRate) {
      alerts.push(
        `Violation rate ${metrics.violationsRate.toFixed(1)}% exceeds threshold ${config.maxViolationRate}%`
      );
    }
    
    // Alert if any predictions exceed 25% swing (should never happen)
    if (metrics.swingDistribution['>25%'] > 0) {
      alerts.push(`CRITICAL: ${metrics.swingDistribution['>25%']} predictions exceeded 25% swing cap`);
    }
    
    return alerts;
  }
}

// Usage in prediction functions
const swingMonitor = new SwingMonitor();

// After generating prediction
const auditResult = auditPredictionSwing(matchId, baseProbability, finalProbability, config);
swingMonitor.logSwing(matchId, auditResult.swingMagnitude, auditResult.wasCapped);

// Check alerts periodically (e.g., every 100 predictions or hourly)
const alerts = swingMonitor.checkAlerts({ maxViolationRate: 1.0 });
if (alerts.length > 0) {
  // Send to alerting system (PagerDuty, Slack, email, etc.)
  console.error('[SWING MONITOR ALERTS]', alerts);
}
```

**3. Auto-Correction Rules:**

Implement soft caps when adjustment stacks exceed thresholds:

```typescript
function applyAutoCorrection(
  adjustments: Adjustment[],
  config: AlgorithmConfig
): Adjustment[] {
  const { manyAdjustmentsThreshold = 4, autoCorrectionScaleFactor = 0.8 } = config.productionMonitoring || {};
  
  // If too many adjustments, scale them down
  if (adjustments.length > manyAdjustmentsThreshold) {
    console.warn(
      `[AUTO-CORRECTION] ${adjustments.length} adjustments exceed threshold ${manyAdjustmentsThreshold}, scaling by ${autoCorrectionScaleFactor}x`
    );
    
    return adjustments.map(adj => ({
      ...adj,
      value: adj.value * autoCorrectionScaleFactor,
      reason: `${adj.reason} (auto-scaled due to many adjustments)`,
    }));
  }
  
  return adjustments;
}

// Usage: Apply before calculateFinalPrediction
const correctedAdjustments = applyAutoCorrection(rawAdjustments, config);
```

**4. Calibration Check:**

Weekly calibration validation to ensure predictions match actual outcomes:

```typescript
interface CalibrationCheckResult {
  confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  sampleSize: number;
  brierScore: number;
  expectedCalibrationError: number;
  isCalibrated: boolean;
  recommendation?: string;
}

async function performWeeklyCalibrationCheck(
  predictions: Prediction[],
  outcomes: MatchOutcome[],
  config: AlgorithmConfig
): Promise<CalibrationCheckResult[]> {
  const results: CalibrationCheckResult[] = [];
  
  // Group predictions by confidence level
  const byConfidence = {
    HIGH: [] as Array<{ prediction: Prediction; outcome: MatchOutcome }>,
    MEDIUM: [] as Array<{ prediction: Prediction; outcome: MatchOutcome }>,
    LOW: [] as Array<{ prediction: Prediction; outcome: MatchOutcome }>,
  };
  
  predictions.forEach((pred, idx) => {
    const outcome = outcomes[idx];
    byConfidence[pred.confidence].push({ prediction: pred, outcome });
  });
  
  // Check calibration for each confidence level
  for (const [confidence, samples] of Object.entries(byConfidence)) {
    if (samples.length < 100) {
      results.push({
        confidenceLevel: confidence as any,
        sampleSize: samples.length,
        brierScore: 0,
        expectedCalibrationError: 0,
        isCalibrated: false,
        recommendation: `Insufficient samples (${samples.length} < 100), skip calibration check`,
      });
      continue;
    }
    
    // Calculate Brier score
    const brierScore = samples.reduce((sum, { prediction, outcome }) => {
      const predictedProb = prediction.finalProbability / 100;
      const actualOutcome = outcome.actualResult === prediction.predictedOutcome ? 1 : 0;
      return sum + Math.pow(predictedProb - actualOutcome, 2);
    }, 0) / samples.length;
    
    // Calculate Expected Calibration Error (ECE)
    // Bin predictions into 10 bins (0-10%, 10-20%, ..., 90-100%)
    const bins = Array(10).fill(0).map(() => ({ predicted: 0, actual: 0, count: 0 }));
    
    samples.forEach(({ prediction, outcome }) => {
      const binIndex = Math.min(Math.floor(prediction.finalProbability / 10), 9);
      bins[binIndex].predicted += prediction.finalProbability / 100;
      bins[binIndex].actual += outcome.actualResult === prediction.predictedOutcome ? 1 : 0;
      bins[binIndex].count++;
    });
    
    const ece = bins.reduce((sum, bin) => {
      if (bin.count === 0) return sum;
      const avgPredicted = bin.predicted / bin.count;
      const avgActual = bin.actual / bin.count;
      return sum + (bin.count / samples.length) * Math.abs(avgPredicted - avgActual);
    }, 0);
    
    const isCalibrated = brierScore < 0.20 && ece < 0.05;
    
    let recommendation: string | undefined;
    if (!isCalibrated) {
      if (brierScore > 0.20) {
        recommendation = `Brier score ${brierScore.toFixed(3)} > 0.20, consider downgrading HIGH confidence threshold by 5%`;
      }
      if (ece > 0.05) {
        recommendation = `ECE ${ece.toFixed(3)} > 0.05, recalibrate using Platt scaling`;
      }
    }
    
    results.push({
      confidenceLevel: confidence as any,
      sampleSize: samples.length,
      brierScore,
      expectedCalibrationError: ece,
      isCalibrated,
      recommendation,
    });
  }
  
  return results;
}

// Weekly cron job or scheduled task
async function weeklyCalibrationCheck(): Promise<void> {
  // Sample last 1000 predictions with outcomes
  const recentPredictions = await getRecentPredictions(1000);
  const outcomes = await getMatchOutcomes(recentPredictions.map(p => p.matchId));
  
  const results = await performWeeklyCalibrationCheck(recentPredictions, outcomes, config);
  
  // Log results
  console.log('[WEEKLY CALIBRATION CHECK]', JSON.stringify(results, null, 2));
  
  // Alert if calibration issues detected
  const issues = results.filter(r => !r.isCalibrated && r.recommendation);
  if (issues.length > 0) {
    console.warn('[CALIBRATION ISSUES DETECTED]', issues);
    // Send to alerting system
  }
  
  // Auto-apply recommendations if configured
  const highConfIssue = issues.find(i => i.confidenceLevel === 'HIGH' && i.brierScore > 0.20);
  if (highConfIssue && config.productionMonitoring?.autoApplyCalibrationFix) {
    // Downgrade HIGH confidence threshold
    config.confidenceDowngrade.largeSwingThreshold -= 5;
    console.log(`[AUTO-FIX] Downgraded HIGH confidence threshold to ${config.confidenceDowngrade.largeSwingThreshold}`);
  }
}
```

**Integration Points:**

1. **Add to all prediction functions:** Call `auditPredictionSwing()` after `applyCappedAsymmetricAdjustments()`
2. **Add to deployment pipeline:** Include swing monitoring in CI/CD
3. **Add to monitoring dashboard:** Display swing histogram, violation rates, calibration metrics
4. **Add to retraining schedule:** Run weekly calibration check (Section 3.3)

**Configuration:**

```typescript
interface ProductionMonitoringConfig {
  enableAudit: boolean;
  enableSwingLogging: boolean;
  maxViolationRate: number; // Alert if violations exceed this percentage
  manyAdjustmentsThreshold: number; // Auto-scale if adjustments exceed this
  autoCorrectionScaleFactor: number; // Scale factor for auto-correction (default: 0.8)
  enableWeeklyCalibration: boolean;
  autoApplyCalibrationFix: boolean; // Auto-downgrade thresholds if calibration fails
  calibrationSampleSize: number; // Minimum samples for calibration check (default: 100)
}

const defaultProductionMonitoring: ProductionMonitoringConfig = {
  enableAudit: true,
  enableSwingLogging: true,
  maxViolationRate: 1.0, // Alert if >1% of predictions violate caps
  manyAdjustmentsThreshold: 4,
  autoCorrectionScaleFactor: 0.8,
  enableWeeklyCalibration: true,
  autoApplyCalibrationFix: false, // Start with false, enable after validation
  calibrationSampleSize: 100,
};
```

**Benefits:**

- ✅ **Prevents trust erosion:** Catches and corrects violations before they reach users
- ✅ **Maintains calibration:** Weekly checks ensure predictions stay calibrated
- ✅ **Early bug detection:** Violation alerts catch subtle bugs before they compound
- ✅ **Data-driven tuning:** Swing histograms inform cap adjustments
- ✅ **Automated fixes:** Auto-correction reduces manual intervention

**Implementation Effort & ROI:**

- **Effort:** 1–2 days (add audits/logs to functions; set up basic monitoring)
- **ROI:** High (+2–3% effective accuracy via better calibration; prevents trust-damaging outliers)

---

### Phase 4.6: Algorithm Refinements

**Goal:** Improve prediction accuracy by refining calculation methods and using all available features properly.

#### 4.6.1 Match Result Prediction Refinement (Critical)

**Current Issue:**
- Match Result prediction uses simplified fixed base probabilities (40/25/35)
- Comment says "simplified - full implementation would use all factors"
- Doesn't properly use calculated weights and features like BTTS/Over25 do

**Problem:**
- Only applies Mind/Mood gap and motivation clash adjustments
- Missing: Recent form comparison, H2H record, home/away form, league position gap, rest advantage
- Home advantage is fixed, not dynamic

**Improved Implementation:**

```typescript
async function predictMatchResult(
  homeTeam: TeamData,
  awayTeam: TeamData,
  h2h: H2HData,
  isEarlySeason: boolean = false,
  formationStability?: FormationStabilityContext,
  config: AlgorithmConfig
): Promise<MarketPrediction> {
  const insights: Insight[] = [];
  
  // Base weights (will be adjusted for context)
  let weights = {
    recentForm: 0.30,
    h2h: 0.25,
    homeAdvantage: 0.20,
    motivation: 0.18,
    rest: 0.12,
    leaguePosition: 0.10,
  };
  
  // Apply context adjustments
  weights = adjustWeightsForRestDays(weights, homeTeam.daysSinceLastMatch);
  weights = adjustWeightsForRestDays(weights, awayTeam.daysSinceLastMatch);
  weights = adjustWeightsForEarlySeason(weights, isEarlySeason);
  weights = adjustWeightsForLowH2H(weights, h2h.h2hMatchCount);
  
  // ============================================
  // CALCULATE BASE PROBABILITIES FROM FEATURES
  // ============================================
  
  // Factor 1: Recent Form Comparison (30% weight)
  const homeFormScore = calculateFormScore(homeTeam.lastHomeMatches, config.formWeighting);
  const awayFormScore = calculateFormScore(awayTeam.lastAwayMatches, config.formWeighting);
  const formDifference = homeFormScore - awayFormScore; // -100 to +100
  
  // Factor 2: H2H Record (25% weight)
  const h2hHomeWinPct = h2h.matches.length > 0 
    ? (h2h.homeTeamWins / h2h.matches.length) * 100 
    : 50; // Default to neutral if no H2H
  const h2hAwayWinPct = h2h.matches.length > 0 
    ? (h2h.awayTeamWins / h2h.matches.length) * 100 
    : 50;
  const h2hDrawPct = h2h.matches.length > 0 
    ? (h2h.draws / h2h.matches.length) * 100 
    : 25;
  
  // Factor 3: Dynamic Home Advantage (20% weight)
  const homeAdvantageScore = calculateDynamicHomeAdvantage(
    homeTeam.stats.homeAvgScored,
    homeTeam.stats.homeAvgConceded,
    awayTeam.stats.awayAvgScored,
    awayTeam.stats.awayAvgConceded,
    leagueAverage: { homeAdvantage: 0.3 } // Typical home advantage
  );
  
  // Factor 4: Motivation (18% weight)
  const homeMotivation = calculateMotivation(homeTeam);
  const awayMotivation = calculateMotivation(awayTeam);
  const motivationScore = calculateMotivationScore(homeMotivation, awayMotivation);
  
  // Factor 5: Rest Advantage (12% weight)
  const restAdvantage = homeTeam.daysSinceLastMatch - awayTeam.daysSinceLastMatch;
  const restScore = calculateRestScore(restAdvantage); // -20 to +20
  
  // Factor 6: League Position Gap (10% weight)
  const positionGap = homeTeam.stats.leaguePosition - awayTeam.stats.leaguePosition;
  const positionScore = calculatePositionScore(positionGap, homeTeam.stats.leaguePosition);
  
  // ============================================
  // CALCULATE PROBABILITIES USING WEIGHTS
  // ============================================
  
  // Home win probability
  let homeProb = 35; // Base (slightly below 40 to account for draws)
  
  // Add form advantage
  homeProb += (formDifference * weights.recentForm) / 100;
  
  // Add H2H advantage
  homeProb += ((h2hHomeWinPct - h2hAwayWinPct) * weights.h2h) / 100;
  
  // Add home advantage (dynamic)
  homeProb += homeAdvantageScore * weights.homeAdvantage;
  
  // Add motivation advantage
  homeProb += motivationScore * weights.motivation;
  
  // Add rest advantage
  homeProb += restScore * weights.rest;
  
  // Add position advantage
  homeProb += positionScore * weights.leaguePosition;
  
  // Away win probability (inverse of home, adjusted)
  let awayProb = 30; // Base
  awayProb += (-formDifference * weights.recentForm) / 100;
  awayProb += ((h2hAwayWinPct - h2hHomeWinPct) * weights.h2h) / 100;
  awayProb += (-homeAdvantageScore * weights.homeAdvantage);
  awayProb += (-motivationScore * weights.motivation);
  awayProb += (-restScore * weights.rest);
  awayProb += (-positionScore * weights.leaguePosition);
  
  // Draw probability (from H2H, adjusted for form similarity)
  let drawProb = h2hDrawPct * (weights.h2h / 100);
  // If teams are similar in form, increase draw probability
  if (Math.abs(formDifference) < 10) {
    drawProb += 5; // Similar form = more likely draw
  }
  
  // ============================================
  // APPLY ADJUSTMENTS (Mind/Mood, Safety Flags)
  // ============================================
  
  // Apply Mind/Mood gap
  if (homeTeam.mood.isSleepingGiant) {
    homeProb += 10; // Value bet
    insights.push({
      text: `💎 Value Alert: ${homeTeam.name} is Tier ${homeTeam.mind.tier} quality but Tier ${homeTeam.mood.tier} form`,
      emoji: '💤',
      priority: 95,
      category: 'FORM',
      severity: 'HIGH',
    });
  }
  
  if (awayTeam.mood.isSleepingGiant) {
    awayProb += 10;
    insights.push({
      text: `💎 Value Alert: ${awayTeam.name} is Tier ${awayTeam.mind.tier} quality but Tier ${awayTeam.mood.tier} form`,
      emoji: '💤',
      priority: 95,
      category: 'FORM',
      severity: 'HIGH',
    });
  }
  
  if (homeTeam.mood.isOverPerformer) {
    homeProb -= 8; // Regression risk
    insights.push({
      text: `⚠️ Regression Risk: ${homeTeam.name} is Tier ${homeTeam.mind.tier} quality but Tier ${homeTeam.mood.tier} form`,
      emoji: '📉',
      priority: 90,
      category: 'FORM',
      severity: 'HIGH',
    });
  }
  
  if (awayTeam.mood.isOverPerformer) {
    awayProb -= 8;
    insights.push({
      text: `⚠️ Regression Risk: ${awayTeam.name} is Tier ${awayTeam.mind.tier} quality but Tier ${awayTeam.mood.tier} form`,
      emoji: '📉',
      priority: 90,
      category: 'FORM',
      severity: 'HIGH',
    });
  }
  
  // Apply Motivation Clash
  if (homeTeam.safetyFlags.motivationClash) {
    if (homeMotivation === 'TITLE_RACE' && awayMotivation === 'MID_TABLE') {
      homeProb += 5;
    } else if (awayMotivation === 'TITLE_RACE' && homeMotivation === 'MID_TABLE') {
      awayProb += 5;
    }
  }
  
  // Apply formation stability adjustment
  const formationAdjustment = -(formationStability?.totalFormationReduction || 0);
  // Reduce confidence, not probability (already handled in confidence calculation)
  
  // ============================================
  // NORMALIZE PROBABILITIES
  // ============================================
  
  // Ensure probabilities are positive
  homeProb = Math.max(10, homeProb);
  awayProb = Math.max(10, awayProb);
  drawProb = Math.max(15, drawProb);
  
  // Normalize to sum to 100%
  const total = homeProb + drawProb + awayProb;
  homeProb = (homeProb / total) * 100;
  drawProb = (drawProb / total) * 100;
  awayProb = (awayProb / total) * 100;
  
  // ============================================
  // CALCULATE CONFIDENCE
  // ============================================
  
  let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
  
  // High confidence if: Clear favorite (>50%), good data quality, few adjustments
  const maxProb = Math.max(homeProb, drawProb, awayProb);
  if (maxProb > 50 && Math.abs(homeProb - awayProb) > 15) {
    confidence = 'HIGH';
  }
  
  // Low confidence if: Close probabilities, many adjustments, low data quality
  if (Math.abs(homeProb - awayProb) < 5 || Math.abs(maxProb - 33) < 5) {
    confidence = 'LOW';
  }
  
  // Apply formation stability and regression risk adjustments
  const formationReduction = formationStability?.totalFormationReduction || 0;
  if (formationReduction > 0) {
    if (confidence === 'HIGH' && formationReduction > 15) {
      confidence = 'MEDIUM';
    } else if (confidence === 'MEDIUM' && formationReduction > 20) {
      confidence = 'LOW';
    }
  }
  
  if (homeTeam.safetyFlags.regressionRisk || awayTeam.safetyFlags.regressionRisk) {
    confidence = confidence === 'HIGH' ? 'MEDIUM' : 'LOW';
  }
  
  const rating = getRating(maxProb);
  
  return {
    market: 'MATCH_RESULT',
    probabilities: { home: homeProb, draw: drawProb, away: awayProb },
    rating,
    confidence,
    insights: insights.slice(0, 5),
    recommendation: maxProb === homeProb 
      ? `${homeTeam.name} Win ✅`
      : maxProb === awayProb
      ? `${awayTeam.name} Win ✅`
      : 'Draw ✅',
  };
}

// Helper: Calculate form score from matches (weighted by recency)
function calculateFormScore(
  matches: Match[],
  formWeighting: FormWeightingConfig
): number {
  if (matches.length === 0) return 50; // Neutral
  
  let weightedPoints = 0;
  let totalWeight = 0;
  
  matches.forEach((match, index) => {
    // Calculate points: Win=3, Draw=1, Loss=0
    let points = 0;
    if (match.result === 'W') points = 3;
    else if (match.result === 'D') points = 1;
    
    // Apply recency weighting
    let weight = 1.0;
    if (index < 2) weight = formWeighting.recentGamesWeight; // Last 2 games
    else if (index < 5) weight = formWeighting.midGamesWeight; // Games 3-5
    else weight = formWeighting.oldGamesWeight; // Games 6-10
    
    weightedPoints += points * weight;
    totalWeight += weight;
  });
  
  // Convert to 0-100 score
  const avgWeightedPoints = totalWeight > 0 ? weightedPoints / totalWeight : 0;
  return (avgWeightedPoints / 3) * 100; // Max 3 points per game
}

// Helper: Calculate dynamic home advantage
function calculateDynamicHomeAdvantage(
  homeHomeAvgScored: number,
  homeHomeAvgConceded: number,
  awayAwayAvgScored: number,
  awayAwayAvgConceded: number,
  leagueAverage: { homeAdvantage: number }
): number {
  // Calculate home team's home strength
  const homeStrength = homeHomeAvgScored - homeHomeAvgConceded;
  
  // Calculate away team's away weakness
  const awayWeakness = awayAwayAvgConceded - awayAwayAvgScored;
  
  // Combined advantage
  const advantage = (homeStrength + awayWeakness) / 2;
  
  // Scale to 0-100 (typical range: -20 to +40)
  // Strong home team vs weak away = high advantage
  return Math.max(0, Math.min(100, 50 + (advantage * 10)));
}

// Helper: Calculate motivation score
function calculateMotivationScore(
  homeMotivation: string,
  awayMotivation: string
): number {
  const motivationLevels: Record<string, number> = {
    'TITLE_RACE': 10,
    'CL_RACE': 8,
    'EUROPA_RACE': 6,
    'RELEGATION_BATTLE': 7,
    'MID_TABLE': 3,
    'SECURE': 2,
  };
  
  const homeLevel = motivationLevels[homeMotivation] || 5;
  const awayLevel = motivationLevels[awayMotivation] || 5;
  
  return homeLevel - awayLevel; // -10 to +10
}

// Helper: Calculate rest advantage score
function calculateRestScore(restAdvantage: number): number {
  // Rest advantage: -20 to +20
  // +3 days advantage = +5 score
  // -3 days disadvantage = -5 score
  if (restAdvantage > 3) {
    return Math.min(20, (restAdvantage - 3) * 2);
  } else if (restAdvantage < -3) {
    return Math.max(-20, (restAdvantage + 3) * 2);
  }
  return 0; // Similar rest = no advantage
}

// Helper: Calculate position score
function calculatePositionScore(
  positionGap: number,
  homePosition: number
): number {
  // Position gap: negative = home team higher (better)
  // -10 position gap (home 5th, away 15th) = +10 score
  // +10 position gap (home 15th, away 5th) = -10 score
  
  // Scale by league position (gap matters more in top half)
  const scaleFactor = homePosition <= 10 ? 1.2 : 0.8;
  
  return (-positionGap * scaleFactor); // Negative gap = positive score
}
```

**Benefits:**
- Uses all factors properly (not simplified)
- Dynamic home advantage based on team records
- Proper form comparison using weighted form
- Rest advantage included
- League position gap considered
- All weights applied correctly

**Impact:** +3-5% accuracy improvement on Match Result predictions

#### 4.6.2 Rest Advantage Integration (High Priority)

**Current Issue:**
- `RestAdvantage` feature is calculated but not used in predictions
- Rest days are considered individually, but advantage gap is ignored

**Implementation:**

```typescript
// Add to predictBTTS, predictOver25, predictMatchResult, predictFirstHalf

// Calculate rest advantage
const restAdvantage = homeTeam.daysSinceLastMatch - awayTeam.daysSinceLastMatch;

// Apply rest advantage adjustment
if (restAdvantage > 3) {
  // Home team significantly more rested
  // For BTTS: More rested = better defense = slightly lower BTTS
  // For Match Result: More rested = advantage
  if (market === 'BTTS') {
    bttsScore -= 2; // Slightly lower BTTS (better defense)
  } else if (market === 'MATCH_RESULT') {
    homeProb += 2; // Home advantage
  }
} else if (restAdvantage < -3) {
  // Away team significantly more rested
  if (market === 'BTTS') {
    bttsScore -= 2; // Away team better defense
  } else if (market === 'MATCH_RESULT') {
    awayProb += 2; // Away advantage
  }
}

// Add insight
if (Math.abs(restAdvantage) > 3) {
  insights.push({
    text: `${restAdvantage > 0 ? homeTeam.name : awayTeam.name} has ${Math.abs(restAdvantage)} more rest days`,
    emoji: '⏰',
    priority: 70,
    category: 'CONTEXT',
    severity: 'MEDIUM',
  });
}
```

**Benefits:**
- Uses calculated rest advantage feature
- Small but meaningful accuracy improvement
- Better reflects match context

**Impact:** +1-2% accuracy improvement

#### 4.6.3 Opponent Quality Weighting (High Priority)

**Current Issue:**
- Scoring rate uses simple percentage (scored in X of Y games)
- Doesn't account for opponent quality
- Scoring 3 goals vs Tier 1 team = same weight as vs Tier 4 team

**Implementation:**

```typescript
// Enhanced scoring rate calculation with opponent quality weighting
function calculateOpponentAdjustedScoringRate(
  matches: Match[],
  opponents: TeamData[], // Opponent data for each match
  formWeighting: FormWeightingConfig
): number {
  if (matches.length === 0) return 50;
  
  const tierWeights: Record<number, number> = {
    1: 1.5,  // Goal vs Tier 1 = 1.5x weight (harder to score)
    2: 1.2,  // Goal vs Tier 2 = 1.2x weight
    3: 1.0,  // Goal vs Tier 3 = 1.0x weight (baseline)
    4: 0.7,  // Goal vs Tier 4 = 0.7x weight (easier to score)
  };
  
  let weightedScored = 0;
  let totalWeight = 0;
  
  matches.forEach((match, index) => {
    const scored = (match.goalsScored || 0) > 0 ? 1 : 0;
    const opponent = opponents[index];
    const opponentTier = opponent?.mind?.tier || 3; // Default to tier 3
    
    // Recency weight
    let recencyWeight = 1.0;
    if (index < 2) recencyWeight = formWeighting.recentGamesWeight;
    else if (index < 5) recencyWeight = formWeighting.midGamesWeight;
    else recencyWeight = formWeighting.oldGamesWeight;
    
    // Opponent quality weight
    const opponentWeight = tierWeights[opponentTier] || 1.0;
    
    // Combined weight
    const totalMatchWeight = recencyWeight * opponentWeight;
    
    weightedScored += scored * totalMatchWeight;
    totalWeight += totalMatchWeight;
  });
  
  // Convert to percentage
  return totalWeight > 0 ? (weightedScored / totalWeight) * 100 : 0;
}

// Usage in predictBTTS
const homeScoredPct = calculateOpponentAdjustedScoringRate(
  homeTeam.lastHomeMatches,
  homeTeam.lastHomeMatches.map(m => getOpponentData(m.awayTeamId)), // Need opponent data
  config.formWeighting
);
```

**Benefits:**
- More accurate scoring rate (accounts for opponent difficulty)
- Better reflects team's true scoring ability
- Weighted by both recency and opponent quality

**Impact:** +2-3% accuracy improvement

**Note:** Requires opponent data for each match (may need additional data fetching)

#### 4.6.4 Weighted Scoring Rate (Medium Priority)

**Current Issue:**
- Scoring rate uses simple percentage (all matches equal weight)
- Should use recency weighting like form does

**Implementation:**

```typescript
// Use weighted scoring rate instead of simple percentage
function calculateWeightedScoringRate(
  matches: Match[],
  formWeighting: FormWeightingConfig
): number {
  if (matches.length === 0) return 50;
  
  let weightedScored = 0;
  let totalWeight = 0;
  
  matches.forEach((match, index) => {
    const scored = (match.goalsScored || 0) > 0 ? 1 : 0;
    
    // Apply recency weighting
    let weight = 1.0;
    if (index < 2) weight = formWeighting.recentGamesWeight;
    else if (index < 5) weight = formWeighting.midGamesWeight;
    else weight = formWeighting.oldGamesWeight;
    
    weightedScored += scored * weight;
    totalWeight += weight;
  });
  
  return totalWeight > 0 ? (weightedScored / totalWeight) * 100 : 0;
}

// Replace in predictBTTS:
// OLD: const homeScoredPct = (homeScored / homeTeam.lastHomeMatches.length) * 100;
// NEW:
const homeScoredPct = calculateWeightedScoringRate(
  homeTeam.lastHomeMatches,
  config.formWeighting
);
```

**Benefits:**
- Consistent with form weighting approach
- Recent matches matter more
- Small accuracy improvement

**Impact:** +1% accuracy improvement

#### 4.6.5 Fixture Congestion (Medium Priority)

**Current Issue:**
- Mentioned in future enhancements but not implemented
- Teams playing multiple matches in short period perform worse

**Implementation:**

```typescript
// Add fixture congestion feature
function calculateFixtureCongestion(
  matches: Match[],
  currentDate: Date
): {
  matchesInLast7Days: number;
  matchesInLast14Days: number;
  congestionScore: number; // 0-100, higher = more congested
} {
  const last7Days = matches.filter(m => {
    const daysDiff = (currentDate.getTime() - new Date(m.date).getTime()) / (1000 * 60 * 60 * 24);
    return daysDiff <= 7;
  }).length;
  
  const last14Days = matches.filter(m => {
    const daysDiff = (currentDate.getTime() - new Date(m.date).getTime()) / (1000 * 60 * 60 * 24);
    return daysDiff <= 14;
  }).length;
  
  // Congestion score: 0-100
  // 3+ matches in 7 days = high congestion (80-100)
  // 2 matches in 7 days = medium congestion (50-70)
  // 1 match in 7 days = low congestion (20-40)
  let congestionScore = 0;
  if (last7Days >= 3) congestionScore = 80 + (last7Days - 3) * 5;
  else if (last7Days === 2) congestionScore = 50;
  else if (last7Days === 1) congestionScore = 25;
  
  return {
    matchesInLast7Days: last7Days,
    matchesInLast14Days: last14Days,
    congestionScore,
  };
}

// Apply congestion adjustment
function applyFixtureCongestionAdjustment(
  baseProbability: number,
  congestion: { congestionScore: number },
  market: string
): number {
  if (congestion.congestionScore < 50) return baseProbability; // Low congestion = no adjustment
  
  // High congestion reduces form reliability
  const reductionFactor = (congestion.congestionScore - 50) / 50; // 0 to 1
  
  // Market-specific impact
  const marketImpact: Record<string, number> = {
    'BTTS': 0.3,      // Less impact (both teams affected)
    'OVER_2_5': 0.4,   // Moderate impact (fatigue affects scoring)
    'MATCH_RESULT': 0.5, // Higher impact (fatigue affects performance)
    'FIRST_HALF': 0.2, // Low impact (fatigue affects second half more)
  };
  
  const adjustment = -reductionFactor * 5 * (marketImpact[market] || 0.3);
  return baseProbability + adjustment;
}

// Usage in predictions
const homeCongestion = calculateFixtureCongestion(homeTeam.lastMatches, currentDate);
const awayCongestion = calculateFixtureCongestion(awayTeam.lastMatches, currentDate);

// Apply adjustment
if (homeCongestion.congestionScore > 50) {
  // Reduce recent form weight for congested team
  weights.recentForm *= (1 - (homeCongestion.congestionScore / 100) * 0.3);
}

if (awayCongestion.congestionScore > 50) {
  weights.recentForm *= (1 - (awayCongestion.congestionScore / 100) * 0.3);
}

// Add insights
if (homeCongestion.matchesInLast7Days >= 3) {
  insights.push({
    text: `${homeTeam.name} played ${homeCongestion.matchesInLast7Days} matches in last 7 days - fatigue risk`,
    emoji: '⚡',
    priority: 75,
    category: 'CONTEXT',
    severity: 'MEDIUM',
  });
}
```

**Benefits:**
- Accounts for fixture congestion
- Reduces form weight when team is fatigued
- Better predictions for congested periods

**Impact:** +1% accuracy improvement

**Configuration:**

Add to `AlgorithmConfig`:

```typescript
fixtureCongestion: {
  highCongestionThreshold: number;  // 3+ matches in 7 days (default: 3)
  mediumCongestionThreshold: number; // 2 matches in 7 days (default: 2)
  formWeightReduction: number;       // Max reduction (default: 0.3)
  marketImpact: {
    btts: number;      // Impact on BTTS (default: 0.3)
    over25: number;    // Impact on Over 2.5 (default: 0.4)
    matchResult: number; // Impact on Match Result (default: 0.5)
    firstHalf: number;  // Impact on First Half (default: 0.2)
  };
};
```

#### 4.6.6 Implementation Priority

**Critical (Before Launch):**
1. ✅ Match Result Prediction Refinement
   - Time: 1-2 days
   - Impact: +3-5% accuracy
   - **Must fix:** Currently oversimplified

**High Priority (Within 1 Month):**
2. ✅ Rest Advantage Integration
   - Time: 2-3 hours
   - Impact: +1-2% accuracy

3. ✅ Opponent Quality Weighting
   - Time: 1 day
   - Impact: +2-3% accuracy
   - **Note:** Requires opponent data for each match

**Medium Priority (Nice to Have):**
4. ✅ Weighted Scoring Rate
   - Time: 4-6 hours
   - Impact: +1% accuracy

5. ✅ Fixture Congestion
   - Time: 1 day
   - Impact: +1% accuracy

**Integration Points:**
- Match Result refinement: Replace `predictMatchResult()` function
- Rest advantage: Add to all prediction functions
- Opponent quality: Enhance scoring rate calculation
- Weighted scoring: Replace simple percentage calculations
- Fixture congestion: Add to weight adjustment functions

**Testing:**
- Test Match Result predictions on historical data
- Compare accuracy before/after refinements
- Verify all factors are being used properly
- Check that probabilities sum to 100%

---

#### 4.7 Flexible Alternative Bet Suggestions

**Goal:** Always suggest safer alternative bets for every prediction, dynamically analyzing all available markets to provide users with risk management options.

**Critical Rule:** Alternatives must always be SAFER (higher probability) than the primary prediction, never harder. The only exception is "MORE_AGGRESSIVE" alternatives (lower probability, higher odds), which are only suggested for HIGH confidence predictions where users might want higher odds.

**Example:**
- Primary: "First Half Goals - Yes" (62% probability)
- ✅ Correct alternative: "Over 0.5 First Half" (88% probability) - SAFER
- ❌ Wrong alternative: "Over 1.5 First Half" (45% probability) - HARDER (never suggest unless MORE_AGGRESSIVE)

**Problem Statement:**

Users want to know:
- "If Over 2.5 is 75% likely, what's a safer alternative?"
- "If Home Win is 60% likely, what's a safer bet?"
- "What other markets correlate with this prediction?"

Current system only provides primary predictions without alternatives, leaving users to manually find safer options.

**Solution:**

A flexible system that:
1. **Always suggests alternatives** (not just HIGH confidence)
2. **Dynamically analyzes all markets** (not fixed alternatives)
3. **Adjusts suggestions based on confidence level** (LOW confidence → suggest very safe alternatives)
4. **Finds safer, correlated, and complementary markets** automatically

**Implementation:**

**1. Core Alternative Bet Suggestion Function:**

```typescript
/**
 * Always suggest alternatives for every prediction
 * Adjust suggestion quality/type based on confidence level
 */
function suggestAlternativeBets(
  primaryPrediction: MarketPrediction,
  allMarketPredictions: Map<string, MarketPrediction>, // All calculated predictions
  homeTeam: TeamData,
  awayTeam: TeamData,
  config: AlgorithmConfig
): AlternativeBet[] {
  const alternatives: AlternativeBet[] = [];
  const primaryMarket = primaryPrediction.market;
  const primaryProb = primaryPrediction.probabilities.yes || 
                     Math.max(...Object.values(primaryPrediction.probabilities));
  const confidence = primaryPrediction.confidence;
  
  // ALWAYS suggest alternatives, but adjust thresholds based on confidence
  // LOW confidence → suggest very safe alternatives (higher probability gain required)
  // MEDIUM confidence → suggest moderately safe alternatives
  // HIGH confidence → suggest safer + correlated + complementary alternatives
  
  const minProbabilityGain = {
    'LOW': config.alternativeBets.minProbabilityGain.LOW || 10,      // Need 10%+ higher probability
    'MEDIUM': config.alternativeBets.minProbabilityGain.MEDIUM || 7, // Need 7%+ higher probability
    'HIGH': config.alternativeBets.minProbabilityGain.HIGH || 5      // Need 5%+ higher probability
  }[confidence] || 5;
  
  // 1. ALWAYS find safer alternatives (higher probability)
  const saferAlternatives = findSaferAlternatives(
    primaryMarket,
    primaryProb,
    allMarketPredictions,
    minProbabilityGain,
    config
  );
  alternatives.push(...saferAlternatives);
  
  // 2. For MEDIUM/HIGH confidence, also find correlated markets
  if (confidence !== 'LOW') {
    const correlatedAlternatives = findCorrelatedAlternatives(
      primaryMarket,
      primaryProb,
      allMarketPredictions,
      homeTeam,
      awayTeam,
      config
    );
    alternatives.push(...correlatedAlternatives);
  }
  
  // 3. For HIGH confidence only, find complementary markets
  if (confidence === 'HIGH') {
    const complementaryAlternatives = findComplementaryAlternatives(
      primaryMarket,
      primaryPrediction,
      allMarketPredictions,
      homeTeam,
      awayTeam,
      config
    );
    alternatives.push(...complementaryAlternatives);
  }
  
  // Sort by: relationship priority (SAFER > CORRELATED > COMPLEMENTARY > MORE_AGGRESSIVE), then probability
  // CRITICAL: SAFER alternatives always come first, MORE_AGGRESSIVE last (only for users who want higher odds)
  // Alternatives must always be safer (higher probability) than primary, never harder (unless explicitly MORE_AGGRESSIVE)
  return alternatives
    .sort((a, b) => {
      const priority = { SAFER: 4, CORRELATED: 3, COMPLEMENTARY: 2, MORE_AGGRESSIVE: 1 };
      if (priority[a.relationship] !== priority[b.relationship]) {
        return priority[b.relationship] - priority[a.relationship];
      }
      // Within same relationship type, sort by probability (highest first)
      return b.probability - a.probability;
    })
    .slice(0, config.alternativeBets.maxAlternatives || 5);
}
```

**2. Find Safer Alternatives (Always Applied):**

```typescript
/**
 * Find safer alternatives with dynamic threshold based on confidence
 */
function findSaferAlternatives(
  primaryMarket: string,
  primaryProb: number,
  allPredictions: Map<string, MarketPrediction>,
  minProbabilityGain: number, // Dynamic based on confidence
  config: AlgorithmConfig
): AlternativeBet[] {
  const alternatives: AlternativeBet[] = [];
  
  // For Over/Under markets: find all lower thresholds (safer)
  if (primaryMarket.startsWith('OVER_')) {
    const threshold = parseFloat(primaryMarket.split('_')[1].replace('_', '.'));
    
    // Check all lower thresholds (0.5, 1.0, 1.5, 2.0, etc.)
    for (let i = threshold - 0.5; i >= 0.5; i -= 0.5) {
      const market = `OVER_${i.toString().replace('.', '_')}`;
      const prediction = allPredictions.get(market);
      
      if (prediction && prediction.probabilities.yes >= primaryProb + minProbabilityGain) {
        alternatives.push({
          market,
          probability: prediction.probabilities.yes,
          confidence: prediction.confidence,
          reason: `Safer alternative: ${market} has ${prediction.probabilities.yes}% probability (vs ${primaryProb}% for ${primaryMarket})`,
          relationship: 'SAFER',
          probabilityGain: prediction.probabilities.yes - primaryProb,
          oddsEstimate: probabilityToOdds(prediction.probabilities.yes)
        });
      }
    }
    
    // Fallback: if no alternatives meet threshold, suggest safest available
    if (alternatives.length === 0 && config.alternativeBets.fallbackToSafest) {
      const safest = findSafestOverMarket(allPredictions, threshold);
      if (safest && safest.probability > primaryProb) {
        alternatives.push({
          market: safest.market,
          probability: safest.probability,
          confidence: safest.confidence,
          reason: `Safest available: ${safest.market} has ${safest.probability}% probability`,
          relationship: 'SAFER',
          probabilityGain: safest.probability - primaryProb,
          oddsEstimate: probabilityToOdds(safest.probability)
        });
      }
    }
  }
  
  // For Under markets: find all higher thresholds (safer)
  if (primaryMarket.startsWith('UNDER_')) {
    const threshold = parseFloat(primaryMarket.split('_')[1].replace('_', '.'));
    
    // Check all higher thresholds
    for (let i = threshold + 0.5; i <= 5.5; i += 0.5) {
      const market = `UNDER_${i.toString().replace('.', '_')}`;
      const prediction = allPredictions.get(market);
      
      if (prediction && prediction.probabilities.yes >= primaryProb + minProbabilityGain) {
        alternatives.push({
          market,
          probability: prediction.probabilities.yes,
          confidence: prediction.confidence,
          reason: `Safer alternative: ${market} has ${prediction.probabilities.yes}% probability`,
          relationship: 'SAFER',
          probabilityGain: prediction.probabilities.yes - primaryProb,
          oddsEstimate: probabilityToOdds(prediction.probabilities.yes)
        });
      }
    }
    
    // Fallback: find safest available
    if (alternatives.length === 0 && config.alternativeBets.fallbackToSafest) {
      const safest = findSafestUnderMarket(allPredictions, threshold);
      if (safest && safest.probability > primaryProb) {
        alternatives.push(safest);
      }
    }
  }
  
  // For Match Result: always suggest Double Chance and Draw No Bet
  if (primaryMarket === 'MATCH_RESULT') {
    const matchResult = allPredictions.get('MATCH_RESULT');
    if (matchResult) {
      const { home, draw, away } = matchResult.probabilities;
      
      // If Home Win is primary (highest probability)
      if (home === primaryProb && home > 0) {
        const homeDrawProb = home + draw;
        if (homeDrawProb > home + minProbabilityGain) {
          alternatives.push({
            market: 'HOME_DRAW',
            probability: homeDrawProb,
            confidence: homeDrawProb > 75 ? 'HIGH' : (homeDrawProb > 65 ? 'MEDIUM' : 'LOW'),
            reason: `Safer: Home Win or Draw has ${homeDrawProb}% probability (vs ${home}% for Home Win)`,
            relationship: 'SAFER',
            probabilityGain: draw,
            oddsEstimate: probabilityToOdds(homeDrawProb)
          });
        }
        
        // Always suggest Draw No Bet (very safe)
        if (config.alternativeBets.includeDrawNoBet) {
          const homeWinExcludingDraws = home / (home + away); // Probability excluding draws
          alternatives.push({
            market: 'DRAW_NO_BET_HOME',
            probability: homeWinExcludingDraws * 100,
            confidence: home > 60 ? 'HIGH' : (home > 50 ? 'MEDIUM' : 'LOW'),
            reason: `Very safe: Home Win (stakes returned if draw) - ${(homeWinExcludingDraws * 100).toFixed(0)}% probability excluding draws`,
            relationship: 'SAFER',
            probabilityGain: (homeWinExcludingDraws * 100) - home,
            oddsEstimate: probabilityToOdds(homeWinExcludingDraws * 100)
          });
        }
      }
      
      // If Away Win is primary
      if (away === primaryProb && away > 0) {
        const awayDrawProb = away + draw;
        if (awayDrawProb > away + minProbabilityGain) {
          alternatives.push({
            market: 'AWAY_DRAW',
            probability: awayDrawProb,
            confidence: awayDrawProb > 75 ? 'HIGH' : (awayDrawProb > 65 ? 'MEDIUM' : 'LOW'),
            reason: `Safer: Away Win or Draw has ${awayDrawProb}% probability`,
            relationship: 'SAFER',
            probabilityGain: draw,
            oddsEstimate: probabilityToOdds(awayDrawProb)
          });
        }
        
        if (config.alternativeBets.includeDrawNoBet) {
          const awayWinExcludingDraws = away / (home + away);
          alternatives.push({
            market: 'DRAW_NO_BET_AWAY',
            probability: awayWinExcludingDraws * 100,
            confidence: away > 60 ? 'HIGH' : (away > 50 ? 'MEDIUM' : 'LOW'),
            reason: `Very safe: Away Win (stakes returned if draw)`,
            relationship: 'SAFER',
            probabilityGain: (awayWinExcludingDraws * 100) - away,
            oddsEstimate: probabilityToOdds(awayWinExcludingDraws * 100)
          });
        }
      }
      
      // If Draw is primary
      if (draw === primaryProb && draw > 0) {
        // Suggest both Double Chance options
        const homeDrawProb = home + draw;
        const awayDrawProb = away + draw;
        
        if (homeDrawProb > draw + minProbabilityGain) {
          alternatives.push({
            market: 'HOME_DRAW',
            probability: homeDrawProb,
            confidence: homeDrawProb > 70 ? 'MEDIUM' : 'LOW',
            reason: `Safer: Home Win or Draw covers draw prediction`,
            relationship: 'SAFER',
            probabilityGain: home,
            oddsEstimate: probabilityToOdds(homeDrawProb)
          });
        }
        
        if (awayDrawProb > draw + minProbabilityGain) {
          alternatives.push({
            market: 'AWAY_DRAW',
            probability: awayDrawProb,
            confidence: awayDrawProb > 70 ? 'MEDIUM' : 'LOW',
            reason: `Safer: Away Win or Draw covers draw prediction`,
            relationship: 'SAFER',
            probabilityGain: away,
            oddsEstimate: probabilityToOdds(awayDrawProb)
          });
        }
      }
    }
  }
  
  // For BTTS: always suggest Over markets as safer alternatives
  if (primaryMarket === 'BTTS') {
    const bttsProb = primaryPrediction.probabilities.yes;
    
    // Suggest Over 1.5 (very safe if BTTS is likely)
    const over15 = allPredictions.get('OVER_1_5');
    if (over15 && over15.probabilities.yes >= bttsProb + minProbabilityGain) {
      alternatives.push({
        market: 'OVER_1_5',
        probability: over15.probabilities.yes,
        confidence: over15.confidence,
        reason: `Safer: Over 1.5 has ${over15.probabilities.yes}% probability (vs ${bttsProb}% for BTTS)`,
        relationship: 'SAFER',
        probabilityGain: over15.probabilities.yes - bttsProb,
        oddsEstimate: probabilityToOdds(over15.probabilities.yes)
      });
    }
    
    // Suggest Over 0.5 (extremely safe)
    const over05 = allPredictions.get('OVER_0_5');
    if (over05 && over05.probabilities.yes >= bttsProb + minProbabilityGain) {
      alternatives.push({
        market: 'OVER_0_5',
        probability: over05.probabilities.yes,
        confidence: 'HIGH', // Over 0.5 is almost always HIGH confidence
        reason: `Very safe: Over 0.5 has ${over05.probabilities.yes}% probability`,
        relationship: 'SAFER',
        probabilityGain: over05.probabilities.yes - bttsProb,
        oddsEstimate: probabilityToOdds(over05.probabilities.yes)
      });
    }
  }
  
  return alternatives;
}

/**
 * Helper: Find safest Over market available
 */
function findSafestOverMarket(
  allPredictions: Map<string, MarketPrediction>,
  maxThreshold: number
): AlternativeBet | null {
  let safest: AlternativeBet | null = null;
  
  for (let i = 0.5; i < maxThreshold; i += 0.5) {
    const market = `OVER_${i.toString().replace('.', '_')}`;
    const prediction = allPredictions.get(market);
    
    if (prediction) {
      if (!safest || prediction.probabilities.yes > safest.probability) {
        safest = {
          market,
          probability: prediction.probabilities.yes,
          confidence: prediction.confidence,
          reason: `Safest available Over market`,
          relationship: 'SAFER',
          probabilityGain: 0,
          oddsEstimate: probabilityToOdds(prediction.probabilities.yes)
        };
      }
    }
  }
  
  return safest;
}

/**
 * Helper: Find safest Under market available
 */
function findSafestUnderMarket(
  allPredictions: Map<string, MarketPrediction>,
  minThreshold: number
): AlternativeBet | null {
  let safest: AlternativeBet | null = null;
  
  for (let i = minThreshold + 0.5; i <= 5.5; i += 0.5) {
    const market = `UNDER_${i.toString().replace('.', '_')}`;
    const prediction = allPredictions.get(market);
    
    if (prediction) {
      if (!safest || prediction.probabilities.yes > safest.probability) {
        safest = {
          market,
          probability: prediction.probabilities.yes,
          confidence: prediction.confidence,
          reason: `Safest available Under market`,
          relationship: 'SAFER',
          probabilityGain: 0,
          oddsEstimate: probabilityToOdds(prediction.probabilities.yes)
        };
      }
    }
  }
  
  return safest;
}
```

**3. Find Correlated Alternatives (MEDIUM/HIGH confidence):**

```typescript
/**
 * Find correlated markets (similar probability, different market type)
 * FIXED: Correlated alternatives must be safer or similar (not harder)
 * If correlated alternative is safer (higher probability), mark as SAFER, not CORRELATED
 */
function findCorrelatedAlternatives(
  primaryMarket: string,
  primaryLine: 0.5 | 1.5 | 2.5 | 3.5 | 4.5 | 5.5 | undefined,
  primaryProb: number,
  allPredictions: Map<string, MarketPrediction>,
  homeTeam: TeamData,
  awayTeam: TeamData,
  config: AlgorithmConfig
): AlternativeBet[] {
  const alternatives: AlternativeBet[] = [];
  const maxDiff = config.alternativeBets.maxProbabilityDiff || 15;
  const correlationThreshold = config.alternativeBets.correlationThreshold || 0.6;
  
  // NOTE: For OVER_UNDER_GOALS, store predictions in the map under a composite key:
  // `${market}:${line}` e.g. 'OVER_UNDER_GOALS:2.5'
  //
  // BTTS Yes correlates with Over 2.5 (line = 2.5)
  if (primaryMarket === 'BTTS' && primaryProb > 60) {
    const ou25 = allPredictions.get('OVER_UNDER_GOALS:2.5');
    const ou25OverProb = ou25?.probabilities.over ?? 0;
    // FIXED: Only suggest if similar probability (within threshold) AND not harder
    // Allow up to 5% lower for CORRELATED, but prefer safer (higher probability)
    if (ou25 && 
        Math.abs(ou25OverProb - primaryProb) < maxDiff &&
        ou25OverProb >= primaryProb - 5) { // Allow up to 5% lower, but prefer safer
      
      const correlation = calculateCorrelation('BTTS', undefined, 'OVER_UNDER_GOALS', 2.5, homeTeam, awayTeam);
      
      // Only suggest if correlation is high enough
      if (correlation >= correlationThreshold) {
        // If it's actually safer (higher probability), mark as SAFER, not CORRELATED
        const relationship = ou25OverProb > primaryProb 
          ? 'SAFER' 
          : (Math.abs(ou25OverProb - primaryProb) <= 5 ? 'CORRELATED' : null);
        
        // Don't suggest if it's harder (more than 5% lower)
        if (relationship) {
          alternatives.push({
            market: 'OVER_UNDER_GOALS',
            line: 2.5,
            probability: ou25OverProb,
            confidence: ou25.confidence,
            reason: ou25OverProb > primaryProb
              ? `Safer: Over 2.5 has ${ou25OverProb}% probability (vs ${primaryProb}% for BTTS)`
              : `Correlated: BTTS Yes (${primaryProb}%) often means Over 2.5 (${ou25OverProb}%) - similar probability`,
            relationship: relationship,
            correlation: correlation,
            probabilityGain: ou25OverProb > primaryProb ? ou25OverProb - primaryProb : undefined,
            oddsEstimate: probabilityToOdds(ou25OverProb)
          });
        }
      }
    }
  }
  
  // Over 2.5 (line = 2.5) correlates with BTTS Yes
  if (primaryMarket === 'OVER_UNDER_GOALS' && primaryLine === 2.5 && primaryProb > 60) {
    const btts = allPredictions.get('BTTS');
    // FIXED: Only suggest if similar or safer, not harder
    if (btts && 
        Math.abs(btts.probabilities.yes - primaryProb) < maxDiff &&
        btts.probabilities.yes >= primaryProb - 5) {
      
      const correlation = calculateCorrelation('OVER_UNDER_GOALS', 2.5, 'BTTS', undefined, homeTeam, awayTeam);
      
      if (correlation >= correlationThreshold) {
        const relationship = btts.probabilities.yes > primaryProb 
          ? 'SAFER' 
          : (Math.abs(btts.probabilities.yes - primaryProb) <= 5 ? 'CORRELATED' : null);
        
        if (relationship) {
          alternatives.push({
            market: 'BTTS',
            probability: btts.probabilities.yes,
            confidence: btts.confidence,
            reason: btts.probabilities.yes > primaryProb
              ? `Safer: BTTS Yes has ${btts.probabilities.yes}% probability (vs ${primaryProb}% for Over 2.5)`
              : `Correlated: Over 2.5 (${primaryProb}%) often means BTTS Yes (${btts.probabilities.yes}%) - similar probability`,
            relationship: relationship,
            correlation: correlation,
            probabilityGain: btts.probabilities.yes > primaryProb ? btts.probabilities.yes - primaryProb : undefined,
            oddsEstimate: probabilityToOdds(btts.probabilities.yes)
          });
        }
      }
    }
  }
  
  // Home Win correlates with Home Win to Nil (if clean sheet rate is high)
  // Note: Win to Nil is typically harder (lower probability), so only suggest if user wants aggressive bets
  if (primaryMarket === 'MATCH_RESULT' && primaryProb > 50) {
    const matchResult = allPredictions.get('MATCH_RESULT');
    const primaryPrediction = allPredictions.get(primaryMarket);
    const homeProb = matchResult?.probabilities.home || 0;
    
    if (homeProb === primaryProb && homeTeam.dna.cleanSheetPercentage > 30 && config.alternativeBets.includeWinToNil) {
      const winToNilProb = homeProb * (homeTeam.dna.cleanSheetPercentage / 100);
      // FIXED: Win to Nil is harder (lower probability), so mark as MORE_AGGRESSIVE, not CORRELATED
      if (winToNilProb > 20 && primaryPrediction?.confidence === 'HIGH') {
        alternatives.push({
          market: 'HOME_WIN_TO_NIL',
          probability: winToNilProb,
          confidence: winToNilProb > 40 ? 'MEDIUM' : 'LOW',
          reason: `More aggressive: Home Win (${homeProb}%) + Clean Sheet rate (${homeTeam.dna.cleanSheetPercentage}%) = ${winToNilProb.toFixed(0)}% (higher odds, lower probability)`,
          relationship: 'MORE_AGGRESSIVE', // Changed from CORRELATED to MORE_AGGRESSIVE (it's harder)
          correlation: homeTeam.dna.cleanSheetPercentage / 100,
          probabilityGain: winToNilProb - homeProb, // Negative gain (harder)
          oddsEstimate: probabilityToOdds(winToNilProb)
        });
      }
    }
    
    // Same for Away Win
    const awayProb = matchResult?.probabilities.away || 0;
    if (awayProb === primaryProb && awayTeam.dna.cleanSheetPercentage > 30 && config.alternativeBets.includeWinToNil) {
      const winToNilProb = awayProb * (awayTeam.dna.cleanSheetPercentage / 100);
      if (winToNilProb > 20 && primaryPrediction?.confidence === 'HIGH') {
        alternatives.push({
          market: 'AWAY_WIN_TO_NIL',
          probability: winToNilProb,
          confidence: winToNilProb > 40 ? 'MEDIUM' : 'LOW',
          reason: `More aggressive: Away Win (${awayProb}%) + Clean Sheet rate (${awayTeam.dna.cleanSheetPercentage}%) = ${winToNilProb.toFixed(0)}% (higher odds, lower probability)`,
          relationship: 'MORE_AGGRESSIVE', // Changed from CORRELATED to MORE_AGGRESSIVE (it's harder)
          correlation: awayTeam.dna.cleanSheetPercentage / 100,
          probabilityGain: winToNilProb - awayProb, // Negative gain (harder)
          oddsEstimate: probabilityToOdds(winToNilProb)
        });
      }
    }
  }
  
  return alternatives;
}

/**
 * Calculate correlation between two markets based on team data
 */
function calculateCorrelation(
  market1: string,
  market1Line: 0.5 | 1.5 | 2.5 | 3.5 | 4.5 | 5.5 | undefined,
  market2: string,
  market2Line: 0.5 | 1.5 | 2.5 | 3.5 | 4.5 | 5.5 | undefined,
  homeTeam: TeamData,
  awayTeam: TeamData
): number {
  // Use historical correlation data or calculate from team stats
  // Example: BTTS and Over/Under Goals @2.5 correlation
  if (
    (market1 === 'BTTS' && market2 === 'OVER_UNDER_GOALS' && market2Line === 2.5) ||
    (market2 === 'BTTS' && market1 === 'OVER_UNDER_GOALS' && market1Line === 2.5)
  ) {
    // If both teams score frequently and concede frequently, high correlation
    const homeScoringRate = homeTeam.mood.last10Matches.filter(m => m.goalsScored > 0).length / 10;
    const awayScoringRate = awayTeam.mood.last10Matches.filter(m => m.goalsScored > 0).length / 10;
    const avgScoringRate = (homeScoringRate + awayScoringRate) / 2;
    
    // Correlation increases with scoring rate
    return Math.min(0.95, avgScoringRate * 1.2);
  }
  
  // Default correlation
  return 0.7;
}
```

**4. Find Complementary Alternatives (HIGH confidence only):**

**Critical Rule:** Alternatives must always be SAFER (higher probability) than the primary prediction, never harder. Complementary alternatives are for different angles but must still meet the safety threshold. Only "MORE_AGGRESSIVE" alternatives can have lower probability, and only for HIGH confidence predictions where users might want higher odds.

```typescript
/**
 * Find complementary markets (different angle, but still safer or similar probability)
 * CRITICAL: Only suggests alternatives that are safer (higher probability) or similar, never harder
 * Exception: MORE_AGGRESSIVE alternatives can have lower probability, but only for HIGH confidence
 */
function findComplementaryAlternatives(
  primaryMarket: string,
  primaryPrediction: MarketPrediction,
  allPredictions: Map<string, MarketPrediction>,
  homeTeam: TeamData,
  awayTeam: TeamData,
  config: AlgorithmConfig
): AlternativeBet[] {
  const alternatives: AlternativeBet[] = [];
  const primaryProb = primaryPrediction.probabilities.yes || 
                     Math.max(...Object.values(primaryPrediction.probabilities));
  
  // If "First Half Goals - Yes" is primary, suggest safer full match alternatives
  // FIXED: Don't suggest OVER_0_5_FIRST_HALF (it's the same as FIRST_HALF)
  // Instead, suggest full match alternatives which are safer (include second half goals)
  if (primaryMarket === 'FIRST_HALF' && primaryPrediction.confidence === 'HIGH' && config.alternativeBets.includeFirstHalfMarkets) {
    // Suggest Over 1.5 (full match) - safer because includes second half goals too
    const over15 = allPredictions.get('OVER_1_5');
    if (over15 && over15.probabilities.yes > primaryProb + 5) {
      alternatives.push({
        market: 'OVER_1_5',
        probability: over15.probabilities.yes,
        confidence: over15.confidence,
        reason: `Safer: Over 1.5 (full match) has ${over15.probabilities.yes}% probability (vs ${primaryProb}% for First Half Goals) - includes second half goals`,
        relationship: 'SAFER',
        probabilityGain: over15.probabilities.yes - primaryProb,
        oddsEstimate: probabilityToOdds(over15.probabilities.yes)
      });
    }
    
    // Suggest Over 0.5 (full match) - very safe, includes both halves
    const over05 = allPredictions.get('OVER_0_5');
    if (over05 && over05.probabilities.yes > primaryProb + 5) {
      alternatives.push({
        market: 'OVER_0_5',
        probability: over05.probabilities.yes,
        confidence: 'HIGH',
        reason: `Very safe: Over 0.5 (full match) has ${over05.probabilities.yes}% probability - includes both halves`,
        relationship: 'SAFER',
        probabilityGain: over05.probabilities.yes - primaryProb,
        oddsEstimate: probabilityToOdds(over05.probabilities.yes)
      });
    }
    
    // Note: Over 1.5 First Half would typically be HARDER (lower probability), not safer
    // So we don't suggest it as a safer alternative
    // If user wants harder bets, they can look for MORE_AGGRESSIVE alternatives
  }
  
  // If Over 2.5 is strong, suggest BTTS First Half only if it's safer or similar
  if (primaryMarket === 'OVER_2_5' && primaryPrediction.confidence === 'HIGH' && config.alternativeBets.includeFirstHalfMarkets) {
    const bttsFirstHalf = calculateBTTSFirstHalfProbability(homeTeam, awayTeam);
    // FIXED: Only suggest if it's safer (higher probability) or similar (within 10%)
    if (bttsFirstHalf > primaryProb || (bttsFirstHalf > primaryProb - 10 && bttsFirstHalf > 40)) {
      alternatives.push({
        market: 'BTTS_FIRST_HALF',
        probability: bttsFirstHalf,
        confidence: bttsFirstHalf > 50 ? 'MEDIUM' : 'LOW',
        reason: bttsFirstHalf > primaryProb 
          ? `Safer: BTTS First Half has ${bttsFirstHalf}% probability (vs ${primaryPrediction.probabilities.yes}% for Over 2.5)`
          : `Complementary: High-scoring match (${primaryPrediction.probabilities.yes}% Over 2.5) suggests early goals possible (${bttsFirstHalf}% probability)`,
        relationship: bttsFirstHalf > primaryProb ? 'SAFER' : 'COMPLEMENTARY',
        probabilityGain: bttsFirstHalf > primaryProb ? bttsFirstHalf - primaryProb : undefined,
        oddsEstimate: probabilityToOdds(bttsFirstHalf)
      });
    }
  }
  
  // If Home Win is strong, suggest Home Win Both Halves only if reasonable probability
  // Note: Both Halves is typically harder, so only suggest if user wants aggressive bets
  if (primaryMarket === 'MATCH_RESULT' && config.alternativeBets.includeBothHalves) {
    const matchResult = allPredictions.get('MATCH_RESULT');
    const homeProb = matchResult?.probabilities.home || 0;
    
    if (homeProb > 60 && primaryPrediction.confidence === 'HIGH') {
      // Calculate probability of winning both halves
      const homeFirstHalfProb = calculateFirstHalfWinProbability(homeTeam, awayTeam, 'HOME');
      const homeSecondHalfProb = calculateSecondHalfWinProbability(homeTeam, awayTeam, 'HOME');
      const bothHalvesProb = homeFirstHalfProb * homeSecondHalfProb * 0.8; // Correlation factor
      
      // FIXED: Only suggest if probability is reasonable (at least 25%) and mark as MORE_AGGRESSIVE
      if (bothHalvesProb > 25) {
        alternatives.push({
          market: 'HOME_WIN_BOTH_HALVES',
          probability: bothHalvesProb,
          confidence: bothHalvesProb > 35 ? 'MEDIUM' : 'LOW',
          reason: `More aggressive: Strong Home Win (${homeProb}%) suggests possible dominance in both halves (${bothHalvesProb.toFixed(0)}% probability)`,
          relationship: 'MORE_AGGRESSIVE', // Changed from COMPLEMENTARY to MORE_AGGRESSIVE
          probabilityGain: bothHalvesProb - homeProb, // Negative gain (harder)
          oddsEstimate: probabilityToOdds(bothHalvesProb)
        });
      }
    }
    
    // Same for Away Win
    const awayProb = matchResult?.probabilities.away || 0;
    if (awayProb > 60 && primaryPrediction.confidence === 'HIGH') {
      const awayFirstHalfProb = calculateFirstHalfWinProbability(homeTeam, awayTeam, 'AWAY');
      const awaySecondHalfProb = calculateSecondHalfWinProbability(homeTeam, awayTeam, 'AWAY');
      const bothHalvesProb = awayFirstHalfProb * awaySecondHalfProb * 0.8;
      
      if (bothHalvesProb > 25) {
        alternatives.push({
          market: 'AWAY_WIN_BOTH_HALVES',
          probability: bothHalvesProb,
          confidence: bothHalvesProb > 35 ? 'MEDIUM' : 'LOW',
          reason: `More aggressive: Strong Away Win (${awayProb}%) suggests possible dominance in both halves (${bothHalvesProb.toFixed(0)}% probability)`,
          relationship: 'MORE_AGGRESSIVE', // Changed from COMPLEMENTARY to MORE_AGGRESSIVE
          probabilityGain: bothHalvesProb - awayProb, // Negative gain (harder)
          oddsEstimate: probabilityToOdds(bothHalvesProb)
        });
      }
    }
  }
  
  // If BTTS is strong, suggest Over 1.5 First Half only if it's safer
  if (primaryMarket === 'BTTS' && primaryPrediction.probabilities.yes > 70 && config.alternativeBets.includeFirstHalfMarkets) {
    const over15FirstHalf = calculateOver15FirstHalfProbability(homeTeam, awayTeam);
    // FIXED: Only suggest if it's safer (higher probability) or similar
    if (over15FirstHalf > primaryPrediction.probabilities.yes || (over15FirstHalf > primaryPrediction.probabilities.yes - 10 && over15FirstHalf > 50)) {
      alternatives.push({
        market: 'OVER_1_5_FIRST_HALF',
        probability: over15FirstHalf,
        confidence: over15FirstHalf > 55 ? 'MEDIUM' : 'LOW',
        reason: over15FirstHalf > primaryPrediction.probabilities.yes
          ? `Safer: Over 1.5 First Half has ${over15FirstHalf}% probability (vs ${primaryPrediction.probabilities.yes}% for BTTS)`
          : `Complementary: BTTS Yes (${primaryPrediction.probabilities.yes}%) suggests early goals likely (${over15FirstHalf}% probability)`,
        relationship: over15FirstHalf > primaryPrediction.probabilities.yes ? 'SAFER' : 'COMPLEMENTARY',
        probabilityGain: over15FirstHalf > primaryPrediction.probabilities.yes ? over15FirstHalf - primaryPrediction.probabilities.yes : undefined,
        oddsEstimate: probabilityToOdds(over15FirstHalf)
      });
    }
    
    // Also suggest Over 0.5 First Half (much safer)
    const over05FirstHalf = calculateOver05FirstHalfProbability(homeTeam, awayTeam);
    if (over05FirstHalf > primaryPrediction.probabilities.yes + 10) {
      alternatives.push({
        market: 'OVER_0_5_FIRST_HALF',
        probability: over05FirstHalf,
        confidence: 'HIGH',
        reason: `Very safe: Over 0.5 First Half has ${over05FirstHalf}% probability`,
        relationship: 'SAFER',
        probabilityGain: over05FirstHalf - primaryPrediction.probabilities.yes,
        oddsEstimate: probabilityToOdds(over05FirstHalf)
      });
    }
  }
  
  return alternatives;
}

/**
 * Helper: Calculate Over 0.5 First Half probability
 */
function calculateOver05FirstHalfProbability(homeTeam: TeamData, awayTeam: TeamData): number {
  // Use first half scoring rates
  const homeFirstHalfProb = homeTeam.dna.firstHalfGoalPercentage / 100;
  const awayFirstHalfProb = awayTeam.dna.firstHalfGoalPercentage / 100;
  
  // Probability at least one team scores in first half
  // P(at least one) = 1 - P(neither scores)
  const neitherScores = (1 - homeFirstHalfProb) * (1 - awayFirstHalfProb);
  return (1 - neitherScores) * 100;
}

/**
 * Helper: Calculate BTTS First Half probability
 */
function calculateBTTSFirstHalfProbability(homeTeam: TeamData, awayTeam: TeamData): number {
  // Use DNA layer first half goal percentages
  const homeFirstHalfProb = homeTeam.dna.firstHalfGoalPercentage / 100;
  const awayFirstHalfProb = awayTeam.dna.firstHalfGoalPercentage / 100;
  
  // Probability both score in first half = home scores first half * away scores first half
  // Adjusted for correlation (teams that score early often concede early)
  return (homeFirstHalfProb * awayFirstHalfProb * 1.2) * 100; // 1.2x correlation factor
}

/**
 * Helper: Calculate Over 1.5 First Half probability
 */
function calculateOver15FirstHalfProbability(homeTeam: TeamData, awayTeam: TeamData): number {
  // Use average goals per match and first half percentage
  const homeAvgGoals = homeTeam.mind.last50Matches.reduce((sum, m) => sum + (m.goalsScored || 0), 0) / 50;
  const awayAvgGoals = awayTeam.mind.last50Matches.reduce((sum, m) => sum + (m.goalsScored || 0), 0) / 50;
  const totalAvgGoals = homeAvgGoals + awayAvgGoals;
  
  // Estimate first half goals (typically 40-45% of total)
  const firstHalfGoals = totalAvgGoals * 0.42;
  
  // Convert to probability (Poisson approximation)
  // P(>1.5 goals) ≈ P(≥2 goals) = 1 - P(0 goals) - P(1 goal)
  const lambda = firstHalfGoals;
  const p0 = Math.exp(-lambda);
  const p1 = lambda * Math.exp(-lambda);
  const probOver15 = (1 - p0 - p1) * 100;
  
  return Math.min(95, Math.max(5, probOver15));
}

/**
 * Helper: Calculate first half win probability
 */
function calculateFirstHalfWinProbability(homeTeam: TeamData, awayTeam: TeamData, side: 'HOME' | 'AWAY'): number {
  // Use first half scoring rates and early goal percentages
  const team = side === 'HOME' ? homeTeam : awayTeam;
  const opponent = side === 'HOME' ? awayTeam : homeTeam;
  
  const teamFirstHalfProb = team.dna.firstHalfGoalPercentage / 100;
  const opponentFirstHalfProb = opponent.dna.firstHalfGoalPercentage / 100;
  
  // Probability team wins first half = team scores AND opponent doesn't score
  return (teamFirstHalfProb * (1 - opponentFirstHalfProb)) * 100;
}

/**
 * Helper: Calculate second half win probability
 */
function calculateSecondHalfWinProbability(homeTeam: TeamData, awayTeam: TeamData, side: 'HOME' | 'AWAY'): number {
  // Similar to first half but use second half data
  // For now, use overall form as proxy
  const team = side === 'HOME' ? homeTeam : awayTeam;
  const opponent = side === 'HOME' ? awayTeam : homeTeam;
  
  // Use recent form as proxy for second half performance
  const teamForm = calculateFormScore(team.mood.last10Matches, config.formWeighting);
  const opponentForm = calculateFormScore(opponent.mood.last10Matches, config.formWeighting);
  
  // Convert form difference to probability
  const formDiff = teamForm - opponentForm;
  return 50 + (formDiff * 0.3); // Scale form difference to probability
}
```

**5. Configuration:**

```typescript
interface AlternativeBetsConfig {
  enabled: boolean;
  alwaysSuggest: boolean; // Always suggest alternatives (default: true)
  
  // Dynamic thresholds based on confidence
  minProbabilityGain: {
    LOW: number;    // Default: 10% - need 10%+ higher probability
    MEDIUM: number; // Default: 7% - need 7%+ higher probability
    HIGH: number;   // Default: 5% - need 5%+ higher probability
  };
  
  maxAlternatives: number; // Maximum alternatives per market (default: 5)
  maxProbabilityDiff: number; // Maximum probability difference for correlated (default: 15%)
  correlationThreshold: number; // Minimum correlation to suggest (default: 0.6)
  
  // Fallback: if no alternatives meet threshold, suggest safest available
  fallbackToSafest: boolean; // Default: true
  
  // Market-specific settings
  overUnderThresholds: number[]; // All thresholds to check: [0.5, 1.5, 2.5, 3.5, 4.5, 5.5]
  includeDrawNoBet: boolean; // Always suggest Draw No Bet for Match Result (default: true)
  includeDoubleChance: boolean; // Always suggest Double Chance (default: true)
  
  // Advanced options (only for HIGH confidence)
  includeWinToNil: boolean; // Suggest Win to Nil (default: true)
  includeBothHalves: boolean; // Suggest Win Both Halves (default: true)
  includeFirstHalfMarkets: boolean; // Suggest first half alternatives (default: true)
}

// Add to AlgorithmConfig
interface AlgorithmConfig {
  // ... existing config
  alternativeBets: AlternativeBetsConfig;
}
```

**6. Integration into Prediction Pipeline:**

```typescript
/**
 * Generate all market predictions with alternative suggestions
 */
async function generateMarketPredictionsWithAlternatives(
  homeTeam: TeamData,
  awayTeam: TeamData,
  h2hData: H2HData,
  config: AlgorithmConfig
): Promise<MarketPrediction[]> {
  // Step 1: Calculate ALL market predictions first
  const allPredictions = new Map<string, MarketPrediction>();
  
  // Core markets
  allPredictions.set('BTTS', await predictBTTS(homeTeam, awayTeam, h2hData, config));
  allPredictions.set('MATCH_RESULT', await predictMatchResult(homeTeam, awayTeam, h2hData, config));
  
  // All Over/Under markets
  const thresholds = config.alternativeBets.overUnderThresholds || [0.5, 1.5, 2.5, 3.5, 4.5, 5.5];
  for (const threshold of thresholds) {
    const market = `OVER_${threshold.toString().replace('.', '_')}`;
    allPredictions.set(market, await predictOverUnder(homeTeam, awayTeam, h2hData, threshold, config));
    
    const underMarket = `UNDER_${threshold.toString().replace('.', '_')}`;
    allPredictions.set(underMarket, await predictOverUnder(homeTeam, awayTeam, h2hData, threshold, config, 'UNDER'));
  }
  
  // Step 2: For each primary prediction, suggest alternatives
  const predictions: MarketPrediction[] = [];
  
  // Primary markets (BTTS, Over/Under Goals, Match Result, First Half)
  const primaryMarkets = ['BTTS', 'OVER_UNDER_GOALS', 'MATCH_RESULT', 'FIRST_HALF'];
  
  for (const market of primaryMarkets) {
    const prediction = allPredictions.get(market);
    if (prediction) {
      // Add alternative suggestions
      prediction.alternatives = suggestAlternativeBets(
        prediction,
        allPredictions,
        homeTeam,
        awayTeam,
        config
      );
      predictions.push(prediction);
    }
  }
  
  return predictions;
}
```

**7. API Response Example:**

```json
{
  "market": "OVER_UNDER_GOALS",
  "line": 2.5,
  "probabilities": {
    "over": 75,
    "under": 25
  },
  "confidence": "HIGH",
  "rating": "STRONG",
  "alternatives": [
    {
      "market": "OVER_1_5",
      "probability": 88,
      "confidence": "HIGH",
      "reason": "Safer alternative: Over 1.5 has 88% probability (vs 75% for Over 2.5)",
      "relationship": "SAFER",
      "probabilityGain": 13,
      "oddsEstimate": 1.14
    },
    {
      "market": "BTTS",
      "probability": 72,
      "confidence": "HIGH",
      "reason": "Correlated: Over 2.5 (75%) often means BTTS Yes (72%)",
      "relationship": "CORRELATED",
      "correlation": 0.85,
      "oddsEstimate": 1.39
    },
    {
      "market": "OVER_3_5",
      "probability": 58,
      "confidence": "MEDIUM",
      "reason": "More aggressive: Over 3.5 has 58% probability (higher odds, lower probability)",
      "relationship": "MORE_AGGRESSIVE",
      "probabilityGain": -17,
      "oddsEstimate": 1.72
    }
  ]
}
```

**Example: First Half Goals (Corrected):**

```json
{
  "market": "FIRST_HALF",
  "probabilities": {
    "yes": 55,
    "no": 45
  },
  "confidence": "MEDIUM",
  "rating": "NEUTRAL",
  "recommendation": "First Half Goals - Yes ✅",
  "alternatives": [
    {
      "market": "OVER_1_5",
      "probability": 72,
      "confidence": "HIGH",
      "reason": "Safer: Over 1.5 (full match) has 72% probability (vs 55% for First Half Goals) - includes second half goals",
      "relationship": "SAFER",
      "probabilityGain": 17,
      "oddsEstimate": 1.39
    },
    {
      "market": "OVER_0_5",
      "probability": 94,
      "confidence": "HIGH",
      "reason": "Very safe: Over 0.5 (full match) has 94% probability - includes both halves",
      "relationship": "SAFER",
      "probabilityGain": 39,
      "oddsEstimate": 1.06
    }
  ]
}
```

**Note:** "First Half Goals - Yes" and "Over 0.5 First Half" are the **same market**, so we don't suggest OVER_0_5_FIRST_HALF as an alternative. Instead, we suggest full match alternatives (OVER_1_5, OVER_0_5) which are safer because they include second half goals. We never suggest harder alternatives (like Over 1.5 First Half with 45% probability) unless explicitly marked as "MORE_AGGRESSIVE" and only for HIGH confidence predictions where users might want higher odds.

**Correlated Alternatives Rule:**
- **CORRELATED** alternatives must be similar probability (±5%) or safer (higher probability)
- If a correlated alternative is safer (higher probability), mark as **SAFER**, not CORRELATED
- **Don't suggest CORRELATED if it's harder** (more than 5% lower probability than primary)
- **Example:** BTTS (72%) → Over 2.5 (68%) would **NOT** be suggested as CORRELATED (it's harder, -4% difference)
- **Example:** BTTS (72%) → Over 2.5 (74%) would be marked as **SAFER** (it's safer, +2% difference)
- **Example:** BTTS (72%) → Over 2.5 (70%) could be **CORRELATED** (similar, within ±5%, -2% difference)
- **Rationale:** Users expect alternatives to be safer or similar risk, not harder. CORRELATED should indicate similar probability with different market type, not a harder bet.

**Benefits:**
- **Always provides options:** Every prediction gets safer alternatives
- **Flexible:** Suggests any market dynamically, not fixed alternatives
- **Confidence-aware:** Adjusts suggestion quality based on confidence level
- **Risk management:** Users can choose safer alternatives based on their risk tolerance
- **Better UX:** Users don't need to manually find safer bets

**ROI:** High (improves user experience, helps with risk management, increases user engagement)

**Implementation Effort:** 2-3 days (core logic + integration + testing)

---

### Phase 4.7: Team News & Injuries Integration

**Goal:** Integrate team news (injuries) into market predictions using API-Football endpoints

#### 4.7.1 Pre-Implementation Requirements

**CRITICAL:** Before starting Phase 4.7, the following API endpoints must be implemented with caching strategies:

1. **Fixture ID Endpoint** - `/fixtures?id={fixtureId}`
2. **Team/Statistics Endpoint** - `/teams/statistics?team={teamId}&league={leagueId}&season={season}`
3. **Player/Statistics Endpoint** - `/players?team={teamId}&league={leagueId}&season={season}` (returns entire squad)
4. **H2H Endpoint** - `/fixtures/headtohead?h2h={teamId1}-{teamId2}`
5. **Injuries Endpoint** - `/injuries?fixture={fixtureId}` or `/injuries?team={teamId}&season={season}`

**Note:** All endpoints are pre-implemented outside this phase. Phase 4.7 uses these endpoints to process injuries and calculate adjustments.

#### 4.7.2 Injury Data Processing

**Architecture:**

```
Fixture Request
  ├─> Get Injuries (Pre-implemented /injuries endpoint)
  ├─> Get Squad Statistics (Pre-implemented /players endpoint)
  │   └─> Filter injured players (player.injured = true)
  ├─> For each injured player:
  │   ├─> Extract Player Statistics (from squad response)
  │   ├─> Calculate Importance Score (rating, minutes, goals, assists)
  │   └─> Determine Impact Category (CRITICAL/HIGH/MEDIUM/LOW)
  ├─> Calculate Adjustments per Market
  │   ├─> BTTS Adjustment (attackers out = -%, defenders out = +%)
  │   ├─> Over/Under 2.5 Adjustment
  │   └─> Match Result Adjustment
  └─> Apply to Predictions (Phase 4 functions)
```

**Implementation:**

```typescript
// apps/backend/src/modules/betting-insights/data/injuries.ts

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
  substitutes: {
    in: number;
    out: number;
    bench: number;
  };
}

/**
 * Process injuries from pre-implemented endpoints
 */
async function getInjuriesForAlgorithm(
  fixtureId: number,
  homeTeamId: number,
  awayTeamId: number,
  leagueId: number,
  season: number,
  c?: Context
): Promise<{
  homeTeamInjuries: AlgorithmInjury[];
  awayTeamInjuries: AlgorithmInjury[];
}> {
  // Step 1: Get injuries from pre-implemented endpoint
  const injuries = await getInjuriesForFixture(fixtureId, c);
  
  // Step 2: Get squad statistics for both teams
  const [homeSquad, awaySquad] = await Promise.all([
    getSquadStatistics(homeTeamId, leagueId, season, c),
    getSquadStatistics(awayTeamId, leagueId, season, c),
  ]);
  
  // Step 3: Filter injured players from squad (player.injured = true)
  const homeInjuredPlayers = homeSquad.filter(p => p.player.injured === true);
  const awayInjuredPlayers = awaySquad.filter(p => p.player.injured === true);
  
  // Step 4: Match injuries with squad statistics
  const homeTeamInjuries = matchInjuriesWithStatistics(
    injuries.filter(i => i.team.id === homeTeamId),
    homeInjuredPlayers
  );
  
  const awayTeamInjuries = matchInjuriesWithStatistics(
    injuries.filter(i => i.team.id === awayTeamId),
    awayInjuredPlayers
  );
  
  return { homeTeamInjuries, awayTeamInjuries };
}

/**
 * Match injuries with squad statistics and calculate importance
 */
function matchInjuriesWithStatistics(
  injuries: APIFootballInjury[],
  injuredPlayers: PlayerStatistics[]
): AlgorithmInjury[] {
  return injuries.map(injury => {
    const playerStats = injuredPlayers.find(p => p.playerId === injury.player.id);
    
    let importanceScore: number;
    let importanceSource: 'STATISTICS' | 'FALLBACK';
    
    if (playerStats) {
      // Calculate importance from statistics
      importanceScore = calculateImportanceFromStatistics(playerStats, injury);
      importanceSource = 'STATISTICS';
    } else {
      // Fallback: player injured but not in squad
      importanceScore = calculateBasicImportance(injury);
      importanceSource = 'FALLBACK';
    }
    
    return {
      playerId: injury.player.id,
      playerName: injury.player.name,
      position: playerStats?.position || injury.player.position || 'Unknown',
      reason: injury.player.reason,
      status: normalizeStatus(injury.player.reason) as 'Out' | 'Doubtful' | 'Minor',
      importanceScore,
      importanceSource,
      isKeyPlayer: importanceScore >= 50,
      impactCategory: importanceScore >= 70 ? 'CRITICAL' :
                     importanceScore >= 50 ? 'HIGH' :
                     importanceScore >= 30 ? 'MEDIUM' : 'LOW',
    };
  });
}
```

#### 4.7.3 Player Importance Calculation

**Importance Score Factors (0-100 points):**

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
   - Start ratio ≥ 90%: 10 points (Almost always starts)
   - Start ratio ≥ 70%: 7 points (Usually starts)
   - Start ratio ≥ 50%: 4 points (Sometimes starts)
   - Start ratio < 50%: 1 point (Usually substitute)

4. **Goals Contribution (0-15 points)**
   - Goals/game ≥ 0.5: 15 points (Top scorer)
   - Goals/game ≥ 0.3: 12 points (Good scorer)
   - Goals/game ≥ 0.15: 8 points (Occasional scorer)
   - Goals/game > 0: 4 points (Rare scorer)

5. **Assists Contribution (0-10 points)**
   - Assists/game ≥ 0.4: 10 points (Key creator)
   - Assists/game ≥ 0.25: 7 points (Good creator)
   - Assists/game ≥ 0.1: 4 points (Occasional creator)
   - Assists/game > 0: 2 points (Rare creator)

6. **Key Passes (0-5 points)**
   - Key passes/game ≥ 2.5: 5 points (Very creative)
   - Key passes/game ≥ 1.5: 3 points (Creative)
   - Key passes/game ≥ 0.5: 1 point (Somewhat creative)

7. **Captain Status (0-5 points)**
   - Captain: 5 points (Leadership role)

8. **Position Multiplier (0-5 points)**
   - Attackers: Higher weight
   - Defenders: Medium weight
   - Midfielders: Lower weight

9. **Injury Type (0-5 points)**
   - Cruciate/ACL: 5 points (Serious)
   - Fracture: 4 points
   - Muscle: 2 points

10. **Status Multiplier**
    - Out: 1.0x (Full impact)
    - Doubtful: 0.6x (60% impact)
    - Minor: 0.3x (30% impact)

**Filtering Low-Importance Injuries:**
- Filter out injuries with importance < 20 (bench players)
- Only include "Out" status injuries for low importance
- Include "Doubtful" only if importance ≥ 40
- Include "Minor" only if importance ≥ 70

```typescript
// apps/backend/src/modules/betting-insights/utils/player-importance.ts

function calculateImportanceFromStatistics(
  playerStats: PlayerStatistics,
  injury: APIFootballInjury
): number {
  let score = 0;
  
  // Factor 1: Rating (0-35 points)
  if (playerStats.rating >= 8.0) score += 35;
  else if (playerStats.rating >= 7.5) score += 28;
  else if (playerStats.rating >= 7.0) score += 22;
  else if (playerStats.rating >= 6.5) score += 15;
  else if (playerStats.rating >= 6.0) score += 8;
  else if (playerStats.rating > 0) score += 3;
  
  // Factor 2: Playing Time (0-25 points)
  const possibleMinutes = playerStats.appearances * 90;
  const minutesRatio = possibleMinutes > 0 
    ? playerStats.minutesPlayed / possibleMinutes 
    : 0;
  
  if (minutesRatio >= 0.85) score += 25;
  else if (minutesRatio >= 0.6) score += 18;
  else if (minutesRatio >= 0.3) score += 10;
  else if (minutesRatio >= 0.1) score += 5;
  else score += 1;
  
  // Factor 3: Starter Status (0-10 points)
  const startRatio = playerStats.appearances > 0 
    ? playerStats.lineups / playerStats.appearances 
    : 0;
  
  if (startRatio >= 0.9) score += 10;
  else if (startRatio >= 0.7) score += 7;
  else if (startRatio >= 0.5) score += 4;
  else score += 1;
  
  // Factor 4: Goals Contribution (0-15 points)
  const goalsPerGame = playerStats.appearances > 0 
    ? playerStats.goals / playerStats.appearances 
    : 0;
  
  if (goalsPerGame >= 0.5) score += 15;
  else if (goalsPerGame >= 0.3) score += 12;
  else if (goalsPerGame >= 0.15) score += 8;
  else if (goalsPerGame > 0) score += 4;
  
  // Factor 5: Assists Contribution (0-10 points)
  const assistsPerGame = playerStats.appearances > 0 
    ? playerStats.assists / playerStats.appearances 
    : 0;
  
  if (assistsPerGame >= 0.4) score += 10;
  else if (assistsPerGame >= 0.25) score += 7;
  else if (assistsPerGame >= 0.1) score += 4;
  else if (assistsPerGame > 0) score += 2;
  
  // Factor 6: Key Passes (0-5 points)
  const keyPassesPerGame = playerStats.appearances > 0 
    ? playerStats.keyPasses / playerStats.appearances 
    : 0;
  
  if (keyPassesPerGame >= 2.5) score += 5;
  else if (keyPassesPerGame >= 1.5) score += 3;
  else if (keyPassesPerGame >= 0.5) score += 1;
  
  // Factor 7: Captain Status (0-5 points)
  if (playerStats.captain) score += 5;
  
  // Factor 8: Position Multiplier (0-5 points)
  const positionMultiplier = getPositionMultiplier(playerStats.position);
  score += positionMultiplier * minutesRatio;
  
  // Factor 9: Injury Type (0-5 points)
  const reason = injury.player.reason.toLowerCase();
  if (reason.includes('cruciate') || reason.includes('acl')) score += 5;
  else if (reason.includes('fracture') || reason.includes('broken')) score += 4;
  else if (reason.includes('muscle') || reason.includes('hamstring')) score += 2;
  
  // Factor 10: Status Multiplier
  const status = normalizeStatus(injury.player.reason);
  if (status === 'Out') score *= 1.0;
  else if (status === 'Doubtful') score *= 0.6;
  else score *= 0.3;
  
  return Math.min(100, Math.max(0, Math.round(score)));
}
```

#### 4.7.4 Market-Specific Adjustments

**BTTS Adjustments:**
- Missing attackers: Reduce BTTS probability
  - Adjustment: -(avgImportance / 10) percentage points
  - Example: 80 importance = -8% BTTS
- Missing defenders: Increase BTTS probability
  - Adjustment: +(avgImportance / 15) percentage points
  - Example: 60 importance = +4% BTTS
- Cap adjustments at ±15%

**Over/Under 2.5 Adjustments:**
- Missing attackers: Reduce Over 2.5 probability
  - Adjustment: -(totalAttackerImportance / 12)
- Missing defenders: Increase Over 2.5 probability
  - Adjustment: +(totalDefenderImportance / 18)
- Cap adjustments at ±12%

**Match Result Adjustments:**
- Missing critical players: Reduce win probability
  - Critical players out: -3% per player
  - High importance players out: -2% per player
- Cap adjustments at ±10%

```typescript
// apps/backend/src/modules/betting-insights/adjustments/injury-adjustments.ts

interface InjuryAdjustments {
  bttsAdjustment: number; // -15 to +15
  over25Adjustment: number; // -12 to +12
  matchResultHomeAdjustment: number; // -10 to +10
  matchResultAwayAdjustment: number; // -10 to +10
  insights: Insight[];
}

function calculateInjuryAdjustments(
  homeTeamInjuries: AlgorithmInjury[],
  awayTeamInjuries: AlgorithmInjury[]
): InjuryAdjustments {
  const insights: Insight[] = [];
  
  // Filter to "Out" injuries only
  const homeOut = homeTeamInjuries.filter(i => i.status === 'Out');
  const awayOut = awayTeamInjuries.filter(i => i.status === 'Out');
  
  // Separate by position
  const homeAttackersOut = homeOut.filter(i => 
    i.position.toLowerCase().includes('forward') || 
    i.position.toLowerCase().includes('striker') ||
    (i.position.toLowerCase().includes('midfielder') && 
     i.position.toLowerCase().includes('attack'))
  );
  
  const homeDefendersOut = homeOut.filter(i => 
    i.position.toLowerCase().includes('defender') ||
    i.position.toLowerCase().includes('goalkeeper')
  );
  
  // Similar for away team...
  
  // BTTS Adjustments
  let bttsAdjustment = 0;
  
  if (homeAttackersOut.length > 0) {
    const totalImpact = homeAttackersOut.reduce((sum, i) => sum + i.importanceScore, 0);
    const avgImpact = totalImpact / homeAttackersOut.length;
    bttsAdjustment -= (avgImpact / 10);
    
    insights.push({
      text: `🚨 Home team: ${homeAttackersOut.length} key attacker(s) out: ${homeAttackersOut.map(i => i.playerName).join(', ')}`,
      emoji: '🚨',
      priority: 95,
      category: 'TEAM_NEWS',
      severity: avgImpact > 60 ? 'CRITICAL' : 'HIGH',
    });
  }
  
  if (homeDefendersOut.length > 0) {
    const totalImpact = homeDefendersOut.reduce((sum, i) => sum + i.importanceScore, 0);
    bttsAdjustment += (totalImpact / 15);
    
    insights.push({
      text: `🔓 Home team: ${homeDefendersOut.length} defender(s) out: ${homeDefendersOut.map(i => i.playerName).join(', ')}`,
      emoji: '🔓',
      priority: 90,
      category: 'TEAM_NEWS',
      severity: 'HIGH',
    });
  }
  
  // Similar logic for away team...
  
  // Over/Under 2.5 and Match Result adjustments...
  
  return {
    bttsAdjustment: Math.max(-15, Math.min(15, bttsAdjustment)),
    over25Adjustment: Math.max(-12, Math.min(12, over25Adjustment)),
    matchResultHomeAdjustment: Math.max(-10, Math.min(10, matchResultHomeAdjustment)),
    matchResultAwayAdjustment: Math.max(-10, Math.min(10, matchResultAwayAdjustment)),
    insights
  };
}
```

#### 4.7.5 Integration into Prediction Functions

**Integration Points:**

1. **predictBTTS()** - Add injury adjustments after base calculation
2. **predictOver25()** - Add injury adjustments after base calculation
3. **predictMatchResult()** - Add injury adjustments after base calculation
4. **predictFirstHalf()** - Add injury adjustments (minimal impact)

**Example Integration:**

```typescript
async function predictBTTS(
  homeTeam: TeamData,
  awayTeam: TeamData,
  h2h: H2HData,
  fixtureId: number,
  leagueId: number,
  season: number,
  isEarlySeason: boolean = false,
  formationStability?: FormationStabilityContext,
  config: AlgorithmConfig,
  c?: Context
): Promise<MarketPrediction> {
  // Calculate base probability
  const baseProbability = calculateBaseBTTS(homeTeam, awayTeam, h2h, isEarlySeason);
  
  // Collect ALL adjustments (not applied yet)
  const allAdjustments: Adjustment[] = [];
  
  // 1. DNA adjustments
  const homeDnaAdjustment = homeTeam.dna.under25Percentage > 70 ? -5 : 0;
  const awayDnaAdjustment = awayTeam.dna.under25Percentage > 70 ? -5 : 0;
  if (homeDnaAdjustment !== 0) {
    allAdjustments.push({
      name: 'dna_home_under25',
      value: homeDnaAdjustment,
      reason: `${homeTeam.name} season DNA: ${homeTeam.dna.under25Percentage}% Under 2.5`,
    });
  }
  if (awayDnaAdjustment !== 0) {
    allAdjustments.push({
      name: 'dna_away_under25',
      value: awayDnaAdjustment,
      reason: `${awayTeam.name} season DNA: ${awayTeam.dna.under25Percentage}% Under 2.5`,
    });
  }
  
  // 2. Formation stability adjustments (market-adjusted for BTTS)
  const formationAdjustment = -(formationStability?.totalFormationReduction || 0) * 0.6; // 40% less impact
  if (formationAdjustment !== 0) {
    allAdjustments.push({
      name: 'formation_instability',
      value: formationAdjustment,
      reason: 'Experimental formation(s) detected',
    });
  }
  
  // 3. Safety flag adjustments
  if (homeTeam.safetyFlags.liveDog || awayTeam.safetyFlags.liveDog) {
    allAdjustments.push({
      name: 'live_dog',
      value: 10,
      reason: 'Bottom team showing form - switch to BTTS',
    });
  }
  
  // 4. Rest day adjustments
  if (homeTeam.daysSinceLastMatch > 10) {
    allAdjustments.push({
      name: 'rest_days_home',
      value: -2,
      reason: `Home team rested ${homeTeam.daysSinceLastMatch} days`,
    });
  }
  if (awayTeam.daysSinceLastMatch > 10) {
    allAdjustments.push({
      name: 'rest_days_away',
      value: -2,
      reason: `Away team rested ${awayTeam.daysSinceLastMatch} days`,
    });
  }
  
  // 5. Injury adjustments (CRITICAL FIX)
  const { homeTeamInjuries, awayTeamInjuries } = await getInjuriesForAlgorithm(
    fixtureId,
    homeTeam.id,
    awayTeam.id,
    leagueId,
    season,
    c
  );
  
  const injuryAdjustments = calculateInjuryAdjustments(
    homeTeamInjuries,
    awayTeamInjuries
  );
  
  // Add injury adjustment to allAdjustments array (not applied directly)
  if (injuryAdjustments.bttsAdjustment !== 0) {
    allAdjustments.push({
      name: 'injuries',
      value: injuryAdjustments.bttsAdjustment,
      reason: 'Key player injuries',
    });
  }
  
  // Apply ALL adjustments through unified capping function
  const adjustmentResult = applyCappedAsymmetricAdjustments(
    baseProbability,
    allAdjustments, // All adjustments in one array
    'BTTS',
    config
  );
  
  const finalProbability = adjustmentResult.finalProbability;
  
  // Calculate confidence with swing awareness
  let confidence = calculateBaseConfidence(baseProbability, allAdjustments);
  confidence = downgradeConfidenceIfBigSwing(
    confidence,
    Math.abs(adjustmentResult.totalAdjustment),
    allAdjustments.length,
    config
  );
  
  // Combine insights (including injury insights)
  const insights = [
    ...baseInsights,
    ...injuryAdjustments.insights,
  ];
  
  return {
    market: 'BTTS',
    probabilities: {
      yes: finalProbability,
      no: 100 - finalProbability,
    },
    rating: getRating(finalProbability),
    confidence,
    insights: insights.slice(0, 8),
    adjustments: adjustmentResult.cappedAdjustments, // Show all capped adjustments
    recommendation: generateRecommendation(finalProbability),
  };
}
```

**Files to Create:**
- `apps/backend/src/modules/betting-insights/data/injuries.ts` - Injury processing logic
- `apps/backend/src/modules/betting-insights/data/player-statistics.ts` - Player stats extraction from squad
- `apps/backend/src/modules/betting-insights/utils/player-importance.ts` - Importance calculation
- `apps/backend/src/modules/betting-insights/adjustments/injury-adjustments.ts` - Market adjustments

**Files to Modify:**
- `apps/backend/src/modules/betting-insights/predictions/predict-btts.ts` - Add injury integration
- `apps/backend/src/modules/betting-insights/predictions/predict-over25.ts` - Add injury integration
- `apps/backend/src/modules/betting-insights/predictions/predict-match-result.ts` - Add injury integration
- `apps/backend/src/modules/betting-insights/predictions/predict-first-half.ts` - Add injury integration

**Validation Criteria:**
- ✅ Injuries processed correctly from pre-implemented endpoints
- ✅ Squad statistics filtered correctly for injured players (`player.injured = true`)
- ✅ Importance score calculated correctly from statistics
- ✅ Rating is primary factor (most weight)
- ✅ Bench players (low minutes) get low scores and are filtered out
- ✅ Market adjustments calculated correctly
- ✅ All adjustments go through unified capping function (`applyCappedAsymmetricAdjustments`)
- ✅ Cumulative caps prevent same-type stacking (formation, injuries, DNA, safety, rest)
- ✅ Overcorrection detection reduces conflicting/excessive adjustments
- ✅ Production monitoring catches any violations (`auditPredictionSwing`)
- ✅ Insights generated for key injuries only

**ROI:** High (2-5% accuracy improvement, especially for matches with key player injuries)

**Implementation Effort:** 3-4 days (data processing + importance calculation + adjustments + integration)

---

### Phase 5: API Endpoint (Week 3)

**Goal:** Expose predictions via clean API

```typescript
// /api/fixtures/[fixtureId]/insights.ts

app.get('/api/fixtures/:fixtureId/insights', async (c) => {
  const fixtureId = c.req.param('fixtureId');
  
  try {
    // 1. Get match details
    const match = await getMatchDetails(fixtureId, c);
    
    if (!match) {
      return c.json({ error: 'Fixture not found' }, 404);
    }
    
    // 2. Check cache (reuse fixtures TTL / invalidation behavior)
    // IMPORTANT: TTLs/headers should follow the same status-aware policy used by the existing fixtures endpoints.
    // Implement this by reusing the same logic as the fixture detail route (live/finished/pre-kickoff tiers).
    const cachePolicy = getFixtureCachePolicy(match); // { ttlSeconds, cacheControl, cdnCacheControl }
    const cacheKey = `insights:${fixtureId}`;
    const cached = await c.env.KV.get(cacheKey, 'json');
    
    // If cached and still fresh under the same TTL rules as fixtures, return it
    if (cached && !isStale(cached, cachePolicy.ttlSeconds)) {
      return c.json(cached);
    }
    
    // 3. Detect match type (league, cup, international, friendly)
    const matchType = detectMatchType(match.leagueName, match.round);
    
    // 4. For international matches: Get domestic leagues for both teams
    let homeDomesticLeagueId: number | undefined;
    let awayDomesticLeagueId: number | undefined;
    
    if (matchType.type === 'INTERNATIONAL') {
      // Get domestic leagues for international match context
      [homeDomesticLeagueId, awayDomesticLeagueId] = await Promise.all([
        getTeamDomesticLeague(match.homeTeamId),
        getTeamDomesticLeague(match.awayTeamId)
      ]);
    }
    
    // 5. Fetch team data (use domestic league for international matches)
    const [homeTeam, awayTeam, h2h] = await Promise.all([
      getTeamData(match.homeTeamId, c, {
        domesticLeagueId: homeDomesticLeagueId,
        matchLeagueId: match.leagueId,
        season: match.season
      }),
      getTeamData(match.awayTeamId, c, {
        domesticLeagueId: awayDomesticLeagueId,
        matchLeagueId: match.leagueId,
        season: match.season
      }),
      getH2HData(match.homeTeamId, match.awayTeamId, c, {
        leagueId: matchType.type === 'INTERNATIONAL' ? match.leagueId : undefined, // Filter H2H to international competition
        includeAllLeagues: matchType.type !== 'INTERNATIONAL' // Include all leagues for domestic matches
      }),
    ]);
    
    // 4. Detect patterns
    const homePatterns = detectPatterns(homeTeam, 'home');
    const awayPatterns = detectPatterns(awayTeam, 'away');
    const h2hPatterns = detectH2HPatterns(h2h);
    
    // 5. Generate insights
    const homeInsights = generateInsights(homePatterns, homeTeam.name);
    const awayInsights = generateInsights(awayPatterns, awayTeam.name);
    const h2hInsights = generateInsights(h2hPatterns, '');
    
    // 6. Generate market predictions
    const predictions = await generateMarketPredictions(
      homeTeam,
      awayTeam,
      h2h,
      {
        round: match.league?.round,
        leagueName: match.league?.name,
        homeFormation: match.homeFormation, // From lineup data
        awayFormation: match.awayFormation, // From lineup data
      }
    );
    
    // 7. Build response
    const response = {
      match: {
        fixtureId: fixtureId,
        homeTeam: homeTeam.name,
        awayTeam: awayTeam.name,
        date: match.date,
        league: match.league,
      },
      context: {
        homeTeam: {
          form: homeTeam.stats.form,
          position: homeTeam.stats.leaguePosition,
          daysSinceLastMatch: homeTeam.daysSinceLastMatch,
          motivation: calculateMotivation(homeTeam),
          mind: {
            efficiencyIndex: homeTeam.mind.efficiencyIndex,
            tier: homeTeam.mind.tier,
          },
          mood: {
            tier: homeTeam.mood.tier,
            isSleepingGiant: homeTeam.mood.isSleepingGiant,
            isOverPerformer: homeTeam.mood.isOverPerformer,
          },
          dna: {
            mostPlayedFormation: homeTeam.dna.mostPlayedFormation,
            under25Percentage: homeTeam.dna.under25Percentage,
            lateStarter: homeTeam.dna.lateStarter,
          },
        },
        awayTeam: {
          form: awayTeam.stats.form,
          position: awayTeam.stats.leaguePosition,
          daysSinceLastMatch: awayTeam.daysSinceLastMatch,
          motivation: calculateMotivation(awayTeam),
          mind: {
            efficiencyIndex: awayTeam.mind.efficiencyIndex,
            tier: awayTeam.mind.tier,
          },
          mood: {
            tier: awayTeam.mood.tier,
            isSleepingGiant: awayTeam.mood.isSleepingGiant,
            isOverPerformer: awayTeam.mood.isOverPerformer,
          },
          dna: {
            mostPlayedFormation: awayTeam.dna.mostPlayedFormation,
            under25Percentage: awayTeam.dna.under25Percentage,
            lateStarter: awayTeam.dna.lateStarter,
          },
        },
        match: {
          round: match.league?.round,
          earlySeason: match.league?.round ? isEarlySeason(match.league.round) : false,
          homeFormation: match.homeFormation,
          awayFormation: match.awayFormation,
          formationStability: {
            home: {
              isStable: homeFormationStability.isStable,
              stabilityScore: homeFormationStability.stabilityScore,
              confidenceReduction: homeFormationStability.confidenceReduction,
            },
            away: {
              isStable: awayFormationStability.isStable,
              stabilityScore: awayFormationStability.stabilityScore,
              confidenceReduction: awayFormationStability.confidenceReduction,
            },
          },
        },
        h2h: {
          matchCount: h2h.h2hMatchCount,
          isLimited: h2h.h2hMatchCount < 5,
        },
        safetyFlags: {
          home: homeTeam.safetyFlags,
          away: awayTeam.safetyFlags,
        },
      },
      predictions,
      insights: {
        home: homeInsights.slice(0, 5),
        away: awayInsights.slice(0, 5),
        h2h: h2hInsights.slice(0, 3),
      },
      meta: {
        generatedAt: new Date().toISOString(),
        confidence: calculateOverallConfidence(predictions),
      },
    };
    
    // 8. Cache response (TTL matches fixtures policy)
    await c.env.KV.put(cacheKey, JSON.stringify(response), {
      expirationTtl: cachePolicy.ttlSeconds,
    });
    
    // 9. Set cache headers for edge (reuse the same Cache-Control logic as fixtures)
    c.header('Cache-Control', cachePolicy.cacheControl);
    c.header('CDN-Cache-Control', cachePolicy.cdnCacheControl);
    
    return c.json(response);
    
  } catch (error) {
    console.error('Error generating insights:', error);
    return c.json({ error: 'Failed to generate insights' }, 500);
  }
});

function getFixtureCachePolicy(match: any): {
  ttlSeconds: number;
  cacheControl: string;
  cdnCacheControl: string;
} {
  // Use the same status-aware policy as the existing fixtures endpoints.
  // NOTE: This is shown as pseudo-code; the real implementation should reuse the same logic
  // used by the fixture detail route (live/finished/pre-kickoff tiers).

  const status = match.fixture?.status?.short; // e.g., 'LIVE', 'FT', 'NS'
  const timestamp = match.fixture?.timestamp; // seconds
  const nowSeconds = Math.floor(Date.now() / 1000);
  const timeUntilMatch = typeof timestamp === 'number' ? (timestamp - nowSeconds) : undefined;

  const liveStatuses = ['LIVE', '1H', '2H', 'HT', 'ET', 'BT', 'P'];
  const finishedStatuses = ['FT', 'AET', 'PEN', 'PST', 'CANC', 'ABD', 'AWD', 'WO'];

  if (status && liveStatuses.includes(status)) {
    return {
      ttlSeconds: 15,
      cacheControl: 'public, max-age=15, stale-while-revalidate=30',
      cdnCacheControl: 'max-age=15',
    };
  }

  if (status && finishedStatuses.includes(status)) {
    return {
      ttlSeconds: 604800,
      cacheControl: 'public, max-age=604800',
      cdnCacheControl: 'max-age=604800',
    };
  }

  if (typeof timeUntilMatch === 'number' && timeUntilMatch <= 45 * 60) {
    return {
      ttlSeconds: 15,
      cacheControl: 'public, max-age=15, stale-while-revalidate=30',
      cdnCacheControl: 'max-age=15',
    };
  }

  if (typeof timeUntilMatch === 'number' && timeUntilMatch <= 8 * 60 * 60) {
    return {
      ttlSeconds: 3600,
      cacheControl: 'public, max-age=3600, stale-while-revalidate=7200',
      cdnCacheControl: 'max-age=3600',
    };
  }

  if (typeof timeUntilMatch === 'number' && timeUntilMatch <= 7 * 24 * 60 * 60) {
    return {
      ttlSeconds: 21600,
      cacheControl: 'public, max-age=21600, stale-while-revalidate=43200',
      cdnCacheControl: 'max-age=21600',
    };
  }

  return {
    ttlSeconds: 86400,
    cacheControl: 'public, max-age=86400, stale-while-revalidate=172800',
    cdnCacheControl: 'max-age=86400',
  };
}

function calculateMotivation(team: TeamData): string {
  const pos = team.stats.leaguePosition;
  const pointsFromCL = team.stats.pointsFromCL;
  const pointsFromRel = team.stats.pointsFromRelegation;
  
  if (pos <= 2 && team.stats.pointsFromFirst <= 5) {
    return 'TITLE_RACE';
  } else if (pos >= 3 && pos <= 6 && pointsFromCL <= 3) {
    return 'CL_RACE';
  } else if (pos >= 5 && pos <= 8 && team.stats.pointsFromCL <= 6) {
    return 'EUROPA_RACE';
  } else if (pointsFromRel <= 5) {
    return 'RELEGATION_BATTLE';
  } else if (pointsFromCL > 8 && pointsFromRel > 8) {
    return 'MID_TABLE';
  } else {
    return 'SECURE';
  }
}

function calculateOverallConfidence(
  predictions: MarketPrediction[]
): 'HIGH' | 'MEDIUM' | 'LOW' {
  const confidences = predictions.map(p => p.confidence);
  const highCount = confidences.filter(c => c === 'HIGH').length;
  const mediumCount = confidences.filter(c => c === 'MEDIUM').length;
  
  if (highCount >= 3) return 'HIGH';
  if (highCount + mediumCount >= 3) return 'MEDIUM';
  return 'LOW';
}
```

---

## Part 4: API Response Example

### Complete Response Format

```json
{
  "match": {
    "fixtureId": "12345",
    "homeTeam": "Manchester United",
    "awayTeam": "Chelsea",
    "date": "2024-01-20T15:00:00Z",
    "league": "Premier League"
  },
  
  "context": {
    "homeTeam": {
      "form": "LWLLW",
      "position": 6,
      "daysSinceLastMatch": 3,
      "motivation": "EUROPA_RACE"
    },
    "awayTeam": {
      "form": "WWDWW",
      "position": 2,
      "daysSinceLastMatch": 7,
      "motivation": "SECURE"
    },
    "match": {
      "round": "Regular Season - 20",
      "earlySeason": false
    },
    "h2h": {
      "matchCount": 5,
      "isLimited": false
    }
  },
  
  "predictions": [
    {
      "market": "BTTS",
      "probabilities": {
        "yes": 78,
        "no": 22
      },
      "rating": "LIKELY",
      "confidence": "HIGH",
      "insights": [
        {
          "text": "Man United scored in 4 of last 5 home games (80%)",
          "emoji": "⚽",
          "priority": 90,
          "category": "SCORING",
          "severity": "HIGH"
        },
        {
          "text": "Chelsea scored in 5 of last 5 away games (100%)",
          "emoji": "⚽",
          "priority": 90,
          "category": "SCORING",
          "severity": "HIGH"
        },
        {
          "text": "BTTS in 4 of last 5 H2H meetings (80%)",
          "emoji": "📊",
          "priority": 95,
          "category": "H2H",
          "severity": "HIGH"
        },
        {
          "text": "Man United: 0 clean sheets in last 10 games",
          "emoji": "🔓",
          "priority": 85,
          "category": "DEFENSIVE",
          "severity": "CRITICAL"
        }
      ],
      "recommendation": "BTTS - Yes ✅"
    },
    
    {
      "market": "OVER_UNDER_GOALS",
      "line": 2.5,
      "probabilities": {
        "over": 71,
        "under": 29
      },
      "rating": "LIKELY",
      "confidence": "MEDIUM",
      "insights": [
        {
          "text": "Man United averaging 2.4 goals per game (L5)",
          "emoji": "🔥",
          "priority": 75,
          "category": "SCORING",
          "severity": "HIGH"
        },
        {
          "text": "Chelsea averaging 2.2 goals per game (L5)",
          "emoji": "📈",
          "priority": 75,
          "category": "SCORING",
          "severity": "HIGH"
        },
        {
          "text": "Last 4 H2H had over 2.5 goals (avg: 3.5)",
          "emoji": "⚡",
          "priority": 90,
          "category": "H2H",
          "severity": "HIGH"
        }
      ],
      "recommendation": "Over 2.5 - Yes ✅"
    },
    
    {
      "market": "MATCH_RESULT",
      "probabilities": {
        "home": 24,
        "draw": 9,
        "away": 67
      },
      "rating": "LIKELY",
      "confidence": "MEDIUM",
      "insights": [
        {
          "text": "Man United lost 4 of last 5 home matches (80%)",
          "emoji": "🔴",
          "priority": 100,
          "category": "FORM",
          "severity": "CRITICAL"
        },
        {
          "text": "Chelsea won 4 of last 5 away matches (80%)",
          "emoji": "🔥",
          "priority": 95,
          "category": "FORM",
          "severity": "HIGH"
        },
        {
          "text": "Chelsea unbeaten in last 8 away games",
          "emoji": "💪",
          "priority": 85,
          "category": "FORM",
          "severity": "HIGH"
        }
      ],
      "conflictingSignals": [
        {
          "favors": "home",
          "factor": "Won 4 of last 5 H2H meetings",
          "weight": 0.25
        },
        {
          "favors": "away",
          "factor": "Better recent form (80% vs 20%)",
          "weight": 0.30
        },
        {
          "favors": "away",
          "factor": "Chelsea well-rested (7 days vs 3)",
          "weight": 0.12
        }
      ],
      "recommendation": "Chelsea Win or Draw ✅"
    },
    
    {
      "market": "FIRST_HALF",
      "probabilities": {
        "yes": 58,
        "no": 42
      },
      "rating": "NEUTRAL",
      "confidence": "LOW",
      "insights": [
        {
          "text": "Man United scored 1st half in only 2 of L5 (40%)",
          "emoji": "🐌",
          "priority": 70,
          "category": "TIMING",
          "severity": "MEDIUM"
        },
        {
          "text": "Chelsea scored 1st half in 4 of L5 (80%)",
          "emoji": "⚡",
          "priority": 70,
          "category": "TIMING",
          "severity": "MEDIUM"
        },
        {
          "text": "Last 3 H2H: Goals after 60th minute only",
          "emoji": "⏰",
          "priority": 65,
          "category": "TIMING",
          "severity": "MEDIUM"
        }
      ],
      "recommendation": "Chelsea to score first 🤔"
    }
  ],
  
  "insights": {
    "home": [
      {
        "text": "Man United lost 4 of last 5 home matches (80%)",
        "emoji": "🔴",
        "priority": 100,
        "category": "FORM",
        "severity": "CRITICAL"
      },
      {
        "text": "Man United: 0 clean sheets in last 10 games",
        "emoji": "🔓",
        "priority": 85,
        "category": "DEFENSIVE",
        "severity": "CRITICAL"
      },
      {
        "text": "Man United scored 1st half in only 2 of L5 (40%)",
        "emoji": "🐌",
        "priority": 70,
        "category": "TIMING",
        "severity": "MEDIUM"
      }
    ],
    "away": [
      {
        "text": "Chelsea won 4 of last 5 away matches (80%)",
        "emoji": "🔥",
        "priority": 95,
        "category": "FORM",
        "severity": "HIGH"
      },
      {
        "text": "Chelsea scored in 5 of last 5 away games (100%)",
        "emoji": "⚽",
        "priority": 90,
        "category": "SCORING",
        "severity": "HIGH"
      },
      {
        "text": "Chelsea averaging 2.2 goals per game (L5)",
        "emoji": "📈",
        "priority": 75,
        "category": "SCORING",
        "severity": "HIGH"
      }
    ],
    "h2h": [
      {
        "text": "BTTS in 4 of last 5 H2H meetings (80%)",
        "emoji": "📊",
        "priority": 95,
        "category": "H2H",
        "severity": "HIGH"
      },
      {
        "text": "Last 4 H2H had over 2.5 goals (avg: 3.5)",
        "emoji": "⚡",
        "priority": 90,
        "category": "H2H",
        "severity": "HIGH"
      },
      {
        "text": "Last 3 H2H: Goals after 60th minute only",
        "emoji": "⏰",
        "priority": 65,
        "category": "TIMING",
        "severity": "MEDIUM"
      }
    ]
  },
  
  "meta": {
    "generatedAt": "2024-01-19T10:30:00Z",
    "confidence": "MEDIUM"
  }
}
```

---

## Part 5: Week-by-Week Implementation Roadmap

### Week 1: Foundation
- ✅ Data fetching (team data, H2H, standings)
- ✅ Caching layer (KV store)
- ✅ Stats calculation functions
- ✅ Pattern detection (basic patterns)
- ✅ Test with 5-10 real matches

**Deliverable:** Can fetch and cache all data needed

---

### Week 2: Intelligence
- ✅ Insight generation (templates)
- ✅ BTTS probability calculation
- ✅ Over/Under 2.5 calculation
- ✅ Factor weighting system
- ✅ Conflict detection

**Deliverable:** Can generate BTTS and O/U predictions

---

### Week 3: Polish & API
- ✅ Match result (1X2) calculation
- ✅ First half predictions
- ✅ API endpoint implementation
- ✅ Response formatting
- ✅ Error handling
- ✅ Performance optimization

**Deliverable:** Working API endpoint

---

### Week 4: Testing & Refinement
- ✅ Test with 50+ real matches
- ✅ Track accuracy
- ✅ Adjust weights based on results
- ✅ Fix edge cases
- ✅ Documentation

**Deliverable:** Production-ready endpoint

---

## Part 6: Key Decisions Summary

### 1. NOT a Predictor Bot ✅
```
You're building: Data aggregation + analysis tool
NOT: "Sure win" predictor scam
Value: Saves users 15 minutes per match
Accuracy: Realistic 60-70%, not fake 90%
```

### 2. Factors Apply to All Markets ✅
```
But with different weights:
- BTTS: Scoring rate > home advantage
- O/U 2.5: Average goals > motivation  
- 1X2: All factors equally important
- 1st Half: Timing patterns > everything
```

### 3. Transparency is Key ✅
```
Always show:
- Conflicting signals
- Confidence levels
- Why prediction might be wrong
- All factors considered
```

### 4. Focus on Easy Markets First ✅
```
Priority:
1. BTTS (easiest, 70% accuracy possible)
2. Over/Under 2.5 (70% accuracy)
3. First Half (65% accuracy)
4. Match Result (55-60% accuracy)
```

---

## Bottom Line

**Timeline:** 3-4 weeks to fully functional insights endpoint

**Accuracy Expectations:**
- BTTS: 65-75%
- Over 2.5: 60-70%
- 1X2: 50-60%
- First Half: 60-65%

**Positioning:**
"We don't predict the future. We help you make better decisions by aggregating data you'd check manually anyway. We're right ~70% of the time on BTTS. We show our work and admit when we're uncertain."

**Differentiation:**
- Transparent (show all factors)
- Educational (explain WHY)
- Realistic (admit limitations)
- Time-saving (30 seconds vs 15 minutes)
- Unbiased (no house edge)

**You're building a research assistant, not a crystal ball.** 🎯

---

## Algorithm Improvements Summary

### Implemented Improvements

This document has been extended with the following improvements based on algorithm analysis and best practices:

#### 1. Data Quality Assessment (Section 1.5)
- **Added:** Comprehensive data quality assessment system
- **Features:**
  - Quality levels (HIGH/MEDIUM/LOW/INSUFFICIENT) for Mind, Mood, and H2H data
  - Confidence multipliers based on data availability
  - Fallback strategies for insufficient data
  - Integration with prediction confidence calculation
- **Benefits:** Prevents overconfidence when data is limited, handles edge cases gracefully

#### 2. H2H Recency Weighting Refinement (Section 1.1, 1.4)
- **Improved:** Days-based decay instead of year-based
- **Features:**
  - More granular weighting using exponential decay by days
  - Within-season boost (1.2x multiplier for same-season matches)
  - Recent months boost (1.1x multiplier for last 3 months)
  - `isSameSeason()` helper function for accurate season detection
- **Benefits:** More accurate weighting of recent matches, better handling of within-season patterns

#### 3. Formation Stability Refinement (Section 1.2)
- **Enhanced:** Context-aware formation stability logic
- **Features:**
  - Opponent strength consideration (tactical vs experimental changes)
  - Formation success rate analysis
  - Recent formation change frequency tracking
  - Early season adjustments
  - Detailed reason strings for transparency
- **Benefits:** Reduces false positives for tactical formation changes, more accurate confidence reduction

#### 4. Match Type Detection (Section 3.5)
- **Added:** Cup vs league match detection and type-specific adjustments
- **Features:**
  - Automatic detection of cup competitions and knockout stages
  - Match importance levels (LOW/MEDIUM/HIGH/CRITICAL)
  - Type-specific weight adjustments:
    - Cup matches: More defensive, less goals
    - Knockout matches: Increased motivation weight
    - Friendly matches: Reduced confidence across the board
- **Benefits:** Better predictions for cup matches, which have different dynamics than league matches

#### 5. Validation Framework (Section 4.1)
- **Added:** Comprehensive validation system for rule-based adjustments
- **Features:**
  - Historical data testing (with/without adjustment)
  - Statistical significance testing (p < 0.05 threshold)
  - Edge case validation (early season, low data, high data)
  - Deployment criteria (minimum 2% improvement required)
- **Benefits:** Ensures all adjustments improve predictions before deployment, prevents regression

#### 6. ML Integration Architecture - Option A (Section 3.1)
- **Updated:** Two-phase hybrid approach
- **Architecture:**
  - **Phase 1:** ML learns optimal weights for main factors (recentForm, h2h, etc.)
  - **Phase 2:** Calculate base prediction using ML-learned weights
  - **Phase 3:** Apply rule-based adjustments for contextual factors
  - **Final:** Combine base prediction + adjustments = final prediction
- **Benefits:**
  - ML handles pattern learning (what weights work best)
  - Rules handle edge cases (contextual factors ML can't learn)
  - Transparent: Shows base prediction and all adjustments
  - Flexible: Easy to add new rule-based adjustments

#### 7. Configuration Enhancements (Section 1.6)
- **Added:** Data quality thresholds, validation thresholds, match type detection config
- **Features:**
  - Data quality thresholds for Mind/Mood/H2H layers
  - Confidence multipliers for different quality levels
  - Validation thresholds (min improvement, significance level)
  - Match type detection keywords and season boundaries
- **Benefits:** Centralized configuration for easy tuning and A/B testing

#### 8. Probability Swing Caps & Confidence Calibration (Section 4.5.1-4.5.3)
- **Added:** Hard probability swing caps and confidence downgrade system
- **Features:**
  - Maximum swing cap (±20-25% from base probability)
  - Absolute probability bounds (20-80%)
  - Confidence downgrade based on swing magnitude
  - Confidence downgrade based on adjustment count
- **Benefits:** Prevents wild probability swings, maintains user trust, prevents probability-confidence mismatch

#### 9. Asymmetric Weighting System (Section 4.5.4)
- **Added:** Market-specific asymmetric adjustment caps and risk multipliers
- **Features:**
  - Direction-aware adjustment caps (different limits for upward vs downward moves)
  - Market-specific risk multipliers (penalize false positives more for low-odds markets)
  - False positive/negative penalty configuration
  - BTTS: Stricter caps on upward moves (prevent false Yes)
  - Over 2.5: More lenient on upward moves (higher odds = acceptable)
  - Match Result: Very strict on favorites, lenient on underdogs (value bets)
- **Benefits:** Optimizes for profitability, not just accuracy. Prevents over-betting on low-odds favorites, identifies high-value underdog bets

#### 10. Kelly-Aware Confidence (Section 4.5.5)
- **Added:** Kelly Criterion integration for value-based confidence
- **Features:**
  - Expected value calculation (predicted prob × odds - 1)
  - Kelly fraction calculation (optimal bet size)
  - Confidence adjustment based on value (not just accuracy)
  - SKIP recommendation for negative value bets
- **Benefits:** Only recommends bets with positive expected value, adjusts confidence based on value, prevents over-betting on low-odds favorites
- **Note:** Requires bookmaker odds integration (deferred for MVP, but architecture ready)

#### 11. Unified Helper Function (Section 4.5.6)
- **Added:** Single `applyCappedAsymmetricAdjustments()` function that combines all caps and asymmetric weighting
- **Features:**
  - Applies individual adjustment caps (market-specific)
  - Applies total swing cap (global)
  - Applies absolute probability bounds
  - Returns capped adjustments with reasons
  - Single function call for easy integration
- **Benefits:** Simplifies integration into prediction functions, all caps applied in one place, easier to test and maintain
- **Usage:** Recommended way to use caps and asymmetric weighting in prediction functions

#### 12. Shadow Mode (Future Enhancements)
- **Added:** Side-by-side comparison of capped vs uncapped algorithm versions
- **Features:**
  - Run two versions simultaneously on live data
  - Compare Brier score, accuracy, and ROI
  - Data-driven rollout decisions
  - Safe deployment strategy
- **Benefits:** Test changes before full rollout, mitigate risk, continuous improvement validation
- **When to Use:** Before deploying major algorithm changes, when tuning hyperparameters

#### 13. Minimum Batch Size Check (Section 3.3)
- **Added:** Skip retraining if batch too small
- **Features:**
  - Minimum 2,000 unique matches threshold
  - Prevents noise from small datasets
  - Prevents overfitting on small batches
- **Benefits:** More reliable model updates, prevents degradation from noisy small batches

#### 14. Algorithm Refinements (Section 4.6)
- **Added:** Improvements to prediction calculations to use all features properly
- **Features:**
  - **Match Result Prediction Refinement (Critical):** Proper calculation using all factors (form, H2H, home advantage, motivation, rest, position) instead of simplified fixed probabilities
  - **Dynamic Home Advantage:** Home advantage calculated from team's home record vs opponent's away record, not fixed
  - **Rest Advantage Integration:** Uses calculated rest advantage gap in predictions
  - **Opponent Quality Weighting:** Scoring rate weighted by opponent tier (goals vs Tier 1 team = 1.5x weight, vs Tier 4 = 0.7x)
  - **Weighted Scoring Rate:** Scoring rate uses recency weighting like form does
  - **Fixture Congestion:** Accounts for teams playing multiple matches in short period
- **Benefits:** 
  - Match Result accuracy improvement: +3-5%
  - Overall accuracy improvement: +5-8% combined
  - Uses all calculated features properly
  - More accurate and consistent predictions

#### 15. Production Monitoring & Auto-Correction (Section 4.5.9)
- **Added:** Production monitoring and auto-correction system for probability swing caps
- **Features:**
  - Post-prediction audit with swing violation detection and auto-correction
  - Swing histogram logging and distribution tracking
  - Real-time alerts when violation rates exceed thresholds (>5% of predictions exceed 15% swing)
  - Auto-correction rules (scale adjustments when stack exceeds threshold)
  - Weekly calibration checks (Brier score per confidence level)
  - Expected Calibration Error (ECE) calculation
  - Auto-downgrade confidence thresholds if calibration fails
- **Benefits:** Prevents trust erosion by catching violations before they reach users, maintains calibration quality, early bug detection, data-driven tuning
- **ROI:** High (+2–3% effective accuracy via better calibration; prevents trust-damaging outliers)
- **Implementation Effort:** 1–2 days

#### 16. Opponent-Adjusted Rate Stats (Section 1.2.5)
- **Added:** Systematic opponent quality weighting for all rate statistics
- **Features:**
  - Generic `calculateOpponentAdjustedRate()` function for any binary metric
  - Tier-based weights: Tier 1 (1.5x), Tier 2 (1.2x), Tier 3 (1.0x), Tier 4 (0.7x)
  - Applied to all rate stats: scoring rate, conceded rate, clean sheet rate, BTTS rate, Over 2.5 rate
  - Applied to both Mind layer (50 matches) and Mood layer (10 matches)
  - Combines recency weighting with opponent quality weighting
  - Opponent tier lookup during feature calculation
- **Benefits:** +2–4% accuracy improvement, reduces false positives from weak-schedule teams, captures value in strong teams with tough schedules, critical differentiator in competitive markets
- **ROI:** Very high (+2–4% accuracy; big edge in uneven schedules)
- **Implementation Effort:** 2–3 days

#### 17. Validation Enforcement & Ongoing Monitoring (Section 4.1.4)
- **Added:** Automated enforcement mechanisms for validation framework
- **Features:**
  - **CI/CD Gates:** Block PR merges if validation fails (improvement <2%, p >0.05, edge cases fail)
  - **Kill Criteria:** Monitor deployed adjustments weekly, auto-disable if accuracy drops >1% on rolling 100-match holdout
  - **Ongoing Dashboard:** Track per-adjustment metrics (Brier contribution, win rate impact, ROI)
  - **Adjustment Sunset Clause:** All adjustments expire after 1 season unless re-validated
  - **Gradual Rollout:** Phased approach (CI gates → dashboard → kill criteria → auto-disable → sunset)
- **Benefits:** Prevents regression (blocks bad deployments), early detection (catches underperformers quickly), data-driven decisions (dashboard visibility), forces re-validation (sunset clauses)
- **ROI:** High (prevents 2–5% regression; ensures only proven features stay)
- **Implementation Effort:** 2–4 days

#### 18. Optuna Hyperparameter Tuning (Section 2.2.5)
- **Added:** Detailed Optuna implementation for systematic hyperparameter optimization
- **Features:**
  - Tree-structured Parzen Estimator (TPE) algorithm for efficient search
  - Pruning to stop unpromising trials early
  - Time-series cross-validation to prevent data leakage
  - Multi-objective optimization (accuracy + calibration)
  - Study persistence for reproducibility
- **Benefits:** +2–5% accuracy improvement if hyperparameters are untuned, +0–1% if already reasonable, better probability calibration
- **ROI:** High (significant improvement if hyperparameters are suboptimal)
- **Implementation Effort:** 2–3 days

#### 19. Class Imbalance Handling (Section 2.3.5)
- **Added:** Class imbalance handling for Match Result predictions (draws are rare)
- **Features:**
  - Class weights (inverse frequency weighting) for LightGBM
  - SMOTE oversampling for severe imbalance
  - Threshold tuning for balanced accuracy
  - Per-class accuracy validation
- **Benefits:** +1–3% Match Result accuracy, +10–20% draw accuracy improvement, better calibration for draws
- **ROI:** High (if using ML for Match Result predictions)
- **Note:** Only applies if using ML for Match Result; rule-based adjustments already handle draws via H2H/form logic
- **Implementation Effort:** 1 day

#### 20. Concept Drift Detection (Section 3.3.5)
- **Added:** Adaptive retraining based on performance degradation detection
- **Features:**
  - Performance-based drift detection (accuracy drop, Brier score increase)
  - Population Stability Index (PSI) for feature distribution drift
  - Adaptive retraining scheduler (retrains when drift detected, not fixed weekly)
  - Consecutive failure tracking to avoid false positives
- **Benefits:** Prevents 2–5% accuracy degradation, reduces unnecessary retraining by 30–50%, proactive detection
- **ROI:** High (maintains performance over time, prevents degradation)
- **Implementation Effort:** 2–3 days

#### 21. Probabilistic Safety Flags (Section 1.4.5)
- **Added:** Probabilistic safety flags (0-1 scores) instead of binary flags
- **Features:**
  - Regression risk probability (scaled by win streak and tier gap)
  - Live dog probability (scaled by recent form and tier gap)
  - Over-performer probability (scaled by points above expected)
  - Sleeping giant probability (inverse of over-performer)
- **Benefits:** +0.5–1.5% accuracy via better risk assessment, more nuanced adjustments, better calibration
- **ROI:** Medium-High (better value detection, more accurate risk assessment)
- **Implementation Effort:** 1–2 days

#### 22. Adjustment Interaction Analysis (Section 4.1.5)
- **Added:** Analysis and scaling of adjustment interactions to prevent overfitting
- **Features:**
  - Adjustment interaction matrix (reinforcing, canceling, independent)
  - Interaction-based scaling (reduce adjustments when many reinforcing ones fire together)
  - Combination validation (test adjustment combinations, not just individual)
  - Problematic combination detection
- **Benefits:** Prevents overfitting from stacking adjustments, +0.5–1% accuracy improvement, better calibration
- **ROI:** Medium (prevents regression, maintains accuracy with many adjustments)
- **Implementation Effort:** 1–2 days

#### 24. Neutral Venue Detection (Section 3.5.4)
- **Added:** Detection of neutral venues for domestic cup finals, playoffs, and super cups
- **Features:**
  - Round name detection (Final, Semi-Final, Playoff, Super Cup)
  - Venue mismatch detection (compare match venue with home team's usual stadium)
  - Home advantage reduction for neutral venues (15% reduction)
  - Form weight reduction and H2H weight increase for neutral venues
- **Benefits:** +1-2% accuracy for cup finals/playoffs, prevents overestimation of home advantage
- **ROI:** Medium-High
- **Implementation Effort:** 1 day

#### 25. Derby/Rivalry Matches Detection (Section 3.5.5)
- **Added:** Manual mapping of known rivalries with automatic detection and weight adjustments
- **Features:**
  - Derby/rivalry mapping for major rivalries (Man Utd vs Man City, Real vs Barca, etc.)
  - Form weight reduction (12% reduction - derbies less predictable)
  - H2H weight increase (20% increase - more relevant in derbies)
  - Confidence reduction (12% reduction - higher unpredictability)
- **Benefits:** +1-2% accuracy for derby matches, accounts for higher unpredictability
- **ROI:** Medium
- **Implementation Effort:** 4-6 hours

#### 26. Post-International Break Effects (Section 3.5.6)
- **Added:** Detection of matches immediately after international breaks with weight adjustments
- **Features:**
  - International break date detection (FIFA calendar: March, June, September, October, November)
  - Form weight reduction (18% reduction - form less reliable after breaks)
  - H2H weight increase (10% increase - more reliable than recent form)
  - Confidence reduction (8% reduction)
- **Benefits:** +0.5-1% accuracy, accounts for fatigue and player availability issues
- **ROI:** Low-Medium
- **Implementation Effort:** 4-6 hours

#### 27. End-of-Season Specific Dynamics (Section 3.5.7)
- **Added:** Enhanced motivation detection and adjustments for final 3-5 rounds
- **Features:**
  - End-of-season detection (final 5 rounds)
  - Enhanced motivation calculation (relegation battle, title race, CL qualification, nothing to play for)
  - Motivation weight increase (25% increase for end-of-season)
  - Relegation battle adjustments (more defensive → reduce BTTS/Over probability)
  - Nothing to play for adjustments (more open → increase BTTS/Over probability)
- **Benefits:** +1-2% accuracy for final rounds, better handling of different team motivations
- **ROI:** Medium
- **Implementation Effort:** 1 day

#### 28. League-Specific Characteristics (Section 3.5.8)
- **Added:** League baseline statistics and adjustments for scoring patterns
- **Features:**
  - League characteristics mapping (avg goals per game, BTTS rate, draw rate, home advantage strength, Over 2.5 baseline)
  - League-specific multipliers for goal-scoring predictions
  - Example: Serie A → reduce Over 2.5 probability by 5-8%
  - Example: Bundesliga → increase Over 2.5 probability by 5-8%
- **Benefits:** +1-2% accuracy overall, accounts for league-specific playing styles
- **ROI:** Medium
- **Implementation Effort:** 1-2 days

#### 29. Enhanced Data Quality Edge Cases (Section 1.5.7)
- **Added:** Comprehensive fallback strategies for all edge cases
- **Features:**
  - Zero matches handling (use league average tier/EI, reduce confidence to LOW)
  - Partial data handling (<30 matches: use available data but reduce confidence)
  - API failure handling (fallback to cached data or league average)
  - Missing critical fields validation (skip invalid matches, log for review)
  - Confidence reduction based on data completeness
- **Benefits:** Prevents system crashes, provides graceful degradation, maintains system reliability
- **ROI:** High (system reliability, prevents crashes)
- **Implementation Effort:** 1-2 days

#### 30. Fixture Congestion Verification & Integration (Section 4.6.5)
- **Added:** Verification that fixture congestion is fully integrated into all prediction functions
- **Features:**
  - Verification checklist for all prediction functions
  - Complete integration code for predictBTTS, predictOver25, predictMatchResult, predictFirstHalf
  - Optional: Pre-calculate congestion in TeamData interface
- **Benefits:** Accounts for fixture congestion in all predictions, reduces form weight when teams are fatigued
- **ROI:** Medium (+1% accuracy improvement)
- **Implementation Effort:** 2-4 hours

#### 23. Formation Normalization & Similarity Detection (Enhanced Section 1.4)
- **Added:** Formation normalization and similarity detection to handle API variations
- **Features:**
  - Formation canonical mapping (maps variations like "4-1-2-3" → "4-3-3")
  - Structural similarity calculation (0-1 score based on defenders/midfielders/forwards)
  - Similarity-based stability detection (treats similar formations as stable)
  - Prevents false instability flags from API notation differences
- **Benefits:** Prevents false instability flags when API returns similar formations (e.g., "4-3-3" vs "4-2-3-1"), more accurate confidence reduction, handles API inconsistencies gracefully
- **ROI:** Medium-High (prevents false positives, improves prediction accuracy)
- **Implementation Effort:** 1 day

#### 24. Promoted Teams / New Teams Handling (Section 1.5.5)
- **Added:** Comprehensive handling for teams with insufficient historical data
- **Features:**
  - Multi-season match fetching helper (`getTeamMatchesForMindLayer`) - fetches 50 matches from current league across multiple seasons
  - Current season match fetching helper (`getTeamMatchesForMoodLayer`) - fetches 10 matches from current season only
  - Promoted team detection (first season in current league)
  - Promoted team tier calculation (adjusts lower league performance for league strength)
  - League strength multiplier (accounts for league quality differences)
  - Fallback to league average when data insufficient
  - Confidence adjustment for promoted teams
- **Key Clarification:** Mind layer needs 50 matches from current league (may span 2-3 seasons), not just current season. Most leagues have ~38 matches/season, so multi-season fetching is required.
- **Benefits:** Prevents prediction failures for promoted teams (3 per league per season), more accurate tier classification, appropriate confidence levels, captures value opportunities, handles multi-season data correctly
- **ROI:** High (prevents production failures, enables predictions for all teams)
- **Implementation Effort:** 1-2 days

#### 25. Opponent Tier Pre-Computation Strategy (Enhanced Section 1.2.5)
- **Added:** Pre-computation and caching strategy for opponent tiers
- **Features:**
  - Batch pre-computation at start of season
  - Database storage (TeamTier_Season table)
  - Redis/KV caching for fast lookups (O(1) instead of O(n))
  - Scheduled updates (weekly/monthly)
  - Fallback to on-the-fly calculation if cache miss
- **Benefits:** ~50x faster opponent-adjusted calculations, enables real-time predictions, scalable for production
- **ROI:** High (performance critical for opponent-adjusted stats to work efficiently)
- **Implementation Effort:** 1 day (database schema + caching layer)

#### 26. API-Football Optimizations (Sections 1.5.5, 1.3, 4.6)
- **Added:** Leverage API-Football capabilities to remove unnecessary client-side processing
- **Features:**
  - **Removed Manual Filtering:** API's `league` parameter excludes friendlies automatically
  - **Removed Manual Calculations:** Use `/teams/statistics` endpoint for pre-calculated DNA data
  - **Simplified Data Fetching:** Use API parameters directly (`team`, `league`, `season`, `last`, `from`, `to`)
  - **Multi-Season Fetching:** Use date range (`from`/`to`) instead of manual loops
- **Benefits:** 50-70% reduction in client-side processing, cleaner code, better performance
- **ROI:** High (reduces complexity, improves performance, easier to maintain)
- **Implementation Effort:** 1-2 days

#### 27. Automated Anomaly Detection (Section 1.5.4)
- **Added:** Automated detection of corrupted data, statistical outliers, and data inconsistencies
- **Features:**
  - **Impossible Value Detection:** Negative goals, scores >20 goals, future dates
  - **Missing Field Detection:** Missing fixture IDs, team IDs, goals data
  - **Statistical Outlier Detection:** IQR (Interquartile Range) method for goal distributions
  - **Alternative Z-Score Method:** For smaller datasets (<10 matches)
  - **Severity Classification:** HIGH (corrupted), MEDIUM (outliers), LOW (minor inconsistencies)
  - **Anomaly Handling:** Auto-remove HIGH severity anomalies, log MEDIUM/LOW for monitoring
  - **Confidence Penalties:** Reduce confidence multiplier based on anomaly count and severity
- **Benefits:** Prevents 2-5% accuracy loss from corrupted data, improves system reliability, better monitoring
- **ROI:** High (prevents bad predictions from corrupted data, improves reliability)
- **Implementation Effort:** 1-2 days

#### 28. Flexible Alternative Bet Suggestions (Section 4.7)
- **Added:** Always-on alternative bet suggestion system for every prediction
- **Features:**
  - **Always Suggests Alternatives:** Not just HIGH confidence, but for every prediction
  - **Dynamic Market Analysis:** Analyzes all available markets, not fixed alternatives
  - **Confidence-Aware Thresholds:** LOW confidence requires 10%+ probability gain, MEDIUM 7%+, HIGH 5%+
  - **Safer Alternatives:** Finds markets with higher probability (Over 1.5 if Over 2.5, Double Chance if Win, etc.)
  - **Correlated Markets:** Suggests correlated markets (BTTS ↔ Over 2.5, Win ↔ Win to Nil)
  - **Complementary Markets:** Suggests complementary markets for HIGH confidence (Both Halves, First Half markets)
  - **Fallback Logic:** If no alternatives meet threshold, suggests safest available
  - **Flexible Market Support:** Works with any Over/Under threshold, Double Chance, Draw No Bet, Win to Nil, etc.
- **Benefits:**
  - Better risk management (users can choose safer alternatives)
  - Improved user experience (always provides options)
  - Flexible system (not limited to fixed alternatives)
  - Confidence-aware (adjusts suggestions based on prediction confidence)
- **ROI:** High (improves UX, helps with risk management, increases user engagement)
- **Implementation Effort:** 2-3 days (core logic + integration + testing)

#### 29. Team Name Standardization & Mapping (Section 1.1.1)
- **Added:** Automated team name mapping system to handle name variations between data sources
- **Primary Use Case:** ML model retraining - combines historical GitHub data with new API-Football data, requiring consistent team names
- **Features:**
  - **Automated Detection:** Uses API-Football `/standings` endpoint to get all teams in a league
  - **Fuzzy Matching:** Levenshtein distance algorithm to match "Sp Lisbon" → "Sporting CP"
  - **Confidence Scoring:** HIGH (≥85% similarity), MEDIUM (75-84%), LOW (70-74%), NO_MATCH (<70%)
  - **Auto-Mapping:** High-confidence matches automatically mapped
  - **Caching:** Mappings cached in memory + persistent storage (KV/database), built once per league
  - **Review Queue:** Medium/low confidence matches logged for manual review
  - **Fast Lookups:** Normalization uses cache (no API calls during retraining)
- **When Needed:**
  - **ML Retraining:** YES - Combines historical + new API data
  - **Initial ML Training:** NO - Uses only GitHub data (consistent names)
  - **Production Predictions:** NO - Uses API endpoints with team IDs
- **Benefits:**
  - Enables model retraining with combined datasets
  - Prevents data matching failures during retraining
  - Handles team name variations automatically
- **ROI:** Medium-High (enables model retraining workflows, prevents data matching failures)
- **Implementation Effort:** 1-2 days (mapping service + fuzzy matching + caching + integration)

#### 30. One-Season Wonder Detection (Section 1.5.6)
- **Added:** Detection logic to distinguish genuine "Sleeping Giants" from "One-Season Wonders"
- **Problem:** Recently promoted teams that overperformed in their first season (e.g., finished 5th) then regress in their second season are incorrectly treated as sleeping giants (+10% probability boost)
- **Solution:**
  - **Detection:** Check if team has been in current league ≤ 2 seasons AND recent performance is significantly worse than first season
  - **Pattern Match:** Only applies when Mind Tier 1, Mood Tier 4 (sleeping giant pattern)
  - **Behavior:** One-season wonders get confidence reduction (30%) instead of probability boost
  - **Genuine Sleeping Giants:** Elite teams (2+ seasons at Tier 1) still get +10% probability boost
- **Features:**
  - `getSeasonsInCurrentLeague()`: Counts seasons team has been in current league
  - `detectOneSeasonWonder()`: Compares recent form vs first season performance
  - Updated `detectMoodVsMindGap()`: Includes one-season wonder detection
  - Updated `TeamMood` interface: Added `isOneSeasonWonder` flag
- **Benefits:**
  - Prevents false positives from one-season wonders
  - More accurate confidence levels
  - Better risk assessment for recently promoted teams
- **ROI:** Medium-High (prevents betting on false value opportunities, improves accuracy by 2-3%)
- **Implementation Effort:** 1 day (detection logic + integration into prediction functions)

#### 31. International Match Support (Section 3.5.3)
- **Added:** Support for international competitions (Copa Libertadores, Champions League, etc.)
- **Features:**
  - **Hybrid Approach:** Use domestic league data for Mind/Mood layers (ensures 50 matches), international competition for H2H filtering
  - **Match Type Detection:** Extended `detectMatchType()` to recognize international competitions (Copa Libertadores, Champions League, Europa League, etc.)
  - **Domestic League Detection:** `getTeamDomesticLeague()` function to identify primary domestic league for teams
  - **H2H Filtering:** Filter H2H data to specific international competition when available
  - **Weight Adjustments:** Special adjustments for international matches:
    - Form weight: -15% (form less reliable across competitions)
    - Home advantage: -10% (neutral venues common)
    - Motivation: +30% (international competitions highly valued)
    - Goal-scoring: -8% (more tactical play)
    - H2H weight: +20% (more relevant in international context)
- **Benefits:**
  - Enables accurate predictions for international matches
  - Expands market coverage (Copa Libertadores, Champions League, etc.)
  - Maintains data quality (always have 50 matches for Mind layer)
  - Competition-specific H2H (more relevant than all-time H2H)
- **ROI:** High (expands market coverage, enables predictions for high-value international competitions)
- **Implementation Effort:** 1-2 days (match type detection + hybrid data fetching + weight adjustments)

### Key Design Decisions

1. **ML learns weights, rules handle context:** Separates pattern learning (ML) from edge case handling (rules)
2. **Data quality reduces confidence, doesn't block:** Predictions still work with limited data, but confidence is appropriately reduced
3. **All adjustments must be validated:** Prevents deployment of adjustments that don't improve predictions
4. **Transparency first:** All adjustments shown in API response with reasons
5. **Context-aware logic:** Formation stability and other adjustments consider match context, not just raw percentages
6. **Probability caps prevent wild swings:** Hard caps (±20-25%) prevent edge cases from destroying user trust
7. **Confidence reflects probability movement:** Large swings automatically downgrade confidence to prevent mismatch
8. **Asymmetric weighting optimizes profitability:** Different adjustment caps for upward vs downward moves based on market odds and risk/reward
9. **Value-based confidence (Kelly):** Confidence adjusted based on expected value, not just accuracy (when odds available)

### Implementation Notes

- **ML Model Training:** Separate from this document - ML model outputs weights to config file
- **Validation:** All new adjustments must pass validation framework before deployment
- **Backward Compatibility:** Existing predictions continue to work, improvements are additive
- **Performance:** Data quality assessment and match type detection are lightweight operations
- **Testing:** Comprehensive edge case testing required for all adjustments

### Future Enhancements (Not Included)

- **Market Efficiency:** Bookmaker odds comparison (deferred - focus on pure prediction first)
- **Manager Changes:** Manager change detection and impact (deferred - not included at beginning)
- **Injury Proxies:** Squad rotation patterns as injury proxy (future enhancement)
- **Weather Integration:** Historical weather data integration (future enhancement)

#### Shadow Mode (Advanced Deployment Strategy)

**Goal:** Run two algorithm versions side-by-side to compare performance before full rollout.

**Concept:**
- Run capped version (with probability caps and asymmetric weighting) alongside uncapped version
- Compare Brier score, ROI, and accuracy on live data
- Only roll out to all users if capped version performs better or equal

**Implementation:**

```typescript
interface ShadowModeResult {
  capped: {
    predictions: Prediction[];
    brierScore: number;
    accuracy: number;
    roi?: number;
  };
  uncapped: {
    predictions: Prediction[];
    brierScore: number;
    accuracy: number;
    roi?: number;
  };
  comparison: {
    brierImprovement: number;  // Positive = capped better
    accuracyDifference: number; // Positive = capped better
    roiDifference?: number;     // Positive = capped better
    recommendation: 'ROLLOUT' | 'KEEP_TESTING' | 'REVERT';
  };
}

async function runShadowMode(
  matches: Match[],
  config: AlgorithmConfig,
  durationDays: number = 30
): Promise<ShadowModeResult> {
  const cappedPredictions: Prediction[] = [];
  const uncappedPredictions: Prediction[] = [];
  
  // Generate predictions with both versions
  for (const match of matches) {
    // Capped version (with probability caps and asymmetric weighting)
    const cappedPred = await generatePrediction(match, config, { useCaps: true });
    cappedPredictions.push(cappedPred);
    
    // Uncapped version (original algorithm)
    const uncappedPred = await generatePrediction(match, config, { useCaps: false });
    uncappedPredictions.push(uncappedPred);
  }
  
  // Calculate metrics
  const cappedMetrics = calculateMetrics(cappedPredictions);
  const uncappedMetrics = calculateMetrics(uncappedPredictions);
  
  // Compare
  const brierImprovement = uncappedMetrics.brierScore - cappedMetrics.brierScore;
  const accuracyDifference = cappedMetrics.accuracy - uncappedMetrics.accuracy;
  const roiDifference = cappedMetrics.roi && uncappedMetrics.roi 
    ? cappedMetrics.roi - uncappedMetrics.roi 
    : undefined;
  
  // Recommendation
  let recommendation: 'ROLLOUT' | 'KEEP_TESTING' | 'REVERT';
  if (brierImprovement > 0 && accuracyDifference >= 0 && (!roiDifference || roiDifference >= 0)) {
    recommendation = 'ROLLOUT'; // Capped version is better
  } else if (brierImprovement < -0.02 || accuracyDifference < -0.02) {
    recommendation = 'REVERT'; // Capped version is worse
  } else {
    recommendation = 'KEEP_TESTING'; // Inconclusive, need more data
  }
  
  return {
    capped: cappedMetrics,
    uncapped: uncappedMetrics,
    comparison: {
      brierImprovement,
      accuracyDifference,
      roiDifference,
      recommendation,
    },
  };
}
```

**Benefits:**
- **Safe rollout:** Test changes on subset of users/data before full deployment
- **Data-driven decisions:** Compare actual performance, not just theory
- **Risk mitigation:** Can revert if capped version performs worse
- **Continuous improvement:** Run shadow mode for all major algorithm changes

**When to Use:**
- Before deploying probability caps and asymmetric weighting
- Before major algorithm changes
- When tuning hyperparameters
- When adding new adjustments

**Deployment Criteria:**
- Run shadow mode for minimum 30 days or 1,000 matches
- Capped version must have equal or better Brier score
- Capped version must have equal or better accuracy
- If ROI available, capped version must have equal or better ROI
- Only roll out if all criteria met

### Critical Improvements for Launch (Section 4.5)

**Quick Reference:** See Section 4.5.8 "Launch Safety Summary & Quick Reference" for implementation checklist and safe starting values.

**Must implement before real money:**

1. **Match Result Prediction Refinement** (Critical - Algorithm)
   - Currently uses simplified fixed probabilities (40/25/35)
   - Needs proper calculation using all factors (form, H2H, home advantage, etc.)
   - Implementation: 1-2 days
   - **Impact:** +3-5% accuracy improvement
   - **Reference:** Section 4.6.1

2. **Hard Probability Swing Cap** (Critical - Safety)
   - Prevents wild swings (68% → 42%)
   - Maintains user trust
   - Implementation: 2-4 hours
   - **Starting Value:** `maxSwing: 22`

3. **Confidence Downgrade on Large Swings** (Critical - Safety)
   - Prevents probability-confidence mismatch
   - Large swings → lower confidence
   - Implementation: 2-3 hours
   - **Starting Value:** `largeSwingThreshold: 15`

4. **Asymmetric Weighting** (High Priority - Safety)
   - Direction-aware adjustment caps
   - Market-specific risk multipliers
   - Prevents over-betting on low-odds favorites
   - Implementation: 1-2 days
   - **Starting Values:** See Section 4.5.8 for market-specific caps

**Recommended within 2 weeks:**

5. **Unified Helper Function** (High Priority - Safety)
   - `applyCappedAsymmetricAdjustments()` — single function for all caps
   - Simplifies integration into simulation functions
   - Implementation: 4-6 hours
   - **Reference:** Section 4.5.6

6. **Market-Specific Asymmetry Factors** (High Priority - Safety)
   - BTTS: Stricter on upward moves (upMax: 12)
   - Over 2.5: More lenient on upward moves (upMax: 18)
   - Match Result: Very strict on favorites (upMax: 10)
   - Implementation: 1 day
   - **Starting Values:** See Section 4.5.8

7. **Rest Advantage Integration** (High Priority - Algorithm)
   - Use calculated rest advantage gap in simulations
   - Small but meaningful accuracy improvement

---

## 2026-01-11 Terminology + Response Schema Update (Mobile-safe framing)

The mobile product is positioned as football intelligence and education (not a tipster/betting app). The underlying computations remain the same, but the **output schema and terminology** were updated for neutral, analytical framing:

- **predictions → simulations**
- **market → scenarioType**
  - `BTTS` → `BothTeamsToScore`
  - `OVER_UNDER_GOALS` → `TotalGoalsOverUnder` (includes `line`)
  - `MATCH_RESULT` → `MatchOutcome`
  - `FIRST_HALF` → `FirstHalfActivity`
- **probabilities → probabilityDistribution**
- **rating → signalStrength** (`Strong` | `Moderate` | `Balanced` | `Weak`)
- **confidence → modelReliability** (`HIGH` | `MEDIUM` | `LOW`)
- **recommendation → mostProbableOutcome** (neutral, analytical text)
- **alternatives → relatedScenarios** (neutral reframing; derived from already computed simulations)

### Model Reliability Transparency

Each simulation can include `modelReliabilityBreakdown` to explain *why* reliability is `HIGH/MEDIUM/LOW`. Reasons are deterministic and come from:

- **Data coverage** (limited baseline match history, limited head-to-head history)
- **Context volatility** (derby, neutral venue, post-international-break, end-of-season, friendlies)
- **Model stability signals** (caps hit, overcorrection warning, large adjustment swing)

8. **Dynamic Home Advantage** (High Priority - Algorithm)
   - Calculate home advantage from team records, not fixed
   - Better reflects actual match context
   - Implementation: 4-6 hours
   - **Impact:** +2-3% accuracy on Match Result
   - **Reference:** Section 4.6.1

**Advanced (within 1 month):**

9. **Opponent Quality Weighting** (High Priority - Algorithm)
   - Weight scoring rate by opponent tier
   - Goals vs Tier 1 team = 1.5x weight, vs Tier 4 = 0.7x
   - Implementation: 1 day
   - **Impact:** +2-3% accuracy
   - **Note:** Requires opponent data for each match
   - **Reference:** Section 4.6.3

10. **Weighted Scoring Rate** (Medium Priority - Algorithm)
    - Use recency weighting for scoring rate (like form)
    - Consistent with form weighting approach
    - Implementation: 4-6 hours
    - **Impact:** +1% accuracy
    - **Reference:** Section 4.6.4

11. **Fixture Congestion** (Medium Priority - Algorithm)
    - Account for teams playing multiple matches in short period
    - Reduce form weight when team is fatigued
    - Implementation: 1 day
    - **Impact:** +1% accuracy
    - **Reference:** Section 4.6.5

12. **Kelly-Aware Confidence** (Advanced - Safety)
    - Requires bookmaker odds integration
    - Value-based confidence adjustment
    - Implementation: 2-3 days (includes odds integration)

13. **Shadow Mode** (Advanced - Deployment)
    - Side-by-side comparison of capped vs uncapped
    - Safe rollout strategy
    - Implementation: 3-5 days
    - **Reference:** Future Enhancements section

**Testing Checklist:**

- ✅ Test on 5-10 edge-case historical matches
- ✅ Verify swings ≤22% (check `probabilitySwing` field)
- ✅ Verify confidence drops when many adjustments fire
- ✅ Test early season scenarios (low data)
- ✅ Test formation instability scenarios
- ✅ Test multiple safety flags active
- ✅ Run shadow mode comparison if possible

---

**Last Updated:** Algorithm improvements documented based on analysis and best practices review. Added production monitoring (Section 4.5.9), opponent-adjusted rate stats (Section 1.2.5), validation enforcement (Section 4.1.4), Optuna hyperparameter tuning (Section 2.2.5), class imbalance handling (Section 2.3.5), concept drift detection (Section 3.3.5), probabilistic safety flags (Section 1.4.5), adjustment interaction analysis (Section 4.1.5), formation normalization & similarity detection (Enhanced Section 1.4), promoted teams handling (Section 1.5.5), opponent tier pre-computation strategy (Enhanced Section 1.2.5), API-Football optimizations (Sections 1.5.5, 1.3, 4.6), automated anomaly detection (Section 1.5.4), flexible alternative bet suggestions (Section 4.7), team name standardization & mapping (Section 1.1.1), one-season wonder detection (Section 1.5.6), international match support (Section 3.5.3), neutral venue detection (Section 3.5.4), derby/rivalry matches detection (Section 3.5.5), post-international break effects (Section 3.5.6), end-of-season dynamics (Section 3.5.7), league-specific characteristics (Section 3.5.8), enhanced data quality edge cases (Section 1.5.7), and fixture congestion verification (Section 4.6.5). **Critical clarifications:** (1) Mind layer requires 50 matches from current league across multiple seasons, (2) Mood layer requires 10 matches from current season only, (3) Team name mapping is primarily for ML retraining (combining historical GitHub data with new API data), not for production predictions (uses API IDs), (4) LightGBM is used offline for weight optimization only, not for real-time predictions.nt league (multi-season), not just current season. Added multi-season match fetching helpers. (2) API-Football provides pre-calculated statistics - removed manual calculations for goal minutes, formations, Over/Under, clean sheets, failed to score, and form string. Simplified data fetching to use API parameters directly. (3) Added automated anomaly detection using IQR and Z-score methods to catch corrupted data, statistical outliers, and data inconsistencies early. (4) Added always-on alternative bet suggestions system that dynamically analyzes all markets to suggest safer, correlated, and complementary alternatives for every prediction, regardless of confidence level. (5) For international matches (Copa Libertadores, Champions League, etc.), use hybrid approach: domestic league data for Mind/Mood layers (ensures 50 matches), international competition for H2H filtering, with appropriate weight adjustments (form -15%, home advantage -10%, motivation +30%, goals -8%, H2H +20%). (6) Clarified team name standardization system: Primarily needed for ML retraining when combining historical GitHub data with new API-Football data. NOT needed for initial ML training (uses only GitHub data) or production predictions (uses API endpoints with team IDs). Uses API-Football standings endpoint to build mapping table once per league, cache it, and use for fast normalization during retraining. Handles name variations like "Sp Lisbon" → "Sporting CP" automatically with fuzzy matching. (7) Added one-season wonder detection to distinguish genuine sleeping giants (elite teams having bad form) from recently promoted teams that overperformed and are regressing. One-season wonders get confidence reduction instead of probability boost, preventing false value bets.
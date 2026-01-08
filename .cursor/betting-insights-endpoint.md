# Betting Insights Endpoint: Complete Implementation Plan

## Table of Contents
1. [Is This a Predictor Bot? (Honest Answer)](#honest-answer)
2. [How Factors Apply to Different Markets](#factor-application)
3. [Complete Implementation Plan](#implementation-plan)
4. [API Specification](#api-specification)
5. [Week-by-Week Roadmap](#roadmap)

---

## TO ADD TO ALGORITHM

### Phase 1: Historical Data Integration & Feature Engineering

#### 1.1 Data Acquisition & Cleaning
- **Download historical dataset:** https://github.com/xgabora/Club-Football-Match-Data-2000-2025 (MIT-licensed, league-only matches 2000–2025)
- **Data cleaning pipeline:**
  - Handle NaNs: Impute missing values (use median for numeric, mode for categorical)
  - Standardize team names: Create team name mapping table (handle name changes, mergers)
  - Convert dates: Ensure consistent date format, handle timezone issues
  - Filter to major leagues: Top 5 leagues (Premier League, La Liga, Serie A, Bundesliga, Ligue 1, Portuguese League, Eredevise)
  - Remove duplicates: Identify and remove duplicate matches
  - Validate data integrity: Check for impossible scores, future dates, etc.

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

#### 1.3 Feature Engineering - Mind/Mood/DNA Layers
- **Mind Layer Features (50 matches):**
  - `EfficiencyIndex_50`: (Avg Points per Game) + (Goal Difference / 10)
  - `Tier_50`: Categorized tier (1-4) based on EI
  - `AvgGoalsScored_50`: Average goals scored over 50 matches
  - `AvgGoalsConceded_50`: Average goals conceded over 50 matches
  - `CleanSheetRate_50`: Clean sheet percentage over 50 matches
  - `BTTSRate_50`: BTTS percentage over 50 matches
  - `Over25Rate_50`: Over 2.5 goals percentage over 50 matches

- **Mood Layer Features (10 matches):**
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
  - **Hyperparameter tuning:** Use Optuna or similar for automated tuning
  - **Early stopping:** Prevent overfitting with validation set monitoring
  - **Hyperparameter Configuration:** Reference `config.mlHyperparameters` (see Section 1.5 for centralized configuration)

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
  
  OVER_25: {
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

// Helper: Detect Mind vs Mood gap and identify patterns
function detectMoodVsMindGap(mindTier: number, moodTier: number): TeamMood {
  const mindMoodGap = Math.abs(mindTier - moodTier);
  const isSleepingGiant = mindTier === 1 && moodTier === 4;
  const isOverPerformer = mindTier === 4 && moodTier === 1;
  
  return {
    tier: moodTier as 1 | 2 | 3 | 4,
    mindMoodGap,
    isSleepingGiant,
    isOverPerformer,
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
}

interface TeamDNA {
  mostPlayedFormation: string;     // e.g., "4-3-3"
  formationFrequency: Record<string, number>; // Formation usage percentages
  under25Percentage: number;       // Season Under 2.5 rate
  over25Percentage: number;        // Season Over 2.5 rate
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
  
  over25Count: number;
  over25Percentage: number;
  
  avgGoalsPerMatch: number;
  avgHomeGoals: number;
  avgAwayGoals: number;
  
  firstHalfGoalsPercentage: number;
  
  // Recency-weighted stats
  weightedBttsPercentage: number;      // BTTS % weighted by match recency
  weightedAvgGoalsPerMatch: number;   // Goals avg weighted by match recency
  recencyWeights: number[];             // Weight for each match (by index)
}

// Fetch team data with caching
async function getTeamData(
  teamId: number,
  c: Context
): Promise<TeamData> {
  const cacheKey = `team:${teamId}`;
  
  // Check cache (24 hour TTL)
  const cached = await c.env.KV.get(cacheKey, 'json');
  if (cached && !isStale(cached, 24 * 60 * 60)) {
    return cached;
  }
  
  // Fetch from API-Football
  // Fetch 50 matches for Mind layer, 10 for Mood layer
  let [allMatches50, allMatches10, homeMatches, awayMatches, standings, teamStats] = await Promise.all([
    fetchTeamMatches(teamId, 50),      // Mind layer (baseline)
    fetchTeamMatches(teamId, 10),      // Mood layer (recent momentum)
    fetchTeamHomeMatches(teamId, 5),
    fetchTeamAwayMatches(teamId, 5),
    fetchTeamStandings(teamId),
    fetchTeamStatistics(teamId, c),    // DNA layer (season stats from backend endpoint)
  ]);
  
  let allMatches = allMatches10; // Use 10 matches for main calculations
  
  // Filter out friendly matches
  allMatches50 = filterNonFriendlyMatches(allMatches50);
  allMatches10 = filterNonFriendlyMatches(allMatches10);
  allMatches = filterNonFriendlyMatches(allMatches);
  homeMatches = filterNonFriendlyMatches(homeMatches);
  awayMatches = filterNonFriendlyMatches(awayMatches);
  
  // Ensure minimum match count (fallback: use all matches if filtered count is too low)
  const MIN_MATCHES = 3;
  if (allMatches.length < MIN_MATCHES) {
    // Fallback: fetch more matches or use all available
    const allMatchesUnfiltered = await fetchTeamMatches(teamId, 15);
    allMatches = filterNonFriendlyMatches(allMatchesUnfiltered);
    // If still too few, use unfiltered (better than no data)
    if (allMatches.length < MIN_MATCHES) {
      allMatches = allMatchesUnfiltered.slice(0, 10);
    }
  }
  
  // Calculate Mind layer (baseline quality from 50 matches)
  const mindEI = calculateEfficiencyIndex(allMatches50);
  const mindTier = categorizeTier(mindEI);
  
  // Calculate Mood layer (recent momentum from 10 matches)
  const moodTier = calculateMoodTier(allMatches10);
  const mood = detectMoodVsMindGap(mindTier, moodTier);
  
  // Calculate DNA layer (season statistics)
  // Note: Early season adjustments will be applied at match prediction level, not here
  
  // Use formation data from teamStats if available, otherwise calculate from matches
  const formationFrequency = teamStats.formations && teamStats.formations.length > 0
    ? teamStats.formations.reduce((acc: Record<string, number>, f: {formation: string; count: number}) => {
        acc[f.formation] = f.count;
        return acc;
      }, {})
    : calculateFormationFrequency(teamStats.matches || allMatches50);
  
  const mostPlayedFormation = getMostPlayedFormation(formationFrequency);
  
  // Use goal minute data from teamStats if available, otherwise calculate from matches
  const goalMinuteData = teamStats.goalMinutes && teamStats.goalMinutes.length > 0
    ? calculateGoalMinuteDistributionFromData(teamStats.goalMinutes)
    : calculateGoalMinuteDistribution(teamStats.matches || allMatches50);
  
  // Use raw DNA percentages (early season adjustments applied at prediction level)
  const dnaUnder25Pct = teamStats.under25Percentage || 0;
  const dnaOver25Pct = teamStats.over25Percentage || 0;
  
  const dna: TeamDNA = {
    mostPlayedFormation,
    formationFrequency,
    under25Percentage: dnaUnder25Pct,
    over25Percentage: dnaOver25Pct,
    cleanSheetPercentage: teamStats.cleanSheetPercentage || 0,
    failedToScorePercentage: teamStats.failedToScorePercentage || 0,
    goalMinuteDistribution: goalMinuteData.distribution,
    dangerZones: goalMinuteData.dangerZones,
    firstHalfGoalPercentage: goalMinuteData.firstHalfPercentage,
    earlyGoalPercentage: goalMinuteData.earlyGoalPercentage,
    lateStarter: goalMinuteData.earlyGoalPercentage < 20,
  };
  
  // Calculate stats
  const stats = calculateTeamStats(allMatches, standings);
  
  const teamData: TeamData = {
    id: teamId,
    name: allMatches[0]?.homeTeam?.id === teamId 
      ? allMatches[0].homeTeam.name 
      : allMatches[0]?.awayTeam?.name || 'Unknown',
    lastMatches: allMatches,
    lastHomeMatches: homeMatches,
    lastAwayMatches: awayMatches,
    mind: {
      efficiencyIndex: mindEI,
      tier: mindTier,
      last50Matches: allMatches50,
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
  c: Context
): Promise<H2HData> {
  const cacheKey = `h2h:${homeTeamId}:${awayTeamId}`;
  
  // Check cache (7 day TTL)
  const cached = await c.env.KV.get(cacheKey, 'json');
  if (cached && !isStale(cached, 7 * 24 * 60 * 60)) {
    return cached;
  }
  
  // Fetch from API
  let matches = await fetchH2HMatches(homeTeamId, awayTeamId, 10);
  
  // Filter out friendly matches
  matches = filterNonFriendlyMatches(matches);
  
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

// Helper: Calculate formation stability with context-aware logic (IMPROVED VERSION)
// Considers opponent strength, formation success rate, and change frequency
// Returns stability score, stability status, and market-specific confidence reduction
function calculateFormationStability(
  matchFormation: string,
  mostPlayedFormation: string,
  formationFrequency: Record<string, number>,
  context: {
    isEarlySeason: boolean;
    opponentStrength?: 'STRONG' | 'MEDIUM' | 'WEAK';
    recentFormationChanges?: number; // How many changes in last 5 matches
    formationSuccessRate?: number;   // Win rate with this formation (0-1)
  } = { isEarlySeason: false }
): { 
  isStable: boolean; 
  stabilityScore: number;
  confidenceReduction: number; // Base reduction percentage (will be adjusted per market)
  reason: string;
} {
  if (!matchFormation || !mostPlayedFormation) {
    return { 
      isStable: false, 
      stabilityScore: 0, 
      confidenceReduction: 0,
      reason: 'Formation data unavailable'
    };
  }
  
  const usagePercentage = matchFormation === mostPlayedFormation
    ? formationFrequency[mostPlayedFormation] || 0
    : formationFrequency[matchFormation] || 0;
  
  // Early season: More lenient threshold (30% vs 20%)
  const stabilityThreshold = context.isEarlySeason ? 30 : 20;
  const isStable = usagePercentage >= stabilityThreshold;
  
  // Tiered confidence reduction based on usage percentage
  let baseReduction = 0;
  if (usagePercentage < 20) {
    baseReduction = 25; // Very experimental: 20-25% reduction
  } else if (usagePercentage < 40) {
    baseReduction = 15; // Experimental: 10-15% reduction
  } else if (usagePercentage < 60) {
    baseReduction = 10; // Occasionally used: 5-10% reduction
  } else if (usagePercentage < 80) {
    baseReduction = 5; // Secondary formation: 0-5% reduction
  }
  // usagePercentage >= 80: No reduction (stable)
  
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
  let reason = `Formation ${matchFormation} used ${usagePercentage.toFixed(0)}% of time`;
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
    stabilityScore: usagePercentage,
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
  
  // Cup competition keywords
  const cupKeywords = [
    'cup', 'champions league', 'europa', 'europa league',
    'fa cup', 'copa del rey', 'coppa italia', 'dfb-pokal',
    'coupe de france', 'taca de portugal', 'knockout', 'playoff'
  ];
  
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
  
  return {
    type: isCup ? 'CUP' : 'LEAGUE',
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

interface MarketPrediction {
  market: 'MATCH_RESULT' | 'BTTS' | 'OVER_25' | 'FIRST_HALF';
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
  
  // 2. Over/Under 2.5 (40% less impact from formations)
  predictions.push(await predictOver25(
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
  
  // Apply DNA layer: Use season Under/Over distributions
  // If season DNA shows strong Under tendency, adjust BTTS probability
  const homeDnaAdjustment = homeTeam.dna.under25Percentage > 70 ? -5 : 0;
  const awayDnaAdjustment = awayTeam.dna.under25Percentage > 70 ? -5 : 0;
  
  // Apply Formation Stability: Use market-adjusted reduction (already reduced by 40% for BTTS)
  const formationAdjustment = -(formationStability?.totalFormationReduction || 0);
  
  // Apply Safety Flags
  let safetyAdjustment = 0;
  if (homeTeam.safetyFlags.liveDog || awayTeam.safetyFlags.liveDog) {
    // Live Dog flag: Switch to BTTS recommendation
    safetyAdjustment += 10;
  }
  
  // Calculate weighted score using adjusted weights
  const scoringWeight = weights.scoringRate / 2; // Split between home and away
  const defensiveWeight = weights.defensiveForm / 2; // Split between home and away
  
  let bttsScore = (
    homeScoreScore * scoringWeight +
    awayScoreScore * scoringWeight +
    h2hBTTSScore * weights.h2h +
    homeDefenseScore * defensiveWeight +
    awayDefenseScore * defensiveWeight
  );
  
  // Apply adjustments
  bttsScore += homeDnaAdjustment + awayDnaAdjustment + formationAdjustment + safetyAdjustment;
  bttsScore = Math.max(0, Math.min(100, bttsScore)); // Clamp to 0-100
  
  // Convert to probability
  const yesProbability = bttsScore;
  const noProbability = 100 - yesProbability;
  
  // Determine rating
  const rating = getRating(yesProbability);
  
  // Adjust confidence based on formation stability (market-adjusted)
  let finalConfidence = confidence;
  const formationReduction = formationStability?.totalFormationReduction || 0;
  
  if (formationReduction > 0) {
    // Apply tiered confidence reduction based on market-adjusted formation impact
    if (finalConfidence === 'HIGH' && formationReduction > 12) {
      finalConfidence = 'MEDIUM';
    } else if (finalConfidence === 'MEDIUM' && formationReduction > 18) {
      finalConfidence = 'LOW';
    }
    
    // Add formation instability insights with early season context
    if (!formationStability?.homeFormationStability.isStable) {
      const earlySeasonNote = isEarlySeason ? ' (early season - more acceptable)' : '';
      const formationName = 'Unknown'; // Will be provided from match context in actual implementation
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
      const formationName = 'Unknown'; // Will be provided from match context in actual implementation
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
  if (homeTeam.dna.under25Percentage > 70) {
    insights.push({
      text: `${homeTeam.name} season DNA: ${homeTeam.dna.under25Percentage.toFixed(0)}% Under 2.5 (vs ${(100 - homeScoredPct).toFixed(0)}% in L5) - Trust the DNA`,
      emoji: '🧬',
      priority: 75,
      category: 'SCORING',
      severity: 'MEDIUM',
    });
  }
  
  // Calculate confidence
  const signals = [
    { score: homeScoreScore, weight: 0.25 },
    { score: awayScoreScore, weight: 0.25 },
    { score: h2hBTTSScore, weight: 0.25 },
    { score: homeDefenseScore, weight: 0.125 },
    { score: awayDefenseScore, weight: 0.125 },
  ];
  
  const signalsForYes = signals.filter(s => s.score >= 60).length;
  const signalsForNo = signals.filter(s => s.score < 40).length;
  
  let confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  if (signalsForYes >= 4 || signalsForNo >= 4) {
    confidence = 'HIGH';
  } else if (signalsForYes >= 3 || signalsForNo >= 3) {
    confidence = 'MEDIUM';
  } else {
    confidence = 'LOW';
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

// Predict Over/Under 2.5 Goals with Goal Efficiency (DNA layer)
async function predictOver25(
  homeTeam: TeamData,
  awayTeam: TeamData,
  h2h: H2HData,
  isEarlySeason: boolean = false,
  formationStability?: {
    homeFormationStability: { isStable: boolean; stabilityScore: number; confidenceReduction: number };
    awayFormationStability: { isStable: boolean; stabilityScore: number; confidenceReduction: number };
    totalFormationReduction: number; // Market-adjusted reduction (40% less impact)
  }
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
  // Trust long-term DNA over recent outliers
  const homeDnaUnderRate = homeTeam.dna.under25Percentage;
  const awayDnaUnderRate = awayTeam.dna.under25Percentage;
  
  let dnaAdjustment = 0;
  if (homeDnaUnderRate > 70 || awayDnaUnderRate > 70) {
    // Strong Under DNA: reduce Over probability even if recent form suggests Over
    const avgDnaUnderRate = (homeDnaUnderRate + awayDnaUnderRate) / 2;
    dnaAdjustment = -(avgDnaUnderRate - 50) * 0.3; // -6% to -9% adjustment
    
    insights.push({
      text: `🧬 Season DNA: ${homeTeam.name} ${homeDnaUnderRate.toFixed(0)}% Under 2.5, ${awayTeam.name} ${awayDnaUnderRate.toFixed(0)}% Under 2.5 - Trust the DNA over recent form`,
      emoji: '🧬',
      priority: 85,
      category: 'SCORING',
      severity: 'HIGH',
    });
  }
  
  // Calculate score
  let overScore = combinedAvgGoals * 20; // Scale to 0-100
  overScore += dnaAdjustment;
  
  // Apply formation stability adjustment (market-adjusted: 40% less impact for O/U)
  const formationAdjustment = -(formationStability?.totalFormationReduction || 0);
  overScore += formationAdjustment;
  
  // Apply safety flags
  if (homeTeam.safetyFlags.regressionRisk || awayTeam.safetyFlags.regressionRisk) {
    overScore -= 3; // Regression risk teams may score less
  }
  
  overScore = Math.max(0, Math.min(100, overScore));
  
  const yesProbability = overScore;
  const noProbability = 100 - yesProbability;
  const rating = getRating(yesProbability);
  
  // Calculate confidence
  let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
  if (Math.abs(yesProbability - 50) > 25) confidence = 'HIGH';
  if (Math.abs(yesProbability - 50) < 10) confidence = 'LOW';
  
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
    market: 'OVER_25',
    probabilities: { yes: yesProbability, no: noProbability },
    rating,
    confidence,
    insights: insights.slice(0, 5),
    recommendation: rating === 'LIKELY' || rating === 'VERY_LIKELY' 
      ? 'Over 2.5 - Yes ✅' 
      : rating === 'UNLIKELY' || rating === 'VERY_UNLIKELY'
      ? 'Under 2.5 - Yes ✅'
      : 'Over 2.5 - Neutral 🤔',
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
  OVER_25: [
    {
      market: 'OVER_25',
      direction: 'UP',    // Predicting Over more
      maxAdjustment: 18,   // Allow bigger upward moves (higher odds = more acceptable)
      riskMultiplier: 0.9, // Less penalty for false positives
      falsePositivePenalty: 0.8, // Less penalty (higher payout compensates)
      falseNegativePenalty: 1.3, // More penalty (missed value)
    },
    {
      market: 'OVER_25',
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
  OVER_25: {
    market: 'OVER_25',
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
}

/**
 * Apply all adjustments with caps & asymmetry in one function
 * This is the recommended way to use caps and asymmetric weighting
 */
function applyCappedAsymmetricAdjustments(
  baseProbability: number,
  adjustments: Adjustment[],
  market: 'BTTS' | 'OVER_25' | 'MATCH_RESULT' | 'FIRST_HALF',
  config: AlgorithmConfig
): CappedAdjustmentResult {
  const { maxSwing, minProb, maxProb } = config.probabilityCaps;
  const marketCaps = config.asymmetricWeighting[market.toLowerCase()] || {
    upMax: maxSwing,
    downMax: maxSwing,
  };

  let totalAdjustment = 0;
  const cappedAdjustments: Adjustment[] = [];
  let wasCapped = false;

  // Step 1: Apply asymmetric caps to each adjustment individually
  for (const adj of adjustments) {
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

  // Step 2: Apply global total swing cap
  totalAdjustment = Math.max(-maxSwing, Math.min(maxSwing, totalAdjustment));
  if (Math.abs(totalAdjustment) !== Math.abs(
    cappedAdjustments.reduce((sum, adj) => sum + adj.value, 0)
  )) {
    wasCapped = true;
  }

  // Step 3: Calculate final probability with absolute bounds
  let finalProbability = baseProbability + totalAdjustment;
  finalProbability = Math.max(minProb, Math.min(maxProb, finalProbability));

  return {
    finalProbability,
    totalAdjustment,
    cappedAdjustments,
    wasCapped,
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
  market: 'BTTS' | 'OVER_25' | 'MATCH_RESULT' | 'FIRST_HALF',
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
    'OVER_25': 0.4,   // Moderate impact (fatigue affects scoring)
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

### Phase 5: API Endpoint (Week 3)

**Goal:** Expose predictions via clean API

```typescript
// /api/matches/[matchId]/insights.ts

app.get('/api/matches/:matchId/insights', async (c) => {
  const matchId = c.req.param('matchId');
  
  try {
    // 1. Get match details
    const match = await getMatchDetails(matchId, c);
    
    if (!match) {
      return c.json({ error: 'Match not found' }, 404);
    }
    
    // 2. Check cache (1 hour TTL)
    const cacheKey = `insights:${matchId}`;
    const cached = await c.env.KV.get(cacheKey, 'json');
    
    if (cached && !isStale(cached, 60 * 60)) {
      return c.json(cached);
    }
    
    // 3. Fetch team data
    const [homeTeam, awayTeam, h2h] = await Promise.all([
      getTeamData(match.homeTeamId, c),
      getTeamData(match.awayTeamId, c),
      getH2HData(match.homeTeamId, match.awayTeamId, c),
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
        id: matchId,
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
    
    // 8. Cache response (1 hour)
    await c.env.KV.put(cacheKey, JSON.stringify(response), {
      expirationTtl: 60 * 60,
    });
    
    // 9. Set cache headers for edge
    c.header('Cache-Control', 'public, max-age=3600');
    c.header('CDN-Cache-Control', 'max-age=3600');
    
    return c.json(response);
    
  } catch (error) {
    console.error('Error generating insights:', error);
    return c.json({ error: 'Failed to generate insights' }, 500);
  }
});

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
    "id": "12345",
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
      "market": "OVER_25",
      "probabilities": {
        "yes": 71,
        "no": 29
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
   - Simplifies integration into prediction functions
   - Implementation: 4-6 hours
   - **Reference:** Section 4.5.6

6. **Market-Specific Asymmetry Factors** (High Priority - Safety)
   - BTTS: Stricter on upward moves (upMax: 12)
   - Over 2.5: More lenient on upward moves (upMax: 18)
   - Match Result: Very strict on favorites (upMax: 10)
   - Implementation: 1 day
   - **Starting Values:** See Section 4.5.8

7. **Rest Advantage Integration** (High Priority - Algorithm)
   - Use calculated rest advantage gap in predictions
   - Small but meaningful accuracy improvement
   - Implementation: 2-3 hours
   - **Impact:** +1-2% accuracy
   - **Reference:** Section 4.6.2

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

**Last Updated:** Algorithm improvements documented based on analysis and best practices review.
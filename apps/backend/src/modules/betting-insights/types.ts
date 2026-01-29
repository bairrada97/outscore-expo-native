/**
 * Betting Insights Module - Type Definitions
 *
 * Core types for the betting insights algorithm following the three-layer
 * data strategy: Mind (baseline quality), Mood (recent momentum), DNA (technical trends)
 *
 * Reference: docs/betting-insights-Algorithm.md
 */

// ============================================================================
// CORE DATA TYPES
// ============================================================================

/**
 * Result of a match from a specific team's perspective
 */
export type MatchResult = 'W' | 'D' | 'L';

/**
 * Confidence level for simulations
 */
export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * Signal strength for a simulation (direction comes from the probability distribution).
 */
export type SignalStrength = 'Strong' | 'Moderate' | 'Balanced' | 'Weak';

/**
 * Scenario types supported by the intelligence layer.
 *
 * Naming is intentionally neutral/educational (no gambling framing).
 */
export type ScenarioType =
  | 'BothTeamsToScore'
  | 'TotalGoalsOverUnder'
  | 'MatchOutcome'
  | 'FirstHalfActivity';

/**
 * Supported goal lines for OVER_UNDER_GOALS
 */
export const DEFAULT_GOAL_LINES = [0.5, 1.5, 2.5, 3.5, 4.5, 5.5] as const;
export type GoalLine = (typeof DEFAULT_GOAL_LINES)[number];
export type GoalLineKey = `${GoalLine}`;
export type GoalLineOverPctMap = Partial<Record<GoalLineKey, number>>;
export type GoalLineOverCountMap = Partial<Record<GoalLineKey, number>>;

/**
 * Team tier based on Efficiency Index (1 = elite, 4 = lower tier)
 */
export type TeamTier = 1 | 2 | 3 | 4;

/**
 * Insight category for UI grouping
 */
export type InsightCategory =
  | 'FORM'
  | 'H2H'
  | 'SCORING'
  | 'TIMING'
  | 'SAFETY'
  | 'DEFENSIVE'
  | 'CONTEXT'
  | 'WARNING'
  | 'VALUE';

/**
 * Insight severity level
 */
export type InsightSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * Match type classification
 */
export type MatchType = 'LEAGUE' | 'CUP' | 'INTERNATIONAL' | 'FRIENDLY';

/**
 * Motivation level for a team
 */
export type MotivationLevel =
  | 'TITLE_RACE'
  | 'CL_RACE'
  | 'EUROPA_RACE'
  | 'RELEGATION_BATTLE'
  | 'MID_TABLE'
  | 'SECURE';

/**
 * Adjustment type for cumulative cap grouping
 */
export type AdjustmentType =
  | 'formation'
  | 'injuries'
  | 'dna'
  | 'safety'
  | 'rest'
  | 'motivation'
  | 'h2h'
  | 'context'
  | 'other';

// ============================================================================
// MATCH DATA TYPES
// ============================================================================

/**
 * Processed match data from a team's perspective
 * Used for Mind/Mood calculations
 */
export interface ProcessedMatch {
  id: number;
  date: string;
  homeTeam: {
    id: number;
    name: string;
  };
  awayTeam: {
    id: number;
    name: string;
  };
  score: {
    home: number | null;
    away: number | null;
  };
  /** Result from the relevant team's perspective */
  result: MatchResult;
  /** Goals scored by the relevant team */
  goalsScored: number;
  /** Goals conceded by the relevant team */
  goalsConceded: number;
  /** Expected goals for the relevant team (if available) */
  expectedGoals?: number;
  /** Goals prevented for the relevant team (if available) */
  goalsPrevented?: number;
  /** First half goals by relevant team (if available) */
  firstHalfGoals?: number;
  league: {
    id: number;
    name: string;
    round?: string;
  };
  season: number;
  /** Formation used in this match (if available) */
  formation?: string;
  /** Was this a home game for the team being analyzed */
  isHome: boolean;
}

/**
 * Goal distribution by minute ranges
 * Used for DNA layer and First Half simulations
 */
export interface GoalMinuteDistribution {
  '0-15': number;
  '16-30': number;
  '31-45': number;
  '46-60': number;
  '61-75': number;
  '76-90': number;
}

/**
 * Danger zone information for goal timing
 */
export interface DangerZone {
  period: keyof GoalMinuteDistribution;
  percentage: number;
  type: 'scoring' | 'conceding';
}

// ============================================================================
// THREE-LAYER DATA STRATEGY TYPES
// ============================================================================

/**
 * Mind Layer - Baseline Quality (50 matches)
 * Defines the team's "True Tier" and prevents being fooled by lucky streaks
 *
 * Reference: Section "1. The Mind (Baseline Quality - 50 Matches)"
 */
export interface MindLayer {
  /** Team tier (1-4) based on Efficiency Index */
  tier: TeamTier;
  /** Efficiency Index: EI = (Avg Points per Game) + (Goal Difference / 10) */
  efficiencyIndex: number;
  /** Average points per game over 50 matches */
  avgPointsPerGame: number;
  /** Goal difference over 50 matches */
  goalDifference: number;
  /** Number of matches used for calculation (may be less than 50 for new teams) */
  matchCount: number;
  /** Whether data quality is sufficient (>= 30 matches recommended) */
  hasSufficientData: boolean;
}

/**
 * Mood Layer - Recent Momentum (10 matches)
 * Captures team's current energy, injuries, and confidence
 *
 * Reference: Section "2. The Mood (Recent Momentum - 10 Matches)"
 */
export interface MoodLayer {
  /** Current momentum tier based on last 10 matches */
  tier: TeamTier;
  /** Gap between Mind tier and Mood tier (positive = better mood than baseline) */
  mindMoodGap: number;
  /**
   * Sleeping Giant: Mind Tier 1, Mood Tier 4
   * High-value bet opportunity - class remains despite bad form
   */
  isSleepingGiant: boolean;
  /**
   * Over-performer: Mind Tier 4, Mood Tier 1
   * Regression risk - team is "due" for a loss
   */
  isOverPerformer: boolean;
  /**
   * One-Season Wonder: Recently promoted team overperforming
   * Reduces confidence instead of adding probability
   */
  isOneSeasonWonder: boolean;
  /** Form string (e.g., "WWDLW") */
  formString: string;
  /** Points from last 10 matches */
  last10Points: number;
  /** Goals scored in last 10 matches */
  last10GoalsScored: number;
  /** Goals conceded in last 10 matches */
  last10GoalsConceded: number;
}

/**
 * DNA Layer - Technical Trends (Season Stats)
 * Refines specific markets (BTTS, O/U, 1st Half) rather than winner
 *
 * Reference: Section "3. The DNA (Technical Trends - Season Stats)"
 */
export interface DNALayer {
  /** Most commonly used formation this season */
  mostPlayedFormation: string;
  /** Formation frequency map (formation -> percentage) */
  formationFrequency: Record<string, number>;
  /**
   * Season P(totalGoals > line) by goal line, keyed by the line string (e.g. "2.5")
   * Used by OVER_UNDER_GOALS (multi-line).
   */
  goalLineOverPct: GoalLineOverPctMap;
  /** Percentage of matches with clean sheets */
  cleanSheetPercentage: number;
  /** Percentage of matches failed to score */
  failedToScorePercentage: number;
  /** BTTS Yes rate this season */
  bttsYesRate: number;
  /** Goal minute distribution for scoring */
  goalMinutesScoring: GoalMinuteDistribution;
  /** Goal minute distribution for conceding */
  goalMinutesConceding: GoalMinuteDistribution;
  /** Whether team is a "late starter" (rarely scores in first 15 mins) */
  isLateStarter: boolean;
  /** Danger zones where team is most vulnerable */
  dangerZones: DangerZone[];
  /** First half goal percentage */
  firstHalfGoalPercentage: number;
  /** Average goals per game this season */
  avgGoalsPerGame: number;
  /** Average goals conceded per game this season */
  avgGoalsConcededPerGame: number;
}

/**
 * Safety Flags - Non-Mathematical Binary Flags
 * Trigger confidence adjustments
 *
 * Reference: Section "4. The Safety Layer (Non-Mathematical Flags)"
 */
export interface SafetyFlags {
  /**
   * Regression Risk: Tier 3 team won 5+ in a row
   * Action: Reduce Confidence by 15%
   */
  regressionRisk: boolean;
  /**
   * Motivation Clash: TITLE_RACE vs MID_TABLE
   * Action: Add +5% Win Prob to motivated team
   */
  motivationClash: boolean;
  /**
   * Live Dog: Bottom team scored in 2 of last 3 away
   * Action: Switch "Win to Nil" bet to "BTTS" (+10% BTTS prob)
   */
  liveDog: boolean;
  /** Current motivation level */
  motivation: MotivationLevel;
  /** Number of consecutive wins (for regression detection) */
  consecutiveWins: number;
}

// ============================================================================
// TEAM DATA TYPES
// ============================================================================

/**
 * Team statistics from API
 */
export interface TeamStatistics {
  /** Current league form string */
  form: string;
  /** Current league position */
  leaguePosition: number;
  /** Average goals scored per game */
  avgGoalsScored: number;
  /** Average goals conceded per game */
  avgGoalsConceded: number;
  /** Home average goals scored */
  homeAvgScored: number;
  /** Home average goals conceded */
  homeAvgConceded: number;
  /** Away average goals scored */
  awayAvgScored: number;
  /** Away average goals conceded */
  awayAvgConceded: number;
  /** Points from Champions League position */
  pointsFromCL: number;
  /** Points from relegation zone */
  pointsFromRelegation: number;
  /** Points from first place */
  pointsFromFirst: number;
  /** Games played this season */
  gamesPlayed: number;
  /** Total clean sheets this season (league stats) */
  cleanSheetsTotal: number;
}

/**
 * Complete team data combining all layers
 */
export interface TeamData {
  id: number;
  name: string;
  /** Current season statistics */
  stats: TeamStatistics;
  /** Mind layer: Baseline quality (50 matches) */
  mind: MindLayer;
  /** Mood layer: Recent momentum (10 matches) */
  mood: MoodLayer;
  /** DNA layer: Technical trends (season stats) */
  dna: DNALayer;
  /** Safety flags */
  safetyFlags: SafetyFlags;
  /** Global strength signal */
  elo?: {
    rating: number;
    games: number;
    asOf?: string;
    confidence: number;
  };
  /** Recent midweek high-elo opponent context (fatigue watch-out) */
  recentHighEloOpponent?: {
    opponentName: string;
    opponentElo: number;
    gap: number;
    leagueName: string;
    daysSince: number;
  };
  /** Days since last competitive match */
  daysSinceLastMatch: number;
  /** Last home matches (for home-specific analysis) */
  lastHomeMatches: ProcessedMatch[];
  /** Last away matches (for away-specific analysis) */
  lastAwayMatches: ProcessedMatch[];
  /** Number of seasons in current league (for one-season wonder detection) */
  seasonsInLeague: number;
}

// ============================================================================
// H2H DATA TYPES
// ============================================================================

/**
 * Head-to-Head data between two teams
 */
export interface H2HData {
  /** Recent H2H matches */
  matches: ProcessedMatch[];
  /** Total H2H matches available */
  h2hMatchCount: number;
  /** Home team wins in H2H */
  homeTeamWins: number;
  /** Away team wins in H2H */
  awayTeamWins: number;
  /** Draws in H2H */
  draws: number;
  /** Number of H2H matches where both teams scored */
  bttsCount: number;
  /** BTTS percentage in H2H */
  bttsPercentage: number;
  /** Over-goal counts by line (e.g. "2.5" => 6) */
  goalLineOverCount: GoalLineOverCountMap;
  /** Over-goal percentages by line (e.g. "2.5" => 62.5) */
  goalLineOverPct: GoalLineOverPctMap;
  /** Average goals per H2H match */
  avgGoals: number;
  /** Average home team goals in H2H */
  avgHomeGoals: number;
  /** Average away team goals in H2H */
  avgAwayGoals: number;
  /** Recency weights applied to matches */
  recencyWeights: number[];
  /** Whether H2H data is sufficient (>= 3 matches recommended) */
  hasSufficientData: boolean;
}

// ============================================================================
// PREDICTION & INSIGHT TYPES
// ============================================================================

/**
 * A single adjustment to probability
 */
export interface Adjustment {
  /** Unique name for the adjustment */
  name: string;
  /** Adjustment value (positive = increase probability, negative = decrease) */
  value: number;
  /** Human-readable reason for adjustment */
  reason: string;
  /** Type for cumulative cap grouping */
  type: AdjustmentType;
}

/**
 * An insight generated by the algorithm
 */
export interface Insight {
  /** Human-readable insight text */
  text: string;
  /**
   * Optional segmented text parts for rich rendering (e.g. bold numbers).
   * When present, UI should render `parts` instead of `text`.
   */
  parts?: Array<{ text: string; bold?: boolean }>;
  /** Emoji for visual indication */
  emoji: string;
  /** Priority for sorting (higher = more important, 0-100) */
  priority: number;
  /** Category for UI grouping */
  category: InsightCategory;
  /** Severity level */
  severity: InsightSeverity;
}

/**
 * Conflicting signal between factors
 */
export interface ConflictingSignal {
  /** Description of the conflict */
  description: string;
  /** Factor 1 name */
  factor1: string;
  /** Factor 1 suggests */
  factor1Suggests: string;
  /** Factor 2 name */
  factor2: string;
  /** Factor 2 suggests */
  factor2Suggests: string;
}

/**
 * Related scenario (derived from an existing simulation).
 */
export interface RelatedScenario {
  /** Scenario type */
  scenarioType: ScenarioType;
  /** Goal line for TotalGoalsOverUnder (if applicable) */
  line?: GoalLine;
  /** Probability for the most probable outcome in this scenario */
  probability: number;
  /** Model reliability */
  modelReliability: ConfidenceLevel;
  /** Neutral explanation for why this is shown */
  rationale: string;
  /** Neutral text for the most probable outcome */
  mostProbableOutcome: string;
}

/**
 * MatchOutcome factor scores (raw -100..100-ish comparison scores by factor)
 */
export interface MatchOutcomeFactorScores {
  formScore: number;
  h2hScore: number;
  homeAdvantageScore: number;
  motivationScore: number;
  restScore: number;
  positionScore: number;
}

export interface ModelReliabilityBreakdown {
  level: ConfidenceLevel;
  reasons: string[];
  signals: {
    mindSample: { homeMatchCount: number; awayMatchCount: number };
    h2h: { hasSufficientData: boolean; matchCount: number };
    context: {
      matchType: MatchType;
      /** Knockout matches can be more tactical/volatile than league games */
      isKnockout?: boolean;
      isDerby: boolean;
      isNeutralVenue: boolean;
      isPostInternationalBreak: boolean;
      isEndOfSeason: boolean;
    };
    stability: {
      capsHit?: boolean;
      overcorrectionWarning?: string;
      totalAdjustment?: number;
    };
  };
}

/**
 * Probability distribution for different scenario types
 */
export interface ProbabilityDistribution {
  /** Home-side outcome probability (for MatchOutcome) */
  home?: number;
  /** Draw probability (for MatchOutcome) */
  draw?: number;
  /** Away-side outcome probability (for MatchOutcome) */
  away?: number;
  /** Yes probability (for BothTeamsToScore, FirstHalfActivity) */
  yes?: number;
  /** No probability (for BothTeamsToScore, FirstHalfActivity) */
  no?: number;
  /** Over probability (for TotalGoalsOverUnder) */
  over?: number;
  /** Under probability (for TotalGoalsOverUnder) */
  under?: number;
}

/**
 * Simulation result (mobile-safe, educational framing)
 */
export interface Simulation {
  /** Scenario type */
  scenarioType: ScenarioType;
  /** Goal line (only for TotalGoalsOverUnder) */
  line?: GoalLine;
  /** Calculated probability distribution */
  probabilityDistribution: ProbabilityDistribution;
  /** Strength of the signal (direction is derived from distribution) */
  signalStrength: SignalStrength;
  /** Model reliability */
  modelReliability: ConfidenceLevel;
  /** Why model reliability is what it is (educational transparency) */
  modelReliabilityBreakdown?: ModelReliabilityBreakdown;
  /** Generated insights (keep key name as-is; it's a core educational asset) */
  insights: Insight[];
  /** Conflicting signals (if any) */
  conflictingSignals?: ConflictingSignal[];
  /**
   * Factor scores used by MatchOutcome (debug/traceability).
   * Present only for scenarioType === "MatchOutcome".
   */
  factorScores?: MatchOutcomeFactorScores;
  /** Most probable outcome (neutral, analytical) */
  mostProbableOutcome: string;
  /** Related scenarios (neutral reframing of alternatives) */
  relatedScenarios?: RelatedScenario[];
  /** Adjustments applied (for transparency) */
  adjustmentsApplied?: Adjustment[];
  /** Total adjustment magnitude */
  totalAdjustment?: number;
  /** Whether caps were hit */
  capsHit?: boolean;
  /** Overcorrection warning (if any) */
  overcorrectionWarning?: string;
}

// ============================================================================
// MATCH CONTEXT TYPES
// ============================================================================

/**
 * Formation stability analysis result
 */
export interface FormationStabilityContext {
  /** Home team's match formation */
  homeFormation: string | null;
  /** Away team's match formation */
  awayFormation: string | null;
  /** Home team's most played formation */
  homeMostPlayedFormation: string;
  /** Away team's most played formation */
  awayMostPlayedFormation: string;
  /** Home formation usage percentage */
  homeFormationUsage: number;
  /** Away formation usage percentage */
  awayFormationUsage: number;
  /** Home team is experimental */
  homeIsExperimental: boolean;
  /** Away team is experimental */
  awayIsExperimental: boolean;
  /** Confidence reduction for home team (0-25%) */
  homeFormationReduction: number;
  /** Confidence reduction for away team (0-25%) */
  awayFormationReduction: number;
  /** Total formation reduction (capped at 30%) */
  totalFormationReduction: number;
}

/**
 * Match context information
 */
export interface MatchContext {
  /** Match type (league, cup, etc.) */
  matchType: MatchType;
  /** Match importance (low/medium/high/critical) */
  matchImportance: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  /** Whether this match is a knockout stage */
  isKnockout: boolean;
  /** Stage name (e.g. Quarter-Final) when detected */
  stageName?: string | null;
  /** Whether this is a derby/rivalry match */
  isDerby: boolean;
  /** Whether match is at neutral venue */
  isNeutralVenue: boolean;
  /** Whether it's early season (< 5 rounds) */
  isEarlySeason: boolean;
  /** Current round number */
  roundNumber: number | null;
  /** Whether match is post-international break */
  isPostInternationalBreak: boolean;
  /** Whether it's end of season (last 5 rounds) */
  isEndOfSeason: boolean;
  /** Home team's season stakes (what they're fighting for) */
  homeStakes?: SeasonStakes;
  /** Away team's season stakes (what they're fighting for) */
  awayStakes?: SeasonStakes;
  /** Whether this is a six-pointer (both teams fighting for same objective) */
  isSixPointer?: boolean;
  /** End-of-season context summary (human-readable) */
  endOfSeasonSummary?: string;
  /** Formation stability context */
  formationStability: FormationStabilityContext;
  /** Home team domestic league (for international matches) */
  homeDomesticLeagueId?: number;
  /** Away team domestic league (for international matches) */
  awayDomesticLeagueId?: number;
}

/**
 * Season stakes - what a team is fighting for at end of season
 */
export type SeasonStakes =
  | "TITLE_RACE"
  | "CL_QUALIFICATION"
  | "EUROPA_RACE"
  | "CONFERENCE_RACE"
  | "RELEGATION_BATTLE"
  | "NOTHING_TO_PLAY"
  | "ALREADY_RELEGATED"
  | "ALREADY_CHAMPION";

// ============================================================================
// CONFIGURATION TYPES
// ============================================================================

/**
 * Probability caps configuration
 */
export interface ProbabilityCapsConfig {
  /** Maximum swing from base probability (default: 22) */
  maxSwing: number;
  /** Minimum probability (default: 20) */
  minProb: number;
  /** Maximum probability (default: 80) */
  maxProb: number;
}

/**
 * Confidence downgrade configuration
 */
export interface ConfidenceDowngradeConfig {
  /** Threshold for large swing downgrade (default: 15) */
  largeSwingThreshold: number;
  /** Threshold for medium swing downgrade (default: 10) */
  mediumSwingThreshold: number;
  /** Threshold for too many adjustments (default: 4) */
  manyAdjustmentsThreshold: number;
}

/**
 * Asymmetric caps for a market direction
 */
export interface MarketDirectionCaps {
  /** Maximum upward adjustment */
  upMax: number;
  /** Maximum downward adjustment */
  downMax: number;
  /** Risk multiplier for false positives (optional) */
  upRiskMultiplier?: number;
  /** Risk multiplier for false negatives (optional) */
  downRiskMultiplier?: number;
}

/**
 * Asymmetric weighting configuration per market
 */
export interface AsymmetricWeightingConfig {
  btts: MarketDirectionCaps;
  overUnderGoals: MarketDirectionCaps;
  matchResult: MarketDirectionCaps;
  firstHalf: MarketDirectionCaps;
}

/**
 * Cumulative caps per adjustment type
 */
export interface CumulativeCapsConfig {
  formation: number;
  injuries: number;
  dna: number;
  safety: number;
  rest: number;
}

/**
 * Goal distribution configuration
 */
export interface GoalDistributionConfig {
  /** Max goals per team in score matrix */
  maxGoals: number;
  /** Recent-form blend weight (0-1) */
  recentFormWeight: number;
  /** Recent matches count for form blend */
  recentMatchesCount: number;
  /** Dixon-Coles low-score correction rho */
  dixonColesRho: number;
}

/**
 * Form weighting configuration
 */
export interface FormWeightingConfig {
  /** Decay factor for exponential weighting */
  alpha: number;
  /** Weight for recent games (last 2) */
  recentGamesWeight: number;
  /** Weight for mid games (3-5) */
  midGamesWeight: number;
  /** Weight for older games (6-10) */
  oldGamesWeight: number;
}

/**
 * H2H recency configuration
 */
export interface H2HRecencyConfig {
  /** Base for decay calculation */
  decayBase: number;
  /** Weight multiplier for current season matches */
  currentYearWeight: number;
  /** Weight multiplier for matches in last 3 months */
  recentMonthsWeight: number;
}

/**
 * Market weights configuration
 */
export interface MarketWeightsConfig {
  matchResult: {
    recentForm: number;
    h2h: number;
    homeAdvantage: number;
    motivation: number;
    rest: number;
    leaguePosition: number;
  };
  btts: {
    scoringRate: number;
    defensiveForm: number;
    recentForm: number;
    h2h: number;
  };
  overUnderGoals: {
    avgGoalsPerGame: number;
    defensiveWeakness: number;
    recentForm: number;
    h2h: number;
  };
  firstHalf: {
    firstHalfScoring: number;
    recentForm: number;
    h2h: number;
    homeAdvantage: number;
    motivation: number;
  };
}

/**
 * Tier thresholds for categorization
 */
export interface TierThresholds {
  /** EI threshold for Tier 1 (default: 2.0) */
  tier1: number;
  /** EI threshold for Tier 2 (default: 1.5) */
  tier2: number;
  /** EI threshold for Tier 3 (default: 1.0) */
  tier3: number;
}

/**
 * Complete algorithm configuration
 */
export interface AlgorithmConfig {
  formWeighting: FormWeightingConfig;
  h2hRecency: H2HRecencyConfig;
  marketWeights: MarketWeightsConfig;
  tierThresholds: TierThresholds;
  probabilityCaps: ProbabilityCapsConfig;
  confidenceDowngrade: ConfidenceDowngradeConfig;
  asymmetricWeighting: AsymmetricWeightingConfig;
  cumulativeCaps: CumulativeCapsConfig;
  goalDistribution: GoalDistributionConfig;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

/**
 * Data quality assessment
 */
export interface DataQuality {
  /** Mind layer data quality */
  mindDataQuality: ConfidenceLevel;
  /** Mood layer data quality */
  moodDataQuality: ConfidenceLevel;
  /** H2H data quality */
  h2hDataQuality: ConfidenceLevel;
  /** Overall confidence multiplier (0-1) */
  overallConfidenceMultiplier: number;
  /** Warnings about data quality */
  warnings: string[];
}

/**
 * Team context for API response
 */
export interface TeamContext {
  id: number;
  name: string;
  form: string;
  /**
   * League table position (only meaningful for LEAGUE matches).
   * Omitted for CUP/INTERNATIONAL/FRIENDLY to avoid misleading context.
   */
  leaguePosition?: number;
  daysSinceLastMatch: number;
  /**
   * League-table motivation (only meaningful for LEAGUE matches).
   * Omitted for CUP/INTERNATIONAL/FRIENDLY.
   */
  motivation?: MotivationLevel;
  mind: {
    /**
     * Performance tier (EI-based band).
     * NOTE: This is NOT a division/league-level tier.
     */
    performanceTier: TeamTier;
    /** Backwards compatible alias for `performanceTier`. */
    tier: TeamTier;
    efficiencyIndex: number;
    /**
     * Explicitly indicates whether tiering accounts for division/league strength.
     * Currently false: tiers are purely performance-based bands.
     */
    tierIsDivisionAware: boolean;
  };
  mood: {
    /**
     * Performance tier (EI-based band over recent matches).
     * NOTE: This is NOT a division/league-level tier.
     */
    performanceTier: TeamTier;
    /** Backwards compatible alias for `performanceTier`. */
    tier: TeamTier;
    isSleepingGiant: boolean;
    isOverPerformer: boolean;
    /** See `mind.tierIsDivisionAware`. */
    tierIsDivisionAware: boolean;
  };
  dna: {
    mostPlayedFormation: string;
    goalLineOverPct: GoalLineOverPctMap;
    cleanSheetPercentage: number;
    isLateStarter: boolean;
  };
  elo?: {
    rating: number;
    games: number;
    updatedAt?: string;
    confidence: number;
  };
  /** Timestamp for Elo rating snapshot (if available) */
  eloUpdatedAt?: string;
}

export interface MlDebugInfo {
  matchOutcome?: {
    rawPrediction: {
      home: number;
      draw: number;
      away: number;
    };
    features: Record<string, number | null | undefined>;
  };
}

export interface InsightsDebugPayload {
  matchOutcome?: {
    probabilities?: ProbabilityDistribution;
    factorScores?: MatchOutcomeFactorScores;
    adjustmentsApplied?: Adjustment[];
    totalAdjustment?: number;
    capsHit?: boolean;
    overcorrectionWarning?: string;
    signalStrength?: SignalStrength;
    modelReliability?: ConfidenceLevel;
    mlRawPrediction?: {
      home: number;
      draw: number;
      away: number;
    } | null;
    mlFeatures?: Record<string, number | null | undefined> | null;
  };
  elo?: {
    home?: TeamContext["elo"] | null;
    away?: TeamContext["elo"] | null;
  };
}

/**
 * Match facts for UI (observational, non-predictive).
 */
export interface FactCard {
  /** Stable identifier for client-side rendering */
  id: string;
  /** Short label for the fact */
  title: string;
  /** Primary value shown in the card */
  value: string;
  /** Optional supporting text (sample size, timeframe) */
  subtitle?: string;
  /** Which side the fact applies to */
  side?: "HOME" | "AWAY" | "BOTH";
  /** Optional icon hint for UI (e.g. '#') */
  icon?: string;
}

/**
 * Complete betting insights API response
 */
export interface BettingInsightsResponse {
  /** Fixture ID */
  fixtureId: number;
  /** Match information */
  match: {
    homeTeam: string;
    awayTeam: string;
    league: string;
    date: string;
    status: string;
  };
  /** Team contexts */
  homeTeamContext: TeamContext;
  awayTeamContext: TeamContext;
  /** Match context */
  matchContext: MatchContext;
  /** Scenario simulations */
  simulations: Simulation[];
  /** Top insights for home team */
  homeInsights: Insight[];
  /** Top insights for away team */
  awayInsights: Insight[];
  /** H2H insights */
  h2hInsights: Insight[];
  /** Match facts (always 6) */
  matchFacts?: FactCard[];
  /** Key insights for UI (max 3 each) */
  keyInsights?: {
    home: Insight[];
    away: Insight[];
  };
  /** Data quality assessment */
  dataQuality: DataQuality;
  /** Overall confidence */
  overallConfidence: ConfidenceLevel;
  /** Data sanity warnings (debug/quality signals) */
  sanityWarnings?: string[];
  /** Optional ML debug payload (raw model outputs + feature vector) */
  mlDebug?: MlDebugInfo;
  /** Optional debug payload for testing/analysis */
  debug?: InsightsDebugPayload;
  /** Snapshot timestamp when insights were generated */
  snapshotGeneratedAt?: string;
  /** Generated timestamp */
  generatedAt: string;
  /** Cache source (for debugging) */
  source?: string;
}

// ============================================================================
// RESULT TYPES FOR INTERNAL USE
// ============================================================================

/**
 * Result of applying capped asymmetric adjustments
 */
export interface CappedAdjustmentResult {
  /** Final probability after all adjustments and caps */
  finalProbability: number;
  /** Total adjustment before caps */
  totalAdjustmentBeforeCaps: number;
  /** Total adjustment after caps */
  totalAdjustmentAfterCaps: number;
  /** Adjustments that were applied (potentially capped) */
  appliedAdjustments: Adjustment[];
  /** Whether any caps were hit */
  capsHit: boolean;
  /** Confidence level after considering swings */
  adjustedConfidence: ConfidenceLevel;
  /** Overcorrection warning if detected */
  overcorrectionWarning?: string;
}

/**
 * Result of data aggregation from upstream endpoints
 */
export interface AggregatedData {
  /** Home team statistics from /teams/statistics */
  homeStats: unknown; // Will be typed when fetcher is implemented
  /** Away team statistics from /teams/statistics */
  awayStats: unknown;
  /** Home team last matches from /fixtures?team={id}&last=50 */
  homeMatches: unknown[];
  /** Away team last matches from /fixtures?team={id}&last=50 */
  awayMatches: unknown[];
  /** H2H data from /fixtures/headtohead */
  h2h: unknown;
}

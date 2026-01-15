/**
 * Betting Insights Module (barrel exports)
 *
 * Keep this file small and stable: only export the public surface that is
 * actually used by the backend app (routes + service + core types).
 */

// Config
export {
  createConfig,
  DEFAULT_ALGORITHM_CONFIG,
  getAsymmetricCaps,
  getMarketWeights
} from "./config/algorithm-config";
// Routes + Service
export { createInsightsRoutes } from "./routes/insights.routes";
export {
  InsightsNotAvailableError, insightsService, type InsightsEnv, type InsightsServiceResult
} from "./services/insights.service";

// Simulations
export { simulateBTTS } from "./simulations/simulate-btts";
export { simulateFirstHalfActivity } from "./simulations/simulate-first-half-activity";
export { simulateMatchOutcome } from "./simulations/simulate-match-outcome";
export { simulateTotalGoalsOverUnder } from "./simulations/simulate-total-goals-over-under";
export type {
  Adjustment,
  AdjustmentType,
  AlgorithmConfig,
  AsymmetricWeightingConfig,
  BettingInsightsResponse,
  ConfidenceLevel,
  DNALayer,
  FormationStabilityContext,
  GoalLine,
  GoalLineKey,
  GoalLineOverCountMap,
  GoalLineOverPctMap,
  H2HData,
  Insight,
  InsightCategory,
  InsightSeverity,
  MarketWeightsConfig,
  MatchContext,
  MatchResult,
  MatchType,
  MindLayer,
  MoodLayer,
  MotivationLevel,
  ProcessedMatch,
  RelatedScenario,
  SafetyFlags,
  ScenarioType,
  SignalStrength,
  Simulation,
  TeamContext,
  TeamData,
  TeamStatistics,
  TeamTier
} from "./types";
// Types
export { DEFAULT_GOAL_LINES } from "./types";

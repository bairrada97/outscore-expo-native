/**
 * Centralized Algorithm Configuration
 *
 * All configurable values for the betting insights algorithm.
 * These are the "safe launch" values from the algorithm document.
 *
 * Reference: docs/implementation-plan/phase4.5.md - Safe Launch Configuration
 * Algorithm: docs/betting-insights-Algorithm.md - Configuration sections
 */

import type {
	AlgorithmConfig,
	AsymmetricWeightingConfig,
	ConfidenceDowngradeConfig,
	CumulativeCapsConfig,
	FormWeightingConfig,
	GoalDistributionConfig,
	H2HRecencyConfig,
	MarketWeightsConfig,
	ProbabilityCapsConfig,
	ScenarioType,
	TierThresholds,
} from "../types";

// ============================================================================
// FORM WEIGHTING CONFIGURATION
// ============================================================================

/**
 * Form weighting configuration
 *
 * Controls how recent games are weighted more heavily than older games
 * Uses exponential decay with customizable weights per game period
 */
export const DEFAULT_FORM_WEIGHTING: FormWeightingConfig = {
	/** Decay factor for exponential weighting (0.85 = 15% decay per game) */
	alpha: 0.85,
	/** Weight for recent games (last 2) - most important */
	recentGamesWeight: 1.5,
	/** Weight for mid games (3-5) - moderate importance */
	midGamesWeight: 1.2,
	/** Weight for older games (6-10) - baseline */
	oldGamesWeight: 1.0,
};

// ============================================================================
// H2H RECENCY CONFIGURATION
// ============================================================================

/**
 * H2H recency configuration
 *
 * Controls how H2H matches are weighted based on recency
 * Recent matches and same-season matches get higher weight
 */
export const DEFAULT_H2H_RECENCY: H2HRecencyConfig = {
	/** Base for decay calculation (0.7 = 30% weight loss per year) */
	decayBase: 0.7,
	/** Weight multiplier for current season matches (20% boost) */
	currentYearWeight: 1.2,
	/** Weight multiplier for matches in last 3 months (10% boost) */
	recentMonthsWeight: 1.1,
};

// ============================================================================
// MARKET WEIGHTS CONFIGURATION
// ============================================================================

/**
 * Market weights configuration
 *
 * Defines how different factors are weighted for each market type
 * All weights within a market should conceptually sum to ~100%
 */
export const DEFAULT_MARKET_WEIGHTS: MarketWeightsConfig = {
	/**
	 * Match Result (1X2) weights
	 *
	 * Uses 6 factors as defined in Section 4.6.1:
	 * - Recent Form (30%): Compare home vs away form
	 * - H2H Record (25%): Win percentages from H2H
	 * - Home Advantage (20%): Dynamic based on stats
	 * - Motivation (18%): Who wants it more
	 * - Rest (12%): Days since last match
	 * - League Position (10%): Quality difference
	 */
	matchResult: {
		recentForm: 0.153075,
		h2h: 0.271733,
		homeAdvantage: 0.089243,
		motivation: 0.18,
		rest: 0.056428,
		leaguePosition: 0.249522,
	},

	/**
	 * BTTS weights
	 *
	 * Focused on scoring and defensive patterns:
	 * - Recent Form (35%): Scoring patterns most important
	 * - Scoring Rate (25%): Goals per game
	 * - H2H (25%): Historical BTTS rate
	 * - Defensive Form (20%): Clean sheet rates
	 */
	btts: {
		scoringRate: 0.133003,
		defensiveForm: 0.125112,
		recentForm: 0.238278,
		h2h: 0.503607,
	},

	/**
	 * Over/Under Goals (multi-line) weights
	 *
	 * Focused on total goal production (applied per line):
	 * - Average Goals (30%): Critical factor
	 * - Recent Form (30%): Scoring trends
	 * - Defensive Weakness (25%): Leaky defenses
	 * - H2H (20%): Historical goal totals
	 */
	overUnderGoals: {
		avgGoalsPerGame: 0.183971,
		defensiveWeakness: 0.134336,
		recentForm: 0.220855,
		h2h: 0.460838,
	},

	/**
	 * First Half weights
	 *
	 * Focused on early game patterns:
	 * - First Half Scoring (40%): Most critical for this market
	 * - Recent Form (25%): General form matters
	 * - H2H (20%): Historical first half patterns
	 * - Home Advantage (15%): Home teams start faster
	 * - Motivation (10%): High stakes = cautious starts
	 */
	firstHalf: {
		firstHalfScoring: 0.158537,
		recentForm: 0.205035,
		h2h: 0.396048,
		homeAdvantage: 0.14038,
		motivation: 0.1,
	},
};

// ============================================================================
// TIER THRESHOLDS
// ============================================================================

/**
 * Tier thresholds based on Efficiency Index
 *
 * EI = (Avg Points per Game) + (Goal Difference / 10)
 *
 * Tier 1: EI >= 2.0 (Elite - Man City, Liverpool level)
 * Tier 2: EI >= 1.5 (Top tier - Top 6 level)
 * Tier 3: EI >= 1.0 (Mid tier - Mid-table)
 * Tier 4: EI < 1.0 (Lower tier - Relegation battle)
 */
export const DEFAULT_TIER_THRESHOLDS: TierThresholds = {
	tier1: 2.0,
	tier2: 1.5,
	tier3: 1.0,
};

// ============================================================================
// PROBABILITY CAPS CONFIGURATION
// ============================================================================

/**
 * Probability caps configuration (Phase 4.5.1)
 *
 * Prevents wild probability swings and unrealistic simulations
 * These are the "safe launch" values
 */
export const DEFAULT_PROBABILITY_CAPS: ProbabilityCapsConfig = {
	/** Maximum swing from base probability (±38%) */
	maxSwing: 38,
	/** Minimum probability (never below 15%) */
	minProb: 15,
	/** Maximum probability (never above 90%) */
	maxProb: 90,
};

// ============================================================================
// CONFIDENCE DOWNGRADE CONFIGURATION
// ============================================================================

/**
 * Confidence downgrade configuration (Phase 4.5.2)
 *
 * Downgrades confidence when large probability swings occur
 * Ensures confidence matches the uncertainty level
 */
export const DEFAULT_CONFIDENCE_DOWNGRADE: ConfidenceDowngradeConfig = {
	/** Threshold for large swing (>15% = downgrade 2 levels) */
	largeSwingThreshold: 15,
	/** Threshold for medium swing (10-15% = downgrade 1 level) */
	mediumSwingThreshold: 10,
	/** Threshold for too many adjustments (>4 = downgrade) */
	manyAdjustmentsThreshold: 4,
};

// ============================================================================
// ASYMMETRIC WEIGHTING CONFIGURATION
// ============================================================================

/**
 * Asymmetric weighting configuration (Phase 4.5.3)
 *
 * Different caps for upward vs downward probability moves
 * Optimizes for profitability rather than just accuracy
 *
 * Philosophy:
 * - BTTS: Stricter upward caps (more costly to over-predict)
 * - Over/Under Goals: More lenient upward (high-scoring games easier to identify)
 * - Match Result: Very strict on favorites (avoid backing wrong favorite)
 * - First Half: Balanced
 */
export const DEFAULT_ASYMMETRIC_WEIGHTING: AsymmetricWeightingConfig = {
	btts: {
		upMax: 16, // Strict upward cap
		downMax: 20, // More lenient downward
		upRiskMultiplier: 1.2,
		downRiskMultiplier: 1.0,
	},
	overUnderGoals: {
		upMax: 22, // More lenient upward
		downMax: 18, // Stricter downward
		upRiskMultiplier: 0.9,
		downRiskMultiplier: 1.1,
	},
	matchResult: {
		upMax: 24, // Very strict upward (favorites)
		downMax: 38, // Very lenient downward (underdogs)
		upRiskMultiplier: 1.5,
		downRiskMultiplier: 0.8,
	},
	firstHalf: {
		upMax: 18, // Balanced
		downMax: 20, // Balanced
		upRiskMultiplier: 1.0,
		downRiskMultiplier: 1.0,
	},
};

// ============================================================================
// CUMULATIVE CAPS CONFIGURATION
// ============================================================================

/**
 * Cumulative caps per adjustment type (Phase 4.5.5)
 *
 * Prevents same-type adjustments from stacking excessively
 * Each type has a maximum cumulative adjustment
 */
export const DEFAULT_CUMULATIVE_CAPS: CumulativeCapsConfig = {
	/** Formation-related adjustments max */
	formation: 15,
	/** Injury-related adjustments max */
	injuries: 15,
	/** DNA layer adjustments max */
	dna: 8,
	/** Safety flag adjustments max */
	safety: 12,
	/** Rest-related adjustments max */
	rest: 5,
};

// ============================================================================
// GOAL DISTRIBUTION CONFIGURATION
// ============================================================================

export const DEFAULT_GOAL_DISTRIBUTION: GoalDistributionConfig = {
	maxGoals: 6,
	recentFormWeight: 0.15,
	recentMatchesCount: 8,
	dixonColesRho: -0.05,
};

// ============================================================================
// UNCAPPED MODE CONFIGURATION
// ============================================================================

/**
 * Uncapped mode configuration
 *
 * When enabled, bypasses cumulative caps, asymmetric caps, and overcorrection detection.
 * Uses ML-learned coefficients to directly translate factor scores to probability adjustments.
 * Only soft bounds are applied (5% min, 95% max) for safety.
 *
 * This mode produces probabilities closer to bookmaker-implied odds.
 */
export const UNCAPPED_MODE = {
	/** Enable uncapped mode (bypass all caps except soft bounds) */
	enabled: true,
	/** Minimum probability (soft bound) */
	softMinProb: 5,
	/** Maximum probability (soft bound) */
	softMaxProb: 95,
};

// ============================================================================
// ML-LEARNED FACTOR COEFFICIENTS (LEGACY/FALLBACK)
// ============================================================================

/**
 * Legacy factor coefficients for rule-based prediction mode
 *
 * IMPORTANT: When USE_ML_PREDICTION is enabled (default), these coefficients
 * are NOT used for base probability calculation. Instead, the trained LightGBM
 * models are used directly for inference.
 *
 * These coefficients are only used when:
 * 1. ML mode is explicitly disabled (useML: false)
 * 2. As fallback if ML models fail to load
 *
 * Each factor score ranges from -100 to +100.
 * The coefficient determines how much that factor can swing the probability.
 * Example: positionScore of -100 with coefficient 0.15 = -15% adjustment
 */
export const ML_FACTOR_COEFFICIENTS = {
	/** Match Outcome (1X2) factor coefficients (legacy - only used when ML disabled)
	 * 
	 * When ML is enabled, these are NOT used. The LightGBM model at
	 * ml/models/output/1x2/model.json handles the base probability calculation.
	 */
	matchOutcome: {
		/** Recent form comparison (-100 to +100) -> max ±12% */
		formScore: 0.12,
		/** Head-to-head record -> max ±22% (ML training showed 0.30, using conservative value) */
		h2hScore: 0.22,
		/** Dynamic home advantage -> max ±12% */
		homeAdvantageScore: 0.12,
		/** Motivation/stakes difference -> max ±7% */
		motivationScore: 0.07,
		/** Rest advantage -> max ±4% */
		restScore: 0.04,
		/** Quality/tier difference -> max ±15% */
		positionScore: 0.15,
	},
	/** BTTS factor coefficients */
	btts: {
		/** Combined scoring rate -> max ±12% */
		scoringRate: 0.12,
		/** Defensive weakness (inverse clean sheets) -> max ±10% */
		defensiveForm: 0.10,
		/** Recent BTTS patterns -> max ±15% */
		recentForm: 0.15,
		/** H2H BTTS rate -> max ±28% (ML training: 0.35, using 0.28 conservatively) */
		h2h: 0.28,
	},
	/** Total Goals factor coefficients */
	totalGoals: {
		/** Average goals per game profile -> max ±15% */
		avgGoalsPerGame: 0.15,
		/** Defensive weakness -> max ±12% */
		defensiveWeakness: 0.12,
		/** Recent form totals -> max ±12% */
		recentForm: 0.12,
		/** H2H totals tendency -> max ±15% (reduced from 0.26 to prevent overcorrection) */
		h2h: 0.15,
	},
};

// ============================================================================
// INJURY TIER MULTIPLIERS
// ============================================================================

/**
 * Injury impact multipliers based on team tier
 *
 * Elite teams have more squad depth, so injuries hurt less.
 * Weaker teams are more affected by missing players.
 */
export const INJURY_TIER_MULTIPLIERS: Record<number, number> = {
	1: 0.4, // Elite teams: injuries hurt 40% as much
	2: 0.6, // Strong teams: 60%
	3: 0.85, // Average teams: 85%
	4: 1.0, // Weak teams: full impact
};

/**
 * Opponent tier multiplier for injuries
 *
 * Injuries matter less when playing against weak opponents.
 */
export const INJURY_OPPONENT_MULTIPLIERS: Record<number, number> = {
	1: 1.0, // vs Elite: full impact
	2: 1.0, // vs Strong: full impact
	3: 0.7, // vs Average: 70%
	4: 0.5, // vs Weak: 50%
};

// ============================================================================
// COMPLETE DEFAULT CONFIGURATION
// ============================================================================

/**
 * Complete default algorithm configuration
 *
 * This is the "safe launch" configuration with conservative values
 * that have been validated through backtesting
 */
export const DEFAULT_ALGORITHM_CONFIG: AlgorithmConfig = {
	formWeighting: DEFAULT_FORM_WEIGHTING,
	h2hRecency: DEFAULT_H2H_RECENCY,
	marketWeights: DEFAULT_MARKET_WEIGHTS,
	tierThresholds: DEFAULT_TIER_THRESHOLDS,
	probabilityCaps: DEFAULT_PROBABILITY_CAPS,
	confidenceDowngrade: DEFAULT_CONFIDENCE_DOWNGRADE,
	asymmetricWeighting: DEFAULT_ASYMMETRIC_WEIGHTING,
	cumulativeCaps: DEFAULT_CUMULATIVE_CAPS,
	goalDistribution: DEFAULT_GOAL_DISTRIBUTION,
};

// ============================================================================
// CONFIGURATION HELPERS
// ============================================================================

/**
 * Create a configuration with custom overrides
 *
 * @param overrides - Partial config to merge with defaults
 * @returns Complete config with overrides applied
 */
export function createConfig(
	overrides: Partial<AlgorithmConfig> = {},
): AlgorithmConfig {
	return {
		...DEFAULT_ALGORITHM_CONFIG,
		...overrides,
		// Deep merge nested objects
		formWeighting: {
			...DEFAULT_ALGORITHM_CONFIG.formWeighting,
			...overrides.formWeighting,
		},
		h2hRecency: {
			...DEFAULT_ALGORITHM_CONFIG.h2hRecency,
			...overrides.h2hRecency,
		},
		marketWeights: {
			...DEFAULT_ALGORITHM_CONFIG.marketWeights,
			...overrides.marketWeights,
		},
		tierThresholds: {
			...DEFAULT_ALGORITHM_CONFIG.tierThresholds,
			...overrides.tierThresholds,
		},
		probabilityCaps: {
			...DEFAULT_ALGORITHM_CONFIG.probabilityCaps,
			...overrides.probabilityCaps,
		},
		confidenceDowngrade: {
			...DEFAULT_ALGORITHM_CONFIG.confidenceDowngrade,
			...overrides.confidenceDowngrade,
		},
		asymmetricWeighting: {
			...DEFAULT_ALGORITHM_CONFIG.asymmetricWeighting,
			...overrides.asymmetricWeighting,
		},
		cumulativeCaps: {
			...DEFAULT_ALGORITHM_CONFIG.cumulativeCaps,
			...overrides.cumulativeCaps,
		},
		goalDistribution: {
			...DEFAULT_ALGORITHM_CONFIG.goalDistribution,
			...overrides.goalDistribution,
		},
	};
}

/**
 * Get market-specific weights
 *
 * @param market - Market type
 * @param config - Algorithm configuration
 * @returns Market weights or undefined if not found
 */
export function getMarketWeights(
	scenarioType: ScenarioType,
	config: AlgorithmConfig = DEFAULT_ALGORITHM_CONFIG,
): Record<string, number> | undefined {
	switch (scenarioType) {
		case "MatchOutcome":
			return config.marketWeights.matchResult;
		case "BothTeamsToScore":
			return config.marketWeights.btts;
		case "TotalGoalsOverUnder":
			return config.marketWeights.overUnderGoals;
		case "FirstHalfActivity":
			return config.marketWeights.firstHalf;
		default:
			return undefined;
	}
}

/**
 * Get asymmetric caps for a market
 *
 * @param market - Market type
 * @param config - Algorithm configuration
 * @returns Market direction caps
 */
export function getAsymmetricCaps(
	scenarioType: ScenarioType,
	config: AlgorithmConfig = DEFAULT_ALGORITHM_CONFIG,
) {
	switch (scenarioType) {
		case "BothTeamsToScore":
			return config.asymmetricWeighting.btts;
		case "TotalGoalsOverUnder":
			return config.asymmetricWeighting.overUnderGoals;
		case "MatchOutcome":
			return config.asymmetricWeighting.matchResult;
		case "FirstHalfActivity":
			return config.asymmetricWeighting.firstHalf;
		default:
			return config.asymmetricWeighting.btts;
	}
}

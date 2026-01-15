/**
 * Capped Adjustments - Unified Helper Function
 *
 * CRITICAL: ALL simulations must use this unified function.
 * DO NOT apply adjustments directly to probabilities.
 *
 * This module provides:
 * - applyCappedAsymmetricAdjustments() - Main entry point
 * - Cumulative caps per adjustment type
 * - Asymmetric weighting per market
 * - Overcorrection detection
 * - Hard probability caps
 * - Confidence downgrade calculation
 *
 * Reference: docs/implementation-plan/phase4.5.md - Section 4.5.6
 * Algorithm: docs/betting-insights-Algorithm.md - Probability Caps section
 */

import type {
  ScenarioType,
  ConfidenceLevel,
  AlgorithmConfig,
  Adjustment,
  AdjustmentType,
} from '../types';
import {
  DEFAULT_ALGORITHM_CONFIG,
  getAsymmetricCaps,
} from '../config/algorithm-config';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Adjustment type categories for cumulative caps
 * This is an alias for local use - matches AdjustmentType from types.ts
 */
export type AdjustmentCategory =
  | 'formation'
  | 'injuries'
  | 'dna'
  | 'safety'
  | 'rest'
  | 'motivation'
  | 'h2h'
  | 'context'
  | 'other';

/**
 * Result from applying capped adjustments
 */
export interface CappedAdjustmentResult {
  finalProbability: number;
  baseProbability: number;
  totalAdjustment: number;
  cappedAdjustments: Adjustment[];
  wasCapped: boolean;
  overcorrectionWarning?: string;
  confidenceLevel: ConfidenceLevel;
  adjustmentSummary: {
    totalPositive: number;
    totalNegative: number;
    adjustmentCount: number;
    categorySummary: Record<AdjustmentCategory, number>;
  };
}

// ============================================================================
// MAIN UNIFIED FUNCTION
// ============================================================================

/**
 * Apply all capping, asymmetric weighting, and overcorrection protection
 *
 * USAGE PATTERN (CRITICAL):
 * ```typescript
 * // 1. Calculate base probability
 * const baseProbability = calculateBaseProbability(...);
 *
 * // 2. Collect ALL adjustments in array (NEVER apply directly!)
 * const adjustments: Adjustment[] = [];
 * if (condition1) adjustments.push({ type: 'formation', value: 5, reason: 'why' });
 * if (condition2) adjustments.push({ type: 'rest', value: -3, reason: 'why' });
 *
 * // 3. Apply unified capping function
 * const result = applyCappedAsymmetricAdjustments(baseProbability, adjustments, market, config);
 *
 * // 4. Use result.finalProbability and result.confidenceLevel
 * ```
 *
 * @param baseProbability - Starting probability before adjustments (0-100)
 * @param adjustments - Array of adjustments to apply
 * @param market - Market type for asymmetric caps
 * @param config - Algorithm configuration
 * @param baseConfidence - Starting confidence level
 * @returns CappedAdjustmentResult with final probability and metadata
 */
export function applyCappedAsymmetricAdjustments(
  baseProbability: number,
  adjustments: Adjustment[],
  scenarioType: ScenarioType,
  config: AlgorithmConfig = DEFAULT_ALGORITHM_CONFIG,
  baseConfidence: ConfidenceLevel = 'MEDIUM',
): CappedAdjustmentResult {
  // Step 1: Apply cumulative caps per category
  const cumulativelyCapped = applyCumulativeCaps(adjustments, config);
  const cumulativeCapsApplied = cumulativelyCapped.some((a) =>
    a.reason.includes(' (capped)'),
  );

  // Step 2: Check for overcorrection
  const overcorrection = detectOvercorrection(cumulativelyCapped);

  // Step 3: Apply overcorrection reduction if needed
  let workingAdjustments = cumulativelyCapped;
  if (overcorrection.shouldReduce) {
    workingAdjustments = workingAdjustments.map((adj) => ({
      ...adj,
      value: adj.value * overcorrection.reductionFactor,
    }));
  }

  // Step 4: Apply asymmetric caps per market
  const caps = getAsymmetricCaps(scenarioType, config);
  const asymmetricCapsApplied = workingAdjustments.some((adj) => {
    if (adj.value > 0) return adj.value > caps.upMax;
    if (adj.value < 0) return Math.abs(adj.value) > caps.downMax;
    return false;
  });
  const asymmetricCapped = applyAsymmetricCaps(workingAdjustments, scenarioType, config);

  // Step 5: Calculate total adjustment
  const totalAdjustmentBeforeHardSwingCap = asymmetricCapped.reduce(
    (sum, adj) => sum + adj.value,
    0,
  );
  let totalAdjustment = totalAdjustmentBeforeHardSwingCap;

  // Step 6: Apply hard swing cap
  const maxSwing = config.probabilityCaps.maxSwing;
  const hardSwingCapApplied = Math.abs(totalAdjustment) > maxSwing;
  if (Math.abs(totalAdjustment) > maxSwing) {
    const sign = totalAdjustment > 0 ? 1 : -1;
    totalAdjustment = sign * maxSwing;
  }

  // Step 7: Calculate final probability
  const finalProbabilityBeforeBounds = baseProbability + totalAdjustment;
  let finalProbability = finalProbabilityBeforeBounds;

  // Step 8: Apply absolute bounds
  finalProbability = Math.max(
    config.probabilityCaps.minProb,
    Math.min(config.probabilityCaps.maxProb, finalProbability),
  );
  const boundsApplied =
    Math.abs(finalProbability - finalProbabilityBeforeBounds) > 0.0001;

  // Step 9: Calculate confidence with swing consideration
  const confidenceLevel = calculateConfidenceWithSwing(
    baseConfidence,
    Math.abs(totalAdjustment),
    adjustments.length,
    config,
  );

  // Step 10: Build summary
  const summary = buildAdjustmentSummary(asymmetricCapped);

  return {
    finalProbability,
    baseProbability,
    totalAdjustment,
    cappedAdjustments: asymmetricCapped,
    wasCapped:
      cumulativeCapsApplied ||
      asymmetricCapsApplied ||
      hardSwingCapApplied ||
      boundsApplied ||
      overcorrection.shouldReduce,
    overcorrectionWarning: overcorrection.shouldReduce
      ? overcorrection.reason
      : undefined,
    confidenceLevel,
    adjustmentSummary: summary,
  };
}

// ============================================================================
// CUMULATIVE CAPS
// ============================================================================

/**
 * Apply cumulative caps per adjustment category
 *
 * Prevents same-type adjustments from stacking excessively.
 * Example: Multiple formation adjustments capped at ±15% total.
 */
export function applyCumulativeCaps(
  adjustments: Adjustment[],
  config: AlgorithmConfig = DEFAULT_ALGORITHM_CONFIG,
): Adjustment[] {
  // Group adjustments by category
  const byCategory = new Map<AdjustmentCategory, Adjustment[]>();

  for (const adj of adjustments) {
    const category = categorizeAdjustment(adj);
    const existing = byCategory.get(category) || [];
    existing.push(adj);
    byCategory.set(category, existing);
  }

  // Apply caps per category
  const cappedAdjustments: Adjustment[] = [];

  for (const [category, categoryAdjs] of byCategory) {
    const maxCap = getCategoryCap(category, config);
    const totalValue = categoryAdjs.reduce((sum, adj) => sum + adj.value, 0);

    if (Math.abs(totalValue) <= maxCap) {
      // Within cap, use original adjustments
      cappedAdjustments.push(...categoryAdjs);
    } else {
      // Exceeds cap, scale all adjustments proportionally
      const scaleFactor = maxCap / Math.abs(totalValue);
      for (const adj of categoryAdjs) {
        cappedAdjustments.push({
          ...adj,
          value: adj.value * scaleFactor,
          reason: `${adj.reason} (capped)`,
        });
      }
    }
  }

  return cappedAdjustments;
}

/**
 * Categorize an adjustment by its type/name
 */
function categorizeAdjustment(adjustment: Adjustment): AdjustmentCategory {
  const name = adjustment.type?.toLowerCase() || adjustment.name?.toLowerCase() || '';

  if (name.includes('formation')) return 'formation';
  if (name.includes('injur')) return 'injuries';
  if (name.includes('dna') || name.includes('genetic')) return 'dna';
  if (name.includes('safety') || name.includes('regression') || name.includes('risk'))
    return 'safety';
  if (name.includes('rest') || name.includes('fatigue') || name.includes('congestion'))
    return 'rest';
  if (name.includes('motivation') || name.includes('momentum')) return 'motivation';
  if (name.includes('h2h') || name.includes('head')) return 'h2h';
  if (name.includes('context') || name.includes('derby') || name.includes('venue'))
    return 'context';

  return 'other';
}

/**
 * Get cumulative cap for a category
 */
function getCategoryCap(
  category: AdjustmentCategory,
  config: AlgorithmConfig,
): number {
  switch (category) {
    case 'formation':
      return config.cumulativeCaps.formation;
    case 'injuries':
      return config.cumulativeCaps.injuries;
    case 'dna':
      return config.cumulativeCaps.dna;
    case 'safety':
      return config.cumulativeCaps.safety;
    case 'rest':
      return config.cumulativeCaps.rest;
    default:
      return 15; // Default cap for uncategorized
  }
}

// ============================================================================
// OVERCORRECTION DETECTION
// ============================================================================

/**
 * Detect if adjustments are overcorrecting
 *
 * Triggers on:
 * - Too many adjustments (>5) WITH meaningful net swing (to reduce noise)
 * - Large total swing (>18%)
 * - Conflicting adjustments (positive + negative both >8%)
 */
export function detectOvercorrection(adjustments: Adjustment[]): {
  shouldReduce: boolean;
  reductionFactor: number;
  reason?: string;
} {
  if (adjustments.length === 0) {
    return { shouldReduce: false, reductionFactor: 1.0 };
  }

  const totalPositive = adjustments
    .filter((a) => a.value > 0)
    .reduce((sum, a) => sum + a.value, 0);

  const totalNegative = Math.abs(
    adjustments.filter((a) => a.value < 0).reduce((sum, a) => sum + a.value, 0),
  );

  const totalSwing = Math.abs(totalPositive - totalNegative);

  // Check: Too many adjustments
  // Only trigger this for "many adjustments" when the model is actually moving the needle.
  // Otherwise it becomes a noisy warning for cases where several small signals are present but net swing is modest.
  const MANY_ADJUSTMENTS_THRESHOLD = 5;
  const MANY_ADJUSTMENTS_SWING_THRESHOLD = 8;
  if (
    adjustments.length > MANY_ADJUSTMENTS_THRESHOLD &&
    totalSwing >= MANY_ADJUSTMENTS_SWING_THRESHOLD
  ) {
    return {
      shouldReduce: true,
      reductionFactor: 0.85,
      reason: `Too many adjustments (${adjustments.length})`,
    };
  }

  // Check: Large total swing
  if (totalSwing > 18) {
    return {
      shouldReduce: true,
      reductionFactor: 0.8,
      reason: `Large total swing (${totalSwing.toFixed(1)}%)`,
    };
  }

  // Check: Conflicting adjustments
  if (totalPositive > 8 && totalNegative > 8) {
    return {
      shouldReduce: true,
      reductionFactor: 0.75,
      reason: `Conflicting adjustments (+${totalPositive.toFixed(1)}% / -${totalNegative.toFixed(1)}%)`,
    };
  }

  return { shouldReduce: false, reductionFactor: 1.0 };
}

// ============================================================================
// ASYMMETRIC CAPS
// ============================================================================

/**
 * Apply asymmetric caps based on market type and direction
 *
 * Different markets have different risk/reward profiles:
 * - BTTS: Stricter upward (costly to over-predict)
 * - Match Result: Very strict on favorites
 */
export function applyAsymmetricCaps(
  adjustments: Adjustment[],
  scenarioType: ScenarioType,
  config: AlgorithmConfig = DEFAULT_ALGORITHM_CONFIG,
): Adjustment[] {
  const caps = getAsymmetricCaps(scenarioType, config);

  return adjustments.map((adj) => {
    if (adj.value > 0) {
      // Upward adjustment
      const capped = Math.min(adj.value, caps.upMax);
      return {
        ...adj,
        value: capped * (caps.upRiskMultiplier ?? 1.0),
      };
    } else if (adj.value < 0) {
      // Downward adjustment
      const capped = Math.max(adj.value, -caps.downMax);
      return {
        ...adj,
        value: capped * (caps.downRiskMultiplier ?? 1.0),
      };
    }
    return adj;
  });
}

// ============================================================================
// CONFIDENCE CALCULATION
// ============================================================================

/**
 * Calculate confidence level considering swing magnitude
 *
 * Large swings indicate uncertainty, requiring confidence downgrade
 */
export function calculateConfidenceWithSwing(
  baseConfidence: ConfidenceLevel,
  swingMagnitude: number,
  adjustmentCount: number,
  config: AlgorithmConfig = DEFAULT_ALGORITHM_CONFIG,
): ConfidenceLevel {
  let confidenceLevel = confidenceToNumber(baseConfidence);

  // Downgrade for large swing (>15%)
  if (swingMagnitude > config.confidenceDowngrade.largeSwingThreshold) {
    confidenceLevel -= 2;
  }
  // Downgrade for medium swing (10-15%)
  else if (swingMagnitude > config.confidenceDowngrade.mediumSwingThreshold) {
    confidenceLevel -= 1;
  }

  // Downgrade for many adjustments
  if (adjustmentCount > config.confidenceDowngrade.manyAdjustmentsThreshold) {
    confidenceLevel -= 1;
  }

  // Clamp to valid range
  confidenceLevel = Math.max(0, Math.min(2, confidenceLevel));

  return numberToConfidence(confidenceLevel);
}

/**
 * Convert confidence level to number for math
 */
function confidenceToNumber(confidence: ConfidenceLevel): number {
  switch (confidence) {
    case 'HIGH':
      return 2;
    case 'MEDIUM':
      return 1;
    case 'LOW':
      return 0;
    default:
      return 1;
  }
}

/**
 * Convert number back to confidence level
 */
function numberToConfidence(num: number): ConfidenceLevel {
  if (num >= 2) return 'HIGH';
  if (num >= 1) return 'MEDIUM';
  return 'LOW';
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Build summary of adjustments
 */
function buildAdjustmentSummary(adjustments: Adjustment[]): {
  totalPositive: number;
  totalNegative: number;
  adjustmentCount: number;
  categorySummary: Record<AdjustmentCategory, number>;
} {
  const categorySummary: Record<AdjustmentCategory, number> = {
    formation: 0,
    injuries: 0,
    dna: 0,
    safety: 0,
    rest: 0,
    motivation: 0,
    h2h: 0,
    context: 0,
    other: 0,
  };

  let totalPositive = 0;
  let totalNegative = 0;

  for (const adj of adjustments) {
    if (adj.value > 0) {
      totalPositive += adj.value;
    } else {
      totalNegative += Math.abs(adj.value);
    }

    const category = categorizeAdjustment(adj);
    categorySummary[category] += adj.value;
  }

  return {
    totalPositive,
    totalNegative,
    adjustmentCount: adjustments.length,
    categorySummary,
  };
}

/**
 * Valid adjustment types for the type field
 * Must match the AdjustmentType union from types.ts
 */
const VALID_ADJUSTMENT_TYPES: AdjustmentType[] = [
  'formation',
  'injuries',
  'dna',
  'safety',
  'rest',
  'motivation',
  'h2h',
  'context',
  'other',
];

/**
 * Create an adjustment object
 *
 * @param type - Type identifier (will be mapped to a valid AdjustmentType)
 * @param value - Adjustment value (positive = increase, negative = decrease)
 * @param reason - Human-readable explanation
 */
export function createAdjustment(
  type: string,
  value: number,
  reason: string,
): Adjustment {
  // Map the string type to a valid AdjustmentType
  const normalizedType = type.toLowerCase();
  const adjustmentType = VALID_ADJUSTMENT_TYPES.find((t) =>
    normalizedType.includes(t),
  ) ?? 'other';

  return {
    type: adjustmentType,
    name: type,
    value,
    reason,
  };
}

/**
 * Apply simple hard cap to a probability
 *
 * Simpler alternative when you don't need full tracking
 */
export function applyHardCap(
  probability: number,
  config: AlgorithmConfig = DEFAULT_ALGORITHM_CONFIG,
): number {
  return Math.max(
    config.probabilityCaps.minProb,
    Math.min(config.probabilityCaps.maxProb, probability),
  );
}

/**
 * Check if probability was capped
 */
export function wasProbabilityCapped(
  original: number,
  final: number,
): boolean {
  return Math.abs(original - final) > 0.01;
}

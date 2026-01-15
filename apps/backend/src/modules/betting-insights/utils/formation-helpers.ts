/**
 * Formation Helper Functions
 *
 * Functions for analyzing formation stability:
 * - Formation normalization (handling API inconsistencies)
 * - Formation parsing into structural components
 * - Formation similarity calculation
 * - Formation stability scoring
 *
 * Reference: docs/implementation-plan/phase1.md - Section 1.2.2-1.2.5
 * Algorithm: docs/betting-insights-Algorithm.md - Formation Stability Filter section
 */

import type { ProcessedMatch, FormationStabilityContext } from '../types';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Map formation variations to canonical forms
 *
 * Many formations are essentially the same but labeled differently:
 * - "4-1-2-3" and "4-3-3" are structurally similar
 * - "4-2-3-1" and "4-5-1" are variations
 *
 * This map normalizes to canonical forms for comparison
 */
export const FORMATION_CANONICAL_MAP: Record<string, string> = {
  // 4-3-3 family
  '4-3-3': '4-3-3',
  '4-1-2-3': '4-3-3',
  '4-2-1-3': '4-3-3',
  '4-1-4-1': '4-3-3', // Often labeled differently

  // 4-4-2 family
  '4-4-2': '4-4-2',
  '4-4-1-1': '4-4-2',
  '4-1-3-2': '4-4-2',

  // 4-2-3-1 family
  '4-2-3-1': '4-2-3-1',
  '4-5-1': '4-2-3-1',
  '4-1-4-1-old': '4-2-3-1',

  // 3-5-2 family
  '3-5-2': '3-5-2',
  '3-4-1-2': '3-5-2',
  '3-1-4-2': '3-5-2',

  // 3-4-3 family
  '3-4-3': '3-4-3',
  '3-4-2-1': '3-4-3',

  // 5-3-2 / 5-4-1 family
  '5-3-2': '5-3-2',
  '5-4-1': '5-4-1',
  '5-2-3': '5-3-2',

  // 4-1-2-1-2 family (diamond)
  '4-1-2-1-2': '4-1-2-1-2',
  '4-3-1-2': '4-1-2-1-2',
  '4-4-2-diamond': '4-1-2-1-2',

  // 4-3-2-1 (Christmas tree)
  '4-3-2-1': '4-3-2-1',
};

/**
 * Formation stability reduction tiers
 *
 * Based on formation usage percentage:
 * - <20% usage: 20-25% confidence reduction
 * - 20-40% usage: 10-15% reduction
 * - 40-60% usage: 5-10% reduction
 * - 60-80% usage: 0-5% reduction
 * - >80% usage: 0% reduction (stable)
 */
const FORMATION_STABILITY_TIERS = [
  { minUsage: 80, maxReduction: 0 },
  { minUsage: 60, maxReduction: 5 },
  { minUsage: 40, maxReduction: 10 },
  { minUsage: 20, maxReduction: 15 },
  { minUsage: 0, maxReduction: 25 },
] as const;

/**
 * Maximum combined formation reduction
 */
const MAX_COMBINED_FORMATION_REDUCTION = 30;

/**
 * Market-specific formation impact multipliers
 *
 * Match Result: Full reduction (1.0)
 * BTTS/Over/Under Goals: 40% less impact (0.6) - formations less critical for goal totals
 * First Half: 20% less impact (0.8)
 */
export const FORMATION_MARKET_IMPACT = {
  MATCH_RESULT: 1.0,
  BTTS: 0.6,
  OVER_UNDER_GOALS: 0.6,
  FIRST_HALF: 0.8,
} as const;

// ============================================================================
// FORMATION NORMALIZATION
// ============================================================================

/**
 * Normalize a formation string to canonical form
 *
 * Handles:
 * - Whitespace cleanup
 * - Common variations
 * - Invalid formats
 *
 * @param formation - Raw formation string from API
 * @returns Normalized canonical formation or original if no mapping
 */
export function normalizeFormation(formation: string | null | undefined): string {
  if (!formation) return '';

  // Clean up the string
  const cleaned = formation.trim().toLowerCase().replace(/\s+/g, '');

  // Try to find in canonical map
  const canonical = FORMATION_CANONICAL_MAP[cleaned];
  if (canonical) return canonical;

  // Try uppercase version
  const upperCleaned = cleaned.toUpperCase();
  const canonicalUpper = FORMATION_CANONICAL_MAP[upperCleaned];
  if (canonicalUpper) return canonicalUpper;

  // Return original (uppercased) if no mapping found
  return formation.trim();
}

/**
 * Parse formation into structural components
 *
 * @param formation - Formation string (e.g., "4-3-3")
 * @returns Parsed components or null if invalid
 */
export function parseFormation(formation: string): {
  defenders: number;
  midfielders: number;
  forwards: number;
  total: number;
  raw: number[];
} | null {
  if (!formation) return null;

  // Extract numbers
  const parts = formation.split('-').map((p) => parseInt(p.trim(), 10));

  // Filter out NaN values
  const validParts = parts.filter((p) => !isNaN(p) && p >= 0);

  if (validParts.length < 3) return null;

  // Standard formations have 3-5 parts (defenders, midfield line(s), forwards)
  const defenders = validParts[0];
  const forwards = validParts[validParts.length - 1];
  const midfielders = validParts.slice(1, -1).reduce((sum, n) => sum + n, 0);

  const total = defenders + midfielders + forwards;

  // Validate: should sum to 10 (outfield players)
  if (total < 9 || total > 11) return null;

  return {
    defenders,
    midfielders,
    forwards,
    total,
    raw: validParts,
  };
}

// ============================================================================
// FORMATION SIMILARITY
// ============================================================================

/**
 * Calculate similarity score between two formations (0-1)
 *
 * Based on structural similarity:
 * - Same formation = 1.0
 * - Same canonical form = 0.9
 * - Similar structure (±1 in each line) = 0.7-0.9
 * - Different structure = lower scores
 *
 * @param formation1 - First formation
 * @param formation2 - Second formation
 * @returns Similarity score (0-1)
 */
export function calculateFormationSimilarity(
  formation1: string | null | undefined,
  formation2: string | null | undefined,
): number {
  // Normalize both formations
  const norm1 = normalizeFormation(formation1);
  const norm2 = normalizeFormation(formation2);

  // If either is empty, return 0.5 (neutral)
  if (!norm1 || !norm2) return 0.5;

  // Exact match (after normalization)
  if (norm1 === norm2) return 1.0;

  // Parse both formations
  const parsed1 = parseFormation(norm1);
  const parsed2 = parseFormation(norm2);

  // If can't parse either, use string comparison
  if (!parsed1 || !parsed2) {
    // Try canonical form comparison
    const canonical1 = FORMATION_CANONICAL_MAP[norm1.toLowerCase()];
    const canonical2 = FORMATION_CANONICAL_MAP[norm2.toLowerCase()];

    if (canonical1 && canonical2 && canonical1 === canonical2) {
      return 0.9;
    }

    return 0.3; // Can't compare, assume different
  }

  // Calculate structural similarity
  const defDiff = Math.abs(parsed1.defenders - parsed2.defenders);
  const midDiff = Math.abs(parsed1.midfielders - parsed2.midfielders);
  const fwdDiff = Math.abs(parsed1.forwards - parsed2.forwards);

  // Total difference
  const totalDiff = defDiff + midDiff + fwdDiff;

  // Score based on difference
  // 0 diff = 1.0
  // 1 diff = 0.85
  // 2 diff = 0.7
  // 3 diff = 0.55
  // 4+ diff = 0.3-0.5
  const similarity = Math.max(0.3, 1.0 - totalDiff * 0.15);

  // Bonus for same number of defenders (defense shape matters most)
  const defenseBonus = defDiff === 0 ? 0.05 : 0;

  return Math.min(1.0, similarity + defenseBonus);
}

/**
 * Check if two formations are structurally similar
 *
 * @param formation1 - First formation
 * @param formation2 - Second formation
 * @param threshold - Similarity threshold (default: 0.7)
 * @returns true if formations are similar
 */
export function areFormationsSimilar(
  formation1: string | null | undefined,
  formation2: string | null | undefined,
  threshold: number = 0.7,
): boolean {
  return calculateFormationSimilarity(formation1, formation2) >= threshold;
}

// ============================================================================
// FORMATION FREQUENCY
// ============================================================================

/**
 * Calculate formation frequency from matches
 *
 * @param matches - Array of matches with formation data
 * @returns Map of formation -> usage percentage
 */
export function calculateFormationFrequency(
  matches: ProcessedMatch[],
): Record<string, number> {
  const frequency: Record<string, number> = {};

  // Filter matches with valid formations
  const matchesWithFormation = matches.filter((m) => m.formation);

  if (matchesWithFormation.length === 0) {
    return frequency;
  }

  // Count each formation (normalized)
  for (const match of matchesWithFormation) {
    const normalized = normalizeFormation(match.formation);
    if (normalized) {
      frequency[normalized] = (frequency[normalized] || 0) + 1;
    }
  }

  // Convert to percentages
  const total = matchesWithFormation.length;
  for (const formation in frequency) {
    frequency[formation] = (frequency[formation] / total) * 100;
  }

  return frequency;
}

/**
 * Get most played formation from matches
 *
 * @param matches - Array of matches with formation data
 * @returns Most played formation or empty string
 */
export function getMostPlayedFormation(matches: ProcessedMatch[]): string {
  const frequency = calculateFormationFrequency(matches);

  let mostPlayed = '';
  let maxCount = 0;

  for (const [formation, count] of Object.entries(frequency)) {
    if (count > maxCount) {
      maxCount = count;
      mostPlayed = formation;
    }
  }

  return mostPlayed;
}

/**
 * Get usage percentage for a specific formation
 *
 * @param formation - Formation to check
 * @param frequency - Formation frequency map
 * @returns Usage percentage (0-100)
 */
export function getFormationUsage(
  formation: string | null | undefined,
  frequency: Record<string, number>,
): number {
  if (!formation) return 0;

  const normalized = normalizeFormation(formation);

  // Direct match
  if (frequency[normalized]) {
    return frequency[normalized];
  }

  // Try canonical form
  const canonical = FORMATION_CANONICAL_MAP[normalized.toLowerCase()];
  if (canonical && frequency[canonical]) {
    return frequency[canonical];
  }

  // Check for similar formations
  let totalSimilar = 0;
  for (const [f, usage] of Object.entries(frequency)) {
    if (areFormationsSimilar(normalized, f, 0.85)) {
      totalSimilar += usage;
    }
  }

  return totalSimilar;
}

// ============================================================================
// FORMATION STABILITY CALCULATION
// ============================================================================

/**
 * Calculate formation stability score
 *
 * Returns confidence reduction based on how experimental the formation is
 *
 * @param matchFormation - Formation being used in the match
 * @param formationFrequency - Historical formation frequency
 * @param isEarlySeason - Whether it's early season (reduces penalty)
 * @returns Confidence reduction percentage (0-25)
 */
export function calculateFormationStability(
  matchFormation: string | null | undefined,
  formationFrequency: Record<string, number>,
  isEarlySeason: boolean = false,
): number {
  // No formation data = no penalty (can't determine)
  if (!matchFormation || Object.keys(formationFrequency).length === 0) {
    return 0;
  }

  const usage = getFormationUsage(matchFormation, formationFrequency);

  // Find the appropriate tier
  let reduction = 0;
  for (const tier of FORMATION_STABILITY_TIERS) {
    if (usage >= tier.minUsage) {
      reduction = tier.maxReduction;
      break;
    }
  }

  // Early season adjustment: reduce penalty by 50%
  // Teams experiment more early in the season
  if (isEarlySeason) {
    reduction *= 0.5;
  }

  return reduction;
}

/**
 * Check if a formation is experimental (rarely used)
 *
 * @param matchFormation - Formation being used
 * @param formationFrequency - Historical formation frequency
 * @param threshold - Usage percentage threshold (default: 20%)
 * @returns true if formation is experimental
 */
export function isExperimentalFormation(
  matchFormation: string | null | undefined,
  formationFrequency: Record<string, number>,
  threshold: number = 20,
): boolean {
  if (!matchFormation) return false;

  const usage = getFormationUsage(matchFormation, formationFrequency);
  return usage < threshold;
}

// ============================================================================
// FORMATION STABILITY CONTEXT
// ============================================================================

/**
 * Calculate complete formation stability context for a match
 *
 * @param homeFormation - Home team's match formation
 * @param awayFormation - Away team's match formation
 * @param homeFrequency - Home team's historical formation frequency
 * @param awayFrequency - Away team's historical formation frequency
 * @param homeMostPlayed - Home team's most played formation
 * @param awayMostPlayed - Away team's most played formation
 * @param isEarlySeason - Whether it's early season
 * @returns Complete formation stability context
 */
export function calculateFormationStabilityContext(
  homeFormation: string | null,
  awayFormation: string | null,
  homeFrequency: Record<string, number>,
  awayFrequency: Record<string, number>,
  homeMostPlayed: string,
  awayMostPlayed: string,
  isEarlySeason: boolean = false,
): FormationStabilityContext {
  // Calculate usage percentages
  const homeFormationUsage = getFormationUsage(homeFormation, homeFrequency);
  const awayFormationUsage = getFormationUsage(awayFormation, awayFrequency);

  // Calculate individual reductions
  const homeReduction = calculateFormationStability(
    homeFormation,
    homeFrequency,
    isEarlySeason,
  );
  const awayReduction = calculateFormationStability(
    awayFormation,
    awayFrequency,
    isEarlySeason,
  );

  // Combined reduction (capped at 30%)
  const totalReduction = Math.min(
    MAX_COMBINED_FORMATION_REDUCTION,
    homeReduction + awayReduction,
  );

  // Determine if experimental
  const homeIsExperimental = isExperimentalFormation(
    homeFormation,
    homeFrequency,
  );
  const awayIsExperimental = isExperimentalFormation(
    awayFormation,
    awayFrequency,
  );

  return {
    homeFormation,
    awayFormation,
    homeMostPlayedFormation: homeMostPlayed,
    awayMostPlayedFormation: awayMostPlayed,
    homeFormationUsage,
    awayFormationUsage,
    homeIsExperimental,
    awayIsExperimental,
    homeFormationReduction: homeReduction,
    awayFormationReduction: awayReduction,
    totalFormationReduction: totalReduction,
  };
}

/**
 * Get market-adjusted formation reduction
 *
 * @param baseReduction - Base formation reduction percentage
 * @param market - Market type
 * @returns Adjusted reduction for the market
 */
export function getMarketAdjustedFormationReduction(
  baseReduction: number,
  market: keyof typeof FORMATION_MARKET_IMPACT,
): number {
  const multiplier = FORMATION_MARKET_IMPACT[market] || 1.0;
  return baseReduction * multiplier;
}

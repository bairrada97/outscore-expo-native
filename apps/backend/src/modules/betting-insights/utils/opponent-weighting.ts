/**
 * Opponent Quality Weighting
 *
 * Adjusts team statistics based on the quality of opponents faced.
 * Beating top teams is worth more than beating relegation candidates.
 *
 * Reference: docs/betting-insights-algorithm.md - Opponent Quality section
 */

import type { TeamData, ProcessedMatch, TeamTier } from '../types';
import { clamp } from './helpers';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Opponent quality classification
 */
export type OpponentQuality = 'ELITE' | 'STRONG' | 'AVERAGE' | 'WEAK' | 'UNKNOWN';

/**
 * Weighted result for a match
 */
export interface WeightedMatchResult {
  /** Original match result */
  result: 'W' | 'D' | 'L';
  /** Quality of opponent */
  opponentQuality: OpponentQuality;
  /** Weight multiplier (0.5 - 1.5) */
  weight: number;
  /** Weighted points (3 for win * weight, 1 for draw * weight, 0 for loss) */
  weightedPoints: number;
}

/**
 * Opponent strength analysis
 */
export interface OpponentStrengthAnalysis {
  /** Average opponent quality faced */
  avgOpponentQuality: OpponentQuality;
  /** Percentage of matches vs elite/strong opponents */
  strongOpponentPct: number;
  /** Percentage of matches vs weak opponents */
  weakOpponentPct: number;
  /** Weighted points per game */
  weightedPPG: number;
  /** Raw points per game */
  rawPPG: number;
  /** Adjustment factor for form calculations */
  formAdjustmentFactor: number;
  /** Human-readable summary */
  summary: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Position thresholds for opponent quality (in a 20-team league)
 */
const QUALITY_THRESHOLDS = {
  ELITE: 4,      // Top 4
  STRONG: 8,     // 5th-8th
  AVERAGE: 14,   // 9th-14th
  WEAK: 20,      // 15th-20th
} as const;

/**
 * Weight multipliers by opponent quality
 */
const QUALITY_WEIGHTS: Record<OpponentQuality, number> = {
  ELITE: 1.5,
  STRONG: 1.25,
  AVERAGE: 1.0,
  WEAK: 0.75,
  UNKNOWN: 1.0,
};

/**
 * Tier-based quality mapping (when position is unknown)
 */
const TIER_TO_QUALITY: Record<TeamTier, OpponentQuality> = {
  1: 'ELITE',
  2: 'STRONG',
  3: 'AVERAGE',
  4: 'WEAK',
};

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

/**
 * Analyze opponent strength from team's recent matches
 *
 * @param team - Team data with recent matches
 * @param opponentPositions - Map of opponent team ID to league position (optional)
 * @returns Opponent strength analysis
 */
export function analyzeOpponentStrength(
  team: TeamData,
  opponentPositions?: Map<number, number>,
): OpponentStrengthAnalysis {
  const allMatches = [
    ...(team.lastHomeMatches ?? []),
    ...(team.lastAwayMatches ?? []),
  ].slice(0, 10); // Last 10 matches

  if (allMatches.length === 0) {
    return {
      avgOpponentQuality: 'UNKNOWN',
      strongOpponentPct: 0,
      weakOpponentPct: 0,
      weightedPPG: 0,
      rawPPG: 0,
      formAdjustmentFactor: 1.0,
      summary: 'Insufficient match data',
    };
  }

  // Calculate weighted results
  const weightedResults = allMatches.map((match) =>
    calculateWeightedResult(match, opponentPositions),
  );

  // Calculate statistics
  const totalWeightedPoints = weightedResults.reduce((sum, r) => sum + r.weightedPoints, 0);
  const totalRawPoints = weightedResults.reduce((sum, r) => {
    if (r.result === 'W') return sum + 3;
    if (r.result === 'D') return sum + 1;
    return sum;
  }, 0);

  const weightedPPG = totalWeightedPoints / allMatches.length;
  const rawPPG = totalRawPoints / allMatches.length;

  // Calculate quality distribution
  const strongCount = weightedResults.filter(
    (r) => r.opponentQuality === 'ELITE' || r.opponentQuality === 'STRONG',
  ).length;
  const weakCount = weightedResults.filter(
    (r) => r.opponentQuality === 'WEAK',
  ).length;

  const strongOpponentPct = (strongCount / allMatches.length) * 100;
  const weakOpponentPct = (weakCount / allMatches.length) * 100;

  // Determine average opponent quality
  const avgQualityScore = weightedResults.reduce((sum, r) => sum + getQualityScore(r.opponentQuality), 0) / allMatches.length;
  const avgOpponentQuality = scoreToQuality(avgQualityScore);

  // Calculate form adjustment factor
  // > 1 means team faced tough opponents (boost their form rating)
  // < 1 means team faced weak opponents (reduce their form rating)
  const formAdjustmentFactor = weightedPPG > 0 && rawPPG > 0 ? rawPPG / weightedPPG : 1.0;

  const summary = buildStrengthSummary(avgOpponentQuality, strongOpponentPct, weakOpponentPct);

  return {
    avgOpponentQuality,
    strongOpponentPct,
    weakOpponentPct,
    weightedPPG,
    rawPPG,
    formAdjustmentFactor: clamp(formAdjustmentFactor, 0.7, 1.3),
    summary,
  };
}

/**
 * Calculate opponent-weighted form score
 *
 * Adjusts form score based on quality of opponents faced.
 *
 * @param homeTeam - Home team data
 * @param awayTeam - Away team data
 * @param rawFormScore - Raw form score from form-score.ts
 * @param opponentPositions - Map of opponent team ID to league position (optional)
 * @returns Adjusted form score
 */
export function calculateWeightedFormScore(
  homeTeam: TeamData,
  awayTeam: TeamData,
  rawFormScore: number,
  opponentPositions?: Map<number, number>,
): {
  adjustedScore: number;
  homeAdjustment: number;
  awayAdjustment: number;
} {
  const homeStrength = analyzeOpponentStrength(homeTeam, opponentPositions);
  const awayStrength = analyzeOpponentStrength(awayTeam, opponentPositions);

  // Calculate adjustment factors
  const homeAdjustment = (homeStrength.formAdjustmentFactor - 1) * 10; // Convert to points
  const awayAdjustment = (awayStrength.formAdjustmentFactor - 1) * 10;

  // Apply adjustments to form score
  // If home team faced tougher opponents, boost their score
  // If away team faced tougher opponents, reduce the home advantage
  const adjustedScore = rawFormScore + homeAdjustment - awayAdjustment;

  return {
    adjustedScore: clamp(adjustedScore, -100, 100),
    homeAdjustment,
    awayAdjustment,
  };
}

/**
 * Get opponent quality from team position
 *
 * @param position - League position (1-20)
 * @param totalTeams - Total teams in league (default 20)
 * @returns Opponent quality classification
 */
export function getOpponentQuality(
  position: number | undefined,
  totalTeams: number = 20,
): OpponentQuality {
  if (!position) return 'UNKNOWN';

  // Normalize thresholds for different league sizes
  const scale = totalTeams / 20;
  const eliteThreshold = Math.ceil(QUALITY_THRESHOLDS.ELITE * scale);
  const strongThreshold = Math.ceil(QUALITY_THRESHOLDS.STRONG * scale);
  const avgThreshold = Math.ceil(QUALITY_THRESHOLDS.AVERAGE * scale);

  if (position <= eliteThreshold) return 'ELITE';
  if (position <= strongThreshold) return 'STRONG';
  if (position <= avgThreshold) return 'AVERAGE';
  return 'WEAK';
}

/**
 * Get opponent quality from team tier
 *
 * @param tier - Mind tier (1-5)
 * @returns Opponent quality classification
 */
export function getOpponentQualityFromTier(tier: TeamTier | undefined): OpponentQuality {
  if (!tier) return 'UNKNOWN';
  return TIER_TO_QUALITY[tier];
}

/**
 * Compare opponent strength between two teams
 *
 * @param homeTeam - Home team data
 * @param awayTeam - Away team data
 * @returns Comparison result
 */
export function compareOpponentStrength(
  homeTeam: TeamData,
  awayTeam: TeamData,
): {
  harderScheduleTeam: 'home' | 'away' | 'equal';
  scheduleDifference: number;
  summary: string;
} {
  const homeStrength = analyzeOpponentStrength(homeTeam);
  const awayStrength = analyzeOpponentStrength(awayTeam);

  const homeScore = getQualityScore(homeStrength.avgOpponentQuality);
  const awayScore = getQualityScore(awayStrength.avgOpponentQuality);

  const difference = homeScore - awayScore;

  let harderScheduleTeam: 'home' | 'away' | 'equal';
  if (Math.abs(difference) < 0.5) {
    harderScheduleTeam = 'equal';
  } else if (difference > 0) {
    harderScheduleTeam = 'home';
  } else {
    harderScheduleTeam = 'away';
  }

  const summary = buildComparisonSummary(harderScheduleTeam, homeStrength, awayStrength);

  return {
    harderScheduleTeam,
    scheduleDifference: Math.abs(difference),
    summary,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate weighted result for a single match
 */
function calculateWeightedResult(
  match: ProcessedMatch,
  opponentPositions?: Map<number, number>,
): WeightedMatchResult {
  const opponentId = match.isHome ? match.awayTeam.id : match.homeTeam.id;

  // Try to get opponent position
  const opponentPosition = opponentPositions?.get(opponentId);

  // Determine opponent quality
  const opponentQuality = opponentPosition
    ? getOpponentQuality(opponentPosition)
    : 'UNKNOWN';

  const weight = QUALITY_WEIGHTS[opponentQuality];

  // Calculate weighted points
  let weightedPoints = 0;
  if (match.result === 'W') {
    weightedPoints = 3 * weight;
  } else if (match.result === 'D') {
    weightedPoints = 1 * weight;
  }

  return {
    result: match.result,
    opponentQuality,
    weight,
    weightedPoints,
  };
}

/**
 * Get numeric score for quality level
 */
function getQualityScore(quality: OpponentQuality): number {
  switch (quality) {
    case 'ELITE': return 4;
    case 'STRONG': return 3;
    case 'AVERAGE': return 2;
    case 'WEAK': return 1;
    case 'UNKNOWN': return 2;
  }
}

/**
 * Convert quality score to quality level
 */
function scoreToQuality(score: number): OpponentQuality {
  if (score >= 3.5) return 'ELITE';
  if (score >= 2.5) return 'STRONG';
  if (score >= 1.5) return 'AVERAGE';
  return 'WEAK';
}

/**
 * Build human-readable strength summary
 */
function buildStrengthSummary(
  avgQuality: OpponentQuality,
  strongPct: number,
  weakPct: number,
): string {
  const parts: string[] = [];

  parts.push(`Avg opponent: ${avgQuality}`);

  if (strongPct >= 50) {
    parts.push(`faced tough schedule (${Math.round(strongPct)}% elite/strong)`);
  } else if (weakPct >= 50) {
    parts.push(`faced easy schedule (${Math.round(weakPct)}% weak)`);
  }

  return parts.join(', ');
}

/**
 * Build comparison summary
 */
function buildComparisonSummary(
  harderScheduleTeam: 'home' | 'away' | 'equal',
  homeStrength: OpponentStrengthAnalysis,
  awayStrength: OpponentStrengthAnalysis,
): string {
  if (harderScheduleTeam === 'equal') {
    return 'Both teams faced similar strength opponents';
  }

  const teamName = harderScheduleTeam === 'home' ? 'Home team' : 'Away team';
  const harder = harderScheduleTeam === 'home' ? homeStrength : awayStrength;

  return `${teamName} faced tougher opponents (${harder.avgOpponentQuality} avg)`;
}

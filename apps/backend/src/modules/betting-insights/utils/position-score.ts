/**
 * Position/Quality Score Calculation
 *
 * Calculates team quality difference based on:
 * - Mind tier (baseline quality from 50 matches)
 * - Efficiency Index (granular quality measure)
 *
 * Reference: docs/betting-insights-algorithm.md - Section 4.6.1 Factor 6
 */

import type { TeamData } from '../types';
import { clamp } from './helpers';

/**
 * Calculate position/quality score between home and away teams
 *
 * Uses Mind layer (50-match baseline) to determine relative quality.
 * Lower tier = better quality (1 is elite, 4 is struggling).
 *
 * @param homeTeam - Home team data
 * @param awayTeam - Away team data
 * @returns Score from -100 (away much better) to +100 (home much better)
 *
 * @example
 * // Home team tier 1 (elite), away team tier 3 (average)
 * calculatePositionScore(homeTeam, awayTeam); // Returns ~+60
 */
export function calculatePositionScore(
  homeTeam: TeamData,
  awayTeam: TeamData,
): number {
  // Use Mind tier (baseline quality over 50 matches)
  const homeTier = homeTeam.mind?.tier ?? 3;
  const awayTier = awayTeam.mind?.tier ?? 3;

  // Lower tier = better, so we calculate away - home
  const tierDiff = awayTier - homeTier;

  // Use Efficiency Index for more granularity
  // EI > 1.0 = overperforming, EI < 1.0 = underperforming
  const homeEI = homeTeam.mind?.efficiencyIndex ?? 1.0;
  const awayEI = awayTeam.mind?.efficiencyIndex ?? 1.0;
  const eiDiff = (homeEI - awayEI) * 20;

  // Combine: tier difference (major factor) + EI difference (refinement)
  return clamp(tierDiff * 30 + eiDiff, -100, 100);
}

/**
 * Get tier description for a team
 *
 * @param team - Team data
 * @returns Human-readable tier description
 */
export function getTierDescription(team: TeamData): string {
  const tier = team.mind?.tier ?? 3;

  switch (tier) {
    case 1:
      return 'Elite';
    case 2:
      return 'Strong';
    case 3:
      return 'Average';
    case 4:
      return 'Weak';
    default:
      return 'Unknown';
  }
}

/**
 * Check if there's a significant quality gap between teams
 *
 * @param homeTeam - Home team data
 * @param awayTeam - Away team data
 * @returns True if tier difference is 2+
 */
export function hasSignificantQualityGap(
  homeTeam: TeamData,
  awayTeam: TeamData,
): boolean {
  const homeTier = homeTeam.mind?.tier ?? 3;
  const awayTier = awayTeam.mind?.tier ?? 3;
  return Math.abs(homeTier - awayTier) >= 2;
}

/**
 * Determine which team is the favorite based on quality
 *
 * @param homeTeam - Home team data
 * @param awayTeam - Away team data
 * @returns 'home', 'away', or 'even'
 */
export function determineFavorite(
  homeTeam: TeamData,
  awayTeam: TeamData,
): 'home' | 'away' | 'even' {
  const score = calculatePositionScore(homeTeam, awayTeam);

  if (score > 25) return 'home';
  if (score < -25) return 'away';
  return 'even';
}

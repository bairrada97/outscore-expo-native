/**
 * Form Score Calculation
 *
 * Calculates a comparative form score between two teams based on:
 * - Mood tier (recent form indicator)
 * - Points accumulated in last 10 matches
 *
 * Reference: docs/betting-insights-algorithm.md - Section 4.6.1 Factor 1
 */

import type { TeamData } from '../types';
import { clamp } from './helpers';

/**
 * Calculate form score comparison between home and away teams
 *
 * Uses Mood layer data (recent 10 matches) to determine relative form.
 * Higher tier = worse form (1 is best, 4 is worst).
 *
 * @param homeTeam - Home team data
 * @param awayTeam - Away team data
 * @returns Score from -100 (away much better form) to +100 (home much better form)
 *
 * @example
 * // Home team in tier 1 form, away in tier 3
 * calculateFormScore(homeTeam, awayTeam); // Returns positive value (~60)
 */
export function calculateFormScore(
  homeTeam: TeamData,
  awayTeam: TeamData,
): number {
  // Use Mood tier as primary indicator (lower = better)
  const homeMoodTier = homeTeam.mood?.tier ?? 3;
  const awayMoodTier = awayTeam.mood?.tier ?? 3;

  // Also use form points from last 10 matches (W=3, D=1, L=0, max=30)
  const homeFormPoints = homeTeam.mood?.last10Points ?? 15;
  const awayFormPoints = awayTeam.mood?.last10Points ?? 15;

  // Calculate tier difference (home better = positive)
  // Higher tier number = worse, so we subtract home from away
  const tierDiff = awayMoodTier - homeMoodTier;

  // Calculate form points difference
  const formPointsDiff = homeFormPoints - awayFormPoints;

  // Combine scores:
  // - Tier difference worth ~30 points per tier level
  // - Form points difference normalized to ~40 point scale
  const tierScore = tierDiff * 30;
  const formScore = (formPointsDiff / 30) * 40;

  return clamp(tierScore + formScore, -100, 100);
}

/**
 * Get form quality descriptor for a team
 *
 * @param team - Team data
 * @returns Human-readable form quality
 */
export function getFormQuality(
  team: TeamData,
): 'Excellent' | 'Good' | 'Average' | 'Poor' {
  const tier = team.mood?.tier ?? 3;
  const points = team.mood?.last10Points ?? 15;

  if (tier === 1 || points >= 24) return 'Excellent';
  if (tier === 2 || points >= 18) return 'Good';
  if (tier === 3 || points >= 12) return 'Average';
  return 'Poor';
}

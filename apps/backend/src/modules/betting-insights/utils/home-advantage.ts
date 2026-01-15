/**
 * Home Advantage Score Calculation
 *
 * Calculates dynamic home advantage based on actual performance differences
 * between home and away matches for both teams.
 *
 * Reference: docs/betting-insights-algorithm.md - Section 4.6.1 Factor 3
 */

import type { TeamData } from '../types';
import { clamp } from './helpers';

/**
 * Calculate dynamic home advantage score
 *
 * Uses goal scoring differential as a proxy for home/away performance:
 * - Home team's scoring boost when playing at home vs away
 * - Away team's scoring penalty when playing away vs home
 *
 * @param homeTeam - Home team data
 * @param awayTeam - Away team data
 * @returns Score from -50 (no/negative home advantage) to +100 (strong home advantage)
 *
 * @example
 * // Home team scores 2.0 at home, 1.2 away (strong home boost)
 * // Away team scores 1.8 at home, 1.0 away (struggles away)
 * calculateHomeAdvantageScore(homeTeam, awayTeam); // Returns high positive value
 */
export function calculateHomeAdvantageScore(
  homeTeam: TeamData,
  awayTeam: TeamData,
): number {
  // Home team's scoring differential (home vs away)
  const homeTeamHomeScoringRate = homeTeam.stats?.homeAvgScored ?? 1.5;
  const homeTeamAwayScoringRate = homeTeam.stats?.awayAvgScored ?? 1.0;
  const homeBoost = (homeTeamHomeScoringRate - homeTeamAwayScoringRate) * 15;

  // Away team's scoring differential (home vs away)
  // A big drop-off indicates they struggle on the road
  const awayTeamAwayScoringRate = awayTeam.stats?.awayAvgScored ?? 1.0;
  const awayTeamHomeScoringRate = awayTeam.stats?.homeAvgScored ?? 1.5;
  const awayPenalty = (awayTeamHomeScoringRate - awayTeamAwayScoringRate) * 15;

  // Combine: home team's home boost + away team's road struggles
  const score = (homeBoost + awayPenalty) / 2;

  return clamp(score, -50, 100);
}

/**
 * Check if home team has a significant home advantage
 *
 * @param homeTeam - Home team data
 * @returns True if home team performs significantly better at home
 */
export function hasSignificantHomeAdvantage(homeTeam: TeamData): boolean {
  const homeScoring = homeTeam.stats?.homeAvgScored ?? 1.5;
  const awayScoring = homeTeam.stats?.awayAvgScored ?? 1.0;

  // More than 0.5 goals difference is significant
  return homeScoring - awayScoring > 0.5;
}

/**
 * Check if away team is a strong road team
 *
 * @param awayTeam - Away team data
 * @returns True if away team performs well on the road
 */
export function isStrongRoadTeam(awayTeam: TeamData): boolean {
  const homeScoring = awayTeam.stats?.homeAvgScored ?? 1.5;
  const awayScoring = awayTeam.stats?.awayAvgScored ?? 1.0;

  // Less than 0.3 goals difference means they maintain form away
  return homeScoring - awayScoring < 0.3;
}

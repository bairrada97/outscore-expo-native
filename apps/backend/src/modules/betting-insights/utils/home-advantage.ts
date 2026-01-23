/**
 * Home Advantage Score Calculation
 *
 * Calculates dynamic home advantage based on actual performance differences
 * between home and away matches for both teams, plus a baseline home advantage.
 *
 * Reference: docs/betting-insights-algorithm.md - Section 4.6.1 Factor 3
 */

import type { TeamData } from '../types';
import { clamp } from './helpers';
import { UNCAPPED_MODE } from '../config/algorithm-config';

/**
 * Baseline home advantage in football.
 * Research shows home teams win ~46% vs ~27% for away teams historically.
 * This provides a starting point before dynamic adjustments.
 */
const BASELINE_HOME_ADVANTAGE = 18;

/**
 * Calculate dynamic home advantage score
 *
 * Uses goal scoring differential as a proxy for home/away performance:
 * - Home team's scoring boost when playing at home vs away
 * - Away team's scoring penalty when playing away vs home
 * - Plus a baseline home advantage that exists in football
 *
 * @param homeTeam - Home team data
 * @param awayTeam - Away team data
 * @returns Score from -30 (elite road team vs poor home team) to +100 (strong home advantage)
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

  // Combine: baseline + home team's home boost + away team's road struggles
  // In uncapped mode, include baseline; in legacy mode, keep original behavior
  const dynamicScore = (homeBoost + awayPenalty) / 2;
  const baseline = UNCAPPED_MODE.enabled ? BASELINE_HOME_ADVANTAGE : 0;
  const score = baseline + dynamicScore;

  // Allow slightly negative for elite road teams, but cap at -30
  return clamp(score, -30, 100);
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

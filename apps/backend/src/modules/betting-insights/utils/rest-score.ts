/**
 * Rest Score Calculation
 *
 * Calculates rest advantage based on days since last match.
 * Optimal rest is 4-7 days - too short causes fatigue, too long causes rustiness.
 *
 * Reference: docs/betting-insights-algorithm.md - Section 4.6.1 Factor 5
 */

import type { TeamData } from '../types';
import { clamp } from './helpers';

/**
 * Rest quality scoring
 * Returns 0-5 scale where 5 is optimal rest
 */
const REST_QUALITY = {
  OPTIMAL: 5,      // 4-7 days
  SLIGHTLY_LONG: 4, // 8-9 days
  SLIGHTLY_SHORT: 3, // 3 days
  RUSTY: 2,         // >10 days
  FATIGUED: 1,      // <3 days
} as const;

/**
 * Calculate rest advantage score between home and away teams
 *
 * @param homeTeam - Home team data
 * @param awayTeam - Away team data
 * @returns Score from -100 (away much more rested) to +100 (home much more rested)
 *
 * @example
 * // Home team: 5 days rest (optimal), Away team: 2 days (fatigued)
 * calculateRestScore(homeTeam, awayTeam); // Returns high positive value
 */
export function calculateRestScore(
  homeTeam: TeamData,
  awayTeam: TeamData,
): number {
  const homeRest = homeTeam.daysSinceLastMatch ?? 7;
  const awayRest = awayTeam.daysSinceLastMatch ?? 7;

  const homeRestScore = calculateRestQuality(homeRest);
  const awayRestScore = calculateRestQuality(awayRest);

  // Each quality point difference worth 20 points
  return clamp((homeRestScore - awayRestScore) * 20, -100, 100);
}

/**
 * Calculate rest quality score for a given number of days
 *
 * @param days - Days since last match
 * @returns Quality score (1-5, where 5 is optimal)
 */
export function calculateRestQuality(days: number): number {
  if (days >= 4 && days <= 7) return REST_QUALITY.OPTIMAL;
  // Treat 8-10 days as "slightly long" (still generally fine, but can start to reduce sharpness).
  // Previously day=10 fell through to the default and was incorrectly treated as "slightly short".
  if (days >= 8 && days <= 10) return REST_QUALITY.SLIGHTLY_LONG;
  if (days === 3) return REST_QUALITY.SLIGHTLY_SHORT;
  if (days > 10) return REST_QUALITY.RUSTY;
  if (days < 3) return REST_QUALITY.FATIGUED;
  return REST_QUALITY.SLIGHTLY_SHORT;
}

/**
 * Check if a team has a fatigue risk
 *
 * @param team - Team data
 * @returns True if team played within last 3 days
 */
export function hasFatigueRisk(team: TeamData): boolean {
  const days = team.daysSinceLastMatch ?? 7;
  return days < 3;
}

/**
 * Check if a team has a rustiness risk
 *
 * @param team - Team data
 * @returns True if team hasn't played in over 10 days
 */
export function hasRustinessRisk(team: TeamData): boolean {
  const days = team.daysSinceLastMatch ?? 7;
  return days > 10;
}

/**
 * Get human-readable rest description
 *
 * @param days - Days since last match
 * @returns Human-readable rest status
 */
export function getRestDescription(days: number): string {
  if (days < 3) return 'Fatigued (short turnaround)';
  if (days === 3) return 'Slightly short rest';
  if (days >= 4 && days <= 7) return 'Optimal rest';
  if (days <= 9) return 'Slightly long rest';
  return 'Rusty (long break)';
}

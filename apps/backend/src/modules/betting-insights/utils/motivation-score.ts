/**
 * Motivation Score Calculation
 *
 * Calculates relative motivation levels between teams based on
 * their league standing situations (title race, relegation battle, etc.).
 *
 * Reference: docs/betting-insights-algorithm.md - Section 4.6.1 Factor 4
 */

import type { TeamData, MotivationLevel } from '../types';
import { clamp } from './helpers';

/**
 * Numeric value mapping for motivation levels
 * Higher value = more motivated
 */
const MOTIVATION_VALUES: Record<MotivationLevel, number> = {
  TITLE_RACE: 5,        // Maximum motivation - fighting for championship
  RELEGATION_BATTLE: 4, // Very high - survival instinct kicks in
  CL_RACE: 3,           // High - lucrative Champions League spots
  EUROPA_RACE: 2,       // Moderate - European football still desirable
  MID_TABLE: 1,         // Low - nothing significant to play for
  SECURE: 0,            // Minimal - season effectively over
};

/**
 * Calculate motivation score comparison between home and away teams
 *
 * Teams fighting for titles or avoiding relegation typically show
 * higher intensity and effort compared to mid-table teams.
 *
 * @param homeTeam - Home team data
 * @param awayTeam - Away team data
 * @returns Score from -100 (away much more motivated) to +100 (home much more motivated)
 *
 * @example
 * // Home team in title race, away team mid-table
 * calculateMotivationScore(homeTeam, awayTeam); // Returns ~+100
 */
export function calculateMotivationScore(
  homeTeam: TeamData,
  awayTeam: TeamData,
): number {
  const homeMotivation = getMotivationValue(homeTeam);
  const awayMotivation = getMotivationValue(awayTeam);

  // Each motivation level difference worth 25 points
  return clamp((homeMotivation - awayMotivation) * 25, -100, 100);
}

/**
 * Get numeric motivation value for a team
 *
 * @param team - Team data
 * @returns Numeric motivation value (0-5)
 */
export function getMotivationValue(team: TeamData): number {
  const motivation = team.safetyFlags?.motivation ?? 'MID_TABLE';
  return MOTIVATION_VALUES[motivation] ?? 1;
}

/**
 * Check if there's a motivation clash (significant difference)
 *
 * @param homeTeam - Home team data
 * @param awayTeam - Away team data
 * @returns True if motivation levels differ by 3+ levels
 */
export function hasMotivationClash(
  homeTeam: TeamData,
  awayTeam: TeamData,
): boolean {
  const homeValue = getMotivationValue(homeTeam);
  const awayValue = getMotivationValue(awayTeam);
  return Math.abs(homeValue - awayValue) >= 3;
}

/**
 * Get human-readable motivation description
 *
 * @param level - Motivation level
 * @returns Human-readable description
 */
export function getMotivationDescription(level: MotivationLevel): string {
  switch (level) {
    case 'TITLE_RACE':
      return 'Fighting for the title';
    case 'RELEGATION_BATTLE':
      return 'Battling relegation';
    case 'CL_RACE':
      return 'Chasing Champions League';
    case 'EUROPA_RACE':
      return 'Pursuing Europa League';
    case 'MID_TABLE':
      return 'Mid-table, nothing to play for';
    case 'SECURE':
      return 'Season objectives complete';
    default:
      return 'Unknown motivation';
  }
}

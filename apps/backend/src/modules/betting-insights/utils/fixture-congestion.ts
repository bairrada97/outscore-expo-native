/**
 * Fixture Congestion Detection
 *
 * Detects when teams have congested schedules (many games in short period).
 * Congestion affects player fatigue, rotation, and performance reliability.
 *
 * Reference: docs/betting-insights-algorithm.md - Fixture Congestion section
 */

import type { TeamData, ProcessedMatch } from '../types';
import { clamp } from './helpers';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Congestion level classification
 */
export type CongestionLevel = 'NONE' | 'LIGHT' | 'MODERATE' | 'HEAVY' | 'EXTREME';

/**
 * Congestion analysis result for a team
 */
export interface CongestionAnalysis {
  /** Congestion level */
  level: CongestionLevel;
  /** Number of matches in last 14 days */
  matchesLast14Days: number;
  /** Number of matches in last 30 days */
  matchesLast30Days: number;
  /** Average days between matches */
  avgDaysBetweenMatches: number;
  /** Whether rotation is likely */
  rotationLikely: boolean;
  /** Confidence reduction factor (0-20) */
  confidenceReduction: number;
  /** Human-readable description */
  description: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Congestion thresholds (matches in 14 days)
 */
const CONGESTION_THRESHOLDS = {
  NONE: 1,       // 0-1 matches
  LIGHT: 2,      // 2 matches
  MODERATE: 3,   // 3 matches
  HEAVY: 4,      // 4 matches
  EXTREME: 5,    // 5+ matches
} as const;

/**
 * Confidence reduction by congestion level
 */
const CONFIDENCE_REDUCTION = {
  NONE: 0,
  LIGHT: 2,
  MODERATE: 5,
  HEAVY: 10,
  EXTREME: 15,
} as const;

/**
 * Days to analyze for recent congestion
 */
const RECENT_DAYS = 14;

/**
 * Days to analyze for monthly congestion
 */
const MONTHLY_DAYS = 30;

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

/**
 * Analyze fixture congestion for a team
 *
 * @param team - Team data with recent matches
 * @param recentMatches - Recent matches (optional, will use team data if not provided)
 * @returns Congestion analysis
 */
export function analyzeCongestion(
  team: TeamData,
  recentMatches?: ProcessedMatch[],
): CongestionAnalysis {
  // Use team's matches if not provided
  const matches = recentMatches ?? [...(team.lastHomeMatches ?? []), ...(team.lastAwayMatches ?? [])];

  // Sort by date (most recent first)
  const sortedMatches = [...matches].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  const now = Date.now();

  // Count matches in time periods
  const matchesLast14Days = countMatchesInPeriod(sortedMatches, now, RECENT_DAYS);
  const matchesLast30Days = countMatchesInPeriod(sortedMatches, now, MONTHLY_DAYS);

  // Calculate average days between matches
  const avgDaysBetweenMatches = calculateAverageDaysBetween(sortedMatches, 5);

  // Determine congestion level
  const level = determineCongestionLevel(matchesLast14Days);

  // Determine if rotation is likely
  const rotationLikely = level === 'HEAVY' || level === 'EXTREME';

  // Get confidence reduction
  const confidenceReduction = CONFIDENCE_REDUCTION[level];

  // Build description
  const description = buildCongestionDescription(level, matchesLast14Days, avgDaysBetweenMatches);

  return {
    level,
    matchesLast14Days,
    matchesLast30Days,
    avgDaysBetweenMatches,
    rotationLikely,
    confidenceReduction,
    description,
  };
}

/**
 * Calculate congestion adjustment for simulations
 *
 * Returns a value that can be used to adjust probability/confidence.
 *
 * @param homeTeam - Home team data
 * @param awayTeam - Away team data
 * @returns Adjustment object with home/away impact values
 */
export function calculateCongestionAdjustment(
  homeTeam: TeamData,
  awayTeam: TeamData,
): {
  homeImpact: number;
  awayImpact: number;
  combinedConfidenceReduction: number;
} {
  const homeCongestion = analyzeCongestion(homeTeam);
  const awayCongestion = analyzeCongestion(awayTeam);

  // Impact: negative value means reduced expected performance
  const homeImpact = getCongestionImpact(homeCongestion.level);
  const awayImpact = getCongestionImpact(awayCongestion.level);

  // Combined confidence reduction
  const combinedConfidenceReduction = Math.min(
    20,
    homeCongestion.confidenceReduction + awayCongestion.confidenceReduction,
  );

  return {
    homeImpact,
    awayImpact,
    combinedConfidenceReduction,
  };
}

/**
 * Check if a team has significant fixture congestion
 *
 * @param team - Team data
 * @returns True if congestion is MODERATE or higher
 */
export function hasSignificantCongestion(team: TeamData): boolean {
  const analysis = analyzeCongestion(team);
  return analysis.level === 'MODERATE' ||
         analysis.level === 'HEAVY' ||
         analysis.level === 'EXTREME';
}

/**
 * Get congestion comparison between two teams
 *
 * @param homeTeam - Home team data
 * @param awayTeam - Away team data
 * @returns Who has more congestion and by how much
 */
export function compareCongestion(
  homeTeam: TeamData,
  awayTeam: TeamData,
): {
  moreCongestedTeam: 'home' | 'away' | 'equal';
  differenceScore: number;
  summary: string;
} {
  const homeCongestion = analyzeCongestion(homeTeam);
  const awayCongestion = analyzeCongestion(awayTeam);

  const homeScore = getCongestionScore(homeCongestion.level);
  const awayScore = getCongestionScore(awayCongestion.level);

  const difference = homeScore - awayScore;

  let moreCongestedTeam: 'home' | 'away' | 'equal';
  if (Math.abs(difference) < 1) {
    moreCongestedTeam = 'equal';
  } else if (difference > 0) {
    moreCongestedTeam = 'home';
  } else {
    moreCongestedTeam = 'away';
  }

  const summary = buildComparisonSummary(
    moreCongestedTeam,
    homeCongestion,
    awayCongestion,
  );

  return {
    moreCongestedTeam,
    differenceScore: Math.abs(difference),
    summary,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Count matches within a time period
 */
function countMatchesInPeriod(
  matches: ProcessedMatch[],
  now: number,
  days: number,
): number {
  const cutoff = now - days * 24 * 60 * 60 * 1000;
  return matches.filter((m) => new Date(m.date).getTime() >= cutoff).length;
}

/**
 * Calculate average days between recent matches
 */
function calculateAverageDaysBetween(
  matches: ProcessedMatch[],
  count: number,
): number {
  if (matches.length < 2) return 7; // Default if insufficient data

  const recentMatches = matches.slice(0, Math.min(count + 1, matches.length));

  if (recentMatches.length < 2) return 7;

  let totalDays = 0;
  let gaps = 0;

  for (let i = 0; i < recentMatches.length - 1; i++) {
    const current = new Date(recentMatches[i].date).getTime();
    const next = new Date(recentMatches[i + 1].date).getTime();
    const daysDiff = (current - next) / (24 * 60 * 60 * 1000);
    totalDays += daysDiff;
    gaps++;
  }

  return gaps > 0 ? Math.round(totalDays / gaps * 10) / 10 : 7;
}

/**
 * Determine congestion level from match count
 */
function determineCongestionLevel(matchesLast14Days: number): CongestionLevel {
  if (matchesLast14Days >= CONGESTION_THRESHOLDS.EXTREME) return 'EXTREME';
  if (matchesLast14Days >= CONGESTION_THRESHOLDS.HEAVY) return 'HEAVY';
  if (matchesLast14Days >= CONGESTION_THRESHOLDS.MODERATE) return 'MODERATE';
  if (matchesLast14Days >= CONGESTION_THRESHOLDS.LIGHT) return 'LIGHT';
  return 'NONE';
}

/**
 * Get numeric score for congestion level
 */
function getCongestionScore(level: CongestionLevel): number {
  switch (level) {
    case 'NONE': return 0;
    case 'LIGHT': return 1;
    case 'MODERATE': return 2;
    case 'HEAVY': return 3;
    case 'EXTREME': return 4;
  }
}

/**
 * Get performance impact from congestion level
 * Returns negative values (reduced expected performance)
 */
function getCongestionImpact(level: CongestionLevel): number {
  switch (level) {
    case 'NONE': return 0;
    case 'LIGHT': return -2;
    case 'MODERATE': return -5;
    case 'HEAVY': return -8;
    case 'EXTREME': return -12;
  }
}

/**
 * Build human-readable congestion description
 */
function buildCongestionDescription(
  level: CongestionLevel,
  matchesLast14Days: number,
  avgDays: number,
): string {
  switch (level) {
    case 'NONE':
      return 'No fixture congestion';
    case 'LIGHT':
      return `Light schedule (${matchesLast14Days} matches in 14 days)`;
    case 'MODERATE':
      return `Moderate congestion (${matchesLast14Days} matches in 14 days, avg ${avgDays} days between)`;
    case 'HEAVY':
      return `Heavy congestion (${matchesLast14Days} matches in 14 days) - rotation likely`;
    case 'EXTREME':
      return `Extreme congestion (${matchesLast14Days}+ matches in 14 days) - significant rotation expected`;
  }
}

/**
 * Build comparison summary
 */
function buildComparisonSummary(
  moreCongestedTeam: 'home' | 'away' | 'equal',
  homeCongestion: CongestionAnalysis,
  awayCongestion: CongestionAnalysis,
): string {
  if (moreCongestedTeam === 'equal') {
    return 'Both teams have similar fixture congestion';
  }

  const more = moreCongestedTeam === 'home' ? homeCongestion : awayCongestion;
  const less = moreCongestedTeam === 'home' ? awayCongestion : homeCongestion;
  const teamName = moreCongestedTeam === 'home' ? 'Home team' : 'Away team';

  return `${teamName} has more congestion (${more.level}) vs opponent (${less.level})`;
}

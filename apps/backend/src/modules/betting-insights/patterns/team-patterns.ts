/**
 * Team Pattern Detection
 *
 * Detects patterns in team performance data including:
 * - Form streaks (winning, losing, unbeaten)
 * - Scoring patterns (high scoring, scoring drought)
 * - Defensive patterns (clean sheets, defensive weakness)
 * - First half patterns
 * - Mind/Mood patterns (Sleeping Giant, Over-Performer)
 *
 * Reference: docs/implementation-plan/phase2.md - Section 2.1
 * Algorithm: docs/betting-insights-Algorithm.md - Pattern Detection section
 */

import type { ProcessedMatch, TeamTier, MindLayer, MoodLayer } from '../types';
import {
  countConsecutiveWins,
  countConsecutiveLosses,
  countConsecutiveDraws,
  countConsecutiveUnbeaten,
  countConsecutiveWinless,
  countConsecutiveMatchesWithGoals,
  countConsecutiveMatchesWithoutGoals,
  countConsecutiveCleanSheets,
  countConsecutiveMatchesWithoutCleanSheet,
  countConsecutiveMultiGoalsConceded,
  countConsecutiveBTTS,
  countConsecutiveNoBTTS,
  countConsecutiveOver25,
  countConsecutiveUnder25,
} from '../utils/streak-helpers';

// ============================================================================
// PATTERN TYPES
// ============================================================================

/**
 * Pattern type enumeration
 */
export type PatternType =
  | 'LONG_WINNING_STREAK'
  | 'LONG_LOSING_STREAK'
  | 'LONG_UNBEATEN_STREAK'
  | 'LONG_WINLESS_STREAK'
  | 'SCORING_STREAK'
  | 'SCORING_DROUGHT'
  | 'CLEAN_SHEET_STREAK'
  | 'CLEAN_SHEET_DROUGHT'
  | 'DEFENSIVE_COLLAPSE'
  | 'HIGH_SCORING_FORM'
  | 'DEFENSIVE_WEAKNESS'
  | 'FIRST_HALF_WEAKNESS'
  | 'FIRST_HALF_STRENGTH'
  | 'BTTS_STREAK'
  | 'NO_BTTS_STREAK'
  | 'OVER_25_STREAK'
  | 'UNDER_25_STREAK'
  | 'SLEEPING_GIANT'
  | 'OVER_PERFORMER'
  | 'REGRESSION_RISK'
  | 'ONE_SEASON_WONDER'
  | 'HOME_FORM_COLLAPSE'
  | 'AWAY_DOMINANCE';

/**
 * Pattern severity levels
 */
export type PatternSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * Detected pattern structure
 */
export interface Pattern {
  type: PatternType;
  severity: PatternSeverity;
  priority: number;
  description: string;
  data: Record<string, unknown>;
}

// ============================================================================
// THRESHOLDS
// ============================================================================

/**
 * Streak thresholds for pattern detection
 */
const STREAK_THRESHOLDS = {
  // Winning streak
  winningCritical: 8,
  winningHigh: 5,
  winningMedium: 3,

  // Losing streak
  losingCritical: 8,
  losingHigh: 5,
  losingMedium: 3,

  // Unbeaten streak
  unbeatenHigh: 8,
  unbeatenMedium: 5,

  // Winless streak
  winlessHigh: 8,
  winlessMedium: 5,

  // Scoring streak
  scoringHigh: 8,
  scoringMedium: 5,

  // Clean sheet drought
  cleanSheetDroughtCritical: 12,
  cleanSheetDroughtHigh: 8,
  cleanSheetDroughtMedium: 5,

  // BTTS streak
  bttsHigh: 5,
  bttsMedium: 3,

  // Over 2.5 streak
  over25High: 5,
  over25Medium: 3,
} as const;

/**
 * Performance thresholds
 */
const PERFORMANCE_THRESHOLDS = {
  // High scoring form (average goals scored per game)
  highScoringHigh: 3.0,
  highScoringMedium: 2.5,

  // Defensive weakness (average goals conceded per game)
  defensiveWeaknessHigh: 2.5,
  defensiveWeaknessMedium: 2.0,

  // First half weakness/strength
  firstHalfWeakness: 0.3, // < 30% of matches with first half goals
  firstHalfStrength: 0.7, // > 70% of matches with first half goals
} as const;

/**
 * Priority scores for patterns (higher = more important)
 */
const PATTERN_PRIORITIES: Record<PatternType, number> = {
  LONG_LOSING_STREAK: 100,
  LONG_WINNING_STREAK: 95,
  SLEEPING_GIANT: 92,
  OVER_PERFORMER: 90,
  REGRESSION_RISK: 88,
  LONG_UNBEATEN_STREAK: 85,
  LONG_WINLESS_STREAK: 85,
  DEFENSIVE_COLLAPSE: 82,
  DEFENSIVE_WEAKNESS: 80,
  HIGH_SCORING_FORM: 78,
  CLEAN_SHEET_DROUGHT: 75,
  SCORING_DROUGHT: 75,
  SCORING_STREAK: 72,
  CLEAN_SHEET_STREAK: 70,
  BTTS_STREAK: 68,
  NO_BTTS_STREAK: 65,
  OVER_25_STREAK: 62,
  UNDER_25_STREAK: 60,
  FIRST_HALF_WEAKNESS: 55,
  FIRST_HALF_STRENGTH: 52,
  ONE_SEASON_WONDER: 50,
  HOME_FORM_COLLAPSE: 48,
  AWAY_DOMINANCE: 45,
};

// ============================================================================
// MAIN DETECTION FUNCTION
// ============================================================================

/**
 * Detect all patterns for a team
 *
 * @param matches - Team's processed matches (most recent first)
 * @param mind - Mind layer data (optional)
 * @param mood - Mood layer data (optional)
 * @param teamName - Team name for descriptions
 * @returns Array of detected patterns
 */
export function detectTeamPatterns(
  matches: ProcessedMatch[],
  mind?: MindLayer,
  mood?: MoodLayer,
  teamName: string = 'Team',
): Pattern[] {
  const patterns: Pattern[] = [];

  if (matches.length === 0) {
    return patterns;
  }

  // Detect streak patterns
  patterns.push(...detectStreakPatterns(matches, teamName));

  // Detect performance patterns
  patterns.push(...detectPerformancePatterns(matches, teamName));

  // Detect first half patterns
  patterns.push(...detectFirstHalfPatterns(matches, teamName));

  // Detect over/under patterns
  patterns.push(...detectOverUnderPatterns(matches, teamName));

  // Detect Mind/Mood patterns
  if (mind && mood) {
    patterns.push(...detectMindMoodPatterns(mind, mood, teamName));
  }

  // Detect home/away patterns
  patterns.push(...detectHomeAwayPatterns(matches, teamName));

  // Sort by priority (highest first)
  return patterns.sort((a, b) => b.priority - a.priority);
}

// ============================================================================
// STREAK PATTERN DETECTION
// ============================================================================

/**
 * Detect streak-based patterns
 */
function detectStreakPatterns(
  matches: ProcessedMatch[],
  teamName: string,
): Pattern[] {
  const patterns: Pattern[] = [];

  // Winning streak
  const winStreak = countConsecutiveWins(matches);
  if (winStreak >= STREAK_THRESHOLDS.winningMedium) {
    const severity = getSeverityFromStreak(
      winStreak,
      STREAK_THRESHOLDS.winningCritical,
      STREAK_THRESHOLDS.winningHigh,
      STREAK_THRESHOLDS.winningMedium,
    );
    patterns.push({
      type: 'LONG_WINNING_STREAK',
      severity,
      priority: PATTERN_PRIORITIES.LONG_WINNING_STREAK,
      description: `${teamName} has won ${winStreak} consecutive matches`,
      data: { streak: winStreak },
    });
  }

  // Losing streak
  const loseStreak = countConsecutiveLosses(matches);
  if (loseStreak >= STREAK_THRESHOLDS.losingMedium) {
    const severity = getSeverityFromStreak(
      loseStreak,
      STREAK_THRESHOLDS.losingCritical,
      STREAK_THRESHOLDS.losingHigh,
      STREAK_THRESHOLDS.losingMedium,
    );
    patterns.push({
      type: 'LONG_LOSING_STREAK',
      severity,
      priority: PATTERN_PRIORITIES.LONG_LOSING_STREAK,
      description: `${teamName} has lost ${loseStreak} consecutive matches`,
      data: { streak: loseStreak },
    });
  }

  // Unbeaten streak (only if not already showing winning streak)
  if (winStreak < STREAK_THRESHOLDS.winningMedium) {
    const unbeatenStreak = countConsecutiveUnbeaten(matches);
    if (unbeatenStreak >= STREAK_THRESHOLDS.unbeatenMedium) {
      const severity =
        unbeatenStreak >= STREAK_THRESHOLDS.unbeatenHigh ? 'HIGH' : 'MEDIUM';
      patterns.push({
        type: 'LONG_UNBEATEN_STREAK',
        severity,
        priority: PATTERN_PRIORITIES.LONG_UNBEATEN_STREAK,
        description: `${teamName} is unbeaten in ${unbeatenStreak} consecutive matches`,
        data: { streak: unbeatenStreak },
      });
    }
  }

  // Winless streak (only if not already showing losing streak)
  if (loseStreak < STREAK_THRESHOLDS.losingMedium) {
    const winlessStreak = countConsecutiveWinless(matches);
    if (winlessStreak >= STREAK_THRESHOLDS.winlessMedium) {
      const severity =
        winlessStreak >= STREAK_THRESHOLDS.winlessHigh ? 'HIGH' : 'MEDIUM';
      patterns.push({
        type: 'LONG_WINLESS_STREAK',
        severity,
        priority: PATTERN_PRIORITIES.LONG_WINLESS_STREAK,
        description: `${teamName} is winless in ${winlessStreak} consecutive matches`,
        data: { streak: winlessStreak },
      });
    }
  }

  // Scoring streak
  const scoringStreak = countConsecutiveMatchesWithGoals(matches);
  if (scoringStreak >= STREAK_THRESHOLDS.scoringMedium) {
    const severity =
      scoringStreak >= STREAK_THRESHOLDS.scoringHigh ? 'HIGH' : 'MEDIUM';
    patterns.push({
      type: 'SCORING_STREAK',
      severity,
      priority: PATTERN_PRIORITIES.SCORING_STREAK,
      description: `${teamName} has scored in ${scoringStreak} consecutive matches`,
      data: { streak: scoringStreak },
    });
  }

  // Scoring drought
  const scoringDrought = countConsecutiveMatchesWithoutGoals(matches);
  if (scoringDrought >= 2) {
    const severity = scoringDrought >= 4 ? 'CRITICAL' : scoringDrought >= 3 ? 'HIGH' : 'MEDIUM';
    patterns.push({
      type: 'SCORING_DROUGHT',
      severity,
      priority: PATTERN_PRIORITIES.SCORING_DROUGHT,
      description: `${teamName} has failed to score in ${scoringDrought} consecutive matches`,
      data: { streak: scoringDrought },
    });
  }

  // Clean sheet streak
  const cleanSheetStreak = countConsecutiveCleanSheets(matches);
  if (cleanSheetStreak >= 3) {
    const severity = cleanSheetStreak >= 5 ? 'HIGH' : 'MEDIUM';
    patterns.push({
      type: 'CLEAN_SHEET_STREAK',
      severity,
      priority: PATTERN_PRIORITIES.CLEAN_SHEET_STREAK,
      description: `${teamName} has kept ${cleanSheetStreak} consecutive clean sheets`,
      data: { streak: cleanSheetStreak },
    });
  }

  // Clean sheet drought
  const cleanSheetDrought = countConsecutiveMatchesWithoutCleanSheet(matches);
  if (cleanSheetDrought >= STREAK_THRESHOLDS.cleanSheetDroughtMedium) {
    const severity = getSeverityFromStreak(
      cleanSheetDrought,
      STREAK_THRESHOLDS.cleanSheetDroughtCritical,
      STREAK_THRESHOLDS.cleanSheetDroughtHigh,
      STREAK_THRESHOLDS.cleanSheetDroughtMedium,
    );
    patterns.push({
      type: 'CLEAN_SHEET_DROUGHT',
      severity,
      priority: PATTERN_PRIORITIES.CLEAN_SHEET_DROUGHT,
      description: `${teamName} has not kept a clean sheet in ${cleanSheetDrought} matches`,
      data: { streak: cleanSheetDrought },
    });
  }

  // Defensive collapse (conceding 2+ in consecutive matches)
  const defensiveCollapse = countConsecutiveMultiGoalsConceded(matches);
  if (defensiveCollapse >= 3) {
    const severity = defensiveCollapse >= 5 ? 'CRITICAL' : defensiveCollapse >= 4 ? 'HIGH' : 'MEDIUM';
    patterns.push({
      type: 'DEFENSIVE_COLLAPSE',
      severity,
      priority: PATTERN_PRIORITIES.DEFENSIVE_COLLAPSE,
      description: `${teamName} has conceded 2+ goals in ${defensiveCollapse} consecutive matches`,
      data: { streak: defensiveCollapse },
    });
  }

  // BTTS streak
  const bttsStreak = countConsecutiveBTTS(matches);
  if (bttsStreak >= STREAK_THRESHOLDS.bttsMedium) {
    const severity = bttsStreak >= STREAK_THRESHOLDS.bttsHigh ? 'HIGH' : 'MEDIUM';
    patterns.push({
      type: 'BTTS_STREAK',
      severity,
      priority: PATTERN_PRIORITIES.BTTS_STREAK,
      description: `Both teams have scored in ${bttsStreak} consecutive matches for ${teamName}`,
      data: { streak: bttsStreak },
    });
  }

  // No BTTS streak
  const noBttsStreak = countConsecutiveNoBTTS(matches);
  if (noBttsStreak >= STREAK_THRESHOLDS.bttsMedium) {
    const severity =
      noBttsStreak >= STREAK_THRESHOLDS.bttsHigh ? 'HIGH' : 'MEDIUM';
    patterns.push({
      type: 'NO_BTTS_STREAK',
      severity,
      priority: PATTERN_PRIORITIES.NO_BTTS_STREAK,
      description: `At least one team failed to score in ${noBttsStreak} consecutive matches for ${teamName}`,
      data: { streak: noBttsStreak },
    });
  }

  return patterns;
}

// ============================================================================
// PERFORMANCE PATTERN DETECTION
// ============================================================================

/**
 * Detect performance-based patterns (averages over recent form)
 */
function detectPerformancePatterns(
  matches: ProcessedMatch[],
  teamName: string,
): Pattern[] {
  const patterns: Pattern[] = [];

  // Use last 10 matches for performance analysis
  const recentMatches = matches.slice(0, 10);
  if (recentMatches.length < 3) {
    return patterns;
  }

  // Calculate averages
  const totalGoalsScored = recentMatches.reduce(
    (sum, m) => sum + m.goalsScored,
    0,
  );
  const totalGoalsConceded = recentMatches.reduce(
    (sum, m) => sum + m.goalsConceded,
    0,
  );

  const avgGoalsScored = totalGoalsScored / recentMatches.length;
  const avgGoalsConceded = totalGoalsConceded / recentMatches.length;

  // High scoring form
  if (avgGoalsScored >= PERFORMANCE_THRESHOLDS.highScoringMedium) {
    const severity =
      avgGoalsScored >= PERFORMANCE_THRESHOLDS.highScoringHigh
        ? 'HIGH'
        : 'MEDIUM';
    patterns.push({
      type: 'HIGH_SCORING_FORM',
      severity,
      priority: PATTERN_PRIORITIES.HIGH_SCORING_FORM,
      description: `${teamName} have averaged ${avgGoalsScored.toFixed(1)} goals per game in their last ${recentMatches.length}.`,
      data: {
        avgGoalsScored: Math.round(avgGoalsScored * 100) / 100,
        matchCount: recentMatches.length,
      },
    });
  }

  // Defensive weakness
  if (avgGoalsConceded >= PERFORMANCE_THRESHOLDS.defensiveWeaknessMedium) {
    const severity =
      avgGoalsConceded >= PERFORMANCE_THRESHOLDS.defensiveWeaknessHigh
        ? 'HIGH'
        : 'MEDIUM';
    patterns.push({
      type: 'DEFENSIVE_WEAKNESS',
      severity,
      priority: PATTERN_PRIORITIES.DEFENSIVE_WEAKNESS,
      description: `${teamName} have conceded ${avgGoalsConceded.toFixed(1)} goals per game in their last ${recentMatches.length}.`,
      data: {
        avgGoalsConceded: Math.round(avgGoalsConceded * 100) / 100,
        matchCount: recentMatches.length,
      },
    });
  }

  return patterns;
}

// ============================================================================
// FIRST HALF PATTERN DETECTION
// ============================================================================

/**
 * Detect first half scoring patterns
 */
function detectFirstHalfPatterns(
  matches: ProcessedMatch[],
  teamName: string,
): Pattern[] {
  const patterns: Pattern[] = [];

  // Filter matches with first half data
  const matchesWithFHData = matches.filter(
    (m) => m.firstHalfGoals !== undefined,
  );

  if (matchesWithFHData.length < 5) {
    return patterns;
  }

  // Calculate first half scoring rate
  const scoredInFirstHalf = matchesWithFHData.filter(
    (m) => (m.firstHalfGoals ?? 0) > 0,
  ).length;
  const firstHalfRate = scoredInFirstHalf / matchesWithFHData.length;

  // First half weakness
  if (firstHalfRate < PERFORMANCE_THRESHOLDS.firstHalfWeakness) {
    patterns.push({
      type: 'FIRST_HALF_WEAKNESS',
      severity: 'MEDIUM',
      priority: PATTERN_PRIORITIES.FIRST_HALF_WEAKNESS,
      description: `${teamName} rarely scores in the first half (${Math.round(firstHalfRate * 100)}%)`,
      data: {
        firstHalfScoringRate: Math.round(firstHalfRate * 100),
        matchCount: matchesWithFHData.length,
      },
    });
  }

  // First half strength
  if (firstHalfRate > PERFORMANCE_THRESHOLDS.firstHalfStrength) {
    patterns.push({
      type: 'FIRST_HALF_STRENGTH',
      severity: 'MEDIUM',
      priority: PATTERN_PRIORITIES.FIRST_HALF_STRENGTH,
      description: `${teamName} frequently scores in the first half (${Math.round(firstHalfRate * 100)}%)`,
      data: {
        firstHalfScoringRate: Math.round(firstHalfRate * 100),
        matchCount: matchesWithFHData.length,
      },
    });
  }

  return patterns;
}

// ============================================================================
// OVER/UNDER PATTERN DETECTION
// ============================================================================

/**
 * Detect over/under 2.5 patterns
 */
function detectOverUnderPatterns(
  matches: ProcessedMatch[],
  teamName: string,
): Pattern[] {
  const patterns: Pattern[] = [];

  // Over 2.5 streak
  const over25Streak = countConsecutiveOver25(matches);
  if (over25Streak >= STREAK_THRESHOLDS.over25Medium) {
    const severity =
      over25Streak >= STREAK_THRESHOLDS.over25High ? 'HIGH' : 'MEDIUM';
    patterns.push({
      type: 'OVER_25_STREAK',
      severity,
      priority: PATTERN_PRIORITIES.OVER_25_STREAK,
      description: `${teamName}'s matches have had 3+ goals in ${over25Streak} consecutive games`,
      data: { streak: over25Streak },
    });
  }

  // Under 2.5 streak
  const under25Streak = countConsecutiveUnder25(matches);
  if (under25Streak >= STREAK_THRESHOLDS.over25Medium) {
    const severity =
      under25Streak >= STREAK_THRESHOLDS.over25High ? 'HIGH' : 'MEDIUM';
    patterns.push({
      type: 'UNDER_25_STREAK',
      severity,
      priority: PATTERN_PRIORITIES.UNDER_25_STREAK,
      description: `${teamName}'s matches have had fewer than 3 goals in ${under25Streak} consecutive games`,
      data: { streak: under25Streak },
    });
  }

  return patterns;
}

// ============================================================================
// MIND/MOOD PATTERN DETECTION
// ============================================================================

/**
 * Detect Mind/Mood patterns (Sleeping Giant, Over-Performer, etc.)
 */
function detectMindMoodPatterns(
  mind: MindLayer,
  mood: MoodLayer,
  teamName: string,
): Pattern[] {
  const patterns: Pattern[] = [];

  // Sleeping Giant: Mind Tier 1, Mood Tier 3-4
  if (mood.isSleepingGiant) {
    patterns.push({
      type: 'SLEEPING_GIANT',
      severity: 'HIGH',
      priority: PATTERN_PRIORITIES.SLEEPING_GIANT,
      description: `${teamName} is an elite team (Tier ${mind.tier}) in poor form (Tier ${mood.tier}) - high value opportunity`,
      data: {
        mindTier: mind.tier,
        moodTier: mood.tier,
        efficiencyIndex: mind.efficiencyIndex,
        mindMoodGap: mood.mindMoodGap,
      },
    });
  }

  // Over-Performer: Mind Tier 3-4, Mood Tier 1
  if (mood.isOverPerformer) {
    patterns.push({
      type: 'OVER_PERFORMER',
      severity: 'HIGH',
      priority: PATTERN_PRIORITIES.OVER_PERFORMER,
      description: `${teamName} is a lower-tier team (Tier ${mind.tier}) in exceptional form (Tier ${mood.tier}) - regression risk`,
      data: {
        mindTier: mind.tier,
        moodTier: mood.tier,
        efficiencyIndex: mind.efficiencyIndex,
        mindMoodGap: mood.mindMoodGap,
      },
    });
  }

  // One-Season Wonder
  if (mood.isOneSeasonWonder) {
    patterns.push({
      type: 'ONE_SEASON_WONDER',
      severity: 'MEDIUM',
      priority: PATTERN_PRIORITIES.ONE_SEASON_WONDER,
      description: `${teamName} is a recently promoted team overperforming - potential regression`,
      data: {
        mindTier: mind.tier,
        moodTier: mood.tier,
      },
    });
  }

  return patterns;
}

// ============================================================================
// HOME/AWAY PATTERN DETECTION
// ============================================================================

/**
 * Detect home/away specific patterns
 */
function detectHomeAwayPatterns(
  matches: ProcessedMatch[],
  teamName: string,
): Pattern[] {
  const patterns: Pattern[] = [];

  // Split by home/away
  const homeMatches = matches.filter((m) => m.isHome);
  const awayMatches = matches.filter((m) => !m.isHome);

  // Need sufficient data for comparison
  if (homeMatches.length < 3 || awayMatches.length < 3) {
    return patterns;
  }

  // Calculate home/away records
  const homeWins = homeMatches.filter((m) => m.result === 'W').length;
  const homeRate = homeWins / homeMatches.length;

  const awayWins = awayMatches.filter((m) => m.result === 'W').length;
  const awayRate = awayWins / awayMatches.length;

  // Home form collapse: Strong away, weak home
  if (awayRate >= 0.5 && homeRate < 0.25) {
    patterns.push({
      type: 'HOME_FORM_COLLAPSE',
      severity: 'MEDIUM',
      priority: PATTERN_PRIORITIES.HOME_FORM_COLLAPSE,
      description: `${teamName} is struggling at home (${Math.round(homeRate * 100)}% win rate) despite strong away form (${Math.round(awayRate * 100)}%)`,
      data: {
        homeWinRate: Math.round(homeRate * 100),
        awayWinRate: Math.round(awayRate * 100),
        homeMatches: homeMatches.length,
        awayMatches: awayMatches.length,
      },
    });
  }

  // Away dominance: Exceptional away form
  if (awayRate >= 0.6) {
    patterns.push({
      type: 'AWAY_DOMINANCE',
      severity: 'MEDIUM',
      priority: PATTERN_PRIORITIES.AWAY_DOMINANCE,
      description: `${teamName} has exceptional away form (${Math.round(awayRate * 100)}% win rate)`,
      data: {
        awayWinRate: Math.round(awayRate * 100),
        awayMatches: awayMatches.length,
      },
    });
  }

  return patterns;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get severity based on streak length
 */
function getSeverityFromStreak(
  streak: number,
  criticalThreshold: number,
  highThreshold: number,
  mediumThreshold: number,
): PatternSeverity {
  if (streak >= criticalThreshold) return 'CRITICAL';
  if (streak >= highThreshold) return 'HIGH';
  if (streak >= mediumThreshold) return 'MEDIUM';
  return 'LOW';
}

/**
 * Filter patterns by minimum severity
 */
export function filterPatternsBySeverity(
  patterns: Pattern[],
  minSeverity: PatternSeverity,
): Pattern[] {
  const severityOrder: PatternSeverity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  const minIndex = severityOrder.indexOf(minSeverity);

  return patterns.filter(
    (p) => severityOrder.indexOf(p.severity) >= minIndex,
  );
}

/**
 * Get top N patterns by priority
 */
export function getTopPatterns(
  patterns: Pattern[],
  count: number = 5,
): Pattern[] {
  return patterns.slice(0, count);
}

/**
 * Check if a specific pattern type is present
 */
export function hasPattern(
  patterns: Pattern[],
  type: PatternType,
): boolean {
  return patterns.some((p) => p.type === type);
}

/**
 * Get pattern by type
 */
export function getPattern(
  patterns: Pattern[],
  type: PatternType,
): Pattern | undefined {
  return patterns.find((p) => p.type === type);
}

/**
 * Streak Helper Functions
 *
 * Functions for counting consecutive patterns in match data:
 * - Consecutive results (wins, draws, losses)
 * - Scoring streaks
 * - Clean sheet streaks
 * - BTTS streaks
 *
 * Reference: docs/implementation-plan/phase2.md - Sections 2.1 and 2.2
 * Algorithm: docs/betting-insights-Algorithm.md - Pattern Detection section
 */

import type { ProcessedMatch, MatchResult } from '../types';

// ============================================================================
// CONSECUTIVE RESULT COUNTING
// ============================================================================

/**
 * Count consecutive wins from most recent matches
 *
 * @param matches - Matches sorted most recent first
 * @returns Number of consecutive wins
 */
export function countConsecutiveWins(matches: ProcessedMatch[]): number {
  let count = 0;
  for (const match of matches) {
    if (match.result === 'W') {
      count++;
    } else {
      break;
    }
  }
  return count;
}

/**
 * Count consecutive losses from most recent matches
 *
 * @param matches - Matches sorted most recent first
 * @returns Number of consecutive losses
 */
export function countConsecutiveLosses(matches: ProcessedMatch[]): number {
  let count = 0;
  for (const match of matches) {
    if (match.result === 'L') {
      count++;
    } else {
      break;
    }
  }
  return count;
}

/**
 * Count consecutive draws from most recent matches
 *
 * @param matches - Matches sorted most recent first
 * @returns Number of consecutive draws
 */
export function countConsecutiveDraws(matches: ProcessedMatch[]): number {
  let count = 0;
  for (const match of matches) {
    if (match.result === 'D') {
      count++;
    } else {
      break;
    }
  }
  return count;
}

/**
 * Count consecutive matches without a loss
 *
 * @param matches - Matches sorted most recent first
 * @returns Number of consecutive unbeaten matches
 */
export function countConsecutiveUnbeaten(matches: ProcessedMatch[]): number {
  let count = 0;
  for (const match of matches) {
    if (match.result !== 'L') {
      count++;
    } else {
      break;
    }
  }
  return count;
}

/**
 * Count consecutive matches without a win
 *
 * @param matches - Matches sorted most recent first
 * @returns Number of consecutive winless matches
 */
export function countConsecutiveWinless(matches: ProcessedMatch[]): number {
  let count = 0;
  for (const match of matches) {
    if (match.result !== 'W') {
      count++;
    } else {
      break;
    }
  }
  return count;
}

/**
 * Count consecutive results of a specific type
 *
 * @param matches - Matches sorted most recent first
 * @param result - Result type to count ('W', 'D', 'L')
 * @returns Number of consecutive matches with that result
 */
export function countConsecutiveResults(
  matches: ProcessedMatch[],
  result: MatchResult,
): number {
  let count = 0;
  for (const match of matches) {
    if (match.result === result) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

// ============================================================================
// SCORING STREAK COUNTING
// ============================================================================

/**
 * Count consecutive matches where team scored at least one goal
 *
 * @param matches - Matches sorted most recent first
 * @returns Number of consecutive matches with goals
 */
export function countConsecutiveMatchesWithGoals(
  matches: ProcessedMatch[],
): number {
  let count = 0;
  for (const match of matches) {
    if (match.goalsScored > 0) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

/**
 * Count consecutive matches where team failed to score
 *
 * @param matches - Matches sorted most recent first
 * @returns Number of consecutive matches without goals
 */
export function countConsecutiveMatchesWithoutGoals(
  matches: ProcessedMatch[],
): number {
  let count = 0;
  for (const match of matches) {
    if (match.goalsScored === 0) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

/**
 * Count consecutive matches where team scored 2+ goals
 *
 * @param matches - Matches sorted most recent first
 * @returns Number of consecutive high-scoring matches
 */
export function countConsecutiveHighScoringMatches(
  matches: ProcessedMatch[],
): number {
  let count = 0;
  for (const match of matches) {
    if (match.goalsScored >= 2) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

// ============================================================================
// CLEAN SHEET STREAK COUNTING
// ============================================================================

/**
 * Count consecutive matches with clean sheets
 *
 * @param matches - Matches sorted most recent first
 * @returns Number of consecutive clean sheets
 */
export function countConsecutiveCleanSheets(matches: ProcessedMatch[]): number {
  let count = 0;
  for (const match of matches) {
    if (match.goalsConceded === 0) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

/**
 * Count consecutive matches without clean sheets
 *
 * @param matches - Matches sorted most recent first
 * @returns Number of consecutive matches without clean sheet
 */
export function countConsecutiveMatchesWithoutCleanSheet(
  matches: ProcessedMatch[],
): number {
  let count = 0;
  for (const match of matches) {
    if (match.goalsConceded > 0) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

/**
 * Count consecutive matches conceding 2+ goals
 *
 * @param matches - Matches sorted most recent first
 * @returns Number of consecutive matches conceding 2+
 */
export function countConsecutiveMultiGoalsConceded(
  matches: ProcessedMatch[],
): number {
  let count = 0;
  for (const match of matches) {
    if (match.goalsConceded >= 2) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

// ============================================================================
// BTTS STREAK COUNTING
// ============================================================================

/**
 * Count consecutive BTTS (Both Teams To Score) matches
 *
 * @param matches - Matches sorted most recent first
 * @returns Number of consecutive BTTS matches
 */
export function countConsecutiveBTTS(matches: ProcessedMatch[]): number {
  let count = 0;
  for (const match of matches) {
    const isBTTS = match.goalsScored > 0 && match.goalsConceded > 0;
    if (isBTTS) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

/**
 * Count consecutive matches without BTTS
 *
 * @param matches - Matches sorted most recent first
 * @returns Number of consecutive non-BTTS matches
 */
export function countConsecutiveNoBTTS(matches: ProcessedMatch[]): number {
  let count = 0;
  for (const match of matches) {
    const isBTTS = match.goalsScored > 0 && match.goalsConceded > 0;
    if (!isBTTS) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

// ============================================================================
// OVER/UNDER STREAK COUNTING
// ============================================================================

/**
 * Count consecutive Over 2.5 goals matches
 *
 * @param matches - Matches sorted most recent first
 * @returns Number of consecutive Over 2.5 matches
 */
export function countConsecutiveOver25(matches: ProcessedMatch[]): number {
  let count = 0;
  for (const match of matches) {
    const totalGoals = match.goalsScored + match.goalsConceded;
    if (totalGoals > 2.5) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

/**
 * Count consecutive Under 2.5 goals matches
 *
 * @param matches - Matches sorted most recent first
 * @returns Number of consecutive Under 2.5 matches
 */
export function countConsecutiveUnder25(matches: ProcessedMatch[]): number {
  let count = 0;
  for (const match of matches) {
    const totalGoals = match.goalsScored + match.goalsConceded;
    if (totalGoals < 2.5) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

// ============================================================================
// FIRST HALF STREAK COUNTING
// ============================================================================

/**
 * Count consecutive matches with first half goals
 *
 * Note: This requires firstHalfGoals data on ProcessedMatch
 * If not available, returns 0
 *
 * @param matches - Matches sorted most recent first
 * @returns Number of consecutive matches with first half goals
 */
export function countConsecutiveFirstHalfGoals(
  matches: ProcessedMatch[],
): number {
  let count = 0;
  for (const match of matches) {
    // Check if firstHalfGoals data is available
    if (match.firstHalfGoals !== undefined && match.firstHalfGoals > 0) {
      count++;
    } else if (match.firstHalfGoals === 0) {
      break;
    } else {
      // Data not available, can't determine streak
      break;
    }
  }
  return count;
}

/**
 * Count consecutive matches without first half goals
 *
 * @param matches - Matches sorted most recent first
 * @returns Number of consecutive matches without first half goals
 */
export function countConsecutiveNoFirstHalfGoals(
  matches: ProcessedMatch[],
): number {
  let count = 0;
  for (const match of matches) {
    if (match.firstHalfGoals !== undefined && match.firstHalfGoals === 0) {
      count++;
    } else if (
      match.firstHalfGoals !== undefined &&
      match.firstHalfGoals > 0
    ) {
      break;
    } else {
      // Data not available, can't determine streak
      break;
    }
  }
  return count;
}

// ============================================================================
// STREAK ANALYSIS HELPERS
// ============================================================================

/**
 * Find the longest streak of a condition in match history
 *
 * @param matches - All matches (not just recent)
 * @param predicate - Function to test each match
 * @returns Longest streak length and start index
 */
export function findLongestStreak(
  matches: ProcessedMatch[],
  predicate: (match: ProcessedMatch) => boolean,
): { length: number; startIndex: number } {
  let maxLength = 0;
  let maxStartIndex = 0;
  let currentLength = 0;
  let currentStartIndex = 0;

  for (let i = 0; i < matches.length; i++) {
    if (predicate(matches[i])) {
      if (currentLength === 0) {
        currentStartIndex = i;
      }
      currentLength++;
      if (currentLength > maxLength) {
        maxLength = currentLength;
        maxStartIndex = currentStartIndex;
      }
    } else {
      currentLength = 0;
    }
  }

  return { length: maxLength, startIndex: maxStartIndex };
}

/**
 * Check if team has broken out of a negative streak recently
 *
 * A team that was on a losing streak but recently won is interesting
 *
 * @param matches - Matches sorted most recent first
 * @param lookback - How many matches to look back
 * @returns true if team broke a negative streak
 */
export function hasRecentStreakBreaker(
  matches: ProcessedMatch[],
  lookback: number = 5,
): boolean {
  if (matches.length < 2) return false;

  const recentMatches = matches.slice(0, lookback);

  // Check if most recent is a win and followed by losses
  if (recentMatches[0]?.result === 'W') {
    const previousLosses = countConsecutiveResults(
      recentMatches.slice(1),
      'L',
    );
    return previousLosses >= 2;
  }

  return false;
}

/**
 * Calculate streak momentum
 *
 * Positive momentum = more wins than losses recently
 * Negative momentum = more losses than wins recently
 *
 * @param matches - Matches sorted most recent first
 * @param count - Number of matches to analyze
 * @returns Momentum score (-1 to 1)
 */
export function calculateStreakMomentum(
  matches: ProcessedMatch[],
  count: number = 5,
): number {
  const recent = matches.slice(0, count);
  if (recent.length === 0) return 0;

  let score = 0;
  for (const match of recent) {
    if (match.result === 'W') score += 1;
    else if (match.result === 'L') score -= 1;
    // Draws contribute 0
  }

  return score / recent.length;
}

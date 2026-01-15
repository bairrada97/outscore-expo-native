/**
 * Tests for form-score.ts
 *
 * Form comparison between home and away teams.
 */

import { describe, it, expect } from 'vitest';
import { calculateFormScore } from './form-score';
import type { TeamData } from '../types';

// Helper to calculate form points from string (for test setup)
function getFormPointsForTest(formString: string): number {
  let points = 0;
  for (const char of formString.toUpperCase()) {
    if (char === 'W') points += 3;
    else if (char === 'D') points += 1;
  }
  return points;
}

// Helper to create minimal TeamData for testing
function createTeamData(
  formString: string,
  tier: 1 | 2 | 3 | 4 = 3,
  overrides: Partial<TeamData> = {},
): TeamData {
  return {
    id: 1,
    name: 'Test Team',
    stats: {
      form: formString,
      leaguePosition: 10,
      avgGoalsScored: 1.5,
      avgGoalsConceded: 1.2,
      homeAvgScored: 1.8,
      homeAvgConceded: 1.0,
      awayAvgScored: 1.2,
      awayAvgConceded: 1.4,
      pointsFromCL: 10,
      pointsFromRelegation: 15,
      pointsFromFirst: 20,
      gamesPlayed: 20,
    },
    mind: {
      tier,
      matchCount: 20,
      avgPointsPerGame: 1.5,
      goalDifference: 5,
      efficiencyIndex: 1.0,
      hasSufficientData: true,
    },
    mood: {
      tier,
      formString,
      last10Points: getFormPointsForTest(formString),
      last10GoalsScored: 0,
      last10GoalsConceded: 0,
      mindMoodGap: 0,
      isSleepingGiant: false,
      isOverPerformer: false,
      isOneSeasonWonder: false,
    },
    dna: {
      mostPlayedFormation: '4-3-3',
      formationFrequency: { '4-3-3': 80 },
      goalLineOverPct: {},
      cleanSheetPercentage: 30,
      failedToScorePercentage: 20,
      bttsYesRate: 55,
      goalMinutesScoring: { '0-15': 15, '16-30': 20, '31-45': 15, '46-60': 20, '61-75': 15, '76-90': 15 },
      goalMinutesConceding: { '0-15': 10, '16-30': 15, '31-45': 20, '46-60': 20, '61-75': 20, '76-90': 15 },
      isLateStarter: false,
      dangerZones: [],
      firstHalfGoalPercentage: 45,
      avgGoalsPerGame: 1.5,
      avgGoalsConcededPerGame: 1.2,
    },
    safetyFlags: {
      regressionRisk: false,
      motivationClash: false,
      liveDog: false,
      motivation: 'MID_TABLE',
      consecutiveWins: 0,
    },
    daysSinceLastMatch: 5,
    lastHomeMatches: [],
    lastAwayMatches: [],
    seasonsInLeague: 3,
    ...overrides,
  };
}

describe('calculateFormScore', () => {
  it('should return positive when home team has better form', () => {
    const homeTeam = createTeamData('WWWWW', 1); // 15 points, tier 1
    const awayTeam = createTeamData('LLLLL', 4); // 0 points, tier 4

    const score = calculateFormScore(homeTeam, awayTeam);
    expect(score).toBeGreaterThan(0);
  });

  it('should return negative when away team has better form', () => {
    const homeTeam = createTeamData('LLLLL', 4); // 0 points, tier 4
    const awayTeam = createTeamData('WWWWW', 1); // 15 points, tier 1

    const score = calculateFormScore(homeTeam, awayTeam);
    expect(score).toBeLessThan(0);
  });

  it('should return near zero when forms are equal', () => {
    const homeTeam = createTeamData('WDWDW', 2);
    const awayTeam = createTeamData('DWDWD', 2);

    const score = calculateFormScore(homeTeam, awayTeam);
    // Forms are equal in points and tier, so score should be close to zero
    expect(Math.abs(score)).toBeLessThan(20);
  });

  it('should return score within -100 to +100 range', () => {
    const homeTeam = createTeamData('WWWWW', 1);
    const awayTeam = createTeamData('LLLLL', 4);

    const score = calculateFormScore(homeTeam, awayTeam);
    expect(score).toBeGreaterThanOrEqual(-100);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('should consider mood tier in calculation', () => {
    // Same form string but different tiers
    const homeTeamGoodTier = createTeamData('WDWDW', 1);
    const homeTeamBadTier = createTeamData('WDWDW', 4);
    const awayTeam = createTeamData('WDWDW', 2);

    const scoreGoodTier = calculateFormScore(homeTeamGoodTier, awayTeam);
    const scoreBadTier = calculateFormScore(homeTeamBadTier, awayTeam);

    // Good tier should result in better (higher) score
    expect(scoreGoodTier).toBeGreaterThan(scoreBadTier);
  });

  it('should consider last10Points in calculation', () => {
    // Same tier but different points
    const homeTeamHighPoints = createTeamData('WWWWW', 2);
    const homeTeamLowPoints = createTeamData('LLLLL', 2);
    const awayTeam = createTeamData('DDDDD', 2);

    const scoreHighPoints = calculateFormScore(homeTeamHighPoints, awayTeam);
    const scoreLowPoints = calculateFormScore(homeTeamLowPoints, awayTeam);

    // Higher points should result in better score
    expect(scoreHighPoints).toBeGreaterThan(scoreLowPoints);
  });

  it('should handle missing mood data gracefully', () => {
    const homeTeam = createTeamData('WWW', 2);
    const awayTeam = createTeamData('LLL', 3);

    // Remove mood data using type assertion
    const homeTeamWithoutMood = { ...homeTeam, mood: undefined } as unknown as TeamData;

    // This should not throw
    const score = calculateFormScore(homeTeamWithoutMood, awayTeam);
    expect(typeof score).toBe('number');
  });

  it('should handle extreme tier differences', () => {
    const homeTeam = createTeamData('WWWWW', 1); // Best tier
    const awayTeam = createTeamData('WWWWW', 4); // Worst tier

    const score = calculateFormScore(homeTeam, awayTeam);
    // Home team has much better tier, should be positive
    expect(score).toBeGreaterThan(50);
  });
});

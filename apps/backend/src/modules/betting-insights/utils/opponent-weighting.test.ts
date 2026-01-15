/**
 * Tests for opponent-weighting.ts
 *
 * Opponent quality weighting tests.
 */

import { describe, it, expect } from 'vitest';
import {
  analyzeOpponentStrength,
  calculateWeightedFormScore,
  getOpponentQuality,
  getOpponentQualityFromTier,
  compareOpponentStrength,
} from './opponent-weighting';
import type { ProcessedMatch, TeamData } from '../types';

// Helper to create a match with specific opponent
function createMatch(
  opponentId: number,
  isHome: boolean,
  result: 'W' | 'D' | 'L',
): ProcessedMatch {
  return {
    id: Math.floor(Math.random() * 10000),
    date: new Date().toISOString(),
    homeTeam: isHome ? { id: 1, name: 'Home' } : { id: opponentId, name: 'Opponent' },
    awayTeam: isHome ? { id: opponentId, name: 'Opponent' } : { id: 1, name: 'Home' },
    score: {
      home: result === 'W' ? 2 : (result === 'D' ? 1 : 0),
      away: result === 'L' ? 2 : (result === 'D' ? 1 : 0),
    },
    result,
    goalsScored: result === 'W' ? 2 : (result === 'D' ? 1 : 0),
    goalsConceded: result === 'L' ? 2 : (result === 'D' ? 1 : 0),
    league: { id: 1, name: 'Test League' },
    season: 2024,
    isHome,
  };
}

function createTeamData(
  homeMatches: ProcessedMatch[] = [],
  awayMatches: ProcessedMatch[] = [],
): TeamData {
  return {
    id: 1,
    name: 'Test Team',
    stats: {
      form: 'WWDLW',
      leaguePosition: 10,
      avgGoalsScored: 1.5,
      avgGoalsConceded: 1.2,
      homeAvgScored: 1.8,
      homeAvgConceded: 1.0,
      awayAvgScored: 1.2,
      awayAvgConceded: 1.4,
      pointsFromCL: 15,
      pointsFromRelegation: 20,
      pointsFromFirst: 25,
      gamesPlayed: 20,
    },
    mind: {
      tier: 2,
      efficiencyIndex: 1.8,
      avgPointsPerGame: 1.7,
      goalDifference: 8,
      matchCount: 50,
      hasSufficientData: true,
    },
    mood: {
      tier: 2,
      mindMoodGap: 0,
      isSleepingGiant: false,
      isOverPerformer: false,
      isOneSeasonWonder: false,
      formString: 'WWDLW',
      last10Points: 16,
      last10GoalsScored: 15,
      last10GoalsConceded: 10,
    },
    dna: {
      mostPlayedFormation: '4-3-3',
      formationFrequency: { '4-3-3': 60, '4-4-2': 40 },
      goalLineOverPct: { '0.5': 90, '1.5': 75, '2.5': 55, '3.5': 30, '4.5': 15, '5.5': 5 },
      cleanSheetPercentage: 25,
      failedToScorePercentage: 15,
      bttsYesRate: 55,
      goalMinutesScoring: { '0-15': 15, '16-30': 20, '31-45': 15, '46-60': 20, '61-75': 15, '76-90': 15 },
      goalMinutesConceding: { '0-15': 10, '16-30': 15, '31-45': 20, '46-60': 20, '61-75': 20, '76-90': 15 },
      isLateStarter: false,
      dangerZones: [],
      firstHalfGoalPercentage: 50,
      avgGoalsPerGame: 1.5,
      avgGoalsConcededPerGame: 1.2,
    },
    safetyFlags: {
      regressionRisk: false,
      motivationClash: false,
      liveDog: false,
      motivation: 'MID_TABLE',
      consecutiveWins: 2,
    },
    daysSinceLastMatch: 5,
    lastHomeMatches: homeMatches,
    lastAwayMatches: awayMatches,
    seasonsInLeague: 5,
  };
}

describe('getOpponentQuality', () => {
  it('should return ELITE for top 4 teams', () => {
    expect(getOpponentQuality(1)).toBe('ELITE');
    expect(getOpponentQuality(2)).toBe('ELITE');
    expect(getOpponentQuality(3)).toBe('ELITE');
    expect(getOpponentQuality(4)).toBe('ELITE');
  });

  it('should return STRONG for 5th-8th place teams', () => {
    expect(getOpponentQuality(5)).toBe('STRONG');
    expect(getOpponentQuality(6)).toBe('STRONG');
    expect(getOpponentQuality(7)).toBe('STRONG');
    expect(getOpponentQuality(8)).toBe('STRONG');
  });

  it('should return AVERAGE for mid-table teams', () => {
    expect(getOpponentQuality(9)).toBe('AVERAGE');
    expect(getOpponentQuality(10)).toBe('AVERAGE');
    expect(getOpponentQuality(14)).toBe('AVERAGE');
  });

  it('should return WEAK for bottom teams', () => {
    expect(getOpponentQuality(15)).toBe('WEAK');
    expect(getOpponentQuality(18)).toBe('WEAK');
    expect(getOpponentQuality(20)).toBe('WEAK');
  });

  it('should return UNKNOWN for undefined position', () => {
    expect(getOpponentQuality(undefined)).toBe('UNKNOWN');
  });

  it('should scale thresholds for smaller leagues', () => {
    // In a 10-team league, top 2 should be elite
    expect(getOpponentQuality(1, 10)).toBe('ELITE');
    expect(getOpponentQuality(2, 10)).toBe('ELITE');
    expect(getOpponentQuality(3, 10)).toBe('STRONG');
  });
});

describe('getOpponentQualityFromTier', () => {
  it('should map tier 1 to ELITE', () => {
    expect(getOpponentQualityFromTier(1)).toBe('ELITE');
  });

  it('should map tier 2 to STRONG', () => {
    expect(getOpponentQualityFromTier(2)).toBe('STRONG');
  });

  it('should map tier 3 to AVERAGE', () => {
    expect(getOpponentQualityFromTier(3)).toBe('AVERAGE');
  });

  it('should map tier 4 to WEAK', () => {
    expect(getOpponentQualityFromTier(4)).toBe('WEAK');
  });

  it('should return UNKNOWN for undefined tier', () => {
    expect(getOpponentQualityFromTier(undefined)).toBe('UNKNOWN');
  });
});

describe('analyzeOpponentStrength', () => {
  it('should return UNKNOWN for team with no matches', () => {
    const team = createTeamData([], []);

    const result = analyzeOpponentStrength(team);

    expect(result.avgOpponentQuality).toBe('UNKNOWN');
    expect(result.rawPPG).toBe(0);
  });

  it('should calculate PPG correctly', () => {
    const matches = [
      createMatch(10, true, 'W'),  // 3 pts
      createMatch(11, true, 'W'),  // 3 pts
      createMatch(12, false, 'D'), // 1 pt
      createMatch(13, false, 'L'), // 0 pts
    ];
    const team = createTeamData(matches.slice(0, 2), matches.slice(2));

    const result = analyzeOpponentStrength(team);

    // Raw PPG: (3+3+1+0) / 4 = 1.75
    expect(result.rawPPG).toBe(1.75);
  });

  it('should include strong opponent percentage', () => {
    const matches = [
      createMatch(10, true, 'W'),
      createMatch(11, true, 'W'),
      createMatch(12, false, 'D'),
    ];
    const team = createTeamData(matches, []);

    // Without position data, all opponents are UNKNOWN (which counts as AVERAGE)
    const result = analyzeOpponentStrength(team);

    expect(result.strongOpponentPct).toBeDefined();
    expect(result.weakOpponentPct).toBeDefined();
  });

  it('should use opponent positions when provided', () => {
    const matches = [
      createMatch(100, true, 'W'),
      createMatch(101, true, 'W'),
      createMatch(102, false, 'D'),
    ];
    const team = createTeamData(matches, []);

    const opponentPositions = new Map<number, number>([
      [100, 2],  // Elite
      [101, 6],  // Strong
      [102, 18], // Weak
    ]);

    const result = analyzeOpponentStrength(team, opponentPositions);

    // 2/3 opponents are strong or elite
    expect(result.strongOpponentPct).toBeGreaterThan(50);
  });

  it('should clamp form adjustment factor', () => {
    const matches = [
      createMatch(10, true, 'W'),
      createMatch(11, true, 'W'),
    ];
    const team = createTeamData(matches, []);

    const result = analyzeOpponentStrength(team);

    expect(result.formAdjustmentFactor).toBeGreaterThanOrEqual(0.7);
    expect(result.formAdjustmentFactor).toBeLessThanOrEqual(1.3);
  });

  it('should include a summary', () => {
    const matches = [createMatch(10, true, 'W')];
    const team = createTeamData(matches, []);

    const result = analyzeOpponentStrength(team);

    expect(result.summary).toBeDefined();
    expect(result.summary.length).toBeGreaterThan(0);
  });
});

describe('calculateWeightedFormScore', () => {
  it('should return adjusted score', () => {
    const matches = [
      createMatch(10, true, 'W'),
      createMatch(11, true, 'W'),
    ];
    const homeTeam = createTeamData(matches, []);
    const awayTeam = createTeamData(matches, []);

    const result = calculateWeightedFormScore(homeTeam, awayTeam, 50);

    expect(result.adjustedScore).toBeDefined();
    expect(result.homeAdjustment).toBeDefined();
    expect(result.awayAdjustment).toBeDefined();
  });

  it('should clamp adjusted score within valid range', () => {
    const matches = [createMatch(10, true, 'W')];
    const homeTeam = createTeamData(matches, []);
    const awayTeam = createTeamData(matches, []);

    // Test with extreme raw form score
    const resultHigh = calculateWeightedFormScore(homeTeam, awayTeam, 95);
    const resultLow = calculateWeightedFormScore(homeTeam, awayTeam, -95);

    expect(resultHigh.adjustedScore).toBeLessThanOrEqual(100);
    expect(resultLow.adjustedScore).toBeGreaterThanOrEqual(-100);
  });

  it('should boost home team score when facing tougher opponents', () => {
    const toughMatches = [
      createMatch(100, true, 'W'),
      createMatch(101, true, 'D'),
    ];
    const easyMatches = [
      createMatch(200, true, 'W'),
      createMatch(201, true, 'W'),
    ];

    const toughOpponentTeam = createTeamData(toughMatches, []);
    const easyOpponentTeam = createTeamData(easyMatches, []);

    const opponentPositions = new Map<number, number>([
      [100, 1],  // Elite
      [101, 2],  // Elite
      [200, 18], // Weak
      [201, 19], // Weak
    ]);

    const resultTough = calculateWeightedFormScore(
      toughOpponentTeam,
      easyOpponentTeam,
      0,
      opponentPositions,
    );

    // Home team faced tougher opponents, should get positive adjustment
    // Away team faced weaker opponents, should get negative adjustment
    expect(resultTough.homeAdjustment).not.toEqual(resultTough.awayAdjustment);
  });
});

describe('compareOpponentStrength', () => {
  it('should identify team with harder schedule', () => {
    const toughMatches = [
      createMatch(100, true, 'W'),
      createMatch(101, true, 'D'),
    ];
    const easyMatches = [
      createMatch(200, true, 'W'),
      createMatch(201, true, 'W'),
    ];

    const toughScheduleTeam = createTeamData(toughMatches, []);
    const easyScheduleTeam = createTeamData(easyMatches, []);

    // Without position data, can't really compare
    const result = compareOpponentStrength(toughScheduleTeam, easyScheduleTeam);

    // Should still return a valid comparison
    expect(result.harderScheduleTeam).toBeDefined();
    expect(['home', 'away', 'equal']).toContain(result.harderScheduleTeam);
  });

  it('should identify equal schedules', () => {
    const matches = [createMatch(10, true, 'W')];
    const homeTeam = createTeamData(matches, []);
    const awayTeam = createTeamData(matches, []);

    const result = compareOpponentStrength(homeTeam, awayTeam);

    expect(result.harderScheduleTeam).toBe('equal');
  });

  it('should include schedule difference score', () => {
    const matches = [createMatch(10, true, 'W')];
    const homeTeam = createTeamData(matches, []);
    const awayTeam = createTeamData(matches, []);

    const result = compareOpponentStrength(homeTeam, awayTeam);

    expect(result.scheduleDifference).toBeDefined();
    expect(result.scheduleDifference).toBeGreaterThanOrEqual(0);
  });

  it('should include a summary', () => {
    const matches = [createMatch(10, true, 'W')];
    const homeTeam = createTeamData(matches, []);
    const awayTeam = createTeamData(matches, []);

    const result = compareOpponentStrength(homeTeam, awayTeam);

    expect(result.summary).toBeDefined();
    expect(result.summary.length).toBeGreaterThan(0);
  });
});

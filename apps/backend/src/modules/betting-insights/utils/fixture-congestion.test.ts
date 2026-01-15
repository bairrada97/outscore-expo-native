/**
 * Tests for fixture-congestion.ts
 *
 * Fixture congestion detection tests.
 */

import { describe, it, expect } from 'vitest';
import {
  analyzeCongestion,
  calculateCongestionAdjustment,
  hasSignificantCongestion,
  compareCongestion,
  type CongestionLevel,
} from './fixture-congestion';
import type { TeamData, ProcessedMatch } from '../types';

// Helper to create a match at a specific date offset
function createMatch(daysAgo: number): ProcessedMatch {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);

  return {
    id: Math.floor(Math.random() * 10000),
    date: date.toISOString(),
    homeTeam: { id: 1, name: 'Home' },
    awayTeam: { id: 2, name: 'Away' },
    score: { home: 2, away: 1 },
    result: 'W',
    goalsScored: 2,
    goalsConceded: 1,
    league: { id: 1, name: 'Test League' },
    season: 2024,
    isHome: true,
  };
}

function createTeamData(homeMatches: ProcessedMatch[] = [], awayMatches: ProcessedMatch[] = []): TeamData {
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

describe('analyzeCongestion', () => {
  it('should return NONE for team with no recent matches', () => {
    const team = createTeamData([], []);

    const result = analyzeCongestion(team);

    expect(result.level).toBe('NONE');
    expect(result.matchesLast14Days).toBe(0);
    expect(result.rotationLikely).toBe(false);
  });

  it('should return LIGHT for team with 2 matches in 14 days', () => {
    const matches = [
      createMatch(3),
      createMatch(10),
    ];
    const team = createTeamData(matches, []);

    const result = analyzeCongestion(team);

    expect(result.level).toBe('LIGHT');
    expect(result.matchesLast14Days).toBe(2);
  });

  it('should return MODERATE for team with 3 matches in 14 days', () => {
    const matches = [
      createMatch(2),
      createMatch(7),
      createMatch(12),
    ];
    const team = createTeamData(matches, []);

    const result = analyzeCongestion(team);

    expect(result.level).toBe('MODERATE');
    expect(result.matchesLast14Days).toBe(3);
  });

  it('should return HEAVY for team with 4 matches in 14 days', () => {
    const matches = [
      createMatch(1),
      createMatch(4),
      createMatch(8),
      createMatch(12),
    ];
    const team = createTeamData(matches, []);

    const result = analyzeCongestion(team);

    expect(result.level).toBe('HEAVY');
    expect(result.matchesLast14Days).toBe(4);
    expect(result.rotationLikely).toBe(true);
  });

  it('should return EXTREME for team with 5+ matches in 14 days', () => {
    const matches = [
      createMatch(1),
      createMatch(3),
      createMatch(6),
      createMatch(9),
      createMatch(13),
    ];
    const team = createTeamData(matches, []);

    const result = analyzeCongestion(team);

    expect(result.level).toBe('EXTREME');
    expect(result.matchesLast14Days).toBe(5);
    expect(result.rotationLikely).toBe(true);
  });

  it('should combine home and away matches', () => {
    const homeMatches = [createMatch(2), createMatch(8)];
    const awayMatches = [createMatch(5), createMatch(11)];
    const team = createTeamData(homeMatches, awayMatches);

    const result = analyzeCongestion(team);

    expect(result.matchesLast14Days).toBe(4);
    expect(result.level).toBe('HEAVY');
  });

  it('should not count matches older than 14 days', () => {
    const matches = [
      createMatch(20),
      createMatch(25),
      createMatch(30),
    ];
    const team = createTeamData(matches, []);

    const result = analyzeCongestion(team);

    expect(result.matchesLast14Days).toBe(0);
    expect(result.level).toBe('NONE');
  });

  it('should calculate average days between matches', () => {
    const matches = [
      createMatch(0),
      createMatch(4),
      createMatch(8),
      createMatch(12),
    ];
    const team = createTeamData(matches, []);

    const result = analyzeCongestion(team);

    // Avg should be around 4 days between matches
    expect(result.avgDaysBetweenMatches).toBeGreaterThan(3);
    expect(result.avgDaysBetweenMatches).toBeLessThan(5);
  });

  it('should include confidence reduction', () => {
    const matches = [
      createMatch(1),
      createMatch(4),
      createMatch(8),
      createMatch(12),
    ];
    const team = createTeamData(matches, []);

    const result = analyzeCongestion(team);

    // HEAVY congestion = 10 confidence reduction
    expect(result.confidenceReduction).toBe(10);
  });
});

describe('calculateCongestionAdjustment', () => {
  it('should return zero impact for teams with no congestion', () => {
    const team = createTeamData([], []);

    const result = calculateCongestionAdjustment(team, team);

    expect(result.homeImpact).toBe(0);
    expect(result.awayImpact).toBe(0);
    expect(result.combinedConfidenceReduction).toBe(0);
  });

  it('should return negative impact for congested teams', () => {
    const congestedMatches = [
      createMatch(1),
      createMatch(3),
      createMatch(6),
      createMatch(9),
      createMatch(12),
    ];
    const congestedTeam = createTeamData(congestedMatches, []);
    const normalTeam = createTeamData([], []);

    const result = calculateCongestionAdjustment(congestedTeam, normalTeam);

    expect(result.homeImpact).toBeLessThan(0);
    expect(result.awayImpact).toBe(0);
  });

  it('should cap combined confidence reduction at 20', () => {
    const extremeMatches = [
      createMatch(1),
      createMatch(3),
      createMatch(5),
      createMatch(7),
      createMatch(9),
      createMatch(11),
      createMatch(13),
    ];
    const extremeTeam = createTeamData(extremeMatches, []);

    const result = calculateCongestionAdjustment(extremeTeam, extremeTeam);

    expect(result.combinedConfidenceReduction).toBeLessThanOrEqual(20);
  });
});

describe('hasSignificantCongestion', () => {
  it('should return false for team with no congestion', () => {
    const team = createTeamData([], []);

    expect(hasSignificantCongestion(team)).toBe(false);
  });

  it('should return false for team with light congestion', () => {
    const matches = [createMatch(3), createMatch(10)];
    const team = createTeamData(matches, []);

    expect(hasSignificantCongestion(team)).toBe(false);
  });

  it('should return true for team with moderate congestion', () => {
    const matches = [createMatch(2), createMatch(7), createMatch(12)];
    const team = createTeamData(matches, []);

    expect(hasSignificantCongestion(team)).toBe(true);
  });

  it('should return true for team with heavy congestion', () => {
    const matches = [
      createMatch(1),
      createMatch(4),
      createMatch(8),
      createMatch(12),
    ];
    const team = createTeamData(matches, []);

    expect(hasSignificantCongestion(team)).toBe(true);
  });
});

describe('compareCongestion', () => {
  it('should identify home team as more congested', () => {
    const congestedMatches = [
      createMatch(1),
      createMatch(4),
      createMatch(8),
      createMatch(12),
    ];
    const homeTeam = createTeamData(congestedMatches, []);
    const awayTeam = createTeamData([], []);

    const result = compareCongestion(homeTeam, awayTeam);

    expect(result.moreCongestedTeam).toBe('home');
    expect(result.differenceScore).toBeGreaterThan(0);
  });

  it('should identify away team as more congested', () => {
    const congestedMatches = [
      createMatch(1),
      createMatch(4),
      createMatch(8),
      createMatch(12),
    ];
    const homeTeam = createTeamData([], []);
    const awayTeam = createTeamData(congestedMatches, []);

    const result = compareCongestion(homeTeam, awayTeam);

    expect(result.moreCongestedTeam).toBe('away');
  });

  it('should identify equal congestion', () => {
    const matches = [createMatch(7)];
    const homeTeam = createTeamData(matches, []);
    const awayTeam = createTeamData(matches, []);

    const result = compareCongestion(homeTeam, awayTeam);

    expect(result.moreCongestedTeam).toBe('equal');
  });

  it('should include a summary', () => {
    const congestedMatches = [
      createMatch(1),
      createMatch(4),
      createMatch(8),
      createMatch(12),
    ];
    const homeTeam = createTeamData(congestedMatches, []);
    const awayTeam = createTeamData([], []);

    const result = compareCongestion(homeTeam, awayTeam);

    expect(result.summary).toBeDefined();
    expect(result.summary.length).toBeGreaterThan(0);
  });
});

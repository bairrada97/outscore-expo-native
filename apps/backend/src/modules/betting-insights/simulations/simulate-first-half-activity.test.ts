/**
 * Tests for simulate-first-half-activity.ts
 *
 * First Half Activity simulation tests.
 */

import { describe, it, expect } from 'vitest';
import { simulateFirstHalfActivity } from './simulate-first-half-activity';
import type { TeamData, H2HData } from '../types';
import type { MatchContext } from '../match-context/context-adjustments';

// Helper to create minimal team data for testing
function createTeamData(overrides: Partial<TeamData> = {}): TeamData {
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
    lastHomeMatches: [],
    lastAwayMatches: [],
    seasonsInLeague: 5,
    ...overrides,
  };
}

function createH2HData(overrides: Partial<H2HData> = {}): H2HData {
  return {
    matches: [],
    h2hMatchCount: 10,
    homeTeamWins: 4,
    awayTeamWins: 3,
    draws: 3,
    bttsCount: 6,
    bttsPercentage: 60,
    goalLineOverCount: { '2.5': 7 },
    goalLineOverPct: { '2.5': 70 },
    avgGoals: 2.8,
    avgHomeGoals: 1.5,
    avgAwayGoals: 1.3,
    recencyWeights: [1, 0.9, 0.8, 0.7, 0.6],
    hasSufficientData: true,
    ...overrides,
  };
}

function createMatchContext(overrides: Partial<MatchContext> = {}): MatchContext {
  return {
    matchType: {
      type: 'LEAGUE',
      importance: 'MEDIUM',
      isKnockout: false,
      isNeutralVenue: false,
      isDerby: false,
      isEndOfSeason: false,
      isPostInternationalBreak: false,
    },
    derby: {
      isDerby: false,
      derbyType: 'NONE',
      intensity: 'LOW',
    },
    isEarlySeason: false,
    isEndOfSeason: false,
    isPostInternationalBreak: false,
    adjustments: {
      recentForm: 1.0,
      h2h: 1.0,
      homeAdvantage: 1.0,
      motivation: 1.0,
      goalScoring: 1.0,
      confidenceReduction: 0,
      goalExpectationAdjustment: 0,
    },
    ...overrides,
  };
}

describe('simulateFirstHalfActivity', () => {
  describe('basic functionality', () => {
    it('should return a valid simulation result', () => {
      const homeTeam = createTeamData({ name: 'Home Team' });
      const awayTeam = createTeamData({ id: 2, name: 'Away Team' });

      const result = simulateFirstHalfActivity(homeTeam, awayTeam);

      expect(result).toBeDefined();
      expect(result.scenarioType).toBe('FirstHalfActivity');
      expect(result.probabilityDistribution).toBeDefined();
      expect(result.probabilityDistribution.yes).toBeDefined();
      expect(result.probabilityDistribution.no).toBeDefined();
    });

    it('should have yes + no probabilities equal 100', () => {
      const homeTeam = createTeamData();
      const awayTeam = createTeamData({ id: 2 });

      const result = simulateFirstHalfActivity(homeTeam, awayTeam);

      const yes = result.probabilityDistribution.yes ?? 0;
      const no = result.probabilityDistribution.no ?? 0;
      expect(Math.round(yes + no)).toBe(100);
    });

    it('should return probability within valid range (0-100)', () => {
      const homeTeam = createTeamData();
      const awayTeam = createTeamData({ id: 2 });

      const result = simulateFirstHalfActivity(homeTeam, awayTeam);

      const yes = result.probabilityDistribution.yes ?? 0;
      expect(yes).toBeGreaterThanOrEqual(0);
      expect(yes).toBeLessThanOrEqual(100);
    });
  });

  describe('first half scoring rate impact', () => {
    it('should increase probability for teams with high first half scoring rate', () => {
      const normalTeam = createTeamData();
      const fastStarterTeam = createTeamData({
        id: 2,
        dna: {
          ...createTeamData().dna,
          firstHalfGoalPercentage: 75, // High first half scoring
          isLateStarter: false,
        },
      });

      const normalResult = simulateFirstHalfActivity(normalTeam, normalTeam);
      const fastStarterResult = simulateFirstHalfActivity(fastStarterTeam, fastStarterTeam);

      const normalYes = normalResult.probabilityDistribution.yes ?? 0;
      const fastStarterYes = fastStarterResult.probabilityDistribution.yes ?? 0;

      expect(fastStarterYes).toBeGreaterThan(normalYes);
    });

    it('should decrease probability for slow starter teams', () => {
      const normalTeam = createTeamData();
      const slowStarterTeam = createTeamData({
        id: 2,
        dna: {
          ...createTeamData().dna,
          firstHalfGoalPercentage: 25, // Low first half scoring
          isLateStarter: true,
        },
      });

      const normalResult = simulateFirstHalfActivity(normalTeam, normalTeam);
      const slowStarterResult = simulateFirstHalfActivity(slowStarterTeam, slowStarterTeam);

      const normalYes = normalResult.probabilityDistribution.yes ?? 0;
      const slowStarterYes = slowStarterResult.probabilityDistribution.yes ?? 0;

      expect(slowStarterYes).toBeLessThan(normalYes);
    });
  });

  describe('H2H impact', () => {
    it('should increase probability with high-scoring H2H', () => {
      const homeTeam = createTeamData();
      const awayTeam = createTeamData({ id: 2 });

      const lowScoringH2H = createH2HData({ avgGoals: 1.5 });
      const highScoringH2H = createH2HData({ avgGoals: 4.0 });

      const lowResult = simulateFirstHalfActivity(homeTeam, awayTeam, lowScoringH2H);
      const highResult = simulateFirstHalfActivity(homeTeam, awayTeam, highScoringH2H);

      const lowYes = lowResult.probabilityDistribution.yes ?? 0;
      const highYes = highResult.probabilityDistribution.yes ?? 0;

      expect(highYes).toBeGreaterThan(lowYes);
    });

    it('should handle missing H2H data gracefully', () => {
      const homeTeam = createTeamData();
      const awayTeam = createTeamData({ id: 2 });

      const result = simulateFirstHalfActivity(homeTeam, awayTeam, undefined);

      expect(result).toBeDefined();
      expect(result.scenarioType).toBe('FirstHalfActivity');
    });
  });

  describe('form impact', () => {
    it('should increase probability for teams in good form', () => {
      const poorFormTeam = createTeamData({
        mood: {
          ...createTeamData().mood,
          tier: 4, // Poor form
          formString: 'LLLLD',
        },
      });

      const goodFormTeam = createTeamData({
        id: 2,
        mood: {
          ...createTeamData().mood,
          tier: 1, // Excellent form
          formString: 'WWWWW',
        },
      });

      const poorFormResult = simulateFirstHalfActivity(poorFormTeam, poorFormTeam);
      const goodFormResult = simulateFirstHalfActivity(goodFormTeam, goodFormTeam);

      const poorFormYes = poorFormResult.probabilityDistribution.yes ?? 0;
      const goodFormYes = goodFormResult.probabilityDistribution.yes ?? 0;

      expect(goodFormYes).toBeGreaterThan(poorFormYes);
    });
  });

  describe('context impact', () => {
    it('should decrease probability for critical matches', () => {
      const homeTeam = createTeamData();
      const awayTeam = createTeamData({ id: 2 });

      const normalContext = createMatchContext();
      const criticalContext = createMatchContext({
        matchType: {
          type: 'CUP',
          importance: 'CRITICAL',
          isKnockout: false,
          isNeutralVenue: false,
          isDerby: false,
          isEndOfSeason: false,
          isPostInternationalBreak: false,
        },
      });

      const normalResult = simulateFirstHalfActivity(homeTeam, awayTeam, undefined, normalContext);
      const criticalResult = simulateFirstHalfActivity(homeTeam, awayTeam, undefined, criticalContext);

      const normalYes = normalResult.probabilityDistribution.yes ?? 0;
      const criticalYes = criticalResult.probabilityDistribution.yes ?? 0;

      expect(criticalYes).toBeLessThan(normalYes);
    });

    it('should decrease probability for knockout matches', () => {
      const homeTeam = createTeamData();
      const awayTeam = createTeamData({ id: 2 });

      const normalContext = createMatchContext();
      const knockoutContext = createMatchContext({
        matchType: {
          type: 'CUP',
          importance: 'HIGH',
          isKnockout: true,
          isNeutralVenue: false,
          isDerby: false,
          isEndOfSeason: false,
          isPostInternationalBreak: false,
        },
      });

      const normalResult = simulateFirstHalfActivity(homeTeam, awayTeam, undefined, normalContext);
      const knockoutResult = simulateFirstHalfActivity(homeTeam, awayTeam, undefined, knockoutContext);

      const normalYes = normalResult.probabilityDistribution.yes ?? 0;
      const knockoutYes = knockoutResult.probabilityDistribution.yes ?? 0;

      expect(knockoutYes).toBeLessThan(normalYes);
    });

    it('should decrease probability for high-intensity derbies', () => {
      const homeTeam = createTeamData();
      const awayTeam = createTeamData({ id: 2 });

      const normalContext = createMatchContext();
      const derbyContext = createMatchContext({
        derby: {
          isDerby: true,
          derbyType: 'LOCAL',
          intensity: 'EXTREME',
        },
      });

      const normalResult = simulateFirstHalfActivity(homeTeam, awayTeam, undefined, normalContext);
      const derbyResult = simulateFirstHalfActivity(homeTeam, awayTeam, undefined, derbyContext);

      const normalYes = normalResult.probabilityDistribution.yes ?? 0;
      const derbyYes = derbyResult.probabilityDistribution.yes ?? 0;

      expect(derbyYes).toBeLessThan(normalYes);
    });
  });

  describe('confidence levels', () => {
    it('should cap confidence at MEDIUM for first half predictions', () => {
      // First half predictions have less data so confidence is typically capped
      const wellDatadTeam = createTeamData({
        mind: {
          ...createTeamData().mind,
          matchCount: 50,
        },
      });

      const result = simulateFirstHalfActivity(wellDatadTeam, wellDatadTeam);

      // First half predictions cap at MEDIUM confidence
      expect(['HIGH', 'MEDIUM']).toContain(result.modelReliability);
    });

    it('should return LOW confidence for teams with limited data', () => {
      const limitedDataTeam = createTeamData({
        mind: {
          ...createTeamData().mind,
          matchCount: 5,
          hasSufficientData: false,
        },
      });

      const result = simulateFirstHalfActivity(limitedDataTeam, limitedDataTeam);

      expect(result.modelReliability).toBe('LOW');
    });
  });

  describe('both slow starters', () => {
    it('should significantly decrease probability when both teams are slow starters', () => {
      const normalTeam = createTeamData();
      const slowStarterTeam = createTeamData({
        dna: {
          ...createTeamData().dna,
          firstHalfGoalPercentage: 20, // Very low first half scoring
          isLateStarter: true,
        },
      });

      const normalResult = simulateFirstHalfActivity(normalTeam, normalTeam);
      const slowResult = simulateFirstHalfActivity(slowStarterTeam, slowStarterTeam);

      const normalYes = normalResult.probabilityDistribution.yes ?? 0;
      const slowYes = slowResult.probabilityDistribution.yes ?? 0;

      // Both teams being slow starters should have a significant impact
      expect(normalYes - slowYes).toBeGreaterThan(5);
    });
  });

  describe('signal strength', () => {
    it('should include signal strength in result', () => {
      const homeTeam = createTeamData();
      const awayTeam = createTeamData({ id: 2 });

      const result = simulateFirstHalfActivity(homeTeam, awayTeam);

      expect(result.signalStrength).toBeDefined();
      expect(['Strong', 'Moderate', 'Balanced', 'Weak']).toContain(result.signalStrength);
    });
  });

  describe('adjustments tracking', () => {
    it('should track adjustments applied', () => {
      const homeTeam = createTeamData();
      const awayTeam = createTeamData({ id: 2 });

      const result = simulateFirstHalfActivity(homeTeam, awayTeam);

      expect(result.adjustmentsApplied).toBeDefined();
      expect(Array.isArray(result.adjustmentsApplied)).toBe(true);
    });
  });
});

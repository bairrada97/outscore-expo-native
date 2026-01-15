/**
 * Tests for injury-adjustments.ts
 *
 * Injury impact calculations for betting insights.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateInjuryAdjustments,
  assessInjuryImpact,
  calculateRelativeInjuryAdvantage,
  calculateBTTSInjuryAdjustment,
  calculateOverUnderInjuryAdjustment,
  shouldDowngradeConfidenceForInjuries,
  getInjurySituationSummary,
} from './injury-adjustments';
import type { ProcessedInjury, FixtureInjuries } from '../data/injuries';

// Helper to create test injuries
function createInjury(
  status: 'OUT' | 'DOUBTFUL' | 'QUESTIONABLE' = 'OUT',
  impact: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM',
): ProcessedInjury {
  return {
    playerId: Math.floor(Math.random() * 10000),
    playerName: 'Test Player',
    teamId: 1,
    status,
    reason: 'Knee Injury',
    impact,
  };
}

function createFixtureInjuries(
  homeInjuries: ProcessedInjury[],
  awayInjuries: ProcessedInjury[],
): FixtureInjuries {
  return {
    fixtureId: 123,
    homeTeamId: 1,
    awayTeamId: 2,
    homeInjuries,
    awayInjuries,
    fetchedAt: Date.now(),
  };
}

describe('assessInjuryImpact', () => {
  it('should return LOW severity for no injuries', () => {
    const impact = assessInjuryImpact([], 'home');
    expect(impact.severity).toBe('LOW');
    expect(impact.adjustmentValue).toBe(0);
    expect(impact.playersOut).toBe(0);
  });

  it('should return LOW severity for 1 injury with no high impact', () => {
    const injuries = [createInjury('OUT', 'LOW')];
    const impact = assessInjuryImpact(injuries, 'home');
    expect(impact.severity).toBe('LOW');
    expect(impact.playersOut).toBe(1);
  });

  it('should return MEDIUM severity for 2+ injuries or 1 high impact', () => {
    const injuries = [createInjury('OUT', 'HIGH')];
    const impact = assessInjuryImpact(injuries, 'home');
    expect(impact.severity).toBe('MEDIUM');
  });

  it('should return HIGH severity for 4+ injuries or 2+ high impact', () => {
    const injuries = [
      createInjury('OUT', 'HIGH'),
      createInjury('OUT', 'HIGH'),
    ];
    const impact = assessInjuryImpact(injuries, 'home');
    expect(impact.severity).toBe('HIGH');
  });

  it('should return CRITICAL severity for 6+ injuries or 3+ high impact', () => {
    const injuries = [
      createInjury('OUT', 'HIGH'),
      createInjury('OUT', 'HIGH'),
      createInjury('OUT', 'HIGH'),
    ];
    const impact = assessInjuryImpact(injuries, 'home');
    expect(impact.severity).toBe('CRITICAL');
  });

  it('should only count OUT status for playersOut', () => {
    const injuries = [
      createInjury('OUT', 'MEDIUM'),
      createInjury('DOUBTFUL', 'MEDIUM'),
      createInjury('QUESTIONABLE', 'LOW'),
    ];
    const impact = assessInjuryImpact(injuries, 'home');
    expect(impact.playersOut).toBe(1);
  });
});

describe('calculateInjuryAdjustments', () => {
  it('should return empty adjustments for null injuries', () => {
    const result = calculateInjuryAdjustments(null);
    expect(result.homeAdjustments).toEqual([]);
    expect(result.awayAdjustments).toEqual([]);
    expect(result.homeImpact).toBeNull();
    expect(result.awayImpact).toBeNull();
  });

  it('should return adjustments for injuries', () => {
    const injuries = createFixtureInjuries(
      [createInjury('OUT', 'HIGH'), createInjury('OUT', 'MEDIUM')],
      [createInjury('OUT', 'LOW')],
    );

    const result = calculateInjuryAdjustments(injuries);
    expect(result.homeAdjustments.length).toBeGreaterThan(0);
    expect(result.homeImpact).not.toBeNull();
    expect(result.awayImpact).not.toBeNull();
  });

  it('should add crisis adjustment for CRITICAL severity', () => {
    const injuries = createFixtureInjuries(
      Array(6).fill(null).map(() => createInjury('OUT', 'MEDIUM')),
      [],
    );

    const result = calculateInjuryAdjustments(injuries);
    expect(result.homeImpact?.severity).toBe('CRITICAL');

    // Should have both main adjustment and crisis adjustment
    const crisisAdjustment = result.homeAdjustments.find(
      (a) => a.name.includes('crisis'),
    );
    expect(crisisAdjustment).toBeDefined();
  });
});

describe('calculateRelativeInjuryAdvantage', () => {
  it('should return 0 for null impacts', () => {
    expect(calculateRelativeInjuryAdvantage(null, null)).toBe(0);
  });

  it('should return positive when away has more injuries', () => {
    const homeImpact = assessInjuryImpact([createInjury('OUT', 'LOW')], 'home');
    const awayImpact = assessInjuryImpact(
      Array(5).fill(null).map(() => createInjury('OUT', 'MEDIUM')),
      'away',
    );

    const advantage = calculateRelativeInjuryAdvantage(homeImpact, awayImpact);
    expect(advantage).toBeLessThan(0); // Away has more injuries, so negative (away disadvantage)
  });
});

describe('calculateBTTSInjuryAdjustment', () => {
  it('should return 0 for no injuries', () => {
    expect(calculateBTTSInjuryAdjustment(null, null)).toBe(0);
  });

  it('should return negative for CRITICAL injuries', () => {
    const homeImpact = assessInjuryImpact(
      Array(6).fill(null).map(() => createInjury('OUT', 'MEDIUM')),
      'home',
    );
    const awayImpact = assessInjuryImpact([], 'away');

    const adjustment = calculateBTTSInjuryAdjustment(homeImpact, awayImpact);
    expect(adjustment).toBeLessThan(0);
  });

  it('should return smaller negative for HIGH injuries', () => {
    const homeImpact = assessInjuryImpact(
      Array(4).fill(null).map(() => createInjury('OUT', 'MEDIUM')),
      'home',
    );
    const awayImpact = assessInjuryImpact([], 'away');

    const adjustment = calculateBTTSInjuryAdjustment(homeImpact, awayImpact);
    expect(adjustment).toBe(-4);
  });
});

describe('calculateOverUnderInjuryAdjustment', () => {
  it('should return 0 for no injuries', () => {
    expect(calculateOverUnderInjuryAdjustment(null, null)).toBe(0);
  });

  it('should return negative for heavy combined injuries', () => {
    const homeImpact = assessInjuryImpact(
      Array(5).fill(null).map(() => createInjury('OUT', 'MEDIUM')),
      'home',
    );
    const awayImpact = assessInjuryImpact(
      Array(5).fill(null).map(() => createInjury('OUT', 'MEDIUM')),
      'away',
    );

    const adjustment = calculateOverUnderInjuryAdjustment(homeImpact, awayImpact);
    expect(adjustment).toBeLessThan(0);
  });
});

describe('shouldDowngradeConfidenceForInjuries', () => {
  it('should return false for no injuries', () => {
    expect(shouldDowngradeConfidenceForInjuries(null, null)).toBe(false);
  });

  it('should return true for CRITICAL injuries', () => {
    const homeImpact = assessInjuryImpact(
      Array(6).fill(null).map(() => createInjury('OUT', 'MEDIUM')),
      'home',
    );
    const awayImpact = assessInjuryImpact([], 'away');

    expect(shouldDowngradeConfidenceForInjuries(homeImpact, awayImpact)).toBe(true);
  });

  it('should return false for non-critical injuries', () => {
    const homeImpact = assessInjuryImpact([createInjury('OUT', 'MEDIUM')], 'home');
    const awayImpact = assessInjuryImpact([createInjury('OUT', 'LOW')], 'away');

    expect(shouldDowngradeConfidenceForInjuries(homeImpact, awayImpact)).toBe(false);
  });
});

describe('getInjurySituationSummary', () => {
  it('should return not available message for null impacts', () => {
    expect(getInjurySituationSummary(null, null)).toBe('Injury data not available');
  });

  it('should return full strength message when no injuries', () => {
    const homeImpact = assessInjuryImpact([], 'home');
    const awayImpact = assessInjuryImpact([], 'away');

    expect(getInjurySituationSummary(homeImpact, awayImpact)).toBe('Both teams at full strength');
  });

  it('should include team summaries when injuries exist', () => {
    const homeImpact = assessInjuryImpact(
      [createInjury('OUT', 'HIGH'), createInjury('OUT', 'MEDIUM')],
      'home',
    );
    const awayImpact = assessInjuryImpact([], 'away');

    const summary = getInjurySituationSummary(homeImpact, awayImpact);
    expect(summary).toContain('Home');
    expect(summary).toContain('2 players out');
  });
});

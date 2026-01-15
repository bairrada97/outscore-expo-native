/**
 * Tests for helpers.ts
 *
 * Core utility functions used throughout the betting insights module.
 */

import { describe, it, expect } from 'vitest';
import {
  clamp,
  determineMatchResult,
  extractRoundNumber,
  calculateDaysSinceLastMatch,
  filterNonFriendlyMatches,
} from './helpers';
import type { ProcessedMatch } from '../types';
import { detectMatchType } from '../match-context/match-type-detector';

describe('clamp', () => {
  it('should return value when within range', () => {
    expect(clamp(50, 0, 100)).toBe(50);
    expect(clamp(0, 0, 100)).toBe(0);
    expect(clamp(100, 0, 100)).toBe(100);
  });

  it('should return min when value is below range', () => {
    expect(clamp(-10, 0, 100)).toBe(0);
    expect(clamp(-100, -50, 50)).toBe(-50);
  });

  it('should return max when value is above range', () => {
    expect(clamp(150, 0, 100)).toBe(100);
    expect(clamp(1000, -50, 50)).toBe(50);
  });

  it('should handle negative ranges', () => {
    expect(clamp(-25, -50, -10)).toBe(-25);
    expect(clamp(-60, -50, -10)).toBe(-50);
    expect(clamp(0, -50, -10)).toBe(-10);
  });
});

describe('determineMatchResult', () => {
  it('should return W when scored more than conceded', () => {
    expect(determineMatchResult(3, 1)).toBe('W');
    expect(determineMatchResult(2, 0)).toBe('W');
    expect(determineMatchResult(1, 0)).toBe('W');
  });

  it('should return L when scored less than conceded', () => {
    expect(determineMatchResult(1, 3)).toBe('L');
    expect(determineMatchResult(0, 2)).toBe('L');
    expect(determineMatchResult(0, 1)).toBe('L');
  });

  it('should return D when scores are equal', () => {
    expect(determineMatchResult(1, 1)).toBe('D');
    expect(determineMatchResult(0, 0)).toBe('D');
    expect(determineMatchResult(3, 3)).toBe('D');
  });
});

describe('extractRoundNumber', () => {
  it('should extract round number from "Regular Season - 10"', () => {
    expect(extractRoundNumber('Regular Season - 10')).toBe(10);
    expect(extractRoundNumber('Regular Season - 1')).toBe(1);
    expect(extractRoundNumber('Regular Season - 38')).toBe(38);
  });

  it('should extract round number from "Round 5"', () => {
    expect(extractRoundNumber('Round 5')).toBe(5);
    expect(extractRoundNumber('Round 15')).toBe(15);
  });

  it('should extract round number from "Matchday 12"', () => {
    expect(extractRoundNumber('Matchday 12')).toBe(12);
    expect(extractRoundNumber('Matchday 1')).toBe(1);
  });

  it('should return null for non-round strings', () => {
    expect(extractRoundNumber('Final')).toBeNull();
    expect(extractRoundNumber('Semi-finals')).toBeNull();
    expect(extractRoundNumber('Quarter-finals')).toBeNull();
    expect(extractRoundNumber(undefined)).toBeNull();
  });

  it('should handle string with just a number', () => {
    expect(extractRoundNumber('10')).toBe(10);
    expect(extractRoundNumber('1')).toBe(1);
    expect(extractRoundNumber(' 5 ')).toBe(5);
  });
});

describe('detectMatchType (diacritics)', () => {
  it('should detect Portuguese cup names with diacritics (Taça de Portugal) as CUP', () => {
    const result = detectMatchType('Taça de Portugal', 'Quarter-finals');
    expect(result.type).toBe('CUP');
    expect(result.importance).toBe('HIGH');
    expect(result.isKnockout).toBe(true);
    expect(result.stageName).toBe('Quarter-Final');
  });
});

describe('calculateDaysSinceLastMatch', () => {
  it('should calculate days correctly', () => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

    expect(calculateDaysSinceLastMatch(yesterday.toISOString())).toBe(1);
    expect(calculateDaysSinceLastMatch(threeDaysAgo.toISOString())).toBe(3);
  });

  it('should return 0 for today', () => {
    const today = new Date().toISOString();
    expect(calculateDaysSinceLastMatch(today)).toBe(0);
  });

  it('should return default (14) for future dates', () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const result = calculateDaysSinceLastMatch(tomorrow.toISOString());
    // Function returns default value (14) for invalid/future dates
    expect(result).toBe(14);
  });

  it('should return default (14) for undefined input', () => {
    expect(calculateDaysSinceLastMatch(undefined)).toBe(14);
  });
});

describe('filterNonFriendlyMatches', () => {
  const createMatch = (leagueName: string): ProcessedMatch => ({
    id: 1,
    date: '2024-01-01',
    homeTeam: { id: 1, name: 'Team A' },
    awayTeam: { id: 2, name: 'Team B' },
    score: { home: 1, away: 0 },
    result: 'W',
    goalsScored: 1,
    goalsConceded: 0,
    league: { id: 1, name: leagueName },
    season: 2024,
    isHome: true,
  });

  it('should filter out friendly matches', () => {
    const matches = [
      createMatch('Premier League'),
      createMatch('Club Friendlies'),
      createMatch('La Liga'),
      createMatch('International Friendlies'),
    ];

    const result = filterNonFriendlyMatches(matches);
    expect(result).toHaveLength(2);
    expect(result[0].league.name).toBe('Premier League');
    expect(result[1].league.name).toBe('La Liga');
  });

  it('should keep all competitive matches', () => {
    const matches = [
      createMatch('Premier League'),
      createMatch('Champions League'),
      createMatch('FA Cup'),
      createMatch('EFL Cup'),
    ];

    const result = filterNonFriendlyMatches(matches);
    expect(result).toHaveLength(4);
  });

  it('should return empty array for all friendly matches', () => {
    const matches = [
      createMatch('Club Friendlies'),
      createMatch('International Friendlies'),
      createMatch('Pre-Season Friendly'),
    ];

    const result = filterNonFriendlyMatches(matches);
    expect(result).toHaveLength(0);
  });

  it('should handle empty input', () => {
    expect(filterNonFriendlyMatches([])).toEqual([]);
  });
});

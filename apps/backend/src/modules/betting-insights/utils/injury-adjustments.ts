/**
 * Injury Adjustments
 *
 * Calculates probability adjustments based on team injuries.
 * More injuries = weaker team = adjustments to predictions.
 *
 * Reference: docs/implementation-plan/phase4.7.md
 */

import type { Adjustment } from '../types';
import type { ProcessedInjury, FixtureInjuries } from '../data/injuries';
import { getInjurySummary, hasSignificantInjuries } from '../data/injuries';
import { createAdjustment } from './capped-adjustments';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Injury impact on team performance
 */
export interface InjuryImpactAssessment {
  /** Total number of players out */
  playersOut: number;
  /** Number of high-impact absences */
  highImpactAbsences: number;
  /** Overall severity: LOW, MEDIUM, HIGH, CRITICAL */
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  /** Base adjustment value (negative = weakening) */
  adjustmentValue: number;
  /** Human-readable summary */
  summary: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Adjustment values per injury severity
 * Negative values because injuries weaken a team
 */
const SEVERITY_ADJUSTMENTS = {
  LOW: -2,      // 1-2 players out, no key players
  MEDIUM: -5,   // 3-4 players out, or 1 key player
  HIGH: -8,     // 5+ players out, or 2+ key players
  CRITICAL: -12, // Severe injury crisis
} as const;

/**
 * Maximum cumulative injury adjustment (prevents over-correction)
 */
const MAX_INJURY_ADJUSTMENT = 15;

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

/**
 * Calculate injury adjustments for both teams
 *
 * @param injuries - Fixture injuries data
 * @returns Adjustments for home and away teams
 */
export function calculateInjuryAdjustments(
  injuries: FixtureInjuries | null | undefined,
): {
  homeAdjustments: Adjustment[];
  awayAdjustments: Adjustment[];
  homeImpact: InjuryImpactAssessment | null;
  awayImpact: InjuryImpactAssessment | null;
} {
  if (!injuries) {
    return {
      homeAdjustments: [],
      awayAdjustments: [],
      homeImpact: null,
      awayImpact: null,
    };
  }

  const homeImpact = assessInjuryImpact(injuries.homeInjuries, 'home');
  const awayImpact = assessInjuryImpact(injuries.awayInjuries, 'away');

  const homeAdjustments = buildInjuryAdjustments(homeImpact, 'home');
  const awayAdjustments = buildInjuryAdjustments(awayImpact, 'away');

  return {
    homeAdjustments,
    awayAdjustments,
    homeImpact,
    awayImpact,
  };
}

/**
 * Assess the overall impact of injuries on a team
 *
 * @param injuries - Team's injuries
 * @param side - 'home' or 'away'
 * @returns Impact assessment
 */
export function assessInjuryImpact(
  injuries: ProcessedInjury[],
  side: 'home' | 'away',
): InjuryImpactAssessment {
  const summary = getInjurySummary(injuries);
  const { out, highImpact } = summary;

  // Determine severity based on count and impact
  let severity: InjuryImpactAssessment['severity'];
  let adjustmentValue: number;

  if (out >= 6 || highImpact >= 3) {
    severity = 'CRITICAL';
    adjustmentValue = SEVERITY_ADJUSTMENTS.CRITICAL;
  } else if (out >= 4 || highImpact >= 2) {
    severity = 'HIGH';
    adjustmentValue = SEVERITY_ADJUSTMENTS.HIGH;
  } else if (out >= 2 || highImpact >= 1) {
    severity = 'MEDIUM';
    adjustmentValue = SEVERITY_ADJUSTMENTS.MEDIUM;
  } else if (out >= 1) {
    severity = 'LOW';
    adjustmentValue = SEVERITY_ADJUSTMENTS.LOW;
  } else {
    severity = 'LOW';
    adjustmentValue = 0;
  }

  // Build summary string
  const summaryParts: string[] = [];
  if (out > 0) {
    summaryParts.push(`${out} player${out > 1 ? 's' : ''} out`);
  }
  if (highImpact > 0) {
    summaryParts.push(`${highImpact} key absence${highImpact > 1 ? 's' : ''}`);
  }

  const summaryText =
    summaryParts.length > 0
      ? `${side === 'home' ? 'Home' : 'Away'}: ${summaryParts.join(', ')}`
      : `${side === 'home' ? 'Home' : 'Away'}: No significant injuries`;

  return {
    playersOut: out,
    highImpactAbsences: highImpact,
    severity,
    adjustmentValue,
    summary: summaryText,
  };
}

/**
 * Build adjustment objects from impact assessment
 */
function buildInjuryAdjustments(
  impact: InjuryImpactAssessment,
  side: 'home' | 'away',
): Adjustment[] {
  const adjustments: Adjustment[] = [];

  if (impact.adjustmentValue === 0) {
    return adjustments;
  }

  // Main injury adjustment
  adjustments.push(
    createAdjustment(
      `injuries_${side}`,
      impact.adjustmentValue,
      impact.summary,
    ),
  );

  // Additional adjustment for critical situations
  if (impact.severity === 'CRITICAL') {
    adjustments.push(
      createAdjustment(
        `injuries_crisis_${side}`,
        -3,
        `${side === 'home' ? 'Home' : 'Away'} team injury crisis`,
      ),
    );
  }

  return adjustments;
}

// ============================================================================
// RELATIVE ADJUSTMENTS
// ============================================================================

/**
 * Calculate relative injury advantage
 *
 * If one team has significantly more injuries than the other,
 * the healthier team gets a boost.
 *
 * @param homeImpact - Home team impact
 * @param awayImpact - Away team impact
 * @returns Relative adjustment (positive = home advantage, negative = away advantage)
 */
export function calculateRelativeInjuryAdvantage(
  homeImpact: InjuryImpactAssessment | null,
  awayImpact: InjuryImpactAssessment | null,
): number {
  if (!homeImpact || !awayImpact) {
    return 0;
  }

  // Compare raw adjustment values
  // homeImpact.adjustmentValue is negative (injuries hurt)
  // If away has more injuries (more negative), home has advantage
  const difference = awayImpact.adjustmentValue - homeImpact.adjustmentValue;

  // Clamp to reasonable range
  return Math.max(-MAX_INJURY_ADJUSTMENT, Math.min(MAX_INJURY_ADJUSTMENT, difference));
}

// ============================================================================
// MARKET-SPECIFIC ADJUSTMENTS
// ============================================================================

/**
 * Calculate BTTS adjustment based on injuries
 *
 * If a team has many injuries (especially attackers), BTTS may be less likely.
 * Note: We don't know positions, so we use a conservative approach.
 *
 * @param homeImpact - Home team impact
 * @param awayImpact - Away team impact
 * @returns BTTS probability adjustment
 */
export function calculateBTTSInjuryAdjustment(
  homeImpact: InjuryImpactAssessment | null,
  awayImpact: InjuryImpactAssessment | null,
): number {
  if (!homeImpact || !awayImpact) {
    return 0;
  }

  // If either team is heavily depleted, BTTS becomes less likely
  // (depleted team less likely to score)
  let adjustment = 0;

  if (homeImpact.severity === 'CRITICAL' || awayImpact.severity === 'CRITICAL') {
    adjustment -= 8; // Significant reduction
  } else if (homeImpact.severity === 'HIGH' || awayImpact.severity === 'HIGH') {
    adjustment -= 4;
  }

  return adjustment;
}

/**
 * Calculate Over/Under adjustment based on injuries
 *
 * More injuries typically means fewer goals (depleted squads score less).
 *
 * @param homeImpact - Home team impact
 * @param awayImpact - Away team impact
 * @returns Over goals probability adjustment (negative = lean under)
 */
export function calculateOverUnderInjuryAdjustment(
  homeImpact: InjuryImpactAssessment | null,
  awayImpact: InjuryImpactAssessment | null,
): number {
  if (!homeImpact || !awayImpact) {
    return 0;
  }

  // Combined injury impact reduces goal expectation
  const combinedSeverity =
    Math.abs(homeImpact.adjustmentValue) + Math.abs(awayImpact.adjustmentValue);

  if (combinedSeverity >= 20) {
    return -6; // Heavy lean to under
  } else if (combinedSeverity >= 12) {
    return -3;
  } else if (combinedSeverity >= 6) {
    return -1;
  }

  return 0;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Check if injury data should trigger a confidence downgrade
 *
 * @param homeImpact - Home team impact
 * @param awayImpact - Away team impact
 * @returns True if prediction confidence should be reduced
 */
export function shouldDowngradeConfidenceForInjuries(
  homeImpact: InjuryImpactAssessment | null,
  awayImpact: InjuryImpactAssessment | null,
): boolean {
  // If either team has critical injuries, models become less reliable
  return (
    homeImpact?.severity === 'CRITICAL' || awayImpact?.severity === 'CRITICAL'
  );
}

/**
 * Get human-readable injury situation summary
 */
export function getInjurySituationSummary(
  homeImpact: InjuryImpactAssessment | null,
  awayImpact: InjuryImpactAssessment | null,
): string {
  if (!homeImpact && !awayImpact) {
    return 'Injury data not available';
  }

  const parts: string[] = [];

  if (homeImpact && homeImpact.playersOut > 0) {
    parts.push(homeImpact.summary);
  }
  if (awayImpact && awayImpact.playersOut > 0) {
    parts.push(awayImpact.summary);
  }

  if (parts.length === 0) {
    return 'Both teams at full strength';
  }

  return parts.join('. ');
}

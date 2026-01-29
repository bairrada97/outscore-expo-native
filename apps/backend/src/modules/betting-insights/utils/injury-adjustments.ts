/**
 * Injury Adjustments
 *
 * Calculates probability adjustments based on team injuries.
 * More injuries = weaker team = adjustments to predictions.
 *
 * In uncapped mode, injuries are scaled by team tier:
 * - Elite teams (tier 1): injuries hurt 40% as much (more squad depth)
 * - Strong teams (tier 2): injuries hurt 60% as much
 * - Average teams (tier 3): injuries hurt 85% as much
 * - Weak teams (tier 4): injuries hurt full amount
 *
 * Also scaled by opponent quality:
 * - Injuries matter less against weaker opponents
 *
 * Reference: docs/implementation-plan/phase4.7.md
 */

import type { Adjustment, TeamData } from '../types';
import type { ProcessedInjury, FixtureInjuries } from '../data/injuries';
import { getInjurySummary } from '../data/injuries';
import { createAdjustment } from './capped-adjustments';
import {
  INJURY_TIER_MULTIPLIERS,
  INJURY_OPPONENT_MULTIPLIERS,
  getUncappedModeEnabled,
} from '../config/algorithm-config';

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
 * @param homeTeam - Home team data (optional, for tier-proportional adjustments)
 * @param awayTeam - Away team data (optional, for tier-proportional adjustments)
 * @returns Adjustments for home and away teams
 */
export function calculateInjuryAdjustments(
  injuries: FixtureInjuries | null | undefined,
  homeTeam?: TeamData,
  awayTeam?: TeamData,
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

  // In uncapped mode, apply tier-proportional adjustments
  const homeAdjustments = getUncappedModeEnabled() && homeTeam && awayTeam
    ? buildTierProportionalInjuryAdjustments(homeImpact, 'home', homeTeam, awayTeam)
    : buildInjuryAdjustments(homeImpact, 'home');

  const awayAdjustments = getUncappedModeEnabled() && homeTeam && awayTeam
    ? buildTierProportionalInjuryAdjustments(awayImpact, 'away', awayTeam, homeTeam)
    : buildInjuryAdjustments(awayImpact, 'away');

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

/**
 * Build tier-proportional injury adjustments (uncapped mode)
 *
 * Elite teams have more squad depth, so injuries hurt less.
 * Also, injuries matter less when playing against weaker opponents.
 *
 * Example: PSG (tier 1) vs Auxerre (tier 4)
 * - PSG base injury impact: -17
 * - Tier multiplier: 0.4 (elite team)
 * - Opponent multiplier: 0.5 (vs weak team)
 * - Final impact: -17 * 0.4 * 0.5 = -3.4
 *
 * @param impact - Base injury impact assessment
 * @param side - 'home' or 'away'
 * @param team - Team with injuries
 * @param opponent - Opposing team
 */
function buildTierProportionalInjuryAdjustments(
  impact: InjuryImpactAssessment,
  side: 'home' | 'away',
  team: TeamData,
  opponent: TeamData,
): Adjustment[] {
  const adjustments: Adjustment[] = [];

  if (impact.adjustmentValue === 0) {
    return adjustments;
  }

  // Get team tier (1-4, default to 3 if unknown)
  const teamTier = team.mind?.tier ?? 3;
  const opponentTier = opponent.mind?.tier ?? 3;

  // Get multipliers from config
  const tierMultiplier = INJURY_TIER_MULTIPLIERS[teamTier] ?? 1.0;
  const opponentMultiplier = INJURY_OPPONENT_MULTIPLIERS[opponentTier] ?? 1.0;

  // Calculate final adjustment
  const scaledAdjustment = impact.adjustmentValue * tierMultiplier * opponentMultiplier;

  // Build reason with context
  const tierContext = tierMultiplier < 1.0
    ? ` (scaled: tier ${teamTier} team has more depth)`
    : '';
  const opponentContext = opponentMultiplier < 1.0
    ? ` vs weaker opponent`
    : '';

  // Main injury adjustment
  adjustments.push(
    createAdjustment(
      `injuries_${side}`,
      scaledAdjustment,
      `${impact.summary}${tierContext}${opponentContext}`,
    ),
  );

  // Reduced crisis adjustment for critical situations (also scaled)
  if (impact.severity === 'CRITICAL') {
    const crisisAdjustment = -3 * tierMultiplier * opponentMultiplier;
    adjustments.push(
      createAdjustment(
        `injuries_crisis_${side}`,
        crisisAdjustment,
        `${side === 'home' ? 'Home' : 'Away'} team injury crisis (scaled)`,
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
 * The effect on total goals depends on WHO is injured and the quality gap:
 * - Weaker team injured vs stronger team = MORE goals (stronger team exploits weakness)
 * - Stronger team injured vs weaker team = LESS goals (weaker team can't capitalize much)
 * - Both teams injured equally = neutral to slight under
 *
 * @param homeImpact - Home team impact
 * @param awayImpact - Away team impact
 * @param homeTeam - Home team data (for tier comparison)
 * @param awayTeam - Away team data (for tier comparison)
 * @returns Over goals probability adjustment (positive = lean over, negative = lean under)
 */
export function calculateOverUnderInjuryAdjustment(
  homeImpact: InjuryImpactAssessment | null,
  awayImpact: InjuryImpactAssessment | null,
  homeTeam?: TeamData,
  awayTeam?: TeamData,
): number {
  if (!homeImpact && !awayImpact) {
    return 0;
  }

  const homeTier = homeTeam?.mind?.tier ?? 3;
  const awayTier = awayTeam?.mind?.tier ?? 3;
  const tierGap = homeTier - awayTier; // Negative = home is stronger

  const homeInjurySeverity = Math.abs(homeImpact?.adjustmentValue ?? 0);
  const awayInjurySeverity = Math.abs(awayImpact?.adjustmentValue ?? 0);

  // Calculate the net effect based on tier gap
  // When stronger team's opponent is injured, expect MORE goals
  // When weaker team's opponent is injured, smaller effect

  let adjustment = 0;

  if (awayInjurySeverity > 0) {
    // Away team (Pisa) injured
    if (tierGap < 0) {
      // Home team (Inter) is stronger - they'll score more against weakened defense
      // Boost Over probability proportional to tier gap and injury severity
      const tierBoost = Math.min(Math.abs(tierGap), 3); // Max 3 tier difference
      adjustment += (awayInjurySeverity / 100) * (3 + tierBoost * 2);
    } else {
      // Home team is weaker or equal - slight reduction (injured team scores less)
      adjustment -= (awayInjurySeverity / 100) * 1;
    }
  }

  if (homeInjurySeverity > 0) {
    // Home team injured
    if (tierGap > 0) {
      // Away team is stronger - they'll score more against weakened defense
      const tierBoost = Math.min(tierGap, 3);
      adjustment += (homeInjurySeverity / 100) * (3 + tierBoost * 2);
    } else {
      // Away team is weaker or equal - slight reduction
      adjustment -= (homeInjurySeverity / 100) * 1;
    }
  }

  // Clamp to reasonable range
  return clamp(adjustment, -8, 8);
}

/**
 * Build injury adjustments specifically for goal markets (BTTS, Over/Under)
 * 
 * These adjustments show the NET effect on total goals, accounting for:
 * - Which team is injured (attack reduction vs defense weakness)
 * - The tier gap between teams (stronger teams exploit injuries more)
 * 
 * @param homeImpact - Home team injury impact
 * @param awayImpact - Away team injury impact  
 * @param homeTeam - Home team data
 * @param awayTeam - Away team data
 * @returns Adjustments for goal markets
 */
export function buildGoalMarketInjuryAdjustments(
  homeImpact: InjuryImpactAssessment | null,
  awayImpact: InjuryImpactAssessment | null,
  homeTeam?: TeamData,
  awayTeam?: TeamData,
): Adjustment[] {
  const adjustments: Adjustment[] = [];
  
  const homeTier = homeTeam?.mind?.tier ?? 3;
  const awayTier = awayTeam?.mind?.tier ?? 3;
  
  // Home team injuries
  if (homeImpact && homeImpact.adjustmentValue !== 0) {
    const severity = Math.abs(homeImpact.adjustmentValue);
    
    if (awayTier < homeTier) {
      // Stronger away team will exploit home's injuries -> more goals
      const tierGap = homeTier - awayTier;
      const boost = (severity / 100) * (2 + tierGap * 1.5);
      adjustments.push(
        createAdjustment(
          'injuries_goals_home',
          boost,
          `${homeImpact.summary} - stronger opponent will exploit weakness`,
        ),
      );
    } else {
      // Weaker/equal away team - reduced home attack, slight reduction in goals
      const reduction = (severity / 100) * -1.5;
      adjustments.push(
        createAdjustment(
          'injuries_goals_home',
          reduction,
          `${homeImpact.summary} - reduced attacking threat`,
        ),
      );
    }
  }
  
  // Away team injuries  
  if (awayImpact && awayImpact.adjustmentValue !== 0) {
    const severity = Math.abs(awayImpact.adjustmentValue);
    
    if (homeTier < awayTier) {
      // Stronger home team will exploit away's injuries -> more goals
      const tierGap = awayTier - homeTier;
      const boost = (severity / 100) * (2 + tierGap * 1.5);
      adjustments.push(
        createAdjustment(
          'injuries_goals_away',
          boost,
          `${awayImpact.summary} - stronger opponent will exploit weakness`,
        ),
      );
    } else {
      // Weaker/equal home team - reduced away attack, slight reduction in goals
      const reduction = (severity / 100) * -1.5;
      adjustments.push(
        createAdjustment(
          'injuries_goals_away',
          reduction,
          `${awayImpact.summary} - reduced attacking threat`,
        ),
      );
    }
  }
  
  return adjustments;
}

// Helper for clamping (duplicated to avoid circular import)
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
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

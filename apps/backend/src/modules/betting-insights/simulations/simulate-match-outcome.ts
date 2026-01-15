/**
 * Match Result (1X2) Prediction
 *
 * CRITICAL: This is the proper implementation per Section 4.6.1.
 * DO NOT use simplified hardcoded probabilities (40/25/35).
 *
 * Uses all 6 factors with proper weights:
 * - Recent Form (30%): Compare home vs away form
 * - H2H Record (25%): Win percentages from H2H
 * - Dynamic Home Advantage (20%): Based on actual stats
 * - Motivation (18%): Who wants it more
 * - Rest Advantage (12%): Days since last match difference
 * - League Position (10%): Quality/tier difference
 *
 * Reference: docs/implementation-plan/phase4.md - Section 4.3
 * Algorithm: docs/betting-insights-Algorithm.md - Section 4.6.1
 */

import type {
  TeamData,
  H2HData,
  ConfidenceLevel,
  Adjustment,
  AlgorithmConfig,
  Insight,
  Simulation,
} from '../types';
import type { MatchContext } from '../match-context/context-adjustments';
import { finalizeSimulation } from '../presentation/simulation-presenter';
import {
  applyCappedAsymmetricAdjustments,
  createAdjustment,
} from '../utils/capped-adjustments';
import { DEFAULT_ALGORITHM_CONFIG } from '../config/algorithm-config';
import { clamp } from '../utils/helpers';

// Extracted factor calculation utilities (Phase 4.6)
import { calculateFormScore } from '../utils/form-score';
import { calculateH2HScore } from '../utils/h2h-score';
import { calculateHomeAdvantageScore } from '../utils/home-advantage';
import { calculateMotivationScore, getMotivationValue } from '../utils/motivation-score';
import { calculateRestScore, calculateRestQuality } from '../utils/rest-score';
import { calculatePositionScore } from '../utils/position-score';

// ============================================================================
// CONSTANTS - Section 4.6.1 Weights
// ============================================================================

/**
 * Market weights for Match Result prediction
 * These are the proper weights from Section 4.6.1
 */
const MATCH_RESULT_WEIGHTS = {
  recentForm: 0.30,
  h2h: 0.25,
  homeAdvantage: 0.20,
  motivation: 0.18,
  rest: 0.12,
  leaguePosition: 0.10,
} as const;

/**
 * Base probabilities (neutral starting point)
 * Home teams statistically win ~45%, draw ~27%, away ~28%
 */
const BASE_PROBABILITIES = {
  home: 35, // Base before any factors
  draw: 30,
  away: 35,
} as const;

/**
 * Typical draw rate in football
 */
const TYPICAL_DRAW_RATE = 27;

// ============================================================================
// MAIN PREDICTION FUNCTION
// ============================================================================

/**
 * Predict Match Result (Home/Draw/Away)
 *
 * IMPORTANT: Uses all 6 factors per Section 4.6.1
 *
 * @param homeTeam - Home team data
 * @param awayTeam - Away team data
 * @param h2h - Head-to-head data
 * @param context - Match context (optional)
 * @param config - Algorithm configuration
 * @returns Match result prediction with all three probabilities
 */
export function simulateMatchOutcome(
  homeTeam: TeamData,
  awayTeam: TeamData,
  h2h?: H2HData,
  context?: MatchContext,
  config: AlgorithmConfig = DEFAULT_ALGORITHM_CONFIG,
): Simulation {
  // =========================================================================
  // STEP 1: Calculate factor scores (Section 4.6.1)
  // =========================================================================

  // Factor 1: Recent Form Comparison (30% weight)
  const formScore = calculateFormScore(homeTeam, awayTeam);

  // Factor 2: H2H Record (25% weight)
  const h2hScore = calculateH2HScore(h2h);

  // Factor 3: Dynamic Home Advantage (20% weight)
  const homeAdvantageScore = calculateHomeAdvantageScore(homeTeam, awayTeam);

  // Factor 4: Motivation Score (18% weight)
  const motivationScore = calculateMotivationScore(homeTeam, awayTeam);

  // Factor 5: Rest Advantage (12% weight)
  const restScore = calculateRestScore(homeTeam, awayTeam);

  // Factor 6: League Position/Quality (10% weight)
  const positionScore = calculatePositionScore(homeTeam, awayTeam);

  // =========================================================================
  // STEP 2: Calculate base probabilities from factors
  // =========================================================================

  let homeProb = BASE_PROBABILITIES.home;
  let awayProb = BASE_PROBABILITIES.away;

  // Apply Factor 1: Recent Form (max ±12 points based on 30% weight)
  const formAdjustment = (formScore / 100) * 12;
  homeProb += formAdjustment * MATCH_RESULT_WEIGHTS.recentForm;

  // Apply Factor 2: H2H Record (max ±10 points based on 25% weight)
  const h2hAdjustment = (h2hScore / 100) * 10;
  homeProb += h2hAdjustment * MATCH_RESULT_WEIGHTS.h2h;

  // Apply Factor 3: Home Advantage (max ±8 points based on 20% weight)
  const homeAdvAdjustment = (homeAdvantageScore / 100) * 8;
  homeProb += homeAdvAdjustment * MATCH_RESULT_WEIGHTS.homeAdvantage;

  // Apply Factor 4: Motivation (max ±7 points based on 18% weight)
  const motivationAdjustment = (motivationScore / 100) * 7;
  homeProb += motivationAdjustment * MATCH_RESULT_WEIGHTS.motivation;

  // Apply Factor 5: Rest (max ±5 points based on 12% weight)
  const restAdjustment = (restScore / 100) * 5;
  homeProb += restAdjustment * MATCH_RESULT_WEIGHTS.rest;

  // Apply Factor 6: Position (max ±4 points based on 10% weight)
  const positionAdjustment = (positionScore / 100) * 4;
  homeProb += positionAdjustment * MATCH_RESULT_WEIGHTS.leaguePosition;

  // Away probability is inverse (mirror adjustments)
  awayProb -= formAdjustment * MATCH_RESULT_WEIGHTS.recentForm;
  awayProb -= h2hAdjustment * MATCH_RESULT_WEIGHTS.h2h;
  awayProb -= homeAdvAdjustment * MATCH_RESULT_WEIGHTS.homeAdvantage;
  awayProb -= motivationAdjustment * MATCH_RESULT_WEIGHTS.motivation;
  awayProb -= restAdjustment * MATCH_RESULT_WEIGHTS.rest;
  awayProb -= positionAdjustment * MATCH_RESULT_WEIGHTS.leaguePosition;

  // =========================================================================
  // STEP 3: Calculate draw probability
  // =========================================================================

  // Draw probability based on form similarity and H2H draw rate
  let drawProb = calculateDrawProbability(homeTeam, awayTeam, h2h, homeProb, awayProb);

  // =========================================================================
  // STEP 4: Collect adjustments for capping
  // =========================================================================

  const homeAdjustments: Adjustment[] = [];
  const awayAdjustments: Adjustment[] = [];

  // Add Mind/Mood gap adjustments
  addMindMoodAdjustments(homeTeam, awayTeam, homeAdjustments, awayAdjustments);

  // Add formation stability adjustments (full impact for Match Result)
  addFormationAdjustments(homeTeam, awayTeam, homeAdjustments, awayAdjustments, 1.0);

  // Add safety flag adjustments
  addSafetyFlagAdjustments(homeTeam, awayTeam, homeAdjustments, awayAdjustments);

  // Add context adjustments
  if (context) {
    addContextAdjustments(context, homeAdjustments, awayAdjustments);
  }

  // =========================================================================
  // STEP 5: Apply capped adjustments
  // =========================================================================

  const baseConfidence = calculateBaseConfidence(homeTeam, awayTeam, h2h);

  // Apply adjustments to home probability
  const homeResult = applyCappedAsymmetricAdjustments(
    homeProb,
    homeAdjustments,
    'MatchOutcome',
    config,
    baseConfidence,
  );

  // Apply adjustments to away probability (inverse adjustments)
  const awayResult = applyCappedAsymmetricAdjustments(
    awayProb,
    awayAdjustments,
    'MatchOutcome',
    config,
    baseConfidence,
  );

  // =========================================================================
  // STEP 6: Normalize to ensure sum = 100%
  // =========================================================================

  const normalized = normalizeProbabilities(
    homeResult.finalProbability,
    drawProb,
    awayResult.finalProbability,
  );

  // Optional post-normalization shifts (kept small, conservative)
  const extraAdjustments: Adjustment[] = [];
  let finalProbs = normalized;

  // Live dog: underdog competitiveness tends to increase draw probability more than outright away wins.
  if (awayTeam.safetyFlags?.liveDog) {
    finalProbs = applyLiveDogCompetitivenessShift(finalProbs);
    extraAdjustments.push(
      createAdjustment(
        'live_dog_competitiveness',
        0,
        'Away team shows live-dog signals; shifted probability from home win into draw/away (competitiveness)',
      ),
    );
  }

  // =========================================================================
  // STEP 7: Build response
  // =========================================================================

  return buildMatchResultPrediction(
    finalProbs,
    homeResult,
    awayResult,
    homeTeam,
    awayTeam,
    h2h,
    {
      formScore,
      h2hScore,
      homeAdvantageScore,
      motivationScore,
      restScore,
      positionScore,
    },
    extraAdjustments,
  );
}

// ============================================================================
// DRAW PROBABILITY
// ============================================================================

/**
 * Calculate draw probability
 *
 * Based on:
 * - Form similarity (close teams = more draws)
 * - H2H draw rate
 * - Tier similarity
 */
function calculateDrawProbability(
  homeTeam: TeamData,
  awayTeam: TeamData,
  h2h: H2HData | undefined,
  homeProb: number,
  awayProb: number,
): number {
  let drawProb = TYPICAL_DRAW_RATE;

  // Factor 1: Form similarity (close home/away prob = more draws)
  const probDiff = Math.abs(homeProb - awayProb);
  if (probDiff < 10) {
    drawProb += 5; // Close match
  } else if (probDiff > 25) {
    drawProb -= 3; // Clear favorite
  }

  // Factor 2: Tier similarity
  const homeTier = homeTeam.mind?.tier ?? 3;
  const awayTier = awayTeam.mind?.tier ?? 3;
  if (homeTier === awayTier) {
    drawProb += 3; // Same tier teams draw more
  }

  // Factor 3: H2H draw rate
  if (h2h && h2h.h2hMatchCount >= 3) {
    const h2hDrawRate = (h2h.draws / h2h.h2hMatchCount) * 100;
    // Blend with base draw rate
    drawProb = (drawProb * 0.6) + (h2hDrawRate * 0.4);
  }

  return clamp(drawProb, 15, 40);
}

// ============================================================================
// ADJUSTMENT FUNCTIONS
// ============================================================================

/**
 * Add Mind/Mood gap adjustments (Sleeping Giant, Over-Performer)
 */
function addMindMoodAdjustments(
  homeTeam: TeamData,
  awayTeam: TeamData,
  homeAdj: Adjustment[],
  awayAdj: Adjustment[],
): void {
  // Sleeping Giant: Elite team in bad form = value
  if (homeTeam.mood?.isSleepingGiant) {
    homeAdj.push(
      createAdjustment(
        'sleeping_giant_home',
        10,
        'Home team is elite quality in poor form - value opportunity',
      ),
    );
  }

  if (awayTeam.mood?.isSleepingGiant) {
    awayAdj.push(
      createAdjustment(
        'sleeping_giant_away',
        10,
        'Away team is elite quality in poor form - value opportunity',
      ),
    );
  }

  // Over-Performer: Lower team in great form = regression risk
  if (homeTeam.mood?.isOverPerformer) {
    homeAdj.push(
      createAdjustment(
        'over_performer_home',
        -8,
        'Home team is overperforming - regression risk',
      ),
    );
  }

  if (awayTeam.mood?.isOverPerformer) {
    awayAdj.push(
      createAdjustment(
        'over_performer_away',
        -8,
        'Away team is overperforming - regression risk',
      ),
    );
  }
}

/**
 * Add formation stability adjustments
 */
function addFormationAdjustments(
  homeTeam: TeamData,
  awayTeam: TeamData,
  homeAdj: Adjustment[],
  awayAdj: Adjustment[],
  impactMultiplier: number,
): void {
  // NOTE: No dedicated match-level formation context is wired in yet.
  // Use a lightweight proxy based on formation usage %.
  const homeUsage =
    homeTeam.dna?.formationFrequency?.[homeTeam.dna?.mostPlayedFormation] ?? 100;
  const awayUsage =
    awayTeam.dna?.formationFrequency?.[awayTeam.dna?.mostPlayedFormation] ?? 100;

  const homeReduction = homeUsage < 40 ? clamp((40 - homeUsage) * 0.8, 0, 25) : 0;
  const awayReduction = awayUsage < 40 ? clamp((40 - awayUsage) * 0.8, 0, 25) : 0;

  if (homeReduction > 10) {
    homeAdj.push(
      createAdjustment(
        'formation_instability_home',
        -homeReduction * impactMultiplier * 0.5,
        'Home team using experimental formation',
      ),
    );
  }

  if (awayReduction > 10) {
    awayAdj.push(
      createAdjustment(
        'formation_instability_away',
        -awayReduction * impactMultiplier * 0.5,
        'Away team using experimental formation',
      ),
    );
  }
}

/**
 * Add safety flag adjustments
 */
function addSafetyFlagAdjustments(
  homeTeam: TeamData,
  awayTeam: TeamData,
  homeAdj: Adjustment[],
  awayAdj: Adjustment[],
): void {
  // Regression risk
  if (homeTeam.safetyFlags?.regressionRisk) {
    homeAdj.push(
      createAdjustment(
        'regression_risk_home',
        -5,
        'Home team showing regression risk patterns',
      ),
    );
  }

  if (awayTeam.safetyFlags?.regressionRisk) {
    awayAdj.push(
      createAdjustment(
        'regression_risk_away',
        -5,
        'Away team showing regression risk patterns',
      ),
    );
  }
}

/**
 * Add context-based adjustments
 */
function addContextAdjustments(
  context: MatchContext,
  homeAdj: Adjustment[],
  awayAdj: Adjustment[],
): void {
  // Neutral venue reduces home advantage
  if (context.matchType.isNeutralVenue) {
    homeAdj.push(
      createAdjustment(
        'neutral_venue',
        -5,
        'Neutral venue - reduced home advantage',
      ),
    );
  }

  // Derby match adjustments
  if (context.derby.isDerby) {
    // Derbies are unpredictable - slight penalty to favorite
    homeAdj.push(
      createAdjustment(
        'derby_unpredictability_home',
        -3,
        'Derby match - increased unpredictability',
      ),
    );
    awayAdj.push(
      createAdjustment(
        'derby_unpredictability_away',
        -2,
        'Derby match - increased unpredictability',
      ),
    );
  }
}

// ============================================================================
// NORMALIZATION
// ============================================================================

/**
 * Normalize probabilities to sum to 100%
 */
function normalizeProbabilities(
  home: number,
  draw: number,
  away: number,
): { home: number; draw: number; away: number } {
  // Ensure all are positive
  home = Math.max(5, home);
  draw = Math.max(5, draw);
  away = Math.max(5, away);

  const total = home + draw + away;

  return {
    home: (home / total) * 100,
    draw: (draw / total) * 100,
    away: (away / total) * 100,
  };
}

function applyLiveDogCompetitivenessShift(probs: {
  home: number;
  draw: number;
  away: number;
}): { home: number; draw: number; away: number } {
  // Target shift (percentage points): home -> draw/away
  const desiredHomeDown = 1.5;
  const desiredDrawUp = 1.0;
  const desiredAwayUp = 0.5;

  // Respect the minimum bucket constraint used elsewhere (>=5)
  const maxHomeDown = Math.max(0, probs.home - 5);
  const scale =
    desiredHomeDown > 0 ? Math.min(1, maxHomeDown / desiredHomeDown) : 0;

  const homeDown = desiredHomeDown * scale;
  const drawUp = desiredDrawUp * scale;
  const awayUp = desiredAwayUp * scale;

  return {
    home: probs.home - homeDown,
    draw: probs.draw + drawUp,
    away: probs.away + awayUp,
  };
}

// ============================================================================
// CONFIDENCE & RESPONSE
// ============================================================================

/**
 * Calculate base confidence
 */
function calculateBaseConfidence(
  homeTeam: TeamData,
  awayTeam: TeamData,
  h2h?: H2HData,
): ConfidenceLevel {
  let confidence: ConfidenceLevel = 'MEDIUM';

  const homeData = homeTeam.mind?.matchCount ?? 0;
  const awayData = awayTeam.mind?.matchCount ?? 0;

  if (homeData >= 30 && awayData >= 30) {
    confidence = 'HIGH';
  } else if (homeData < 15 || awayData < 15) {
    confidence = 'LOW';
  }

  return confidence;
}

/**
 * Build final prediction response
 */
function buildMatchResultPrediction(
  probs: { home: number; draw: number; away: number },
  homeResult: ReturnType<typeof applyCappedAsymmetricAdjustments>,
  awayResult: ReturnType<typeof applyCappedAsymmetricAdjustments>,
  _homeTeam: TeamData,
  _awayTeam: TeamData,
  _h2h: H2HData | undefined,
  factorScores: {
    formScore: number;
    h2hScore: number;
    homeAdvantageScore: number;
    motivationScore: number;
    restScore: number;
    positionScore: number;
  },
  extraAdjustments: Adjustment[] = [],
): Simulation {
  // Note: _homeTeam, _awayTeam, _h2h, and _factorScores are passed for potential
  // future use (e.g., detailed breakdown in response) but not currently used.

  // Get confidence (use worse of the two)
  const confidence =
    homeResult.confidenceLevel === 'LOW' || awayResult.confidenceLevel === 'LOW'
      ? 'LOW'
      : homeResult.confidenceLevel === 'MEDIUM' ||
          awayResult.confidenceLevel === 'MEDIUM'
        ? 'MEDIUM'
        : 'HIGH';

  return finalizeSimulation({
    scenarioType: 'MatchOutcome',
    probabilityDistribution: {
      home: Math.round(probs.home * 10) / 10,
      draw: Math.round(probs.draw * 10) / 10,
      away: Math.round(probs.away * 10) / 10,
    },
    modelReliability: confidence,
    insights: buildMatchOutcomeInsights(probs, factorScores),
    factorScores,
    adjustmentsApplied: [
      ...homeResult.cappedAdjustments,
      ...awayResult.cappedAdjustments,
      ...extraAdjustments,
    ],
    totalAdjustment: homeResult.totalAdjustment + awayResult.totalAdjustment,
    capsHit: homeResult.wasCapped || awayResult.wasCapped,
    overcorrectionWarning:
      homeResult.overcorrectionWarning || awayResult.overcorrectionWarning,
  });
}
// Note: `signalStrength` and `mostProbableOutcome` are added via `finalizeSimulation`.

function buildMatchOutcomeInsights(
  probs: { home: number; draw: number; away: number },
  factorScores: {
    formScore: number;
    h2hScore: number;
    homeAdvantageScore: number;
    motivationScore: number;
    restScore: number;
    positionScore: number;
  },
): Insight[] {
  const insights: Insight[] = [];

  // Always include the modelled probabilities for transparency
  insights.push({
    text: `Model probability: Home ${probs.home.toFixed(0)}% / Draw ${probs.draw.toFixed(0)}% / Away ${probs.away.toFixed(0)}%`,
    emoji: '🎯',
    priority: 80,
    category: 'VALUE',
    severity: 'MEDIUM',
  });

  const drivers: Array<{
    key: string;
    score: number;
    label: string;
    emoji: string;
    category: Insight['category'];
  }> = [
    {
      key: 'h2hScore',
      score: factorScores.h2hScore,
      label: 'H2H',
      emoji: '🤝',
      category: 'H2H',
    },
    {
      key: 'homeAdvantageScore',
      score: factorScores.homeAdvantageScore,
      label: 'Home advantage',
      emoji: '🏠',
      category: 'CONTEXT',
    },
    {
      key: 'restScore',
      score: factorScores.restScore,
      label: 'Rest',
      emoji: '🛌',
      category: 'CONTEXT',
    },
    {
      key: 'formScore',
      score: factorScores.formScore,
      label: 'Recent form',
      emoji: '🔥',
      category: 'FORM',
    },
    {
      key: 'positionScore',
      score: factorScores.positionScore,
      label: 'Baseline quality',
      emoji: '📊',
      category: 'SAFETY',
    },
    {
      key: 'motivationScore',
      score: factorScores.motivationScore,
      label: 'Motivation',
      emoji: '🎯',
      category: 'CONTEXT',
    },
  ];

  const sorted = drivers
    .map((d) => ({ ...d, abs: Math.abs(d.score) }))
    .filter((d) => d.abs >= 12)
    .sort((a, b) => b.abs - a.abs)
    .slice(0, 2);

  for (const d of sorted) {
    const leans = d.score > 0 ? 'Home' : d.score < 0 ? 'Away' : 'Neutral';
    const severity: Insight['severity'] =
      d.abs >= 30 ? 'HIGH' : d.abs >= 18 ? 'MEDIUM' : 'LOW';
    const priority = d.abs >= 30 ? 75 : d.abs >= 18 ? 65 : 55;

    insights.push({
      text: `${d.label} leans ${leans} (score ${d.score.toFixed(0)})`,
      emoji: d.emoji,
      priority,
      category: d.category,
      severity,
    });
  }

  return insights;
}

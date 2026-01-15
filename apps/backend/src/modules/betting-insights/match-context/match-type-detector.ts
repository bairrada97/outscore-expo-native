/**
 * Match Type Detection
 *
 * Detects match type (league, cup, international, friendly) and applies
 * type-specific weight adjustments for simulations.
 *
 * Reference: docs/implementation-plan/phase3.5.md - Sections 3.5.1 and 3.5.2
 * Algorithm: docs/betting-insights-Algorithm.md - Match Type Detection section
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * Match type classification
 */
export type MatchTypeCategory = 'LEAGUE' | 'CUP' | 'INTERNATIONAL' | 'FRIENDLY';

/**
 * Match importance level
 */
export type MatchImportance = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/**
 * Complete match type information
 */
export interface MatchType {
  type: MatchTypeCategory;
  importance: MatchImportance;
  isKnockout: boolean;
  isNeutralVenue: boolean;
  isDerby: boolean;
  isEndOfSeason: boolean;
  isPostInternationalBreak: boolean;
  stageName?: string;
}

/**
 * Weight adjustment factors for different match types
 */
export interface WeightAdjustments {
  recentForm: number;
  h2h: number;
  homeAdvantage: number;
  motivation: number;
  goalScoring: number;
}

// ============================================================================
// DETECTION KEYWORDS
// ============================================================================

/**
 * Keywords for international competition detection
 */
const INTERNATIONAL_KEYWORDS = [
  'champions league',
  'uefa champions',
  'europa league',
  'europa conference',
  'conference league',
  'world cup',
  'copa america',
  'euro ',
  'european championship',
  'nations league',
  'copa libertadores',
  'copa sudamericana',
  'concacaf',
  'afc champions',
  'caf champions',
  'african cup',
  'asian cup',
  'club world cup',
  'uefa super cup',
  'conmebol',
];

/**
 * Keywords for cup competition detection
 */
const CUP_KEYWORDS = [
  'cup',
  'copa',
  'pokal',
  'coupe',
  'coppa',
  'taca',
  'beker',
  'fa cup',
  'efl cup',
  'carabao',
  'league cup',
  'copa del rey',
  'dfb pokal',
  'dfb-pokal',
  'coupe de france',
  'coppa italia',
  'taca de portugal',
  'knvb beker',
  'scottish cup',
  'knock-out',
  'knockout',
  'playoff',
  'play-off',
  'eliminatoria',
];

/**
 * Keywords for knockout stage detection
 */
const KNOCKOUT_KEYWORDS = [
  'final',
  'semi-final',
  'semifinal',
  'semi final',
  'quarter-final',
  'quarterfinal',
  'quarter final',
  'round of 16',
  'round of 32',
  'round of 64',
  'last 16',
  'last 32',
  'last 8',
  '1/8',
  '1/16',
  '1/4',
  '1/2',
  'playoff',
  'play-off',
  'knockout',
  'elimination',
];

/**
 * Keywords for friendly match detection
 */
const FRIENDLY_KEYWORDS = [
  'friendly',
  'friendlies',
  'preseason',
  'pre-season',
  'amistoso',
  'amical',
  'amichevole',
  'freundschaftsspiel',
  'oefenwedstrijd',
  'test match',
  'exhibition',
];

/**
 * Keywords for neutral venue detection
 */
const NEUTRAL_VENUE_KEYWORDS = [
  'super cup',
  'supercup',
  'community shield',
  'charity shield',
  'supercopa',
  'trophee des champions',
  'supercoppa',
  'johan cruyff',
];

/**
 * Keywords for critical importance matches
 */
const CRITICAL_KEYWORDS = ['final', 'championship', 'title', 'trophy'];

/**
 * Keywords for high importance matches
 */
const HIGH_IMPORTANCE_KEYWORDS = [
  'semi-final',
  'semifinal',
  'semi final',
  'quarter-final',
  'quarterfinal',
  'quarter final',
  'champions league',
  'europa league',
  'world cup',
  'euro ',
];

// ============================================================================
// MAIN DETECTION FUNCTIONS
// ============================================================================

function normalizeForMatchTypeDetection(input: string): string {
  // Normalize accents/diacritics so e.g. "Taça" matches "taca" keywords.
  // Uses NFD decomposition and strips combining marks.
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Detect match type from league name and round information
 *
 * @param leagueName - Name of the league/competition
 * @param round - Round name or number
 * @param venue - Venue information (optional)
 * @returns Match type information
 */
export function detectMatchType(
  leagueName: string,
  round?: string | number,
): MatchType {
  const leagueNameLower = normalizeForMatchTypeDetection(leagueName);
  const roundLower =
    typeof round === 'string' ? normalizeForMatchTypeDetection(round) : '';

  // Determine match type
  const type = detectMatchTypeCategory(leagueNameLower);

  // Check if knockout stage
  const isKnockout = detectKnockoutStage(leagueNameLower, roundLower);

  // Determine importance
  const importance = calculateImportance(leagueNameLower, roundLower, type);

  // Check for neutral venue
  const isNeutralVenue = detectNeutralVenue(leagueNameLower, roundLower);

  // Extract stage name if applicable
  const stageName = extractStageName(roundLower);

  return {
    type,
    importance,
    isKnockout,
    isNeutralVenue,
    isDerby: false, // Will be set by derby detector
    isEndOfSeason: false, // Will be set by end-of-season detector
    isPostInternationalBreak: false, // Will be set by break detector
    stageName,
  };
}

/**
 * Detect match type category (LEAGUE, CUP, INTERNATIONAL, FRIENDLY)
 */
function detectMatchTypeCategory(leagueName: string): MatchTypeCategory {
  // Check for friendly first (most restrictive)
  if (FRIENDLY_KEYWORDS.some((keyword) => leagueName.includes(keyword))) {
    return 'FRIENDLY';
  }

  // Check for international competition
  if (INTERNATIONAL_KEYWORDS.some((keyword) => leagueName.includes(keyword))) {
    return 'INTERNATIONAL';
  }

  // Check for cup competition
  if (CUP_KEYWORDS.some((keyword) => leagueName.includes(keyword))) {
    return 'CUP';
  }

  // Default to league
  return 'LEAGUE';
}

/**
 * Detect if match is in knockout stage
 */
function detectKnockoutStage(leagueName: string, round: string): boolean {
  const combined = `${leagueName} ${round}`;
  return KNOCKOUT_KEYWORDS.some((keyword) => combined.includes(keyword));
}

/**
 * Calculate match importance
 */
function calculateImportance(
  leagueName: string,
  round: string,
  type: MatchTypeCategory,
): MatchImportance {
  const combined = `${leagueName} ${round}`;

  // Critical: Actual finals (avoid matching "quarter-final"/"semi-final")
  const isQuarterFinal = /quarter[- ]?final/i.test(combined);
  const isSemiFinal = /semi[- ]?final/i.test(combined);
  const isFinal =
    /\bfinal\b/i.test(combined) || /\bfinals\b/i.test(combined);
  if (isFinal && !isQuarterFinal && !isSemiFinal) {
    return 'CRITICAL';
  }
  // Other critical keywords (title/championship/trophy)
  if (CRITICAL_KEYWORDS.some((keyword) => keyword !== 'final' && combined.includes(keyword))) {
    return 'CRITICAL';
  }

  // High: Semi-finals, quarter-finals, major competitions
  if (HIGH_IMPORTANCE_KEYWORDS.some((keyword) => combined.includes(keyword))) {
    return 'HIGH';
  }

  // Friendlies are low importance
  if (type === 'FRIENDLY') {
    return 'LOW';
  }

  // International and cup knockout stages
  if ((type === 'INTERNATIONAL' || type === 'CUP') && detectKnockoutStage(leagueName, round)) {
    return 'HIGH';
  }

  // Default to medium
  return 'MEDIUM';
}

/**
 * Detect neutral venue
 */
function detectNeutralVenue(
  leagueName: string,
  round: string,
): boolean {
  const combined = `${leagueName} ${round}`;

  // Common neutral-venue competitions (super cups, etc.)
  if (NEUTRAL_VENUE_KEYWORDS.some((keyword) => combined.includes(keyword))) {
    return true;
  }

  // Finals are often neutral, but avoid matching "quarter-finals"/"semi-finals".
  if (
    /\bfinal\b/i.test(round) &&
    !/quarter[- ]?final/i.test(round) &&
    !/semi[- ]?final/i.test(round)
  ) {
    return true;
  }

  // TODO: Could add venue mismatch detection with stadium mapping
  return false;
}

/**
 * Extract stage name from round
 */
function extractStageName(round: string): string | undefined {
  const stagePatterns = [
    { pattern: /semi[- ]?final/i, name: 'Semi-Final' },
    { pattern: /quarter[- ]?final/i, name: 'Quarter-Final' },
    { pattern: /round of 16/i, name: 'Round of 16' },
    { pattern: /round of 32/i, name: 'Round of 32' },
    { pattern: /last 16/i, name: 'Round of 16' },
    { pattern: /last 8/i, name: 'Quarter-Final' },
    { pattern: /1\/8/i, name: 'Round of 16' },
    { pattern: /1\/4/i, name: 'Quarter-Final' },
    { pattern: /1\/2/i, name: 'Semi-Final' },
    { pattern: /group stage/i, name: 'Group Stage' },
    { pattern: /group [a-h]/i, name: 'Group Stage' },
    { pattern: /playoff/i, name: 'Playoff' },
    // IMPORTANT: Keep "Final" last so it doesn't match "quarter-finals"/"semi-finals" via substring.
    { pattern: /\bfinal\b/i, name: 'Final' },
  ];

  for (const { pattern, name } of stagePatterns) {
    if (pattern.test(round)) {
      return name;
    }
  }

  return undefined;
}

// ============================================================================
// WEIGHT ADJUSTMENT FUNCTIONS
// ============================================================================

/**
 * Get weight adjustments for a match type
 *
 * @param matchType - Match type information
 * @returns Weight adjustment factors (multipliers)
 */
export function getWeightAdjustments(matchType: MatchType): WeightAdjustments {
  // Start with neutral adjustments
  const adjustments: WeightAdjustments = {
    recentForm: 1.0,
    h2h: 1.0,
    homeAdvantage: 1.0,
    motivation: 1.0,
    goalScoring: 1.0,
  };

  // Apply match type adjustments
  switch (matchType.type) {
    case 'FRIENDLY':
      return applyFriendlyAdjustments(adjustments);

    case 'CUP':
      return applyCupAdjustments(adjustments, matchType.isKnockout);

    case 'INTERNATIONAL':
      return applyInternationalAdjustments(adjustments);

    case 'LEAGUE':
    default:
      // League matches use base weights
      break;
  }

  // Apply neutral venue adjustment
  if (matchType.isNeutralVenue) {
    adjustments.homeAdvantage *= 0.5; // 50% reduction
  }

  // Apply knockout stage adjustment (if not already applied)
  if (matchType.isKnockout && matchType.type === 'LEAGUE') {
    // Playoff/promotion playoff
    adjustments.motivation *= 1.3;
    adjustments.goalScoring *= 0.9;
  }

  // Apply derby adjustment
  if (matchType.isDerby) {
    adjustments.motivation *= 1.2;
    adjustments.recentForm *= 0.85; // Derbies are unpredictable
  }

  // Apply end-of-season adjustment
  if (matchType.isEndOfSeason) {
    adjustments.motivation *= 1.25;
  }

  // Apply post-international break adjustment
  if (matchType.isPostInternationalBreak) {
    adjustments.recentForm *= 0.8; // Less reliable
    adjustments.h2h *= 1.15; // Historical data more reliable
  }

  return adjustments;
}

/**
 * Apply friendly match adjustments
 */
function applyFriendlyAdjustments(
  adjustments: WeightAdjustments,
): WeightAdjustments {
  // Reduce all weights significantly - friendlies are unpredictable
  return {
    recentForm: adjustments.recentForm * 0.7,
    h2h: adjustments.h2h * 0.5, // H2H less relevant in friendlies
    homeAdvantage: adjustments.homeAdvantage * 0.5,
    motivation: adjustments.motivation * 0.5, // Very low motivation
    goalScoring: adjustments.goalScoring * 1.1, // More goals in friendlies
  };
}

/**
 * Apply cup match adjustments
 */
function applyCupAdjustments(
  adjustments: WeightAdjustments,
  isKnockout: boolean,
): WeightAdjustments {
  if (isKnockout) {
    // Knockout stages: tactical, high stakes
    return {
      recentForm: adjustments.recentForm * 0.9, // 10% reduction
      h2h: adjustments.h2h * 1.1, // H2H more relevant
      homeAdvantage: adjustments.homeAdvantage * 0.95,
      motivation: adjustments.motivation * 1.5, // 50% increase
      goalScoring: adjustments.goalScoring * 0.85, // 15% reduction
    };
  } else {
    // Early cup rounds
    return {
      recentForm: adjustments.recentForm * 0.95, // 5% reduction
      h2h: adjustments.h2h * 1.05,
      homeAdvantage: adjustments.homeAdvantage * 1.0,
      motivation: adjustments.motivation * 1.2, // 20% increase
      goalScoring: adjustments.goalScoring * 0.92, // 8% reduction
    };
  }
}

/**
 * Apply international match adjustments
 */
function applyInternationalAdjustments(
  adjustments: WeightAdjustments,
): WeightAdjustments {
  return {
    recentForm: adjustments.recentForm * 0.85, // 15% reduction
    h2h: adjustments.h2h * 1.2, // 20% increase - H2H more important
    homeAdvantage: adjustments.homeAdvantage * 0.9, // 10% reduction
    motivation: adjustments.motivation * 1.3, // 30% increase
    goalScoring: adjustments.goalScoring * 0.92, // 8% reduction - more tactical
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if match is high stakes
 */
export function isHighStakes(matchType: MatchType): boolean {
  return (
    matchType.importance === 'CRITICAL' ||
    matchType.importance === 'HIGH' ||
    matchType.isKnockout
  );
}

/**
 * Check if simulations should be conservative
 */
export function shouldBeConservative(matchType: MatchType): boolean {
  return matchType.type === 'FRIENDLY' || matchType.importance === 'LOW';
}

/**
 * Get confidence reduction for match type
 * Some match types warrant lower confidence simulations
 */
export function getMatchTypeConfidenceReduction(
  matchType: MatchType,
): number {
  // Friendlies: high confidence reduction (unpredictable)
  if (matchType.type === 'FRIENDLY') {
    return 20;
  }

  // Knockout matches: moderate reduction (high variance)
  if (matchType.isKnockout) {
    return 10;
  }

  // International matches: slight reduction
  if (matchType.type === 'INTERNATIONAL') {
    return 5;
  }

  return 0;
}

/**
 * Apply weight adjustments to market weights
 */
export function applyWeightAdjustmentsToMarket<
  T extends Record<string, number>,
>(marketWeights: T, adjustments: WeightAdjustments): T {
  const adjusted = { ...marketWeights };

  // Apply adjustments to relevant weight keys
  for (const key of Object.keys(adjusted)) {
    const keyLower = key.toLowerCase();

    if (keyLower.includes('form') || keyLower.includes('recent')) {
      adjusted[key as keyof T] =
        (adjusted[key as keyof T] as number) * adjustments.recentForm as T[keyof T];
    } else if (keyLower.includes('h2h')) {
      adjusted[key as keyof T] =
        (adjusted[key as keyof T] as number) * adjustments.h2h as T[keyof T];
    } else if (keyLower.includes('home') || keyLower.includes('advantage')) {
      adjusted[key as keyof T] =
        (adjusted[key as keyof T] as number) * adjustments.homeAdvantage as T[keyof T];
    } else if (keyLower.includes('motivation')) {
      adjusted[key as keyof T] =
        (adjusted[key as keyof T] as number) * adjustments.motivation as T[keyof T];
    } else if (
      keyLower.includes('scoring') ||
      keyLower.includes('goal') ||
      keyLower.includes('defensive')
    ) {
      adjusted[key as keyof T] =
        (adjusted[key as keyof T] as number) * adjustments.goalScoring as T[keyof T];
    }
  }

  // Normalize weights to maintain sum (approximately)
  const originalSum = Object.values(marketWeights).reduce(
    (sum, v) => sum + (v as number),
    0,
  );
  const adjustedSum = Object.values(adjusted).reduce(
    (sum, v) => sum + (v as number),
    0,
  );

  if (adjustedSum > 0 && originalSum > 0) {
    const normalizationFactor = originalSum / adjustedSum;
    for (const key of Object.keys(adjusted)) {
      adjusted[key as keyof T] =
        (adjusted[key as keyof T] as number) * normalizationFactor as T[keyof T];
    }
  }

  return adjusted;
}

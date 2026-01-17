/**
 * Insight Generator
 *
 * Converts detected patterns into human-readable insights using templates.
 * Handles categorization, prioritization, and formatting.
 *
 * Reference: docs/implementation-plan/phase3.md
 * Algorithm: docs/betting-insights-Algorithm.md - Insight Generation section
 */

import type { Pattern, PatternType, PatternSeverity } from '../patterns/team-patterns';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Insight category
 */
export type InsightCategory =
  | 'FORM'
  | 'H2H'
  | 'TIMING'
  | 'DEFENSIVE'
  | 'SCORING'
  | 'SAFETY';

/**
 * Generated insight
 */
export interface Insight {
  text: string;
  emoji: string;
  priority: number;
  category: InsightCategory;
  severity: PatternSeverity;
  patternType: PatternType;
}

/**
 * Insight template definition
 */
interface InsightTemplate {
  emoji: string;
  category: InsightCategory;
  template: (data: Record<string, unknown>, teamName?: string) => string;
}

// ============================================================================
// PATTERN TO CATEGORY MAPPING
// ============================================================================

/**
 * Map pattern types to insight categories
 */
const PATTERN_CATEGORY_MAP: Record<PatternType, InsightCategory> = {
  // Form patterns
  LONG_WINNING_STREAK: 'FORM',
  LONG_LOSING_STREAK: 'FORM',
  LONG_UNBEATEN_STREAK: 'FORM',
  LONG_WINLESS_STREAK: 'FORM',
  SLEEPING_GIANT: 'FORM',
  OVER_PERFORMER: 'FORM',
  ONE_SEASON_WONDER: 'FORM',
  REGRESSION_RISK: 'SAFETY',
  HOME_FORM_COLLAPSE: 'FORM',
  AWAY_DOMINANCE: 'FORM',

  // Scoring patterns
  SCORING_STREAK: 'SCORING',
  SCORING_DROUGHT: 'SCORING',
  HIGH_SCORING_FORM: 'SCORING',
  BTTS_STREAK: 'SCORING',
  NO_BTTS_STREAK: 'SCORING',
  OVER_25_STREAK: 'SCORING',
  UNDER_25_STREAK: 'SCORING',

  // Defensive patterns
  CLEAN_SHEET_STREAK: 'DEFENSIVE',
  CLEAN_SHEET_DROUGHT: 'DEFENSIVE',
  DEFENSIVE_COLLAPSE: 'DEFENSIVE',
  DEFENSIVE_WEAKNESS: 'DEFENSIVE',

  // Timing patterns
  FIRST_HALF_WEAKNESS: 'TIMING',
  FIRST_HALF_STRENGTH: 'TIMING',
};

// ============================================================================
// INSIGHT TEMPLATES
// ============================================================================

/**
 * Templates for generating insight text from patterns
 */
const INSIGHT_TEMPLATES: Record<PatternType, InsightTemplate> = {
  // Winning streak
  LONG_WINNING_STREAK: {
    emoji: '🔥',
    category: 'FORM',
    template: (data, teamName) =>
      `${teamName} has won ${data.streak} consecutive matches`,
  },

  // Losing streak
  LONG_LOSING_STREAK: {
    emoji: '🔴',
    category: 'FORM',
    template: (data, teamName) =>
      `${teamName} has lost ${data.streak} consecutive matches`,
  },

  // Unbeaten streak
  LONG_UNBEATEN_STREAK: {
    emoji: '💪',
    category: 'FORM',
    template: (data, teamName) =>
      `${teamName} is unbeaten in ${data.streak} consecutive matches`,
  },

  // Winless streak
  LONG_WINLESS_STREAK: {
    emoji: '😓',
    category: 'FORM',
    template: (data, teamName) =>
      `${teamName} has gone ${data.streak} matches without a win`,
  },

  // Scoring streak
  SCORING_STREAK: {
    emoji: '⚽',
    category: 'SCORING',
    template: (data, teamName) =>
      `${teamName} has scored in ${data.streak} consecutive matches`,
  },

  // Scoring drought
  SCORING_DROUGHT: {
    emoji: '🚫',
    category: 'SCORING',
    template: (data, teamName) =>
      `${teamName} has failed to score in ${data.streak} consecutive matches`,
  },

  // Clean sheet streak
  CLEAN_SHEET_STREAK: {
    emoji: '🧤',
    category: 'DEFENSIVE',
    template: (data, teamName) =>
      `${teamName} has kept ${data.streak} consecutive clean sheets`,
  },

  // Clean sheet drought
  CLEAN_SHEET_DROUGHT: {
    emoji: '🔓',
    category: 'DEFENSIVE',
    template: (data, teamName) =>
      `${teamName} hasn't kept a clean sheet in ${data.streak} games`,
  },

  // Defensive collapse
  DEFENSIVE_COLLAPSE: {
    emoji: '🚨',
    category: 'DEFENSIVE',
    template: (data, teamName) =>
      `${teamName} has conceded 2+ goals in ${data.streak} consecutive matches`,
  },

  // High scoring form
  HIGH_SCORING_FORM: {
    emoji: '🔥',
    category: 'SCORING',
    template: (data, teamName) =>
      `${teamName} have averaged ${data.avgGoalsScored} goals per game in their last ${data.matchCount}.`,
  },

  // Defensive weakness
  DEFENSIVE_WEAKNESS: {
    emoji: '⚠️',
    category: 'DEFENSIVE',
    template: (data, teamName) =>
      `${teamName} have conceded ${data.avgGoalsConceded} goals per game in their last ${data.matchCount}.`,
  },

  // First half weakness
  FIRST_HALF_WEAKNESS: {
    emoji: '🐌',
    category: 'TIMING',
    template: (data, teamName) =>
      `${teamName} scored in the 1st half in only ${data.firstHalfScoringRate}% of matches`,
  },

  // First half strength
  FIRST_HALF_STRENGTH: {
    emoji: '⚡',
    category: 'TIMING',
    template: (data, teamName) =>
      `${teamName} scores in the 1st half in ${data.firstHalfScoringRate}% of matches`,
  },

  // BTTS streak
  BTTS_STREAK: {
    emoji: '📊',
    category: 'SCORING',
    template: (data) => {
      if (data.streak) {
        return `Both teams have scored in the last ${data.streak} matches`;
      }
      return `Both teams score ${data.bttsRate}% of the time`;
    },
  },

  // No BTTS streak
  NO_BTTS_STREAK: {
    emoji: '🔒',
    category: 'SCORING',
    template: (data) =>
      `At least one team failed to score in ${data.streak} consecutive matches`,
  },

  // Over 2.5 streak
  OVER_25_STREAK: {
    emoji: '📈',
    category: 'SCORING',
    template: (data) => {
      if (data.streak) {
        return `3+ goals in the last ${data.streak} matches`;
      }
      return `3+ goals in ${data.over25Rate}% of matches`;
    },
  },

  // Under 2.5 streak
  UNDER_25_STREAK: {
    emoji: '📉',
    category: 'SCORING',
    template: (data) => {
      if (data.streak) {
        return `Under 3 goals in the last ${data.streak} matches`;
      }
      return `Under 3 goals in ${data.under25Rate}% of matches`;
    },
  },

  // Sleeping Giant
  SLEEPING_GIANT: {
    emoji: '💎',
    category: 'FORM',
    template: (data, teamName) =>
      `Value Alert: ${teamName} is Tier ${data.mindTier} quality but in Tier ${data.moodTier} form - potential value opportunity`,
  },

  // Over-Performer
  OVER_PERFORMER: {
    emoji: '⚠️',
    category: 'FORM',
    template: (data, teamName) =>
      `Regression Risk: ${teamName} is Tier ${data.mindTier} quality but in Tier ${data.moodTier} form - due for correction`,
  },

  // Regression Risk
  REGRESSION_RISK: {
    emoji: '📉',
    category: 'SAFETY',
    template: (data, teamName) =>
      `Regression Risk: ${teamName} has won ${data.consecutiveWins} in a row as a Tier ${data.mindTier} team`,
  },

  // One-Season Wonder
  ONE_SEASON_WONDER: {
    emoji: '🌟',
    category: 'FORM',
    template: (data, teamName) =>
      `${teamName} is a recently promoted team overperforming - potential regression`,
  },

  // Home form collapse
  HOME_FORM_COLLAPSE: {
    emoji: '🏠',
    category: 'FORM',
    template: (data, teamName) =>
      `${teamName} is struggling at home (${data.homeWinRate}% wins) despite strong away form (${data.awayWinRate}%)`,
  },

  // Away dominance
  AWAY_DOMINANCE: {
    emoji: '✈️',
    category: 'FORM',
    template: (data, teamName) =>
      `${teamName} has exceptional away form (${data.awayWinRate}% win rate)`,
  },
};

// ============================================================================
// H2H INSIGHT TEMPLATES
// ============================================================================

/**
 * H2H-specific templates (don't require team name)
 */
const H2H_INSIGHT_TEMPLATES: Record<string, InsightTemplate> = {
  H2H_SUMMARY: {
    emoji: '🤝',
    category: 'H2H',
    template: (data) =>
      `${data.homeTeamName} vs ${data.awayTeamName} H2H (${data.matchCount}): ` +
      `${data.homeWins}W-${data.draws}D-${data.awayWins}L, ` +
      `Over 2.5 ${data.over25Rate}%`,
  },
  H2H_BTTS_STREAK: {
    emoji: '📊',
    category: 'H2H',
    template: (data) =>
      `Both teams have scored in the last ${data.streak} H2H meetings`,
  },

  H2H_HIGH_BTTS_RATE: {
    emoji: '📊',
    category: 'H2H',
    template: (data) =>
      `Both teams score in ${data.bttsRate}% of H2H matches (${data.bttsCount}/${data.matchCount})`,
  },

  H2H_NO_BTTS_STREAK: {
    emoji: '🔒',
    category: 'H2H',
    template: (data) =>
      `At least one team failed to score in the last ${data.streak} H2H meetings`,
  },

  H2H_LOW_BTTS_RATE: {
    emoji: '🔒',
    category: 'H2H',
    template: (data) =>
      `Both teams score in only ${data.bttsRate}% of H2H matches`,
  },

  H2H_DOMINANCE: {
    emoji: '🏆',
    category: 'H2H',
    template: (data) =>
      `The ${data.dominantTeam} team has won ${data.winRate}% of H2H matches (${data.wins}/${data.totalMatches})`,
  },

  H2H_HOME_DOMINANCE: {
    emoji: '🏠',
    category: 'H2H',
    template: (data) =>
      `Home team wins ${data.homeVenueWinRate}% at this venue`,
  },

  H2H_AWAY_UPSET_TREND: {
    emoji: '✈️',
    category: 'H2H',
    template: (data) =>
      `Away team has won ${data.awayVenueWinRate}% at this venue`,
  },

  H2H_DRAWS_COMMON: {
    emoji: '🤝',
    category: 'H2H',
    template: (data) =>
      `${data.drawRate}% of H2H matches end in draws (${data.draws}/${data.matchCount})`,
  },

  H2H_HIGH_SCORING: {
    emoji: '🔥',
    category: 'H2H',
    template: (data) =>
      `H2H matches average ${data.avgGoals} goals per game`,
  },

  H2H_LOW_SCORING: {
    emoji: '🧊',
    category: 'H2H',
    template: (data) =>
      `H2H matches average only ${data.avgGoals} goals per game`,
  },

  H2H_OVER_25_STREAK: {
    emoji: '📈',
    category: 'H2H',
    template: (data) => {
      if (data.streak) {
        return `3+ goals in the last ${data.streak} H2H meetings`;
      }
      return `3+ goals in ${data.over25Rate}% of H2H matches`;
    },
  },

  H2H_UNDER_25_STREAK: {
    emoji: '📉',
    category: 'H2H',
    template: (data) => {
      if (data.streak) {
        return `Under 3 goals in the last ${data.streak} H2H meetings`;
      }
      return `Under 3 goals in ${data.under25Rate}% of H2H matches`;
    },
  },
};

// ============================================================================
// MAIN GENERATION FUNCTIONS
// ============================================================================

/**
 * Generate insight from a pattern
 *
 * @param pattern - Detected pattern
 * @param teamName - Team name for context (optional for H2H patterns)
 * @returns Generated insight or null if no template found
 */
export function generateInsight(
  pattern: Pattern,
  teamName?: string,
): Insight | null {
  // Check for H2H template first
  const h2hTemplate = H2H_INSIGHT_TEMPLATES[pattern.type];
  if (h2hTemplate) {
    return {
      text: h2hTemplate.template(pattern.data as Record<string, unknown>),
      emoji: h2hTemplate.emoji,
      priority: pattern.priority,
      category: 'H2H',
      severity: pattern.severity,
      patternType: pattern.type,
    };
  }

  // Check regular template
  const template = INSIGHT_TEMPLATES[pattern.type];
  if (!template) {
    // Fallback for unknown patterns
    return {
      text: pattern.description || `Pattern detected: ${pattern.type}`,
      emoji: '📋',
      priority: pattern.priority,
      category: categorizePattern(pattern.type),
      severity: pattern.severity,
      patternType: pattern.type,
    };
  }

  // Avoid "undefined has scored..." when callers don't provide a name.
  const safeTeamName = teamName?.trim() ? teamName : 'Team';

  return {
    text: template.template(pattern.data as Record<string, unknown>, safeTeamName),
    emoji: template.emoji,
    priority: pattern.priority,
    category: template.category,
    severity: pattern.severity,
    patternType: pattern.type,
  };
}

/**
 * Generate insights from multiple patterns
 *
 * @param patterns - Array of detected patterns
 * @param teamName - Team name for context
 * @returns Array of insights sorted by priority
 */
export function generateInsights(
  patterns: Pattern[],
  teamName?: string,
): Insight[] {
  const insights: Insight[] = [];

  for (const pattern of patterns) {
    const insight = generateInsight(pattern, teamName);
    if (insight) {
      insights.push(insight);
    }
  }

  // Sort by priority (highest first)
  return insights.sort((a, b) => b.priority - a.priority);
}

/**
 * Generate combined insights for home and away teams
 *
 * @param homePatterns - Home team patterns
 * @param awayPatterns - Away team patterns
 * @param h2hPatterns - H2H patterns
 * @param homeTeamName - Home team name
 * @param awayTeamName - Away team name
 * @returns Combined and sorted insights
 */
export function generateMatchInsights(
  homePatterns: Pattern[],
  awayPatterns: Pattern[],
  h2hPatterns: Pattern[],
  homeTeamName: string,
  awayTeamName: string,
): Insight[] {
  const insights: Insight[] = [];

  // Generate home team insights
  for (const pattern of homePatterns) {
    const insight = generateInsight(pattern, homeTeamName);
    if (insight) {
      insights.push(insight);
    }
  }

  // Generate away team insights
  for (const pattern of awayPatterns) {
    const insight = generateInsight(pattern, awayTeamName);
    if (insight) {
      insights.push(insight);
    }
  }

  // Generate H2H insights
  for (const pattern of h2hPatterns) {
    const insight = generateInsight(pattern);
    if (insight) {
      insights.push(insight);
    }
  }

  // Sort by priority (highest first)
  return insights.sort((a, b) => b.priority - a.priority);
}

// ============================================================================
// CATEGORIZATION
// ============================================================================

/**
 * Get category for a pattern type
 *
 * @param patternType - Pattern type
 * @returns Insight category
 */
export function categorizePattern(patternType: PatternType): InsightCategory {
  return PATTERN_CATEGORY_MAP[patternType] || 'FORM';
}

/**
 * Filter insights by category
 *
 * @param insights - Array of insights
 * @param category - Category to filter by
 * @returns Filtered insights
 */
export function filterInsightsByCategory(
  insights: Insight[],
  category: InsightCategory,
): Insight[] {
  return insights.filter((i) => i.category === category);
}

/**
 * Group insights by category
 *
 * @param insights - Array of insights
 * @returns Map of category to insights
 */
export function groupInsightsByCategory(
  insights: Insight[],
): Map<InsightCategory, Insight[]> {
  const grouped = new Map<InsightCategory, Insight[]>();

  for (const insight of insights) {
    const current = grouped.get(insight.category) || [];
    current.push(insight);
    grouped.set(insight.category, current);
  }

  return grouped;
}

// ============================================================================
// FILTERING AND LIMITING
// ============================================================================

/**
 * Filter insights by minimum severity
 *
 * @param insights - Array of insights
 * @param minSeverity - Minimum severity level
 * @returns Filtered insights
 */
export function filterInsightsBySeverity(
  insights: Insight[],
  minSeverity: PatternSeverity,
): Insight[] {
  const severityOrder: PatternSeverity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  const minIndex = severityOrder.indexOf(minSeverity);

  return insights.filter(
    (i) => severityOrder.indexOf(i.severity) >= minIndex,
  );
}

/**
 * Get top N insights
 *
 * @param insights - Array of insights (should be pre-sorted by priority)
 * @param count - Number of insights to return
 * @returns Top N insights
 */
export function getTopInsights(insights: Insight[], count: number): Insight[] {
  return insights.slice(0, count);
}

/**
 * Get most important insight per category
 *
 * @param insights - Array of insights
 * @returns Map of category to top insight
 */
export function getTopInsightPerCategory(
  insights: Insight[],
): Map<InsightCategory, Insight> {
  const topPerCategory = new Map<InsightCategory, Insight>();

  for (const insight of insights) {
    const existing = topPerCategory.get(insight.category);
    if (!existing || insight.priority > existing.priority) {
      topPerCategory.set(insight.category, insight);
    }
  }

  return topPerCategory;
}

// ============================================================================
// FORMATTING HELPERS
// ============================================================================

/**
 * Format insight for display (emoji + text)
 *
 * @param insight - Insight to format
 * @returns Formatted string
 */
export function formatInsight(insight: Insight): string {
  return `${insight.emoji} ${insight.text}`;
}

/**
 * Format all insights as a list
 *
 * @param insights - Array of insights
 * @returns Array of formatted strings
 */
export function formatInsights(insights: Insight[]): string[] {
  return insights.map(formatInsight);
}

/**
 * Get severity badge for display
 *
 * @param severity - Severity level
 * @returns Badge emoji
 */
export function getSeverityBadge(severity: PatternSeverity): string {
  switch (severity) {
    case 'CRITICAL':
      return '🔴';
    case 'HIGH':
      return '🟠';
    case 'MEDIUM':
      return '🟡';
    case 'LOW':
      return '🟢';
    default:
      return '⚪';
  }
}

// ============================================================================
// INSIGHT SUMMARY
// ============================================================================

/**
 * Generate a summary of insights for quick overview
 *
 * @param insights - Array of insights
 * @returns Summary object
 */
export function getInsightSummary(insights: Insight[]): {
  total: number;
  byCriticalCount: number;
  byHighCount: number;
  byCategory: Record<InsightCategory, number>;
  topThree: string[];
} {
  const byCategory: Record<InsightCategory, number> = {
    FORM: 0,
    H2H: 0,
    TIMING: 0,
    DEFENSIVE: 0,
    SCORING: 0,
    SAFETY: 0,
  };

  let criticalCount = 0;
  let highCount = 0;

  for (const insight of insights) {
    byCategory[insight.category]++;
    if (insight.severity === 'CRITICAL') criticalCount++;
    if (insight.severity === 'HIGH') highCount++;
  }

  return {
    total: insights.length,
    byCriticalCount: criticalCount,
    byHighCount: highCount,
    byCategory,
    topThree: formatInsights(insights.slice(0, 3)),
  };
}

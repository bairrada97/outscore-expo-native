/**
 * League Constants
 *
 * Centralized league IDs and configurations for consistent use across the backend.
 * These IDs are from API-Football and should be verified periodically.
 */

/**
 * Top European leagues for tier calculations and algorithm purposes.
 * Teams in these leagues are typically considered higher quality.
 */
export const TOP_LEAGUES = [
  39,   // Premier League (England)
  140,  // La Liga (Spain)
  135,  // Serie A (Italy)
  78,   // Bundesliga (Germany)
  61,   // Ligue 1 (France)
  94,   // Primeira Liga (Portugal)
  88,   // Eredivisie (Netherlands)
] as const;

/**
 * Type for TOP_LEAGUES IDs
 */
export type TopLeagueId = typeof TOP_LEAGUES[number];

/**
 * Check if a league is considered a top league
 */
export function isTopLeague(leagueId: number): boolean {
  return (TOP_LEAGUES as readonly number[]).includes(leagueId);
}

/**
 * Secondary tier European leagues (still high quality, but not top 7)
 */
export const SECONDARY_LEAGUES = [
  144,  // Belgian Pro League
  203,  // Super Lig (Turkey)
  235,  // Russian Premier League
  218,  // Scottish Premiership
  207,  // Swiss Super League
  197,  // Austrian Bundesliga
  119,  // Danish Superliga
  113,  // Allsvenskan (Sweden)
  103,  // Eliteserien (Norway)
] as const;

/**
 * All monitored leagues (top + secondary)
 */
export const MONITORED_LEAGUES = [...TOP_LEAGUES, ...SECONDARY_LEAGUES] as const;

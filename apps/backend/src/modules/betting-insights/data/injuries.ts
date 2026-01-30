import type { APIFootballInjury, InjuriesResponse } from "@outscore/shared-types";

/**
 * Injuries Data Fetching
 *
 * Fetches injury data from API-Football for use in betting insights.
 *
 * API-Football /injuries endpoint:
 * - Update frequency: Every 4 hours
 * - Recommended calls: 1 per day
 * - Best param: `fixture` - gets both teams' injuries in one call
 *
 * Caching strategy:
 * - D1 cache with 24-hour TTL (aligned with API recommendation)
 * - Fetch per fixture, not per team (more efficient)
 *
 * Reference: docs/implementation-plan/phase4.7.md
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * Processed injury for algorithm use
 */
export interface ProcessedInjury {
  playerId: number;
  playerName: string;
  teamId: number;
  status: InjuryStatus;
  reason: string;
  impact: InjuryImpact;
}

/**
 * Injury status classification
 */
export type InjuryStatus = 'OUT' | 'DOUBTFUL' | 'QUESTIONABLE';

/**
 * Injury impact on team performance
 */
export type InjuryImpact = 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * Injuries grouped by team for a fixture
 */
export interface FixtureInjuries {
  fixtureId: number;
  homeTeamId: number;
  awayTeamId: number;
  homeInjuries: ProcessedInjury[];
  awayInjuries: ProcessedInjury[];
  fetchedAt: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Injury status mapping from API-Football types
 */
const STATUS_MAP: Record<string, InjuryStatus> = {
  'Missing Fixture': 'OUT',
  'Doubtful': 'DOUBTFUL',
  'Questionable': 'QUESTIONABLE',
  'Suspended': 'OUT',
  'Injured': 'OUT',
};

/**
 * Keywords indicating high-impact injuries (key players)
 * These typically affect team performance significantly
 */
const HIGH_IMPACT_REASONS = [
  'acl',
  'cruciate',
  'achilles',
  'broken',
  'fracture',
  'surgery',
  'tendon',
  'ligament',
  'muscle',
  'hamstring',
  'groin',
];

/**
 * Default TTL for injury cache: 24 hours (API recommends 1 call/day)
 */
export const INJURIES_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// ============================================================================
// FETCH FUNCTIONS
// ============================================================================

/**
 * Fetch injuries for a fixture from API-Football
 *
 * @param fixtureId - The fixture ID
 * @param apiUrl - API-Football base URL
 * @param apiKey - API-Football key
 * @returns Raw injuries response
 */
export async function fetchInjuriesForFixture(
  fixtureId: number,
  apiUrl: string,
  apiKey: string,
): Promise<InjuriesResponse> {
  const url = new URL(`${apiUrl}/injuries`);
  url.searchParams.append('fixture', fixtureId.toString());

  console.log(`🏥 [Injuries] Fetching injuries for fixture ${fixtureId}`);
  const startTime = performance.now();

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'x-rapidapi-host': 'api-football-v1.p.rapidapi.com',
      'x-rapidapi-key': apiKey,
    },
  });

  const duration = (performance.now() - startTime).toFixed(2);

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ [Injuries] Error (${duration}ms): ${response.statusText}`);
    throw new Error(`Injuries API failed: ${response.statusText} - ${errorText}`);
  }

  const data = (await response.json()) as InjuriesResponse;

  if (data.errors && Array.isArray(data.errors) && data.errors.length > 0) {
    throw new Error(`Injuries API errors: ${JSON.stringify(data.errors)}`);
  }

  console.log(
    `✅ [Injuries] Success (${duration}ms): ${data.results || 0} injuries for fixture ${fixtureId}`,
  );

  return data;
}

// ============================================================================
// PROCESSING FUNCTIONS
// ============================================================================

/**
 * Process raw API injuries into algorithm-friendly format
 *
 * @param raw - Raw API injuries
 * @param homeTeamId - Home team API-Football ID
 * @param awayTeamId - Away team API-Football ID
 * @returns Processed injuries grouped by team
 */
export function processInjuries(
  raw: APIFootballInjury[],
  fixtureId: number,
  homeTeamId: number,
  awayTeamId: number,
): FixtureInjuries {
  const homeInjuries: ProcessedInjury[] = [];
  const awayInjuries: ProcessedInjury[] = [];

  for (const injury of raw) {
    const processed = processSingleInjury(injury);

    if (injury.team.id === homeTeamId) {
      homeInjuries.push(processed);
    } else if (injury.team.id === awayTeamId) {
      awayInjuries.push(processed);
    }
    // Ignore injuries for other teams (shouldn't happen with fixture param)
  }

  return {
    fixtureId,
    homeTeamId,
    awayTeamId,
    homeInjuries,
    awayInjuries,
    fetchedAt: Date.now(),
  };
}

/**
 * Process a single injury record
 */
function processSingleInjury(injury: APIFootballInjury): ProcessedInjury {
  const status = mapInjuryStatus(injury.player.type);
  const impact = assessInjuryImpact(injury.player.reason, status);

  return {
    playerId: injury.player.id,
    playerName: injury.player.name,
    teamId: injury.team.id,
    status,
    reason: injury.player.reason,
    impact,
  };
}

/**
 * Map API-Football injury type to our status enum
 */
function mapInjuryStatus(type: string): InjuryStatus {
  return STATUS_MAP[type] ?? 'QUESTIONABLE';
}

/**
 * Assess injury impact based on reason and status
 *
 * HIGH impact: Long-term injuries, serious conditions
 * MEDIUM impact: Standard injuries, suspensions
 * LOW impact: Minor knocks, questionable status
 */
function assessInjuryImpact(reason: string, status: InjuryStatus): InjuryImpact {
  const lowerReason = reason.toLowerCase();

  // Check for high-impact injury keywords
  if (HIGH_IMPACT_REASONS.some((keyword) => lowerReason.includes(keyword))) {
    return 'HIGH';
  }

  // OUT status is at least MEDIUM impact
  if (status === 'OUT') {
    return 'MEDIUM';
  }

  // DOUBTFUL is MEDIUM, QUESTIONABLE is LOW
  return status === 'DOUBTFUL' ? 'MEDIUM' : 'LOW';
}

// ============================================================================
// SUMMARY FUNCTIONS
// ============================================================================

/**
 * Get injury summary for a team
 *
 * @param injuries - Team's injuries
 * @returns Summary counts
 */
export function getInjurySummary(injuries: ProcessedInjury[]): {
  total: number;
  out: number;
  doubtful: number;
  highImpact: number;
} {
  return {
    total: injuries.length,
    out: injuries.filter((i) => i.status === 'OUT').length,
    doubtful: injuries.filter((i) => i.status === 'DOUBTFUL').length,
    highImpact: injuries.filter((i) => i.impact === 'HIGH').length,
  };
}

/**
 * Check if a team has significant injury concerns
 *
 * @param injuries - Team's injuries
 * @returns True if 3+ players out or 1+ high impact
 */
export function hasSignificantInjuries(injuries: ProcessedInjury[]): boolean {
  const summary = getInjurySummary(injuries);
  return summary.out >= 3 || summary.highImpact >= 1;
}

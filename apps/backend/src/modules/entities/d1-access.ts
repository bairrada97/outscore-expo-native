/**
 * D1 Access Layer
 *
 * Provides read/write helpers for canonical entities in D1.
 * Handles external ID resolution and upsert operations.
 */

import type {
  EntityType,
  ExternalIdInsert,
  H2HCacheData,
  H2HCacheInsert,
  InjuriesCacheData,
  InjuriesCacheRow,
  InputsSnapshotData,
  InsightsSnapshot,
  InsightsSnapshotInsert,
  League,
  LeagueInsert,
  Provider,
  StandingsCurrentRow,
  StandingsCurrentRowInsert,
  LeagueStats,
  LeagueStatsUpsert,
  TeamEloRating,
  TeamEloRatingInsert,
  TeamEloCurrent,
  TeamEloCurrentUpsert,
  Team,
  TeamInsert,
  TeamSeasonContext,
  TeamSeasonContextInsert,
  UefaAssociationCoefficientInsert,
  UefaClubCoefficientInsert,
  UefaClubTeamMapInsert,
} from './types';
import { INJURIES_CACHE_TTL_MS } from './types';

// ============================================================================
// EXTERNAL ID RESOLUTION
// ============================================================================

/**
 * Resolve a provider ID to internal ID
 */
export async function resolveExternalId(
  db: D1Database,
  provider: Provider,
  entityType: EntityType,
  providerId: string | number
): Promise<number | null> {
  const result = await db
    .prepare(
      `SELECT internal_id FROM external_ids 
       WHERE provider = ? AND entity_type = ? AND provider_id = ?`
    )
    .bind(provider, entityType, String(providerId))
    .first<{ internal_id: number }>();

  return result?.internal_id ?? null;
}

/**
 * Get provider ID from internal ID
 */
export async function getProviderIdFromInternal(
  db: D1Database,
  provider: Provider,
  entityType: EntityType,
  internalId: number
): Promise<string | null> {
  const result = await db
    .prepare(
      `SELECT provider_id FROM external_ids 
       WHERE provider = ? AND entity_type = ? AND internal_id = ?`
    )
    .bind(provider, entityType, internalId)
    .first<{ provider_id: string }>();

  return result?.provider_id ?? null;
}

// ============================================================================
// ELO RATINGS
// ============================================================================

/**
 * Get the latest Elo rating for a team.
 */
export async function getLatestTeamElo(
  db: D1Database,
  teamId: number
): Promise<TeamEloRating | null> {
  const row = await db
    .prepare(
      `SELECT * FROM team_elo_ratings
       WHERE team_id = ?
       ORDER BY datetime(as_of_date) DESC
       LIMIT 1`
    )
    .bind(teamId)
    .first<TeamEloRating>();

  return row ?? null;
}

// ============================================================================
// LEAGUE STATS
// ============================================================================

export async function getLeagueStatsByProviderId(
  db: D1Database,
  provider: Provider,
  leagueId: number,
  season: number
): Promise<LeagueStats | null> {
  const row = await db
    .prepare(
      `SELECT * FROM league_stats
       WHERE provider = ? AND league_id = ? AND season = ?`
    )
    .bind(provider, leagueId, season)
    .first<LeagueStats>();

  return row ?? null;
}

export async function upsertLeagueStats(
  db: D1Database,
  data: LeagueStatsUpsert
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO league_stats
       (provider, league_id, season, matches, avg_goals, over_2_5_rate, btts_rate, home_goals_avg, away_goals_avg, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(provider, league_id, season) DO UPDATE SET
         matches = excluded.matches,
         avg_goals = excluded.avg_goals,
         over_2_5_rate = excluded.over_2_5_rate,
         btts_rate = excluded.btts_rate,
         home_goals_avg = excluded.home_goals_avg,
         away_goals_avg = excluded.away_goals_avg,
         updated_at = datetime('now')`
    )
    .bind(
      data.provider ?? 'api_football',
      data.league_id,
      data.season,
      data.matches,
      data.avg_goals,
      data.over_2_5_rate,
      data.btts_rate,
      data.home_goals_avg,
      data.away_goals_avg
    )
    .run();
}

/**
 * Get the current Elo rating for a team.
 */
export async function getCurrentTeamElo(
  db: D1Database,
  teamId: number
): Promise<TeamEloCurrent | null> {
  const row = await db
    .prepare(`SELECT * FROM team_elo_current WHERE team_id = ?`)
    .bind(teamId)
    .first<TeamEloCurrent>();

  return row ?? null;
}

/**
 * Upsert current Elo rating for a team.
 */
export async function upsertCurrentTeamElo(
  db: D1Database,
  data: TeamEloCurrentUpsert
): Promise<void> {
  const source = data.source ?? 'api_football';
  await db
    .prepare(
      `INSERT INTO team_elo_current
       (team_id, elo, games, as_of_date, source, updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(team_id) DO UPDATE SET
         elo = excluded.elo,
         games = excluded.games,
         as_of_date = excluded.as_of_date,
         source = excluded.source,
         updated_at = datetime('now')`
    )
    .bind(data.team_id, data.elo, data.games, data.as_of_date, source)
    .run();
}

/**
 * Insert an Elo snapshot (idempotent by fixture + team).
 * Returns true if inserted, false if already exists.
 */
export async function insertTeamEloSnapshot(
  db: D1Database,
  data: TeamEloRatingInsert
): Promise<boolean> {
  const result = await db
    .prepare(
      `INSERT INTO team_elo_ratings
       (team_id, as_of_date, elo, games, last_fixture_provider, last_fixture_id, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(team_id, last_fixture_provider, last_fixture_id) DO NOTHING`
    )
    .bind(
      data.team_id,
      data.as_of_date,
      data.elo,
      data.games,
      data.last_fixture_provider ?? 'api_football',
      data.last_fixture_id
    )
    .run();

  const metaChanges = (result as { meta?: { changes?: number } }).meta?.changes;
  return typeof metaChanges === 'number' ? metaChanges > 0 : false;
}

// ============================================================================
// UEFA COEFFICIENTS
// ============================================================================

export async function upsertUefaAssociationCoefficient(
  db: D1Database,
  data: UefaAssociationCoefficientInsert
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO uefa_association_coefficients
       (country_code, as_of_season, rank, coefficient5y, updated_at)
       VALUES (?, ?, ?, ?, datetime('now'))
       ON CONFLICT(country_code, as_of_season) DO UPDATE SET
         rank = excluded.rank,
         coefficient5y = excluded.coefficient5y,
         updated_at = datetime('now')`
    )
    .bind(
      data.country_code,
      data.as_of_season,
      data.rank ?? null,
      data.coefficient5y ?? null
    )
    .run();
}

export async function upsertUefaClubCoefficient(
  db: D1Database,
  data: UefaClubCoefficientInsert
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO uefa_club_coefficients
       (uefa_club_key, as_of_season, name, country_code, coefficient, updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(uefa_club_key, as_of_season) DO UPDATE SET
         name = excluded.name,
         country_code = excluded.country_code,
         coefficient = excluded.coefficient,
         updated_at = datetime('now')`
    )
    .bind(
      data.uefa_club_key,
      data.as_of_season,
      data.name,
      data.country_code ?? null,
      data.coefficient ?? null
    )
    .run();
}

export async function upsertUefaClubTeamMap(
  db: D1Database,
  data: UefaClubTeamMapInsert
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO uefa_club_team_map
       (uefa_club_key, as_of_season, api_football_team_id, team_id, confidence, method, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(uefa_club_key, as_of_season) DO UPDATE SET
         api_football_team_id = excluded.api_football_team_id,
         team_id = excluded.team_id,
         confidence = excluded.confidence,
         method = excluded.method,
         updated_at = datetime('now')`
    )
    .bind(
      data.uefa_club_key,
      data.as_of_season,
      data.api_football_team_id,
      data.team_id ?? null,
      data.confidence ?? null,
      data.method ?? null
    )
    .run();
}

export async function getUefaAssociationCoefficient(
  db: D1Database,
  countryCode: string,
  asOfSeason: number
): Promise<{ coefficient5y: number | null; rank: number | null } | null> {
  const row = await db
    .prepare(
      `SELECT coefficient5y, rank
       FROM uefa_association_coefficients
       WHERE country_code = ? AND as_of_season = ?`
    )
    .bind(countryCode, asOfSeason)
    .first<{ coefficient5y: number | null; rank: number | null }>();

  return row ?? null;
}

export async function getUefaClubCoefficient(
  db: D1Database,
  uefaClubKey: string,
  asOfSeason: number
): Promise<{ coefficient: number | null; country_code: string | null } | null> {
  const row = await db
    .prepare(
      `SELECT coefficient, country_code
       FROM uefa_club_coefficients
       WHERE uefa_club_key = ? AND as_of_season = ?`
    )
    .bind(uefaClubKey, asOfSeason)
    .first<{ coefficient: number | null; country_code: string | null }>();

  return row ?? null;
}

export async function getUefaClubKeyForTeam(
  db: D1Database,
  teamId: number,
  asOfSeason: number
): Promise<string | null> {
  const row = await db
    .prepare(
      `SELECT uefa_club_key
       FROM uefa_club_team_map
       WHERE team_id = ? AND as_of_season = ?`
    )
    .bind(teamId, asOfSeason)
    .first<{ uefa_club_key: string }>();

  return row?.uefa_club_key ?? null;
}

export async function getUefaClubKeyForApiTeam(
  db: D1Database,
  apiFootballTeamId: number,
  asOfSeason: number
): Promise<string | null> {
  const row = await db
    .prepare(
      `SELECT uefa_club_key
       FROM uefa_club_team_map
       WHERE api_football_team_id = ? AND as_of_season = ?`
    )
    .bind(apiFootballTeamId, asOfSeason)
    .first<{ uefa_club_key: string }>();

  return row?.uefa_club_key ?? null;
}

/**
 * Upsert external ID mapping
 */
export async function upsertExternalId(
  db: D1Database,
  data: ExternalIdInsert
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO external_ids (provider, entity_type, provider_id, internal_id, match_confidence, match_method)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(provider, entity_type, provider_id) 
       DO UPDATE SET internal_id = excluded.internal_id,
                     match_confidence = excluded.match_confidence,
                     match_method = excluded.match_method`
    )
    .bind(
      data.provider,
      data.entity_type,
      data.provider_id,
      data.internal_id,
      data.match_confidence ?? null,
      data.match_method ?? null
    )
    .run();
}

/**
 * Insert external ID mapping only if missing (race-safe).
 * Returns true if inserted, false if mapping already existed.
 *
 * Rationale:
 * - Under concurrency, two requests can insert the same team/league row, then both try
 *   to upsert external_ids. If the second overwrites internal_id, the first row becomes
 *   an orphan and you see duplicates in `teams` / `leagues`.
 */
async function insertExternalIdIfMissing(
  db: D1Database,
  data: ExternalIdInsert,
): Promise<boolean> {
  const result = await db
    .prepare(
      `INSERT INTO external_ids (provider, entity_type, provider_id, internal_id, match_confidence, match_method)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(provider, entity_type, provider_id) DO NOTHING`
    )
    .bind(
      data.provider,
      data.entity_type,
      data.provider_id,
      data.internal_id,
      data.match_confidence ?? null,
      data.match_method ?? null,
    )
    .run();

  // D1 returns a meta object; when the insert is ignored, changes should be 0.
  // We treat any positive change count as "inserted".
  const metaChanges = (result as { meta?: { changes?: number } }).meta?.changes;
  const changes = typeof metaChanges === 'number' ? metaChanges : 0;
  return changes > 0;
}

// ============================================================================
// LEAGUES
// ============================================================================

/**
 * Get league by internal ID
 */
export async function getLeagueById(
  db: D1Database,
  id: number
): Promise<League | null> {
  return db
    .prepare('SELECT * FROM leagues WHERE id = ?')
    .bind(id)
    .first<League>();
}

/**
 * Get league by provider ID (resolves external ID first)
 */
export async function getLeagueByProviderId(
  db: D1Database,
  provider: Provider,
  providerId: string | number
): Promise<League | null> {
  const internalId = await resolveExternalId(db, provider, 'league', providerId);
  if (!internalId) return null;
  return getLeagueById(db, internalId);
}

/**
 * Upsert league and return internal ID
 */
export async function upsertLeague(
  db: D1Database,
  data: LeagueInsert,
  provider: Provider,
  providerId: string | number
): Promise<number> {
  // Check if mapping exists
  const existingId = await resolveExternalId(db, provider, 'league', providerId);

  if (existingId) {
    // Update existing league
    await db
      .prepare(
        `UPDATE leagues SET name = ?, country = ?, logo = ?, flag = ?, updated_at = datetime('now')
         WHERE id = ?`
      )
      .bind(data.name, data.country ?? null, data.logo ?? null, data.flag ?? null, existingId)
      .run();
    return existingId;
  }

  // Insert new league
  const result = await db
    .prepare(
      `INSERT INTO leagues (name, country, logo, flag) VALUES (?, ?, ?, ?)
       RETURNING id`
    )
    .bind(data.name, data.country ?? null, data.logo ?? null, data.flag ?? null)
    .first<{ id: number }>();

  if (!result) {
    throw new Error(`Failed to insert league: ${data.name}`);
  }
  const newId = result.id;

  // Create external ID mapping (race-safe).
  const inserted = await insertExternalIdIfMissing(db, {
    provider,
    entity_type: 'league',
    provider_id: String(providerId),
    internal_id: newId,
    match_confidence: 1.0,
    match_method: 'api_fetch',
  });

  if (inserted) return newId;

  // Mapping already existed (likely concurrent insert). Reuse mapped internal id and delete the orphan row.
  const existingInternalId = await resolveExternalId(db, provider, 'league', providerId);
  if (existingInternalId && existingInternalId !== newId) {
    await db.prepare('DELETE FROM leagues WHERE id = ?').bind(newId).run();
    return existingInternalId;
  }

  return newId;
}

// ============================================================================
// TEAMS
// ============================================================================

/**
 * Get team by internal ID
 */
export async function getTeamById(
  db: D1Database,
  id: number
): Promise<Team | null> {
  return db
    .prepare('SELECT * FROM teams WHERE id = ?')
    .bind(id)
    .first<Team>();
}

/**
 * Get team by provider ID
 */
export async function getTeamByProviderId(
  db: D1Database,
  provider: Provider,
  providerId: string | number
): Promise<Team | null> {
  const internalId = await resolveExternalId(db, provider, 'team', providerId);
  if (!internalId) return null;
  return getTeamById(db, internalId);
}

/**
 * Upsert team and return internal ID
 */
export async function upsertTeam(
  db: D1Database,
  data: TeamInsert,
  provider: Provider,
  providerId: string | number
): Promise<number> {
  const existingId = await resolveExternalId(db, provider, 'team', providerId);

  if (existingId) {
    // Use COALESCE to preserve existing values when new value is null
    // This prevents standings (which don't have logos) from overwriting team logos
    await db
      .prepare(
        `UPDATE teams SET 
           name = ?, 
           logo = COALESCE(?, logo), 
           country = COALESCE(?, country), 
           updated_at = datetime('now')
         WHERE id = ?`
      )
      .bind(data.name, data.logo ?? null, data.country ?? null, existingId)
      .run();
    return existingId;
  }

  const result = await db
    .prepare(
      `INSERT INTO teams (name, logo, country) VALUES (?, ?, ?)
       RETURNING id`
    )
    .bind(data.name, data.logo ?? null, data.country ?? null)
    .first<{ id: number }>();

  if (!result) {
    throw new Error(`Failed to insert team: ${data.name}`);
  }
  const newId = result.id;

  const inserted = await insertExternalIdIfMissing(db, {
    provider,
    entity_type: 'team',
    provider_id: String(providerId),
    internal_id: newId,
    match_confidence: 1.0,
    match_method: 'api_fetch',
  });

  if (inserted) return newId;

  // Mapping already existed (likely concurrent insert). Reuse mapped internal id and delete the orphan row.
  const existingInternalId = await resolveExternalId(db, provider, 'team', providerId);
  if (existingInternalId && existingInternalId !== newId) {
    await db.prepare('DELETE FROM teams WHERE id = ?').bind(newId).run();
    return existingInternalId;
  }

  return newId;
}

// ============================================================================
// TEAM SEASON CONTEXT
// ============================================================================

/**
 * Get team season context
 */
export async function getTeamSeasonContext(
  db: D1Database,
  teamId: number,
  leagueId: number,
  season: number
): Promise<TeamSeasonContext | null> {
  return db
    .prepare(
      `SELECT * FROM team_season_context 
       WHERE team_id = ? AND league_id = ? AND season = ?`
    )
    .bind(teamId, leagueId, season)
    .first<TeamSeasonContext>();
}

/**
 * Get team season context by provider IDs
 */
export async function getTeamSeasonContextByProviderIds(
  db: D1Database,
  provider: Provider,
  providerTeamId: string | number,
  providerLeagueId: string | number,
  season: number
): Promise<TeamSeasonContext | null> {
  const teamId = await resolveExternalId(db, provider, 'team', providerTeamId);
  const leagueId = await resolveExternalId(db, provider, 'league', providerLeagueId);

  if (!teamId || !leagueId) return null;
  return getTeamSeasonContext(db, teamId, leagueId, season);
}

/**
 * Upsert team season context
 */
export async function upsertTeamSeasonContext(
  db: D1Database,
  data: TeamSeasonContextInsert
): Promise<void> {
  const columns = Object.keys(data).filter((k) => data[k as keyof TeamSeasonContextInsert] !== undefined);
  const placeholders = columns.map(() => '?').join(', ');
  const values = columns.map((k) => data[k as keyof TeamSeasonContextInsert]);

  const updateClauses = columns
    .filter((k) => !['team_id', 'league_id', 'season'].includes(k))
    .map((k) => `${k} = excluded.${k}`)
    .join(', ');

  const sql = `INSERT INTO team_season_context (${columns.join(', ')})
       VALUES (${placeholders})
       ON CONFLICT(team_id, league_id, season) 
       DO UPDATE SET ${updateClauses}, updated_at = datetime('now')`;

  try {
    const result = await db.prepare(sql).bind(...values).run();
    console.log(
      `📊 [D1] team_season_context upsert: team_id=${data.team_id}, league_id=${data.league_id}, season=${data.season}, success=${result.success}, changes=${result.meta?.changes}`
    );
  } catch (error) {
    console.error(`❌ [D1] team_season_context upsert failed:`, error);
    console.error(`❌ [D1] SQL: ${sql}`);
    console.error(`❌ [D1] Values count: ${values.length}, Columns count: ${columns.length}`);
    throw error;
  }
}

// ============================================================================
// STANDINGS
// ============================================================================

/**
 * Get current standings for a league and season
 */
export async function getStandingsRows(
  db: D1Database,
  leagueId: number,
  season: number,
  groupName: string = ''
): Promise<StandingsCurrentRow[]> {
  const { results } = await db
    .prepare(
      `SELECT * FROM standings_current_row 
       WHERE league_id = ? AND season = ? AND group_name = ?
       ORDER BY rank ASC`
    )
    .bind(leagueId, season, groupName)
    .all<StandingsCurrentRow>();

  return results ?? [];
}

/**
 * Get standings row for a specific team
 */
export async function getTeamStandingsRow(
  db: D1Database,
  leagueId: number,
  season: number,
  teamId: number,
  groupName: string = ''
): Promise<StandingsCurrentRow | null> {
  return db
    .prepare(
      `SELECT * FROM standings_current_row 
       WHERE league_id = ? AND season = ? AND team_id = ? AND group_name = ?`
    )
    .bind(leagueId, season, teamId, groupName)
    .first<StandingsCurrentRow>();
}

/**
 * Get standings by provider IDs
 */
export async function getTeamStandingsRowByProviderIds(
  db: D1Database,
  provider: Provider,
  providerLeagueId: string | number,
  providerTeamId: string | number,
  season: number
): Promise<StandingsCurrentRow | null> {
  const leagueId = await resolveExternalId(db, provider, 'league', providerLeagueId);
  const teamId = await resolveExternalId(db, provider, 'team', providerTeamId);

  if (!leagueId || !teamId) return null;
  return getTeamStandingsRow(db, leagueId, season, teamId);
}

/**
 * Calculate motivation distances for a team in standings
 */
export async function calculateMotivationDistances(
  db: D1Database,
  leagueId: number,
  season: number,
  teamId: number,
  groupName: string = ''
): Promise<{
  rank: number;
  points: number;
  pointsFromFirst: number;
  pointsFromCL: number; // Typically position 4
  pointsFromRelegation: number; // Typically position 18+
} | null> {
  const allRows = await getStandingsRows(db, leagueId, season, groupName);
  if (allRows.length === 0) return null;

  const teamRow = allRows.find((r) => r.team_id === teamId);
  if (!teamRow) return null;

  const firstPlace = allRows[0];
  // CL position varies by league (4 for big leagues, 2-3 for smaller)
  // For now, assume position 4
  const clPosition = Math.min(4, allRows.length);
  const clRow = allRows[clPosition - 1];

  // Relegation zone varies (usually bottom 3 for 20-team leagues)
  const relegationPosition = Math.max(allRows.length - 2, 1);
  const relegationRow = allRows[relegationPosition - 1];

  return {
    rank: teamRow.rank,
    points: teamRow.points,
    pointsFromFirst: firstPlace.points - teamRow.points,
    pointsFromCL: clRow ? clRow.points - teamRow.points : 0,
    pointsFromRelegation: teamRow.points - (relegationRow?.points ?? 0),
  };
}

/**
 * Find the standings group_name that contains BOTH teams (home+away) for a given league/season.
 * Returns '' when no explicit group match is found.
 */
export async function getStandingsGroupForTeams(
  db: D1Database,
  leagueId: number,
  season: number,
  homeTeamId: number,
  awayTeamId: number
): Promise<string> {
  const result = await db
    .prepare(
      `SELECT group_name
       FROM standings_current_row
       WHERE league_id = ? AND season = ? AND team_id IN (?, ?)
       GROUP BY group_name
       HAVING COUNT(DISTINCT team_id) = 2
       LIMIT 1`
    )
    .bind(leagueId, season, homeTeamId, awayTeamId)
    .first<{ group_name: string }>();

  return result?.group_name ?? '';
}

/**
 * Upsert standings for a league/season (replaces all rows)
 */
export async function upsertStandings(
  db: D1Database,
  leagueId: number,
  season: number,
  provider: Provider,
  rows: StandingsCurrentRowInsert[]
): Promise<void> {
  // Start by upserting the standings_current header
  await db
    .prepare(
      `INSERT INTO standings_current (league_id, season, provider, fetched_at)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(league_id, season) 
       DO UPDATE SET provider = excluded.provider, 
                     fetched_at = excluded.fetched_at,
                     updated_at = datetime('now')`
    )
    .bind(leagueId, season, provider)
    .run();

  // Delete existing rows for this league/season
  await db
    .prepare('DELETE FROM standings_current_row WHERE league_id = ? AND season = ?')
    .bind(leagueId, season)
    .run();

  // Insert new rows
  for (const row of rows) {
    await db
      .prepare(
        `INSERT INTO standings_current_row 
         (league_id, season, team_id, rank, points, played, win, draw, loss, 
          goals_for, goals_against, goal_diff, form, group_name, description, team_name, league_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        leagueId,
        season,
        row.team_id,
        row.rank,
        row.points ?? 0,
        row.played ?? 0,
        row.win ?? 0,
        row.draw ?? 0,
        row.loss ?? 0,
        row.goals_for ?? 0,
        row.goals_against ?? 0,
        row.goal_diff ?? 0,
        row.form ?? null,
        row.group_name ?? '',
        row.description ?? null,
        row.team_name ?? null,
        row.league_name ?? null
      )
      .run();
  }
}

// ============================================================================
// INSIGHTS SNAPSHOT
// ============================================================================

/**
 * Get insights snapshot for a fixture
 */
export async function getInsightsSnapshot(
  db: D1Database,
  fixtureId: number
): Promise<InsightsSnapshot | null> {
  return db
    .prepare('SELECT * FROM insights_snapshot WHERE fixture_id = ?')
    .bind(fixtureId)
    .first<InsightsSnapshot>();
}

/**
 * Check if insights snapshot exists for a fixture
 */
export async function hasInsightsSnapshot(
  db: D1Database,
  fixtureId: number
): Promise<boolean> {
  const result = await db
    .prepare('SELECT 1 FROM insights_snapshot WHERE fixture_id = ? LIMIT 1')
    .bind(fixtureId)
    .first();
  return result !== null;
}

/**
 * Insert insights snapshot (immutable - only insert, never update)
 */
export async function insertInsightsSnapshot(
  db: D1Database,
  data: InsightsSnapshotInsert
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO insights_snapshot 
       (fixture_id, generated_at, source_provider, fixture_status_at_generation, inputs_snapshot_json, standings_signature)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(fixture_id) DO UPDATE SET
         generated_at = excluded.generated_at,
         fixture_status_at_generation = excluded.fixture_status_at_generation,
         inputs_snapshot_json = excluded.inputs_snapshot_json,
         standings_signature = excluded.standings_signature`
    )
    .bind(
      data.fixture_id,
      data.generated_at,
      data.source_provider ?? 'api_football',
      data.fixture_status_at_generation,
      data.inputs_snapshot_json,
      data.standings_signature ?? null
    )
    .run();
}

/**
 * Parse inputs snapshot JSON
 */
export function parseInputsSnapshot(json: string): InputsSnapshotData | null {
  try {
    return JSON.parse(json) as InputsSnapshotData;
  } catch {
    return null;
  }
}

/**
 * Create inputs snapshot JSON from team contexts
 */
export function createInputsSnapshotJson(data: InputsSnapshotData): string {
  return JSON.stringify(data);
}

// ============================================================================
// H2H CACHE
// ============================================================================

/**
 * Create a normalized pair key for H2H cache
 * Always uses smaller team ID first to ensure consistency
 */
export function makeH2HPairKey(teamAId: number, teamBId: number): string {
  const [smaller, larger] = teamAId < teamBId ? [teamAId, teamBId] : [teamBId, teamAId];
  return `${smaller}-${larger}`;
}

/**
 * Get H2H cache entry if not expired
 */
export async function getH2HCache(
  db: D1Database,
  teamAId: number,
  teamBId: number,
  lastN: number = 5
): Promise<H2HCacheData | null> {
  const pairKey = makeH2HPairKey(teamAId, teamBId);
  const now = new Date().toISOString();

  const result = await db
    .prepare(
      `SELECT h2h_data_json FROM h2h_cache 
       WHERE pair_key = ? AND last_n = ? AND expires_at > ?`
    )
    .bind(pairKey, lastN, now)
    .first<{ h2h_data_json: string }>();

  if (!result) return null;

  try {
    return JSON.parse(result.h2h_data_json) as H2HCacheData;
  } catch {
    return null;
  }
}

/**
 * Upsert H2H cache entry
 */
export async function upsertH2HCache(
  db: D1Database,
  data: H2HCacheInsert
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO h2h_cache 
       (pair_key, team_a_id, team_b_id, last_n, provider, fetched_at, expires_at, h2h_data_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(pair_key, last_n) DO UPDATE SET
         fetched_at = excluded.fetched_at,
         expires_at = excluded.expires_at,
         h2h_data_json = excluded.h2h_data_json,
         updated_at = datetime('now')`
    )
    .bind(
      data.pair_key,
      data.team_a_id,
      data.team_b_id,
      data.last_n ?? 5,
      data.provider ?? 'api_football',
      data.fetched_at,
      data.expires_at,
      data.h2h_data_json
    )
    .run();
}

/**
 * Invalidate H2H cache for a specific pair (when their match finishes)
 */
export async function invalidateH2HCache(
  db: D1Database,
  teamAId: number,
  teamBId: number
): Promise<void> {
  const pairKey = makeH2HPairKey(teamAId, teamBId);
  await db.prepare(`DELETE FROM h2h_cache WHERE pair_key = ?`).bind(pairKey).run();
}

// ============================================================================
// INJURIES CACHE
// ============================================================================

/**
 * Get injuries cache for a fixture
 *
 * @param db - D1 database
 * @param fixtureId - API-Football fixture ID
 * @returns Cached injuries data or null if not found/expired
 */
export async function getInjuriesCache(
  db: D1Database,
  fixtureId: number
): Promise<InjuriesCacheData | null> {
  const row = await db
    .prepare(
      `SELECT * FROM injuries_cache
       WHERE fixture_id = ? AND expires_at > datetime('now')`
    )
    .bind(fixtureId)
    .first<InjuriesCacheRow>();

  if (!row) {
    return null;
  }

  try {
    const parsed = JSON.parse(row.injuries_json);
    return {
      fixtureId: row.fixture_id,
      homeTeamId: row.home_team_ext_id,
      awayTeamId: row.away_team_ext_id,
      homeInjuries: parsed.homeInjuries ?? [],
      awayInjuries: parsed.awayInjuries ?? [],
      fetchedAt: new Date(row.fetched_at).getTime(),
    };
  } catch {
    console.error(`❌ [Injuries] Failed to parse injuries cache for fixture ${fixtureId}`);
    return null;
  }
}

/**
 * Upsert injuries cache for a fixture
 *
 * @param db - D1 database
 * @param data - Injuries data to cache
 * @param ttlMs - TTL in milliseconds (default: 24 hours)
 */
export async function upsertInjuriesCache(
  db: D1Database,
  data: InjuriesCacheData,
  ttlMs: number = INJURIES_CACHE_TTL_MS
): Promise<void> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMs);

  const injuriesJson = JSON.stringify({
    homeInjuries: data.homeInjuries,
    awayInjuries: data.awayInjuries,
  });

  await db
    .prepare(
      `INSERT INTO injuries_cache
       (fixture_id, home_team_ext_id, away_team_ext_id, provider, fetched_at, expires_at, injuries_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(fixture_id) DO UPDATE SET
         home_team_ext_id = excluded.home_team_ext_id,
         away_team_ext_id = excluded.away_team_ext_id,
         fetched_at = excluded.fetched_at,
         expires_at = excluded.expires_at,
         injuries_json = excluded.injuries_json`
    )
    .bind(
      data.fixtureId,
      data.homeTeamId,
      data.awayTeamId,
      'api_football',
      now.toISOString(),
      expiresAt.toISOString(),
      injuriesJson
    )
    .run();
}

/**
 * Invalidate injuries cache for a fixture (e.g., after match completes)
 */
export async function invalidateInjuriesCache(
  db: D1Database,
  fixtureId: number
): Promise<void> {
  await db
    .prepare(`DELETE FROM injuries_cache WHERE fixture_id = ?`)
    .bind(fixtureId)
    .run();
}
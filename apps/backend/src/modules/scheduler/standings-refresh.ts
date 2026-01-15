/**
 * Standings Refresh Module
 *
 * Handles intelligent standings refresh based on fixture status:
 * - Active leagues (with live fixtures): refresh hourly
 * - Recently finished leagues: refresh with backoff (+10m, +30m, hourly cap)
 *
 * Provider update frequency (API-Football):
 * - Standings: updated hourly
 */

import {
	FIXTURE_STATUS,
	type Fixture,
	type StandingsResponse,
} from "@outscore/shared-types";
import {
	getInsightsSnapshot,
	getStandingsGroupForTeams,
	getStandingsRows,
	resolveExternalId,
	type StandingsCurrentRowInsert,
	upsertLeague,
	upsertStandings,
	upsertTeam,
} from "../entities";
import type { SchedulerEnv } from "./refresh-scheduler";

// ============================================================================
// CONSTANTS
// ============================================================================

/** How long to keep tracking a league after its last match finishes (2 hours) */
const RECENTLY_FINISHED_WINDOW_MS = 2 * 60 * 60 * 1000;

/** Minimum time between standings refresh for active leagues (1 hour) */
const STANDINGS_REFRESH_INTERVAL_MS = 60 * 60 * 1000;

/** Backoff schedule for recently finished leagues (ms after FT) */
const STANDINGS_BACKOFF_SCHEDULE_MS = [
	10 * 60 * 1000, // +10 minutes
	30 * 60 * 1000, // +30 minutes
	60 * 60 * 1000, // +60 minutes (then hourly cap)
];

// ============================================================================
// TYPES
// ============================================================================

export interface LeagueKey {
	leagueId: number;
	season: number;
}

export interface RecentlyFinishedLeague {
	leagueId: number;
	season: number;
	finishedAt: number;
	lastRefreshAt: number;
	refreshAttempts: number;
	expiresAt: number;
}

export interface StandingsRefreshState {
	/** Leagues currently with live fixtures */
	activeLeagues: Map<string, LeagueKey>;
	/** Leagues that recently had fixtures finish */
	recentlyFinishedLeagues: Map<string, RecentlyFinishedLeague>;
	/** Last standings refresh timestamp per league */
	lastStandingsRefresh: Map<string, number>;
	/** Previous fixture statuses (to detect transitions) */
	previousFixtureStatuses: Map<number, string>;
}

// ============================================================================
// HELPERS
// ============================================================================

/** Create a unique key for a league+season combination */
export function makeLeagueKey(leagueId: number, season: number): string {
	return `${leagueId}:${season}`;
}

/** Parse a league key back into components */
export function parseLeagueKey(key: string): LeagueKey {
	const [leagueId, season] = key.split(":").map(Number);
	return { leagueId, season };
}

/** Check if a fixture status indicates the match is live */
function isLive(status: string): boolean {
	return (FIXTURE_STATUS.LIVE as readonly string[]).includes(status);
}

/** Check if a fixture status indicates the match is finished */
function isFinished(status: string): boolean {
	return (FIXTURE_STATUS.FINISHED as readonly string[]).includes(status);
}

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

/**
 * Create initial empty state
 */
export function createInitialState(): StandingsRefreshState {
	return {
		activeLeagues: new Map(),
		recentlyFinishedLeagues: new Map(),
		lastStandingsRefresh: new Map(),
		previousFixtureStatuses: new Map(),
	};
}

/**
 * Serialize state for DO storage
 */
export function serializeState(state: StandingsRefreshState): string {
	return JSON.stringify({
		activeLeagues: Array.from(state.activeLeagues.entries()),
		recentlyFinishedLeagues: Array.from(
			state.recentlyFinishedLeagues.entries(),
		),
		lastStandingsRefresh: Array.from(state.lastStandingsRefresh.entries()),
		previousFixtureStatuses: Array.from(
			state.previousFixtureStatuses.entries(),
		),
	});
}

/**
 * Deserialize state from DO storage
 */
export function deserializeState(json: string): StandingsRefreshState {
	try {
		const data = JSON.parse(json);
		return {
			activeLeagues: new Map(data.activeLeagues || []),
			recentlyFinishedLeagues: new Map(data.recentlyFinishedLeagues || []),
			lastStandingsRefresh: new Map(data.lastStandingsRefresh || []),
			previousFixtureStatuses: new Map(data.previousFixtureStatuses || []),
		};
	} catch {
		return createInitialState();
	}
}

// ============================================================================
// ANALYSIS
// ============================================================================

export interface FixtureAnalysisResult {
	/** Leagues with at least one live fixture */
	activeLeagues: Set<string>;
	/** Fixtures that just transitioned to FT */
	newlyFinishedFixtures: Array<{
		fixtureId: number;
		leagueId: number;
		season: number;
	}>;
	/** Updated fixture statuses for next iteration */
	currentStatuses: Map<number, string>;
}

/**
 * Analyze fixtures to determine active leagues and FT transitions
 */
export function analyzeFixtures(
	fixtures: Fixture[],
	previousStatuses: Map<number, string>,
): FixtureAnalysisResult {
	const activeLeagues = new Set<string>();
	const newlyFinishedFixtures: FixtureAnalysisResult["newlyFinishedFixtures"] =
		[];
	const currentStatuses = new Map<number, string>();

	for (const fixture of fixtures) {
		const fixtureId = fixture.fixture.id;
		const currentStatus = fixture.fixture.status.short;
		const previousStatus = previousStatuses.get(fixtureId);

		// Track current status
		currentStatuses.set(fixtureId, currentStatus);

		const leagueKey = makeLeagueKey(fixture.league.id, fixture.league.season);

		// Check if fixture is live → add league to active set
		if (isLive(currentStatus)) {
			activeLeagues.add(leagueKey);
		}

		// Check for FT transition (was not finished, now finished)
		if (
			previousStatus &&
			!isFinished(previousStatus) &&
			isFinished(currentStatus)
		) {
			newlyFinishedFixtures.push({
				fixtureId,
				leagueId: fixture.league.id,
				season: fixture.league.season,
			});
		}
	}

	return { activeLeagues, newlyFinishedFixtures, currentStatuses };
}

/**
 * Update state based on fixture analysis
 */
export function updateStateFromAnalysis(
	state: StandingsRefreshState,
	analysis: FixtureAnalysisResult,
	now: number,
): void {
	// Update active leagues
	state.activeLeagues.clear();
	for (const key of analysis.activeLeagues) {
		const parsed = parseLeagueKey(key);
		state.activeLeagues.set(key, parsed);
	}

	// Add newly finished leagues to recently finished set
	for (const finished of analysis.newlyFinishedFixtures) {
		const key = makeLeagueKey(finished.leagueId, finished.season);

		// Only add if not already tracking (don't reset if multiple fixtures finish)
		if (!state.recentlyFinishedLeagues.has(key)) {
			state.recentlyFinishedLeagues.set(key, {
				leagueId: finished.leagueId,
				season: finished.season,
				finishedAt: now,
				lastRefreshAt: 0,
				refreshAttempts: 0,
				expiresAt: now + RECENTLY_FINISHED_WINDOW_MS,
			});
			console.log(
				`📝 [Standings] League ${finished.leagueId} added to recently finished (fixture ${finished.fixtureId} ended)`,
			);
		}
	}

	// Clean up expired recently finished leagues
	for (const [key, league] of state.recentlyFinishedLeagues) {
		if (now > league.expiresAt) {
			state.recentlyFinishedLeagues.delete(key);
			console.log(
				`🧹 [Standings] League ${league.leagueId} expired from recently finished`,
			);
		}
	}

	// Update previous statuses for next iteration
	state.previousFixtureStatuses = analysis.currentStatuses;
}

// ============================================================================
// REFRESH DECISION
// ============================================================================

export interface LeaguesToRefresh {
	/** Leagues needing refresh from active set (hourly) */
	fromActive: LeagueKey[];
	/** Leagues needing refresh from recently finished set (backoff) */
	fromRecentlyFinished: LeagueKey[];
}

/**
 * Determine which leagues need standings refresh
 */
export function getLeaguesToRefresh(
	state: StandingsRefreshState,
	now: number,
): LeaguesToRefresh {
	const fromActive: LeagueKey[] = [];
	const fromRecentlyFinished: LeagueKey[] = [];

	// Check active leagues (hourly refresh)
	for (const [key, league] of state.activeLeagues) {
		const lastRefresh = state.lastStandingsRefresh.get(key) || 0;
		if (now - lastRefresh >= STANDINGS_REFRESH_INTERVAL_MS) {
			fromActive.push(league);
		}
	}

	// Check recently finished leagues (backoff refresh)
	for (const [key, league] of state.recentlyFinishedLeagues) {
		// Skip if already in active set (will be handled there)
		if (state.activeLeagues.has(key)) {
			continue;
		}

		const timeSinceFinish = now - league.finishedAt;
		const attempts = league.refreshAttempts;

		// Determine if we should attempt refresh based on backoff schedule
		let shouldRefresh = false;

		if (attempts < STANDINGS_BACKOFF_SCHEDULE_MS.length) {
			// Follow backoff schedule
			const targetDelay = STANDINGS_BACKOFF_SCHEDULE_MS[attempts];
			if (timeSinceFinish >= targetDelay) {
				shouldRefresh = true;
			}
		} else {
			// Past backoff schedule, use hourly cap
			const timeSinceLastRefresh = now - league.lastRefreshAt;
			if (timeSinceLastRefresh >= STANDINGS_REFRESH_INTERVAL_MS) {
				shouldRefresh = true;
			}
		}

		if (shouldRefresh) {
			fromRecentlyFinished.push({
				leagueId: league.leagueId,
				season: league.season,
			});
		}
	}

	return { fromActive, fromRecentlyFinished };
}

/**
 * Record that standings were refreshed for a league
 */
export function recordStandingsRefresh(
	state: StandingsRefreshState,
	leagueId: number,
	season: number,
	now: number,
): void {
	const key = makeLeagueKey(leagueId, season);
	state.lastStandingsRefresh.set(key, now);

	// Update recently finished if present
	const recentlyFinished = state.recentlyFinishedLeagues.get(key);
	if (recentlyFinished) {
		recentlyFinished.lastRefreshAt = now;
		recentlyFinished.refreshAttempts++;
	}
}

// ============================================================================
// STANDINGS FETCH & D1 PERSISTENCE
// ============================================================================

/**
 * Fetch standings for a league from API-Football and persist to D1
 *
 * @param leagueId - API-Football league ID
 * @param season - Season year
 * @param env - Scheduler environment with D1 access
 * @returns true if successful, false otherwise
 */
export async function fetchStandingsForLeague(
	leagueId: number,
	season: number,
	env: SchedulerEnv,
): Promise<boolean> {
	const url = new URL(`${env.FOOTBALL_API_URL}/standings`);
	url.searchParams.append("league", leagueId.toString());
	url.searchParams.append("season", season.toString());

	console.log(
		`🌐 [Standings] Fetching standings for league ${leagueId}, season ${season}`,
	);

	try {
		const response = await fetch(url.toString(), {
			headers: {
				"x-rapidapi-host": "api-football-v1.p.rapidapi.com",
				"x-rapidapi-key": env.RAPIDAPI_KEY,
			},
		});

		if (!response.ok) {
			console.warn(
				`⚠️ [Standings] Failed to fetch standings for league ${leagueId}: ${response.status}`,
			);
			return false;
		}

		const data = (await response.json()) as StandingsResponse;

		// Validate response structure
		if (!data.response || data.response.length === 0) {
			console.warn(
				`⚠️ [Standings] No standings data returned for league ${leagueId}`,
			);
			return false;
		}

		const leagueData = data.response[0].league;

		// Validate standings exist
		if (
			!leagueData.standings ||
			leagueData.standings.length === 0 ||
			leagueData.standings[0].length === 0
		) {
			console.warn(
				`⚠️ [Standings] Empty standings array for league ${leagueId}`,
			);
			return false;
		}

		const db = env.ENTITIES_DB;

		// 1. Upsert league and get internal ID
		const internalLeagueId = await upsertLeague(
			db,
			{
				name: leagueData.name,
				country: leagueData.country,
				logo: leagueData.logo,
				flag: leagueData.flag,
			},
			"api_football",
			leagueId,
		);

		// 2. Flatten all groups/tables into a single array of rows
		// Some competitions include multiple stages/groups where the same team appears
		// in multiple tables. We persist ALL rows and use (group_name) to distinguish.
		// Also dedupe within the same group_name+team_id to prevent accidental duplicates.
		const flattened = leagueData.standings.flat();
		const byGroupTeam = new Map<string, (typeof flattened)[number]>();
		for (const row of flattened) {
			const groupName = row.group ?? "";
			const key = `${groupName}::${row.team.id}`;
			// Keep the "best" row if duplicates appear (lowest rank)
			const existing = byGroupTeam.get(key);
			if (!existing || row.rank < existing.rank) {
				byGroupTeam.set(key, row);
			}
		}
		const allRows = Array.from(byGroupTeam.values());

		// 3. Ensure all teams exist in D1 and build provider→internal ID map
		const teamIdMap = new Map<number, number>();
		for (const row of allRows) {
			const internalTeamId = await upsertTeam(
				db,
				{
					name: row.team.name,
					logo: row.team.logo,
				},
				"api_football",
				row.team.id,
			);
			teamIdMap.set(row.team.id, internalTeamId);
		}

		// 4. Build standings rows with internal IDs
		const standingsRows: StandingsCurrentRowInsert[] = allRows.map((row) => {
			const internalTeamId = teamIdMap.get(row.team.id);
			if (!internalTeamId) {
				throw new Error(
					`Team ID ${row.team.id} not found in map after upsert`,
				);
			}

			return {
				league_id: internalLeagueId,
				season: leagueData.season,
				team_id: internalTeamId,
				rank: row.rank,
				points: row.points,
				played: row.all.played,
				win: row.all.win,
				draw: row.all.draw,
				loss: row.all.lose,
				goals_for: row.all.goals.for,
				goals_against: row.all.goals.against,
				goal_diff: row.goalsDiff,
				form: row.form,
				group_name: row.group,
				description: row.description,
				team_name: row.team.name,
				league_name: leagueData.name,
			};
		});

		// 5. Upsert all standings rows (replaces existing)
		await upsertStandings(
			db,
			internalLeagueId,
			leagueData.season,
			"api_football",
			standingsRows,
		);

		console.log(
			`✅ [Standings] Persisted ${standingsRows.length} standings rows for league ${leagueId} (internal: ${internalLeagueId})`,
		);
		return true;
	} catch (error) {
		console.error(
			`❌ [Standings] Error fetching/persisting standings for league ${leagueId}:`,
			error,
		);
		return false;
	}
}

// ============================================================================
// SIGNATURE-DRIVEN REGENERATION
// ============================================================================

/**
 * Compute standings signature from D1 standings rows
 *
 * Format: "{season}|{home_rank},{away_rank}|{home_pf},{away_pf}|{home_pcl},{away_pcl}|{home_pr},{away_pr}"
 * Where pf = points from first, pcl = points from CL zone (4th), pr = points from relegation
 */
export function computeStandingsSignatureFromRows(
	allRows: Array<{
		team_id: number;
		rank: number;
		points: number;
	}>,
	homeTeamId: number | null,
	awayTeamId: number | null,
	season: number,
): string {
	if (!homeTeamId || !awayTeamId || allRows.length === 0) {
		return `${season}|0,0|0,0|0,0|0,0`;
	}

	const homeRow = allRows.find((r) => r.team_id === homeTeamId);
	const awayRow = allRows.find((r) => r.team_id === awayTeamId);

	const homeRank = homeRow?.rank ?? 0;
	const awayRank = awayRow?.rank ?? 0;
	const homePoints = homeRow?.points ?? 0;
	const awayPoints = awayRow?.points ?? 0;

	// Get first place points
	const firstPlacePoints = allRows[0]?.points ?? 0;

	// CL position (typically 4th for big leagues)
	const clPosition = Math.min(4, allRows.length);
	const clPoints = allRows[clPosition - 1]?.points ?? 0;

	// Relegation zone (typically 18th for 20-team leagues)
	const relegationPosition = Math.max(allRows.length - 2, 1);
	const relegationPoints = allRows[relegationPosition - 1]?.points ?? 0;

	// Calculate distances
	const homePF = firstPlacePoints - homePoints;
	const awayPF = firstPlacePoints - awayPoints;
	const homePCL = clPoints - homePoints;
	const awayPCL = clPoints - awayPoints;
	const homePR = homePoints - relegationPoints;
	const awayPR = awayPoints - relegationPoints;

	return `${season}|${homeRank},${awayRank}|${homePF},${awayPF}|${homePCL},${awayPCL}|${homePR},${awayPR}`;
}

/**
 * Check for NS fixtures in a league that need insights regeneration
 * due to standings signature change
 *
 * Called after standings refresh for a league to trigger pre-match
 * insights updates when standings have changed.
 *
 * @param fixtures - Today's fixtures (from cached 15s refresh)
 * @param leagueId - API-Football league ID
 * @param season - Season
 * @param env - Scheduler environment with D1 access
 * @returns Number of fixtures that were regenerated
 */
export async function checkAndRegenerateForLeague(
	fixtures: Fixture[],
	leagueId: number,
	season: number,
	env: SchedulerEnv,
): Promise<number> {
	// Filter to NS fixtures in this league
	const nsFixturesInLeague = fixtures.filter(
		(f) =>
			f.league.id === leagueId &&
			f.league.season === season &&
			f.fixture.status.short === "NS",
	);

	if (nsFixturesInLeague.length === 0) {
		return 0;
	}

	console.log(
		`🔍 [Regen] Checking ${nsFixturesInLeague.length} NS fixtures in league ${leagueId} for signature changes`,
	);

	const db = env.ENTITIES_DB;

	// Resolve API-Football league ID to internal D1 ID
	const internalLeagueId = await resolveExternalId(
		db,
		"api_football",
		"league",
		leagueId,
	);

	if (!internalLeagueId) {
		console.warn(
			`⚠️ [Regen] League ${leagueId} not found in D1, skipping regeneration check`,
		);
		return 0;
	}

	// Get current standings from D1
	let regeneratedCount = 0;

	for (const fixture of nsFixturesInLeague) {
		const fixtureId = fixture.fixture.id;

		// Get existing insights snapshot (if any)
		const snapshot = await getInsightsSnapshot(db, fixtureId);

		if (!snapshot) {
			// No existing insights to compare, skip
			continue;
		}

		// Resolve team IDs to internal D1 IDs
		const homeInternalId = await resolveExternalId(
			db,
			"api_football",
			"team",
			fixture.teams.home.id,
		);
		const awayInternalId = await resolveExternalId(
			db,
			"api_football",
			"team",
			fixture.teams.away.id,
		);

		// Determine which standings table (group/stage) applies for this fixture
		const groupName =
			homeInternalId && awayInternalId
				? await getStandingsGroupForTeams(
						db,
						internalLeagueId,
						season,
						homeInternalId,
						awayInternalId,
					)
				: "";

		// Get current standings rows for that group
		const standings = await getStandingsRows(
			db,
			internalLeagueId,
			season,
			groupName,
		);

		if (standings.length === 0) {
			// No standings for this group yet; skip
			continue;
		}

		// Compute new signature from current standings
		const newSignature = computeStandingsSignatureFromRows(
			standings.map((r) => ({
				team_id: r.team_id,
				rank: r.rank,
				points: r.points,
			})),
			homeInternalId,
			awayInternalId,
			season,
		);

		// Compare with stored signature
		if (snapshot.standings_signature !== newSignature) {
			console.log(
				`🔄 [Regen] Signature changed for fixture ${fixtureId}: ` +
					`"${snapshot.standings_signature}" → "${newSignature}"`,
			);

			try {
				// Import dynamically to avoid circular dependency
				const { insightsService } = await import("../betting-insights");

				// Create a minimal execution context
				const ctx: ExecutionContext = {
					waitUntil: () => {
						/* noop */
					},
					passThroughOnException: () => {
						/* noop */
					},
				};

				await insightsService.generateInsights({
					fixtureId,
					env,
					ctx,
				});

				regeneratedCount++;
				console.log(`✅ [Regen] Regenerated insights for fixture ${fixtureId}`);
			} catch (err) {
				console.error(
					`❌ [Regen] Failed to regenerate fixture ${fixtureId}:`,
					err,
				);
			}
		}
	}

	if (regeneratedCount > 0) {
		console.log(
			`✅ [Regen] Regenerated ${regeneratedCount} insights for league ${leagueId}`,
		);
	}

	return regeneratedCount;
}


import type { Fixture, FixturesResponse } from "@outscore/shared-types";
import {
	getFootballApiFixtures,
	getFootballApiFixturesByIds,
	getFootballApiTeamById,
} from "../../pkg/util/football-api";
import { type InsightsEnv, insightsService } from "../betting-insights";
import {
	type CacheEnv,
	cacheSet,
	cacheSetEdgeOnly,
	checkFixturesDateTransition,
	cleanupOldCacheData,
	createKVCacheProvider,
	createR2CacheProvider,
	generateKVCacheKey,
	getCurrentUtcDate,
	getFixturesCacheLocation,
	getFixturesR2Key,
	getTomorrowUtcDate,
	getYesterdayUtcDate,
} from "../cache";
import { calculateDivisionOffset, inferDivisionLevel, updateElo } from "../elo";
import { filterFixturesByTimezone, formatFixtures } from "../fixtures";
import {
	type LeaguesRegistryEnv,
	refreshLeaguesRegistry,
} from "../leagues-registry";
import { commonTimezones } from "../timezones";
import { fetchStandingsForLeague } from "./standings-refresh";

// ============================================================================
// BULK PREFETCH CONSTANTS (Quota optimization)
// ============================================================================

/** API-Football max fixture IDs per request (per your plan): 20 */
const FIXTURES_BY_IDS_MAX = 20;

export interface SchedulerEnv extends CacheEnv, InsightsEnv {
	REFRESH_SCHEDULER_DO?: DurableObjectNamespace;
}

const TEAM_COUNTRY_BACKFILL_KEY = "jobs/team-country-backfill:last-run";
const TEAM_COUNTRY_BACKFILL_LIMIT = 50;
const ELO_CACHE_UPDATE_KEY = "jobs/elo-cache-update:last-run";
const ELO_FINISHED_STATUSES = new Set(["FT", "AET", "PEN"]);

/**
 * Refresh today's fixtures data in all cache layers
 * Called by Durable Object alarm every 15 seconds
 */
export const refreshTodayFixtures = async (
	env: SchedulerEnv,
): Promise<void> => {
	await refreshTodayFixturesWithAnalysis(env);
};

/**
 * Refresh today's fixtures data and return fixtures for analysis
 * Used by the DO to analyze fixture status transitions
 */
export const refreshTodayFixturesWithAnalysis = async (
	env: SchedulerEnv,
): Promise<Fixture[]> => {
	const startTime = performance.now();
	const today = getCurrentUtcDate();

	console.log(`🔄 [Scheduler] Starting refresh for ${today}`);

	try {
		// 1. Check for date transition
		await checkFixturesDateTransition(env);

		// 2. Fetch fresh data from API
		console.log(`🌐 [Scheduler] Fetching fixtures for ${today} from API`);
		const response = await getFootballApiFixtures(
			today,
			undefined,
			env.FOOTBALL_API_URL,
			env.RAPIDAPI_KEY,
		);

		const fixtures = response.response;
		console.log(`✅ [Scheduler] Received ${fixtures.length} fixtures`);

		// 3. Store raw UTC data in KV + R2
		await cacheSet(env, "fixtures", { date: today, live: "false" }, fixtures);

		// 4. Pre-generate transformed responses for common timezones
		// This warms the Edge Cache for popular timezones
		const transformPromises = commonTimezones.map(async (timezone) => {
			try {
				const filtered = filterFixturesByTimezone(fixtures, today, timezone);
				const formatted = formatFixtures(filtered, timezone);
				await cacheSetEdgeOnly(
					"fixtures",
					{ date: today, timezone, live: "false" },
					formatted,
				);
				console.log(`✅ [Scheduler] Cached Edge response for ${timezone}`);
			} catch (err) {
				console.error(`❌ [Scheduler] Failed to cache for ${timezone}:`, err);
			}
		});

		await Promise.all(transformPromises);

		const duration = (performance.now() - startTime).toFixed(2);
		console.log(`✅ [Scheduler] Refresh completed in ${duration}ms`);

		return fixtures;
	} catch (error) {
		console.error(`❌ [Scheduler] Refresh failed:`, error);
		throw error;
	}
};

/**
 * Refresh live fixtures data
 * Called more frequently for live match updates
 */
export const refreshLiveFixtures = async (env: SchedulerEnv): Promise<void> => {
	const startTime = performance.now();
	const today = getCurrentUtcDate();

	console.log(`🔴 [Scheduler] Starting live refresh`);

	try {
		// 1. Fetch live fixtures from API
		console.log(`🌐 [Scheduler] Fetching live fixtures from API`);
		const response = await getFootballApiFixtures(
			today,
			"live",
			env.FOOTBALL_API_URL,
			env.RAPIDAPI_KEY,
		);

		const fixtures = response.response;
		console.log(`✅ [Scheduler] Received ${fixtures.length} live fixtures`);

		// 2. Store raw UTC live data
		await cacheSet(env, "fixtures", { date: today, live: "true" }, fixtures);

		// 3. Pre-generate transformed responses for common timezones
		const transformPromises = commonTimezones.map(async (timezone) => {
			try {
				const filtered = filterFixturesByTimezone(fixtures, today, timezone);
				const formatted = formatFixtures(filtered, timezone);
				await cacheSetEdgeOnly(
					"fixtures",
					{ date: today, timezone, live: "true" },
					formatted,
				);
			} catch (err) {
				console.error(
					`❌ [Scheduler] Failed to cache live for ${timezone}:`,
					err,
				);
			}
		});

		await Promise.all(transformPromises);

		const duration = (performance.now() - startTime).toFixed(2);
		console.log(`✅ [Scheduler] Live refresh completed in ${duration}ms`);
	} catch (error) {
		console.error(`❌ [Scheduler] Live refresh failed:`, error);
		throw error;
	}
};

/**
 * Pre-fetch tomorrow's fixtures
 * Called once daily to warm the cache
 */
export const prefetchTomorrowFixtures = async (
	env: SchedulerEnv,
): Promise<void> => {
	const tomorrowStr = getTomorrowUtcDate();

	console.log(
		`📅 [Scheduler] Pre-fetching fixtures for tomorrow (${tomorrowStr})`,
	);

	try {
		const response = await getFootballApiFixtures(
			tomorrowStr,
			undefined,
			env.FOOTBALL_API_URL,
			env.RAPIDAPI_KEY,
		);

		const fixtures = response.response;
		console.log(
			`✅ [Scheduler] Received ${fixtures.length} fixtures for tomorrow`,
		);

		// Store in R2 (cold storage for future dates)
		await cacheSet(
			env,
			"fixtures",
			{ date: tomorrowStr, live: "false" },
			fixtures,
		);

		console.log(`✅ [Scheduler] Pre-fetch for tomorrow completed`);
	} catch (error) {
		console.error(`❌ [Scheduler] Pre-fetch for tomorrow failed:`, error);
	}
};

/**
 * Scheduled event handler for Cloudflare Workers
 * Acts as a failsafe to ensure the DO alarm chain is running
 */
export const handleScheduledEvent = async (
	event: ScheduledEvent,
	env: SchedulerEnv,
): Promise<void> => {
	const scheduledTime = new Date(event.scheduledTime);
	console.log(
		`⚡ [Scheduler] Cron triggered at ${scheduledTime.toISOString()}`,
	);

	// Run cleanup once per day at 2 AM UTC
	const hour = scheduledTime.getUTCHours();
	const minute = scheduledTime.getUTCMinutes();

	// Weekly leagues registry refresh (Sunday 03:00 UTC window)
	if (hour === 3 && minute < 10 && scheduledTime.getUTCDay() === 0) {
		console.log(`📚 [Scheduler] Refreshing leagues registry`);
		try {
			await refreshLeaguesRegistry(env as LeaguesRegistryEnv);
			console.log(`✅ [Scheduler] Leagues registry refreshed`);
		} catch (error) {
			console.error(`❌ [Scheduler] Leagues registry refresh failed:`, error);
		}
	}

	// Daily team country backfill (03:10 UTC window)
	if (hour === 3 && minute >= 10 && minute < 15) {
		await backfillTeamCountries(env);
	}

	// Daily Elo update from cached fixtures (03:20 UTC window)
	if (hour === 3 && minute >= 20 && minute < 25) {
		await updateEloFromCachedFixtures(env);
	}
	if (hour === 2 && minute < 5) {
		console.log(`🧹 [Scheduler] Running daily cleanup`);

		// Clean up old fixtures cache data (30 days historical, 14 days future)
		try {
			const fixturesResult = await cleanupOldCacheData(env, 30, 14);
			console.log(
				`✅ [Scheduler] Fixtures cleanup completed: deleted ${fixturesResult.deleted} files, ${fixturesResult.errors} errors`,
			);
		} catch (error) {
			console.error(`❌ [Scheduler] Fixtures cleanup failed:`, error);
		}

		// Note: Fixture details cleanup is now handled by Cloudflare Object Lifecycle Rules
		// configured in the Cloudflare Dashboard. No code-based cleanup needed.
	}

	if (!env.REFRESH_SCHEDULER_DO) {
		// Fallback: if DO not configured, refresh directly
		console.log(
			`⚠️ [Scheduler] REFRESH_SCHEDULER_DO not configured, refreshing directly`,
		);
		await refreshTodayFixtures(env);
		return;
	}

	// Ensure the DO alarm chain is running (it handles 15-second refreshes)
	const id = env.REFRESH_SCHEDULER_DO.idFromName("default");
	const stub = env.REFRESH_SCHEDULER_DO.get(id);

	try {
		const response = await stub.fetch(
			new Request("https://do/ensure", { method: "POST" }),
		);
		const result = (await response.json()) as {
			started: boolean;
			nextAlarm: number;
		};

		if (result.started) {
			console.log(`🚀 [Scheduler] Started DO alarm chain`);
		} else {
			console.log(
				`✅ [Scheduler] DO alarm chain already running, next alarm at ${new Date(result.nextAlarm).toISOString()}`,
			);
		}
	} catch (error) {
		console.error(`❌ [Scheduler] Failed to ensure DO alarm chain:`, error);
		// Fallback: refresh directly on error
		await refreshTodayFixtures(env);
	}
};

async function backfillTeamCountries(env: SchedulerEnv): Promise<void> {
	const today = getCurrentUtcDate();
	const lastRun = await env.FOOTBALL_KV.get(TEAM_COUNTRY_BACKFILL_KEY);
	if (lastRun === today) {
		return;
	}

	console.log(`🌍 [Scheduler] Backfilling team countries`);

	const rows = await env.ENTITIES_DB.prepare(
		`SELECT t.id AS team_id, t.name AS team_name, e.provider_id AS provider_id
		 FROM teams t
		 JOIN external_ids e
		   ON e.internal_id = t.id
		  AND e.entity_type = 'team'
		  AND e.provider = 'api_football'
		 WHERE t.country IS NULL OR t.country = ''
		 LIMIT ?`,
	)
		.bind(TEAM_COUNTRY_BACKFILL_LIMIT)
		.all<{ team_id: number; team_name: string; provider_id: string }>();

	const targets = rows.results ?? [];
	if (!targets.length) {
		await env.FOOTBALL_KV.put(TEAM_COUNTRY_BACKFILL_KEY, today);
		console.log(`✅ [Scheduler] No missing team countries found`);
		return;
	}

	let updated = 0;
	for (const target of targets) {
		try {
			const apiTeam = await getFootballApiTeamById(
				Number(target.provider_id),
				env.FOOTBALL_API_URL,
				env.RAPIDAPI_KEY,
			);
			const first = apiTeam.response?.[0]?.team;
			const country =
				typeof first?.country === "string" && first.country.trim()
					? first.country.trim()
					: null;
			if (!country) continue;

			await env.ENTITIES_DB.prepare(
				`UPDATE teams SET country = ?, updated_at = datetime('now') WHERE id = ?`,
			)
				.bind(country, target.team_id)
				.run();
			updated += 1;
		} catch (error) {
			console.warn(
				`⚠️ [Scheduler] Failed to fetch country for team ${target.team_id} (${target.team_name})`,
				error,
			);
		}
	}

	await env.FOOTBALL_KV.put(TEAM_COUNTRY_BACKFILL_KEY, today);
	console.log(
		`✅ [Scheduler] Team country backfill done: updated ${updated} / ${targets.length}`,
	);
}

async function loadCachedFixturesForDate(
	env: SchedulerEnv,
	date: string,
): Promise<Fixture[]> {
	const kvProvider = createKVCacheProvider<Fixture[]>(env.FOOTBALL_KV);
	const kvKey = generateKVCacheKey({ date, live: false });
	const kvResult = await kvProvider.get(kvKey);
	if (kvResult.data) {
		return kvResult.data;
	}

	const r2Provider = createR2CacheProvider<Fixture[]>(env.FOOTBALL_CACHE);
	const location = getFixturesCacheLocation(date);
	const r2Key = getFixturesR2Key(location, date, false);
	const r2Result = await r2Provider.get(r2Key);
	return r2Result.data ?? [];
}

async function loadProcessedFixtureIds(
	db: D1Database,
	fixtureIds: string[],
): Promise<Set<string>> {
	const processed = new Set<string>();
	for (const chunk of chunkArray(fixtureIds, 100)) {
		const placeholders = chunk.map(() => "?").join(",");
		const rows = await db
			.prepare(
				`SELECT last_fixture_id
				 FROM team_elo_ratings
				 WHERE last_fixture_id IN (${placeholders})
				 GROUP BY last_fixture_id
				 HAVING COUNT(DISTINCT team_id) >= 2`,
			)
			.bind(...chunk)
			.all<{ last_fixture_id: string }>();
		for (const row of rows.results ?? []) {
			processed.add(row.last_fixture_id);
		}
	}
	return processed;
}

async function loadExternalTeamMap(
	db: D1Database,
	providerIds: number[],
): Promise<Map<number, number>> {
	const map = new Map<number, number>();
	for (const chunk of chunkArray(providerIds, 100)) {
		const placeholders = chunk.map(() => "?").join(",");
		const rows = await db
			.prepare(
				`SELECT provider_id, internal_id FROM external_ids
				 WHERE provider = 'api_football'
				   AND entity_type = 'team'
				   AND provider_id IN (${placeholders})`,
			)
			.bind(...chunk.map((id) => String(id)))
			.all<{ provider_id: string; internal_id: number }>();
		for (const row of rows.results ?? []) {
			map.set(Number(row.provider_id), Number(row.internal_id));
		}
	}
	return map;
}

async function loadCurrentEloMap(
	db: D1Database,
	teamIds: number[],
): Promise<Map<number, { elo: number; games: number; asOf: string }>> {
	const map = new Map<number, { elo: number; games: number; asOf: string }>();
	for (const chunk of chunkArray(teamIds, 100)) {
		const placeholders = chunk.map(() => "?").join(",");
		const rows = await db
			.prepare(
				`SELECT team_id, elo, games, as_of_date
				 FROM team_elo_current
				 WHERE team_id IN (${placeholders})`,
			)
			.bind(...chunk)
			.all<{ team_id: number; elo: number; games: number; as_of_date: string }>();
		for (const row of rows.results ?? []) {
			map.set(row.team_id, {
				elo: row.elo,
				games: row.games,
				asOf: row.as_of_date,
			});
		}
	}
	return map;
}

function detectMatchType(leagueName: string) {
	const name = (leagueName ?? "").toLowerCase();
	if (
		name.includes("champions league") ||
		name.includes("europa league") ||
		name.includes("conference league") ||
		name.includes("libertadores") ||
		name.includes("sudamericana") ||
		name.includes("club world cup")
	) {
		return "INTERNATIONAL" as const;
	}
	if (
		name.includes(" cup") ||
		name.includes("copa") ||
		name.includes("taça") ||
		name.includes("taca") ||
		name.includes("coupe") ||
		name.includes("coppa") ||
		name.includes("pokal") ||
		name.includes("beker") ||
		name.includes("super cup") ||
		name.includes("supercup") ||
		name.includes("super-cup") ||
		name.includes("supercopa") ||
		name.includes("supercoppa") ||
		name.includes("shield")
	) {
		return "CUP" as const;
	}
	return "LEAGUE" as const;
}

async function updateEloFromCachedFixtures(env: SchedulerEnv): Promise<void> {
	const today = getCurrentUtcDate();
	const lastRun = await env.FOOTBALL_KV.get(ELO_CACHE_UPDATE_KEY);
	if (lastRun === today) {
		return;
	}

	const dates = [getYesterdayUtcDate(), today];
	const fixtureLists = await Promise.all(
		dates.map((date) => loadCachedFixturesForDate(env, date)),
	);
	const fixtures = fixtureLists.flat();
	if (!fixtures.length) {
		await env.FOOTBALL_KV.put(ELO_CACHE_UPDATE_KEY, today);
		console.log(`✅ [Scheduler] No cached fixtures available for Elo update`);
		return;
	}

	const finished = fixtures
		.filter((fixture) => ELO_FINISHED_STATUSES.has(fixture.fixture.status.short))
		.filter(
			(fixture) => fixture.goals.home !== null && fixture.goals.away !== null,
		);

	if (!finished.length) {
		await env.FOOTBALL_KV.put(ELO_CACHE_UPDATE_KEY, today);
		console.log(`✅ [Scheduler] No finished fixtures to process for Elo`);
		return;
	}

	const fixtureIds = finished.map((fixture) => String(fixture.fixture.id));
	const processed = await loadProcessedFixtureIds(env.ENTITIES_DB, fixtureIds);
	const pending = finished
		.filter((fixture) => !processed.has(String(fixture.fixture.id)))
		.sort(
			(a, b) =>
				new Date(a.fixture.date).getTime() - new Date(b.fixture.date).getTime(),
		);

	if (!pending.length) {
		await env.FOOTBALL_KV.put(ELO_CACHE_UPDATE_KEY, today);
		console.log(`✅ [Scheduler] All fixtures already processed for Elo`);
		return;
	}

	const providerIds = Array.from(
		new Set(
			pending.flatMap((fixture) => [
				fixture.teams.home.id,
				fixture.teams.away.id,
			]),
		),
	);
	const externalTeamMap = await loadExternalTeamMap(env.ENTITIES_DB, providerIds);
	const internalIds = Array.from(new Set(externalTeamMap.values()));
	const currentEloMap = await loadCurrentEloMap(env.ENTITIES_DB, internalIds);
	const eloState = new Map(
		Array.from(currentEloMap.entries()).map(([teamId, state]) => [
			teamId,
			{ elo: state.elo, games: state.games, asOf: state.asOf },
		]),
	);

	const inserts: Array<{
		teamId: number;
		asOf: string;
		elo: number;
		games: number;
		fixtureId: number;
	}> = [];
	const touchedTeams = new Set<number>();

	for (const fixture of pending) {
		const homeId = externalTeamMap.get(fixture.teams.home.id);
		const awayId = externalTeamMap.get(fixture.teams.away.id);
		if (!homeId || !awayId) {
			const missing = [
				!homeId ? `home=${fixture.teams.home.id}` : null,
				!awayId ? `away=${fixture.teams.away.id}` : null,
			]
				.filter(Boolean)
				.join(", ");
			console.warn(
				`⚠️ [Scheduler] Skipping fixture ${fixture.fixture.id}: missing team mapping (${missing}).`,
			);
			continue;
		}

		const matchType = detectMatchType(fixture.league.name);
		const baseDivisionOffset =
			matchType === "LEAGUE"
				? calculateDivisionOffset(inferDivisionLevel(fixture.league.name))
				: 0;
		const homeState =
			eloState.get(homeId) ?? {
				elo: 1500 + baseDivisionOffset,
				games: 0,
				asOf: fixture.fixture.date,
			};
		const awayState =
			eloState.get(awayId) ?? {
				elo: 1500 + baseDivisionOffset,
				games: 0,
				asOf: fixture.fixture.date,
			};

		const goalDiff = (fixture.goals.home ?? 0) - (fixture.goals.away ?? 0);
		const update = updateElo({
			homeElo: homeState.elo,
			awayElo: awayState.elo,
			matchType,
			goalDiff,
		});

		const nextHome = {
			elo: update.homeElo,
			games: homeState.games + 1,
			asOf: fixture.fixture.date,
		};
		const nextAway = {
			elo: update.awayElo,
			games: awayState.games + 1,
			asOf: fixture.fixture.date,
		};

		eloState.set(homeId, nextHome);
		eloState.set(awayId, nextAway);
		touchedTeams.add(homeId);
		touchedTeams.add(awayId);

		inserts.push({
			teamId: homeId,
			asOf: fixture.fixture.date,
			elo: nextHome.elo,
			games: nextHome.games,
			fixtureId: fixture.fixture.id,
		});
		inserts.push({
			teamId: awayId,
			asOf: fixture.fixture.date,
			elo: nextAway.elo,
			games: nextAway.games,
			fixtureId: fixture.fixture.id,
		});
	}

	const insertStatements = inserts.map((row) =>
		env.ENTITIES_DB.prepare(
			`INSERT INTO team_elo_ratings
			 (team_id, as_of_date, elo, games, last_fixture_provider, last_fixture_id, updated_at)
			 VALUES (?, ?, ?, ?, 'api_football', ?, datetime('now'))
			 ON CONFLICT(team_id, last_fixture_provider, last_fixture_id) DO NOTHING`,
		).bind(row.teamId, row.asOf, row.elo, row.games, String(row.fixtureId)),
	);

	for (const chunk of chunkArray(insertStatements, 100)) {
		await env.ENTITIES_DB.batch(chunk);
	}

	const currentStatements = Array.from(touchedTeams).map((teamId) => {
		const state = eloState.get(teamId);
		if (!state) return null;
		return env.ENTITIES_DB.prepare(
			`INSERT INTO team_elo_current
			 (team_id, elo, games, as_of_date, updated_at)
			 VALUES (?, ?, ?, ?, datetime('now'))
			 ON CONFLICT(team_id) DO UPDATE SET
			   elo = excluded.elo,
			   games = excluded.games,
			   as_of_date = excluded.as_of_date,
			   updated_at = datetime('now')`,
		).bind(teamId, state.elo, state.games, state.asOf);
	});

	const currentBatches = currentStatements.filter(Boolean) as D1PreparedStatement[];
	for (const chunk of chunkArray(currentBatches, 100)) {
		await env.ENTITIES_DB.batch(chunk);
	}

	await env.FOOTBALL_KV.put(ELO_CACHE_UPDATE_KEY, today);
	console.log(
		`✅ [Scheduler] Elo update complete from cached fixtures: ${inserts.length} snapshots`,
	);
}

// ============================================================================
// DAILY ENTITY-DEDUPED PREFETCH (3 AM UTC)
// ============================================================================

/**
 * Top leagues for insights output prefetch (API-Football league IDs)
 * Only these leagues get full insights output pre-computed
 * All other leagues only get D1 inputs refreshed
 */
const TOP_LEAGUE_IDS = new Set([
	1, //World Cup
	2, //UEFA Champions League
	3, //UEFA Europa League
	94, //Primeira Liga
	39, //Premier League
	88, //Eredivisie
	140, //La Liga
	135, //Serie A
	61, //Ligue 1
	78, //Bundesliga
]);

/**
 * Statuses that indicate a match hasn't started yet
 */
const UPCOMING_STATUSES = ["TBD", "NS", "PST", "CANC", "ABD", "AWD", "WO"];

function chunkArray<T>(items: T[], size: number): T[][] {
	const chunks: T[][] = [];
	for (let i = 0; i < items.length; i += size) {
		chunks.push(items.slice(i, i + size));
	}
	return chunks;
}

function getUtcDateFromIso(iso: string | undefined): string {
	if (!iso) return getCurrentUtcDate();
	const d = new Date(iso);
	const year = d.getUTCFullYear();
	const month = String(d.getUTCMonth() + 1).padStart(2, "0");
	const day = String(d.getUTCDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function singleFixtureResponse(
	fixture: Fixture,
	base?: Partial<Pick<FixturesResponse, "get" | "errors" | "paging">>,
): FixturesResponse {
	return {
		get: base?.get ?? "fixtures",
		parameters: { id: String(fixture.fixture.id) },
		errors: base?.errors ?? [],
		results: 1,
		paging: base?.paging ?? { current: 1, total: 1 },
		response: [fixture],
	};
}

/**
 * Extract unique leagues and teams from fixtures
 */
function extractEntitiesFromFixtures(fixtures: Fixture[]): {
	leagues: Map<
		string,
		{
			leagueId: number;
			season: number;
			name: string;
			country: string;
			logo: string;
			flag: string | null;
		}
	>;
	teams: Map<
		string,
		{
			teamId: number;
			leagueId: number;
			season: number;
			name: string;
			logo: string;
		}
	>;
} {
	const leagues = new Map<
		string,
		{
			leagueId: number;
			season: number;
			name: string;
			country: string;
			logo: string;
			flag: string | null;
		}
	>();
	const teams = new Map<
		string,
		{
			teamId: number;
			leagueId: number;
			season: number;
			name: string;
			logo: string;
		}
	>();

	for (const fixture of fixtures) {
		const leagueKey = `${fixture.league.id}:${fixture.league.season}`;
		if (!leagues.has(leagueKey)) {
			leagues.set(leagueKey, {
				leagueId: fixture.league.id,
				season: fixture.league.season,
				name: fixture.league.name,
				country: fixture.league.country,
				logo: fixture.league.logo,
				flag: fixture.league.flag,
			});
		}

		// Home team
		const homeKey = `${fixture.teams.home.id}:${fixture.league.id}:${fixture.league.season}`;
		if (!teams.has(homeKey)) {
			teams.set(homeKey, {
				teamId: fixture.teams.home.id,
				leagueId: fixture.league.id,
				season: fixture.league.season,
				name: fixture.teams.home.name,
				logo: fixture.teams.home.logo,
			});
		}

		// Away team
		const awayKey = `${fixture.teams.away.id}:${fixture.league.id}:${fixture.league.season}`;
		if (!teams.has(awayKey)) {
			teams.set(awayKey, {
				teamId: fixture.teams.away.id,
				leagueId: fixture.league.id,
				season: fixture.league.season,
				name: fixture.teams.away.name,
				logo: fixture.teams.away.logo,
			});
		}
	}

	return { leagues, teams };
}

/**
 * Prefetch D1 inputs for today and yesterday (entity-deduped)
 * Called daily at 3 AM UTC
 *
 * Strategy:
 * 1. Fetch today's fixtures by date (1 API call)
 * 2. Fetch yesterday's fixtures by date (1 API call)
 * 3. Extract unique leagues/teams from both days
 * 4. Refresh standings once per unique league
 * 5. Refresh team contexts once per unique team (for teams that played yesterday)
 * 6. Prefetch insights outputs only for top leagues
 */
export const prefetchDailyInsights = async (
	env: SchedulerEnv,
): Promise<void> => {
	const startTime = performance.now();
	const today = getCurrentUtcDate();
	const yesterday = getYesterdayUtcDate();

	console.log(`📊 [Prefetch] Starting daily entity-deduped prefetch`);
	console.log(`📅 [Prefetch] Today: ${today}, Yesterday: ${yesterday}`);

	try {
		// 1. Fetch today's fixtures (1 API call)
		console.log(`🌐 [Prefetch] Fetching today's fixtures (${today})`);
		const todayResponse = await getFootballApiFixtures(
			today,
			undefined,
			env.FOOTBALL_API_URL,
			env.RAPIDAPI_KEY,
		);
		const todayFixtures: Fixture[] = todayResponse.response;
		console.log(
			`✅ [Prefetch] Received ${todayFixtures.length} fixtures for today`,
		);

		// 2. Fetch yesterday's fixtures (1 API call)
		console.log(`🌐 [Prefetch] Fetching yesterday's fixtures (${yesterday})`);
		const yesterdayResponse = await getFootballApiFixtures(
			yesterday,
			undefined,
			env.FOOTBALL_API_URL,
			env.RAPIDAPI_KEY,
		);
		const yesterdayFixtures: Fixture[] = yesterdayResponse.response;
		console.log(
			`✅ [Prefetch] Received ${yesterdayFixtures.length} fixtures for yesterday`,
		);

		// 3. Extract unique entities from both days
		const todayEntities = extractEntitiesFromFixtures(todayFixtures);
		const yesterdayEntities = extractEntitiesFromFixtures(yesterdayFixtures);

		// Merge leagues (today's take precedence for freshness)
		const allLeagues = new Map([
			...yesterdayEntities.leagues,
			...todayEntities.leagues,
		]);
		// Teams that played yesterday (need context refresh)
		const yesterdayTeams = yesterdayEntities.teams;

		console.log(
			`📋 [Prefetch] Unique entities: ${allLeagues.size} leagues, ${yesterdayTeams.size} teams (played yesterday)`,
		);

		// 4. Refresh standings for all unique leagues
		console.log(
			`🔄 [Prefetch] Refreshing standings for ${allLeagues.size} leagues`,
		);
		let standingsSuccess = 0;
		let standingsError = 0;

		for (const league of allLeagues.values()) {
			try {
				const success = await fetchStandingsForLeague(
					league.leagueId,
					league.season,
					env,
				);
				if (success) {
					standingsSuccess++;
				} else {
					standingsError++;
				}
			} catch (error) {
				console.error(
					`❌ [Prefetch] Failed to refresh standings for league ${league.leagueId}:`,
					error,
				);
				standingsError++;
			}
		}
		console.log(
			`✅ [Prefetch] Standings refresh: ${standingsSuccess} success, ${standingsError} errors`,
		);

		// 5. Prefetch insights outputs for top leagues only
		const upcomingTopLeagueFixtures = todayFixtures.filter(
			(f) =>
				UPCOMING_STATUSES.includes(f.fixture.status.short) &&
				TOP_LEAGUE_IDS.has(f.league.id),
		);

		console.log(
			`📋 [Prefetch] ${upcomingTopLeagueFixtures.length} top league fixtures for insights prefetch`,
		);

		if (upcomingTopLeagueFixtures.length > 0) {
			const BATCH_SIZE = 10;
			const BATCH_DELAY_MS = 2000;
			let insightsSuccess = 0;
			let insightsError = 0;
			let insightsSkipped = 0;

			// ---------------------------------------------------------------------
			// Quota optimization: bulk fetch fixture details by ids (max 20 per call)
			// - Reduces /fixtures?id=... calls during insights prefetch
			// - Fan-out writes to fixtureDetail cache so match pages stay instant
			// ---------------------------------------------------------------------
			const fixtureIds = upcomingTopLeagueFixtures.map((f) => f.fixture.id);
			const idBatches = chunkArray(fixtureIds, FIXTURES_BY_IDS_MAX);
			const fixtureDetailById = new Map<number, Fixture>();

			for (const ids of idBatches) {
				try {
					const bulk = await getFootballApiFixturesByIds(
						ids,
						env.FOOTBALL_API_URL,
						env.RAPIDAPI_KEY,
					);

					for (const fx of bulk.response ?? []) {
						fixtureDetailById.set(fx.fixture.id, fx);
					}

					// Fan-out cacheSet per fixture (Edge + R2), mirroring fixtures.service.ts behavior.
					await Promise.all(
						(bulk.response ?? []).map(async (fx) => {
							const fixtureDate = getUtcDateFromIso(fx.fixture.date);
							const status = fx.fixture.status.short || "";
							const timestamp = String(fx.fixture.timestamp ?? "");

							await cacheSet(
								env,
								"fixtureDetail",
								{
									fixtureId: String(fx.fixture.id),
									date: fixtureDate,
									status,
									timestamp,
								},
								singleFixtureResponse(fx, {
									get: bulk.get,
									errors: bulk.errors,
									paging: bulk.paging,
								}),
							);
						}),
					);
				} catch (e) {
					console.warn(`⚠️ [Prefetch] Bulk fixture-details fetch failed`, e);
				}
			}

			for (let i = 0; i < upcomingTopLeagueFixtures.length; i += BATCH_SIZE) {
				const batch = upcomingTopLeagueFixtures.slice(i, i + BATCH_SIZE);
				const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
				const totalBatches = Math.ceil(
					upcomingTopLeagueFixtures.length / BATCH_SIZE,
				);

				console.log(
					`🔄 [Prefetch] Processing insights batch ${batchNumber}/${totalBatches}`,
				);

				const results = await Promise.allSettled(
					batch.map(async (fixture) => {
						try {
							const ctx: ExecutionContext = {
								// Some local typings model ExecutionContext with a required `props`.
								// We don't use it in scheduler prefetch, but provide it to satisfy the type.
								props: {},
								waitUntil: (promise: Promise<unknown>) => {
									void promise;
								},
								passThroughOnException: () => {
									/* noop */
								},
							};

							const fixtureOverride =
								fixtureDetailById.get(fixture.fixture.id) ?? fixture;

							const result = await insightsService.generateInsights({
								fixtureId: fixture.fixture.id,
								env,
								ctx,
								fixtureOverride,
							});

							return { success: true, source: result.source };
						} catch (error) {
							const msg = error instanceof Error ? error.message : "Unknown";
							if (
								msg.includes("cannot be generated") ||
								msg.includes("not available")
							) {
								return { success: false, skipped: true };
							}
							return { success: false, skipped: false };
						}
					}),
				);

				for (const result of results) {
					if (result.status === "fulfilled") {
						const v = result.value as { success: boolean; skipped?: boolean };
						if (v.success) insightsSuccess++;
						else if (v.skipped) insightsSkipped++;
						else insightsError++;
					} else {
						insightsError++;
					}
				}

				if (i + BATCH_SIZE < upcomingTopLeagueFixtures.length) {
					await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
				}
			}

			console.log(
				`✅ [Prefetch] Insights prefetch: ${insightsSuccess} success, ${insightsSkipped} skipped, ${insightsError} errors`,
			);
		}

		const duration = ((performance.now() - startTime) / 1000).toFixed(2);
		console.log(`✅ [Prefetch] Daily prefetch completed in ${duration}s`);
	} catch (error) {
		console.error(`❌ [Prefetch] Daily prefetch failed:`, error);
		throw error;
	}
};

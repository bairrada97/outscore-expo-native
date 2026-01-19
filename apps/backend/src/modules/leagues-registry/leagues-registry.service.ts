import { createR2CacheProvider } from "../cache";
import type { CacheEnv } from "../cache";
import { getFootballApiLeagues, type LeaguesResponse } from "../../pkg/util/football-api";

export type LeaguesRegistryEnv = CacheEnv & {
	FOOTBALL_API_URL: string;
	RAPIDAPI_KEY: string;
};

export type LeaguesRegistrySnapshot = {
	generatedAt: string;
	raw: LeaguesResponse;
	byLeagueId: Record<
		string,
		{
			league: LeaguesResponse["response"][number]["league"];
			country: LeaguesResponse["response"][number]["country"];
			seasons: LeaguesResponse["response"][number]["seasons"];
		}
	>;
};

const LEAGUES_LATEST_KEY = "registry/leagues-latest.json";

function getArchiveKey(dateIso: string) {
	return `registry/leagues-${dateIso}.json`;
}

function buildIndex(response: LeaguesResponse): LeaguesRegistrySnapshot["byLeagueId"] {
	const byLeagueId: LeaguesRegistrySnapshot["byLeagueId"] = {};
	for (const item of response.response ?? []) {
		byLeagueId[String(item.league.id)] = {
			league: item.league,
			country: item.country,
			seasons: item.seasons ?? [],
		};
	}
	return byLeagueId;
}

export async function refreshLeaguesRegistry(env: LeaguesRegistryEnv): Promise<{
	latestKey: string;
	archiveKey: string;
	totalLeagues: number;
}> {
	const leagues = await getFootballApiLeagues(
		env.FOOTBALL_API_URL,
		env.RAPIDAPI_KEY,
	);

	const generatedAt = new Date().toISOString();
	const snapshot: LeaguesRegistrySnapshot = {
		generatedAt,
		raw: leagues,
		byLeagueId: buildIndex(leagues),
	};

	const r2 = createR2CacheProvider<LeaguesRegistrySnapshot>(env.FOOTBALL_CACHE);
	const dateKey = generatedAt.slice(0, 10);
	const archiveKey = getArchiveKey(dateKey);

	await r2.set(LEAGUES_LATEST_KEY, snapshot, {
		ttl: 60 * 60 * 24 * 30, // 30 days (metadata only)
	});
	await r2.set(archiveKey, snapshot, {
		ttl: 60 * 60 * 24 * 365, // 1 year (metadata only)
	});

	return {
		latestKey: LEAGUES_LATEST_KEY,
		archiveKey,
		totalLeagues: leagues.response?.length ?? 0,
	};
}

export async function getLeaguesRegistrySnapshot(
	env: CacheEnv,
): Promise<LeaguesRegistrySnapshot | null> {
	const r2 = createR2CacheProvider<LeaguesRegistrySnapshot>(env.FOOTBALL_CACHE);
	const result = await r2.get(LEAGUES_LATEST_KEY);
	return result.data ?? null;
}


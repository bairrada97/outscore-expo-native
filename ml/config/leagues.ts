import leagueNameData from "./league-name-map.json";

export const TOP_LEAGUE_IDS = new Set([39, 140, 135, 78, 61, 94, 88]);

export const LEAGUE_NAME_MAP: Record<string, number> =
	leagueNameData.leagueNameMap;

export const resolveLeagueId = (leagueName: string) => {
	const key = leagueName.trim().toLowerCase();
	return LEAGUE_NAME_MAP[key] ?? null;
};

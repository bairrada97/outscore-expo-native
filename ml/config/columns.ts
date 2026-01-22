export const COLUMN_CANDIDATES = {
	date: ["date", "match_date", "game_date", "matchdate"],
	homeTeam: ["hometeam", "home", "home_team", "team_home"],
	awayTeam: ["awayteam", "away", "away_team", "team_away"],
	homeGoals: ["fthg", "fthome", "home_goals", "hg", "home_score"],
	awayGoals: ["ftag", "ftaway", "away_goals", "ag", "away_score"],
	league: ["league", "competition", "div", "division", "league_name"],
	season: ["season", "year"],
};

export const resolveColumn = (
	headers: string[],
	candidates: string[],
) => {
	const lower = headers.map((header) => header.trim().toLowerCase());
	for (const candidate of candidates) {
		const index = lower.indexOf(candidate);
		if (index !== -1) return headers[index];
	}
	return null;
};

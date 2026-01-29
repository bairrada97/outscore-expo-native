export const COLUMN_CANDIDATES = {
	date: ["date", "match_date", "game_date", "matchdate"],
	homeTeam: ["hometeam", "home", "home_team", "team_home"],
	awayTeam: ["awayteam", "away", "away_team", "team_away"],
	homeGoals: ["fthg", "fthome", "home_goals", "hg", "home_score"],
	awayGoals: ["ftag", "ftaway", "away_goals", "ag", "away_score"],
	league: ["league", "competition", "div", "division", "league_name"],
	season: ["season", "year"],
	homeElo: ["homeelo", "home_elo", "elo_home"],
	awayElo: ["awayelo", "away_elo", "elo_away"],
	oddHome: ["oddhome", "odd_home", "odds_home", "b365h"],
	oddDraw: ["odddraw", "odd_draw", "odds_draw", "b365d"],
	oddAway: ["oddaway", "odd_away", "odds_away", "b365a"],
	over25: ["over25", "over_25", "over2.5", "over_2_5", "b365over25"],
	under25: ["under25", "under_25", "under2.5", "under_2_5", "b365under25"],
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

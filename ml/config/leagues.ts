export const TOP_LEAGUE_IDS = new Set([39, 140, 135, 78, 61, 94, 88]);

export const LEAGUE_NAME_MAP: Record<string, number> = {
	// Premier League
	"premier league": 39,
	"english premier league": 39,
	epl: 39,
	e0: 39,

	// La Liga
	"la liga": 140,
	"spanish la liga": 140,
	"primera division": 140,
	"primera división": 140,
	sp1: 140,

	// Serie A
	"serie a": 135,
	"italian serie a": 135,
	i1: 135,

	// Bundesliga
	"bundesliga": 78,
	"german bundesliga": 78,
	d1: 78,

	// Ligue 1
	"ligue 1": 61,
	"french ligue 1": 61,
	f1: 61,

	// Primeira Liga (Portugal)
	"primeira liga": 94,
	"liga portugal": 94,
	"portuguese league": 94,
	p1: 94,

	// Eredivisie (Netherlands)
	"eredivisie": 88,
	"dutch eredivisie": 88,
	n1: 88,
};

export const resolveLeagueId = (leagueName: string) => {
	const key = leagueName.trim().toLowerCase();
	return LEAGUE_NAME_MAP[key] ?? null;
};

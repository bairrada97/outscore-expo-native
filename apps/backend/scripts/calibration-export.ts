import type { Fixture, FixturesResponse } from "@outscore/shared-types";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
    insightsService,
    type ProcessedMatch,
    simulateMatchOutcome,
} from "../src/modules/betting-insights";
import { buildMatchContext } from "../src/modules/betting-insights/match-context/context-adjustments";
import { buildGoalDistributionModifiers } from "../src/modules/betting-insights/simulations/goal-distribution-modifiers";
import { processH2HData } from "../src/modules/betting-insights/utils/h2h-helpers";
import { extractRoundNumber } from "../src/modules/betting-insights/utils/helpers";
import {
    calculateDivisionOffset,
    calculateEloConfidence,
    calculateStartingElo,
    inferDivisionLevel,
    updateElo,
} from "../src/modules/elo/elo-engine";
import { getFootballApiFixturesByLeagueSeason } from "../src/pkg/util/football-api";
import { detectMatchType } from "./lib/elo-utils";

type EvalRow = {
	fixtureId: number;
	date: string;
	leagueId: number;
	season: number;
	matchType: string;
	probHomeWin: number;
	probDraw: number;
	probAwayWin: number;
	actual: "HOME" | "DRAW" | "AWAY";
};

type UefaPriorsPayload = {
	asOfSeason: number;
	associations: Array<{
		countryCode: string;
		rank?: number | null;
		coefficient5y?: number | null;
	}>;
	clubs: Array<{
		uefaClubKey: string;
		name: string;
		countryCode?: string | null;
		coefficient?: number | null;
	}>;
	clubTeamMap: Array<{
		uefaClubKey: string;
		apiFootballTeamId: number;
		confidence?: number | null;
		method?: string | null;
	}>;
};

type EloState = {
	elo: number;
	games: number;
	asOf: string;
};

type StandingsRow = {
	teamId: number;
	teamName: string;
	played: number;
	win: number;
	draw: number;
	loss: number;
	goalsFor: number;
	goalsAgainst: number;
	points: number;
	formResults: Array<"W" | "D" | "L">;
};

type TeamStandingsData = {
	rank: number;
	points: number;
	played: number;
	win: number;
	draw: number;
	loss: number;
	goalsFor: number;
	goalsAgainst: number;
	goalDiff: number;
	form: string | null;
	pointsFromFirst: number;
	pointsFromCL: number;
	pointsFromRelegation: number;
};

const FINISHED_STATUSES = new Set(["FT", "AET", "PEN"]);
const REQUEST_DELAY_MS = 250;
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 500;
const MAX_MATCH_HISTORY = 50;
const H2H_API_LIMIT = 25;
const H2H_MODEL_LIMIT = 5;

const parseArg = (args: string[], key: string) => {
	const index = args.findIndex((a) => a === key);
	if (index === -1) return null;
	return args[index + 1] ?? null;
};

const parseLeagueIds = (raw: string | null) => {
	if (!raw) return [];
	return raw
		.split(",")
		.map((id) => Number(id.trim()))
		.filter((id) => Number.isFinite(id));
};

const parseSeasons = (args: string[]) => {
	const seasonsRaw = parseArg(args, "--seasons");
	if (seasonsRaw) {
		return seasonsRaw
			.split(",")
			.map((season) => Number(season.trim()))
			.filter((season) => Number.isInteger(season));
	}

	const fromSeasonRaw = parseArg(args, "--from-season");
	const toSeasonRaw = parseArg(args, "--to-season");
	const fromSeason = Number(fromSeasonRaw);
	const toSeason = Number(toSeasonRaw);

	if (
		!fromSeasonRaw ||
		!toSeasonRaw ||
		!Number.isInteger(fromSeason) ||
		!Number.isInteger(toSeason) ||
		fromSeason > toSeason
	) {
		return [];
	}

	const seasons: number[] = [];
	for (let season = fromSeason; season <= toSeason; season += 1) {
		seasons.push(season);
	}
	return seasons;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const shouldRetryRequest = (error: unknown) => {
	const message =
		error instanceof Error
			? error.message.toLowerCase()
			: String(error).toLowerCase();
	const statusMatch = message.match(/\b([45]\d{2})\b/);
	const status = statusMatch ? Number(statusMatch[1]) : null;
	if (status === 429 || (status !== null && status >= 500)) {
		return true;
	}
	return (
		message.includes("too many requests") ||
		message.includes("rate limit") ||
		message.includes("service unavailable") ||
		message.includes("bad gateway") ||
		message.includes("gateway timeout")
	);
};

const fetchFixturesWithRetry = async (
	leagueId: number,
	season: number,
	apiUrl?: string,
	apiKey?: string,
): Promise<FixturesResponse> => {
	for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
		try {
			return await getFootballApiFixturesByLeagueSeason(
				leagueId,
				season,
				apiUrl,
				apiKey,
			);
		} catch (error) {
			if (attempt >= MAX_RETRIES || !shouldRetryRequest(error)) {
				throw error;
			}
			const delay = RETRY_BASE_MS * 2 ** attempt;
			console.warn(
				`⚠️ [Calibration] Retry ${attempt + 1}/${MAX_RETRIES} for league=${leagueId} season=${season} in ${delay}ms.`,
			);
			await sleep(delay);
		}
	}
};

const fetchH2HMatchesWithRetry = async (
	homeId: number,
	awayId: number,
	apiUrl?: string,
	apiKey?: string,
): Promise<Fixture[]> => {
	if (!apiUrl || !apiKey) {
		throw new Error("API URL or API Key not provided");
	}

	const url = new URL(`${apiUrl}/fixtures/headtohead`);
	url.searchParams.append("h2h", `${homeId}-${awayId}`);
	url.searchParams.append("last", String(H2H_API_LIMIT));

	for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
		try {
			const response = await fetch(url.toString(), {
				headers: {
					"x-rapidapi-host": "api-football-v1.p.rapidapi.com",
					"x-rapidapi-key": apiKey,
				},
			});
			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(
					`API request failed: ${response.statusText} - ${errorText}`,
				);
			}
			const data = (await response.json()) as FixturesResponse;
			if (data.errors && Array.isArray(data.errors) && data.errors.length > 0) {
				throw new Error(`API returned errors: ${JSON.stringify(data.errors)}`);
			}
			return data.response ?? [];
		} catch (error) {
			if (attempt >= MAX_RETRIES || !shouldRetryRequest(error)) {
				throw error;
			}
			const delay = RETRY_BASE_MS * 2 ** attempt;
			console.warn(
				`⚠️ [Calibration] Retry ${attempt + 1}/${MAX_RETRIES} for h2h ${homeId}-${awayId} in ${delay}ms.`,
			);
			await sleep(delay);
		}
	}

	throw new Error("Failed to fetch H2H after retries.");
};

const loadPriorsPayload = (payloadPath: string): UefaPriorsPayload => {
	const content = readFileSync(payloadPath, "utf-8");
	const parsed = JSON.parse(content);
	return parsed as UefaPriorsPayload;
};

const buildPriorsIndex = (payload: UefaPriorsPayload) => {
	const association = new Map<string, number | null>();
	for (const assoc of payload.associations) {
		association.set(assoc.countryCode, assoc.coefficient5y ?? null);
	}

	const clubCoeff = new Map<
		string,
		{ coefficient: number | null; countryCode: string | null }
	>();
	for (const club of payload.clubs) {
		clubCoeff.set(club.uefaClubKey, {
			coefficient: club.coefficient ?? null,
			countryCode: club.countryCode ?? null,
		});
	}

	const teamToClub = new Map<number, string>();
	for (const map of payload.clubTeamMap) {
		teamToClub.set(map.apiFootballTeamId, map.uefaClubKey);
	}

	return { association, clubCoeff, teamToClub };
};

const resolveStartingElo = (params: {
	apiFootballTeamId: number;
	priors: ReturnType<typeof buildPriorsIndex>;
	leagueName?: string | null;
	applyDivisionOffset: boolean;
}): number => {
	const clubKey = params.priors.teamToClub.get(params.apiFootballTeamId);
	const divisionOffset = params.applyDivisionOffset
		? calculateDivisionOffset(inferDivisionLevel(params.leagueName))
		: 0;
	if (!clubKey) {
		return calculateStartingElo({ divisionOffset });
	}

	const club = params.priors.clubCoeff.get(clubKey);
	const assocCoeff = club?.countryCode
		? params.priors.association.get(club.countryCode)
		: null;

	return calculateStartingElo({
		associationCoefficient5y: assocCoeff ?? null,
		clubCoefficient: club?.coefficient ?? null,
		divisionOffset,
	});
};

const normalizeDate = (value: string) => value.split("T")[0] ?? value;

const getActualOutcome = (fixture: Fixture): EvalRow["actual"] => {
	const home = fixture.goals.home ?? 0;
	const away = fixture.goals.away ?? 0;
	if (home > away) return "HOME";
	if (home < away) return "AWAY";
	return "DRAW";
};

const toProb = (value?: number) => {
	const raw = Number.isFinite(value) ? Number(value) : NaN;
	const normalized = Number.isFinite(raw) ? raw / 100 : 0;
	const clamped = Math.max(0, Math.min(1, normalized));
	if (!Number.isFinite(raw) || raw < 0 || raw > 100 || clamped !== normalized) {
		console.warn(
			`⚠️ [Calibration] Invalid probability value ${String(value)}; clamped to ${clamped}.`,
		);
	}
	return clamped;
};

const buildProcessedMatch = (
	fixture: Fixture,
	teamId: number,
): ProcessedMatch =>
	insightsService.convertToProcessedMatch(
		fixture as Parameters<typeof insightsService.convertToProcessedMatch>[0],
		teamId,
	);

const buildStatsFromMatches = (matches: ProcessedMatch[]) => {
	if (!matches.length) return null;

	const formatAvg = (value: number) => value.toFixed(2);
	const home = matches.filter((m) => m.isHome);
	const away = matches.filter((m) => !m.isHome);

	const sum = (values: number[]) => values.reduce((acc, val) => acc + val, 0);
	const avg = (values: number[]) =>
		values.length > 0 ? sum(values) / values.length : 0;

	const goalsFor = sum(matches.map((m) => m.goalsScored));
	const goalsAgainst = sum(matches.map((m) => m.goalsConceded));
	const form = matches
		.slice(0, 5)
		.map((m) => m.result)
		.join("");

	const cleanSheets = matches.filter((m) => m.goalsConceded === 0).length;
	const failedToScore = matches.filter((m) => m.goalsScored === 0).length;

	return {
		form,
		fixtures: {
			played: {
				total: matches.length,
				home: home.length,
				away: away.length,
			},
		},
		goals: {
			for: {
				total: { total: goalsFor },
				average: {
					total: formatAvg(avg(matches.map((m) => m.goalsScored))),
					home: formatAvg(avg(home.map((m) => m.goalsScored))),
					away: formatAvg(avg(away.map((m) => m.goalsScored))),
				},
			},
			against: {
				total: { total: goalsAgainst },
				average: {
					total: formatAvg(avg(matches.map((m) => m.goalsConceded))),
					home: formatAvg(avg(home.map((m) => m.goalsConceded))),
					away: formatAvg(avg(away.map((m) => m.goalsConceded))),
				},
			},
		},
		clean_sheet: { total: cleanSheets },
		failed_to_score: { total: failedToScore },
		lineups: [],
	};
};

const initStandings = (teams: Array<{ id: number; name: string }>) => {
	const map = new Map<number, StandingsRow>();
	for (const team of teams) {
		map.set(team.id, {
			teamId: team.id,
			teamName: team.name,
			played: 0,
			win: 0,
			draw: 0,
			loss: 0,
			goalsFor: 0,
			goalsAgainst: 0,
			points: 0,
			formResults: [],
		});
	}
	return map;
};

const updateStandings = (
	standings: Map<number, StandingsRow>,
	teamId: number,
	teamName: string,
	goalsFor: number,
	goalsAgainst: number,
) => {
	const entry =
		standings.get(teamId) ??
		({
			teamId,
			teamName,
			played: 0,
			win: 0,
			draw: 0,
			loss: 0,
			goalsFor: 0,
			goalsAgainst: 0,
			points: 0,
			formResults: [],
		} as StandingsRow);

	entry.teamName = teamName;
	entry.played += 1;
	entry.goalsFor += goalsFor;
	entry.goalsAgainst += goalsAgainst;

	if (goalsFor > goalsAgainst) {
		entry.win += 1;
		entry.points += 3;
		entry.formResults.unshift("W");
	} else if (goalsFor < goalsAgainst) {
		entry.loss += 1;
		entry.formResults.unshift("L");
	} else {
		entry.draw += 1;
		entry.points += 1;
		entry.formResults.unshift("D");
	}

	if (entry.formResults.length > 5) {
		entry.formResults = entry.formResults.slice(0, 5);
	}

	standings.set(teamId, entry);
};

const buildStandingsSnapshot = (
	standings: Map<number, StandingsRow>,
	leagueSize: number,
) => {
	const rows = Array.from(standings.values()).map((row) => ({
		...row,
		goalDiff: row.goalsFor - row.goalsAgainst,
	}));

	rows.sort((a, b) => {
		if (b.points !== a.points) return b.points - a.points;
		if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
		if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
		return a.teamId - b.teamId;
	});

	const firstPlacePoints = rows[0]?.points ?? 0;
	const clPosition = Math.min(4, leagueSize);
	const relegationPosition = Math.max(leagueSize - 2, 1);
	const clPoints = rows[clPosition - 1]?.points ?? firstPlacePoints;
	const relegationPoints = rows[relegationPosition - 1]?.points ?? 0;

	const rankById = new Map<number, number>();
	for (const [idx, row] of rows.entries()) {
		rankById.set(row.teamId, idx + 1);
	}

	return { rows, rankById, firstPlacePoints, clPoints, relegationPoints };
};

const getTeamStandingsData = (
	snapshot: ReturnType<typeof buildStandingsSnapshot>,
	teamId: number,
): TeamStandingsData | null => {
	const row = snapshot.rows.find((entry) => entry.teamId === teamId);
	if (!row) return null;
	return {
		rank: snapshot.rankById.get(teamId) ?? row.rank ?? 1,
		points: row.points,
		played: row.played,
		win: row.win,
		draw: row.draw,
		loss: row.loss,
		goalsFor: row.goalsFor,
		goalsAgainst: row.goalsAgainst,
		goalDiff: row.goalDiff,
		form: row.formResults.length > 0 ? row.formResults.join("") : null,
		pointsFromFirst: snapshot.firstPlacePoints - row.points,
		pointsFromCL: snapshot.clPoints - row.points,
		pointsFromRelegation: row.points - snapshot.relegationPoints,
	};
};

const computeLeagueStats = (fixtures: Fixture[]) => {
	let goals = 0;
	let matches = 0;
	for (const fixture of fixtures) {
		if (!FINISHED_STATUSES.has(fixture.fixture.status.short)) continue;
		if (fixture.goals.home === null || fixture.goals.away === null) continue;
		goals += fixture.goals.home + fixture.goals.away;
		matches += 1;
	}
	return {
		avgGoals: matches > 0 ? goals / matches : 0,
		matches,
	};
};

const main = async () => {
	const args = process.argv.slice(2);
	const leagueIds = parseLeagueIds(parseArg(args, "--league-ids"));
	const seasons = parseSeasons(args);
	const outputPath =
		parseArg(args, "--output") ?? resolve(__dirname, "calibration-eval.json");
	const payloadPath =
		parseArg(args, "--payload") ??
		resolve(__dirname, "../../../docs/plans/uefa-priors-payload.json");

	if (!leagueIds.length || !seasons.length) {
		throw new Error(
			"Usage: --league-ids 39,140 --seasons 2024,2025 [--payload path] [--output path] (or --from-season 2024 --to-season 2025)",
		);
	}

	const payload = loadPriorsPayload(payloadPath);
	const priors = buildPriorsIndex(payload);

	const apiUrl = process.env.FOOTBALL_API_URL;
	const apiKey = process.env.RAPIDAPI_KEY;

	const evalRows: EvalRow[] = [];

	for (const leagueId of leagueIds) {
		for (const season of seasons) {
			const data = await fetchFixturesWithRetry(
				leagueId,
				season,
				apiUrl,
				apiKey,
			);
			await sleep(REQUEST_DELAY_MS);

			const fixtures = (data.response ?? [])
				.filter((fixture) =>
					FINISHED_STATUSES.has(fixture.fixture.status.short),
				)
				.filter(
					(fixture) =>
						fixture.goals.home !== null && fixture.goals.away !== null,
				)
				.sort(
					(a, b) =>
						new Date(a.fixture.date).getTime() -
						new Date(b.fixture.date).getTime(),
				);

			if (!fixtures.length) {
				continue;
			}

			const teamMap = new Map<number, string>();
			for (const fixture of fixtures) {
				teamMap.set(fixture.teams.home.id, fixture.teams.home.name);
				teamMap.set(fixture.teams.away.id, fixture.teams.away.name);
			}
			const leagueSize = teamMap.size;
			const standings = initStandings(
				Array.from(teamMap.entries()).map(([id, name]) => ({ id, name })),
			);

			const leagueStats = computeLeagueStats(fixtures);
			const teamHistory = new Map<number, ProcessedMatch[]>();
			const h2hCache = new Map<string, Fixture[]>();
			const eloState = new Map<number, EloState>();

			for (const fixture of fixtures) {
				const homeId = fixture.teams.home.id;
				const awayId = fixture.teams.away.id;
				const key =
					homeId < awayId ? `${homeId}-${awayId}` : `${awayId}-${homeId}`;

				const homeMatches = teamHistory.get(homeId) ?? [];
				const awayMatches = teamHistory.get(awayId) ?? [];

				const matchType = detectMatchType(fixture.league.name);
				const applyDivisionOffset = matchType === "LEAGUE";
				const homeEloState = eloState.get(homeId) ?? {
					elo: resolveStartingElo({
						apiFootballTeamId: homeId,
						priors,
						leagueName: fixture.league.name,
						applyDivisionOffset,
					}),
					games: 0,
					asOf: fixture.fixture.date,
				};
				const awayEloState = eloState.get(awayId) ?? {
					elo: resolveStartingElo({
						apiFootballTeamId: awayId,
						priors,
						leagueName: fixture.league.name,
						applyDivisionOffset,
					}),
					games: 0,
					asOf: fixture.fixture.date,
				};

				{
					const standingsSnapshot = buildStandingsSnapshot(
						standings,
						leagueSize,
					);
					const homeStandings = getTeamStandingsData(
						standingsSnapshot,
						homeId,
					);
					const awayStandings = getTeamStandingsData(
						standingsSnapshot,
						awayId,
					);

					let h2hRaw = h2hCache.get(key);
					if (!h2hRaw) {
						h2hRaw = await fetchH2HMatchesWithRetry(
							homeId,
							awayId,
							apiUrl,
							apiKey,
						);
						h2hRaw = h2hRaw
							.filter((match) =>
								FINISHED_STATUSES.has(match.fixture.status.short),
							)
							.sort(
								(a, b) =>
									new Date(b.fixture.date).getTime() -
									new Date(a.fixture.date).getTime(),
							);
						h2hCache.set(key, h2hRaw);
						await sleep(REQUEST_DELAY_MS);
					}

					const fixtureTime = new Date(fixture.fixture.date).getTime();
					const h2hMatches = h2hRaw
						.filter(
							(match) => new Date(match.fixture.date).getTime() <= fixtureTime,
						)
						.slice(0, H2H_MODEL_LIMIT)
						.map((match) => buildProcessedMatch(match, homeId));
					const h2hData = processH2HData(h2hMatches, homeId, awayId);

					const homeElo = {
						rating: homeEloState.elo,
						games: homeEloState.games,
						asOf: homeEloState.asOf,
						confidence: calculateEloConfidence(homeEloState.games),
					};
					const awayElo = {
						rating: awayEloState.elo,
						games: awayEloState.games,
						asOf: awayEloState.asOf,
						confidence: calculateEloConfidence(awayEloState.games),
					};

					const homeTeam = insightsService.processTeamData(
						homeId,
						fixture.teams.home.name,
						(buildStatsFromMatches(homeMatches) ?? null) as unknown,
						homeMatches,
						leagueId,
						homeStandings,
						homeElo,
					);
					const awayTeam = insightsService.processTeamData(
						awayId,
						fixture.teams.away.name,
						(buildStatsFromMatches(awayMatches) ?? null) as unknown,
						awayMatches,
						leagueId,
						awayStandings,
						awayElo,
					);

					const roundNumber = extractRoundNumber(fixture.league.round);
					const context = buildMatchContext(
						fixture.league.name,
						fixture.league.round,
						homeId,
						awayId,
						fixture.teams.home.name,
						fixture.teams.away.name,
						{
							roundNumber,
							homeTeamData: homeTeam,
							awayTeamData: awayTeam,
							daysSinceLastMatch: Math.min(
								homeTeam.daysSinceLastMatch,
								awayTeam.daysSinceLastMatch,
							),
						},
					);

					const distributionModifiers = buildGoalDistributionModifiers({
						context,
						homeTeam,
						awayTeam,
						h2h: h2hData,
						leagueStats,
					});

					const simulation = simulateMatchOutcome(
						homeTeam,
						awayTeam,
						h2hData,
						context,
						undefined,
						undefined,
						distributionModifiers,
						{ skipCalibration: true },
					);

					evalRows.push({
						fixtureId: fixture.fixture.id,
						date: normalizeDate(fixture.fixture.date),
						leagueId,
						season,
						matchType: context.matchType.type,
						probHomeWin: toProb(simulation.probabilityDistribution.home),
						probDraw: toProb(simulation.probabilityDistribution.draw),
						probAwayWin: toProb(simulation.probabilityDistribution.away),
						actual: getActualOutcome(fixture),
					});
				}

				const goalDiff = (fixture.goals.home ?? 0) - (fixture.goals.away ?? 0);
				const update = updateElo({
					homeElo: homeEloState.elo,
					awayElo: awayEloState.elo,
					matchType,
					goalDiff,
				});
				const nextHome: EloState = {
					elo: update.homeElo,
					games: homeEloState.games + 1,
					asOf: fixture.fixture.date,
				};
				const nextAway: EloState = {
					elo: update.awayElo,
					games: awayEloState.games + 1,
					asOf: fixture.fixture.date,
				};
				eloState.set(homeId, nextHome);
				eloState.set(awayId, nextAway);

				const processedHome = buildProcessedMatch(fixture, homeId);
				const processedAway = buildProcessedMatch(fixture, awayId);
				const nextHomeHistory = [processedHome, ...homeMatches].slice(
					0,
					MAX_MATCH_HISTORY,
				);
				const nextAwayHistory = [processedAway, ...awayMatches].slice(
					0,
					MAX_MATCH_HISTORY,
				);
				teamHistory.set(homeId, nextHomeHistory);
				teamHistory.set(awayId, nextAwayHistory);

				const homeGoals = fixture.goals.home ?? 0;
				const awayGoals = fixture.goals.away ?? 0;
				updateStandings(
					standings,
					homeId,
					fixture.teams.home.name,
					homeGoals,
					awayGoals,
				);
				updateStandings(
					standings,
					awayId,
					fixture.teams.away.name,
					awayGoals,
					homeGoals,
				);
			}
		}
	}

	writeFileSync(outputPath, JSON.stringify(evalRows, null, 2));
	console.log(
		`✅ [Calibration] Wrote ${evalRows.length} rows to ${outputPath}`,
	);
};

main().catch((error) => {
	console.error("❌ [Calibration] Export failed:", error);
	process.exit(1);
});

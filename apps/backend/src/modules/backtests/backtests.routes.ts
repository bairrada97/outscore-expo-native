/**
 * Backtest Routes (minimal harness)
 *
 * Provides an admin-triggered backtest runner that persists artifacts to R2
 * and stores run metadata in D1.
 */

import { zValidator } from "@hono/zod-validator";
import type { Fixture } from "@outscore/shared-types";
import { Hono } from "hono";
import { z } from "zod";
import { getFootballApiFixturesByLeagueSeason } from "../../pkg/util/football-api";
import {
	insightsService,
	type ProcessedMatch,
	simulateBTTS,
	simulateTotalGoalsOverUnder,
} from "../betting-insights";
import { buildMatchContext } from "../betting-insights/match-context/context-adjustments";
import { buildGoalDistributionModifiers } from "../betting-insights/simulations/goal-distribution-modifiers";
import type { GoalLine, Simulation } from "../betting-insights/types";
import { processH2HData } from "../betting-insights/utils/h2h-helpers";
import { extractRoundNumber } from "../betting-insights/utils/helpers";
import type { CacheEnv } from "../cache/cache-manager";

type BacktestEnv = CacheEnv & {
	FOOTBALL_API_URL: string;
	RAPIDAPI_KEY: string;
	ADMIN_CACHE_TOKEN?: string;
};

type BacktestMarket = "btts" | "total-goals";

type RunConfig = {
	leagueIds: number[];
	seasons: number[];
	markets: BacktestMarket[];
	line: GoalLine;
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

type StandingsSnapshot = {
	rows: StandingsRow[];
	rankById: Map<number, number>;
	firstPlacePoints: number;
	clPoints: number;
	relegationPoints: number;
};

type TeamStatsInput = Parameters<typeof insightsService.processTeamData>[2];

const FINISHED_STATUSES = new Set(["FT", "AET", "PEN"]);
const REQUEST_DELAY_MS = 250;
const H2H_API_LIMIT = 25;
const H2H_MODEL_LIMIT = 5;
const CALIBRATION_BINS = 10;

const runSchema = z.object({
	leagueIds: z.array(z.number().int().positive()).min(1),
	seasons: z.array(z.number().int()).min(1),
	markets: z
		.array(z.enum(["btts", "total-goals"]))
		.default(["btts", "total-goals"]),
	line: z
		.number()
		.optional()
		.default(2.5)
		.refine((value) => [0.5, 1.5, 2.5, 3.5, 4.5, 5.5].includes(value), {
			message: "line must be one of 0.5, 1.5, 2.5, 3.5, 4.5, 5.5",
		}),
});

const listSchema = z.object({
	limit: z
		.string()
		.optional()
		.transform((val) => (val ? Number(val) : 20))
		.refine((val) => Number.isFinite(val) && val > 0 && val <= 100),
});

const buildRunId = () =>
	`bt_${new Date().toISOString().replace(/[:.]/g, "-")}_${Math.random()
		.toString(36)
		.slice(2, 8)}`;

const requireAdminToken = (
	headerValue: string | undefined,
	expected: string | undefined,
): boolean => {
	if (!expected) return false;
	if (!headerValue) return false;
	return headerValue === expected;
};

const buildProcessedMatch = (
	fixture: Parameters<typeof insightsService.convertToProcessedMatch>[0],
	teamId: number,
): ProcessedMatch =>
	insightsService.convertToProcessedMatch(fixture, teamId) as ProcessedMatch;

const buildStatsFromMatches = (
	matches: ProcessedMatch[],
	meta: { teamId: number; teamName: string; leagueId: number; leagueName: string; season: number },
): TeamStatsInput => {
	if (!matches.length) return null;

	const formatAvg = (value: number) => value.toFixed(2);
	const home = matches.filter((m) => m.isHome);
	const away = matches.filter((m) => !m.isHome);
	const sum = (values: number[]) => values.reduce((acc, val) => acc + val, 0);
	const avg = (values: number[]) =>
		values.length > 0 ? sum(values) / values.length : 0;

	const goalsFor = sum(matches.map((m) => m.goalsScored));
	const goalsAgainst = sum(matches.map((m) => m.goalsConceded));
	const cleanSheets = matches.filter((m) => m.goalsConceded === 0).length;
	const failedToScore = matches.filter((m) => m.goalsScored === 0).length;
	const wins = matches.filter((m) => m.result === "W");
	const draws = matches.filter((m) => m.result === "D");
	const losses = matches.filter((m) => m.result === "L");
	const winsHome = wins.filter((m) => m.isHome).length;
	const winsAway = wins.filter((m) => !m.isHome).length;
	const drawsHome = draws.filter((m) => m.isHome).length;
	const drawsAway = draws.filter((m) => !m.isHome).length;
	const lossesHome = losses.filter((m) => m.isHome).length;
	const lossesAway = losses.filter((m) => !m.isHome).length;

	const goalsForHome = sum(home.map((m) => m.goalsScored));
	const goalsForAway = sum(away.map((m) => m.goalsScored));
	const goalsAgainstHome = sum(home.map((m) => m.goalsConceded));
	const goalsAgainstAway = sum(away.map((m) => m.goalsConceded));

	return {
		team: { id: meta.teamId, name: meta.teamName },
		league: { id: meta.leagueId, name: meta.leagueName, season: meta.season },
		form: matches
			.slice(0, 5)
			.map((m) => m.result)
			.join(""),
		fixtures: {
			played: {
				total: matches.length,
				home: home.length,
				away: away.length,
			},
			wins: {
				total: wins.length,
				home: winsHome,
				away: winsAway,
			},
			draws: {
				total: draws.length,
				home: drawsHome,
				away: drawsAway,
			},
			loses: {
				total: losses.length,
				home: lossesHome,
				away: lossesAway,
			},
		},
		goals: {
			for: {
				total: { total: goalsFor, home: goalsForHome, away: goalsForAway },
				average: {
					total: formatAvg(avg(matches.map((m) => m.goalsScored))),
					home: formatAvg(avg(home.map((m) => m.goalsScored))),
					away: formatAvg(avg(away.map((m) => m.goalsScored))),
				},
			},
			against: {
				total: {
					total: goalsAgainst,
					home: goalsAgainstHome,
					away: goalsAgainstAway,
				},
				average: {
					total: formatAvg(avg(matches.map((m) => m.goalsConceded))),
					home: formatAvg(avg(home.map((m) => m.goalsConceded))),
					away: formatAvg(avg(away.map((m) => m.goalsConceded))),
				},
			},
		},
		clean_sheet: { total: cleanSheets, home: 0, away: 0 },
		failed_to_score: { total: failedToScore, home: 0, away: 0 },
	};
};

const initStandings = (teams: Array<{ id: number; name: string }>) => {
	const rows = teams.map((team) => ({
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
	}));
	return new Map(rows.map((row) => [row.teamId, row]));
};

const updateStandings = (
	standings: Map<number, StandingsRow>,
	teamId: number,
	teamName: string,
	goalsFor: number,
	goalsAgainst: number,
) => {
	const row = standings.get(teamId) ?? {
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
	};

	row.played += 1;
	row.goalsFor += goalsFor;
	row.goalsAgainst += goalsAgainst;

	if (goalsFor > goalsAgainst) {
		row.win += 1;
		row.points += 3;
		row.formResults.unshift("W");
	} else if (goalsFor < goalsAgainst) {
		row.loss += 1;
		row.formResults.unshift("L");
	} else {
		row.draw += 1;
		row.points += 1;
		row.formResults.unshift("D");
	}

	row.formResults = row.formResults.slice(0, 5);
	standings.set(teamId, row);
};

const buildStandingsSnapshot = (
	standings: Map<number, StandingsRow>,
	leagueSize: number,
): StandingsSnapshot => {
	const rows = Array.from(standings.values()).sort((a, b) => {
		if (a.points !== b.points) return b.points - a.points;
		const gdA = a.goalsFor - a.goalsAgainst;
		const gdB = b.goalsFor - b.goalsAgainst;
		if (gdA !== gdB) return gdB - gdA;
		return b.goalsFor - a.goalsFor;
	});

	const rankById = new Map<number, number>();
	for (const [index, row] of rows.entries()) {
		rankById.set(row.teamId, index + 1);
	}

	const clPosition = Math.max(1, Math.min(4, leagueSize));
	const relegationPosition = Math.max(leagueSize - 2, 1);
	const firstPlacePoints = rows[0]?.points ?? 0;
	const clPoints = rows[clPosition - 1]?.points ?? 0;
	const relegationPoints = rows[relegationPosition - 1]?.points ?? 0;

	return {
		rows,
		rankById,
		firstPlacePoints,
		clPoints,
		relegationPoints,
	};
};

const getTeamStandingsData = (
	snapshot: StandingsSnapshot,
	teamId: number,
): TeamStandingsData => {
	const row = snapshot.rows.find((entry) => entry.teamId === teamId);
	if (!row) {
		return {
			rank: snapshot.rankById.get(teamId) ?? 1,
			points: 0,
			played: 0,
			win: 0,
			draw: 0,
			loss: 0,
			goalsFor: 0,
			goalsAgainst: 0,
			goalDiff: 0,
			form: null,
			pointsFromFirst: snapshot.firstPlacePoints,
			pointsFromCL: snapshot.clPoints,
			pointsFromRelegation: snapshot.relegationPoints,
		};
	}

	return {
		rank: snapshot.rankById.get(teamId) ?? 1,
		points: row.points,
		played: row.played,
		win: row.win,
		draw: row.draw,
		loss: row.loss,
		goalsFor: row.goalsFor,
		goalsAgainst: row.goalsAgainst,
		goalDiff: row.goalsFor - row.goalsAgainst,
		form: row.formResults.join(""),
		pointsFromFirst: snapshot.firstPlacePoints - row.points,
		pointsFromCL: snapshot.clPoints - row.points,
		pointsFromRelegation: row.points - snapshot.relegationPoints,
	};
};

const buildBins = (values: Array<{ prob: number; actual: boolean }>) => {
	const bins = Array.from({ length: CALIBRATION_BINS }, (_, index) => ({
		name: `${index / CALIBRATION_BINS}-${(index + 1) / CALIBRATION_BINS}`,
		count: 0,
		avgProb: 0,
		avgActual: 0,
	}));

	for (const value of values) {
		const idx = Math.min(
			CALIBRATION_BINS - 1,
			Math.floor(value.prob * CALIBRATION_BINS),
		);
		const bin = bins[idx];
		if (!bin) continue;
		bin.count += 1;
		bin.avgProb += value.prob;
		bin.avgActual += value.actual ? 1 : 0;
	}

	for (const bin of bins) {
		if (bin.count > 0) {
			bin.avgProb /= bin.count;
			bin.avgActual /= bin.count;
		}
	}

	return bins;
};

const brier = (values: Array<{ prob: number; actual: boolean }>) => {
	if (!values.length) return 0;
	let sum = 0;
	for (const row of values) {
		const target = row.actual ? 1 : 0;
		sum += (row.prob - target) ** 2;
	}
	return sum / values.length;
};

const logLoss = (values: Array<{ prob: number; actual: boolean }>) => {
	if (!values.length) return 0;
	let sum = 0;
	for (const row of values) {
		const p = Math.max(1e-6, Math.min(1 - 1e-6, row.prob));
		const target = row.actual ? 1 : 0;
		const use = target ? p : 1 - p;
		sum += -Math.log(use);
	}
	return sum / values.length;
};

const writeR2Json = async (env: BacktestEnv, key: string, value: unknown) => {
	await env.FOOTBALL_CACHE.put(key, JSON.stringify(value), {
		httpMetadata: { contentType: "application/json" },
	});
};

const writeR2Text = async (env: BacktestEnv, key: string, value: string) => {
	await env.FOOTBALL_CACHE.put(key, value, {
		httpMetadata: { contentType: "text/plain" },
	});
};

const runBacktest = async (env: BacktestEnv, config: RunConfig) => {
	const runId = buildRunId();
	const r2Prefix = `backtests/${runId}`;
	const anomalies: Array<Record<string, unknown>> = [];
	const anomalyCounts = new Map<string, number>();

	const marketStats: Record<
		string,
		{
			samples: Array<{ prob: number; actual: boolean }>;
			reliability: Record<string, number>;
		}
	> = {};

	for (const market of config.markets) {
		marketStats[market] = {
			samples: [],
			reliability: { HIGH: 0, MEDIUM: 0, LOW: 0 },
		};
	}

	for (const leagueId of config.leagueIds) {
		for (const season of config.seasons) {
			const data = await getFootballApiFixturesByLeagueSeason(
				leagueId,
				season,
				env.FOOTBALL_API_URL,
				env.RAPIDAPI_KEY,
			);
			await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS));

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

			if (!fixtures.length) continue;

			const teamHistory = new Map<number, ProcessedMatch[]>();
			const h2hCache = new Map<string, Fixture[]>();
			const teamMap = new Map<number, string>();
			for (const fixture of fixtures) {
				teamMap.set(fixture.teams.home.id, fixture.teams.home.name);
				teamMap.set(fixture.teams.away.id, fixture.teams.away.name);
			}
			const standings = initStandings(
				Array.from(teamMap.entries()).map(([id, name]) => ({ id, name })),
			);
			const leagueSize = teamMap.size;

			for (const fixture of fixtures) {
				const homeId = fixture.teams.home.id;
				const awayId = fixture.teams.away.id;
				const homeMatches = teamHistory.get(homeId) ?? [];
				const awayMatches = teamHistory.get(awayId) ?? [];

				const standingsSnapshot = buildStandingsSnapshot(standings, leagueSize);
				const homeStandings = getTeamStandingsData(standingsSnapshot, homeId);
				const awayStandings = getTeamStandingsData(standingsSnapshot, awayId);

				const roundNumber =
					extractRoundNumber(fixture.league.round) ?? undefined;

				const key =
					homeId < awayId ? `${homeId}-${awayId}` : `${awayId}-${homeId}`;
				let h2hMatches = h2hCache.get(key);
				if (!h2hMatches) {
					const url = new URL(`${env.FOOTBALL_API_URL}/fixtures/headtohead`);
					url.searchParams.append("h2h", `${homeId}-${awayId}`);
					url.searchParams.append("last", String(H2H_API_LIMIT));
					const response = await fetch(url.toString(), {
						headers: {
							"x-rapidapi-host": "api-football-v1.p.rapidapi.com",
							"x-rapidapi-key": env.RAPIDAPI_KEY,
						},
					});
					if (!response.ok) {
						const body = await response.text().catch(() => "");
						console.warn(
							`[Backtests] H2H fetch failed (${response.status} ${response.statusText}) for ${url.toString()}${body ? `: ${body}` : ""}`,
						);
						h2hMatches = [];
					} else {
						const json = (await response.json()) as {
							response?: Fixture[];
						};
						if (!Array.isArray(json.response)) {
							console.warn(
								`[Backtests] H2H response missing data for ${url.toString()}`,
							);
							h2hMatches = [];
						} else {
							h2hMatches = json.response;
							h2hCache.set(key, h2hMatches);
						}
					}
					await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS));
				}

				const fixtureTime = new Date(fixture.fixture.date).getTime();
				const processedH2H = (h2hMatches ?? [])
					.filter((match) =>
						FINISHED_STATUSES.has(match.fixture.status.short),
					)
					.filter(
						(match) =>
							new Date(match.fixture.date).getTime() < fixtureTime &&
							match.fixture.id !== fixture.fixture.id,
					)
					.sort(
						(a, b) =>
							new Date(b.fixture.date).getTime() -
							new Date(a.fixture.date).getTime(),
					)
					.slice(0, H2H_MODEL_LIMIT)
					.map((match) => buildProcessedMatch(match, homeId));

				const h2hData = processH2HData(processedH2H, homeId, awayId);

				const homeStats = buildStatsFromMatches(homeMatches, {
					teamId: homeId,
					teamName: fixture.teams.home.name,
					leagueId,
					leagueName: fixture.league.name,
					season,
				});
				const awayStats = buildStatsFromMatches(awayMatches, {
					teamId: awayId,
					teamName: fixture.teams.away.name,
					leagueId,
					leagueName: fixture.league.name,
					season,
				});

				const homeTeam = insightsService.processTeamData(
					homeId,
					fixture.teams.home.name,
					homeStats,
					homeMatches,
					leagueId,
					homeStandings,
				);
				const awayTeam = insightsService.processTeamData(
					awayId,
					fixture.teams.away.name,
					awayStats,
					awayMatches,
					leagueId,
					awayStandings,
				);

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
					},
				);

				const distributionModifiers = buildGoalDistributionModifiers({
					context,
					homeTeam,
					awayTeam,
					h2h: h2hData,
					leagueStats: undefined,
				});

				const warnings = [
					...insightsService.validateTeamStatsSanity(homeTeam, awayTeam),
				];

				const simulations: Simulation[] = [];

				if (config.markets.includes("btts")) {
					const sim = simulateBTTS(
						homeTeam,
						awayTeam,
						h2hData,
						context,
						undefined,
						distributionModifiers,
					);
					simulations.push(sim);
					marketStats.btts.samples.push({
						prob: (sim.probabilityDistribution.yes ?? 0) / 100,
						actual:
							(fixture.goals.home ?? 0) > 0 && (fixture.goals.away ?? 0) > 0,
					});
					marketStats.btts.reliability[sim.modelReliability] += 1;
				}

				if (config.markets.includes("total-goals")) {
					const sim = simulateTotalGoalsOverUnder(
						homeTeam,
						awayTeam,
						h2hData,
						context,
						config.line,
						undefined,
						distributionModifiers,
					);
					simulations.push(sim);
					marketStats["total-goals"].samples.push({
						prob: (sim.probabilityDistribution.over ?? 0) / 100,
						actual:
							(fixture.goals.home ?? 0) + (fixture.goals.away ?? 0) >
							config.line,
					});
					marketStats["total-goals"].reliability[sim.modelReliability] += 1;
				}

				warnings.push(...insightsService.validateSimulationSanity(simulations));

				if (warnings.length > 0) {
					anomalies.push({
						fixtureId: fixture.fixture.id,
						leagueId,
						season,
						date: fixture.fixture.date,
						warnings,
					});
					for (const warning of warnings) {
						anomalyCounts.set(warning, (anomalyCounts.get(warning) ?? 0) + 1);
					}
				}

				const processedHome = buildProcessedMatch(fixture, homeId);
				const processedAway = buildProcessedMatch(fixture, awayId);
				teamHistory.set(homeId, [processedHome, ...homeMatches].slice(0, 50));
				teamHistory.set(awayId, [processedAway, ...awayMatches].slice(0, 50));

				updateStandings(
					standings,
					homeId,
					fixture.teams.home.name,
					fixture.goals.home ?? 0,
					fixture.goals.away ?? 0,
				);
				updateStandings(
					standings,
					awayId,
					fixture.teams.away.name,
					fixture.goals.away ?? 0,
					fixture.goals.home ?? 0,
				);
			}
		}
	}

	const metrics: Record<string, unknown> = {};
	for (const market of config.markets) {
		const samples = marketStats[market].samples;
		metrics[market] = {
			brier: brier(samples),
			logloss: logLoss(samples),
			bins: buildBins(samples),
			confidenceCoverage: marketStats[market].reliability,
			sampleCount: samples.length,
		};
	}

	const summary = Object.fromEntries(
		Array.from(anomalyCounts.entries()).map(([key, count]) => [key, count]),
	);

	await writeR2Json(env, `${r2Prefix}/metrics.json`, metrics);
	await writeR2Json(env, `${r2Prefix}/config.json`, config);
	await writeR2Json(env, `${r2Prefix}/anomalies_summary.json`, summary);
	await writeR2Text(
		env,
		`${r2Prefix}/anomalies.jsonl`,
		anomalies.map((row) => JSON.stringify(row)).join("\n"),
	);

	await env.ENTITIES_DB.prepare(
		`INSERT INTO backtest_runs (run_id, created_at, r2_prefix, config_json, metrics_json)
		 VALUES (?, ?, ?, ?, ?)`,
	)
		.bind(
			runId,
			new Date().toISOString(),
			r2Prefix,
			JSON.stringify(config),
			JSON.stringify(metrics),
		)
		.run();

	return { runId, r2Prefix, metrics };
};

export const createBacktestsRoutes = () => {
	const backtests = new Hono<{ Bindings: BacktestEnv }>();

	backtests.post("/run", zValidator("json", runSchema), async (context) => {
		const token = context.req.header("x-admin-token");
		if (!requireAdminToken(token, context.env.ADMIN_CACHE_TOKEN)) {
			return context.json(
				{
					status: "error",
					message: "Unauthorized",
				},
				401,
			);
		}
		const config = context.req.valid("json");
		const line = (config.line ?? 2.5) as GoalLine;
		const runConfig: RunConfig = {
			leagueIds: config.leagueIds,
			seasons: config.seasons,
			markets: config.markets,
			line,
		};

		const result = await runBacktest(context.env, runConfig);
		return context.json({ status: "success", data: result });
	});

	backtests.get("/", zValidator("query", listSchema), async (context) => {
		const token = context.req.header("x-admin-token");
		if (!requireAdminToken(token, context.env.ADMIN_CACHE_TOKEN)) {
			return context.json(
				{
					status: "error",
					message: "Unauthorized",
				},
				401,
			);
		}
		const { limit } = context.req.valid("query");
		const rows = await context.env.ENTITIES_DB.prepare(
			"SELECT run_id, created_at, r2_prefix, config_json, metrics_json FROM backtest_runs ORDER BY created_at DESC LIMIT ?",
		)
			.bind(limit)
			.all();
		return context.json({ status: "success", data: rows.results });
	});

	return backtests;
};

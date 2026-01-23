/**
 * Betting Insights Service
 *
 * Main orchestration service for generating betting insights.
 * Coordinates data fetching, pattern detection, and simulations.
 *
 * Reference: docs/implementation-plan/phase5.md
 * Algorithm: docs/betting-insights-Algorithm.md
 */

import type { Fixture } from "@outscore/shared-types";
import type { CacheEnv } from "../../cache";
import {
    cacheGet,
    cacheSet,
    getCacheKey,
    isStale,
    withDeduplication,
} from "../../cache";
import { calculateEloConfidence, calculateStartingElo } from "../../elo";
import {
    createInputsSnapshotJson,
    getCurrentTeamElo,
    getH2HCache,
    getInjuriesCache,
    getLeagueById,
    getLeagueStatsByProviderId,
    getTeamByProviderId,
	getUefaAssociationCoefficient,
	getUefaClubCoefficient,
	getUefaClubKeyForApiTeam,
	getUefaClubKeyForTeam,
    H2H_CACHE_TTL_MS,
    hasInsightsSnapshot,
    type InputsSnapshotData,
    insertInsightsSnapshot,
    makeH2HPairKey,
    resolveExternalId,
    type StandingsCurrentRowInsert,
    type TeamSeasonContextInsert,
    upsertH2HCache,
    upsertInjuriesCache,
    upsertLeague,
	upsertCurrentTeamElo,
    upsertStandings,
    upsertTeam,
    upsertTeamSeasonContext,
} from "../../entities";
import {
    fetchInjuriesForFixture,
    type FixtureInjuries,
    processInjuries,
} from "../data/injuries";
import {
    generateInsights,
    getTopInsights,
} from "../insights/insight-generator";
import type { MatchContext as PredictionMatchContext } from "../match-context/context-adjustments";
import { buildMatchContext } from "../match-context/context-adjustments";
import { detectH2HPatterns } from "../patterns/h2h-patterns";
import {
    detectTeamPatterns,
    getTopPatterns,
    type Pattern,
} from "../patterns/team-patterns";
import { enrichInsights } from "../presentation/insight-enricher";
import { attachInsightPartsToList } from "../presentation/insight-parts";
import { buildKeyInsights } from "../presentation/key-insights-builder";
import { buildMatchFacts } from "../presentation/match-facts-builder";
import { buildModelReliabilityBreakdown } from "../presentation/simulation-presenter";
import { buildGoalDistributionModifiers } from "../simulations/goal-distribution-modifiers";
import { attachRelatedScenarios } from "../simulations/related-scenarios";
import { simulateBTTS } from "../simulations/simulate-btts";
import { simulateFirstHalfActivity } from "../simulations/simulate-first-half-activity";
import { simulateMatchOutcome } from "../simulations/simulate-match-outcome";
import { simulateTotalGoalsOverUnder } from "../simulations/simulate-total-goals-over-under";
import type {
    MatchContext as ApiMatchContext,
    BettingInsightsResponse,
    ConfidenceLevel,
    DataQuality,
    DNALayer,
    GoalLineKey,
    GoalLineOverPctMap,
    H2HData,
    Insight,
    MatchType,
    ProcessedMatch,
    Simulation,
    TeamContext,
    TeamData,
    TeamStatistics,
} from "../types";
import { DEFAULT_GOAL_LINES } from "../types";
import { calculateFormationStabilityContext } from "../utils/formation-helpers";
import { processH2HData } from "../utils/h2h-helpers";
import {
    calculateDaysSinceLastMatch,
    determineMatchResult,
    extractRoundNumber,
    filterNonFriendlyMatches,
} from "../utils/helpers";
import {
    calculateInjuryAdjustments,
    getInjurySituationSummary,
    buildGoalMarketInjuryAdjustments,
} from "../utils/injury-adjustments";
import {
    calculateDNALayer,
    calculateSafetyFlags,
} from "../utils/stats-calculator";
import {
    assessMindDataQuality,
    calculateMindLayer,
    calculateMoodLayer,
} from "../utils/tier-helpers";

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Fixture statuses that indicate the match is finished
 * Insights cannot be generated for finished matches that weren't cached pre-match
 */
const INSIGHTS_FINISHED_STATUSES = [
	"FT", // Full Time
	"AET", // After Extra Time
	"PEN", // Penalty shootout
	"PST", // Postponed
	"CANC", // Cancelled
	"ABD", // Abandoned
	"AWD", // Awarded
	"WO", // Walkover
];

const HIGH_ELO_MIDWEEK_GAP = 150;
const HIGH_ELO_MIDWEEK_MAX_DAYS = 5;
const MIN_RELIABLE_STATS_GAMES = 8;

function getMostRecentTeamMatch(team: TeamData): ProcessedMatch | null {
	const all = [
		...(team.lastHomeMatches ?? []),
		...(team.lastAwayMatches ?? []),
	];
	if (!all.length) return null;
	const sorted = all
		.slice()
		.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
	return sorted[0] ?? null;
}

function isMidweekUTC(dateIso: string): boolean {
	const d = new Date(dateIso);
	const day = d.getUTCDay(); // 0 Sun ... 6 Sat
	return day === 2 || day === 3 || day === 4;
}

function classifyCompetition(
	leagueName: string,
): "international" | "domestic_cup" | "other" {
	const t = (leagueName ?? "").toLowerCase();
	if (
		t.includes("champions league") ||
		t.includes("europa league") ||
		t.includes("conference league") ||
		t.includes("nations league") ||
		t.includes("world cup") ||
		t.includes("copa america") ||
		t.includes("afc champions") ||
		t.includes("caf champions") ||
		t.includes("concacaf") ||
		t.includes("libertadores") ||
		t.includes("sudamericana")
	) {
		return "international";
	}
	if (
		t.includes(" cup") ||
		t.startsWith("cup ") ||
		t.includes("copa") ||
		t.includes("taça") ||
		t.includes("taca") ||
		t.includes("coupe") ||
		t.includes("coppa") ||
		t.includes("pokal") ||
		t.includes("beker")
	) {
		return "domestic_cup";
	}
	return "other";
}

async function buildHighEloOpponentContext(
	db: D1Database,
	team: TeamData,
): Promise<TeamData["recentHighEloOpponent"] | undefined> {
	if (!team.elo) return undefined;
	const last = getMostRecentTeamMatch(team);
	if (!last) return undefined;
	if (!isMidweekUTC(last.date)) return undefined;

	const days = team.daysSinceLastMatch ?? 7;
	if (days > HIGH_ELO_MIDWEEK_MAX_DAYS) return undefined;

	const leagueName = last.league?.name ?? "";
	const kind = classifyCompetition(leagueName);
	if (kind === "other") return undefined;

	const opponentProviderId =
		last.homeTeam.id === team.id ? last.awayTeam.id : last.homeTeam.id;
	const opponentName =
		last.homeTeam.id === team.id ? last.awayTeam.name : last.homeTeam.name;
	const opponentInternalId = await resolveExternalId(
		db,
		"api_football",
		"team",
		opponentProviderId,
	);
	if (!opponentInternalId) return undefined;

	const opponentElo = await getCurrentTeamElo(db, opponentInternalId);
	if (!opponentElo) return undefined;

	const gap = opponentElo.elo - team.elo.rating;
	if (gap < HIGH_ELO_MIDWEEK_GAP) return undefined;

	return {
		opponentName,
		opponentElo: opponentElo.elo,
		gap,
		leagueName,
		daysSince: days,
	};
}

const FINISHED_STATUSES = new Set(["FT", "AET", "PEN"]);

const UEFA_FALLBACK_ELO_CONFIDENCE = 0.25;
const UEFA_FALLBACK_ELO_GAMES = 10;

async function buildUefaFallbackElo(
	db: D1Database,
	teamId: number,
	asOfSeason: number,
): Promise<TeamData["elo"] | undefined> {
	const uefaClubKey =
		(await getUefaClubKeyForTeam(db, teamId, asOfSeason)) ??
		(await getUefaClubKeyForApiTeam(db, teamId, asOfSeason));
	if (!uefaClubKey) return undefined;

	const club = await getUefaClubCoefficient(db, uefaClubKey, asOfSeason);
	if (!club) return undefined;

	const association = club.country_code
		? await getUefaAssociationCoefficient(db, club.country_code, asOfSeason)
		: null;

	const rating = calculateStartingElo({
		associationCoefficient5y: association?.coefficient5y ?? null,
		clubCoefficient: club.coefficient ?? null,
	});

	return {
		rating,
		games: UEFA_FALLBACK_ELO_GAMES,
		asOf: `${asOfSeason}-07-01`,
		confidence: UEFA_FALLBACK_ELO_CONFIDENCE,
	};
}

// ============================================================================
// ERRORS
// ============================================================================

/**
 * Error thrown when insights are not available for a fixture
 * (e.g., finished match with no pre-generated insights)
 */
export class InsightsNotAvailableError extends Error {
	public readonly fixtureId: number;
	public readonly fixtureStatus: string;
	public readonly code = "INSIGHTS_NOT_AVAILABLE";

	constructor(message: string, fixtureId: number, fixtureStatus: string) {
		super(message);
		this.name = "InsightsNotAvailableError";
		this.fixtureId = fixtureId;
		this.fixtureStatus = fixtureStatus;
	}
}

// ============================================================================
// TYPES
// ============================================================================

export interface InsightsEnv extends CacheEnv {
	FOOTBALL_API_URL: string;
	RAPIDAPI_KEY: string;
}

export interface InsightsServiceResult {
	data: BettingInsightsResponse;
	source: string;
}

/**
 * Extended Fixture type with optional lineups (available in fixture detail responses)
 */
type FixtureWithLineups = Fixture;

interface RawTeamStats {
	team: { id: number; name: string };
	league: { id: number; name: string; season: number };
	form: string;
	fixtures: {
		played: { home: number; away: number; total: number };
		wins: { home: number; away: number; total: number };
		draws: { home: number; away: number; total: number };
		loses: { home: number; away: number; total: number };
	};
	goals: {
		for: {
			total: { home: number; away: number; total: number };
			average: { home: string; away: string; total: string };
			minute?: Record<
				string,
				{ total: number | null; percentage: string | null }
			>;
		};
		against: {
			total: { home: number; away: number; total: number };
			average: { home: string; away: string; total: string };
			minute?: Record<
				string,
				{ total: number | null; percentage: string | null }
			>;
		};
	};
	clean_sheet: { home: number; away: number; total: number };
	failed_to_score: { home: number; away: number; total: number };
	lineups?: Array<{ formation: string; played: number }>;
}

interface RawMatchData {
	fixture: {
		id: number;
		date: string;
		timestamp: number;
		status: { short: string };
	};
	league: {
		id: number;
		name: string;
		round?: string;
		season: number;
	};
	teams: {
		home: { id: number; name: string };
		away: { id: number; name: string };
	};
	goals: {
		home: number | null;
		away: number | null;
	};
	score: {
		halftime: { home: number | null; away: number | null };
		fulltime: { home: number | null; away: number | null };
	};
	lineups?: Array<{
		team: { id: number };
		formation: string | null;
	}>;
}

/**
 * Raw standings data from API-Football /standings endpoint
 */
interface RawStandingsResponse {
	league: {
		id: number;
		name: string;
		country: string;
		logo: string;
		flag: string | null;
		season: number;
		standings: Array<
			Array<{
				rank: number;
				team: {
					id: number;
					name: string;
					logo: string;
				};
				points: number;
				goalsDiff: number;
				group: string;
				form: string | null;
				status: string;
				description: string | null;
				all: {
					played: number;
					win: number;
					draw: number;
					lose: number;
					goals: { for: number; against: number };
					// API-Football can include clean sheets in standings rows.
					// Shape varies by league/season: sometimes a number, sometimes { home, away, total }.
					clean_sheet?: number | { home: number; away: number; total: number };
				};
				home: {
					played: number;
					win: number;
					draw: number;
					lose: number;
					goals: { for: number; against: number };
				};
				away: {
					played: number;
					win: number;
					draw: number;
					lose: number;
					goals: { for: number; against: number };
				};
			}>
		>;
	};
}

/**
 * Processed standings data for a team
 */
interface TeamStandingsData {
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
	// Motivation distances
	pointsFromFirst: number;
	pointsFromCL: number; // Position 4 typically
	pointsFromRelegation: number; // Bottom 3 typically
}

/**
 * Full standings data for a league
 */
interface StandingsData {
	leagueId: number;
	season: number;
	rows: Array<{
		teamId: number;
		teamName: string;
		rank: number;
		points: number;
		played: number;
		win: number;
		draw: number;
		loss: number;
		goalsFor: number;
		goalsAgainst: number;
		goalDiff: number;
		// null means "not provided by the standings endpoint for this league/season"
		cleanSheets: number | null;
		form: string | null;
		description: string | null;
		home: {
			played: number;
			win: number;
			draw: number;
			loss: number;
			goalsFor: number;
			goalsAgainst: number;
		};
		away: {
			played: number;
			win: number;
			draw: number;
			loss: number;
			goalsFor: number;
			goalsAgainst: number;
		};
	}>;
	// First place points (for distance calculation)
	firstPlacePoints: number;
	// CL position points (position 4)
	clPositionPoints: number;
	// Relegation zone points (position 18)
	relegationPoints: number;
}

// ============================================================================
// SERVICE
// ============================================================================

export const insightsService = {
	/**
	 * Generate betting insights for a fixture
	 */
	async generateInsights({
		fixtureId,
		env,
		ctx,
		fixtureOverride,
	}: {
		fixtureId: number;
		env: InsightsEnv;
		ctx: ExecutionContext;
		/**
		 * Optional pre-fetched fixture detail (used for batch prefetch to avoid extra API calls).
		 * When provided, the service will NOT call the /fixtures?id=... endpoint.
		 */
		fixtureOverride?: FixtureWithLineups;
	}): Promise<InsightsServiceResult> {
		const startTime = performance.now();
		console.log(`🎯 [Insights] Generating insights for fixture ${fixtureId}`);

		const dedupKey = getCacheKey("insights", { fixtureId: String(fixtureId) });

		return withDeduplication(dedupKey, async () => {
			// -----------------------------------------------------------------------
			// Cache: Edge → R2 (KV disabled) with stale fallback
			// -----------------------------------------------------------------------
			const cacheParams = { fixtureId: String(fixtureId) };
			const cached = await cacheGet<BettingInsightsResponse>(
				env,
				"insights",
				cacheParams,
			);

			let staleFallback: BettingInsightsResponse | null = null;

			if (cached.data && cached.source !== "none") {
				const isR2 = cached.source === "r2";
				// Provide match status/date to the staleness calculator so it can apply
				// dynamic TTL for upcoming/live/finished matches. Without this, TTL defaults
				// to TTL.SHORT and causes unnecessary regenerations (generatedAt changes).
				const status = cached.data.match?.status ?? "";
				const dateTime = cached.data.match?.date ?? "";

				const staleCheckParams = isR2
					? { ...cacheParams, status, dateTime, _r2Staleness: "true" }
					: { ...cacheParams, status, dateTime };

				if (!isStale(cached.meta, "insights", staleCheckParams)) {
					const source =
						cached.source === "edge"
							? "Edge Cache"
							: cached.source === "r2"
								? "R2"
								: "Cache";
					console.log(
						`✅ [Insights] Cache hit (${source}) for fixture ${fixtureId}`,
					);
					return { data: cached.data, source };
				}

				staleFallback = cached.data;
				console.log(
					`⏳ [Insights] Cached data is stale, regenerating fixture ${fixtureId}`,
				);
			}

			// Step 1: Fetch fixture details (or use override)
			let fixture: FixtureWithLineups | null = null;
			try {
				fixture =
					fixtureOverride ?? (await this.fetchFixtureDetail(fixtureId, env));
				if (!fixture) {
					throw new Error(`Fixture ${fixtureId} not found`);
				}
			} catch (error) {
				// If upstream fails, fall back to stale cache when available
				if (staleFallback) {
					console.log(
						`⚠️ [Insights] Using stale cache fallback for fixture ${fixtureId}`,
					);
					return { data: staleFallback, source: "Stale Cache" };
				}
				throw error;
			}

			// Step 1b: Check if fixture is finished and we have no cached insights
			// If finished and no cached insights exist, refuse to generate (frozen context rule)
			const fixtureStatus = fixture.fixture.status.short;
			const isFinished = INSIGHTS_FINISHED_STATUSES.includes(fixtureStatus);

			if (isFinished && !staleFallback) {
				// Double-check D1 for any stored snapshot (in case cache was purged but snapshot exists)
				const snapshotExists = await hasInsightsSnapshot(
					env.ENTITIES_DB,
					fixtureId,
				);
				if (!snapshotExists) {
					console.log(
						`🚫 [Insights] Fixture ${fixtureId} is finished (${fixtureStatus}) and no insights were generated pre-match`,
					);
					throw new InsightsNotAvailableError(
						`Insights not available for finished fixture ${fixtureId}. Insights can only be generated before or during a match.`,
						fixtureId,
						fixtureStatus,
					);
				}
				// If snapshot exists but cache was purged, we still can't regenerate
				// (the context would be different now), so still refuse
				console.log(
					`🚫 [Insights] Fixture ${fixtureId} has snapshot but cache purged - cannot regenerate`,
				);
				throw new InsightsNotAvailableError(
					`Insights cache expired for finished fixture ${fixtureId}. Historical insights cannot be regenerated.`,
					fixtureId,
					fixtureStatus,
				);
			}

			const homeTeamId = fixture.teams.home.id;
			const awayTeamId = fixture.teams.away.id;
			const leagueId = fixture.league.id;
			const season = fixture.league.season;
			const sanityWarnings: string[] = [];
			const dataQualityWarnings: string[] = [];
			const MIN_RELIABLE_STATS_GAMES = 8;

			console.log(
				`📊 [Insights] ${fixture.teams.home.name} vs ${fixture.teams.away.name} ` +
					`(${fixture.league.name}, Round: ${fixture.league.round})`,
			);

			// Step 2: Fetch all data in parallel (including standings and injuries)
			const [
				homeStats,
				awayStats,
				homeMatches,
				awayMatches,
				h2hMatches,
				standings,
				injuries,
				homeEloRow,
				awayEloRow,
			] = await Promise.all([
				this.fetchTeamStatistics(homeTeamId, leagueId, season, env),
				this.fetchTeamStatistics(awayTeamId, leagueId, season, env),
				this.fetchTeamMatches(homeTeamId, 50, env),
				this.fetchTeamMatches(awayTeamId, 50, env),
				this.fetchH2HMatches(homeTeamId, awayTeamId, 5, env),
				this.fetchStandings(leagueId, season, env),
				this.fetchInjuries(fixtureId, homeTeamId, awayTeamId, env),
				getCurrentTeamElo(env.ENTITIES_DB, homeTeamId),
				getCurrentTeamElo(env.ENTITIES_DB, awayTeamId),
			]);

			if (fixture.league.type === "League" && !standings) {
				sanityWarnings.push("Standings missing for league match");
				dataQualityWarnings.push("Standings missing for league match");
			}

			const homePlayed = homeStats?.fixtures?.played?.total ?? 0;
			const awayPlayed = awayStats?.fixtures?.played?.total ?? 0;
			const homePlayedHome = homeStats?.fixtures?.played?.home ?? 0;
			const homePlayedAway = homeStats?.fixtures?.played?.away ?? 0;
			const awayPlayedHome = awayStats?.fixtures?.played?.home ?? 0;
			const awayPlayedAway = awayStats?.fixtures?.played?.away ?? 0;
			if (homePlayed > 0 && homePlayed < MIN_RELIABLE_STATS_GAMES) {
				sanityWarnings.push(
					`Home team stats sample is small (${homePlayed} matches)`,
				);
			}
			if (awayPlayed > 0 && awayPlayed < MIN_RELIABLE_STATS_GAMES) {
				sanityWarnings.push(
					`Away team stats sample is small (${awayPlayed} matches)`,
				);
			}
			if (homePlayed > 0 && (homePlayedHome === 0 || homePlayedAway === 0)) {
				sanityWarnings.push(
					"Home team stats missing home/away split; using fallback rates",
				);
			}
			if (awayPlayed > 0 && (awayPlayedHome === 0 || awayPlayedAway === 0)) {
				sanityWarnings.push(
					"Away team stats missing home/away split; using fallback rates",
				);
			}

			// Step 2b: Extract team standings data
			const homeStandingsData = this.getTeamStandingsData(
				standings,
				homeTeamId,
			);
			const awayStandingsData = this.getTeamStandingsData(
				standings,
				awayTeamId,
			);

			const homeElo = homeEloRow
				? {
						rating: homeEloRow.elo,
						games: homeEloRow.games,
						asOf: homeEloRow.as_of_date,
						confidence: calculateEloConfidence(homeEloRow.games),
					}
				: await buildUefaFallbackElo(env.ENTITIES_DB, homeTeamId, season);

			if (!homeEloRow && homeElo) {
				dataQualityWarnings.push(
					"Home team Elo missing; using UEFA priors (low confidence)",
				);
				await upsertCurrentTeamElo(env.ENTITIES_DB, {
					team_id: homeTeamId,
					elo: homeElo.rating,
					games: homeElo.games,
					as_of_date: homeElo.asOf ?? `${season}-07-01`,
				});
			}

			const awayElo = awayEloRow
				? {
						rating: awayEloRow.elo,
						games: awayEloRow.games,
						asOf: awayEloRow.as_of_date,
						confidence: calculateEloConfidence(awayEloRow.games),
					}
				: await buildUefaFallbackElo(env.ENTITIES_DB, awayTeamId, season);

			if (!awayEloRow && awayElo) {
				dataQualityWarnings.push(
					"Away team Elo missing; using UEFA priors (low confidence)",
				);
				await upsertCurrentTeamElo(env.ENTITIES_DB, {
					team_id: awayTeamId,
					elo: awayElo.rating,
					games: awayElo.games,
					as_of_date: awayElo.asOf ?? `${season}-07-01`,
				});
			}

			// Step 3: Process team data (with standings)
			const homeTeamData = this.processTeamData(
				homeTeamId,
				fixture.teams.home.name,
				homeStats,
				homeMatches,
				leagueId,
				homeStandingsData,
				homeElo,
			);

			const awayTeamData = this.processTeamData(
				awayTeamId,
				fixture.teams.away.name,
				awayStats,
				awayMatches,
				leagueId,
				awayStandingsData,
				awayElo,
			);

			sanityWarnings.push(
				...this.validateTeamStatsSanity(homeTeamData, awayTeamData),
			);

			const lowHistory =
				homeTeamData.mind.matchCount < 15 || awayTeamData.mind.matchCount < 15;
			if (lowHistory) {
				sanityWarnings.push("Limited match history; confidence downgraded");
				dataQualityWarnings.push("Limited match history");
			}

			const [homeHighElo, awayHighElo] = await Promise.all([
				buildHighEloOpponentContext(env.ENTITIES_DB, homeTeamData),
				buildHighEloOpponentContext(env.ENTITIES_DB, awayTeamData),
			]);
			if (homeHighElo) homeTeamData.recentHighEloOpponent = homeHighElo;
			if (awayHighElo) awayTeamData.recentHighEloOpponent = awayHighElo;

			// Step 4: Process H2H data
			const h2hData = processH2HData(h2hMatches, homeTeamId, awayTeamId);

			// Step 5: Build match context
			const homeFormation = this.getFormationFromLineups(
				fixture.lineups,
				homeTeamId,
			);
			const awayFormation = this.getFormationFromLineups(
				fixture.lineups,
				awayTeamId,
			);

			const roundNumber = extractRoundNumber(fixture.league.round) ?? undefined;
			if (fixture.league.type === "League" && roundNumber === undefined) {
				sanityWarnings.push(
					"League round number unavailable; skipping early/end-of-season logic",
				);
			}
			const daysSinceLastMatch = Math.min(
				homeTeamData.daysSinceLastMatch,
				awayTeamData.daysSinceLastMatch,
			);

			// Estimate total rounds from league size (typically 38 for 20-team leagues)
			const leagueSize = standings?.rows.length ?? 20;
			const totalRounds = (leagueSize - 1) * 2; // Each team plays every other team twice

			const predictionContext = buildMatchContext(
				fixture.league.name,
				fixture.league.round,
				homeTeamId,
				awayTeamId,
				fixture.teams.home.name,
				fixture.teams.away.name,
				{
					venue: fixture.fixture.venue?.name,
					roundNumber,
					totalRounds,
					daysSinceLastMatch,
					homeTeamPosition: homeTeamData.stats.leaguePosition,
					awayTeamPosition: awayTeamData.stats.leaguePosition,
					homeTeamData,
					awayTeamData,
					leagueSize,
				},
			);

			const matchContext: ApiMatchContext = {
				matchType: predictionContext.matchType.type,
				matchImportance: predictionContext.matchType.importance,
				isKnockout: predictionContext.matchType.isKnockout,
				stageName: predictionContext.matchType.stageName ?? null,
				isDerby: predictionContext.matchType.isDerby,
				isNeutralVenue: predictionContext.matchType.isNeutralVenue,
				isEarlySeason: predictionContext.isEarlySeason,
				roundNumber: predictionContext.roundNumber ?? null,
				isPostInternationalBreak: predictionContext.isPostInternationalBreak,
				isEndOfSeason: predictionContext.isEndOfSeason,
				homeStakes: predictionContext.homeStakes,
				awayStakes: predictionContext.awayStakes,
				isSixPointer: predictionContext.isSixPointer,
				endOfSeasonSummary: predictionContext.endOfSeasonContext?.summary,
				formationStability: calculateFormationStabilityContext(
					homeFormation,
					awayFormation,
					homeTeamData.dna.formationFrequency,
					awayTeamData.dna.formationFrequency,
					homeTeamData.dna.mostPlayedFormation,
					awayTeamData.dna.mostPlayedFormation,
					predictionContext.isEarlySeason,
				),
			};

			const leagueStats = await this.getWeightedLeagueStats({
				db: env.ENTITIES_DB,
				leagueId,
				season,
			});

			// Step 6: Generate simulations (with injury adjustments)
			const simulations = this.generateSimulations(
				homeTeamData,
				awayTeamData,
				h2hData,
				predictionContext,
				injuries,
				leagueStats,
			);
			sanityWarnings.push(...this.validateSimulationSanity(simulations));

			// Step 7: Generate insights
			const { homeInsights, awayInsights, h2hInsights } =
				this.generateAllInsights(
					homeTeamData,
					awayTeamData,
					h2hData,
					homeMatches,
					awayMatches,
				);

			// Step 8: Assess data quality
			const dataQuality = this.assessDataQuality(
				homeTeamData,
				awayTeamData,
				h2hData,
			);
			const adjustedDataQuality =
				dataQualityWarnings.length > 0
					? {
							...dataQuality,
							overallConfidenceMultiplier: Math.min(
								dataQuality.overallConfidenceMultiplier,
								0.6,
							),
							warnings: [...dataQuality.warnings, ...dataQualityWarnings],
						}
					: dataQuality;

			const homeTeamContext = this.buildTeamContext(
				homeTeamData,
				predictionContext.matchType.type,
			);
			const awayTeamContext = this.buildTeamContext(
				awayTeamData,
				predictionContext.matchType.type,
			);

			const enrichedHomeInsights = enrichInsights(homeInsights, {
				team: homeTeamContext,
			});
			const enrichedAwayInsights = enrichInsights(awayInsights, {
				team: awayTeamContext,
			});
			const enrichedH2HInsights = enrichInsights(h2hInsights, {});

			const homeInsightsWithParts =
				attachInsightPartsToList(enrichedHomeInsights);
			const awayInsightsWithParts =
				attachInsightPartsToList(enrichedAwayInsights);
			const h2hInsightsWithParts =
				attachInsightPartsToList(enrichedH2HInsights);

			const matchFacts = buildMatchFacts({
				homeTeam: homeTeamData,
				awayTeam: awayTeamData,
				homeContext: homeTeamContext,
				awayContext: awayTeamContext,
				h2h: h2hData,
				matchContext,
				injuries,
			});

			const keyInsights = buildKeyInsights({
				homeInsights: homeInsightsWithParts,
				awayInsights: awayInsightsWithParts,
				homeContext: homeTeamContext,
				awayContext: awayTeamContext,
				homeTeam: homeTeamData,
				awayTeam: awayTeamData,
				leagueName: fixture.league.name,
				standingsRows: standings?.rows ?? null,
			});

			const keyInsightsWithParts = {
				home: attachInsightPartsToList(keyInsights.home),
				away: attachInsightPartsToList(keyInsights.away),
			};

			const simulationsWithReliability = simulations.map((sim) => ({
				...sim,
				modelReliabilityBreakdown: buildModelReliabilityBreakdown({
					level: sim.modelReliability,
					homeMatchCount: homeTeamData.mind.matchCount,
					awayMatchCount: awayTeamData.mind.matchCount,
					h2hMatchCount: h2hData.h2hMatchCount,
					h2hHasSufficientData: h2hData.hasSufficientData,
					matchType: matchContext.matchType,
					isKnockout: matchContext.isKnockout,
					isDerby: matchContext.isDerby,
					isNeutralVenue: matchContext.isNeutralVenue,
					isPostInternationalBreak: matchContext.isPostInternationalBreak,
					isEndOfSeason: matchContext.isEndOfSeason,
					capsHit: sim.capsHit,
					overcorrectionWarning: sim.overcorrectionWarning,
					totalAdjustment: sim.totalAdjustment,
				}),
			}));

			// Step 9: Calculate overall confidence
			const overallConfidence = this.calculateOverallConfidence(
				simulations,
				adjustedDataQuality,
			);

			// Step 10: Build response
			const duration = (performance.now() - startTime).toFixed(2);
			console.log(`✅ [Insights] Generated insights in ${duration}ms`);

			const generatedAt = new Date().toISOString();
			// fixtureStatus already declared above in Step 1b

			const response: BettingInsightsResponse = {
				fixtureId,
				match: {
					homeTeam: fixture.teams.home.name,
					awayTeam: fixture.teams.away.name,
					league: fixture.league.name,
					date: fixture.fixture.date,
					status: fixtureStatus,
				},
				homeTeamContext,
				awayTeamContext,
				matchContext,
				simulations: simulationsWithReliability,
				homeInsights: homeInsightsWithParts,
				awayInsights: awayInsightsWithParts,
				h2hInsights: h2hInsightsWithParts,
				matchFacts,
				keyInsights: keyInsightsWithParts,
				dataQuality: adjustedDataQuality,
				overallConfidence,
				sanityWarnings,
				generatedAt,
			};

			if (sanityWarnings.length > 0) {
				console.warn(
					`⚠️ [Insights] Sanity warnings: ${sanityWarnings.join("; ")}`,
				);
			}

			// Build inputs snapshot for D1 (immutable freeze of context at generation time)
			const inputsSnapshot = this.buildInputsSnapshot(
				homeTeamData,
				awayTeamData,
			);

			// Cache (non-blocking): R2/Edge + D1 upserts
			ctx.waitUntil(
				this.persistToD1(
					env,
					fixture,
					fixtureId,
					generatedAt,
					fixtureStatus,
					inputsSnapshot,
					standings,
					homeTeamData,
					awayTeamData,
					cacheParams,
					response,
				),
			);

			return {
				data: response,
				source: "API",
			};
		});
	},

	// ============================================================================
	// DATA FETCHING
	// ============================================================================

	/**
	 * Fetch fixture detail from API
	 * Uses the Fixture type from @outscore/shared-types, extended with lineups
	 */
	async fetchFixtureDetail(
		fixtureId: number,
		env: InsightsEnv,
	): Promise<FixtureWithLineups | null> {
		const url = new URL(`${env.FOOTBALL_API_URL}/fixtures`);
		url.searchParams.append("id", fixtureId.toString());

		console.log(`🌐 [Insights] Fetching fixture ${fixtureId}`);

		const response = await fetch(url.toString(), {
			headers: {
				"x-rapidapi-host": "api-football-v1.p.rapidapi.com",
				"x-rapidapi-key": env.RAPIDAPI_KEY,
			},
		});

		if (!response.ok) {
			throw new Error(`API request failed: ${response.statusText}`);
		}

		const data = (await response.json()) as { response: FixtureWithLineups[] };
		return data.response?.[0] ?? null;
	},

	/**
	 * Fetch team statistics from API
	 */
	async fetchTeamStatistics(
		teamId: number,
		leagueId: number,
		season: number,
		env: InsightsEnv,
	): Promise<RawTeamStats | null> {
		const url = new URL(`${env.FOOTBALL_API_URL}/teams/statistics`);
		url.searchParams.append("team", teamId.toString());
		url.searchParams.append("league", leagueId.toString());
		url.searchParams.append("season", season.toString());

		console.log(`🌐 [Insights] Fetching stats for team ${teamId}`);

		try {
			const response = await fetch(url.toString(), {
				headers: {
					"x-rapidapi-host": "api-football-v1.p.rapidapi.com",
					"x-rapidapi-key": env.RAPIDAPI_KEY,
				},
			});

			if (!response.ok) {
				console.warn(`⚠️ [Insights] Failed to fetch stats for team ${teamId}`);
				return null;
			}

			const data = (await response.json()) as { response: RawTeamStats };
			return data.response ?? null;
		} catch (error) {
			console.warn(
				`⚠️ [Insights] Error fetching stats for team ${teamId}:`,
				error,
			);
			return null;
		}
	},

	/**
	 * Fetch team's recent matches
	 */
	async fetchTeamMatches(
		teamId: number,
		count: number,
		env: InsightsEnv,
	): Promise<ProcessedMatch[]> {
		const url = new URL(`${env.FOOTBALL_API_URL}/fixtures`);
		url.searchParams.append("team", teamId.toString());
		url.searchParams.append("last", count.toString());

		console.log(
			`🌐 [Insights] Fetching last ${count} matches for team ${teamId}`,
		);

		try {
			const response = await fetch(url.toString(), {
				headers: {
					"x-rapidapi-host": "api-football-v1.p.rapidapi.com",
					"x-rapidapi-key": env.RAPIDAPI_KEY,
				},
			});

			if (!response.ok) {
				console.warn(`⚠️ [Insights] Failed to fetch matches for team ${teamId}`);
				return [];
			}

			const data = (await response.json()) as { response: RawMatchData[] };
			const rawMatches = data.response ?? [];

			// Convert to ProcessedMatch format
			const matches = rawMatches
				.filter((m) => FINISHED_STATUSES.has(m.fixture.status.short)) // Only finished matches
				.map((m) => this.convertToProcessedMatch(m, teamId));

			return matches;
		} catch (error) {
			console.warn(
				`⚠️ [Insights] Error fetching matches for team ${teamId}:`,
				error,
			);
			return [];
		}
	},

	/**
	 * Fetch H2H matches between two teams
	 *
	 * Uses D1 cache with strict 2-day TTL - will NOT refetch from API unless:
	 * 1. Cache miss (no entry exists)
	 * 2. Cache expired (past expires_at timestamp)
	 *
	 * H2H data only changes when the two teams play each other again,
	 * so a 2-day TTL is sufficient for most use cases.
	 */
	async fetchH2HMatches(
		homeTeamId: number,
		awayTeamId: number,
		count: number,
		env: InsightsEnv,
	): Promise<ProcessedMatch[]> {
		const db = env.ENTITIES_DB;

		// 1. Check D1 cache first (strict - won't fetch if valid cache exists)
		try {
			const cached = await getH2HCache(db, homeTeamId, awayTeamId, count);

			if (cached) {
				console.log(
					`✅ [Insights] H2H cache hit for ${homeTeamId} vs ${awayTeamId}`,
				);

				// Convert cached H2HCacheData back to ProcessedMatch[]
				return cached.matches.map((m) => {
					const isHome = m.homeTeamId === homeTeamId;
					// MatchResult uses 'W' | 'D' | 'L' format
					const result: "W" | "D" | "L" =
						m.homeGoals > m.awayGoals
							? isHome
								? "W"
								: "L"
							: m.homeGoals < m.awayGoals
								? isHome
									? "L"
									: "W"
								: "D";

					return {
						id: m.fixtureId,
						date: m.date,
						homeTeam: { id: m.homeTeamId, name: m.homeTeamName },
						awayTeam: { id: m.awayTeamId, name: m.awayTeamName },
						score: { home: m.homeGoals, away: m.awayGoals },
						result,
						goalsScored: isHome ? m.homeGoals : m.awayGoals,
						goalsConceded: isHome ? m.awayGoals : m.homeGoals,
						league: { id: m.leagueId, name: m.leagueName },
						season: m.season,
						isHome,
					};
				});
			}
		} catch (cacheError) {
			console.warn(`⚠️ [Insights] H2H cache read error:`, cacheError);
			// Continue to API fetch on cache error
		}

		// 2. Cache miss or error - fetch from API
		const url = new URL(`${env.FOOTBALL_API_URL}/fixtures/headtohead`);
		url.searchParams.append("h2h", `${homeTeamId}-${awayTeamId}`);
		url.searchParams.append("last", count.toString());

		console.log(
			`🌐 [Insights] Fetching H2H from API: ${homeTeamId} vs ${awayTeamId}`,
		);

		try {
			const response = await fetch(url.toString(), {
				headers: {
					"x-rapidapi-host": "api-football-v1.p.rapidapi.com",
					"x-rapidapi-key": env.RAPIDAPI_KEY,
				},
			});

			if (!response.ok) {
				console.warn(`⚠️ [Insights] Failed to fetch H2H from API`);
				return [];
			}

			const data = (await response.json()) as { response: RawMatchData[] };
			const rawMatches = data.response ?? [];

			// Filter to finished matches only.
			// API-Football can mark completed matches as FT (full-time), AET (after extra time),
			// or PEN (penalties). We want to include all of these as "finished" for H2H.
			const FINISHED_STATUSES = new Set(["FT", "AET", "PEN"]);
			const finishedMatches = rawMatches.filter((m) =>
				FINISHED_STATUSES.has(m.fixture.status.short),
			);

			// Convert to ProcessedMatch format (from home team's perspective)
			const processedMatches = finishedMatches.map((m) =>
				this.convertToProcessedMatch(m, homeTeamId),
			);

			// 3. Store in D1 cache with 2-day TTL
			if (processedMatches.length > 0) {
				const now = new Date();
				const expiresAt = new Date(now.getTime() + H2H_CACHE_TTL_MS);

				// Calculate summary stats for cache
				let teamAWins = 0;
				let teamBWins = 0;
				let draws = 0;
				let teamAGoals = 0;
				let teamBGoals = 0;
				let bttsCount = 0;
				let over25Count = 0;

				const matchesForCache = finishedMatches.map((raw, idx) => {
					const processed = processedMatches[idx];
					// Same defensive parsing as `convertToProcessedMatch`
					const homeGoals = raw.goals.home ?? raw.score?.fulltime?.home ?? 0;
					const awayGoals = raw.goals.away ?? raw.score?.fulltime?.away ?? 0;

					// Calculate stats relative to homeTeamId (team A)
					const isHomeTeamA = raw.teams.home.id === homeTeamId;
					const aGoals = isHomeTeamA ? homeGoals : awayGoals;
					const bGoals = isHomeTeamA ? awayGoals : homeGoals;

					teamAGoals += aGoals;
					teamBGoals += bGoals;

					if (aGoals > bGoals) teamAWins++;
					else if (bGoals > aGoals) teamBWins++;
					else draws++;

					if (homeGoals > 0 && awayGoals > 0) bttsCount++;
					if (homeGoals + awayGoals > 2.5) over25Count++;

					return {
						fixtureId: raw.fixture.id,
						date: processed.date,
						homeTeamId: raw.teams.home.id,
						homeTeamName: raw.teams.home.name,
						awayTeamId: raw.teams.away.id,
						awayTeamName: raw.teams.away.name,
						homeGoals,
						awayGoals,
						leagueId: raw.league.id,
						leagueName: raw.league.name,
						season: raw.league.season,
					};
				});

				try {
					await upsertH2HCache(db, {
						pair_key: makeH2HPairKey(homeTeamId, awayTeamId),
						team_a_id: homeTeamId,
						team_b_id: awayTeamId,
						last_n: count,
						fetched_at: now.toISOString(),
						expires_at: expiresAt.toISOString(),
						h2h_data_json: JSON.stringify({
							totalMeetings: processedMatches.length,
							teamAWins,
							teamBWins,
							draws,
							teamAGoals,
							teamBGoals,
							bttsCount,
							over25Count,
							matches: matchesForCache,
						}),
					});
					console.log(
						`✅ [Insights] Cached H2H for ${homeTeamId} vs ${awayTeamId} (expires: ${expiresAt.toISOString()})`,
					);
				} catch (cacheWriteError) {
					console.warn(`⚠️ [Insights] Failed to cache H2H:`, cacheWriteError);
					// Don't fail the request if caching fails
				}
			}

			return processedMatches;
		} catch (error) {
			console.warn(`⚠️ [Insights] Error fetching H2H:`, error);
			return [];
		}
	},

	/**
	 * Fetch injuries for a fixture
	 *
	 * Uses D1 cache with 24-hour TTL (API-Football recommends 1 call/day).
	 * Will NOT refetch from API unless:
	 * 1. Cache miss (no entry exists)
	 * 2. Cache expired (past expires_at timestamp)
	 */
	async fetchInjuries(
		fixtureId: number,
		homeTeamId: number,
		awayTeamId: number,
		env: InsightsEnv,
	): Promise<FixtureInjuries | null> {
		const db = env.ENTITIES_DB;

		// 1. Check D1 cache first
		try {
			const cached = await getInjuriesCache(db, fixtureId);

			if (cached) {
				console.log(
					`✅ [Insights] Injuries cache hit for fixture ${fixtureId}`,
				);
				// Convert CachedInjury[] to ProcessedInjury[] (types are compatible)
				return {
					fixtureId: cached.fixtureId,
					homeTeamId: cached.homeTeamId,
					awayTeamId: cached.awayTeamId,
					homeInjuries: cached.homeInjuries,
					awayInjuries: cached.awayInjuries,
					fetchedAt: cached.fetchedAt,
				};
			}
		} catch (cacheError) {
			console.warn(`⚠️ [Insights] Injuries cache read error:`, cacheError);
			// Continue to API fetch on cache error
		}

		// 2. Cache miss or error - fetch from API
		console.log(
			`🌐 [Insights] Fetching injuries from API for fixture ${fixtureId}`,
		);

		try {
			const rawResponse = await fetchInjuriesForFixture(
				fixtureId,
				env.FOOTBALL_API_URL,
				env.RAPIDAPI_KEY,
			);

			// Process raw injuries into our format
			const injuries = processInjuries(
				rawResponse.response,
				fixtureId,
				homeTeamId,
				awayTeamId,
			);

			// 3. Store in D1 cache with 24-hour TTL
			try {
				await upsertInjuriesCache(db, {
					fixtureId,
					homeTeamId,
					awayTeamId,
					homeInjuries: injuries.homeInjuries,
					awayInjuries: injuries.awayInjuries,
					fetchedAt: Date.now(),
				});
				console.log(`✅ [Insights] Cached injuries for fixture ${fixtureId}`);
			} catch (cacheWriteError) {
				console.warn(`⚠️ [Insights] Failed to cache injuries:`, cacheWriteError);
				// Don't fail the request if caching fails
			}

			return injuries;
		} catch (error) {
			console.warn(`⚠️ [Insights] Error fetching injuries:`, error);
			return null;
		}
	},

	/**
	 * Fetch standings for a league and season from API-Football
	 */
	async fetchStandings(
		leagueId: number,
		season: number,
		env: InsightsEnv,
	): Promise<StandingsData | null> {
		const url = new URL(`${env.FOOTBALL_API_URL}/standings`);
		url.searchParams.append("league", leagueId.toString());
		url.searchParams.append("season", season.toString());

		console.log(
			`🌐 [Insights] Fetching standings for league ${leagueId}, season ${season}`,
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
					`⚠️ [Insights] Failed to fetch standings for league ${leagueId}`,
				);
				return null;
			}

			const data = (await response.json()) as {
				response: RawStandingsResponse[];
			};
			const rawStandings = data.response?.[0];

			if (!rawStandings?.league?.standings?.[0]) {
				console.warn(`⚠️ [Insights] No standings data for league ${leagueId}`);
				return null;
			}

			// Process standings - API returns array of arrays (for groups)
			// For most leagues, we only care about the first array (main table)
			const standingsRows = rawStandings.league.standings[0];
			const totalTeams = standingsRows.length;

			// Calculate reference points for motivation distances
			const firstPlacePoints = standingsRows[0]?.points ?? 0;
			// CL position is typically 4 for big leagues, adjust based on league size
			const clPosition = Math.min(4, Math.ceil(totalTeams * 0.2));
			const clPositionPoints = standingsRows[clPosition - 1]?.points ?? 0;
			// Relegation zone is typically bottom 3, adjust based on league size
			const relegationPosition = Math.max(
				totalTeams - 2,
				Math.ceil(totalTeams * 0.85),
			);
			const relegationPoints =
				standingsRows[relegationPosition - 1]?.points ?? 0;

			const rows = standingsRows.map((row) => {
				const rawCleanSheet = row.all.clean_sheet;
				const cleanSheets =
					rawCleanSheet == null
						? null
						: typeof rawCleanSheet === "number"
							? rawCleanSheet
							: (rawCleanSheet.total ?? 0);

				return {
					cleanSheets,
					teamId: row.team.id,
					teamName: row.team.name,
					rank: row.rank,
					points: row.points,
					played: row.all.played,
					win: row.all.win,
					draw: row.all.draw,
					loss: row.all.lose,
					goalsFor: row.all.goals.for,
					goalsAgainst: row.all.goals.against,
					goalDiff: row.goalsDiff,
					form: row.form,
					description: row.description,
					home: {
						played: row.home.played,
						win: row.home.win,
						draw: row.home.draw,
						loss: row.home.lose,
						goalsFor: row.home.goals.for,
						goalsAgainst: row.home.goals.against,
					},
					away: {
						played: row.away.played,
						win: row.away.win,
						draw: row.away.draw,
						loss: row.away.lose,
						goalsFor: row.away.goals.for,
						goalsAgainst: row.away.goals.against,
					},
				};
			});

			console.log(
				`✅ [Insights] Fetched standings: ${rows.length} teams for league ${leagueId}`,
			);

			return {
				leagueId,
				season,
				rows,
				firstPlacePoints,
				clPositionPoints,
				relegationPoints,
			};
		} catch (error) {
			console.warn(
				`⚠️ [Insights] Error fetching standings for league ${leagueId}:`,
				error,
			);
			return null;
		}
	},

	/**
	 * Get team standings data from full standings
	 */
	getTeamStandingsData(
		standings: StandingsData | null,
		teamId: number,
	): TeamStandingsData | null {
		if (!standings) return null;

		const teamRow = standings.rows.find((row) => row.teamId === teamId);
		if (!teamRow) return null;

		return {
			rank: teamRow.rank,
			points: teamRow.points,
			played: teamRow.played,
			win: teamRow.win,
			draw: teamRow.draw,
			loss: teamRow.loss,
			goalsFor: teamRow.goalsFor,
			goalsAgainst: teamRow.goalsAgainst,
			goalDiff: teamRow.goalDiff,
			form: teamRow.form,
			pointsFromFirst: standings.firstPlacePoints - teamRow.points,
			pointsFromCL: standings.clPositionPoints - teamRow.points,
			pointsFromRelegation: teamRow.points - standings.relegationPoints,
		};
	},

	// ============================================================================
	// DATA PROCESSING
	// ============================================================================

	/**
	 * Convert raw API match to ProcessedMatch
	 */
	convertToProcessedMatch(raw: RawMatchData, teamId: number): ProcessedMatch {
		const isHome = raw.teams.home.id === teamId;
		// API-Football can expose goals in multiple places depending on endpoint/version.
		// Prefer `goals.*`, but fall back to `score.fulltime.*` to avoid `undefined` propagating
		// into H2H/DNA goal-line calculations (which can incorrectly yield 0% rates).
		const homeGoals = raw.goals.home ?? raw.score?.fulltime?.home ?? null;
		const awayGoals = raw.goals.away ?? raw.score?.fulltime?.away ?? null;

		const goalsScored = isHome ? (homeGoals ?? 0) : (awayGoals ?? 0);
		const goalsConceded = isHome ? (awayGoals ?? 0) : (homeGoals ?? 0);
		const result = determineMatchResult(goalsScored, goalsConceded);

		// Get formation from lineups if available
		const formation =
			raw.lineups?.find((l) => l.team.id === teamId)?.formation ?? undefined;

		// Get first half goals if available
		const firstHalfGoals = isHome
			? (raw.score.halftime.home ?? undefined)
			: (raw.score.halftime.away ?? undefined);

		return {
			id: raw.fixture.id,
			date: raw.fixture.date,
			homeTeam: raw.teams.home,
			awayTeam: raw.teams.away,
			score: {
				home: homeGoals,
				away: awayGoals,
			},
			result,
			goalsScored,
			goalsConceded,
			firstHalfGoals: firstHalfGoals ?? undefined,
			league: {
				id: raw.league.id,
				name: raw.league.name,
				round: raw.league.round,
			},
			season: raw.league.season,
			formation,
			isHome,
		};
	},

	/**
	 * Process raw data into TeamData structure
	 */
	processTeamData(
		teamId: number,
		teamName: string,
		stats: RawTeamStats | null,
		matches: ProcessedMatch[],
		leagueId: number,
		standingsData: TeamStandingsData | null = null,
		elo?: TeamData["elo"],
	): TeamData {
		// Filter out friendly matches for analysis
		const competitiveMatches = filterNonFriendlyMatches(matches);

		// Split home/away matches (needed for safety flags)
		const homeMatches = competitiveMatches.filter((m) => m.isHome);
		const awayMatches = competitiveMatches.filter((m) => !m.isHome);

		// Count seasons in current league (needed for Mood calculations)
		const seasonsInLeague = this.countSeasonsInLeague(
			competitiveMatches,
			leagueId,
		);

		// Calculate layers
		const mind = calculateMindLayer(competitiveMatches);
		const mood = calculateMoodLayer(competitiveMatches, mind, seasonsInLeague);
		const dna = this.calculateDNAFromMatches(competitiveMatches, stats);
		const teamStats = this.calculateTeamStats(
			stats,
			standingsData,
			competitiveMatches,
		);
		const safetyFlags = calculateSafetyFlags(
			competitiveMatches,
			awayMatches,
			mind.tier,
			teamStats.leaguePosition,
			teamStats.pointsFromFirst,
			teamStats.pointsFromCL,
			teamStats.pointsFromRelegation,
		);

		// Calculate days since last match
		const daysSinceLastMatch =
			competitiveMatches.length > 0
				? calculateDaysSinceLastMatch(competitiveMatches[0].date)
				: 30;

		return {
			id: teamId,
			name: teamName,
			stats: teamStats,
			mind,
			mood,
			dna,
			safetyFlags,
			elo,
			daysSinceLastMatch,
			lastHomeMatches: homeMatches.slice(0, 10),
			lastAwayMatches: awayMatches.slice(0, 10),
			seasonsInLeague,
		};
	},

	/**
	 * Calculate DNA layer from matches and stats
	 */
	calculateDNAFromMatches(
		matches: ProcessedMatch[],
		stats: RawTeamStats | null,
	): DNALayer {
		// Use the stats-calculator's calculateDNALayer if we have enough matches
		if (matches.length >= 10) {
			return calculateDNALayer(matches);
		}

		// Otherwise, build from API stats
		const totalGames = stats?.fixtures.played.total ?? 0;
		const totalGoalsFor = stats?.goals.for.total.total ?? 0;
		const totalGoalsAgainst = stats?.goals.against.total.total ?? 0;
		const cleanSheets = stats?.clean_sheet.total ?? 0;
		const failedToScore = stats?.failed_to_score.total ?? 0;

		// Calculate most played formation
		const lineups = stats?.lineups ?? [];
		const mostPlayedFormation =
			lineups.sort((a, b) => b.played - a.played)[0]?.formation ?? "4-3-3";

		// Build formation frequency map
		const formationFrequency: Record<string, number> = {};
		const totalFormationGames = lineups.reduce((sum, l) => sum + l.played, 0);
		for (const lineup of lineups) {
			if (totalFormationGames > 0) {
				formationFrequency[lineup.formation] =
					(lineup.played / totalFormationGames) * 100;
			}
		}

		const avgGoalsPerGame = totalGames > 0 ? totalGoalsFor / totalGames : 0;
		const avgGoalsConceded =
			totalGames > 0 ? totalGoalsAgainst / totalGames : 0;

		// Estimate BTTS and Over/Under goals rates by line (fallback)
		const estimatedBttsRate =
			avgGoalsPerGame > 0 && avgGoalsConceded > 0
				? Math.min(80, (avgGoalsPerGame + avgGoalsConceded) * 20)
				: 50;

		const combinedAvgTotalGoals = avgGoalsPerGame + avgGoalsConceded;
		const goalLineOverPct: GoalLineOverPctMap = {};
		for (const line of DEFAULT_GOAL_LINES) {
			const pct = Math.max(
				5,
				Math.min(95, 50 + (combinedAvgTotalGoals - line) * 20),
			);
			goalLineOverPct[String(line) as GoalLineKey] = pct;
		}

		return {
			mostPlayedFormation,
			formationFrequency,
			goalLineOverPct,
			cleanSheetPercentage:
				totalGames > 0 ? (cleanSheets / totalGames) * 100 : 0,
			failedToScorePercentage:
				totalGames > 0 ? (failedToScore / totalGames) * 100 : 0,
			bttsYesRate: estimatedBttsRate,
			goalMinutesScoring: {
				"0-15": 16,
				"16-30": 16,
				"31-45": 18,
				"46-60": 16,
				"61-75": 17,
				"76-90": 17,
			},
			goalMinutesConceding: {
				"0-15": 14,
				"16-30": 15,
				"31-45": 18,
				"46-60": 16,
				"61-75": 18,
				"76-90": 19,
			},
			isLateStarter: false,
			dangerZones: [],
			firstHalfGoalPercentage: 45,
			avgGoalsPerGame,
			avgGoalsConcededPerGame: avgGoalsConceded,
		};
	},

	/**
	 * Calculate team statistics from API stats and standings
	 */
	calculateTeamStats(
		stats: RawTeamStats | null,
		standingsData: TeamStandingsData | null = null,
		matches: ProcessedMatch[] = [],
	): TeamStatistics {
		const MAX_MATCHES_FOR_FALLBACK = 30;

		const calculateAvg = (values: number[]): number =>
			values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;

		const deriveGoalRatesFromMatches = (allMatches: ProcessedMatch[]) => {
			const sample = allMatches.slice(0, MAX_MATCHES_FOR_FALLBACK);
			const home = sample.filter((m) => m.isHome);
			const away = sample.filter((m) => !m.isHome);

			const avgGoalsScored = calculateAvg(sample.map((m) => m.goalsScored));
			const avgGoalsConceded = calculateAvg(sample.map((m) => m.goalsConceded));

			const homeAvgScored =
				home.length > 0
					? calculateAvg(home.map((m) => m.goalsScored))
					: avgGoalsScored;
			const homeAvgConceded =
				home.length > 0
					? calculateAvg(home.map((m) => m.goalsConceded))
					: avgGoalsConceded;
			const awayAvgScored =
				away.length > 0
					? calculateAvg(away.map((m) => m.goalsScored))
					: avgGoalsScored;
			const awayAvgConceded =
				away.length > 0
					? calculateAvg(away.map((m) => m.goalsConceded))
					: avgGoalsConceded;

			return {
				avgGoalsScored,
				avgGoalsConceded,
				homeAvgScored,
				homeAvgConceded,
				awayAvgScored,
				awayAvgConceded,
			};
		};

		// Use standings data for position and motivation distances when available
		const leaguePosition = standingsData?.rank ?? 10;
		const pointsFromFirst = standingsData?.pointsFromFirst ?? 10;
		const pointsFromCL = standingsData?.pointsFromCL ?? 10;
		const pointsFromRelegation = standingsData?.pointsFromRelegation ?? 10;

		if (!stats) {
			return {
				form: standingsData?.form ?? "",
				leaguePosition,
				avgGoalsScored: 1.2,
				avgGoalsConceded: 1.2,
				homeAvgScored: 1.4,
				homeAvgConceded: 1.0,
				awayAvgScored: 1.0,
				awayAvgConceded: 1.4,
				pointsFromCL,
				pointsFromRelegation,
				pointsFromFirst,
				gamesPlayed: standingsData?.played ?? 0,
				cleanSheetsTotal: 0,
			};
		}

		// IMPORTANT: Some competitions (especially cups) can have tiny samples early on
		// (e.g. 1 match total, 0 home matches). Using these stats will produce nonsense
		// like 0.0 home averages and extreme goal/game rates. In those cases, derive
		// scoring rates from recent finished matches instead.
		const playedTotal = stats.fixtures.played.total ?? 0;
		const playedHome = stats.fixtures.played.home ?? 0;
		const playedAway = stats.fixtures.played.away ?? 0;
		const shouldFallbackToMatches =
			playedTotal < MIN_RELIABLE_STATS_GAMES ||
			playedHome === 0 ||
			playedAway === 0;

		const parsedFromStats = {
			avgGoalsScored: parseFloat(stats.goals.for.average.total) || 0,
			avgGoalsConceded: parseFloat(stats.goals.against.average.total) || 0,
			homeAvgScored: parseFloat(stats.goals.for.average.home) || 0,
			homeAvgConceded: parseFloat(stats.goals.against.average.home) || 0,
			awayAvgScored: parseFloat(stats.goals.for.average.away) || 0,
			awayAvgConceded: parseFloat(stats.goals.against.average.away) || 0,
		};

		const derivedFromMatches =
			matches.length > 0 ? deriveGoalRatesFromMatches(matches) : null;

		const goalRates =
			shouldFallbackToMatches && derivedFromMatches
				? derivedFromMatches
				: parsedFromStats;

		return {
			form: stats.form ?? standingsData?.form ?? "",
			leaguePosition,
			avgGoalsScored: goalRates.avgGoalsScored,
			avgGoalsConceded: goalRates.avgGoalsConceded,
			homeAvgScored: goalRates.homeAvgScored,
			homeAvgConceded: goalRates.homeAvgConceded,
			awayAvgScored: goalRates.awayAvgScored,
			awayAvgConceded: goalRates.awayAvgConceded,
			pointsFromCL,
			pointsFromRelegation,
			pointsFromFirst,
			gamesPlayed: playedTotal,
			cleanSheetsTotal: stats.clean_sheet?.total ?? 0,
		};
	},

	/**
	 * Validate team stat sanity and surface warnings.
	 */
	validateTeamStatsSanity(homeTeam: TeamData, awayTeam: TeamData): string[] {
		const warnings: string[] = [];
		const MAX_AVG_GOALS = 4.0;

		const checkTeam = (label: string, team: TeamData) => {
			const avgScored = team.stats.avgGoalsScored;
			const avgConceded = team.stats.avgGoalsConceded;
			if (!Number.isFinite(avgScored) || !Number.isFinite(avgConceded)) {
				warnings.push(`${label} team goal averages are not finite`);
				return;
			}
			if (avgScored < 0 || avgConceded < 0) {
				warnings.push(`${label} team goal averages are negative`);
			}
			if (avgScored > MAX_AVG_GOALS) {
				warnings.push(
					`${label} team avgGoalsScored unusually high (${avgScored.toFixed(2)})`,
				);
			}
			if (avgConceded > MAX_AVG_GOALS) {
				warnings.push(
					`${label} team avgGoalsConceded unusually high (${avgConceded.toFixed(2)})`,
				);
			}
		};

		checkTeam("Home", homeTeam);
		checkTeam("Away", awayTeam);

		return warnings;
	},

	/**
	 * Validate simulation invariants and surface warnings.
	 */
	validateSimulationSanity(simulations: Simulation[]): string[] {
		const warnings: string[] = [];
		const SUM_TOLERANCE = 0.5;
		const MAX_TOTAL_ADJUSTMENT = 20;

		for (const sim of simulations) {
			const dist = sim.probabilityDistribution;
			let sum = 0;
			if (sim.scenarioType === "MatchOutcome") {
				sum = (dist.home ?? 0) + (dist.draw ?? 0) + (dist.away ?? 0);
			} else if (
				sim.scenarioType === "BothTeamsToScore" ||
				sim.scenarioType === "FirstHalfActivity"
			) {
				sum = (dist.yes ?? 0) + (dist.no ?? 0);
			} else if (sim.scenarioType === "TotalGoalsOverUnder") {
				sum = (dist.over ?? 0) + (dist.under ?? 0);
			}

			if (!Number.isFinite(sum)) {
				warnings.push(
					`Probability distribution contains NaN for ${sim.scenarioType}`,
				);
			} else if (Math.abs(sum - 100) > SUM_TOLERANCE) {
				warnings.push(
					`Probability distribution sum off for ${sim.scenarioType} (${sum.toFixed(
						2,
					)})`,
				);
			}

			if (
				typeof sim.totalAdjustment === "number" &&
				Math.abs(sim.totalAdjustment) > MAX_TOTAL_ADJUSTMENT
			) {
				warnings.push(
					`Large total adjustment for ${sim.scenarioType} (${sim.totalAdjustment.toFixed(
						2,
					)})`,
				);
			}

			if (sim.factorScores) {
				for (const [key, value] of Object.entries(sim.factorScores)) {
					if (!Number.isFinite(value)) {
						warnings.push(
							`Non-finite factor score for ${sim.scenarioType}: ${key}`,
						);
					}
				}
			}
		}

		return warnings;
	},

	/**
	 * Count seasons in current league
	 */
	countSeasonsInLeague(matches: ProcessedMatch[], leagueId: number): number {
		const seasons = new Set<number>();
		for (const match of matches) {
			if (match.league.id === leagueId) {
				seasons.add(match.season);
			}
		}
		return seasons.size || 1;
	},

	/**
	 * Get formation from lineups array
	 */
	getFormationFromLineups(
		lineups:
			| Array<{ team: { id: number }; formation: string | null }>
			| undefined,
		teamId: number,
	): string | null {
		if (!lineups) return null;
		const lineup = lineups.find((l) => l.team.id === teamId);
		return lineup?.formation ?? null;
	},

	// ============================================================================
	// SIMULATIONS
	// ============================================================================

	/**
	 * Generate all scenario simulations
	 */
	generateSimulations(
		homeTeam: TeamData,
		awayTeam: TeamData,
		h2h: H2HData,
		context: PredictionMatchContext,
		injuries: FixtureInjuries | null,
		leagueStats?: { avgGoals: number; matches: number },
	): Simulation[] {
		const simulations: Simulation[] = [];

		// Calculate injury impacts for both teams
		// Pass team data for tier-proportional adjustments in uncapped mode
		const { homeAdjustments, awayAdjustments, homeImpact, awayImpact } =
			calculateInjuryAdjustments(injuries, homeTeam, awayTeam);

		// Log injury situation if significant
		if (homeImpact || awayImpact) {
			const summary = getInjurySituationSummary(homeImpact, awayImpact);
			console.log(`🏥 [Insights] Injury situation: ${summary}`);
		}

		const distributionModifiers = buildGoalDistributionModifiers({
			context,
			homeTeam,
			awayTeam,
			h2h,
			homeInjuryImpact: homeImpact,
			awayInjuryImpact: awayImpact,
			leagueStats,
		});

		// Both Teams To Score (injuries affect scoring likelihood)
		simulations.push(
			simulateBTTS(
				homeTeam,
				awayTeam,
				h2h,
				context,
				undefined,
				distributionModifiers,
			),
		);

		// Total Goals Over/Under (multi-line)
		for (const line of DEFAULT_GOAL_LINES) {
			simulations.push(
				simulateTotalGoalsOverUnder(
					homeTeam,
					awayTeam,
					h2h,
					context,
					line,
					undefined,
					distributionModifiers,
				),
			);
		}

		// Match Outcome
		simulations.push(
			simulateMatchOutcome(
				homeTeam,
				awayTeam,
				h2h,
				context,
				undefined,
				{
					homeAdjustments,
					awayAdjustments,
					homeImpact,
					awayImpact,
				},
				distributionModifiers,
			),
		);

		// First Half Activity
		simulations.push(
			simulateFirstHalfActivity(homeTeam, awayTeam, h2h, context),
		);

		// Apply injury adjustments to relevant simulations
		// Note: We add injury adjustments as explanatory factors for transparency.
		// MatchOutcome already consumes these adjustments inside `simulateMatchOutcome`,
		// so we skip it here to avoid double-counting.
		// 
		// For goal markets (BTTS, TotalGoals), we use goal-specific adjustments that
		// account for tier gaps (stronger team exploits weaker injured opponent).
		if (homeImpact || awayImpact) {
			// Build goal-market-specific adjustments
			const goalMarketAdjustments = buildGoalMarketInjuryAdjustments(
				homeImpact,
				awayImpact,
				homeTeam,
				awayTeam,
			);

			for (const sim of simulations) {
				if (sim.scenarioType === "MatchOutcome") continue;

				if (
					sim.scenarioType === "BothTeamsToScore" ||
					sim.scenarioType === "TotalGoalsOverUnder"
				) {
					// Use goal-market-specific adjustments (accounts for tier gap)
					sim.adjustmentsApplied = [
						...(sim.adjustmentsApplied || []),
						...goalMarketAdjustments,
					];
					const injuryAdjustmentTotal = goalMarketAdjustments.reduce(
						(sum, adj) => sum + adj.value,
						0,
					);
					sim.totalAdjustment =
						(sim.totalAdjustment || 0) + injuryAdjustmentTotal;
				} else {
					// For other markets (FirstHalfActivity), use raw adjustments
					sim.adjustmentsApplied = [
						...(sim.adjustmentsApplied || []),
						...homeAdjustments,
						...awayAdjustments,
					];
					const injuryAdjustmentTotal = [
						...homeAdjustments,
						...awayAdjustments,
					].reduce((sum, adj) => sum + adj.value, 0);
					sim.totalAdjustment =
						(sim.totalAdjustment || 0) + injuryAdjustmentTotal;
				}
			}
		}

		// Related scenarios (non-blocking, derived only from already computed simulations)
		return attachRelatedScenarios(simulations);
	},

	/**
	 * Build weighted league scoring profile (current + last season).
	 */
	async getWeightedLeagueStats(params: {
		db: D1Database;
		leagueId: number;
		season: number;
	}): Promise<{ avgGoals: number; matches: number } | undefined> {
		const current = await getLeagueStatsByProviderId(
			params.db,
			"api_football",
			params.leagueId,
			params.season,
		);
		const previous = await getLeagueStatsByProviderId(
			params.db,
			"api_football",
			params.leagueId,
			params.season - 1,
		);

		if (!current && !previous) return undefined;
		if (!current && previous) {
			return { avgGoals: previous.avg_goals, matches: previous.matches };
		}
		if (current && !previous) {
			return { avgGoals: current.avg_goals, matches: current.matches };
		}

		if (current && previous && current.matches < 10) {
			return {
				avgGoals: current.avg_goals * 0.3 + previous.avg_goals * 0.7,
				matches: current.matches,
			};
		}

		return current
			? { avgGoals: current.avg_goals, matches: current.matches }
			: undefined;
	},

	// ============================================================================
	// INSIGHTS
	// ============================================================================

	/**
	 * Generate all insights
	 */
	generateAllInsights(
		homeTeam: TeamData,
		awayTeam: TeamData,
		h2h: H2HData,
		homeMatches: ProcessedMatch[],
		awayMatches: ProcessedMatch[],
	): {
		homeInsights: Insight[];
		awayInsights: Insight[];
		h2hInsights: Insight[];
	} {
		// Detect patterns
		const homePatterns = detectTeamPatterns(
			homeMatches,
			homeTeam.mind,
			homeTeam.mood,
			homeTeam.name,
		);
		const awayPatterns = detectTeamPatterns(
			awayMatches,
			awayTeam.mind,
			awayTeam.mood,
			awayTeam.name,
		);
		const h2hPatterns = detectH2HPatterns(h2h, homeTeam.name, awayTeam.name);

		// If we have H2H data but no strong patterns trigger, provide a lightweight summary insight.
		if (h2hPatterns.length === 0 && h2h.h2hMatchCount >= 3) {
			const over25Pct = h2h.goalLineOverPct?.["2.5"] ?? 0;
			h2hPatterns.push({
				type: "H2H_SUMMARY" as unknown as Pattern["type"],
				severity: "LOW",
				priority: 55,
				description: `H2H summary for ${homeTeam.name} vs ${awayTeam.name}`,
				data: {
					homeTeamName: homeTeam.name,
					awayTeamName: awayTeam.name,
					matchCount: h2h.h2hMatchCount,
					homeWins: h2h.homeTeamWins,
					draws: h2h.draws,
					awayWins: h2h.awayTeamWins,
					bttsRate: Math.round(h2h.bttsPercentage),
					over25Rate: Math.round(over25Pct),
				},
			});
		}

		// Generate insights from patterns
		const homeInsights = generateInsights(
			getTopPatterns(homePatterns, 5),
			homeTeam.name,
		);
		const awayInsights = generateInsights(
			getTopPatterns(awayPatterns, 5),
			awayTeam.name,
		);
		const h2hInsights = generateInsights(getTopPatterns(h2hPatterns, 3));

		return {
			homeInsights: getTopInsights(homeInsights, 5),
			awayInsights: getTopInsights(awayInsights, 5),
			h2hInsights: getTopInsights(h2hInsights, 3),
		};
	},

	// ============================================================================
	// DATA QUALITY & CONFIDENCE
	// ============================================================================

	/**
	 * Assess overall data quality
	 */
	assessDataQuality(
		homeTeam: TeamData,
		awayTeam: TeamData,
		h2h: H2HData,
	): DataQuality {
		const warnings: string[] = [];

		// Mind data quality
		const homeMindQuality = assessMindDataQuality(homeTeam.mind);
		const awayMindQuality = assessMindDataQuality(awayTeam.mind);
		const mindQuality: ConfidenceLevel =
			homeMindQuality === "HIGH" && awayMindQuality === "HIGH"
				? "HIGH"
				: homeMindQuality === "LOW" || awayMindQuality === "LOW"
					? "LOW"
					: "MEDIUM";

		if (mindQuality === "LOW") {
			warnings.push("Limited historical data for one or both teams");
		}

		// Mood data quality (based on recent matches)
		const homeMoodMatches = homeTeam.mood.formString.length;
		const awayMoodMatches = awayTeam.mood.formString.length;
		const moodQuality: ConfidenceLevel =
			homeMoodMatches >= 8 && awayMoodMatches >= 8
				? "HIGH"
				: homeMoodMatches < 5 || awayMoodMatches < 5
					? "LOW"
					: "MEDIUM";

		if (moodQuality === "LOW") {
			warnings.push("Limited recent form data");
		}

		// H2H quality
		const h2hQuality: ConfidenceLevel =
			h2h.h2hMatchCount >= 8
				? "HIGH"
				: h2h.h2hMatchCount >= 3
					? "MEDIUM"
					: "LOW";

		if (h2hQuality === "LOW") {
			warnings.push("Limited head-to-head history");
		}

		// Calculate overall multiplier
		const qualityToValue = (q: ConfidenceLevel): number =>
			q === "HIGH" ? 1.0 : q === "MEDIUM" ? 0.8 : 0.6;

		const overallMultiplier =
			(qualityToValue(mindQuality) +
				qualityToValue(moodQuality) +
				qualityToValue(h2hQuality)) /
			3;

		return {
			mindDataQuality: mindQuality,
			moodDataQuality: moodQuality,
			h2hDataQuality: h2hQuality,
			overallConfidenceMultiplier: overallMultiplier,
			warnings,
		};
	},

	/**
	 * Calculate overall confidence from simulations and data quality
	 */
	calculateOverallConfidence(
		simulations: Simulation[],
		dataQuality: DataQuality,
	): ConfidenceLevel {
		// Count confidence levels across simulations
		let highCount = 0;
		let lowCount = 0;

		for (const sim of simulations) {
			if (sim.modelReliability === "HIGH") highCount++;
			if (sim.modelReliability === "LOW") lowCount++;
		}

		// Factor in data quality
		if (dataQuality.overallConfidenceMultiplier < 0.7) {
			return "LOW";
		}

		if (lowCount >= 2) return "LOW";
		if (highCount >= 2 && dataQuality.overallConfidenceMultiplier >= 0.85)
			return "HIGH";
		return "MEDIUM";
	},

	// ============================================================================
	// RESPONSE BUILDING
	// ============================================================================

	/**
	 * Build team context for response
	 */
	buildTeamContext(team: TeamData, matchType: MatchType): TeamContext {
		return {
			id: team.id,
			name: team.name,
			form: team.mood.formString,
			...(matchType === "LEAGUE"
				? { leaguePosition: team.stats.leaguePosition }
				: {}),
			daysSinceLastMatch: team.daysSinceLastMatch,
			...(matchType === "LEAGUE"
				? { motivation: team.safetyFlags.motivation }
				: {}),
			mind: {
				performanceTier: team.mind.tier,
				tier: team.mind.tier,
				efficiencyIndex: team.mind.efficiencyIndex,
				tierIsDivisionAware: false,
			},
			mood: {
				performanceTier: team.mood.tier,
				tier: team.mood.tier,
				isSleepingGiant: team.mood.isSleepingGiant,
				isOverPerformer: team.mood.isOverPerformer,
				tierIsDivisionAware: false,
			},
			dna: {
				mostPlayedFormation: team.dna.mostPlayedFormation,
				goalLineOverPct: team.dna.goalLineOverPct,
				cleanSheetPercentage: team.dna.cleanSheetPercentage,
				isLateStarter: team.dna.isLateStarter,
			},
			...(team.elo
				? {
						elo: {
							rating: team.elo.rating,
							games: team.elo.games,
							confidence: team.elo.confidence,
						},
					}
				: {}),
		};
	},

	/**
	 * Build inputs snapshot for D1 storage
	 * Freezes the exact inputs used at generation time
	 */
	buildInputsSnapshot(
		homeTeam: TeamData,
		awayTeam: TeamData,
	): InputsSnapshotData {
		return {
			// Standings-derived
			home_rank: homeTeam.stats.leaguePosition,
			away_rank: awayTeam.stats.leaguePosition,
			home_points_from_first: homeTeam.stats.pointsFromFirst,
			away_points_from_first: awayTeam.stats.pointsFromFirst,
			home_points_from_cl: homeTeam.stats.pointsFromCL,
			away_points_from_cl: awayTeam.stats.pointsFromCL,
			home_points_from_relegation: homeTeam.stats.pointsFromRelegation,
			away_points_from_relegation: awayTeam.stats.pointsFromRelegation,

			// Form
			home_form: homeTeam.mood.formString,
			away_form: awayTeam.mood.formString,

			// Mind
			home_mind_tier: homeTeam.mind.tier,
			away_mind_tier: awayTeam.mind.tier,
			home_efficiency_index: homeTeam.mind.efficiencyIndex,
			away_efficiency_index: awayTeam.mind.efficiencyIndex,

			// Mood
			home_mood_tier: homeTeam.mood.tier,
			away_mood_tier: awayTeam.mood.tier,
			home_is_sleeping_giant: homeTeam.mood.isSleepingGiant,
			away_is_sleeping_giant: awayTeam.mood.isSleepingGiant,
			home_is_over_performer: homeTeam.mood.isOverPerformer,
			away_is_over_performer: awayTeam.mood.isOverPerformer,

			// Safety
			home_motivation: homeTeam.safetyFlags.motivation,
			away_motivation: awayTeam.safetyFlags.motivation,

			// DNA summary
			home_btts_rate: homeTeam.dna.bttsYesRate,
			away_btts_rate: awayTeam.dna.bttsYesRate,
			home_most_played_formation: homeTeam.dna.mostPlayedFormation,
			away_most_played_formation: awayTeam.dna.mostPlayedFormation,

			// Metadata
			snapshot_version: "1.0.0",
		};
	},

	// ============================================================================
	// D1 PERSISTENCE
	// ============================================================================

	/**
	 * Persist league with its standings (grouped)
	 * Returns the internal league ID for use by team context
	 */
	async persistLeagueWithStandings(
		db: D1Database,
		league: {
			id: number;
			name: string;
			country: string;
			logo: string;
			flag: string | null;
		},
		standings: StandingsData | null,
	): Promise<number> {
		// 1. Upsert league entity
		const leagueInternalId = await upsertLeague(
			db,
			{
				name: league.name,
				country: league.country,
				logo: league.logo,
				flag: league.flag,
			},
			"api_football",
			league.id,
		);
		console.log(
			`✅ [D1] Upserted league: ${league.name} (internal: ${leagueInternalId})`,
		);

		// 2. If standings exist, upsert all teams in standings + standings rows
		if (standings) {
			const usableLeagueCountry =
				typeof league.country === "string" &&
				league.country !== "World" &&
				league.country !== "Europe" &&
				league.country !== "International"
					? league.country
					: undefined;

			// First, ensure all teams in standings exist in D1 and build provider→internal ID map
			const teamIdMap = new Map<number, number>();
			for (const row of standings.rows) {
				const internalId = await upsertTeam(
					db,
					{ name: row.teamName, country: usableLeagueCountry },
					"api_football",
					row.teamId,
				);
				teamIdMap.set(row.teamId, internalId);
			}

			// Build standings rows insert data with INTERNAL team IDs and denormalized names
			const standingsRows: StandingsCurrentRowInsert[] = standings.rows.map(
				(row) => {
					const internalTeamId = teamIdMap.get(row.teamId);
					if (!internalTeamId) {
						throw new Error(
							`Failed to get internal ID for team ${row.teamName} (provider: ${row.teamId})`,
						);
					}
					return {
						league_id: leagueInternalId,
						season: standings.season,
						team_id: internalTeamId, // Use INTERNAL ID, not provider ID
						rank: row.rank,
						points: row.points,
						played: row.played,
						win: row.win,
						draw: row.draw,
						loss: row.loss,
						goals_for: row.goalsFor,
						goals_against: row.goalsAgainst,
						goal_diff: row.goalDiff,
						form: row.form,
						description: row.description,
						// Denormalized for faster reads (no JOINs needed)
						team_name: row.teamName,
						league_name: league.name,
					};
				},
			);

			// Upsert standings
			await upsertStandings(
				db,
				leagueInternalId,
				standings.season,
				"api_football",
				standingsRows,
			);
			console.log(
				`✅ [D1] Upserted standings: ${standings.rows.length} teams for league ${league.name}`,
			);
		}

		return leagueInternalId;
	},

	/**
	 * Persist team with its season context (grouped)
	 * Returns the internal team ID
	 */
	async persistTeamWithContext(
		db: D1Database,
		_env: InsightsEnv,
		team: { id: number; name: string; logo: string },
		leagueId: number,
		season: number,
		teamData: TeamData,
		now: string,
	): Promise<number> {
		const league = await getLeagueById(db, leagueId);
		const leagueCountry =
			typeof league?.country === "string" &&
			league.country !== "World" &&
			league.country !== "Europe" &&
			league.country !== "International"
				? league.country
				: undefined;

		// If the team already has a country in D1, do not fetch.
		const existing = await getTeamByProviderId(
			db,
			"api_football",
			team.id,
		).catch((error) => {
			console.error(
				`❌ [D1] getTeamByProviderId failed for provider=api_football teamId=${team.id}`,
				error,
			);
			return null;
		});
		const existingCountry = existing?.country ?? null;

		let country: string | undefined = leagueCountry;
		if (!country && !existingCountry) {
			// Team country enrichment should happen asynchronously via background jobs
			// to avoid blocking the insights request and consuming API quota.
			// For now, keep country undefined and rely on league country or existing data.
			country = undefined;
		}

		// 1. Upsert team entity
		const teamInternalId = await upsertTeam(
			db,
			{
				name: team.name,
				logo: team.logo,
				country: country ?? existingCountry ?? undefined,
			},
			"api_football",
			team.id,
		);
		console.log(
			`✅ [D1] Upserted team: ${team.name} (internal: ${teamInternalId})`,
		);

		// 2. Upsert team season context (Mind/Mood/DNA)
		try {
			const contextInsert = this.buildTeamSeasonContextInsert(
				teamInternalId,
				leagueId,
				season,
				teamData,
				now,
			);
			console.log(
				`📝 [D1] Building context for ${team.name}: team_id=${teamInternalId}, league_id=${leagueId}, season=${season}`,
			);
			await upsertTeamSeasonContext(db, contextInsert);
			console.log(`✅ [D1] Upserted team context: ${team.name}`);
		} catch (error) {
			console.error(
				`❌ [D1] Failed to upsert team context for ${team.name}:`,
				error,
			);
			throw error; // Re-throw to surface the error
		}

		return teamInternalId;
	},

	/**
	 * Persist fetched data to D1 (non-blocking)
	 * Updates teams, leagues, standings, and team season context
	 */
	async persistToD1(
		env: InsightsEnv,
		fixture: FixtureWithLineups,
		fixtureId: number,
		generatedAt: string,
		fixtureStatus: string,
		inputsSnapshot: InputsSnapshotData,
		standings: StandingsData | null,
		homeTeamData: TeamData,
		awayTeamData: TeamData,
		cacheParams: Record<string, string>,
		response: BettingInsightsResponse,
	): Promise<void> {
		const db = env.ENTITIES_DB;
		const now = new Date().toISOString();

		try {
			// 1. League + Standings (grouped)
			const leagueInternalId = await this.persistLeagueWithStandings(
				db,
				fixture.league,
				standings,
			);

			// 2. Home Team + Context (grouped)
			await this.persistTeamWithContext(
				db,
				env,
				fixture.teams.home,
				leagueInternalId,
				fixture.league.season,
				homeTeamData,
				now,
			);

			// 3. Away Team + Context (grouped)
			await this.persistTeamWithContext(
				db,
				env,
				fixture.teams.away,
				leagueInternalId,
				fixture.league.season,
				awayTeamData,
				now,
			);

			// 4. Store in R2/Edge cache
			await cacheSet(env, "insights", cacheParams, response).catch((err) =>
				console.error(`❌ [Insights] Failed to cache insights:`, err),
			);

			// 5. Compute standings signature for regeneration detection
			const standingsSignature = this.computeStandingsSignature(
				fixture.league.season,
				inputsSnapshot,
			);

			// 6. Store immutable inputs snapshot in D1 (with signature)
			await insertInsightsSnapshot(db, {
				fixture_id: fixtureId,
				generated_at: generatedAt,
				source_provider: "api_football",
				fixture_status_at_generation: fixtureStatus,
				inputs_snapshot_json: createInputsSnapshotJson(inputsSnapshot),
				standings_signature: standingsSignature,
			}).catch((err) =>
				console.error(`❌ [Insights] Failed to store snapshot in D1:`, err),
			);

			console.log(`✅ [D1] All entities persisted for fixture ${fixtureId}`);
		} catch (error) {
			console.error(`❌ [D1] Error persisting entities:`, error);
			// Don't throw - this is non-blocking background work
		}
	},

	/**
	 * Compute standings-only signature for regeneration detection
	 * Format: "{season}|{home_rank},{away_rank}|{home_pf},{away_pf}|{home_pcl},{away_pcl}|{home_pr},{away_pr}"
	 * This signature only changes when standings-derived inputs change
	 */
	computeStandingsSignature(
		season: number,
		inputs: InputsSnapshotData,
	): string {
		return [
			season,
			`${inputs.home_rank},${inputs.away_rank}`,
			`${inputs.home_points_from_first},${inputs.away_points_from_first}`,
			`${inputs.home_points_from_cl},${inputs.away_points_from_cl}`,
			`${inputs.home_points_from_relegation},${inputs.away_points_from_relegation}`,
		].join("|");
	},

	/**
	 * Build TeamSeasonContextInsert from TeamData
	 */
	buildTeamSeasonContextInsert(
		teamId: number,
		leagueId: number,
		season: number,
		team: TeamData,
		now: string,
	): TeamSeasonContextInsert {
		return {
			team_id: teamId,
			league_id: leagueId,
			season,
			provider: "api_football",
			fetched_at: now,
			computed_at: now,
			algo_version: "1.0.0",
			weights_version: "2026-01-01",

			// TeamStatistics
			form: team.mood.formString,
			games_played: team.stats.gamesPlayed,
			avg_goals_scored: team.stats.avgGoalsScored,
			avg_goals_conceded: team.stats.avgGoalsConceded,
			home_avg_scored: team.stats.homeAvgScored,
			home_avg_conceded: team.stats.homeAvgConceded,
			away_avg_scored: team.stats.awayAvgScored,
			away_avg_conceded: team.stats.awayAvgConceded,

			// Mind Layer
			mind_tier: team.mind.tier,
			mind_efficiency_index: team.mind.efficiencyIndex,
			mind_avg_points_per_game: team.mind.avgPointsPerGame,
			mind_goal_difference: team.mind.goalDifference,
			mind_match_count: team.mind.matchCount,
			mind_has_sufficient_data: team.mind.hasSufficientData ? 1 : 0,

			// Mood Layer
			mood_tier: team.mood.tier,
			mood_mind_mood_gap: team.mood.mindMoodGap,
			mood_is_sleeping_giant: team.mood.isSleepingGiant ? 1 : 0,
			mood_is_over_performer: team.mood.isOverPerformer ? 1 : 0,
			mood_is_one_season_wonder: team.mood.isOneSeasonWonder ? 1 : 0,
			mood_form_string: team.mood.formString,
			mood_last_10_points: team.mood.last10Points,
			mood_last_10_goals_scored: team.mood.last10GoalsScored,
			mood_last_10_goals_conceded: team.mood.last10GoalsConceded,

			// DNA Layer (columns)
			dna_most_played_formation: team.dna.mostPlayedFormation,
			dna_clean_sheet_percentage: team.dna.cleanSheetPercentage,
			dna_failed_to_score_percentage: team.dna.failedToScorePercentage,
			dna_btts_yes_rate: team.dna.bttsYesRate,
			dna_is_late_starter: team.dna.isLateStarter ? 1 : 0,
			dna_first_half_goal_percentage: team.dna.firstHalfGoalPercentage,
			dna_avg_goals_per_game: team.dna.avgGoalsPerGame,
			dna_avg_goals_conceded_per_game: team.dna.avgGoalsConcededPerGame,

			// DNA Layer (JSON)
			dna_formation_frequency_json: JSON.stringify(team.dna.formationFrequency),
			dna_goal_line_over_pct_json: JSON.stringify(team.dna.goalLineOverPct),
			dna_goal_minutes_scoring_json: JSON.stringify(
				team.dna.goalMinutesScoring,
			),
			dna_goal_minutes_conceding_json: JSON.stringify(
				team.dna.goalMinutesConceding,
			),
			dna_danger_zones_json: JSON.stringify(team.dna.dangerZones),

			// Safety Flags
			safety_regression_risk: team.safetyFlags.regressionRisk ? 1 : 0,
			safety_motivation_clash: team.safetyFlags.motivationClash ? 1 : 0,
			safety_live_dog: team.safetyFlags.liveDog ? 1 : 0,
			safety_motivation: team.safetyFlags.motivation,
			safety_consecutive_wins: team.safetyFlags.consecutiveWins,

			// Metadata
			days_since_last_match: team.daysSinceLastMatch,
			seasons_in_league: team.seasonsInLeague,
		};
	},
};

import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { isValidTimezone } from "../timezones";
import { type FixturesEnv, fixturesService } from "./fixtures.service";
import { parseH2HParam } from "./utils";

export const createFixturesRoutes = () => {
	const fixtures = new Hono<{ Bindings: FixturesEnv }>();

	// Combined schema that handles both fixture list and fixture detail
	const fixturesQuerySchema = z.object({
		// Fixture detail parameter (when present, returns single fixture)
		id: z
			.string()
			.regex(/^\d+$/, "Fixture ID must be a number")
			.transform((val) => parseInt(val, 10))
			.optional(),
		// Team fixtures parameter (when present, returns team's recent fixtures)
		team: z
			.string()
			.regex(/^\d+$/, "Team ID must be a number")
			.transform((val) => parseInt(val, 10))
			.optional(),
		// Number of recent fixtures to return (used with team parameter)
		last: z
			.string()
			.regex(/^\d+$/, "Last must be a number")
			.transform((val) => parseInt(val, 10))
			.optional()
			.default("50"),
		// Fixture list parameters
		date: z
			.string()
			.regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
			.optional(),
		from: z
			.string()
			.regex(/^\d{4}-\d{2}-\d{2}$/, "From must be in YYYY-MM-DD format")
			.optional(),
		to: z
			.string()
			.regex(/^\d{4}-\d{2}-\d{2}$/, "To must be in YYYY-MM-DD format")
			.optional(),
		timezone: z
			.string()
			.refine((tz) => isValidTimezone(tz), {
				message: "Invalid timezone provided",
			})
			.default("UTC"),
		live: z.enum(["all"]).optional(),
	});

	// H2H query schema
	const h2hQuerySchema = z.object({
		h2h: z
			.string()
			.regex(/^\d+-\d+$/, "H2H must be in format team1-team2 (e.g., 33-34)"),
		last: z
			.string()
			.regex(/^\d+$/, "Last must be a number")
			.transform((val) => parseInt(val, 10))
			.optional()
			.default("10"),
	});

	// Injuries query schema
	const injuriesQuerySchema = z.object({
		fixture: z
			.string()
			.regex(/^\d+$/, "Fixture ID must be a number")
			.transform((val) => parseInt(val, 10)),
		season: z
			.string()
			.regex(/^\d+$/, "Season must be a number")
			.transform((val) => parseInt(val, 10)),
	});

	/**
	 * GET /fixtures - Unified fixtures endpoint
	 * - /fixtures?id={fixtureId} - Get single fixture detail
	 * - /fixtures?team={teamId}&last={last} - Get team's recent fixtures
	 * - /fixtures?date=2026-01-01 - List fixtures by date
	 * - /fixtures?live=all - List live fixtures
	 */
	fixtures.get(
		"/",
		zValidator("query", fixturesQuerySchema),
		async (context) => {
			const {
				id: fixtureId,
				team: teamId,
				last,
				date,
				from,
				to,
				timezone,
				live,
			} = context.req.valid("query");
			const requestStartTime = performance.now();

			// Route to fixture detail handler if 'id' is present
			if (fixtureId !== undefined) {
				return handleFixtureDetail(context, fixtureId, requestStartTime);
			}

			// Route to team fixtures handler if 'team' is present
			if (teamId !== undefined) {
				return handleTeamFixtures(context, teamId, last, requestStartTime);
			}

			// Otherwise, handle fixtures list
			return handleFixturesList(
				context,
				date,
				from,
				to,
				timezone,
				live,
				requestStartTime,
			);
		},
	);

	/**
	 * GET /fixtures/headtohead - Head-to-head fixtures between two teams
	 * - /fixtures/headtohead?h2h={team1}-{team2}&last={last}
	 */
	fixtures.get(
		"/headtohead",
		zValidator("query", h2hQuerySchema),
		async (context) => {
			const { h2h, last } = context.req.valid("query");
			const requestStartTime = performance.now();
			return handleH2HFixtures(context, h2h, last, requestStartTime);
		},
	);

	/**
	 * GET /fixtures/injuries - Get injuries for a fixture
	 * - /fixtures/injuries?fixture={fixtureId}&season={season}
	 */
	fixtures.get(
		"/injuries",
		zValidator("query", injuriesQuerySchema),
		async (context) => {
			const { fixture: fixtureId, season } = context.req.valid("query");
			const requestStartTime = performance.now();
			return handleInjuries(context, fixtureId, season, requestStartTime);
		},
	);

	return fixtures;
};

/**
 * Handle fixture detail request
 */
async function handleFixtureDetail(
	context: Parameters<Parameters<ReturnType<typeof Hono.prototype.get>>[1]>[0],
	fixtureId: number,
	requestStartTime: number,
) {
	try {
		const result = await fixturesService.getFixtureDetail({
			fixtureId,
			env: context.env,
			ctx: context.executionCtx,
		});

		const responseTime = (performance.now() - requestStartTime).toFixed(2);
		const fixture = result.data.response[0];

		console.log(
			`📊 [FixtureDetail] fixtureId=${fixtureId}, ` +
				`source=${result.source}, time=${responseTime}ms`,
		);

		// Set cache headers based on fixture status
		if (fixture) {
			const status = fixture.fixture.status.short;
			const timestamp = fixture.fixture.timestamp;
			const nowSeconds = Math.floor(Date.now() / 1000);
			const timeUntilMatch = timestamp - nowSeconds;

			// Live statuses
			const liveStatuses = ["LIVE", "1H", "2H", "HT", "ET", "BT", "P"];
			// Finished statuses
			const finishedStatuses = [
				"FT",
				"AET",
				"PEN",
				"PST",
				"CANC",
				"ABD",
				"AWD",
				"WO",
			];

			if (liveStatuses.includes(status)) {
				// Live: short cache
				context.header(
					"Cache-Control",
					"public, max-age=15, stale-while-revalidate=30",
				);
			} else if (finishedStatuses.includes(status)) {
				// Finished: long cache (7 days)
				context.header("Cache-Control", "public, max-age=604800");
			} else if (timeUntilMatch <= 45 * 60) {
				// 45 min before match: short cache (lineups)
				context.header(
					"Cache-Control",
					"public, max-age=15, stale-while-revalidate=30",
				);
			} else if (timeUntilMatch <= 8 * 60 * 60) {
				// 8 hours before: 1 hour cache
				context.header(
					"Cache-Control",
					"public, max-age=3600, stale-while-revalidate=7200",
				);
			} else if (timeUntilMatch <= 7 * 24 * 60 * 60) {
				// 7 days before: 6 hour cache
				context.header(
					"Cache-Control",
					"public, max-age=21600, stale-while-revalidate=43200",
				);
			} else {
				// Further future: 24 hour cache
				context.header(
					"Cache-Control",
					"public, max-age=86400, stale-while-revalidate=172800",
				);
			}
		} else {
			// Fixture not found: short cache
			context.header("Cache-Control", "public, max-age=60");
		}

		// Add custom headers for debugging
		context.header("X-Source", result.source);

		return context.json({
			status: "success",
			source: result.source,
			data: result.data,
		});
	} catch (error) {
		console.error("❌ [FixtureDetail] Error:", error);

		let errorMessage = "Failed to fetch fixture detail";
		let statusCode: 500 | 429 | 502 = 500;

		if (error instanceof Error) {
			if (error.message.includes("API rate limit")) {
				errorMessage = "API rate limit exceeded. Please try again later.";
				statusCode = 429;
			} else if (error.message.includes("API request failed")) {
				errorMessage = "External API request failed. Please try again later.";
				statusCode = 502;
			}
		}

		return context.json(
			{
				status: "error",
				message: errorMessage,
				error: error instanceof Error ? error.message : String(error),
			},
			statusCode,
		);
	}
}

/**
 * Handle fixtures list request
 */
async function handleFixturesList(
	context: Parameters<Parameters<ReturnType<typeof Hono.prototype.get>>[1]>[0],
	date: string | undefined,
	from: string | undefined,
	to: string | undefined,
	timezone: string,
	live: "all" | undefined,
	requestStartTime: number,
) {
	try {
		if ((from && !to) || (!from && to)) {
			throw new Error("Invalid range query: both from and to are required.");
		}

		const isRangeRequest = Boolean(from && to && from !== to);
		if (from && to && from > to) {
			throw new Error("Invalid range query: from must be <= to.");
		}

		const dateToUse = !isRangeRequest ? (date ?? from) : undefined;

		const result = isRangeRequest
			? await fixturesService.getFixturesRange({
					fromDate: from as string,
					toDate: to as string,
					timezone,
					env: context.env,
					ctx: context.executionCtx,
				})
			: await fixturesService.getFixtures({
					date: dateToUse,
					timezone,
					live,
					env: context.env,
					ctx: context.executionCtx,
				});

		// Count filtered matches
		let filteredMatchCount = 0;
		result.data.forEach((country) => {
			country.leagues.forEach((league) => {
				filteredMatchCount += league.matches.length;
			});
		});

		const responseTime = (performance.now() - requestStartTime).toFixed(2);

		console.log(
			`📊 [Response] date=${dateToUse || "today"}, timezone=${timezone}, ` +
				`source=${result.source}, originalCount=${result.originalMatchCount}, ` +
				`filteredCount=${filteredMatchCount}, time=${responseTime}ms`,
		);

		// Set cache headers based on data freshness
		const today = new Date().toISOString().split("T")[0];
		const isToday = !dateToUse || dateToUse === today;
		if (isRangeRequest) {
			context.header("Cache-Control", "no-store");
		} else if (isToday || live === "all") {
			// Today's data or live: short cache with stale-while-revalidate
			context.header(
				"Cache-Control",
				"public, max-age=15, stale-while-revalidate=30",
			);
		} else if (dateToUse && dateToUse > today) {
			// Future data: moderate cache
			context.header(
				"Cache-Control",
				"public, max-age=3600, stale-while-revalidate=7200",
			);
		} else {
			// Historical data: long cache
			context.header(
				"Cache-Control",
				"public, max-age=86400, stale-while-revalidate=604800",
			);
		}

		// Add custom headers for debugging
		context.header("X-Source", result.source);
		context.header("X-Timezone", timezone);

		return context.json({
			status: "success",
			date: dateToUse || today,
			...(isRangeRequest ? { from, to } : {}),
			timezone,
			source: result.source,
			matchCount: {
				original: result.originalMatchCount,
				filtered: filteredMatchCount,
			},
			data: result.data,
		});
	} catch (error) {
		console.error("❌ [Fixtures] Error:", error);

		let errorMessage = "Failed to fetch fixtures";
		let statusCode: 500 | 429 | 502 | 400 = 500;

		if (error instanceof Error) {
			if (error.message.includes("API rate limit")) {
				errorMessage = "API rate limit exceeded. Please try again later.";
				statusCode = 429;
			} else if (error.message.includes("API request failed")) {
				errorMessage = "External API request failed. Please try again later.";
				statusCode = 502;
			} else if (error.message.includes("Invalid range query")) {
				errorMessage = error.message;
				statusCode = 400;
			} else if (error.message.includes("Invalid timezone")) {
				errorMessage = error.message;
				statusCode = 400;
			}
		}

		return context.json(
			{
				status: "error",
				message: errorMessage,
				error: error instanceof Error ? error.message : String(error),
			},
			statusCode,
		);
	}
}

/**
 * Handle team fixtures request
 */
async function handleTeamFixtures(
	context: Parameters<Parameters<ReturnType<typeof Hono.prototype.get>>[1]>[0],
	teamId: number,
	last: number,
	requestStartTime: number,
) {
	try {
		const result = await fixturesService.getTeamFixtures({
			teamId,
			last,
			env: context.env,
			ctx: context.executionCtx,
		});

		const responseTime = (performance.now() - requestStartTime).toFixed(2);

		console.log(
			`📊 [TeamFixtures] teamId=${teamId}, last=${last}, ` +
				`source=${result.source}, count=${result.data.response?.length || 0}, time=${responseTime}ms`,
		);

		// Cache for 1 hour
		context.header(
			"Cache-Control",
			"public, max-age=3600, stale-while-revalidate=7200",
		);
		context.header("X-Source", result.source);

		return context.json({
			status: "success",
			teamId,
			last,
			source: result.source,
			data: result.data,
		});
	} catch (error) {
		console.error("❌ [TeamFixtures] Error:", error);

		let errorMessage = "Failed to fetch team fixtures";
		let statusCode: 500 | 429 | 502 = 500;

		if (error instanceof Error) {
			if (error.message.includes("API rate limit")) {
				errorMessage = "API rate limit exceeded. Please try again later.";
				statusCode = 429;
			} else if (error.message.includes("API request failed")) {
				errorMessage = "External API request failed. Please try again later.";
				statusCode = 502;
			}
		}

		return context.json(
			{
				status: "error",
				message: errorMessage,
				error: error instanceof Error ? error.message : String(error),
			},
			statusCode,
		);
	}
}

/**
 * Handle H2H fixtures request
 */
async function handleH2HFixtures(
	context: Parameters<Parameters<ReturnType<typeof Hono.prototype.get>>[1]>[0],
	h2h: string,
	last: number,
	requestStartTime: number,
) {
	try {
		// Parse H2H parameter
		const parsed = parseH2HParam(h2h);
		if (!parsed) {
			return context.json(
				{
					status: "error",
					message:
						"Invalid H2H format. Expected format: team1-team2 (e.g., 33-34)",
				},
				400,
			);
		}

		const { team1, team2 } = parsed;

		const result = await fixturesService.getH2HFixtures({
			team1,
			team2,
			last,
			env: context.env,
			ctx: context.executionCtx,
		});

		const responseTime = (performance.now() - requestStartTime).toFixed(2);

		console.log(
			`📊 [H2HFixtures] h2h=${team1}-${team2}, last=${last}, ` +
				`source=${result.source}, count=${result.data.response?.length || 0}, time=${responseTime}ms`,
		);

		// Cache for 1 hour
		context.header(
			"Cache-Control",
			"public, max-age=3600, stale-while-revalidate=7200",
		);
		context.header("X-Source", result.source);

		return context.json({
			status: "success",
			h2h: { team1, team2 },
			last,
			source: result.source,
			data: result.data,
		});
	} catch (error) {
		console.error("❌ [H2HFixtures] Error:", error);

		let errorMessage = "Failed to fetch H2H fixtures";
		let statusCode: 500 | 429 | 502 = 500;

		if (error instanceof Error) {
			if (error.message.includes("API rate limit")) {
				errorMessage = "API rate limit exceeded. Please try again later.";
				statusCode = 429;
			} else if (error.message.includes("API request failed")) {
				errorMessage = "External API request failed. Please try again later.";
				statusCode = 502;
			}
		}

		return context.json(
			{
				status: "error",
				message: errorMessage,
				error: error instanceof Error ? error.message : String(error),
			},
			statusCode,
		);
	}
}

/**
 * Handle injuries request
 */
async function handleInjuries(
	context: Parameters<Parameters<ReturnType<typeof Hono.prototype.get>>[1]>[0],
	fixtureId: number,
	season: number,
	requestStartTime: number,
) {
	try {
		const result = await fixturesService.getInjuries({
			fixtureId,
			season,
			env: context.env,
			ctx: context.executionCtx,
		});

		const responseTime = (performance.now() - requestStartTime).toFixed(2);

		console.log(
			`📊 [Injuries] fixtureId=${fixtureId}, season=${season}, ` +
				`source=${result.source}, count=${result.data.response?.length || 0}, time=${responseTime}ms`,
		);

		// Cache for 1 hour
		context.header(
			"Cache-Control",
			"public, max-age=3600, stale-while-revalidate=7200",
		);
		context.header("X-Source", result.source);

		return context.json({
			status: "success",
			source: result.source,
			data: result.data,
		});
	} catch (error) {
		console.error("❌ [Injuries] Error:", error);

		let errorMessage = "Failed to fetch injuries";
		let statusCode: 500 | 429 | 502 = 500;

		if (error instanceof Error) {
			if (error.message.includes("API rate limit")) {
				errorMessage = "API rate limit exceeded. Please try again later.";
				statusCode = 429;
			} else if (error.message.includes("API request failed")) {
				errorMessage = "External API request failed. Please try again later.";
				statusCode = 502;
			}
		}

		return context.json(
			{
				status: "error",
				message: errorMessage,
				error: error instanceof Error ? error.message : String(error),
			},
			statusCode,
		);
	}
}

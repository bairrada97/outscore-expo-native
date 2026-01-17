import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { type StandingsEnv, standingsService } from "./standings.service";

export const createStandingsRoutes = () => {
	const standings = new Hono<{ Bindings: StandingsEnv }>();

	const standingsQuerySchema = z.object({
		league: z
			.string()
			.regex(/^\d+$/, "League ID must be a number")
			.transform((val) => parseInt(val, 10)),
		season: z
			.string()
			.regex(/^\d{4}$/, "Season must be a 4-digit year")
			.transform((val) => parseInt(val, 10)),
	});

	/**
	 * GET /standings - Get league standings for a specific season
	 * - /standings?league={leagueId}&season={year}
	 */
	standings.get(
		"/",
		zValidator("query", standingsQuerySchema),
		async (context) => {
			const { league, season } = context.req.valid("query");
			const requestStartTime = performance.now();

			try {
				const result = await standingsService.getStandings({
					league,
					season,
					env: context.env,
					ctx: context.executionCtx,
				});

				const responseTime = (performance.now() - requestStartTime).toFixed(2);

				console.log(
					`📊 [Standings] league=${league}, season=${season}, ` +
						`source=${result.source}, time=${responseTime}ms`,
				);

				// Cache for 1 hour (API updates hourly)
				context.header(
					"Cache-Control",
					"public, max-age=3600, stale-while-revalidate=7200",
				);
				context.header("X-Source", result.source);

				return context.json({
					status: "success",
					league,
					season,
					source: result.source,
					data: result.data,
				});
			} catch (error) {
				console.error("❌ [Standings] Error:", error);

				let errorMessage = "Failed to fetch standings";
				let statusCode: 500 | 429 | 502 = 500;

				if (error instanceof Error) {
					if (error.message.includes("API rate limit")) {
						errorMessage = "API rate limit exceeded. Please try again later.";
						statusCode = 429;
					} else if (error.message.includes("API request failed")) {
						errorMessage =
							"External API request failed. Please try again later.";
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
		},
	);

	return standings;
};

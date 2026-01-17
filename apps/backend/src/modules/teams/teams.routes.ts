import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { type TeamsEnv, teamsService } from "./teams.service";

export const createTeamsRoutes = () => {
	const teams = new Hono<{ Bindings: TeamsEnv }>();

	const teamStatisticsQuerySchema = z.object({
		league: z
			.string()
			.regex(/^\d+$/, "League ID must be a number")
			.transform((val) => parseInt(val, 10)),
		season: z
			.string()
			.regex(/^\d{4}$/, "Season must be a 4-digit year")
			.transform((val) => parseInt(val, 10)),
		team: z
			.string()
			.regex(/^\d+$/, "Team ID must be a number")
			.transform((val) => parseInt(val, 10)),
	});

	/**
	 * GET /teams/statistics - Get team statistics for a specific league and season
	 * - /teams/statistics?league={leagueId}&season={year}&team={teamId}
	 */
	teams.get(
		"/statistics",
		zValidator("query", teamStatisticsQuerySchema),
		async (context) => {
			const { league, season, team } = context.req.valid("query");
			const requestStartTime = performance.now();

			try {
				const result = await teamsService.getTeamStatistics({
					league,
					season,
					team,
					env: context.env,
					ctx: context.executionCtx,
				});

				const responseTime = (performance.now() - requestStartTime).toFixed(2);

				console.log(
					`📊 [TeamStatistics] league=${league}, season=${season}, team=${team}, ` +
						`source=${result.source}, time=${responseTime}ms`,
				);

				// Cache for 1 hour
				context.header(
					"Cache-Control",
					"public, max-age=3600, stale-while-revalidate=7200",
				);
				context.header("X-Source", result.source);

				return context.json({
					status: "success",
					league,
					season,
					team,
					source: result.source,
					data: result.data,
				});
			} catch (error) {
				console.error("❌ [TeamStatistics] Error:", error);

				let errorMessage = "Failed to fetch team statistics";
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

	return teams;
};

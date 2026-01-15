/**
 * Betting Insights Routes
 *
 * Hono route handler for the betting insights API endpoint.
 *
 * Endpoint: GET /fixtures/:fixtureId/insights
 *
 * Reference: docs/implementation-plan/phase5.md
 */

import { zValidator } from "@hono/zod-validator";
import { type Context, Hono } from "hono";
import { z } from "zod";
import {
  type InsightsEnv,
  InsightsNotAvailableError,
  insightsService,
} from "../services/insights.service";

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Live match statuses
 */
const LIVE_STATUSES = ["LIVE", "1H", "2H", "HT", "ET", "BT", "P"];

/**
 * Finished match statuses
 */
const FINISHED_STATUSES = [
	"FT",
	"AET",
	"PEN",
	"PST",
	"CANC",
	"ABD",
	"AWD",
	"WO",
];

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

/**
 * Path parameters schema
 */
const insightsParamsSchema = z.object({
	fixtureId: z
		.string()
		.regex(/^\d+$/, "Fixture ID must be a number")
		.transform((val) => parseInt(val, 10)),
});

// ============================================================================
// ROUTE CREATION
// ============================================================================

/**
 * Create betting insights routes
 */
export const createInsightsRoutes = () => {
	const insights = new Hono<{ Bindings: InsightsEnv }>();

	/**
	 * GET /fixtures/:fixtureId/insights - Get betting insights for a fixture
	 */
	insights.get(
		"/:fixtureId/insights",
		zValidator("param", insightsParamsSchema),
		async (context) => {
			const { fixtureId } = context.req.valid("param");
			const requestStartTime = performance.now();

			console.log(`🎯 [InsightsRoute] Request for fixture ${fixtureId}`);

			try {
				// Generate insights
				const result = await insightsService.generateInsights({
					fixtureId,
					env: context.env,
					ctx: context.executionCtx,
				});

				const responseTime = (performance.now() - requestStartTime).toFixed(2);

				console.log(
					`📊 [InsightsRoute] fixtureId=${fixtureId}, ` +
						`source=${result.source}, time=${responseTime}ms`,
				);

				// Set cache headers based on match status
				const status = result.data.match.status;
				setCacheHeaders(context, status, result.data.match.date);

				// Add custom headers for debugging
				context.header("X-Source", result.source);
				context.header("X-Generated-At", result.data.generatedAt);
				context.header("X-Response-Time", `${responseTime}ms`);

				return context.json({
					status: "success",
					source: result.source,
					data: result.data,
					meta: {
						generatedAt: result.data.generatedAt,
						confidence: result.data.overallConfidence,
						source: result.source,
						algorithmVersion: "1.0.0",
						weightsVersion: "2026-01-01",
						configHash: "a1b2c3d4",
					},
				});
			} catch (error) {
				console.error(
					`❌ [InsightsRoute] Error for fixture ${fixtureId}:`,
					error,
				);

				const errorMessage = getErrorMessage(error);
				const statusCode = getStatusCode(error);

				// Build error response with appropriate code for client handling
				const errorResponse: {
					status: "error";
					code: string;
					message: string;
					fixtureId: number;
					fixtureStatus?: string;
					error: string;
				} = {
					status: "error",
					code:
						error instanceof InsightsNotAvailableError
							? error.code
							: "INTERNAL_ERROR",
					message: errorMessage,
					fixtureId,
					error: error instanceof Error ? error.message : String(error),
				};

				// Add fixture status for InsightsNotAvailableError
				if (error instanceof InsightsNotAvailableError) {
					errorResponse.fixtureStatus = error.fixtureStatus;
				}

				return context.json(errorResponse, statusCode);
			}
		},
	);

	return insights;
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Set cache headers based on match status
 */
function setCacheHeaders(
	context: Context<{ Bindings: InsightsEnv }>,
	status: string,
	matchDate: string,
): void {
	const nowSeconds = Math.floor(Date.now() / 1000);
	const matchTimestamp = new Date(matchDate).getTime() / 1000;
	const timeUntilMatch = matchTimestamp - nowSeconds;

	if (LIVE_STATUSES.includes(status)) {
		// Live matches: short cache (15s max-age, 30s SWR)
		context.header(
			"Cache-Control",
			"public, max-age=15, stale-while-revalidate=30",
		);
	} else if (FINISHED_STATUSES.includes(status)) {
		// Finished matches: long cache (7 days)
		context.header("Cache-Control", "public, max-age=604800");
	} else if (timeUntilMatch <= 45 * 60) {
		// 45 min before match: short cache (15s) for lineups
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
}

/**
 * Get user-friendly error message
 */
function getErrorMessage(error: unknown): string {
	if (error instanceof InsightsNotAvailableError) {
		return error.message;
	}
	if (error instanceof Error) {
		if (error.message.includes("not found")) {
			return "Fixture not found";
		}
		if (error.message.includes("API rate limit")) {
			return "API rate limit exceeded. Please try again later.";
		}
		if (error.message.includes("API request failed")) {
			return "External API request failed. Please try again later.";
		}
	}
	return "Failed to generate betting insights";
}

/**
 * Get appropriate HTTP status code for error
 */
function getStatusCode(error: unknown): 400 | 404 | 410 | 429 | 500 | 502 {
	// InsightsNotAvailableError: 410 Gone (resource existed but is no longer available)
	if (error instanceof InsightsNotAvailableError) {
		return 410;
	}
	if (error instanceof Error) {
		if (error.message.includes("not found")) {
			return 404;
		}
		if (error.message.includes("API rate limit")) {
			return 429;
		}
		if (error.message.includes("API request failed")) {
			return 502;
		}
		if (
			error.message.includes("Invalid") ||
			error.message.includes("must be")
		) {
			return 400;
		}
	}
	return 500;
}

/**
 * Integration tests for insights.routes.ts
 *
 * Tests the full GET /fixtures/:fixtureId/insights endpoint including:
 * - Request validation
 * - Response structure
 * - Cache headers
 * - Error handling
 */

import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	createMockFinishedMatchResponse,
	createMockInsightsResponse,
	createMockLiveMatchResponse,
} from "../__fixtures__/mock-insights-response";
import type { BettingInsightsResponse } from "../types";

// Response type for successful insights API responses
interface InsightsApiResponse {
	status: "success";
	source: string;
	data: BettingInsightsResponse;
	meta: {
		generatedAt: string;
		confidence: string;
		source: string;
		algorithmVersion: string;
		weightsVersion?: string;
		configHash?: string;
	};
}

// Response type for error responses
interface InsightsErrorResponse {
	status: "error";
	code: string;
	message: string;
	fixtureId: number;
	fixtureStatus?: string;
	error: string;
}

// Response type for validation errors
interface ValidationErrorResponse {
	success: boolean;
}

// Mock the insights service module
vi.mock("../services/insights.service", () => {
	class InsightsNotAvailableErrorMock extends Error {
		code = "INSIGHTS_NOT_AVAILABLE";
		fixtureId: number;
		fixtureStatus: string;
		constructor(message: string, fixtureId: number, fixtureStatus: string) {
			super(message);
			this.name = "InsightsNotAvailableError";
			this.fixtureId = fixtureId;
			this.fixtureStatus = fixtureStatus;
		}
	}

	return {
		insightsService: {
			generateInsights: vi.fn(),
		},
		InsightsNotAvailableError: InsightsNotAvailableErrorMock,
	};
});

// Import after mock is set up
import {
	InsightsNotAvailableError,
	insightsService,
} from "../services/insights.service";
import { createInsightsRoutes } from "./insights.routes";

const mockGenerateInsights = vi.mocked(insightsService.generateInsights);

/**
 * Create a test app with proper execution context mocking
 */
function createTestApp() {
	const insightsRoutes = createInsightsRoutes();
	const app = new Hono();

	// Wrap the routes to provide a mock execution context
	app.use("/*", async (c, next) => {
		// Provide a mock executionCtx that won't throw
		Object.defineProperty(c, "executionCtx", {
			get: () => ({
				waitUntil: vi.fn(),
				passThroughOnException: vi.fn(),
			}),
		});
		await next();
	});

	app.route("/fixtures", insightsRoutes);
	return app;
}

describe("GET /fixtures/:fixtureId/insights", () => {
	let app: Hono;

	beforeEach(() => {
		vi.clearAllMocks();
		mockGenerateInsights.mockReset();
		app = createTestApp();
	});

	describe("request validation", () => {
		it("should reject non-numeric fixtureId", async () => {
			const res = await app.request("/fixtures/abc/insights");

			expect(res.status).toBe(400);
			const body = (await res.json()) as ValidationErrorResponse;
			expect(body.success).toBe(false);
		});

		it("should reject fixtureId with special characters", async () => {
			const res = await app.request("/fixtures/123-456/insights");

			expect(res.status).toBe(400);
		});

		it("should accept valid numeric fixtureId", async () => {
			mockGenerateInsights.mockResolvedValueOnce({
				data: createMockInsightsResponse(),
				source: "API",
			});

			const res = await app.request("/fixtures/1234567/insights");

			expect(res.status).toBe(200);
			expect(mockGenerateInsights).toHaveBeenCalledWith(
				expect.objectContaining({
					fixtureId: 1234567,
				}),
			);
		});
	});

	describe("successful responses", () => {
		it("should return valid BettingInsightsResponse structure", async () => {
			const mockResponse = createMockInsightsResponse();
			mockGenerateInsights.mockResolvedValueOnce({
				data: mockResponse,
				source: "API",
			});

			const res = await app.request("/fixtures/1234567/insights");
			const body = (await res.json()) as InsightsApiResponse;

			expect(res.status).toBe(200);
			expect(body.status).toBe("success");
			expect(body.data).toBeDefined();
			expect(body.data.fixtureId).toBe(1234567);
			expect(body.data.match).toBeDefined();
			expect(body.data.homeTeamContext).toBeDefined();
			expect(body.data.awayTeamContext).toBeDefined();
			expect(body.data.matchContext).toBeDefined();
			expect(Array.isArray(body.data.sanityWarnings)).toBe(true);
		});

		it("should include all 4 simulations", async () => {
			const mockResponse = createMockInsightsResponse();
			mockGenerateInsights.mockResolvedValueOnce({
				data: mockResponse,
				source: "API",
			});

			const res = await app.request("/fixtures/1234567/insights");
			const body = (await res.json()) as InsightsApiResponse;

			expect(body.data.simulations).toHaveLength(4);

			const scenarioTypes = body.data.simulations.map((s) => s.scenarioType);
			expect(scenarioTypes).toContain("BothTeamsToScore");
			expect(scenarioTypes).toContain("MatchOutcome");
			expect(scenarioTypes).toContain("TotalGoalsOverUnder");
			expect(scenarioTypes).toContain("FirstHalfActivity");
		});

		it("should include match context with matchType", async () => {
			const mockResponse = createMockInsightsResponse();
			mockGenerateInsights.mockResolvedValueOnce({
				data: mockResponse,
				source: "API",
			});

			const res = await app.request("/fixtures/1234567/insights");
			const body = (await res.json()) as InsightsApiResponse;

			expect(body.data.matchContext).toBeDefined();
			expect(body.data.matchContext.matchType).toBe("LEAGUE");
		});

		it("should include X-Source header", async () => {
			mockGenerateInsights.mockResolvedValueOnce({
				data: createMockInsightsResponse(),
				source: "API",
			});

			const res = await app.request("/fixtures/1234567/insights");

			expect(res.headers.get("X-Source")).toBe("API");
		});

		it("should include X-Generated-At header", async () => {
			mockGenerateInsights.mockResolvedValueOnce({
				data: createMockInsightsResponse(),
				source: "API",
			});

			const res = await app.request("/fixtures/1234567/insights");

			expect(res.headers.get("X-Generated-At")).toBeDefined();
		});

		it("should include X-Response-Time header", async () => {
			mockGenerateInsights.mockResolvedValueOnce({
				data: createMockInsightsResponse(),
				source: "API",
			});

			const res = await app.request("/fixtures/1234567/insights");

			const responseTime = res.headers.get("X-Response-Time");
			expect(responseTime).toBeDefined();
			expect(responseTime).toMatch(/^\d+(\.\d+)?ms$/);
		});

		it("should include meta information in response", async () => {
			mockGenerateInsights.mockResolvedValueOnce({
				data: createMockInsightsResponse(),
				source: "API",
			});

			const res = await app.request("/fixtures/1234567/insights");
			const body = (await res.json()) as InsightsApiResponse;

			expect(body.meta).toBeDefined();
			expect(body.meta.generatedAt).toBeDefined();
			expect(body.meta.confidence).toBeDefined();
			expect(body.meta.source).toBe("API");
			expect(body.meta.algorithmVersion).toBeDefined();
		});
	});

	describe("cache headers", () => {
		it("should set short cache for live match (max-age=15)", async () => {
			mockGenerateInsights.mockResolvedValueOnce({
				data: createMockLiveMatchResponse(),
				source: "API",
			});

			const res = await app.request("/fixtures/1234567/insights");
			const cacheControl = res.headers.get("Cache-Control");

			expect(cacheControl).toContain("max-age=15");
		});

		it("should set long cache for finished match (max-age=604800)", async () => {
			mockGenerateInsights.mockResolvedValueOnce({
				data: createMockFinishedMatchResponse(),
				source: "API",
			});

			const res = await app.request("/fixtures/1234567/insights");
			const cacheControl = res.headers.get("Cache-Control");

			expect(cacheControl).toContain("max-age=604800");
		});

		it("should set stale-while-revalidate for live matches", async () => {
			mockGenerateInsights.mockResolvedValueOnce({
				data: createMockLiveMatchResponse(),
				source: "API",
			});

			const res = await app.request("/fixtures/1234567/insights");
			const cacheControl = res.headers.get("Cache-Control");

			expect(cacheControl).toContain("stale-while-revalidate=30");
		});
	});

	describe("error handling", () => {
		it("should return 410 for finished match without cached insights", async () => {
			mockGenerateInsights.mockRejectedValueOnce(
				new InsightsNotAvailableError(
					"Insights not available for finished match",
					1234567,
					"FT",
				),
			);

			const res = await app.request("/fixtures/1234567/insights");
			const body = (await res.json()) as InsightsErrorResponse;

			expect(res.status).toBe(410);
			expect(body.status).toBe("error");
			expect(body.code).toBe("INSIGHTS_NOT_AVAILABLE");
			expect(body.fixtureStatus).toBe("FT");
		});

		it("should return 404 for non-existent fixture", async () => {
			mockGenerateInsights.mockRejectedValueOnce(
				new Error("Fixture not found"),
			);

			const res = await app.request("/fixtures/9999999/insights");

			expect(res.status).toBe(404);
		});

		it("should return 502 for API-Football failures", async () => {
			mockGenerateInsights.mockRejectedValueOnce(
				new Error("API request failed: 503 Service Unavailable"),
			);

			const res = await app.request("/fixtures/1234567/insights");

			expect(res.status).toBe(502);
		});

		it("should return 429 for rate limit errors", async () => {
			mockGenerateInsights.mockRejectedValueOnce(
				new Error("API rate limit exceeded"),
			);

			const res = await app.request("/fixtures/1234567/insights");

			expect(res.status).toBe(429);
		});

		it("should return 500 for unexpected errors", async () => {
			mockGenerateInsights.mockRejectedValueOnce(
				new Error("Unexpected internal error"),
			);

			const res = await app.request("/fixtures/1234567/insights");

			expect(res.status).toBe(500);
		});

		it("should include error message in response", async () => {
			mockGenerateInsights.mockRejectedValueOnce(
				new InsightsNotAvailableError("This match has finished", 1234567, "FT"),
			);

			const res = await app.request("/fixtures/1234567/insights");
			const body = (await res.json()) as InsightsErrorResponse;

			expect(body.message).toBe("This match has finished");
			expect(body.fixtureId).toBe(1234567);
		});
	});

	describe("insights content", () => {
		it("should include home team insights", async () => {
			mockGenerateInsights.mockResolvedValueOnce({
				data: createMockInsightsResponse(),
				source: "API",
			});

			const res = await app.request("/fixtures/1234567/insights");
			const body = (await res.json()) as InsightsApiResponse;

			expect(body.data.homeInsights).toBeDefined();
			expect(Array.isArray(body.data.homeInsights)).toBe(true);
		});

		it("should include away team insights", async () => {
			mockGenerateInsights.mockResolvedValueOnce({
				data: createMockInsightsResponse(),
				source: "API",
			});

			const res = await app.request("/fixtures/1234567/insights");
			const body = (await res.json()) as InsightsApiResponse;

			expect(body.data.awayInsights).toBeDefined();
			expect(Array.isArray(body.data.awayInsights)).toBe(true);
		});

		it("should include H2H insights", async () => {
			mockGenerateInsights.mockResolvedValueOnce({
				data: createMockInsightsResponse(),
				source: "API",
			});

			const res = await app.request("/fixtures/1234567/insights");
			const body = (await res.json()) as InsightsApiResponse;

			expect(body.data.h2hInsights).toBeDefined();
			expect(Array.isArray(body.data.h2hInsights)).toBe(true);
		});

		it("should include data quality assessment", async () => {
			mockGenerateInsights.mockResolvedValueOnce({
				data: createMockInsightsResponse(),
				source: "API",
			});

			const res = await app.request("/fixtures/1234567/insights");
			const body = (await res.json()) as InsightsApiResponse;

			expect(body.data.dataQuality).toBeDefined();
			expect(body.data.dataQuality.mindDataQuality).toBeDefined();
			expect(body.data.dataQuality.h2hDataQuality).toBeDefined();
		});
	});
});

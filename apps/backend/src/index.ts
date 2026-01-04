import { Hono } from "hono";
import {
  botProtection,
  createCors,
  createFixturesRoutes,
  type FixturesEnv,
  handleScheduledEvent,
  rateLimiter,
  type SchedulerEnv,
  secureHeaders,
} from "./modules";
import { getMetrics, logRequest } from "./utils";
import QuotaDurableObject from "./utils/quota-durable-object";
import RefreshSchedulerDurableObject from "./utils/refresh-scheduler-do";

/**
 * Environment bindings
 */
interface Env extends FixturesEnv, SchedulerEnv {
	APPROVED_ORIGINS?: string;
	OUTSCORE_RATE_LIMITER?: unknown; // Cloudflare Rate Limiter binding (not currently used)
	QUOTA_DO: DurableObjectNamespace;
	REFRESH_SCHEDULER_DO: DurableObjectNamespace;
}

/**
 * Create the Hono app
 */
const app = new Hono<{ Bindings: Env }>();

/**
 * Middleware: Secure Headers
 */
app.use(
	"*",
	secureHeaders({
		hsts: "max-age=63072000; includeSubDomains; preload",
		contentTypeOptions: "nosniff",
		frameOptions: "DENY",
		// API doesn't need CSP
		contentSecurityPolicy: false,
	}),
);

/**
 * Middleware: CORS (dynamic based on environment)
 */
app.use("*", async (context, next) => {
	const corsMiddleware = createCors(context.env.APPROVED_ORIGINS);
	return corsMiddleware(context, next);
});

/**
 * Middleware: Bot Protection (skip health checks)
 */
app.use("*", async (context, next) => {
	if (context.req.path === "/health") {
		return next();
	}
	return botProtection({
		blockEmptyUserAgent: true,
		blockKnownBots: true,
		checkCloudflareIp: true,
	})(context, next);
});

/**
 * Middleware: Rate Limiting
 */
app.use(
	"/fixtures*",
	rateLimiter({
		limit: 60,
		windowSec: 60,
		skip: (context) => context.req.path === "/health",
	}),
);

/**
 * Health check endpoint
 */
app.get("/health", (context) => {
	return context.json({
		status: "ok",
		timestamp: new Date().toISOString(),
	});
});

/**
 * Metrics endpoint (for monitoring)
 */
app.get("/metrics", (context) => {
	const metrics = getMetrics();
	return context.json({
		status: "ok",
		metrics,
	});
});

/**
 * Fixtures routes
 */
app.route("/fixtures", createFixturesRoutes());

/**
 * 404 handler
 */
app.notFound((context) => {
	return context.json(
		{
			status: "error",
			message: "Not found",
		},
		404,
	);
});

/**
 * Error handler
 * Note: We must add CORS headers here because the CORS middleware's
 * context.header() calls after `await next()` don't apply to error responses
 */
app.onError((error, context) => {
	console.error("❌ [Error]", error);

	// Get the origin from the request
	const requestOrigin = context.req.header("origin") || "";

	// Default allowed origins (same as in cors.ts)
	const defaultOrigins = [
		"https://outscore.live",
		"https://www.outscore.live",
		"http://localhost:3000",
		"http://localhost:8081",
		"http://10.0.2.2:3000",
	];

	// Check if origin is allowed (also check env variable)
	const envOrigins =
		context.env.APPROVED_ORIGINS?.split(",").map((o: string) => o.trim()) || [];
	const allowedOrigins = [...defaultOrigins, ...envOrigins];

	const isAllowed = allowedOrigins.includes(requestOrigin);

	// Create response with CORS headers
	const response = context.json(
		{
			status: "error",
			message: "Internal server error",
		},
		500,
	);

	// Add CORS headers to error response
	if (isAllowed && requestOrigin) {
		response.headers.set("Access-Control-Allow-Origin", requestOrigin);
		response.headers.set("Vary", "Origin");
	}
	response.headers.set(
		"Access-Control-Allow-Methods",
		"GET, POST, PUT, DELETE, OPTIONS",
	);
	response.headers.set(
		"Access-Control-Expose-Headers",
		"X-Response-Time, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, X-Source",
	);

	return response;
});

/**
 * Cloudflare Workers export
 */
export default {
	/**
	 * Handle HTTP requests
	 */
	async fetch(
		request: Request,
		env: Env,
		ctx: ExecutionContext,
	): Promise<Response> {
		const requestStartTime = performance.now();
		const url = new URL(request.url);

		// Process request
		const response = await app.fetch(request, env, ctx);

		// Add response time header
		const durationMs = performance.now() - requestStartTime;
		const responseTime = durationMs.toFixed(2);
		response.headers.set("X-Response-Time", `${responseTime}ms`);

		// Log request (non-blocking)
		ctx.waitUntil(
			Promise.resolve().then(() => {
				logRequest(
					url.pathname,
					request.method,
					response.status,
					durationMs,
					response.headers.get("X-Source") || undefined,
				);
			}),
		);

		return response;
	},

	/**
	 * Handle scheduled events (Cron Triggers)
	 */
	async scheduled(
		event: ScheduledEvent,
		env: Env,
		ctx: ExecutionContext,
	): Promise<void> {
		ctx.waitUntil(handleScheduledEvent(event, env));
	},
};

/**
 * Export Durable Object classes for Cloudflare Workers
 */
export { QuotaDurableObject, RefreshSchedulerDurableObject };

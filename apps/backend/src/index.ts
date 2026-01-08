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
 * Middleware: Bot Protection (skip health checks and metrics)
 */
app.use("*", async (context, next) => {
	// Skip bot protection for health checks and metrics
	if (context.req.path === "/health" || context.req.path === "/metrics") {
    return next();
  }
  return botProtection({
		blockEmptyUserAgent: false, // Allow browser requests (browsers always send User-Agent)
    blockKnownBots: true,
		checkCloudflareIp: false, // Disable strict IP check to prevent hanging
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
		"exp://127.0.0.1:8081", // Expo development server (iOS simulator)
		"exp://localhost:8081", // Expo development server (alternative)
		"http://10.0.2.2:3000", // Android emulator
		"http://10.0.2.2:8081", // Android emulator (alternative)
		"https://outscore-native-expo--di8o2dv5ph.expo.app"
	];

	// Check if origin is allowed (also check env variable)
	const envOrigins =
		context.env.APPROVED_ORIGINS?.split(",").map((o: string) => o.trim()) || [];
	const allowedOrigins = [...defaultOrigins, ...envOrigins];

	// Check if origin is allowed
	let isAllowed = false;
	let originToUse: string | null = null;

	if (!requestOrigin || requestOrigin === "null") {
		// No origin header (common for native apps) - allow it
		isAllowed = true;
		originToUse = "*";
	} else if (allowedOrigins.includes(requestOrigin)) {
		// Exact match
		isAllowed = true;
		originToUse = requestOrigin;
	} else if (requestOrigin.startsWith("exp://")) {
		// Any exp:// origin is allowed if we have exp:// origins configured
		const hasExpoOrigins = allowedOrigins.some((o) => o.startsWith("exp://"));
		if (hasExpoOrigins) {
			isAllowed = true;
			originToUse = requestOrigin;
		}
	}

	// Create response with CORS headers
	const response = context.json(
		{
			status: "error",
			message: "Internal server error",
		},
		500,
	);

	// Always add CORS headers to error response to prevent CORS errors
	if (isAllowed && originToUse) {
		response.headers.set("Access-Control-Allow-Origin", originToUse);
		if (originToUse !== "*") {
			response.headers.set("Vary", "Origin");
		}
	} else {
		// If origin doesn't match, still add CORS headers with wildcard for error responses
		// This prevents CORS errors from masking the actual error
		response.headers.set("Access-Control-Allow-Origin", "*");
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
 * Timeout wrapper to prevent infinite hangs
 */
async function withTimeout<T>(
	promise: Promise<T>,
	timeoutMs: number,
	errorMessage: string,
): Promise<T> {
	return Promise.race([
		promise,
		new Promise<T>((_, reject) =>
			setTimeout(() => reject(new Error(errorMessage)), timeoutMs),
		),
	]);
}

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

		try {
			// Process request with 30 second timeout
			const responsePromise = Promise.resolve(app.fetch(request, env, ctx));
			const response = await withTimeout(
				responsePromise,
				30000,
				"Request timeout after 30 seconds",
			);

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
		} catch (error) {
			console.error("❌ [Fetch] Error:", error);
			const durationMs = performance.now() - requestStartTime;

			// Return error response with CORS headers
			const errorResponse = new Response(
				JSON.stringify({
					status: "error",
					message:
						error instanceof Error ? error.message : "Internal server error",
				}),
				{
					status: 500,
					headers: {
						"Content-Type": "application/json",
						"Access-Control-Allow-Origin": "*",
						"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
					},
				},
			);

			// Log error (non-blocking)
			ctx.waitUntil(
				Promise.resolve().then(() => {
					logRequest(url.pathname, request.method, 500, durationMs, undefined);
				}),
			);

			return errorResponse;
		}
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

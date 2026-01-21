import { Hono } from "hono";
import type { CacheEnv } from "../cache";
import {
	getLeaguesRegistrySnapshot,
	refreshLeaguesRegistry,
} from "./leagues-registry.service";

export const createLeaguesRegistryRoutes = () => {
	const registry = new Hono<{
		Bindings: CacheEnv & {
			ADMIN_CACHE_TOKEN?: string;
			FOOTBALL_API_URL: string;
			RAPIDAPI_KEY: string;
		};
	}>();

	function requireAdminToken(
		headerValue: string | undefined,
		expected: string | undefined,
	): boolean {
		if (!expected) return false;
		if (!headerValue) return false;
		return headerValue === expected;
	}

	/**
	 * GET /registry/leagues - returns the latest leagues registry snapshot
	 */
	registry.get("/leagues", async (context) => {
		const snapshot = await getLeaguesRegistrySnapshot(context.env);
		if (!snapshot) {
			return context.json(
				{ status: "error", message: "Leagues registry not available yet." },
				503,
			);
		}

		context.header(
			"Cache-Control",
			"public, max-age=3600, stale-while-revalidate=86400",
		);
		return context.json({
			status: "success",
			data: snapshot,
		});
	});

	/**
	 * POST /registry/leagues/refresh - manually refresh the leagues registry (admin only)
	 */
	registry.post("/leagues/refresh", async (context) => {
		const token = context.req.header("x-admin-token");
		if (!requireAdminToken(token, context.env.ADMIN_CACHE_TOKEN)) {
			return context.json(
				{ status: "error", message: "Unauthorized" },
				401,
			);
		}

		const result = await refreshLeaguesRegistry(context.env);
		return context.json({
			status: "success",
			result,
		});
	});

	return registry;
};

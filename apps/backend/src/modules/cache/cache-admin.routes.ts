import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { cacheDelete, cacheGet, FINISHED_STATUSES } from ".";

type AdminCacheEnv = {
  FOOTBALL_KV: KVNamespace;
  FOOTBALL_CACHE: R2Bucket;
  ENTITIES_DB: D1Database;
  ADMIN_CACHE_TOKEN: string;
};

const purgeParamsSchema = z.object({
  fixtureId: z
    .string()
    .regex(/^\d+$/, "Fixture ID must be a number")
    .transform((val) => parseInt(val, 10)),
});

const purgeQuerySchema = z.object({
  force: z
    .string()
    .optional()
    .transform((v) => v === "true" || v === "1"),
});

function requireAdminToken(
  headerValue: string | undefined,
  expected: string | undefined,
): boolean {
  if (!expected) return false;
  if (!headerValue) return false;
  return headerValue === expected;
}

/**
 * Admin cache routes (protected)
 *
 * POST /admin/cache/insights/:fixtureId/purge
 * - Deletes Edge + R2 cache for a single fixture insights response
 * - Safety: refuses to purge finished fixtures unless ?force=true
 */
export function createCacheAdminRoutes() {
  const admin = new Hono<{ Bindings: AdminCacheEnv }>();

  admin.post(
    "/insights/:fixtureId/purge",
    zValidator("param", purgeParamsSchema),
    zValidator("query", purgeQuerySchema),
    async (c) => {
      const token = c.req.header("x-admin-token");
      if (!requireAdminToken(token, c.env.ADMIN_CACHE_TOKEN)) {
        return c.json(
          {
            status: "error",
            message: "Unauthorized",
          },
          401,
        );
      }

      const { fixtureId } = c.req.valid("param");
      const { force } = c.req.valid("query");

      const cacheParams = { fixtureId: String(fixtureId) };

      // If we have cached insights, block purging of finished fixtures unless forced.
      const cached = await cacheGet<{ match?: { status?: string } }>(
        c.env,
        "insights",
        cacheParams,
      );
      const status = cached.data?.match?.status ?? "";
      const isFinished = status ? FINISHED_STATUSES.includes(status) : false;

      if (isFinished && !force) {
        return c.json(
          {
            status: "error",
            message:
              "Refusing to purge finished fixture insights without force=true (historical insights cannot be regenerated).",
            fixtureId,
            matchStatus: status,
          },
          409,
        );
      }

      const deleted = await cacheDelete(c.env, "insights", cacheParams);

      return c.json({
        status: "success",
        fixtureId,
        matchStatus: status || undefined,
        forced: force,
        cache: deleted,
      });
    },
  );

  return admin;
}



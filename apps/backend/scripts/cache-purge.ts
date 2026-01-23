const args = process.argv.slice(2);
const fixtureId = args.find((arg) => /^\d+$/.test(arg));
const force = args.includes("--force") || args.includes("--force=true");

if (!fixtureId) {
  throw new Error(
    "Usage: bun scripts/cache-purge.ts <fixtureId> [--force]",
  );
}

const baseUrl =
  process.env.OUTSCORE_API_BASE_URL ||
  process.env.BASE_URL ||
  process.env.API_BASE_URL;

if (!baseUrl) {
  throw new Error(
    "Missing API base URL. Set OUTSCORE_API_BASE_URL (or BASE_URL / API_BASE_URL).",
  );
}

const url = new URL(
  `/admin/cache/insights/${fixtureId}/purge`,
  baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`,
);

if (force) {
  url.searchParams.set("force", "true");
}

const headers: Record<string, string> = {};
if (process.env.ADMIN_CACHE_TOKEN) {
  headers["x-admin-token"] = process.env.ADMIN_CACHE_TOKEN;
}

const response = await fetch(url.toString(), {
  method: "POST",
  headers,
});

const body = await response.text();

if (!response.ok) {
  throw new Error(
    `Cache purge failed (${response.status}): ${body || response.statusText}`,
  );
}

console.log(body);

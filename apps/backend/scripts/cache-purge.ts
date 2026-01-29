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

const controller = new AbortController();
const timeoutMs = 10_000;
const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

let response: Response;
try {
  response = await fetch(url.toString(), {
    method: "POST",
    headers,
    signal: controller.signal,
  });
} catch (error) {
  if (error instanceof DOMException && error.name === "AbortError") {
    throw new Error(`Cache purge timed out after ${timeoutMs / 1000}s.`);
  }
  throw error;
} finally {
  clearTimeout(timeoutId);
}

const body = await response.text();

if (!response.ok) {
  throw new Error(
    `Cache purge failed (${response.status}): ${body || response.statusText}`,
  );
}

console.log(body);

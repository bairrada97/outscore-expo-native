import type { FormattedMatch } from "@outscore/shared-types";

/**
 * Converts a string to a URL-friendly slug
 * - Converts to lowercase
 * - Replaces spaces and special characters with hyphens
 * - Removes consecutive hyphens
 */
function slugify(text: string): string {
	return text
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "") // Remove diacritics
		.replace(/[^a-z0-9]+/g, "-") // Replace non-alphanumeric with hyphens
		.replace(/^-+|-+$/g, "") // Remove leading/trailing hyphens
		.replace(/-+/g, "-"); // Remove consecutive hyphens
}

/**
 * Generates a URL-friendly slug from a fixture
 * Format: {home-team}-vs-{away-team}-{fixtureId}
 * Example: "tottenham-hotspur-vs-afc-bournemouth-1234567"
 */
export function generateFixtureSlug(fixture: FormattedMatch): string {
	// Guard against invalid fixture data
	if (!fixture?.id || !fixture?.teams?.home?.name || !fixture?.teams?.away?.name) {
		console.error("[generateFixtureSlug] Invalid fixture data:", fixture);
		// Return a fallback slug that won't break navigation
		return `invalid-fixture-${fixture?.id ?? "unknown"}`;
	}

	const homeTeam = slugify(fixture.teams.home.name);
	const awayTeam = slugify(fixture.teams.away.name);
	const fixtureId = fixture.id;
	return `${homeTeam}-vs-${awayTeam}-${fixtureId}`;
}

/**
 * Extracts the fixture ID from a slug
 * The ID is always the last segment after the final hyphen
 */
export function parseFixtureSlug(slug: string): number {
	// Guard against undefined or invalid slug
	if (!slug || slug === "undefined" || typeof slug !== "string") {
		console.error("[parseFixtureSlug] Invalid slug:", slug);
		return Number.NaN;
	}

	const parts = slug.split("-");
	return parseInt(parts[parts.length - 1], 10);
}

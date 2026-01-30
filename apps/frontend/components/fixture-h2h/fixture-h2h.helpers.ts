import type { RawFixtureForDisplay } from "@/queries/insights-by-fixture-id";
import type { FormattedMatch } from "@outscore/shared-types";

export type H2HFilterKey = "overall" | "home" | "away";

export const H2H_FILTER_OPTIONS: { key: H2HFilterKey; label: string }[] = [
	{ key: "overall", label: "Overall" },
	{ key: "home", label: "Home" },
	{ key: "away", label: "Away" },
];

/** Extended FormattedMatch with H2H type */
export type H2HFormattedMatch = FormattedMatch & {
	type: "H2H";
};

/** Convert RawFixtureForDisplay to H2HFormattedMatch */
export function rawFixtureToH2HMatch(
	raw: RawFixtureForDisplay,
): H2HFormattedMatch | null {
	// Validate required fields
	if (!raw?.id || !raw?.teams?.home?.name || !raw?.teams?.away?.name) {
		console.warn("[H2H] Invalid fixture data:", raw);
		return null;
	}

	// Extract time from date
	const dateObj = new Date(raw.date);
	const hours = dateObj.getHours().toString().padStart(2, "0");
	const minutes = dateObj.getMinutes().toString().padStart(2, "0");
	const time = `${hours}:${minutes}`;

	return {
		id: raw.id,
		date: raw.date,
		time,
		timestamp: raw.timestamp,
		timezone: "UTC",
		status: {
			long: raw.status?.long ?? "Match Finished",
			short: (raw.status?.short ?? "FT") as FormattedMatch["status"]["short"],
			elapsed: null,
		},
		teams: raw.teams,
		goals: raw.goals,
		score: raw.score,
		type: "H2H",
	};
}

/** Filter matches based on team's home/away status */
export function filterMatchesByVenue(
	fixtures: RawFixtureForDisplay[],
	teamId: number,
	filter: H2HFilterKey,
): RawFixtureForDisplay[] {
	if (filter === "overall") return fixtures;

	return fixtures.filter((f) => {
		const isHome = f.teams.home.id === teamId;
		if (filter === "home") return isHome;
		return !isHome; // away
	});
}

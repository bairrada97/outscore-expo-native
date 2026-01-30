import type { Fixture, FormattedMatch } from "@outscore/shared-types";

/**
 * Convert a Fixture (API response) to FormattedMatch (frontend format)
 * Used for H2H and team fixtures displays
 */
export function fixtureToFormattedMatch(fixture: Fixture): FormattedMatch {
	// Extract time from ISO date string (e.g., "2024-01-15T19:00:00+00:00" -> "19:00")
	const dateObj = new Date(fixture.fixture.date);
	const hours = dateObj.getHours().toString().padStart(2, "0");
	const minutes = dateObj.getMinutes().toString().padStart(2, "0");
	const time = `${hours}:${minutes}`;

	return {
		id: fixture.fixture.id,
		date: fixture.fixture.date,
		time,
		timestamp: fixture.fixture.timestamp,
		timezone: fixture.fixture.timezone,
		status: fixture.fixture.status,
		teams: fixture.teams,
		goals: fixture.goals,
		score: {
			fulltime: fixture.score.fulltime,
			penalty: fixture.score.penalty,
		},
	};
}

/**
 * Get match outcome from a specific team's perspective
 * @returns "W" for win, "D" for draw, "L" for loss, or null if match not finished
 */
export function getMatchOutcome(
	fixture: FormattedMatch,
	teamId: number,
): "W" | "D" | "L" | null {
	const homeWinner = fixture.teams.home.winner;
	const awayWinner = fixture.teams.away.winner;

	// If neither team has winner set, match is not finished or was a draw
	if (homeWinner === null && awayWinner === null) {
		// Check if it's a draw (goals are equal and match is finished)
		if (
			fixture.goals.home !== null &&
			fixture.goals.away !== null &&
			fixture.goals.home === fixture.goals.away
		) {
			return "D";
		}
		return null;
	}

	// Draw case
	if (homeWinner === false && awayWinner === false) {
		return "D";
	}

	const isHome = fixture.teams.home.id === teamId;

	if (isHome) {
		return homeWinner === true ? "W" : "L";
	}
	return awayWinner === true ? "W" : "L";
}

/**
 * Format date for H2H display
 * Same year: "20.02"
 * Different year: { day: "20.02", year: "2022" }
 */
export function formatH2HDate(dateStr: string): { day: string; year?: string } {
	const date = new Date(dateStr);
	const now = new Date();

	const day = date.getDate().toString().padStart(2, "0");
	const month = (date.getMonth() + 1).toString().padStart(2, "0");
	const formattedDay = `${day}.${month}`;

	if (date.getFullYear() !== now.getFullYear()) {
		return { day: formattedDay, year: date.getFullYear().toString() };
	}

	return { day: formattedDay };
}

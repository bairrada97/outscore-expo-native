import type {
  FormattedCountry,
  FormattedLeague,
  FormattedMatch,
} from "@outscore/shared-types";

function areStatusesEqual(
	prev: FormattedMatch["status"] | undefined,
	next: FormattedMatch["status"] | undefined,
): boolean {
	return (
		prev?.short === next?.short &&
		prev?.elapsed === next?.elapsed &&
		prev?.long === next?.long
	);
}

function areTeamsEqual(
	prev: FormattedMatch["teams"]["home"] | undefined,
	next: FormattedMatch["teams"]["home"] | undefined,
): boolean {
	return (
		prev?.name === next?.name &&
		prev?.logo === next?.logo &&
		prev?.winner === next?.winner
	);
}

function areScoresEqual(
	prev: FormattedMatch["score"] | undefined,
	next: FormattedMatch["score"] | undefined,
): boolean {
	const scoreKeys: Array<keyof NonNullable<FormattedMatch["score"]>> = [
		"fulltime",
		"penalty",
	];

	return scoreKeys.every((key) => {
		const prevScore = prev?.[key];
		const nextScore = next?.[key];
		return (
			prevScore?.home === nextScore?.home && prevScore?.away === nextScore?.away
		);
	});
}

function areGoalsEqual(
	prev: FormattedMatch["goals"] | undefined,
	next: FormattedMatch["goals"] | undefined,
): boolean {
	return prev?.home === next?.home && prev?.away === next?.away;
}

function areMatchesEqual(prev: FormattedMatch, next: FormattedMatch): boolean {
	if (prev.id !== next.id) return false;
	if (prev.date !== next.date) return false;
	if (prev.time !== next.time) return false;
	if (!areStatusesEqual(prev.status, next.status)) return false;
	if (!areTeamsEqual(prev.teams?.home, next.teams?.home)) return false;
	if (!areTeamsEqual(prev.teams?.away, next.teams?.away)) return false;
	if (!areGoalsEqual(prev.goals, next.goals)) return false;
	if (!areScoresEqual(prev.score, next.score)) return false;
	return true;
}

function areLeaguesEqualShallow(
	prev: FormattedLeague,
	next: FormattedLeague,
): boolean {
	return (
		prev.id === next.id &&
		prev.name === next.name &&
		(prev as { logo?: string }).logo === (next as { logo?: string }).logo
	);
}

function areCountriesEqualShallow(
	prev: FormattedCountry,
	next: FormattedCountry,
): boolean {
	return (
		prev.name === next.name &&
		(prev as { code?: string }).code === (next as { code?: string }).code &&
		(prev as { flag?: string }).flag === (next as { flag?: string }).flag
	);
}

function mergeMatches(
	prevMatches: FormattedMatch[],
	nextMatches: FormattedMatch[],
): FormattedMatch[] {
	const prevById = new Map(prevMatches.map((match) => [match.id, match]));
	const canReuseArray = prevMatches.length === nextMatches.length;
	let allReused = canReuseArray;

	const merged = nextMatches.map((match, index) => {
		const previous = prevById.get(match.id);
		if (!previous) {
			allReused = false;
			return match;
		}

		const reuse = areMatchesEqual(previous, match);
		const mergedMatch = reuse ? previous : match;

		if (allReused && prevMatches[index] !== mergedMatch) {
			allReused = false;
		}

		return mergedMatch;
	});

	return allReused ? prevMatches : merged;
}

function mergeLeagues(
	prevLeagues: FormattedLeague[],
	nextLeagues: FormattedLeague[],
): FormattedLeague[] {
	const prevById = new Map(prevLeagues.map((league) => [league.id, league]));
	const canReuseArray = prevLeagues.length === nextLeagues.length;
	let allReused = canReuseArray;

	const merged = nextLeagues.map((league, index) => {
		const previous = prevById.get(league.id);
		if (!previous) {
			allReused = false;
			return league;
		}

		const mergedMatches = mergeMatches(previous.matches, league.matches);
		const reuse =
			areLeaguesEqualShallow(previous, league) &&
			mergedMatches === previous.matches;
		const mergedLeague = reuse ? previous : { ...league, matches: mergedMatches };

		if (allReused && prevLeagues[index] !== mergedLeague) {
			allReused = false;
		}

		return mergedLeague;
	});

	return allReused ? prevLeagues : merged;
}

export function mergeFixturesByDate(
	previousData: FormattedCountry[] | undefined,
	nextData: FormattedCountry[],
): FormattedCountry[] {
	if (!previousData) {
		return nextData;
	}

	const prevByName = new Map(
		previousData.map((country) => [country.name, country]),
	);
	const canReuseArray = previousData.length === nextData.length;
	let allReused = canReuseArray;

	const merged = nextData.map((country, index) => {
		const previous = prevByName.get(country.name);
		if (!previous) {
			allReused = false;
			return country;
		}

		const mergedLeagues = mergeLeagues(previous.leagues, country.leagues);
		const reuse =
			areCountriesEqualShallow(previous, country) &&
			mergedLeagues === previous.leagues;
		const mergedCountry = reuse
			? previous
			: { ...country, leagues: mergedLeagues };

		if (allReused && previousData[index] !== mergedCountry) {
			allReused = false;
		}

		return mergedCountry;
	});

	return allReused ? previousData : merged;
}


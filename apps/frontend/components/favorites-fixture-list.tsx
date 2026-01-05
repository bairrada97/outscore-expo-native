import type { FormattedCountry, FormattedLeague } from "@outscore/shared-types";
import { View } from "react-native";
import { CardsBlock } from "./cards-block";
import { FixtureCard } from "./fixture-card";
import { NoResultsBox } from "./no-results-box";

interface FavoriteLeaguesListProps {
	data: FormattedLeague[];
	onFixturePress?: (fixtureId: number) => void;
}

function FavoriteLeaguesList({
	data,
	onFixturePress,
}: FavoriteLeaguesListProps) {
	return (
		<View className="px-8">
			{data.map((league, index) => (
				<CardsBlock
					key={`${league.id}-${index}`}
					title={league.name}
					cardsClassName="gap-0"
				>
					{league.matches.map((match, matchIndex) => (
						<FixtureCard
							key={match.id}
							fixture={match}
							isLastMatch={matchIndex === league.matches.length - 1}
							onPress={() => onFixturePress?.(match.id)}
						/>
					))}
				</CardsBlock>
			))}
		</View>
	);
}

export interface FavoritesFixtureListProps {
	data: FormattedCountry[];
	groupBy?: boolean;
	onFixturePress?: (fixtureId: number) => void;
}

/**
 * Displays favorite competitions and their matches.
 * Filters leagues by favorite league IDs and groups them by league.
 */
export function FavoritesFixtureList({
	data,
	groupBy = true,
	onFixturePress,
	favoriteLeaguesID,
}: FavoritesFixtureListProps & { favoriteLeaguesID?: number[] }) {
	// TODO: Replace with real user preferences from context/store or API
	// Favorite league IDs - temporary dev data
	const defaultFavoriteLeaguesID = [
		1, 2, 3, 5, 94, 39, 88, 140, 135, 61, 78, 743, 960, 858, 10, 34,
	];
	const favoriteIds = favoriteLeaguesID ?? defaultFavoriteLeaguesID;

	// Flatten all leagues from all countries and filter by favorite IDs
	const formatFavoriteData: FormattedLeague[] = data
		.flatMap((country) => country.leagues)
		.filter((league: FormattedLeague) => favoriteIds.includes(league.id));

	// Check if there are any matches in favorite leagues
	const hasMatches = formatFavoriteData.some(
		(league) => league.matches.length > 0,
	);

	// Check if there are any ongoing matches
	const hasOngoingMatches = formatFavoriteData.some((league) =>
		league.matches.some((match) => match.status?.elapsed !== null),
	);

	if (formatFavoriteData.length === 0) {
		return (
			<NoResultsBox text="You don't have any favorite competitions yet." />
		);
	}

	if (!hasMatches) {
		return (
			<NoResultsBox text="There are no matches happening today on your favorite competitions." />
		);
	}

	if (!hasOngoingMatches) {
		return (
			<NoResultsBox text="There are no ongoing matches on your favorite competitions." />
		);
	}

	return (
		<FavoriteLeaguesList
			data={formatFavoriteData}
			onFixturePress={onFixturePress}
		/>
	);
}

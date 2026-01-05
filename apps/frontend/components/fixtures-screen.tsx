import { useTimeZone } from "@/context/timezone-context";
import { fixturesByDateQuery } from "@/queries/fixtures-by-date";
import { isWeb } from "@/utils/platform";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { View } from "react-native";
import { FavoritesFixtureList } from "./favorites-fixture-list";
import { FixturesList } from "./fixtures-list";
import { TitleSection } from "./title-section";

interface FixturesScreenProps {
	date: string;
	live?: boolean;
}

export function FixturesScreen({ date, live }: FixturesScreenProps) {
	const { timeZone } = useTimeZone();

	const { data, isLoading, isRefetching } = useQuery(
		fixturesByDateQuery({
			date,
			timezone: timeZone,
			live: live ? "all" : undefined,
		}),
	);

	// Memoize header component for LegendList
	const listHeader = useMemo(
		() => (
			<View>
				{/* Favorite competitions section */}
				<TitleSection>Favorite competitions</TitleSection>
				<FavoritesFixtureList data={data ?? []} />

				{/* All competitions section */}
				<TitleSection>All competitions</TitleSection>
			</View>
		),
		[data],
	);

	// On web, render content directly (no TabView pager = natural height)
	if (isWeb) {
		return (
			<View className="mt-16 bg-neu-02 dark:bg-neu-13">
				{/* Favorite competitions section */}
				<TitleSection>Favorite competitions</TitleSection>
				<FavoritesFixtureList data={data ?? []} />

				{/* All competitions section */}
				<TitleSection>All competitions</TitleSection>
				<FixturesList
					countries={data ?? []}
					isLoading={isLoading}
					isRefetching={isRefetching}
				/>
			</View>
		);
	}

	// On native, use FixturesList with header component for unified scrolling
	return (
		<View className="mt-16 flex-1 bg-neu-02 dark:bg-neu-13">
			<FixturesList
				key={`fixtures-${date}-${live ? "live" : ""}`}
				resetKey={`${date}-${live ? "live" : ""}`}
				countries={data ?? []}
				isLoading={isLoading}
				isRefetching={isRefetching}
				listHeader={listHeader}
			/>
		</View>
	);
}

import { useTimeZone } from "@/context/timezone-context";
import { fixturesByDateQuery } from "@/queries/fixtures-by-date";
import { isWeb } from "@/utils/platform";
import { useIsFocused } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { Platform, View } from "react-native";
import { FavoritesFixtureList } from "./favorites-fixture-list";
import { FixturesList } from "./fixtures-list";
import { TitleSection } from "./title-section";

interface FixturesScreenProps {
	date: string;
	live?: boolean;
}

export function FixturesScreen({ date, live }: FixturesScreenProps) {
	const { timeZone } = useTimeZone();
	// Use screen focus state to disable polling when not focused
	// This prevents fixtures-by-date from fetching when navigating to fixture detail
	const isFocused = useIsFocused();

	const queryOptions = fixturesByDateQuery({
		date,
		timezone: timeZone,
		live: live ? "all" : undefined,
	});

	const { data, isLoading, isRefetching } = useQuery({
		...queryOptions,
		refetchInterval: isFocused ? queryOptions.refetchInterval : false,
	});

	// Header component for LegendList (only for native)
	const listHeader =
		Platform.OS === "web" ? null : (
			<View>
				{/* Favorite competitions section */}
				<TitleSection>Favorite competitions</TitleSection>
				<FavoritesFixtureList data={data ?? []} live={live} />

				{/* All competitions section */}
				<TitleSection>All competitions</TitleSection>
			</View>
		);

	// On web, render content directly (no TabView pager = natural height)
	if (isWeb) {
		return (
			<View className="pt-16 bg-neu-02 dark:bg-neu-13">
				{/* Favorite competitions section */}
				<TitleSection>Favorite competitions</TitleSection>
				<FavoritesFixtureList data={data ?? []} live={live} />

				{/* All competitions section */}
				<TitleSection>All competitions</TitleSection>
				<FixturesList
					countries={data ?? []}
					isLoading={isLoading}
					isRefetching={isRefetching}
					listHeader={listHeader}
				/>
			</View>
		);
	}

	// On native, use FixturesList with header component for unified scrolling
	return (
		<View className="mt-16 flex-1 bg-neu-02 dark:bg-neu-13">
			<FixturesList
				resetKey={`${date}-${live ? "live" : ""}`}
				countries={data ?? []}
				isLoading={isLoading}
				isRefetching={isRefetching}
				listHeader={listHeader}
			/>
		</View>
	);
}

import { useTimeZone } from "@/context/timezone-context";
import { cn } from "@/lib/utils";
import { fixturesByDateQuery } from "@/queries/fixtures-by-date";
import { isWeb } from "@/utils/platform";
import { useQuery } from "@tanstack/react-query";
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

	return (
		<View
			className={cn(
				"mt-16",
				isWeb ? "bg-neu-02 dark:bg-neu-13" : "flex-1 bg-neu-02 dark:bg-neu-13",
			)}
		>
			{/* Favorite competitions section */}
			<TitleSection>Favorite competitions</TitleSection>
			<FavoritesFixtureList data={data ?? []} timezone={timeZone} />

			{/* All competitions section */}
			<TitleSection>All competitions</TitleSection>
			<FixturesList
				countries={data ?? []}
				timezone={timeZone}
				isLoading={isLoading}
				isRefetching={isRefetching}
			/>
		</View>
	);
}

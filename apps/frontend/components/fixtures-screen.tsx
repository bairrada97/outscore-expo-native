import { useTimeZone } from "@/context/timezone-context";
import { fixturesByDateQuery } from "@/queries/fixtures-by-date";
import { isWeb } from "@/utils/platform";
import { useQuery } from "@tanstack/react-query";
import { View } from "react-native";
import { FixturesList } from "./fixtures-list";

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
		<View className={isWeb ? "bg-neu-02" : "flex-1 bg-neu-02"}>
			<FixturesList
				countries={data ?? []}
				timezone={timeZone}
				isLoading={isLoading}
				isRefetching={isRefetching}
			/>
		</View>
	);
}

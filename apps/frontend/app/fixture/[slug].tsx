import { fixtureByIdQuery } from "@/queries/fixture-by-id";
import { parseFixtureSlug } from "@/utils/fixture-slug";
import { isWeb } from "@/utils/platform";
import { useQuery } from "@tanstack/react-query";
import { Stack, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { Text } from "@/components/ui/text";

export default function FixtureDetailScreen() {
	const { slug } = useLocalSearchParams<{ slug: string }>();
	const fixtureId = parseFixtureSlug(slug);

	const { data, isLoading, error } = useQuery(
		fixtureByIdQuery({ fixtureId }),
	);

	if (isLoading) {
		return (
			<>
				<Stack.Screen options={{ title: "Loading..." }} />
				<View className="flex-1 items-center justify-center bg-neu-02">
					<ActivityIndicator size="large" />
				</View>
			</>
		);
	}

	if (error) {
		return (
			<>
				<Stack.Screen options={{ title: "Error" }} />
				<View className="flex-1 items-center justify-center bg-neu-02 px-16">
					<Text className="text-red-500">Error: {error.message}</Text>
				</View>
			</>
		);
	}

	const fixture = data?.data?.response?.[0];

	if (!fixture) {
		return (
			<>
				<Stack.Screen options={{ title: "Not Found" }} />
				<View className="flex-1 items-center justify-center bg-neu-02">
					<Text className="text-neu-07">Fixture not found</Text>
				</View>
			</>
		);
	}

	// Format match title for header
	const headerTitle = `${fixture.teams.home.name} vs ${fixture.teams.away.name}`;

	return (
		<>
			<Stack.Screen
				options={{
					title: headerTitle,
					headerBackTitle: "Back",
				}}
			/>
			<View className={isWeb ? "bg-neu-02 p-16" : "flex-1 bg-neu-02 p-16"}>
				{/* League info */}
				<Text className="text-neu-07 mb-8">
					{fixture.league.name} - {fixture.league.round}
				</Text>

				{/* Teams and Score */}
				<View className="flex-row items-center justify-between mb-16">
					<Text variant="body-01--bold" className="flex-1 text-neu-10">
						{fixture.teams.home.name}
					</Text>
					<Text variant="heading-03" className="mx-16 text-neu-10">
						{fixture.goals.home ?? "-"} - {fixture.goals.away ?? "-"}
					</Text>
					<Text
						variant="body-01--bold"
						className="flex-1 text-right text-neu-10"
					>
						{fixture.teams.away.name}
					</Text>
				</View>

				{/* Match status and time */}
				<Text className="text-center text-neu-07">
					{fixture.fixture.status.long}
				</Text>
				<Text className="text-center text-neu-06 mt-4">
					{new Date(fixture.fixture.date).toLocaleString()}
				</Text>

				{/* Venue */}
				{fixture.fixture.venue?.name && (
					<Text className="text-center text-neu-06 mt-8">
						{fixture.fixture.venue.name}
						{fixture.fixture.venue.city && `, ${fixture.fixture.venue.city}`}
					</Text>
				)}
			</View>
		</>
	);
}

import { Text } from "@/components/ui/text";
import { useFixtureRelatedData } from "@/hooks/useFixtureRelatedData";
import {
	fixtureByIdQuery,
	getFixtureRefetchInterval,
} from "@/queries/fixture-by-id";
import { FIFTEEN_SECONDS_CACHE } from "@/utils/constants";
import { parseFixtureSlug } from "@/utils/fixture-slug";
import {
	FIXTURE_IS_FINISHED_STATUS,
	FIXTURE_IS_LIVE_STATUS,
} from "@/utils/fixtures-status-constants";
import { isWeb } from "@/utils/platform";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useRef } from "react";
import { ActivityIndicator, View } from "react-native";

export default function FixtureDetailScreen() {
	const { slug } = useLocalSearchParams<{ slug: string }>();
	const fixtureId = parseFixtureSlug(slug);
	const queryClient = useQueryClient();
	const previousStatusRef = useRef<string | null>(null);

	// Callback to detect significant status changes and invalidate query
	const handleStatusChange = useCallback(
		(currentStatus: string | undefined) => {
			if (!currentStatus) return;

			const previousStatus = previousStatusRef.current;
			previousStatusRef.current = currentStatus;

			// Detect significant status changes
			if (previousStatus && currentStatus !== previousStatus) {
				const wasNotStarted =
					previousStatus === "NS" || previousStatus === "TBD";
				const isNowLive = FIXTURE_IS_LIVE_STATUS.includes(currentStatus);
				const wasLive = FIXTURE_IS_LIVE_STATUS.includes(previousStatus);
				const isNowFinished =
					FIXTURE_IS_FINISHED_STATUS.includes(currentStatus);

				// NS/TBD -> LIVE or LIVE -> FINISHED
				if ((wasNotStarted && isNowLive) || (wasLive && isNowFinished)) {
					// Invalidate to force immediate refetch with new config
					queryClient.invalidateQueries({
						queryKey: ["fixture", String(fixtureId)],
					});
				}
			}
		},
		[fixtureId, queryClient],
	);

	const { data, isLoading, error } = useQuery({
		...fixtureByIdQuery({ fixtureId }),
		// Dynamic refetchInterval based on current fixture data
		refetchInterval: (query) => {
			const fixtureData = query.state.data;

			// If data is not yet loaded, use default polling interval
			// This ensures polling continues until data loads
			if (!fixtureData) {
				return FIFTEEN_SECONDS_CACHE + 2000; // 17s default for live matches
			}

			const interval = getFixtureRefetchInterval(fixtureData);

			// Track status changes for status transitions
			const fixture = fixtureData?.response?.[0];
			if (fixture) {
				handleStatusChange(fixture.fixture.status.short);
			}

			return interval;
		},
	});

	const fixture = data?.response?.[0];

	// Prefetch all related data for the fixture (team stats, H2H, injuries, standings)
	// This hook triggers parallel queries for all related data once fixture is loaded
	useFixtureRelatedData(fixture);

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

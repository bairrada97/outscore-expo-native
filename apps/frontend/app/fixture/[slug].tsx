import { FixtureInfoHeader } from "@/components/fixture-info-header";
import { Text } from "@/components/ui/text";
import {
	fixtureByIdQuery,
	getFixtureRefetchInterval,
} from "@/queries/fixture-by-id";
import { insightsByFixtureIdQuery } from "@/queries/insights-by-fixture-id";
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
					queryClient.invalidateQueries({
						queryKey: ["fixture-insights", String(fixtureId)],
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

	const {
		data: insightsData,
		isLoading: isInsightsLoading,
		error: insightsError,
	} = useQuery({
		...insightsByFixtureIdQuery({ fixtureId }),
		// Keep insights refresh cadence aligned with fixture polling
		refetchInterval: (query) => {
			const fixtureData = data;
			if (!fixtureData) {
				return FIFTEEN_SECONDS_CACHE + 2000;
			}
			return getFixtureRefetchInterval(fixtureData);
		},
	});

	if (isLoading) {
		return (
			<>
				<Stack.Screen options={{ headerShown: false }} />
				<View className="flex-1 items-center justify-center bg-neu-02 dark:bg-neu-13">
					<ActivityIndicator size="large" />
				</View>
			</>
		);
	}

	if (error) {
		return (
			<>
				<Stack.Screen options={{ headerShown: false }} />
				<View className="flex-1 items-center justify-center bg-neu-02 dark:bg-neu-13 px-16">
					<Text className="text-red">Error: {error.message}</Text>
				</View>
			</>
		);
	}

	if (!data) {
		return (
			<>
				<Stack.Screen options={{ headerShown: false }} />
				<View className="flex-1 items-center justify-center bg-neu-02 dark:bg-neu-13">
					<Text className="text-neu-07">Fixture not found</Text>
				</View>
			</>
		);
	}

	return (
		<>
			<Stack.Screen
				options={{
					title: "FIXTURE DETAILS",
					headerShown: true,
				}}
			/>
			<View
				className={
					isWeb ? "bg-neu-02 dark:bg-neu-13" : "flex-1 bg-neu-02 dark:bg-neu-13"
				}
			>
				<FixtureInfoHeader fixture={data.response?.[0]} />

				{/* Additional content area */}
				<View className="p-4">
					{/* League info */}
					<Text className="text-neu-07 dark:text-neu-06 mb-4">
						{data.response?.[0].league.name} - {data.response?.[0].league.round}
					</Text>

					{/* Fixture status */}
					<Text className="text-neu-07 dark:text-neu-06">
						{data.response?.[0].fixture.status.long}
					</Text>

					{/* Fixture date/time */}
					<Text className="text-neu-06 dark:text-neu-07 mt-2">
						{new Date(data.response?.[0].fixture.date).toLocaleString()}
					</Text>

					{/* Venue */}
					{data.response?.[0].fixture.venue?.name && (
						<Text className="text-neu-06 dark:text-neu-07 mt-4">
							{data.response?.[0].fixture.venue.name}
							{data.response?.[0].fixture.venue.city &&
								`, ${data.response?.[0].fixture.venue.city}`}
						</Text>
					)}

					{/* Insights */}
					<View className="mt-6">
						<Text className="text-neu-10 dark:text-neu-06 mb-2">Insights</Text>

						{isInsightsLoading && (
							<View className="py-4">
								<ActivityIndicator />
							</View>
						)}

						{insightsError && (
							<Text className="text-red">
								Insights error: {insightsError.message}
							</Text>
						)}

						{insightsData && (
							<View className="gap-2">
								{insightsData.overallConfidence && (
									<Text className="text-neu-06 dark:text-neu-07">
										Overall confidence: {insightsData.overallConfidence}
									</Text>
								)}

								{insightsData.predictions
									?.filter((p) => p.market === "OVER_UNDER_GOALS")
									?.sort((a, b) => (a.line ?? 0) - (b.line ?? 0))
									?.map((p) => (
										<Text
											key={`ou-${p.line ?? "na"}`}
											className="text-neu-06 dark:text-neu-07"
										>
											Over/Under {p.line}: O{" "}
											{Math.round((p.probabilities.over ?? 0) * 10) / 10}% / U{" "}
											{Math.round((p.probabilities.under ?? 0) * 10) / 10}%{" "}
											{p.confidence ? `(${p.confidence})` : ""}
										</Text>
									))}
							</View>
						)}
					</View>
				</View>
			</View>
		</>
	);
}

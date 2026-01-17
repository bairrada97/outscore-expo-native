import { FixtureEventsBlock } from "@/components/fixture-events-block";
import { FixtureInfoHeader } from "@/components/fixture-info-header";
import { InsightsSectionHeader } from "@/components/insights/insights-section-header";
import { KeyInsightsList } from "@/components/insights/key-insights-list";
import { MatchFactsGrid } from "@/components/insights/match-facts-grid";
import { Tabs } from "@/components/ui/tabs";
import { Text } from "@/components/ui/text";
import { useSelectedDate } from "@/context/selected-date-context";
import { useTimeZone } from "@/context/timezone-context";
import {
	fixtureByIdQuery,
	getFixtureRefetchInterval,
} from "@/queries/fixture-by-id";
import { createFixturesQueryKey } from "@/queries/fixtures-by-date";
import { insightsByFixtureIdQuery } from "@/queries/insights-by-fixture-id";
import { FIFTEEN_SECONDS_CACHE } from "@/utils/constants";
import { getTodayFormatted } from "@/utils/date-utils";
import { parseFixtureSlug } from "@/utils/fixture-slug";
import {
	FIXTURE_IS_FINISHED_STATUS,
	FIXTURE_IS_LIVE_STATUS,
} from "@/utils/fixtures-status-constants";
import { isWeb } from "@/utils/platform";
import type {
	Fixture,
	FixturesResponse,
	FormattedCountry,
	FormattedLeague,
	FormattedMatch,
} from "@outscore/shared-types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useRef } from "react";
import { ActivityIndicator, View } from "react-native";

const FIXTURE_TABS = [
	{ key: "overview", title: "OVERVIEW" },
	{ key: "insights", title: "INSIGHTS" },
	{ key: "lineups", title: "LINEUPS" },
	{ key: "statistics", title: "STATISTICS" },
	{ key: "h2h", title: "H2H" },
	{ key: "standings", title: "STANDINGS" },
] as const;

type FixtureTabKey = (typeof FIXTURE_TABS)[number]["key"];

function normalizeFixtureTab(tabParam: unknown): FixtureTabKey {
	const raw = typeof tabParam === "string" ? tabParam : undefined;
	const match = FIXTURE_TABS.find((t) => t.key === raw)?.key;
	return (match ?? "overview") as FixtureTabKey;
}

type CachedSummary = {
	match: FormattedMatch;
	league: FormattedLeague;
	country: FormattedCountry;
};

function findMatchSummaryInFixturesByDateCache(
	queryClient: ReturnType<typeof useQueryClient>,
	fixtureId: number,
	date: string | null,
	timeZone: string,
): CachedSummary | null {
	if (date) {
		const countries = queryClient.getQueryData<FormattedCountry[]>(
			createFixturesQueryKey(date, timeZone),
		);

		if (countries) {
			for (const country of countries) {
				for (const league of country.leagues) {
					const match = league.matches.find((item) => item.id === fixtureId);
					if (match) return { match, league, country };
				}
			}
		}

		return null;
	}

	const allQueries = queryClient.getQueriesData<FormattedCountry[]>({
		queryKey: ["fixtures-by-date"],
	});

	for (const [, countries] of allQueries) {
		if (!countries) continue;

		for (const country of countries) {
			for (const league of country.leagues) {
				const match = league.matches.find((item) => item.id === fixtureId);
				if (match) return { match, league, country };
			}
		}
	}

	return null;
}

function placeholderFixtureResponseFromCache(
	queryClient: ReturnType<typeof useQueryClient>,
	fixtureId: number,
	date: string | null,
	timeZone: string,
): FixturesResponse | undefined {
	const summary = findMatchSummaryInFixturesByDateCache(
		queryClient,
		fixtureId,
		date,
		timeZone,
	);
	if (!summary) return undefined;

	const { match, league, country } = summary;

	const fixture: Fixture = {
		fixture: {
			id: match.id,
			referee: null,
			timezone: match.timezone,
			// Include kickoff time to avoid local-midnight parsing (e.g. 01:00 flashes)
			// match.time is already formatted (HH:mm) in fixtures-by-date.
			date: `${match.date}T${match.time}:00`,
			timestamp: match.timestamp,
			periods: { first: null, second: null },
			venue: { id: null, name: "", city: "" },
			status: {
				long: match.status.long,
				short: match.status.short,
				elapsed: match.status.elapsed,
			},
		},
		league: {
			id: league.id,
			name: league.name,
			country: country.name,
			logo: league.logo,
			flag: country.flag,
			season: new Date(match.date).getFullYear(),
			round: "",
		},
		teams: match.teams,
		goals: match.goals,
		score: {
			halftime: { home: null, away: null },
			fulltime: match.score.fulltime,
			extratime: { home: null, away: null },
			penalty: match.score.penalty,
		},
		events: [],
	};

	return {
		get: "fixtures",
		parameters: { id: String(fixtureId) },
		errors: [],
		results: 1,
		paging: { current: 1, total: 1 },
		response: [fixture],
	};
}

export default function FixtureDetailScreen() {
	const router = useRouter();
	const { slug, tab } = useLocalSearchParams<{ slug: string; tab?: string }>();
	const fixtureId = parseFixtureSlug(slug);
	const queryClient = useQueryClient();
	const previousStatusRef = useRef<string | null>(null);
	const { timeZone } = useTimeZone();
	const { selectedDate } = useSelectedDate();
	const fallbackDate = selectedDate ?? getTodayFormatted();

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
		placeholderData: () =>
			Number.isFinite(fixtureId)
				? placeholderFixtureResponseFromCache(
						queryClient,
						fixtureId,
						fallbackDate,
						timeZone,
					)
				: undefined,
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
		refetchInterval: (_query) => {
			const fixtureData = data;
			if (!fixtureData) {
				return FIFTEEN_SECONDS_CACHE + 2000;
			}
			return getFixtureRefetchInterval(fixtureData);
		},
	});

	if (isLoading && !data) {
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
				<View className="flex-1 items-center justify-center pt-16 bg-neu-02 dark:bg-neu-13">
					<Text className="text-neu-07">Fixture not found</Text>
				</View>
			</>
		);
	}

	return (
		<>
			<Stack.Screen
				options={{
					title: "MATCH INFO",
					headerShown: true,
				}}
			/>
			<View
				className={
					isWeb ? "bg-neu-02 dark:bg-neu-13" : "flex-1 bg-neu-02 dark:bg-neu-13"
				}
			>
				<FixtureInfoHeader fixture={data.response?.[0]} />

				<Tabs
					activeKey={isWeb ? normalizeFixtureTab(tab) : undefined}
					defaultKey="overview"
					swipeEnabled
					onChangeKey={(key: string) => {
						if (isWeb) router.setParams({ tab: key });
					}}
					tabs={[
						{
							key: "overview",
							title: "OVERVIEW",
							render: () => (
								<View className="p-16">
									<FixtureEventsBlock fixture={data.response?.[0]} />
								</View>
							),
						},
						{
							key: "insights",
							title: "INSIGHTS",
							render: () => (
								<View className="p-16 gap-y-8">
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

									{insightsData ? (
										<View className="gap-y-8">
											<InsightsSectionHeader title="Match Facts" />
											<MatchFactsGrid facts={insightsData.matchFacts ?? []} />

											<InsightsSectionHeader title="Key Insights" />
											<View className="gap-y-24">
												<KeyInsightsList
													title={`${insightsData.match.homeTeam} (HOME) INSIGHTS`}
													insights={(insightsData.keyInsights?.home ?? []).map(
														(insight) => ({
															text: insight.text,
															parts: insight.parts,
															category: insight.category,
														}),
													)}
												/>
												<KeyInsightsList
													title={`${insightsData.match.awayTeam} (AWAY) INSIGHTS`}
													insights={(insightsData.keyInsights?.away ?? []).map(
														(insight) => ({
															text: insight.text,
															parts: insight.parts,
															category: insight.category,
														}),
													)}
												/>
											</View>
										</View>
									) : null}
								</View>
							),
						},
						{
							key: "lineups",
							title: "LINEUPS",
							render: () => (
								<View className="p-16">
									<Text className="text-neu-07 dark:text-neu-06">
										Coming soon
									</Text>
								</View>
							),
						},
						{
							key: "statistics",
							title: "STATISTICS",
							render: () => (
								<View className="p-16">
									<Text className="text-neu-07 dark:text-neu-06">
										Coming soon
									</Text>
								</View>
							),
						},
						{
							key: "h2h",
							title: "H2H",
							render: () => (
								<View className="p-16">
									<Text className="text-neu-07 dark:text-neu-06">
										Coming soon
									</Text>
								</View>
							),
						},
						{
							key: "standings",
							title: "STANDINGS",
							render: () => (
								<View className="p-16">
									<Text className="text-neu-07 dark:text-neu-06">
										Coming soon
									</Text>
								</View>
							),
						},
					]}
				/>
			</View>
		</>
	);
}

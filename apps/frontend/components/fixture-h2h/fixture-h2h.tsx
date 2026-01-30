import { CardsBlock } from "@/components/cards-block";
import { FixtureCard } from "@/components/fixture-card";
import { FilterPillGroup } from "@/components/ui/filter-pill";
import { Text } from "@/components/ui/text";
import type { FixtureContextResponse } from "@/queries/fixture-context";
import { generateFixtureSlug } from "@/utils/fixture-slug";
import type { Fixture } from "@outscore/shared-types";
import { Link } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import {
	filterMatchesByVenue,
	H2H_FILTER_OPTIONS,
	type H2HFilterKey,
	rawFixtureToH2HMatch,
} from "./fixture-h2h.helpers";

type FixtureH2HProps = {
	fixture: Fixture;
	contextData?: FixtureContextResponse;
	isContextLoading?: boolean;
};

export function FixtureH2H({ fixture, contextData, isContextLoading }: FixtureH2HProps) {
	const [activeFilter, setActiveFilter] = useState<H2HFilterKey>("overall");

	const homeTeamId = fixture?.teams?.home?.id;
	const awayTeamId = fixture?.teams?.away?.id;
	const homeTeamName = fixture?.teams?.home?.name ?? "Home";
	const awayTeamName = fixture?.teams?.away?.name ?? "Away";

	// Use data from context (passed from parent)
	const h2hFixtures = contextData?.h2hFixtures ?? [];
	const homeTeamFixtures = contextData?.homeTeamFixtures ?? [];
	const awayTeamFixtures = contextData?.awayTeamFixtures ?? [];

	// Convert and filter fixtures
	const { h2hMatches, homeTeamMatches, awayTeamMatches } = useMemo(() => {
		// Guard against invalid team IDs
		if (!homeTeamId || !awayTeamId) {
			return { h2hMatches: [], homeTeamMatches: [], awayTeamMatches: [] };
		}

		const filteredH2H = filterMatchesByVenue(h2hFixtures, homeTeamId, activeFilter);
		const filteredHome = filterMatchesByVenue(homeTeamFixtures, homeTeamId, activeFilter);
		const filteredAway = filterMatchesByVenue(awayTeamFixtures, awayTeamId, activeFilter);

		// Convert and filter out any invalid matches
		const convertAndFilter = (fixtures: typeof filteredH2H) =>
			fixtures.map(rawFixtureToH2HMatch).filter((m): m is NonNullable<typeof m> => m !== null);

		return {
			h2hMatches: convertAndFilter(filteredH2H),
			homeTeamMatches: convertAndFilter(filteredHome),
			awayTeamMatches: convertAndFilter(filteredAway),
		};
	}, [h2hFixtures, homeTeamFixtures, awayTeamFixtures, homeTeamId, awayTeamId, activeFilter]);

	// Only show outcome badge when a filter is active (not "overall")
	const showOutcome = activeFilter !== "overall";

	// Show loading state while context is being fetched
	if (isContextLoading) {
		return (
			<View className="items-center justify-center py-32">
				<ActivityIndicator />
			</View>
		);
	}

	// No data available
	if (!h2hFixtures.length && !homeTeamFixtures.length && !awayTeamFixtures.length) {
		return (
			<View className="gap-y-24">
				<FilterPillGroup
					options={H2H_FILTER_OPTIONS}
					activeKey={activeFilter}
					onSelect={setActiveFilter}
				/>
				<View className="items-center justify-center py-32">
					<Text variant="body-02" className="text-neu-07 dark:text-neu-06">
						No H2H data available
					</Text>
				</View>
			</View>
		);
	}

	return (
		<View className="gap-y-24">
			<FilterPillGroup
				options={H2H_FILTER_OPTIONS}
				activeKey={activeFilter}
				onSelect={setActiveFilter}
			/>

			{/* Head to Head */}
			{h2hMatches.length > 0 && (
				<CardsBlock title="Head to Head" cardsClassName="gap-0">
					{h2hMatches.map((match, index) => (
						<Link
							key={match.id}
							href={{ pathname: "/fixture/[slug]", params: { slug: generateFixtureSlug(match) } }}
							asChild
						>
							<FixtureCard
								fixture={match}
								isLastMatch={index === h2hMatches.length - 1}
								perspectiveTeamId={showOutcome ? homeTeamId : undefined}
							/>
						</Link>
					))}
				</CardsBlock>
			)}

			{/* Home Team Last Matches */}
			{activeFilter !== "away" && homeTeamMatches.length > 0 && (
				<CardsBlock title={`Last Matches: ${homeTeamName}`} cardsClassName="gap-0">
					{homeTeamMatches.map((match, index) => (
						<Link
							key={match.id}
							href={{ pathname: "/fixture/[slug]", params: { slug: generateFixtureSlug(match) } }}
							asChild
						>
							<FixtureCard
								fixture={match}
								isLastMatch={index === homeTeamMatches.length - 1}
								perspectiveTeamId={showOutcome ? homeTeamId : undefined}
							/>
						</Link>
					))}
				</CardsBlock>
			)}

			{/* Away Team Last Matches */}
			{activeFilter !== "home" && awayTeamMatches.length > 0 && (
				<CardsBlock title={`Last Matches: ${awayTeamName}`} cardsClassName="gap-0">
					{awayTeamMatches.map((match, index) => (
						<Link
							key={match.id}
							href={{ pathname: "/fixture/[slug]", params: { slug: generateFixtureSlug(match) } }}
							asChild
						>
							<FixtureCard
								fixture={match}
								isLastMatch={index === awayTeamMatches.length - 1}
								perspectiveTeamId={showOutcome ? awayTeamId : undefined}
							/>
						</Link>
					))}
				</CardsBlock>
			)}

			{!h2hMatches.length && !homeTeamMatches.length && !awayTeamMatches.length && (
				<View className="items-center justify-center py-32">
					<Text variant="body-02" className="text-neu-07 dark:text-neu-06">
						No matches found for this filter
					</Text>
				</View>
			)}
		</View>
	);
}

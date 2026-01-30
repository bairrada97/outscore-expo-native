import { CardPlayerLineup } from "@/components/card-player-lineup";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
} from "@/components/ui/accordion";
import { Text } from "@/components/ui/text";
import {
	MissingPlayersList,
	SectionHeader,
	SubstitutesList,
	TeamAccordionTrigger,
} from "@/components/lineups/lineups-team-list.parts";
import type { InjuryData } from "@/components/lineups/lineups-team-list.parts";
import { injuriesQuery } from "@/queries/injuries";
import type { Fixture, FixtureEvent } from "@outscore/shared-types";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { View } from "react-native";

type LineupsTeamListProps = {
	fixture: Fixture;
};

export function LineupsTeamList({ fixture }: LineupsTeamListProps) {
	const { events, lineups } = fixture;
	const [expandedTeams, setExpandedTeams] = useState<string[]>([]);

	const isAnyAccordionOpen = expandedTeams.length > 0;

	// Fetch injuries when any accordion is opened
	const { data: injuryData } = useQuery({
		...injuriesQuery({
			fixtureId: fixture.fixture.id,
			season: fixture.league.season,
		}),
		enabled: isAnyAccordionOpen,
	});

	const getPlayerEvents = (playerId: number): FixtureEvent[] => {
		return events?.filter((event) => event.player?.id === playerId) ?? [];
	};

	const getPlayerAssistEvents = (playerId: number): FixtureEvent[] => {
		return events?.filter((event) => event.assist?.id === playerId) ?? [];
	};

	// TODO: Add player ratings from statistics when available
	// const getPlayerRating = (playerId: number): number | null => {
	//   return null;
	// };

	if (!lineups || lineups.length === 0) {
		return (
			<View className="p-16">
				<Text variant="body-02" className="text-neu-07 dark:text-neu-06">
					Lineups are not available for this match yet.
				</Text>
			</View>
		);
	}

	const injuries = (injuryData?.response ?? []) as InjuryData[];

	return (
		<View className="mt-24">
			{lineups.map((lineup) => (
				<Accordion
					key={lineup.team.id}
					type="multiple"
					value={expandedTeams}
					onValueChange={setExpandedTeams}
				>
					<AccordionItem value={lineup.team.name} className="border-b-0">
						<TeamAccordionTrigger
							teamName={lineup.team.name}
							teamLogo={lineup.team.logo}
						/>
						<AccordionContent className="overflow-visible p-0">
							<View className="mb-8 gap-8 bg-neu-01 py-8 shadow-sha-01 dark:bg-neu-11 dark:shadow-sha-06">
								{/* Coach */}
								{lineup.coach && (
									<View className="mx-16 flex-row items-center justify-between border-b border-neu-03 pb-8 dark:border-neu-12">
										<CardPlayerLineup
											player={{
												id: lineup.coach.id,
												name: lineup.coach.name,
												pos: "Coach",
												grid: null,
											}}
											className="flex-1 px-0"
										/>
										<Text
											variant="caption-02"
											className="text-neu-09/70 dark:text-neu-06"
										>
											Coach
										</Text>
									</View>
								)}

								{/* Starting XI */}
								{lineup.startXI?.map((entry) => (
									<CardPlayerLineup
										key={entry.player.id}
										player={entry.player}
										events={getPlayerEvents(entry.player.id)}
										assistEvents={getPlayerAssistEvents(entry.player.id)}
										// rating={getPlayerRating(entry.player.id)}
									/>
								))}

								{/* Substitutes */}
								{lineup.substitutes && lineup.substitutes.length > 0 && (
									<>
										<SectionHeader title="Bench" />
										<SubstitutesList
											lineup={lineup}
											getPlayerEvents={getPlayerEvents}
											getPlayerAssistEvents={getPlayerAssistEvents}
										/>
									</>
								)}

								{/* Missing Players */}
								{injuries.length > 0 && (
									<>
										<SectionHeader title="Missing Players" />
										<MissingPlayersList
											injuries={injuries}
											teamId={lineup.team.id}
										/>
									</>
								)}
							</View>
						</AccordionContent>
					</AccordionItem>
				</Accordion>
			))}
		</View>
	);
}

import { CardGeneric } from "@/components/card-generic";
import { CardPlayerLineup } from "@/components/card-player-lineup";
import { AccordionTrigger } from "@/components/ui/accordion";
import { Text } from "@/components/ui/text";
import type { FixtureEvent, FixtureLineup } from "@outscore/shared-types";
import * as AccordionPrimitive from "@rn-primitives/accordion";
import { View } from "react-native";

type InjuredPlayer = {
	id: number;
	name: string;
	photo: string;
	type: string;
	reason: string;
};

export type InjuryData = {
	player: InjuredPlayer;
	team: {
		id: number;
		name: string;
		logo: string;
	};
};

type SectionHeaderProps = {
	title: string;
};

export function SectionHeader({ title }: SectionHeaderProps) {
	return (
		<View className="h-40 justify-center bg-neu-03 pl-16 dark:bg-neu-10">
			<Text variant="body-01--semi" className="text-neu-10 dark:text-neu-01">
				{title}
			</Text>
		</View>
	);
}

type TeamAccordionTriggerProps = {
	teamName: string;
	teamLogo: string;
};

export function TeamAccordionTrigger({
	teamName,
	teamLogo,
}: TeamAccordionTriggerProps) {
	const { isExpanded } = AccordionPrimitive.useItemContext();

	return (
		<AccordionTrigger
			className={
				isExpanded
					? "h-56 items-center bg-linear-to-r from-m-01-light-01 to-m-02-dark-01 px-16 no-underline hover:no-underline"
					: "h-56 items-center px-16 no-underline hover:no-underline"
			}
		>
			<CardGeneric title={teamName} imageUrl={teamLogo} isActive={isExpanded} />
		</AccordionTrigger>
	);
}

type SubstitutesListProps = {
	lineup: FixtureLineup;
	getPlayerEvents: (playerId: number) => FixtureEvent[];
	getPlayerAssistEvents: (playerId: number) => FixtureEvent[];
};

export function SubstitutesList({
	lineup,
	getPlayerEvents,
	getPlayerAssistEvents,
}: SubstitutesListProps) {
	return (
		<>
			{lineup.substitutes.map((entry) => (
				<CardPlayerLineup
					key={entry.player.id}
					player={entry.player}
					events={getPlayerEvents(entry.player.id)}
					assistEvents={getPlayerAssistEvents(entry.player.id)}
				/>
			))}
		</>
	);
}

type MissingPlayersListProps = {
	injuries: InjuryData[];
	teamId: number;
};

export function MissingPlayersList({ injuries, teamId }: MissingPlayersListProps) {
	const teamInjuries = injuries.filter((injury) => injury.team.id === teamId);

	if (teamInjuries.length === 0) return null;

	return (
		<View className="gap-16">
			{teamInjuries.map((injury) => (
				<CardPlayerLineup
					key={injury.player.id}
					player={{
						id: injury.player.id,
						name: injury.player.name,
						pos: "",
						grid: null,
					}}
					playerInjury={{
						type: injury.player.type,
						reason: injury.player.reason,
					}}
				/>
			))}
		</View>
	);
}

import {
	type H2HFormattedMatch,
	rawFixtureToH2HMatch,
} from "@/components/fixture-h2h/fixture-h2h.helpers";
import { MatchOutcomeBadge } from "@/components/match-outcome-badge/match-outcome-badge";
import { Text } from "@/components/ui/text";
import type { RawFixtureForDisplay } from "@/queries/insights-by-fixture-id";
import { getMatchOutcome } from "@/utils/fixture-to-match";
import { View } from "react-native";

type FixtureTeamFormProps = {
	homeTeamId: number;
	awayTeamId: number;
	homeTeamFixtures: RawFixtureForDisplay[];
	awayTeamFixtures: RawFixtureForDisplay[];
};

type TeamFormRowProps = {
	teamId: number;
	fixtures: RawFixtureForDisplay[];
};

function TeamFormRow({ teamId, fixtures }: TeamFormRowProps) {
	const validatedMatches = fixtures
		.slice(0, 5)
		.map(rawFixtureToH2HMatch)
		.filter((match): match is H2HFormattedMatch => match !== null);
	const outcomes = validatedMatches
		.map((match) => ({
			match,
			outcome: getMatchOutcome(match, teamId),
		}))
		.filter(
			(
				entry,
			): entry is { match: H2HFormattedMatch; outcome: "W" | "D" | "L" } =>
				entry.outcome !== null,
		);

	return (
		<View>
			<View className="flex-row gap-4">
				{outcomes.map(({ match, outcome }, index) => (
					<View key={match.id} className="items-center">
						<MatchOutcomeBadge outcome={outcome} textClassName="text-neu-01" />
						{index === 0 && (
							<View className="mt-4 h-[2px] w-full rounded-full bg-m-02" />
						)}
					</View>
				))}
			</View>
		</View>
	);
}

export function FixtureTeamForm({
	homeTeamId,
	awayTeamId,
	homeTeamFixtures,
	awayTeamFixtures,
}: FixtureTeamFormProps) {
	if (homeTeamId == null || awayTeamId == null) return null;

	return (
		<View className="rounded-lg bg-neu-12 dark:bg-neu-11 px-16 py-16">
			<View className="mb-16 flex-row items-center justify-between">
				<Text variant="body-02--semi" className="text-neu-04 dark:text-neu-06">
					Team Form
				</Text>
				<View className="flex-row items-center gap-4">
					<View className="h-4 w-4 rounded-full bg-m-02" />
					<Text variant="caption-03" className="text-neu-04 dark:text-neu-06">
						Last Game
					</Text>
				</View>
			</View>

			<View className="flex-row justify-between gap-16">
				<TeamFormRow teamId={homeTeamId} fixtures={homeTeamFixtures} />
				<TeamFormRow teamId={awayTeamId} fixtures={awayTeamFixtures} />
			</View>
		</View>
	);
}

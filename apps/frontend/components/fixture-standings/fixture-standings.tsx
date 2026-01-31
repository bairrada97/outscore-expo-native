import type { Fixture } from "@outscore/shared-types";
import { useMemo } from "react";
import { ActivityIndicator, View } from "react-native";
import {
	CardStandings,
	COLUMN_WIDTHS,
	type StandingsRowData,
} from "@/components/card-standings";
import { NoResultsBox } from "@/components/no-results-box";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import type { FixtureContextResponse } from "@/queries/fixture-context";
import {
	buildDescriptionColors,
	type DescriptionColor,
	getColorClassForDescription,
} from "./fixture-standings.helpers";

type FixtureStandingsProps = {
	fixture: Fixture;
	contextData?: FixtureContextResponse;
	isContextLoading?: boolean;
};

const HEADER_LABELS = [
	{ key: "played", label: "P", width: COLUMN_WIDTHS.played },
	{ key: "win", label: "W", width: COLUMN_WIDTHS.win },
	{ key: "draw", label: "D", width: COLUMN_WIDTHS.draw },
	{ key: "lose", label: "L", width: COLUMN_WIDTHS.lose },
	{ key: "goals", label: "G", width: COLUMN_WIDTHS.goals },
	{ key: "points", label: "PTS", width: COLUMN_WIDTHS.points },
] as const;

function StandingsHeader() {
	return (
		<View className="mb-16 flex-row items-center gap-x-4 px-16">
			{/* Rank column */}
			<View className="w-24 items-center">
				<Text
					variant="body-02--semi"
					className="text-m-01 dark:text-m-01-light-04"
				>
					#
				</Text>
			</View>

			{/* Team column */}
			<View className="flex-1">
				<Text
					variant="body-02--semi"
					className="text-m-01 dark:text-m-01-light-04"
				>
					Team
				</Text>
			</View>

			{/* Stats columns */}
			<View className="flex-row gap-2">
				{HEADER_LABELS.map((item) => (
					<Text
						key={item.key}
						variant="body-02--semi"
						className="text-center text-m-01 dark:text-m-01-light-04"
						style={{ minWidth: item.width }}
					>
						{item.label}
					</Text>
				))}
			</View>
		</View>
	);
}

function StandingsLegend({
	descriptionColors,
}: {
	descriptionColors: DescriptionColor[];
}) {
	if (!descriptionColors.length) return null;

	return (
		<View className="mt-32 gap-4 px-16">
			{descriptionColors.map((item) => (
				<View key={item.description} className="flex-row items-center gap-16">
					<View className={cn("h-8 w-8 rounded-full", item.colorClass)} />
					<Text
						variant="body-02"
						className="flex-1 text-neu-09 dark:text-neu-07"
					>
						{item.description}
					</Text>
				</View>
			))}
		</View>
	);
}

function StandingsList({
	standings,
	liveTeamIds,
	descriptionColors,
}: {
	standings: StandingsRowData[];
	liveTeamIds: number[];
	descriptionColors: DescriptionColor[];
}) {
	return (
		<View>
			{standings.map((standing) => (
				<CardStandings
					key={standing.team.id}
					standing={standing}
					indicatorColorClass={getColorClassForDescription(
						standing.description,
						descriptionColors,
					)}
					isLive={liveTeamIds.includes(standing.team.id)}
				/>
			))}
		</View>
	);
}

export function FixtureStandings({
	fixture,
	contextData,
	isContextLoading,
}: FixtureStandingsProps) {
	const homeTeamId = fixture?.teams?.home?.id;
	const awayTeamId = fixture?.teams?.away?.id;

	// Process standings data from context
	const { standings, descriptionColors, liveTeamIds } = useMemo(() => {
		if (!contextData?.standings?.rows?.length) {
			return { standings: null, descriptionColors: [], liveTeamIds: [] };
		}

		const rows = contextData.standings.rows;
		const colors = buildDescriptionColors(rows);
		const liveIds = [homeTeamId, awayTeamId].filter(Boolean) as number[];

		return {
			standings: rows,
			descriptionColors: colors,
			liveTeamIds: liveIds,
		};
	}, [contextData, homeTeamId, awayTeamId]);

	// Loading state
	if (isContextLoading) {
		return (
			<View className="items-center justify-center py-32">
				<ActivityIndicator />
			</View>
		);
	}

	// No data state
	if (!standings?.length) {
		return (
			<View className="px-16 py-24">
				<NoResultsBox text="There are no standings available for this match" />
			</View>
		);
	}

	return (
		<View className="py-24">
			<StandingsHeader />
			<StandingsList
				standings={standings}
				liveTeamIds={liveTeamIds}
				descriptionColors={descriptionColors}
			/>
			<StandingsLegend descriptionColors={descriptionColors} />
		</View>
	);
}

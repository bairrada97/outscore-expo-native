import { StatRow } from "@/components/stat-row/stat-row";
import { Text } from "@/components/ui/text";
import {
	findStatByType,
	isPercentageStat,
	type FixtureWithStatistics,
} from "@/utils/fixture-statistics";
import type { Fixture } from "@outscore/shared-types";
import { View } from "react-native";

/**
 * Order of stats to display (matches the design)
 */
const STATS_ORDER = [
	"Ball Possession",
	"Shots on Goal",
	"Shots off Goal",
	"Total Shots",
	"Blocked Shots",
	"Shots insidebox",
	"Shots outsidebox",
	"Fouls",
	"Corner Kicks",
	"Offsides",
	"Yellow Cards",
	"Red Cards",
	"Goalkeeper Saves",
	"Total passes",
	"Passes accurate",
	"Passes %",
	"expected_goals",
	"goals_prevented",
];

/**
 * Display labels for stats (some need formatting)
 */
const STATS_LABELS: Record<string, string> = {
	"Ball Possession": "Ball Possession",
	"Shots on Goal": "Shots on Goal",
	"Shots off Goal": "Shots off Goal",
	"Total Shots": "Total Shots",
	"Blocked Shots": "Blocked Shots",
	"Shots insidebox": "Shots Insidebox",
	"Shots outsidebox": "Shots Outsidebox",
	Fouls: "Fouls",
	"Corner Kicks": "Corner Kicks",
	Offsides: "Offsides",
	"Yellow Cards": "Yellow Cards",
	"Red Cards": "Red Cards",
	"Goalkeeper Saves": "Goalkeeper Saves",
	"Total passes": "Total Passes",
	"Passes accurate": "Passes Accurate",
	"Passes %": "Passes %",
	expected_goals: "Expected Goals",
	goals_prevented: "Goals Prevented",
};

type FixtureStatisticsProps = {
	fixture: Fixture;
};

export function FixtureStatistics({ fixture }: FixtureStatisticsProps) {
	const stats = (fixture as FixtureWithStatistics).statistics;

	if (!stats || stats.length === 0) {
		return (
			<View className="items-center justify-center py-32">
				<Text variant="body-02" className="text-neu-07 dark:text-neu-06">
					No statistics available
				</Text>
			</View>
		);
	}

	const homeStats =
		stats.find((entry) => entry.team.id === fixture.teams.home.id) ?? stats[0];
	const awayStats =
		stats.find((entry) => entry.team.id === fixture.teams.away.id) ?? stats[1];

	if (!homeStats || !awayStats) {
		return (
			<View className="items-center justify-center py-32">
				<Text variant="body-02" className="text-neu-07 dark:text-neu-06">
					No statistics available
				</Text>
			</View>
		);
	}

	// Get all unique stat types from both teams
	const allStatTypes = new Set<string>();
	for (const stat of homeStats.statistics) {
		allStatTypes.add(stat.type);
	}
	for (const stat of awayStats.statistics) {
		allStatTypes.add(stat.type);
	}

	// Sort stats by the predefined order, then alphabetically for any extras
	const sortedStatTypes = Array.from(allStatTypes).sort((a, b) => {
		const indexA = STATS_ORDER.findIndex(
			(s) => s.toLowerCase() === a.toLowerCase(),
		);
		const indexB = STATS_ORDER.findIndex(
			(s) => s.toLowerCase() === b.toLowerCase(),
		);

		if (indexA !== -1 && indexB !== -1) return indexA - indexB;
		if (indexA !== -1) return -1;
		if (indexB !== -1) return 1;
		return a.localeCompare(b);
	});

	return (
		<View className="gap-y-16">
			{sortedStatTypes.map((statType) => {
				const homeValue = findStatByType(homeStats.statistics, statType);
				const awayValue = findStatByType(awayStats.statistics, statType);

				// Skip if both values are null
				if (homeValue == null && awayValue == null) return null;

				const label =
					STATS_LABELS[statType] ??
					statType.charAt(0).toUpperCase() + statType.slice(1);
				const isPct = isPercentageStat(statType);
				const precision = statType.toLowerCase() === "expected_goals" ? 2 : 0;

				return (
					<StatRow
						key={statType}
						label={label}
						homeValue={homeValue}
						awayValue={awayValue}
						precision={precision}
						isPercentage={isPct}
					/>
				);
			})}
		</View>
	);
}

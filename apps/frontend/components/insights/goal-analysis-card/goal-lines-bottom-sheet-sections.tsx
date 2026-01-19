import { Badge } from "@/components/ui/SvgIcons/badge";
import { Text } from "@/components/ui/text";
import { View } from "react-native";
import { GoalLinesAccordion } from "./goal-lines-accordion";
import type { GoalSimulation } from "./types";
import { formatPercent } from "./utils";

type GoalLinesSheetHeaderProps = {
	selectedLine: number;
	isOver: boolean;
	primaryValue: number;
	strengthLabel: string;
	reliabilityLabel: string;
};

export function GoalLinesSheetHeader({
	selectedLine,
	isOver,
	primaryValue,
	strengthLabel,
	reliabilityLabel,
}: GoalLinesSheetHeaderProps) {
	return (
		<View className="gap-y-8">
			<Text
				variant="caption-03"
				className="uppercase text-neu-07 dark:text-neu-06"
			>
				Selected goal line
			</Text>

			<View className="flex-row items-baseline gap-8 flex-wrap">
				<Text variant="highlight-02" className="text-neu-10 dark:text-neu-01">
					{isOver ? "Over" : "Under"} {selectedLine}
				</Text>
				<Text
					variant="highlight-02"
					className="text-m-01 dark:text-m-01-light-04"
				>
					{formatPercent(primaryValue)}
				</Text>
			</View>

			<View className="flex-row items-center gap-8 flex-wrap">
				<Badge className="bg-m-01-light-03/20 dark:bg-m-01-light-04/20 border-transparent px-8 py-4">
					<Text
						variant="caption-03"
						className="uppercase text-m-01 dark:text-m-01-light-04"
					>
						{strengthLabel}
					</Text>
				</Badge>
				<Badge className="bg-neu-03 dark:bg-neu-12 border-transparent px-8 py-4">
					<Text
						variant="caption-03"
						className="uppercase text-neu-08 dark:text-neu-05"
					>
						Reliability: {reliabilityLabel}
					</Text>
				</Badge>
			</View>
		</View>
	);
}

type GoalLinesSeasonTrendsProps = {
	homePct: number | null;
	awayPct: number | null;
	bothAvg: number | null;
};

function clampPct(value: number | null) {
	if (typeof value !== "number") return 0;
	return Math.max(0, Math.min(100, value));
}

export function GoalLinesSeasonTrends({
	homePct,
	awayPct,
	bothAvg,
}: GoalLinesSeasonTrendsProps) {
	return (
		<View className="gap-y-16">
			<View className="gap-y-4">
				<Text
					variant="caption-01"
					className="uppercase text-neu-07 dark:text-neu-06"
				>
					Season trends
				</Text>
				<Text variant="caption-03" className="text-neu-07 dark:text-neu-06">
					How often teams go Over the selected line for the season
				</Text>
			</View>

			<View className="gap-y-8">
				<View className="flex-row items-baseline gap-8 flex-wrap">
					<Text variant="highlight-04" className="text-neu-07 dark:text-neu-06">
						Season avg (both teams):
					</Text>
					<Text variant="highlight-03" className="text-neu-10 dark:text-neu-01">
						{bothAvg !== null ? `${bothAvg.toFixed(0)}%` : "—"}
					</Text>
				</View>

				<View className="gap-y-16">
					<View className="gap-y-4">
						<View className="flex-row items-center justify-between">
							<Text
								variant="caption-03"
								className="uppercase text-neu-07 dark:text-neu-06"
							>
								Home
							</Text>
							<Text
								variant="caption-03"
								className="uppercase text-neu-08 dark:text-neu-05"
							>
								{homePct !== null ? `${homePct.toFixed(0)}%` : "—"}
							</Text>
						</View>
						<View className="h-8 bg-neu-03 dark:bg-neu-12 rounded-full overflow-hidden">
							<View
								style={{ width: `${clampPct(homePct)}%` }}
								className="h-8 bg-m-01 dark:bg-m-01-light-04"
							/>
						</View>
					</View>

					<View className="gap-y-4">
						<View className="flex-row items-center justify-between">
							<Text
								variant="caption-03"
								className="uppercase text-neu-07 dark:text-neu-06"
							>
								Away
							</Text>
							<Text
								variant="caption-03"
								className="uppercase text-neu-08 dark:text-neu-05"
							>
								{awayPct !== null ? `${awayPct.toFixed(0)}%` : "—"}
							</Text>
						</View>
						<View className="h-8 bg-neu-03 dark:bg-neu-12 rounded-full overflow-hidden">
							<View
								style={{ width: `${clampPct(awayPct)}%` }}
								className="h-8 bg-neu-06 dark:bg-neu-09"
							/>
						</View>
					</View>
				</View>
			</View>
		</View>
	);
}

type GoalLinesProbabilitySectionProps = {
	simulations: GoalSimulation[];
	onSelectLine?: (line: number) => void;
};

export function GoalLinesProbabilitySection({
	simulations,
	onSelectLine,
}: GoalLinesProbabilitySectionProps) {
	return (
		<View className="gap-y-8 py-16">
			<View className="flex-row items-center justify-between">
				<Text
					variant="caption-01"
					className="uppercase text-neu-07 dark:text-neu-06"
				>
					Probability & insights
				</Text>
				<Text variant="caption-03" className="text-neu-07 dark:text-neu-06">
					Tap rows to expand
				</Text>
			</View>

			<View className="bg-neu-02 dark:bg-neu-12 rounded-lg px-16">
				<GoalLinesAccordion
					simulations={simulations}
					onSelectLine={onSelectLine}
				/>
			</View>
		</View>
	);
}

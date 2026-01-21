import { Badge } from "@/components/ui/SvgIcons/badge";
import { Text } from "@/components/ui/text";
import { Pressable, View } from "react-native";
import { GoalSignalAccordion } from "./goal-signal-accordion";
import type { GoalInsight } from "./types";
import { formatPercent } from "./utils";

export type BttsOutcome = "yes" | "no";

type BttsSheetHeaderProps = {
	selectedOutcome: BttsOutcome;
	yesPct: number;
	noPct: number;
	strengthLabel: string;
	reliabilityLabel: string;
};

export function BttsSheetHeader({
	selectedOutcome,
	yesPct,
	noPct,
	strengthLabel,
	reliabilityLabel,
}: BttsSheetHeaderProps) {
	const primaryValue = selectedOutcome === "yes" ? yesPct : noPct;

	return (
		<View className="gap-y-8">
			<Text
				variant="caption-03"
				className="uppercase text-neu-07 dark:text-neu-06"
			>
				Selected market
			</Text>

			<View className="flex-row items-baseline gap-8 flex-wrap">
				<Text variant="highlight-02" className="text-neu-10 dark:text-neu-01">
					BTTS {selectedOutcome === "yes" ? "Yes" : "No"}
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

type BttsSeasonTrendsProps = {
	selectedOutcome: BttsOutcome;
	homeYesPct?: number;
	awayYesPct?: number;
};

function clampPct(value: number | null) {
	if (typeof value !== "number") return 0;
	return Math.max(0, Math.min(100, value));
}

function toSelectedOutcomePct(
	selectedOutcome: BttsOutcome,
	yesPct: number | null,
): number | null {
	if (typeof yesPct !== "number") return null;
	return selectedOutcome === "yes" ? yesPct : 100 - yesPct;
}

export function BttsSeasonTrends({
	selectedOutcome,
	homeYesPct,
	awayYesPct,
}: BttsSeasonTrendsProps) {
	const homePct = toSelectedOutcomePct(
		selectedOutcome,
		typeof homeYesPct === "number" ? homeYesPct : null,
	);
	const awayPct = toSelectedOutcomePct(
		selectedOutcome,
		typeof awayYesPct === "number" ? awayYesPct : null,
	);
	const bothAvg =
		typeof homePct === "number" && typeof awayPct === "number"
			? (homePct + awayPct) / 2
			: null;

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
					How often teams land BTTS {selectedOutcome === "yes" ? "Yes" : "No"}{" "}
					for the season
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

type BttsProbabilityInsightsProps = {
	selectedOutcome: BttsOutcome;
	onSelectOutcome: (value: BttsOutcome) => void;
	yesPct: number;
	noPct: number;
	insights: GoalInsight[];
};

function OutcomeRow({
	label,
	value,
	isSelected,
	onPress,
}: {
	label: string;
	value: number;
	isSelected: boolean;
	onPress: () => void;
}) {
	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="button"
			accessibilityLabel={`${label} ${formatPercent(value)}`}
			accessibilityState={{ selected: isSelected }}
			className={`px-16 py-16 rounded-lg border flex-row items-center justify-between ${
				isSelected
					? "border-m-01/40 bg-neu-01 dark:bg-neu-11"
					: "border-neu-04/60 dark:border-neu-10/60 bg-transparent"
			}`}
		>
			<Text
				variant="caption-03"
				className="uppercase text-neu-08 dark:text-neu-05"
			>
				{label}
			</Text>
			<Text
				variant="highlight-04"
				className={
					isSelected
						? "text-m-01 dark:text-m-01-light-04"
						: "text-neu-10 dark:text-neu-01"
				}
			>
				{formatPercent(value)}
			</Text>
		</Pressable>
	);
}

export function BttsProbabilityInsights({
	selectedOutcome,
	onSelectOutcome,
	yesPct,
	noPct,
	insights,
}: BttsProbabilityInsightsProps) {
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
					Tap Yes/No to select
				</Text>
			</View>

			<View className="bg-neu-02 dark:bg-neu-12 rounded-lg p-16 gap-y-16">
				<OutcomeRow
					label="Yes"
					value={yesPct}
					isSelected={selectedOutcome === "yes"}
					onPress={() => onSelectOutcome("yes")}
				/>
				<OutcomeRow
					label="No"
					value={noPct}
					isSelected={selectedOutcome === "no"}
					onPress={() => onSelectOutcome("no")}
				/>

				<View className="h-px bg-neu-04/60 dark:bg-neu-10/60" />

				<GoalSignalAccordion insights={insights} />
			</View>
		</View>
	);
}

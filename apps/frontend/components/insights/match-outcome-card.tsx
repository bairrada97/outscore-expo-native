import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { BarChart3 } from "lucide-react-native";
import { View } from "react-native";

type MatchOutcomeInsight = {
	text: string;
	parts?: Array<{ text: string; bold?: boolean }>;
	emoji?: string;
	category?: string;
	severity?: string;
};

type MatchOutcomeCardProps = {
	homeTeam: string;
	awayTeam: string;
	probabilityDistribution: {
		home?: number;
		draw?: number;
		away?: number;
	};
	signalStrength?: string;
	modelReliability?: string;
	mostProbableOutcome?: string;
	insights?: MatchOutcomeInsight[];
};

const formatPercent = (value?: number) => {
	if (!Number.isFinite(value)) return "0.0%";
	return `${Number(value).toFixed(1)}%`;
};

const normalizeLabel = (value?: string) => {
	if (!value) return "Balanced";
	return value.replace(/_/g, " ").toLowerCase();
};

const titleCase = (value: string) =>
	value.replace(/\b\w/g, (char) => char.toUpperCase());

const getOutcomeEdgeLabel = (probabilityDistribution: {
	home?: number;
	draw?: number;
	away?: number;
}) => {
	const home = probabilityDistribution.home ?? 0;
	const draw = probabilityDistribution.draw ?? 0;
	const away = probabilityDistribution.away ?? 0;
	const ordered = [
		{ key: "home", value: home },
		{ key: "draw", value: draw },
		{ key: "away", value: away },
	].sort((a, b) => b.value - a.value);
	const top = ordered[0];
	const second = ordered[1];
	const min = ordered[2];
	const pick =
		top.key === "home"
			? "Favors Home Side"
			: top.key === "away"
				? "Favors Away Side"
				: "Favors Draw";

	const SLIGHT_LEAN_MARGIN_PCT = 5;
	if (top.value - min.value <= SLIGHT_LEAN_MARGIN_PCT) {
		return "Balanced outlook";
	}
	if (top.value - second.value <= SLIGHT_LEAN_MARGIN_PCT) {
		return `Slight lean: ${pick}`;
	}
	return pick;
};

const isWatchOutInsight = (insight: MatchOutcomeInsight) =>
	insight.category === "WARNING" || insight.severity === "CRITICAL";

const renderInsightText = (insight: MatchOutcomeInsight) => {
	if (insight.parts && insight.parts.length > 0) {
		return insight.parts.map((part, idx) => (
			<Text
				key={`${idx}-${part.text}`}
				variant={part.bold ? "body-02--semi" : "body-02"}
				className="text-neu-10 dark:text-neu-01"
			>
				{part.text}
			</Text>
		));
	}
	return (
		<Text variant="body-02" className="text-neu-10 dark:text-neu-01">
			{insight.text}
		</Text>
	);
};

export function MatchOutcomeCard({
	homeTeam,
	awayTeam,
	probabilityDistribution,
	signalStrength,
	modelReliability,
	insights = [],
}: MatchOutcomeCardProps) {
	const homeValue = probabilityDistribution.home ?? 0;
	const drawValue = probabilityDistribution.draw ?? 0;
	const awayValue = probabilityDistribution.away ?? 0;
	const total = homeValue + drawValue + awayValue || 1;
	const maxSide = Math.max(homeValue, drawValue, awayValue);

	const supportingInsights = insights.filter(
		(insight) => !isWatchOutInsight(insight),
	);
	const watchOutInsights = insights.filter((insight) =>
		isWatchOutInsight(insight),
	);

	return (
		<View className="bg-neu-01 dark:bg-neu-11 shadow-sha-01 dark:shadow-sha-06 rounded-lg p-16 gap-y-16">
			<View className="flex-row items-center gap-8">
				<Icon as={BarChart3} className="text-m-01 size-5" />
				<Text variant="title-02" className="text-m-01 dark:text-m-01-light-04">
					Outcome Probability Rating
				</Text>
			</View>

			<View className="gap-y-8">
				<Text variant="highlight-02" className="text-neu-10 dark:text-neu-01">
					{getOutcomeEdgeLabel(probabilityDistribution)}
				</Text>

				<View className="flex-row items-center gap-8">
					<View className="rounded-md bg-m-01-light-03/20 dark:bg-m-01-light-04/20 px-8 py-4">
						<Text
							variant="caption-03"
							className="uppercase text-m-01 dark:text-m-01-light-04"
						>
							Strength: {titleCase(normalizeLabel(signalStrength))}
						</Text>
					</View>
					<View className="rounded-md bg-m-01-light-03/20 dark:bg-m-01-light-04/20 px-8 py-4">
						<Text
							variant="caption-03"
							className="uppercase text-m-01 dark:text-m-01-light-04"
						>
							Reliability: {titleCase(normalizeLabel(modelReliability))}
						</Text>
					</View>
				</View>
			</View>

			<View className="gap-y-8">
				<View className="flex-row items-end">
					<View className="flex-1 gap-y-4">
						<Text
							variant="caption-03"
							className="uppercase text-neu-07 dark:text-neu-06"
						>
							Home
						</Text>
						<Text
							variant={homeValue === maxSide ? "highlight-02" : "highlight-03"}
							className={`${
								homeValue === maxSide
									? "text-m-01"
									: "text-neu-07 dark:text-neu-06"
							}`}
						>
							{formatPercent(homeValue)}
						</Text>
					</View>
					<View className="flex-1 gap-y-4 items-center">
						<Text
							variant="caption-03"
							className="uppercase text-neu-07 dark:text-neu-06"
						>
							Draw
						</Text>
						<Text
							variant={drawValue === maxSide ? "highlight-02" : "highlight-03"}
							className={`${
								drawValue === maxSide
									? "text-m-01"
									: "text-neu-07 dark:text-neu-06"
							}`}
						>
							{formatPercent(drawValue)}
						</Text>
					</View>
					<View className="flex-1 gap-y-4 items-end">
						<Text
							variant="caption-03"
							className="uppercase text-neu-07 dark:text-neu-06"
						>
							Away
						</Text>
						<Text
							variant={awayValue === maxSide ? "highlight-02" : "highlight-03"}
							className={`${
								awayValue === maxSide
									? "text-m-01"
									: "text-neu-07 dark:text-neu-06"
							}`}
						>
							{formatPercent(awayValue)}
						</Text>
					</View>
				</View>

				<View className="h-8 bg-neu-03 dark:bg-neu-12 rounded-full overflow-hidden flex-row">
					<View
						style={{ flexGrow: homeValue / total }}
						className={
							homeValue === maxSide
								? "bg-m-01-light-02 dark:bg-m-01-light-03"
								: "bg-neu-05 dark:bg-neu-10"
						}
					/>
					<View
						style={{ flexGrow: drawValue / total }}
						className={
							drawValue === maxSide
								? "bg-m-01-light-02 dark:bg-m-01-light-03"
								: "bg-neu-04 dark:bg-neu-09"
						}
					/>
					<View
						style={{ flexGrow: awayValue / total }}
						className={
							awayValue === maxSide
								? "bg-m-01-light-02 dark:bg-m-01-light-03"
								: "bg-neu-05 dark:bg-neu-10"
						}
					/>
				</View>
			</View>

			<View className="flex-row items-center gap-8">
				<Text
					variant="caption-03"
					className="uppercase text-neu-07 dark:text-neu-06"
				>
					Detailed signals
				</Text>
				<View className="rounded-md bg-m-01-light-03/20 dark:bg-m-01-light-04/20 px-8 py-4">
					<Text
						variant="caption-03"
						className="uppercase text-m-01 dark:text-m-01-light-04"
					>
						{supportingInsights.length} supporting
					</Text>
				</View>
				<View className="rounded-md bg-red/10 px-8 py-4">
					<Text variant="caption-03" className="uppercase text-red">
						{watchOutInsights.length} watch-outs
					</Text>
				</View>
			</View>

			<View className="gap-y-12">
				<View className="gap-y-8">
					<Text
						variant="title-02"
						className="text-m-01 dark:text-m-01-light-04"
					>
						Key reasons
					</Text>
					{supportingInsights.length === 0 ? (
						<Text variant="body-02" className="text-neu-07 dark:text-neu-06">
							No supporting signals available yet.
						</Text>
					) : (
						supportingInsights.map((insight, index) => (
							<View
								// eslint-disable-next-line react/no-array-index-key
								key={`${insight.text}-${index}`}
								className="flex-row items-start gap-8"
							>
								<View className="h-8 w-8 rounded-full bg-m-01-light-03 mt-4" />
								<View className="flex-1 flex-row flex-wrap">
									{renderInsightText(insight)}
								</View>
							</View>
						))
					)}
				</View>

				<View className="gap-y-8">
					<Text variant="title-02" className="text-red">
						Watch-outs
					</Text>
					{watchOutInsights.length === 0 ? (
						<Text variant="body-02" className="text-neu-07 dark:text-neu-06">
							No watch-outs detected.
						</Text>
					) : (
						watchOutInsights.map((insight, index) => (
							<View
								// eslint-disable-next-line react/no-array-index-key
								key={`${insight.text}-${index}`}
								className="flex-row items-start gap-8"
							>
								<View className="h-8 w-8 rounded-full bg-red mt-4" />
								<View className="flex-1 flex-row flex-wrap">
									{renderInsightText(insight)}
								</View>
							</View>
						))
					)}
				</View>
			</View>

			<View className="gap-y-4">
				<Text
					variant="caption-03"
					className="uppercase text-neu-07 dark:text-neu-06"
				>
					{homeTeam} vs {awayTeam}
				</Text>
			</View>
		</View>
	);
}

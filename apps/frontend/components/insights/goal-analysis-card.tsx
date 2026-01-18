import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Icon } from "@/components/ui/icon";
import { Badge } from "@/components/ui/SvgIcons/badge";
import { Text } from "@/components/ui/text";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ChevronRight, Info } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";

type GoalInsight = {
	text: string;
	parts?: Array<{ text: string; bold?: boolean }>;
	emoji?: string;
	category?: string;
	severity?: string;
};

type ProbabilityDistribution = {
	over?: number;
	under?: number;
	yes?: number;
	no?: number;
};

type GoalSimulation = {
	scenarioType: string;
	line?: number;
	probabilityDistribution?: ProbabilityDistribution;
	signalStrength?: string;
	modelReliability?: string;
	mostProbableOutcome?: string;
	insights?: GoalInsight[];
};

type GoalAnalysisCardProps = {
	overUnderSimulations: GoalSimulation[];
	bttsSimulation?: GoalSimulation | null;
};

const tooltipText = "test";

const normalizeLabel = (value?: string) => {
	if (!value) return "Balanced";
	return value.replace(/_/g, " ").toLowerCase();
};

const titleCase = (value: string) =>
	value.replace(/\b\w/g, (char) => char.toUpperCase());

const formatPercent = (value?: number) => {
	if (!Number.isFinite(value)) return "0.0%";
	return `${Number(value).toFixed(1)}%`;
};

const isWatchOutInsight = (insight: GoalInsight) =>
	insight.category === "WARNING" || insight.severity === "CRITICAL";

const renderInsightText = (insight: GoalInsight) => {
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

function getGoalLineLabel(line?: number, isOver?: boolean): string {
	if (typeof line !== "number") return isOver ? "Favors Over" : "Favors Under";
	return isOver ? `Favors +${line} Goals` : `Favors -${line} Goals`;
}

function GoalSignalAccordion({ insights = [] }: { insights?: GoalInsight[] }) {
	const supportingInsights = insights.filter(
		(insight) => !isWatchOutInsight(insight),
	);
	const watchOutInsights = insights.filter((insight) =>
		isWatchOutInsight(insight),
	);

	return (
		<Accordion type="single" collapsible>
			<AccordionItem value="signals" className="border-none">
				<AccordionTrigger className="py-0">
					<View className="flex-row items-center gap-8">
						<Text
							variant="caption-03"
							className="uppercase text-neu-07 dark:text-neu-06"
						>
							Key signals
						</Text>
						<Badge className="bg-m-01-light-03/20 dark:bg-m-01-light-04/20 border-transparent px-8 py-4">
							<Text
								variant="caption-03"
								className="uppercase text-m-01 dark:text-m-01-light-04"
							>
								{supportingInsights.length} supporting
							</Text>
						</Badge>
						<Badge className="bg-red/10 border-transparent px-8 py-4">
							<Text variant="caption-03" className="uppercase text-red">
								{watchOutInsights.length} watch-out
							</Text>
						</Badge>
					</View>
				</AccordionTrigger>
				<AccordionContent className="pt-8">
					<View className="gap-y-16">
						<View className="gap-y-8">
							<Text
								variant="title-02"
								className="text-m-01 dark:text-m-01-light-04"
							>
								Supporting facts
							</Text>
							{supportingInsights.length === 0 ? (
								<Text
									variant="body-02"
									className="text-neu-07 dark:text-neu-06"
								>
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
								<Text
									variant="body-02"
									className="text-neu-07 dark:text-neu-06"
								>
									No watch-outs detected.
								</Text>
							) : (
								watchOutInsights.map((insight, index) => (
									<View
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
				</AccordionContent>
			</AccordionItem>
		</Accordion>
	);
}

export function GoalAnalysisCard({
	overUnderSimulations,
	bttsSimulation,
}: GoalAnalysisCardProps) {
	const [activeKey, setActiveKey] = useState<"over_under" | "btts">(
		bttsSimulation ? "over_under" : "over_under",
	);

	const activeOverUnder = useMemo(() => {
		if (!overUnderSimulations.length) return undefined;
		const byLine = overUnderSimulations.find((s) => s.line === 2.5);
		if (byLine) return byLine;
		return [...overUnderSimulations].sort(
			(a, b) => (a.line ?? 0) - (b.line ?? 0),
		)[0];
	}, [overUnderSimulations]);

	const activeSimulation =
		activeKey === "btts" ? (bttsSimulation ?? undefined) : activeOverUnder;

	const probability = activeSimulation?.probabilityDistribution ?? {};
	const overValue = probability.over ?? 0;
	const underValue = probability.under ?? 0;
	const yesValue = probability.yes ?? 0;
	const noValue = probability.no ?? 0;
	const isOverUnder = activeKey === "over_under";

	const leftValue = isOverUnder ? overValue : yesValue;
	const rightValue = isOverUnder ? underValue : noValue;
	const total = leftValue + rightValue || 1;
	const maxSide = Math.max(leftValue, rightValue);

	const strengthLabel = titleCase(
		normalizeLabel(activeSimulation?.signalStrength),
	);
	const reliabilityLabel = titleCase(
		normalizeLabel(activeSimulation?.modelReliability),
	);

	return (
		<View className="shadow-sha-01 dark:shadow-sha-06 rounded-lg bg-neu-01 dark:bg-neu-11 p-16">
			<View className="flex-row items-center gap-8">
				<Text
					variant="caption-01"
					className="uppercase text-m-01 dark:text-m-01-light-04"
				>
					Goal Analysis
				</Text>
			</View>

			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				contentContainerStyle={{ paddingTop: 8, paddingBottom: 8 }}
			>
				<View className="flex-row gap-8">
					<Pressable
						onPress={() => setActiveKey("over_under")}
						className={`px-16 py-8 rounded-full border ${
							activeKey === "over_under"
								? "bg-neu-03 dark:bg-neu-12 border-neu-04 dark:border-neu-10"
								: "bg-transparent border-neu-04/60 dark:border-neu-10/60"
						}`}
					>
						<Text
							variant="caption-03"
							className="uppercase text-neu-08 dark:text-neu-05"
						>
							Over/Under
						</Text>
					</Pressable>
					<Pressable
						onPress={() => setActiveKey("btts")}
						className={`px-16 py-8 rounded-full border ${
							activeKey === "btts"
								? "bg-neu-03 dark:bg-neu-12 border-neu-04 dark:border-neu-10"
								: "bg-transparent border-neu-04/60 dark:border-neu-10/60"
						}`}
					>
						<Text
							variant="caption-03"
							className="uppercase text-neu-08 dark:text-neu-05"
						>
							BTTS
						</Text>
					</Pressable>
				</View>
			</ScrollView>

			<View className="bg-neu-02 dark:bg-neu-12 px-16 py-16 gap-y-16 rounded-lg mt-8">
				<View className="gap-y-8">
					<Text variant="highlight-03" className="text-neu-10 dark:text-neu-01">
						{isOverUnder
							? getGoalLineLabel(activeOverUnder?.line, overValue >= underValue)
							: yesValue >= noValue
								? "Favors both teams to score"
								: "Favors a clean sheet"}
					</Text>

					<View className="flex-row items-center gap-8">
						<Tooltip>
							<TooltipTrigger asChild>
								<Badge className="bg-m-01-light-03/20 dark:bg-m-01-light-04/20 border-transparent px-8 py-4">
									<View className="flex-row items-center gap-4">
										<Icon
											as={Info}
											className="size-3 text-m-01 dark:text-m-01-light-04"
										/>
										<Text
											variant="caption-03"
											className="uppercase text-m-01 dark:text-m-01-light-04"
										>
											Strength: {strengthLabel}
										</Text>
									</View>
								</Badge>
							</TooltipTrigger>
							<TooltipContent>{tooltipText}</TooltipContent>
						</Tooltip>
						<Tooltip>
							<TooltipTrigger asChild>
								<Badge className="bg-m-01-light-03/20 dark:bg-m-01-light-04/20 border-transparent px-8 py-4">
									<View className="flex-row items-center gap-4">
										<Icon
											as={Info}
											className="size-3 text-m-01 dark:text-m-01-light-04"
										/>
										<Text
											variant="caption-03"
											className="uppercase text-m-01 dark:text-m-01-light-04"
										>
											Reliability: {reliabilityLabel}
										</Text>
									</View>
								</Badge>
							</TooltipTrigger>
							<TooltipContent>{tooltipText}</TooltipContent>
						</Tooltip>
					</View>
				</View>

				<View className="gap-y-8">
					<View className="flex-row items-stretch">
						<View className="flex-1 justify-between">
							<Text
								variant="caption-03"
								className="uppercase text-neu-07 dark:text-neu-06"
							>
								{isOverUnder ? `Over ${activeOverUnder?.line ?? "—"}` : "Yes"}
							</Text>
							<View className="justify-end">
								<Text
									variant={leftValue === maxSide ? "highlight-01" : "body-02"}
									className={
										leftValue === maxSide
											? "text-m-02"
											: "text-neu-07 dark:text-neu-06"
									}
								>
									{formatPercent(leftValue)}
								</Text>
							</View>
						</View>
						<View className="flex-1 justify-between items-end">
							<Text
								variant="caption-03"
								className="uppercase text-neu-07 dark:text-neu-06"
							>
								{isOverUnder ? `Under ${activeOverUnder?.line ?? "—"}` : "No"}
							</Text>
							<View className="justify-end">
								<Text
									variant={rightValue === maxSide ? "highlight-01" : "body-02"}
									className={
										rightValue === maxSide
											? "text-m-02"
											: "text-neu-07 dark:text-neu-06"
									}
								>
									{formatPercent(rightValue)}
								</Text>
							</View>
						</View>
					</View>

					<View className="h-8 bg-neu-03 dark:bg-neu-12 rounded-full overflow-hidden flex-row">
						<View
							style={{ flexGrow: leftValue / total }}
							className={
								leftValue === maxSide
									? "bg-linear-to-r from-m-02-dark-01 to-m-02-light-02"
									: "bg-linear-to-r from-neu-05 to-neu-06 dark:from-neu-10 dark:to-neu-09"
							}
						/>
						<View
							style={{ flexGrow: rightValue / total }}
							className={
								rightValue === maxSide
									? "bg-linear-to-r from-m-02-dark-01 to-m-02-light-02"
									: "bg-linear-to-r from-neu-06 to-neu-05 dark:from-neu-09 dark:to-neu-10"
							}
						/>
					</View>
				</View>

				{isOverUnder && overUnderSimulations.length > 1 ? (
					<Pressable className="border border-neu-04/60 dark:border-neu-10/60 rounded-lg px-16 py-16 flex-row items-center justify-between">
						<View className="flex-row items-center gap-8">
							<Text
								variant="caption-03"
								className="text-neu-08 dark:text-neu-06"
							>
								Goal lines breakdown
							</Text>
						</View>
						<Icon as={ChevronRight} className="text-neu-06 size-4" />
					</Pressable>
				) : null}

				<View className="h-px bg-neu-04/60 dark:bg-neu-10/60" />

				<GoalSignalAccordion insights={activeSimulation?.insights ?? []} />
			</View>
		</View>
	);
}

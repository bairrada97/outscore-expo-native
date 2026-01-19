import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { AlertTriangle } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";
import type { GoalInsight, GoalSimulation } from "./types";
import { formatPercent, isWatchOutInsight, renderInsightText } from "./utils";

function splitInsights(insights: GoalInsight[]) {
	const supporting = insights.filter((i) => !isWatchOutInsight(i));
	const watchOuts = insights.filter((i) => isWatchOutInsight(i));
	return { supporting, watchOuts };
}

function GoalLineSignals({ insights }: { insights: GoalInsight[] }) {
	const { supporting, watchOuts } = splitInsights(insights);

	return (
		<View className="gap-y-16 pt-8">
			<View className="gap-y-8">
				<Text variant="title-02" className="text-m-01 dark:text-m-01-light-04">
					Supporting
				</Text>
				{supporting.length === 0 ? (
					<Text variant="body-02" className="text-neu-07 dark:text-neu-06">
						No supporting signals available yet.
					</Text>
				) : (
					supporting.map((insight, index) => (
						<View
							key={`${insight.text}-${index}`}
							className="flex-row items-start gap-8"
						>
							<View className="mt-4 h-8 w-8 rounded-full bg-m-01-light-03" />
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
				{watchOuts.length === 0 ? (
					<Text variant="body-02" className="text-neu-07 dark:text-neu-06">
						No watch-outs detected.
					</Text>
				) : (
					watchOuts.map((insight, index) => (
						<View
							key={`${insight.text}-${index}`}
							className="flex-row items-start gap-8"
						>
							<View className="mt-4 h-8 w-8 rounded-full bg-red" />
							<View className="flex-1 flex-row flex-wrap">
								{renderInsightText(insight)}
							</View>
						</View>
					))
				)}
			</View>
		</View>
	);
}

export type GoalLinesAccordionProps = {
	simulations: GoalSimulation[];
	onSelectLine?: (line: number) => void;
};

export function GoalLinesAccordion({
	simulations,
	onSelectLine,
}: GoalLinesAccordionProps) {
	const items = simulations
		.filter((s) => s.scenarioType === "TotalGoalsOverUnder")
		.filter((s) => typeof s.line === "number")
		.sort((a, b) => (a.line ?? 0) - (b.line ?? 0));

	const [openValue, setOpenValue] = useState<string>("");

	return (
		<Accordion
			type="single"
			collapsible
			value={openValue}
			onValueChange={(val: string | undefined) => {
				const nextValue = val ?? "";
				setOpenValue(nextValue);
				if (nextValue) {
					const lineNum = Number.parseFloat(nextValue.replace("line-", ""));
					if (Number.isFinite(lineNum)) {
						onSelectLine?.(lineNum);
					}
				}
			}}
		>
			{items.map((sim) => {
				const line = sim.line ?? 0;
				const over = sim.probabilityDistribution?.over ?? 0;
				const under = sim.probabilityDistribution?.under ?? 0;
				const insights = sim.insights ?? [];
				const { watchOuts } = splitInsights(insights);

				return (
					<AccordionItem
						key={`line-${line}`}
						value={`line-${line}`}
						className="border-none"
					>
						<AccordionTrigger className="py-16">
							<View className="flex-1 flex-row items-center justify-between gap-12 pr-8">
								<View className="flex-row items-center gap-16 min-w-0">
									<Text
										variant="highlight-04"
										className="text-neu-10 dark:text-neu-01 w-32"
									>
										{line}
									</Text>

									<View className="gap-y-2 min-w-0">
										<Text
											variant="caption-03"
											className="uppercase text-neu-07 dark:text-neu-06"
										>
											Over prob.
										</Text>
										<Text
											variant="highlight-04"
											className="text-neu-10 dark:text-neu-01"
										>
											{formatPercent(over)}
										</Text>
									</View>

									<View className="gap-y-2 min-w-0">
										<Text
											variant="caption-03"
											className="uppercase text-neu-07 dark:text-neu-06"
										>
											Under prob.
										</Text>
										<Text
											variant="highlight-04"
											className="text-neu-10 dark:text-neu-01"
										>
											{formatPercent(under)}
										</Text>
									</View>
								</View>

								<View className="flex-row items-center gap-8">
									{watchOuts.length > 0 ? (
										<Icon as={AlertTriangle} className="size-4 text-orange" />
									) : null}
								</View>
							</View>
						</AccordionTrigger>

						<AccordionContent className="pt-0">
							<GoalLineSignals insights={insights} />
						</AccordionContent>
					</AccordionItem>
				);
			})}
		</Accordion>
	);
}

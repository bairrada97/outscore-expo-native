import { Icon } from "@/components/ui/icon";
import { Badge } from "@/components/ui/SvgIcons/badge";
import { Text } from "@/components/ui/text";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { ChevronRight, Info } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { GoalAnalysisCardTabs } from "./goal-analysis-card-tabs";
import { GoalSignalAccordion } from "./goal-signal-accordion";
import type { GoalInsight } from "./types";
import { formatPercent } from "./utils";

const tooltipText = "test";

export type GoalAnalysisCardViewProps = {
	activeKey: "over_under" | "btts";
	onSelectKey: (key: "over_under" | "btts") => void;

	isOverUnder: boolean;
	overUnderSimulationsCount: number;

	headline: string;
	strengthLabel: string;
	reliabilityLabel: string;

	leftLabel: string;
	rightLabel: string;
	leftValue: number;
	rightValue: number;
	total: number;
	maxSide: number;

	insights: GoalInsight[];
};

export function GoalAnalysisCardView({
	activeKey,
	onSelectKey,
	isOverUnder,
	overUnderSimulationsCount,
	headline,
	strengthLabel,
	reliabilityLabel,
	leftLabel,
	rightLabel,
	leftValue,
	rightValue,
	total,
	maxSide,
	insights,
}: GoalAnalysisCardViewProps) {
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

			<GoalAnalysisCardTabs activeKey={activeKey} onSelectKey={onSelectKey} />

			<View className="bg-neu-02 dark:bg-neu-12 px-16 py-16 gap-y-16 rounded-lg mt-8">
				<View className="gap-y-8">
					<Text variant="highlight-03" className="text-neu-10 dark:text-neu-01">
						{headline}
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
								{leftLabel}
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
								{rightLabel}
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

				{isOverUnder && overUnderSimulationsCount > 1 ? (
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

				<GoalSignalAccordion insights={insights} />
			</View>
		</View>
	);
}

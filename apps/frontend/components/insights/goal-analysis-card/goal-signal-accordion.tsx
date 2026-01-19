import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/SvgIcons/badge";
import { Text } from "@/components/ui/text";
import { View } from "react-native";
import type { GoalInsight } from "./types";
import { isWatchOutInsight, renderInsightText } from "./utils";

export function GoalSignalAccordion({
	insights = [],
}: {
	insights?: GoalInsight[];
}) {
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
										<View className="mt-4 h-8 w-8 rounded-full bg-red" />
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

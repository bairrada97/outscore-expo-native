import { Text } from "@/components/ui/text";
import { View } from "react-native";
import { type InsightItem, InsightRow } from "./insight-row";

type KeyInsightsListProps = {
	title: string;
	insights: InsightItem[];
};

export function KeyInsightsList({ title, insights }: KeyInsightsListProps) {
	return (
		<View className="gap-y-8">
			<Text variant="title-02" className="text-neu-07 dark:text-neu-06">
				{title}
			</Text>
			{insights.length === 0 ? (
				<View className="bg-neu-01 dark:bg-neu-11 shadow-sha-01 dark:shadow-sha-06 rounded-lg px-16 py-16">
					<Text variant="body-02" className="text-neu-07 dark:text-neu-06">
						No insights available yet.
					</Text>
				</View>
			) : (
				<View className="gap-y-8">
					{insights.map((insight, index) => (
						<InsightRow key={`${insight.text}-${index}`} insight={insight} />
					))}
				</View>
			)}
		</View>
	);
}

import { Text } from "@/components/ui/text";
import { View } from "react-native";

export type InsightItem = {
	text: string;
	category?: string;
	emoji?: string;
};

type InsightRowProps = {
	insight: InsightItem;
};

export function InsightRow({ insight }: InsightRowProps) {
	return (
		<View className="bg-neu-01 dark:bg-neu-11 shadow-sha-01 dark:shadow-sha-06 rounded-lg flex-row h-48">
			{/* Left accent */}
			<View className="w-4 bg-m-01-light-03 dark:bg-m-01-light-04" />

			<View className="flex-1 px-16 py-8 flex-row items-center gap-8">
				<View className="flex-1 flex-row items-center gap-2 min-w-0">
					{insight.emoji ? (
						<Text variant="body-02" className="text-neu-07 dark:text-neu-06">
							{insight.emoji}
						</Text>
					) : null}

					<Text
						variant="body-02"
						className="text-neu-10 dark:text-neu-01 flex-1"
					>
						{insight.text}
					</Text>
				</View>

				{/* Topic badge (right side) */}
				{insight.category ? (
					<View className="rounded-md border border-neu-04 dark:border-neu-10 px-8 py-4 bg-neu-02/40 dark:bg-neu-13/20">
						<Text
							variant="caption-03"
							className="uppercase text-neu-07 dark:text-neu-06"
						>
							{insight.category}
						</Text>
					</View>
				) : null}
			</View>
		</View>
	);
}

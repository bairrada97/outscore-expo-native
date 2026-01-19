import { Text } from "@/components/ui/text";
import { Pressable, ScrollView, View } from "react-native";

export function GoalAnalysisCardTabs({
	activeKey,
	onSelectKey,
}: {
	activeKey: "over_under" | "btts";
	onSelectKey: (key: "over_under" | "btts") => void;
}) {
	return (
		<ScrollView
			horizontal
			showsHorizontalScrollIndicator={false}
			contentContainerStyle={{ paddingTop: 8, paddingBottom: 8 }}
		>
			<View className="flex-row gap-8">
				<Pressable
					onPress={() => onSelectKey("over_under")}
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
					onPress={() => onSelectKey("btts")}
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
	);
}

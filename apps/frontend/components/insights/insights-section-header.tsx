import { Text } from "@/components/ui/text";
import { View } from "react-native";

type InsightsSectionHeaderProps = {
	title: string;
};

export function InsightsSectionHeader({ title }: InsightsSectionHeaderProps) {
	return (
		<View className="h-40 flex-row items-center gap-2">
			<View className="h-4 w-16 rounded-r-lg bg-linear-to-r from-m-02-dark-01 to-m-02-light-02" />
			<Text variant="title-02" className="text-m-01 dark:text-m-01-light-04">
				{title}
			</Text>
		</View>
	);
}

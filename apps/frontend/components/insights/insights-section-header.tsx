import { Text } from "@/components/ui/text";
import { View } from "react-native";

type InsightsSectionHeaderProps = {
	title: string;
};

export function InsightsSectionHeader({ title }: InsightsSectionHeaderProps) {
	return (
		<View className="relative h-40 justify-center">
			<Text variant="title-02" className="text-m-01 dark:text-m-01-light-04">
				{title}
			</Text>
		</View>
	);
}

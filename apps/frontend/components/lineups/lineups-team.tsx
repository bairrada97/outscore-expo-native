import { Text } from "@/components/ui/text";
import { View } from "react-native";

type LineupsTeamHeaderProps = {
	teamName: string;
	formation: string | null;
};

export function LineupsTeamHeader({
	teamName,
	formation,
}: LineupsTeamHeaderProps) {
	return (
		<View className="flex-row items-center justify-between gap-8 py-8">
			<Text
				variant="body-02--semi"
				className="text-neu-10 dark:text-neu-01"
				numberOfLines={1}
			>
				{teamName}
			</Text>
			{formation && (
				<Text variant="body-02--semi" className="text-neu-10 dark:text-neu-01">
					{formation}
				</Text>
			)}
		</View>
	);
}

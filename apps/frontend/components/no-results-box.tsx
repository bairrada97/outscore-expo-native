import { View } from "react-native";
import { Text } from "./ui/text";

export interface NoResultsBoxProps {
	text: string;
}

export function NoResultsBox({ text }: NoResultsBoxProps) {
	return (
		<View className="m-auto flex flex-col gap-y-16 rounded-lg border border-neu-04 px-24 py-16 text-neu-09/70 dark:border-neu-10 dark:text-neu-07">
			<Text variant="body-02" className="m-auto max-w-[640px]">
				{text}
			</Text>
		</View>
	);
}


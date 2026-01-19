import { cn } from "@/lib/utils";
import { View } from "react-native";
import { Text } from "../ui/text";

interface StatusCellProps {
	statusText: string | null;
	matchIsLive: boolean;
	matchIsFinished: boolean;
}

export function StatusCell({
	statusText,
	matchIsLive,
	matchIsFinished,
}: StatusCellProps) {
	return (
		<View className="min-w-40 items-center">
			<Text
				className={cn(
					"text-11 font-sans-regular",
					matchIsLive
						? "text-m-01"
						: matchIsFinished
							? "text-neu-07 dark:text-neu-06"
							: "text-neu-08 dark:text-neu-05",
				)}
			>
				{statusText}
			</Text>
		</View>
	);
}

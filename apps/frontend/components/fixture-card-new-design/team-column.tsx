import { cn } from "@/lib/utils";
import type { FormattedMatch } from "@outscore/shared-types";
import { Image, View } from "react-native";
import { Text } from "../ui/text";

interface TeamColumnProps {
	team: FormattedMatch["teams"]["home"];
	isWinner: boolean;
	isScored: boolean;
}

export function TeamColumn({ team, isWinner, isScored }: TeamColumnProps) {
	return (
		<View className="flex-1 items-center">
			<View
				className={cn(
					"mb-8 h-40 w-40 items-center justify-center rounded-full",
					"bg-neu-02 dark:bg-neu-11",
					isWinner && "ring-2 ring-m-01",
					isScored && "ring-2 ring-m-01-light-02",
				)}
			>
				{team.logo ? (
					<Image
						source={{ uri: team.logo }}
						className="h-32 w-32"
						resizeMode="contain"
					/>
				) : (
					<View className="h-32 w-32 rounded-full bg-neu-04 dark:bg-neu-09" />
				)}
			</View>

			<Text
				className={cn(
					"text-center text-12 text-neu-09 dark:text-neu-05",
					(isWinner || isScored) && "font-sans-semibold text-neu-13 dark:text-neu-01",
				)}
				numberOfLines={1}
			>
				{team.name}
			</Text>
		</View>
	);
}


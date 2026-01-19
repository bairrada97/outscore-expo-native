import { cn } from "@/lib/utils";
import type { FormattedMatch } from "@outscore/shared-types";
import { Image, View } from "react-native";
import { Text } from "../ui/text";
import type { TeamScoredState } from "./types";

interface TeamsColumnProps {
	teams: FormattedMatch["teams"];
	homeIsWinner: boolean;
	awayIsWinner: boolean;
	teamScored: TeamScoredState;
}

export function TeamsColumn({
	teams,
	homeIsWinner,
	awayIsWinner,
	teamScored,
}: TeamsColumnProps) {
	return (
		<View className="flex-1 justify-center gap-y-2">
			{/* Home */}
			<View className="flex-row items-center gap-x-6">
				<View className="h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-neu-03 dark:bg-neu-10">
					{teams.home.logo ? (
						<Image
							source={{ uri: teams.home.logo }}
							className="h-12 w-12"
							resizeMode="contain"
						/>
					) : (
						<View className="h-10 w-10 rounded-full bg-neu-05" />
					)}
				</View>
				<Text
					className={cn(
						"flex-1 text-13",
						homeIsWinner || teamScored.home
							? "font-sans-semibold text-neu-13 dark:text-neu-01"
							: "text-neu-10 dark:text-neu-05",
					)}
					numberOfLines={1}
				>
					{teams.home.name}
				</Text>
			</View>

			{/* Away */}
			<View className="flex-row items-center gap-x-6">
				<View className="h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-neu-03 dark:bg-neu-10">
					{teams.away.logo ? (
						<Image
							source={{ uri: teams.away.logo }}
							className="h-12 w-12"
							resizeMode="contain"
						/>
					) : (
						<View className="h-10 w-10 rounded-full bg-neu-05" />
					)}
				</View>
				<Text
					className={cn(
						"flex-1 text-13",
						awayIsWinner || teamScored.away
							? "font-sans-semibold text-neu-13 dark:text-neu-01"
							: "text-neu-10 dark:text-neu-05",
					)}
					numberOfLines={1}
				>
					{teams.away.name}
				</Text>
			</View>
		</View>
	);
}

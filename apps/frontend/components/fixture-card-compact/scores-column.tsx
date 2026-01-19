import { cn } from "@/lib/utils";
import { View } from "react-native";
import { Text } from "../ui/text";
import type { TeamScoredState } from "./types";

interface ScoresColumnProps {
	homeTeamGoals: number;
	awayTeamGoals: number;
	matchHasNotStarted: boolean;
	homeIsWinner: boolean;
	awayIsWinner: boolean;
	teamScored: TeamScoredState;
}

export function ScoresColumn({
	homeTeamGoals,
	awayTeamGoals,
	matchHasNotStarted,
	homeIsWinner,
	awayIsWinner,
	teamScored,
}: ScoresColumnProps) {
	return (
		<View className="ml-8 w-20 items-end justify-center gap-y-2">
			<Text
				className={cn(
					"font-mono text-13",
					homeIsWinner || teamScored.home
						? "font-sans-bold text-m-01"
						: "text-neu-10 dark:text-neu-05",
				)}
			>
				{matchHasNotStarted ? "" : homeTeamGoals}
			</Text>
			<Text
				className={cn(
					"font-mono text-13",
					awayIsWinner || teamScored.away
						? "font-sans-bold text-m-01"
						: "text-neu-10 dark:text-neu-05",
				)}
			>
				{matchHasNotStarted ? "" : awayTeamGoals}
			</Text>
		</View>
	);
}

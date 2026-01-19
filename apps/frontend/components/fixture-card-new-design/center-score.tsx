import { cn } from "@/lib/utils";
import { Animated, View } from "react-native";
import { Text } from "../ui/text";

interface CenterScoreProps {
	statusText: string | null;
	matchIsLive: boolean;
	matchIsFinished: boolean;
	matchHasNotStarted: boolean;
	pulseAnim: Animated.Value;
	homeTeamGoals: number;
	awayTeamGoals: number;
	homeIsWinner: boolean;
	awayIsWinner: boolean;
	homeJustScored: boolean;
	awayJustScored: boolean;
}

export function CenterScore({
	statusText,
	matchIsLive,
	matchIsFinished,
	matchHasNotStarted,
	pulseAnim,
	homeTeamGoals,
	awayTeamGoals,
	homeIsWinner,
	awayIsWinner,
	homeJustScored,
	awayJustScored,
}: CenterScoreProps) {
	return (
		<View className="mx-8 items-center">
			<View
				className={cn(
					"mb-4 rounded-8 px-8 py-2",
					matchIsLive && "bg-m-01/10 dark:bg-m-01/20",
					matchIsFinished && "bg-neu-04/50 dark:bg-neu-10/50",
					!matchIsLive && !matchIsFinished && "bg-neu-03 dark:bg-neu-10",
				)}
			>
				{matchIsLive ? (
					<View className="flex-row items-center gap-x-4">
						<Animated.View
							style={{ opacity: pulseAnim }}
							className="h-6 w-6 rounded-full bg-m-01"
						/>
						<Text className="text-10 font-sans-semibold uppercase text-m-01">
							{statusText}
						</Text>
					</View>
				) : (
					<Text
						className={cn(
							"text-10 font-sans-regular uppercase",
							matchIsFinished
								? "text-neu-07 dark:text-neu-06"
								: "text-neu-08 dark:text-neu-05",
						)}
					>
						{statusText}
					</Text>
				)}
			</View>

			<View className="flex-row items-center gap-x-8">
				<View
					className={cn(
						"min-w-32 items-center rounded-8 px-8 py-4",
						homeJustScored && "bg-m-01/10",
					)}
				>
					<Text
						className={cn(
							"font-mono text-24 font-sans-bold text-neu-10 dark:text-neu-03",
							(homeIsWinner || homeJustScored) &&
								"text-m-01 dark:text-m-01-light-02",
						)}
					>
						{matchHasNotStarted ? "" : homeTeamGoals}
					</Text>
				</View>

				<Text className="text-14 text-neu-06 dark:text-neu-07">
					{matchHasNotStarted ? "" : "-"}
				</Text>

				<View
					className={cn(
						"min-w-32 items-center rounded-8 px-8 py-4",
						awayJustScored && "bg-m-01/10",
					)}
				>
					<Text
						className={cn(
							"font-mono text-24 font-sans-bold text-neu-10 dark:text-neu-03",
							(awayIsWinner || awayJustScored) &&
								"text-m-01 dark:text-m-01-light-02",
						)}
					>
						{matchHasNotStarted ? "" : awayTeamGoals}
					</Text>
				</View>
			</View>
		</View>
	);
}


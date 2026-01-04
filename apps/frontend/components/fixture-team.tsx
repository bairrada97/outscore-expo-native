import { cn } from "@/lib/utils";
import { tva } from "@gluestack-ui/nativewind-utils/tva";
import { View } from "react-native";
import { Text } from "./ui/text";

const fixtureTeam = tva({
	base: "flex flex-row gap-y-0 gap-x-8",
	variants: {
		bold: {
			true: ["font-sans-bold", "dark:text-neu-01"],
		},
	},
});

export interface FixtureTeamProps {
	isInFavorites?: boolean;
	isGoal: boolean;
	score: number;
	name: string;
	winner: boolean;
}

export function FixtureTeam({
	isInFavorites,
	isGoal,
	score,
	name,
	winner,
}: FixtureTeamProps) {
	return (
		<View className={fixtureTeam({ bold: winner || isGoal })}>
			<Text
				className={cn("min-w-[16px]", fixtureTeam({ bold: winner || isGoal }))}
			>
				{score}
			</Text>
			<Text
				className={cn(
					"block overflow-hidden overflow-ellipsis whitespace-nowrap",
					fixtureTeam({ bold: winner || isGoal }),
				)}
			>
				{name}
			</Text>
			{isInFavorites ? (
				<View className="text-red">
					{/* <SvgB019 width={8} height={8} has-gradient={true} /> */}
				</View>
			) : null}
		</View>
	);
}

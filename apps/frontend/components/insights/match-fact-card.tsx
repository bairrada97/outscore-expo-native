import { Text } from "@/components/ui/text";
import { View } from "react-native";

export type MatchFact = {
	id: string;
	title: string;
	value: string;
	subtitle?: string;
	side?: "HOME" | "AWAY" | "BOTH";
	icon?: string;
};

type MatchFactCardProps = {
	fact: MatchFact;
};

export function MatchFactCard({ fact }: MatchFactCardProps) {
	const isAvgPair =
		fact.id === "avg_goals_scored_season_each" ||
		fact.id === "avg_goals_conceded_season_each";
	const pair = isAvgPair ? fact.value.split("|").map((s) => s.trim()) : [];
	const left = pair[0];
	const right = pair[1];

	return (
		<View className="h-64 bg-neu-01 dark:bg-neu-11 shadow-sha-01 dark:shadow-sha-06 rounded-lg px-16 py-8 justify-center">
			{isAvgPair && left && right ? (
				<View className="flex-row items-baseline gap-8">
					<Text variant="highlight-02" className="text-neu-10 dark:text-neu-01">
						{left}{" "}
						<Text
							variant="highlight-04"
							className="text-neu-06 dark:text-neu-07"
						>
							–{/* en dash */}
						</Text>{" "}
						{right}
					</Text>
					<Text
						variant="caption-03"
						className="uppercase text-neu-07 dark:text-neu-06"
					>
						Home/Away
					</Text>
				</View>
			) : (
				<View className="flex-row items-center gap-2">
					{fact.icon ? (
						<Text
							variant="highlight-02"
							className="text-neu-07 dark:text-neu-06"
						>
							{fact.icon}
						</Text>
					) : null}
					<Text variant="highlight-02" className="text-neu-10 dark:text-neu-01">
						{fact.value}
					</Text>
				</View>
			)}

			<View className="flex-row items-center flex-wrap">
				<Text
					variant="caption-03"
					className="uppercase text-neu-10 dark:text-neu-01"
				>
					{fact.title}
				</Text>
				{fact.subtitle ? (
					<>
						<Text
							variant="caption-03"
							className="uppercase text-neu-07 dark:text-neu-06"
						>
							{" "}
							·{" "}
						</Text>
						<Text
							variant="caption-03"
							className="uppercase text-neu-07 dark:text-neu-06"
						>
							{fact.subtitle}
						</Text>
					</>
				) : null}
			</View>
		</View>
	);
}

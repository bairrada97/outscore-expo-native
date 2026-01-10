import { Text } from "@/components/ui/text";
import type { FixtureEvent } from "@outscore/shared-types";
import { View } from "react-native";

interface GoalScorersProps {
	events: FixtureEvent[];
	homeTeamId: number;
	awayTeamId: number;
}

interface GoalInfo {
	playerName: string;
	minute: number;
	isOwnGoal: boolean;
	isPenalty: boolean;
}

function formatGoal(goal: GoalInfo): string {
	let text = `${goal.playerName} ${goal.minute}'`;
	if (goal.isOwnGoal) {
		text += " (OG)";
	} else if (goal.isPenalty) {
		text += " (P)";
	}
	return text;
}

export function GoalScorers({
	events,
	homeTeamId,
	awayTeamId,
}: GoalScorersProps) {
	// Filter only goal events
	const goalEvents = events.filter((event) => event.type === "Goal");

	if (goalEvents.length === 0) {
		return null;
	}

	// Separate goals by team
	// Note: Own goals count for the opposing team
	const homeGoals: GoalInfo[] = [];
	const awayGoals: GoalInfo[] = [];

	goalEvents.forEach((event) => {
		const isOwnGoal = event.detail === "Own Goal";
		const isPenalty =
			event.detail === "Penalty" || event.detail === "Penalty Goal";
		const goalInfo: GoalInfo = {
			playerName: event.player.name || "Unknown",
			minute: event.time.elapsed,
			isOwnGoal,
			isPenalty,
		};

		// Own goals: scored by one team but counts for the other
		if (isOwnGoal) {
			if (event.team.id === homeTeamId) {
				awayGoals.push(goalInfo);
			} else {
				homeGoals.push(goalInfo);
			}
		} else {
			if (event.team.id === homeTeamId) {
				homeGoals.push(goalInfo);
			} else {
				awayGoals.push(goalInfo);
			}
		}
	});

	// Sort goals by minute
	homeGoals.sort((a, b) => a.minute - b.minute);
	awayGoals.sort((a, b) => a.minute - b.minute);

	return (
		<View className="w-full flex-row items-start justify-center gap-4 px-8 mt-4">
			{/* Home goals */}
			<View className="flex-1 items-end">
				{homeGoals.map((goal, index) => (
					<Text
						key={`home-${index}`}
						variant="caption-02"
						className="text-neu-01/80"
					>
						{formatGoal(goal)}
					</Text>
				))}
			</View>

			{/* Goal icon in center */}
			<View className="items-center justify-center">
				{/* <Icon icon={Goal} size={16} className="text-m-01-light-03" /> */}
			</View>

			{/* Away goals */}
			<View className="flex-1 items-start">
				{awayGoals.map((goal, index) => (
					<Text
						key={`away-${index}`}
						variant="caption-02"
						className="text-neu-01/80"
					>
						{formatGoal(goal)}
					</Text>
				))}
			</View>
		</View>
	);
}

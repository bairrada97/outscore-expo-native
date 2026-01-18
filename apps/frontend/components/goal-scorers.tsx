import { EventGoal } from "@/components/ui/SvgIcons";
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

type GroupedGoal = {
	playerName: string;
	minutes: number[];
	suffix: "OG" | "P" | null;
};

function goalSuffix(goal: GoalInfo): GroupedGoal["suffix"] {
	if (goal.isOwnGoal) return "OG";
	if (goal.isPenalty) return "P";
	return null;
}

function formatGroupedGoal(goal: GroupedGoal): string {
	const minutesText = goal.minutes.map((m) => `${m}'`).join(", ");
	return `${goal.playerName} ${minutesText}${
		goal.suffix ? ` (${goal.suffix})` : ""
	}`;
}

export function GoalScorers({
	events,
	homeTeamId,
	awayTeamId: _awayTeamId,
}: GoalScorersProps) {
	const goalEvents = events.filter(
		(event) => event.type === "Goal" && event.detail !== "Missed Penalty",
	);

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

	homeGoals.sort((a, b) => a.minute - b.minute);
	awayGoals.sort((a, b) => a.minute - b.minute);

	function groupGoals(goals: GoalInfo[]): GroupedGoal[] {
		const map = new Map<string, GroupedGoal>();
		for (const g of goals) {
			const suffix = goalSuffix(g);
			const key = `${g.playerName}__${suffix ?? "NONE"}`;
			const existing = map.get(key);
			if (existing) {
				existing.minutes.push(g.minute);
			} else {
				map.set(key, { playerName: g.playerName, minutes: [g.minute], suffix });
			}
		}
		const grouped = Array.from(map.values());
		grouped.forEach((g) => {
			g.minutes.sort((a, b) => a - b);
		});
		// Keep stable order by earliest minute per player group
		grouped.sort((a, b) => (a.minutes[0] ?? 0) - (b.minutes[0] ?? 0));
		return grouped;
	}

	const homeGrouped = groupGoals(homeGoals);
	const awayGrouped = groupGoals(awayGoals);

	return (
		<View className="w-full flex-row items-start justify-center gap-6 px-16 mt-6">
			{/* Home goals */}
			<View className="flex-1 items-end">
				{homeGrouped.map((goal, index) => (
					<Text
						key={`home-${goal.playerName}-${goal.suffix ?? "NONE"}-${goal.minutes.join("-")}`}
						variant="caption-03"
						className="text-neu-01/80"
					>
						{formatGroupedGoal(goal)}
						{index < homeGrouped.length - 1 ? "," : ""}
					</Text>
				))}
			</View>

			{/* Goal icon in center */}
			<View className="items-start justify-center">
				<EventGoal width={16} height={16} color="#BFF37C" />
			</View>

			{/* Away goals */}
			<View className="flex-1 items-start">
				{awayGrouped.map((goal, index) => (
					<Text
						key={`away-${goal.playerName}-${goal.suffix ?? "NONE"}-${goal.minutes.join("-")}`}
						variant="caption-03"
						className="text-neu-01/80"
					>
						{formatGroupedGoal(goal)}
						{index < awayGrouped.length - 1 ? "," : ""}
					</Text>
				))}
			</View>
		</View>
	);
}

import type { Fixture } from "@outscore/shared-types";
import { View } from "react-native";

import { FixtureProgressBar } from "@/components/fixture-progress-bar";
import { GoalScorers } from "@/components/goal-scorers";
import { ScoreDisplay } from "@/components/score-display";
import { TeamBadge } from "@/components/team-badge";

interface FixtureInfoHeaderProps {
	fixture: Fixture;
}

export function FixtureInfoHeader({ fixture }: FixtureInfoHeaderProps) {
	const { teams, goals, events } = fixture;
	const { status, elapsed } = fixture.fixture.status;

	return (
		<View className="bg-linear-to-t from-m-01 to-m-01-light-01 p-4">
			{/* Teams and Score row */}
			<View className="flex-row items-start justify-between">
				{/* Home team */}
				<View className="flex-1 items-center">
					<TeamBadge team={teams.home} />
				</View>

				{/* Score */}
				<View className="flex-1 items-center justify-center pt-2">
					<ScoreDisplay
						homeScore={goals.home}
						awayScore={goals.away}
						elapsed={elapsed}
						status={status}
						date={fixture.fixture.date}
					/>
				</View>

				{/* Away team */}
				<View className="flex-1 items-center">
					<TeamBadge team={teams.away} />
				</View>
			</View>

			{/* Progress bar */}
			<View className="mt-6 px-4">
				<FixtureProgressBar elapsed={elapsed} status={status} />
			</View>

			{/* Goal scorers */}
			{events && events.length > 0 && (
				<GoalScorers
					events={events}
					homeTeamId={teams.home.id}
					awayTeamId={teams.away.id}
				/>
			)}
		</View>
	);
}

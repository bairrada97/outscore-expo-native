import type { Fixture } from "@outscore/shared-types";
import { View } from "react-native";

import { FixtureProgressBar } from "@/components/fixture-progress-bar";
import { GoalScorers } from "@/components/goal-scorers";
import { ScoreDisplay } from "@/components/score-display";
import { TeamBadge } from "@/components/team-badge";
import { FIXTURE_HIDE_SCORE_STATUS } from "@/utils/fixtures-status-constants";

interface FixtureInfoHeaderProps {
	fixture: Fixture;
}

export function FixtureInfoHeader({ fixture }: FixtureInfoHeaderProps) {
	const { teams, goals, events } = fixture;
	const { short: status, elapsed } = fixture.fixture.status;
	const hideScore = FIXTURE_HIDE_SCORE_STATUS.includes(status);

	return (
		<View className="w-full overflow-hidden bg-linear-to-t from-m-01 to-m-01-light-01 px-16 pt-16 pb-16">
			<View className="flex-row items-start">
				<View className="flex-1 items-center">
					<TeamBadge team={teams.home} />
				</View>
				<View
					className={
						hideScore
							? "flex-1 items-center justify-center h-full"
							: "flex-1 items-center self-start mb-4"
					}
				>
					<ScoreDisplay
						homeScore={goals.home}
						awayScore={goals.away}
						elapsed={elapsed}
						status={status}
						date={fixture.fixture.date}
					/>
				</View>

				<View className="flex-1 items-center">
					<TeamBadge team={teams.away} />
				</View>
			</View>

			<View className="mt-16">
				<FixtureProgressBar elapsed={elapsed} status={status} />
			</View>

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

import { useGoalDetection } from "@/hooks/useGoalDetection";
import {
	FIXTURE_BREAK_TIME,
	FIXTURE_HALF_TIME,
	FIXTURE_INTERRUPTED,
	FIXTURE_PENALTY,
} from "@/utils/fixtures-status-constants";
import type { FormattedMatch } from "@outscore/shared-types";
import {
	isFinishedStatus,
	isLiveStatus,
	isNotStartedStatus,
} from "@outscore/shared-types";
import { Pressable, View } from "react-native";
import { FixtureStatus } from "./fixture-status";
import { FixtureTeam } from "./fixture-team";

// Extended match with optional type for H2H/favorites
type ExtendedFormattedMatch = FormattedMatch & {
	type?: "H2H" | "favorite-team" | null;
};

interface FixtureCardProps {
	fixture: ExtendedFormattedMatch;
	isLastMatch?: boolean;
	onPress?: () => void;
}

// Compute status text directly without hooks
function getStatusText(fixture: ExtendedFormattedMatch): string {
	const { status, time } = fixture;
	const statusShort = status?.short;

	if (!statusShort) return "";

	// Live match
	if (isLiveStatus(statusShort)) {
		if (statusShort === FIXTURE_HALF_TIME) return FIXTURE_HALF_TIME;
		if (
			statusShort === FIXTURE_PENALTY ||
			statusShort === FIXTURE_BREAK_TIME ||
			statusShort === FIXTURE_INTERRUPTED
		) {
			return statusShort;
		}
		if (status?.elapsed != null) return `${status.elapsed}'`;
		return "LIVE";
	}

	// Use pre-formatted time from backend for not started matches
	if (statusShort === "NS" && time) {
		return time;
	}

	// Finished or other status
	return statusShort;
}

export function FixtureCard({
	fixture,
	isLastMatch = false,
	onPress,
}: FixtureCardProps) {
	const { status, teams, score, goals, type = null } = fixture;

	const statusShort = status?.short;
	const matchIsLive = statusShort ? isLiveStatus(statusShort) : false;
	const matchIsFinished = statusShort ? isFinishedStatus(statusShort) : false;
	const matchHasNotStarted = statusShort
		? isNotStartedStatus(statusShort)
		: false;
	const notH2H = type !== "H2H";

	// Compute status text directly
	const statusText = getStatusText(fixture);

	// Safely get the home and away goals with proper null checks
	const homeTeamGoals =
		score?.fulltime?.home ?? score?.penalty?.home ?? goals?.home ?? 0;
	const awayTeamGoals =
		score?.fulltime?.away ?? score?.penalty?.away ?? goals?.away ?? 0;

	// Only use goal detection for live matches (avoids hooks for 95%+ of cards)
	const teamScored = useGoalDetection(
		matchIsLive ? homeTeamGoals : null,
		matchIsLive ? awayTeamGoals : null,
	);

	return (
		<Pressable onPress={onPress} className="relative h-64 px-16">
			<View className="relative flex h-full flex-row items-center gap-x-[14px]">
				{/* Live indicator bar */}
				{matchIsLive && (
					<View className="absolute left-[-10px] h-48 w-[2px] rounded-[4px] bg-m-01-light-03" />
				)}

				{/* Goal highlight overlay */}
				{(teamScored.home || teamScored.away) && (
					<View className="absolute inset-1 rounded-[4px] bg-m-01-light-02 opacity-10 dark:bg-m-01-light-04" />
				)}

				{/* Status */}
				<FixtureStatus
					status={statusText}
					matchIsLiveOrFinished={matchIsLive || (matchIsFinished && notH2H)}
				/>

				{/* Teams container */}
				<View className="flex flex-1 flex-col justify-center gap-y-1">
					<FixtureTeam
						isGoal={teamScored.home}
						score={matchHasNotStarted ? undefined : homeTeamGoals}
						name={teams.home.name}
						winner={matchIsFinished && teams.home.winner === true}
					/>
					<FixtureTeam
						isGoal={teamScored.away}
						score={matchHasNotStarted ? undefined : awayTeamGoals}
						name={teams.away.name}
						winner={matchIsFinished && teams.away.winner === true}
					/>
				</View>

				{/* Icons placeholder - Star + More */}
				<View className="ml-8 flex-row items-center gap-x-8">
					{/* Favorite star icon will go here */}
					<View className="h-24 w-24" />
					{/* More options icon will go here */}
					<View className="h-24 w-24" />
				</View>
			</View>

			{!isLastMatch && (
				<View className="absolute bottom-0 left-8 right-8 h-px bg-neu-04 dark:bg-neu-10" />
			)}
		</Pressable>
	);
}

import { useGoalDetection } from "@/hooks/useGoalDetection";
import { formatH2HDate, getMatchOutcome } from "@/utils/fixture-to-match";
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
import { Text } from "./ui/text";
import { MatchOutcomeBadge } from "./match-outcome-badge/match-outcome-badge";

// Extended match with optional type for H2H/favorites
type ExtendedFormattedMatch = FormattedMatch & {
	type?: "H2H" | "favorite-team" | null;
};

interface FixtureCardProps {
	fixture: ExtendedFormattedMatch;
	isLastMatch?: boolean;
	onPress?: () => void;
	onPressIn?: () => void;
	/** Team ID to show W/D/L outcome badge for (used in H2H view) */
	perspectiveTeamId?: number;
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

/** H2H date display component */
function H2HDateDisplay({ dateStr }: { dateStr: string }) {
	const { day, year } = formatH2HDate(dateStr);

	return (
		<View className="min-w-40 items-start">
			<Text variant="body-02--semi" className="text-neu-10 dark:text-neu-04">
				{day}
			</Text>
			{year && (
				<Text variant="body-02--semi" className="text-neu-07 dark:text-neu-06">{year}</Text>
			)}
		</View>
	);
}

export function FixtureCard({
	fixture,
	isLastMatch = false,
	onPress,
	onPressIn,
	perspectiveTeamId,
}: FixtureCardProps) {
	const { status, teams, score, goals, type = null, date } = fixture;

	const statusShort = status?.short;
	const matchIsLive = statusShort ? isLiveStatus(statusShort) : false;
	const matchIsFinished = statusShort ? isFinishedStatus(statusShort) : false;
	const matchHasNotStarted = statusShort
		? isNotStartedStatus(statusShort)
		: false;
	const isH2H = type === "H2H";
	const notH2H = !isH2H;

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

	// Get match outcome for H2H badge
	const matchOutcome =
		perspectiveTeamId && matchIsFinished
			? getMatchOutcome(fixture, perspectiveTeamId)
			: null;

	// Show H2H date for finished H2H matches
	const showH2HDate = isH2H && matchIsFinished;

	return (
		<Pressable
			onPress={onPress}
			onPressIn={onPressIn}
			className="relative h-64 px-16"
		>
			<View className="relative flex h-full flex-row items-center gap-x-[14px]">
				{/* Live indicator bar */}
				{matchIsLive && (
					<View className="absolute left-[-10px] h-48 w-[2px] rounded-[4px] bg-m-01-light-03" />
				)}

				{/* Goal highlight overlay */}
				{(teamScored.home || teamScored.away) && (
					<View className="absolute inset-1 rounded-[4px] bg-m-01-light-02 opacity-10 dark:bg-m-01-light-04" />
				)}

				{/* Status or H2H Date */}
				{showH2HDate ? (
					<H2HDateDisplay dateStr={date} />
				) : (
					<FixtureStatus
						status={statusText}
						matchIsLiveOrFinished={matchIsLive || (matchIsFinished && notH2H)}
					/>
				)}

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

				{/* W/D/L Badge or Icons placeholder */}
				{matchOutcome ? (
					<View className="ml-8">
						<MatchOutcomeBadge outcome={matchOutcome} />
					</View>
				) : (
					<View className="ml-8 flex-row items-center gap-x-8">
						{/* Favorite star icon will go here */}
						<View className="h-24 w-24" />
						{/* More options icon will go here */}
						<View className="h-24 w-24" />
					</View>
				)}
			</View>

			{!isLastMatch && (
				<View className="absolute bottom-0 left-8 right-8 h-px bg-neu-04 dark:bg-neu-10" />
			)}
		</Pressable>
	);
}

import { useFixtureStatus } from "@/hooks/useFixtureStatus";
import usePrevious from "@/hooks/usePrevious";
import type { FormattedMatch } from "@outscore/shared-types";
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { FixtureStatus } from "./fixture-status";
import { FixtureTeam } from "./fixture-team";

// Add additional properties to FormattedMatch for this component
interface ExtendedFormattedMatch extends FormattedMatch {
	type?: "H2H" | "favorite-team" | null;
}

interface FixtureCardProps {
	fixture: ExtendedFormattedMatch;
	timezone: string;
	isLastMatch?: boolean;
	isFromFavorites?: boolean;
	onPress?: () => void;
	onFavoritePress?: () => void;
}

const TIME_TO_RESET_GOAL_STYLES = 60_000; // 1 minute

export function FixtureCard({
	fixture,
	timezone,
	isLastMatch = false,
	onPress,
}: FixtureCardProps) {
	const [teamScored, setTeamScored] = useState<{
		home: boolean;
		away: boolean;
	}>({
		home: false,
		away: false,
	});

	const { status, teams, score, goals, date, type = null } = fixture;

	const { renderFixtureStatus, fixtureStatus } = useFixtureStatus({
		status,
		date,
		timezone,
		type,
	});

	const matchIsLive = fixtureStatus.isLive;
	const matchIsFinished = fixtureStatus.isFinished;
	const notH2H = type !== "H2H";

	// Safely get the home and away goals with proper null checks
	const homeTeamGoals =
		score?.fulltime?.home ?? score?.penalty?.home ?? goals?.home ?? 0;
	const awayTeamGoals =
		score?.fulltime?.away ?? score?.penalty?.away ?? goals?.away ?? 0;

	const [statusState, setStatus] = useState<string | null>(null);
	const previousHomeGoals = usePrevious(homeTeamGoals);
	const previousAwayGoals = usePrevious(awayTeamGoals);

	// Update status when fixture changes
	useEffect(() => {
		setStatus(renderFixtureStatus());
	}, [renderFixtureStatus]);

	// Detect home goal scoring - independent timer
	useEffect(() => {
		if (previousHomeGoals !== undefined && homeTeamGoals > previousHomeGoals) {
			setTeamScored((prev) => ({ ...prev, home: true }));
			const timer = setTimeout(() => {
				setTeamScored((prev) => ({ ...prev, home: false }));
			}, TIME_TO_RESET_GOAL_STYLES);
			return () => clearTimeout(timer);
		}
	}, [homeTeamGoals, previousHomeGoals]);

	// Detect away goal scoring - independent timer
	useEffect(() => {
		if (previousAwayGoals !== undefined && awayTeamGoals > previousAwayGoals) {
			setTeamScored((prev) => ({ ...prev, away: true }));
			const timer = setTimeout(() => {
				setTeamScored((prev) => ({ ...prev, away: false }));
			}, TIME_TO_RESET_GOAL_STYLES);
			return () => clearTimeout(timer);
		}
	}, [awayTeamGoals, previousAwayGoals]);

	return (
		<Pressable onPress={onPress} className="relative h-64 px-16">
			<View className="relative flex h-full flex-row items-center">
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
					status={statusState ?? ""}
					matchIsLiveOrFinished={matchIsLive || (matchIsFinished && notH2H)}
				/>

				{/* Teams container */}
				<View className="flex flex-1 flex-col justify-center gap-y-1">
					<FixtureTeam
						isGoal={teamScored.home}
						score={homeTeamGoals}
						name={teams.home.name}
						winner={matchIsFinished && teams.home.winner === true}
					/>
					<FixtureTeam
						isGoal={teamScored.away}
						score={awayTeamGoals}
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

			{/* Divider - full width minus 8px on each side */}
			{!isLastMatch && (
				<View className="absolute bottom-0 left-8 right-8 h-[1px] bg-neu-04 dark:bg-neu-10" />
			)}
		</Pressable>
	);
}

import { useFixtureStatus } from "@/hooks/useFixtureStatus";
import usePrevious from "@/hooks/usePrevious";
import { useEffect, useState } from "react";
import { Animated, Easing, Pressable, View } from "react-native";
import { ScoresColumn } from "./fixture-card-compact/scores-column";
import { StatusCell } from "./fixture-card-compact/status-cell";
import { TeamsColumn } from "./fixture-card-compact/teams-column";
import type { ExtendedFormattedMatch } from "./fixture-card-compact/types";

interface FixtureCardCompactProps {
	fixture: ExtendedFormattedMatch;
	timezone: string;
	isLastMatch?: boolean;
	onPress?: () => void;
}

const TIME_TO_RESET_GOAL_STYLES = 60_000;

/**
 * Minimal 48px fixture card with team logos
 */
export function FixtureCardCompact({
	fixture,
	timezone,
	isLastMatch = false,
	onPress,
}: FixtureCardCompactProps) {
	const [teamScored, setTeamScored] = useState({
		home: false,
		away: false,
	});

	const [pulseAnim] = useState(() => new Animated.Value(1));

	const { status, teams, score, goals, date, time, type = null } = fixture;

	const { renderFixtureStatus, fixtureStatus } = useFixtureStatus({
		status,
		date,
		time,
		timezone,
		type,
	});

	const matchIsLive = fixtureStatus.isLive;
	const matchIsFinished = fixtureStatus.isFinished;
	const matchHasNotStarted = fixtureStatus.haveNotStarted;

	const homeTeamGoals =
		score?.fulltime?.home ?? score?.penalty?.home ?? goals?.home ?? 0;
	const awayTeamGoals =
		score?.fulltime?.away ?? score?.penalty?.away ?? goals?.away ?? 0;

	const [statusState, setStatus] = useState<string | null>(null);
	const previousHomeGoals = usePrevious(homeTeamGoals);
	const previousAwayGoals = usePrevious(awayTeamGoals);

	const homeIsWinner = matchIsFinished && teams.home.winner === true;
	const awayIsWinner = matchIsFinished && teams.away.winner === true;

	useEffect(() => {
		setStatus(renderFixtureStatus());
	}, [renderFixtureStatus]);

	// Pulse animation for live
	useEffect(() => {
		if (matchIsLive) {
			const pulse = Animated.loop(
				Animated.sequence([
					Animated.timing(pulseAnim, {
						toValue: 0.3,
						duration: 1000,
						easing: Easing.inOut(Easing.ease),
						useNativeDriver: true,
					}),
					Animated.timing(pulseAnim, {
						toValue: 1,
						duration: 1000,
						easing: Easing.inOut(Easing.ease),
						useNativeDriver: true,
					}),
				]),
			);
			pulse.start();
			return () => pulse.stop();
		}
	}, [matchIsLive, pulseAnim]);

	useEffect(() => {
		if (previousHomeGoals !== undefined && homeTeamGoals > previousHomeGoals) {
			setTeamScored((prev) => ({ ...prev, home: true }));
			const timer = setTimeout(() => {
				setTeamScored((prev) => ({ ...prev, home: false }));
			}, TIME_TO_RESET_GOAL_STYLES);
			return () => clearTimeout(timer);
		}
	}, [homeTeamGoals, previousHomeGoals]);

	useEffect(() => {
		if (previousAwayGoals !== undefined && awayTeamGoals > previousAwayGoals) {
			setTeamScored((prev) => ({ ...prev, away: true }));
			const timer = setTimeout(() => {
				setTeamScored((prev) => ({ ...prev, away: false }));
			}, TIME_TO_RESET_GOAL_STYLES);
			return () => clearTimeout(timer);
		}
	}, [awayTeamGoals, previousAwayGoals]);

	const hasGoal = teamScored.home || teamScored.away;

	return (
		<Pressable onPress={onPress} className="relative h-48 px-12">
			{/* Goal highlight */}
			{hasGoal && (
				<View className="absolute inset-1 rounded-4 bg-m-01-light-02/10 dark:bg-m-01-light-03/15" />
			)}

			{/* Live bar */}
			{matchIsLive && (
				<Animated.View
					style={{ opacity: pulseAnim }}
					className="absolute bottom-8 left-0 top-8 w-[2px] rounded-full bg-m-01"
				/>
			)}

			<View className="flex h-full flex-row items-center">
					{/* Status */}
					<StatusCell
						statusText={statusState}
						matchIsLive={matchIsLive}
						matchIsFinished={matchIsFinished}
					/>

					{/* Teams */}
					<TeamsColumn
						teams={teams}
						homeIsWinner={homeIsWinner}
						awayIsWinner={awayIsWinner}
						teamScored={teamScored}
					/>

					{/* Scores */}
					<ScoresColumn
						homeTeamGoals={homeTeamGoals}
						awayTeamGoals={awayTeamGoals}
						matchHasNotStarted={matchHasNotStarted}
						homeIsWinner={homeIsWinner}
						awayIsWinner={awayIsWinner}
						teamScored={teamScored}
					/>
			</View>

			{/* Divider */}
			{!isLastMatch && (
				<View className="absolute bottom-0 left-8 right-8 h-px bg-neu-04 dark:bg-neu-10" />
			)}
		</Pressable>
	);
}

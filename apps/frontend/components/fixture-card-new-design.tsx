import { useFixtureStatus } from "@/hooks/useFixtureStatus";
import usePrevious from "@/hooks/usePrevious";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { Animated, Easing, Pressable, View } from "react-native";
import { CenterScore } from "./fixture-card-new-design/center-score";
import { TeamColumn } from "./fixture-card-new-design/team-column";
import type { ExtendedFormattedMatch } from "./fixture-card-new-design/types";

interface FixtureCardNewDesignProps {
	fixture: ExtendedFormattedMatch;
	timezone: string;
	isLastMatch?: boolean;
	onPress?: () => void;
}

const TIME_TO_RESET_GOAL_STYLES = 60_000; // 1 minute

/**
 * Modern fixture card design with team logos, centered score, and animations
 */
export function FixtureCardNewDesign({
	fixture,
	timezone,
	onPress,
}: FixtureCardNewDesignProps) {
	const [teamScored, setTeamScored] = useState<{
		home: boolean;
		away: boolean;
	}>({
		home: false,
		away: false,
	});

	// Pulse animation for live indicator
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

	// Update status
	useEffect(() => {
		setStatus(renderFixtureStatus());
	}, [renderFixtureStatus]);

	// Pulse animation for live matches
	useEffect(() => {
		if (matchIsLive) {
			const pulse = Animated.loop(
				Animated.sequence([
					Animated.timing(pulseAnim, {
						toValue: 0.4,
						duration: 800,
						easing: Easing.inOut(Easing.ease),
						useNativeDriver: true,
					}),
					Animated.timing(pulseAnim, {
						toValue: 1,
						duration: 800,
						easing: Easing.inOut(Easing.ease),
						useNativeDriver: true,
					}),
				]),
			);
			pulse.start();
			return () => pulse.stop();
		}
	}, [matchIsLive, pulseAnim]);

	// Detect home goal scoring
	useEffect(() => {
		if (previousHomeGoals !== undefined && homeTeamGoals > previousHomeGoals) {
			setTeamScored((prev) => ({ ...prev, home: true }));
			const timer = setTimeout(() => {
				setTeamScored((prev) => ({ ...prev, home: false }));
			}, TIME_TO_RESET_GOAL_STYLES);
			return () => clearTimeout(timer);
		}
	}, [homeTeamGoals, previousHomeGoals]);

	// Detect away goal scoring
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
		<Pressable
			onPress={onPress}
			className={cn(
				"relative mx-8 my-4 overflow-hidden rounded-16",
				"bg-neu-01 dark:bg-neu-12",
				"shadow-sha-01 dark:shadow-sha-06",
			)}
		>
			{/* Goal celebration gradient overlay */}
			{hasGoal && (
				<View className="absolute inset-0 bg-linear-to-r from-m-01-light-02/20 to-m-02-light-02/20 dark:from-m-01-light-03/30 dark:to-m-02-light-03/30" />
			)}

			{/* Live match gradient accent */}
			{matchIsLive && !hasGoal && (
				<View className="absolute left-0 top-0 h-full w-1 bg-linear-to-b from-m-01 to-m-01-light-02" />
			)}

			<View className="flex-row items-center px-16 py-16">
				<TeamColumn
					team={teams.home}
					isWinner={homeIsWinner}
					isScored={teamScored.home}
				/>

				<CenterScore
					statusText={statusState}
					matchIsLive={matchIsLive}
					matchIsFinished={matchIsFinished}
					matchHasNotStarted={matchHasNotStarted}
					pulseAnim={pulseAnim}
					homeTeamGoals={homeTeamGoals}
					awayTeamGoals={awayTeamGoals}
					homeIsWinner={homeIsWinner}
					awayIsWinner={awayIsWinner}
					homeJustScored={teamScored.home}
					awayJustScored={teamScored.away}
				/>

				<TeamColumn
					team={teams.away}
					isWinner={awayIsWinner}
					isScored={teamScored.away}
				/>
			</View>

			{/* Bottom accent line for finished matches */}
			{matchIsFinished && (
				<View className="h-[2px] bg-linear-to-r from-transparent via-neu-04 to-transparent dark:via-neu-10" />
			)}
		</Pressable>
	);
}

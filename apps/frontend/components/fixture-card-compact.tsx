import { useFixtureStatus } from "@/hooks/useFixtureStatus";
import usePrevious from "@/hooks/usePrevious";
import { cn } from "@/lib/utils";
import type { FormattedMatch } from "@outscore/shared-types";
import { useEffect, useState } from "react";
import { Animated, Easing, Image, Pressable, View } from "react-native";
import { Text } from "./ui/text";

interface ExtendedFormattedMatch extends FormattedMatch {
	type?: "H2H" | "favorite-team" | null;
}

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
				<View className="min-w-40 items-center">
					<Text
							className={cn(
								"text-11 font-sans-regular",
							matchIsLive
								? "text-m-01"
								: matchIsFinished
									? "text-neu-07 dark:text-neu-06"
									: "text-neu-08 dark:text-neu-05",
						)}
					>
						{statusState}
					</Text>
				</View>

				{/* Teams */}
				<View className="flex-1 justify-center gap-y-2">
					{/* Home */}
					<View className="flex-row items-center gap-x-6">
						<View className="h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-neu-03 dark:bg-neu-10">
							{teams.home.logo ? (
								<Image
									source={{ uri: teams.home.logo }}
									className="h-12 w-12"
									resizeMode="contain"
								/>
							) : (
								<View className="h-10 w-10 rounded-full bg-neu-05" />
							)}
						</View>
						<Text
							className={cn(
								"flex-1 text-13",
								homeIsWinner || teamScored.home
									? "font-sans-semibold text-neu-13 dark:text-neu-01"
									: "text-neu-10 dark:text-neu-05",
							)}
							numberOfLines={1}
						>
							{teams.home.name}
						</Text>
					</View>

					{/* Away */}
					<View className="flex-row items-center gap-x-6">
						<View className="h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-neu-03 dark:bg-neu-10">
							{teams.away.logo ? (
								<Image
									source={{ uri: teams.away.logo }}
									className="h-12 w-12"
									resizeMode="contain"
								/>
							) : (
								<View className="h-10 w-10 rounded-full bg-neu-05" />
							)}
						</View>
						<Text
							className={cn(
								"flex-1 text-13",
								awayIsWinner || teamScored.away
									? "font-sans-semibold text-neu-13 dark:text-neu-01"
									: "text-neu-10 dark:text-neu-05",
							)}
							numberOfLines={1}
						>
							{teams.away.name}
						</Text>
					</View>
				</View>

				{/* Scores */}
				<View className="ml-8 w-20 items-end justify-center gap-y-2">
					<Text
						className={cn(
							"font-mono text-13",
							homeIsWinner || teamScored.home
								? "font-sans-bold text-m-01"
								: "text-neu-10 dark:text-neu-05",
						)}
					>
						{matchHasNotStarted ? "" : homeTeamGoals}
					</Text>
					<Text
						className={cn(
							"font-mono text-13",
							awayIsWinner || teamScored.away
								? "font-sans-bold text-m-01"
								: "text-neu-10 dark:text-neu-05",
						)}
					>
						{matchHasNotStarted ? "" : awayTeamGoals}
					</Text>
				</View>
			</View>

			{/* Divider */}
			{!isLastMatch && (
				<View className="absolute bottom-0 left-8 right-8 h-px bg-neu-04 dark:bg-neu-10" />
			)}
		</Pressable>
	);
}

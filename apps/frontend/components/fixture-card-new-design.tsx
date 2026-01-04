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
	isLastMatch = false,
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

	const { status, teams, score, goals, date, type = null } = fixture;

	const { renderFixtureStatus, fixtureStatus } = useFixtureStatus({
		status,
		date,
		timezone,
		type,
	});

	const matchIsLive = fixtureStatus.isLive;
	const matchIsFinished = fixtureStatus.isFinished;

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

			<View className="flex-row items-center px-16 py-12">
				{/* Home Team */}
				<View className="flex-1 items-center">
					{/* Team Logo */}
					<View
						className={cn(
							"mb-8 h-40 w-40 items-center justify-center rounded-full",
							"bg-neu-02 dark:bg-neu-11",
							homeIsWinner && "ring-2 ring-m-01",
							teamScored.home && "ring-2 ring-m-01-light-02",
						)}
					>
						{teams.home.logo ? (
							<Image
								source={{ uri: teams.home.logo }}
								className="h-32 w-32"
								resizeMode="contain"
							/>
						) : (
							<View className="h-32 w-32 rounded-full bg-neu-04 dark:bg-neu-09" />
						)}
					</View>

					{/* Team Name */}
					<Text
						className={cn(
							"text-center text-12 text-neu-09 dark:text-neu-05",
							(homeIsWinner || teamScored.home) &&
								"font-semibold text-neu-13 dark:text-neu-01",
						)}
						numberOfLines={1}
					>
						{teams.home.name}
					</Text>
				</View>

				{/* Center Score Section */}
				<View className="mx-8 items-center">
					{/* Status Badge */}
					<View
						className={cn(
							"mb-4 rounded-8 px-8 py-2",
							matchIsLive && "bg-m-01/10 dark:bg-m-01/20",
							matchIsFinished && "bg-neu-04/50 dark:bg-neu-10/50",
							!matchIsLive && !matchIsFinished && "bg-neu-03 dark:bg-neu-10",
						)}
					>
						{matchIsLive && (
							<View className="flex-row items-center gap-x-4">
								<Animated.View
									style={{ opacity: pulseAnim }}
									className="h-6 w-6 rounded-full bg-m-01"
								/>
								<Text className="text-10 font-semibold uppercase text-m-01">
									{statusState}
								</Text>
							</View>
						)}
						{!matchIsLive && (
							<Text
								className={cn(
									"text-10 font-medium uppercase",
									matchIsFinished
										? "text-neu-07 dark:text-neu-06"
										: "text-neu-08 dark:text-neu-05",
								)}
							>
								{statusState}
							</Text>
						)}
					</View>

					{/* Score Display */}
					<View className="flex-row items-center gap-x-8">
						<View
							className={cn(
								"min-w-32 items-center rounded-8 px-8 py-4",
								teamScored.home && "bg-m-01/10",
							)}
						>
							<Text
								className={cn(
									"font-mono text-24 font-bold text-neu-10 dark:text-neu-03",
									homeIsWinner && "text-m-01 dark:text-m-01-light-02",
									teamScored.home && "text-m-01 dark:text-m-01-light-02",
								)}
							>
								{homeTeamGoals}
							</Text>
						</View>

						<Text className="text-14 text-neu-06 dark:text-neu-07">-</Text>

						<View
							className={cn(
								"min-w-32 items-center rounded-8 px-8 py-4",
								teamScored.away && "bg-m-01/10",
							)}
						>
							<Text
								className={cn(
									"font-mono text-24 font-bold text-neu-10 dark:text-neu-03",
									awayIsWinner && "text-m-01 dark:text-m-01-light-02",
									teamScored.away && "text-m-01 dark:text-m-01-light-02",
								)}
							>
								{awayTeamGoals}
							</Text>
						</View>
					</View>
				</View>

				{/* Away Team */}
				<View className="flex-1 items-center">
					{/* Team Logo */}
					<View
						className={cn(
							"mb-8 h-40 w-40 items-center justify-center rounded-full",
							"bg-neu-02 dark:bg-neu-11",
							awayIsWinner && "ring-2 ring-m-01",
							teamScored.away && "ring-2 ring-m-01-light-02",
						)}
					>
						{teams.away.logo ? (
							<Image
								source={{ uri: teams.away.logo }}
								className="h-32 w-32"
								resizeMode="contain"
							/>
						) : (
							<View className="h-32 w-32 rounded-full bg-neu-04 dark:bg-neu-09" />
						)}
					</View>

					{/* Team Name */}
					<Text
						className={cn(
							"text-center text-12 text-neu-09 dark:text-neu-05",
							(awayIsWinner || teamScored.away) &&
								"font-semibold text-neu-13 dark:text-neu-01",
						)}
						numberOfLines={1}
					>
						{teams.away.name}
					</Text>
				</View>
			</View>

			{/* Bottom accent line for finished matches */}
			{matchIsFinished && (
				<View className="h-[2px] bg-linear-to-r from-transparent via-neu-04 to-transparent dark:via-neu-10" />
			)}
		</Pressable>
	);
}

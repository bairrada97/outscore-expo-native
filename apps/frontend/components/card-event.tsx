import {
	EventCardRed,
	EventCardSecondYellow,
	EventCardYellow,
	EventGoal,
	EventOwngoal,
	EventPenaltyGoal,
	EventPenaltyMissed,
	EventSub,
} from "@/components/ui/SvgIcons";
import { Text } from "@/components/ui/text";
import type { FixtureEvent } from "@outscore/shared-types";
import { View } from "react-native";

export type EventSide = "home" | "away";

export type RunningScore = {
	home: number;
	away: number;
	whoScored: EventSide;
};

type EventIcon = {
	Icon:
		| typeof EventGoal
		| typeof EventOwngoal
		| typeof EventPenaltyGoal
		| typeof EventPenaltyMissed
		| typeof EventCardYellow
		| typeof EventCardSecondYellow
		| typeof EventCardRed
		| typeof EventSub
		| null;
	color: string;
};

function getEventIcon(event: FixtureEvent): EventIcon {
	// Goal-like
	if (event.type === "Goal") {
		if (event.detail === "Own Goal")
			return { Icon: EventOwngoal, color: "rgb(212 66 66)" };
		if (event.detail === "Missed Penalty")
			return { Icon: EventPenaltyMissed, color: "rgb(212 66 66)" };
		if (event.detail === "Penalty" || event.detail === "Penalty Goal")
			return { Icon: EventPenaltyGoal, color: "rgb(52 183 120)" };
		return { Icon: EventGoal, color: "rgb(52 183 120)" };
	}

	// Cards
	if (event.type === "Card") {
		if (event.detail === "Yellow Card")
			return { Icon: EventCardYellow, color: "rgb(255 209 46)" };
		if (event.detail === "Second Yellow Card")
			return { Icon: EventCardSecondYellow, color: "rgb(255 209 46)" };
		if (event.detail === "Red Card")
			return { Icon: EventCardRed, color: "rgb(212 66 66)" };
	}

	// Subs
	if (event.type === "subst") {
		return { Icon: EventSub, color: "rgb(52 183 120)" };
	}

	// VAR: no icon for now (text-only)
	return { Icon: null, color: "rgb(139 149 145)" };
}

function formatDetailLine(event: FixtureEvent): string | null {
	// Substitutions: show the player leaving
	if (event.type === "subst") {
		return event.player?.name ? `${event.player.name}` : null;
	}

	// Goals: show special detail lines
	if (event.type === "Goal") {
		if (event.detail === "Own Goal") return "Own Goal";
		if (event.detail === "Missed Penalty") return "Penalty Missed";
		if (event.detail === "Penalty" || event.detail === "Penalty Goal")
			return "Penalty";
		return event.assist?.name ? `Assist: ${event.assist.name}` : null;
	}

	// Cards: no secondary line by default
	if (event.type === "Card") return null;

	// VAR
	if (event.type === "Var") return event.detail || event.comments;

	return event.comments;
}

function ScorePill({ score }: { score: RunningScore }) {
	const isHome = score.whoScored === "home";
	const homeScoreClass = isHome ? "text-neu-01" : "text-neu-01/60";
	const awayScoreClass = isHome ? "text-neu-01/60" : "text-neu-01";

	return (
		<View
			className={
				isHome
					? "px-8 h-[22px] rounded-[4px] bg-linear-to-r from-m-01-light-01 to-m-02-dark-01"
					: "px-8 h-[22px] rounded-[4px] bg-neu-10"
			}
		>
			<View className="flex-row items-center gap-x-4">
				<Text variant="body-02--semi" className={homeScoreClass}>
					{score.home}
				</Text>
				<Text variant="body-02--semi" className="text-neu-01/60">
					-
				</Text>
				<Text variant="body-02--semi" className={awayScoreClass}>
					{score.away}
				</Text>
			</View>
		</View>
	);
}

export function CardEvent({
	event,
	side,
	minuteLabel,
	extraLabel,
	runningScore,
}: {
	event: FixtureEvent;
	side: EventSide;
	minuteLabel: string;
	extraLabel?: string | null;
	runningScore?: RunningScore;
}) {
	const { Icon, color } = getEventIcon(event);
	const detailLine = formatDetailLine(event);
	const playerName =
		event.type === "subst"
			? (event.assist?.name ?? event.player?.name ?? "")
			: (event.player?.name ?? "");

	// Shared minute block (minute + optional +extra)
	const MinuteBlock = (
		<View className="min-w-[22px] items-center justify-center">
			<Text variant="body-01--semi" className="text-neu-09/70 dark:text-neu-06">
				{minuteLabel}
			</Text>
			{extraLabel ? (
				<Text variant="caption-03" className="text-neu-09/70 dark:text-neu-06">
					{extraLabel}
				</Text>
			) : null}
		</View>
	);

	const IconBlock = Icon ? (
		<View className="h-24 w-24 items-center justify-center">
			<Icon width={24} height={24} color={color} />
		</View>
	) : (
		<View className="h-24 w-24" />
	);

	const textAlignClass = side === "away" ? "text-right" : "text-left";
	const TextBlock = (
		<View className="flex-col">
			<Text
				variant="body-01--semi"
				className={`text-neu-10 dark:text-neu-01 ${textAlignClass}`}
				numberOfLines={1}
			>
				{playerName}
			</Text>
			{detailLine ? (
				<Text
					variant="caption-02"
					className={`text-neu-09/70 dark:text-neu-06 ${textAlignClass}`}
					numberOfLines={1}
				>
					{detailLine}
				</Text>
			) : null}
		</View>
	);

	return (
		<View className="h-56 px-16 flex-row items-center border-b border-neu-04 dark:border-neu-12">
			{side === "home" ? (
				<>
					<View className="flex-row items-center gap-x-8">
						{MinuteBlock}
						{IconBlock}
						{runningScore ? <ScorePill score={runningScore} /> : null}
					</View>
					<View className="ml-16">{TextBlock}</View>
					<View className="flex-1" />
				</>
			) : (
				<>
					<View className="flex-1" />
					<View className="mr-16 items-end">{TextBlock}</View>
					<View className="flex-row items-center gap-x-8">
						{runningScore ? <ScorePill score={runningScore} /> : null}
						{IconBlock}
						{MinuteBlock}
					</View>
				</>
			)}
		</View>
	);
}

import { Rating } from "@/components/ui/rating";
import SvgB027 from "@/components/ui/SvgIcons/B027";
import SvgB030 from "@/components/ui/SvgIcons/B030";
import SvgB031 from "@/components/ui/SvgIcons/B031";
import SvgB034 from "@/components/ui/SvgIcons/B034";
import SvgB035 from "@/components/ui/SvgIcons/B035";
import SvgB040 from "@/components/ui/SvgIcons/B040";
import SvgB041 from "@/components/ui/SvgIcons/B041";
import SvgB042 from "@/components/ui/SvgIcons/B042";
import SvgB043 from "@/components/ui/SvgIcons/B043";
import SvgB044 from "@/components/ui/SvgIcons/B044";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import type { FixtureEvent } from "@outscore/shared-types";
import type { ReactElement } from "react";
import { View } from "react-native";

export type LineupPlayer = {
	id: number;
	name: string;
	number?: number;
	pos: string;
	grid: string | null;
};

export type PlayerInjury = {
	type: string;
	reason: string;
};

export type CardPlayerLineupProps = {
	player: LineupPlayer;
	playerInjury?: PlayerInjury | null;
	events?: FixtureEvent[] | null;
	assistEvents?: FixtureEvent[] | null;
	rating?: number | null;
	className?: string;
};

const ICON_SIZE = 24;

function getEventIcon(detail?: string, isAssist?: boolean): ReactElement | null {
	switch (detail) {
		case "Normal Goal":
			return (
				<SvgB027
					width={ICON_SIZE}
					height={ICON_SIZE}
					className={isAssist ? "text-m-01-light-01" : "text-m-01-light-02"}
				/>
			);
		case "Own Goal":
			return (
				<SvgB027
					width={ICON_SIZE}
					height={ICON_SIZE}
					className="text-red"
				/>
			);
		case "Yellow Card":
			return (
				<SvgB031
					width={ICON_SIZE}
					height={ICON_SIZE}
					className="text-yellow"
				/>
			);
		case "Second Yellow Card":
			return <SvgB031 width={ICON_SIZE} height={ICON_SIZE} />;
		case "Red Card":
			return (
				<SvgB031
					width={ICON_SIZE}
					height={ICON_SIZE}
					className="text-red"
				/>
			);
		case "Goal Cancelled":
			return (
				<SvgB034
					width={ICON_SIZE}
					height={ICON_SIZE}
					className="text-red"
				/>
			);
		case "Penalty Confirmed":
		case "Penalty awarded":
			return (
				<SvgB041
					width={ICON_SIZE}
					height={ICON_SIZE}
					className="text-m-01-light-02"
				/>
			);
		case "Penalty":
			return (
				<SvgB042
					width={ICON_SIZE}
					height={ICON_SIZE}
					className="text-m-01-light-02"
				/>
			);
		case "Penalty cancelled":
			return (
				<SvgB040
					width={ICON_SIZE}
					height={ICON_SIZE}
					className="text-red"
				/>
			);
		case "Missed Penalty":
			return (
				<SvgB042
					width={ICON_SIZE}
					height={ICON_SIZE}
					className="text-red"
				/>
			);
		default:
			if (detail?.startsWith("Substitution")) {
				return isAssist ? (
					<SvgB043
						width={ICON_SIZE}
						height={ICON_SIZE}
						className="text-m-01-light-02"
					/>
				) : (
					<SvgB044
						width={ICON_SIZE}
						height={ICON_SIZE}
						className="text-red"
					/>
				);
			}
			return null;
	}
}

function getInjuryIcon(injury: PlayerInjury): ReactElement | null {
	const { type, reason } = injury;
	const isInjury = reason.includes("Injury") && !type.includes("Questionable");
	const isRedCard = reason.includes("Red Card");
	const isQuestionable = type.includes("Questionable");
	const isMissingFixture = type.includes("Missing Fixture");

	if (isInjury) {
		return (
			<SvgB030
				width={ICON_SIZE}
				height={ICON_SIZE}
				className="text-yellow"
			/>
		);
	}
	if (isRedCard) {
		return (
			<SvgB031
				width={ICON_SIZE}
				height={ICON_SIZE}
				className="text-red"
			/>
		);
	}
	if (isQuestionable) {
		return (
			<SvgB035
				width={ICON_SIZE}
				height={ICON_SIZE}
				className="text-neu-07"
			/>
		);
	}
	if (isMissingFixture) {
		return (
			<SvgB030
				width={ICON_SIZE}
				height={ICON_SIZE}
				className="text-yellow"
			/>
		);
	}
	return null;
}

export function CardPlayerLineup({
	player,
	playerInjury = null,
	rating,
	events = null,
	assistEvents = null,
	className,
}: CardPlayerLineupProps) {
	return (
		<View className={cn("h-32 flex-row items-center gap-8 px-16", className)}>
			{/* Rating badge */}
			{rating != null && <Rating rating={rating} hasShadow={false} />}

			{/* Player number (reserve space even when missing) */}
			{player.number != null ? (
				<Text
					variant="body-02--semi"
					className="min-w-16 text-neu-11 dark:text-neu-01"
				>
					{player.number}
				</Text>
			) : (
				<View className="min-w-16" />
			)}

			{/* Player name */}
			{player.name && (
				<Text
					variant="body-02"
					className="flex-1 text-neu-10 dark:text-neu-04"
					numberOfLines={1}
				>
					{player.name}
				</Text>
			)}

			{/* Event + injury icons */}
			{(events?.length ?? 0) > 0 ||
			(assistEvents?.length ?? 0) > 0 ||
			playerInjury ? (
				<View className="ml-auto flex-row-reverse items-center gap-8">
					{events?.map((event, index) => {
						const icon = getEventIcon(event.detail);
						if (!icon) return null;
						const key = `event-${event.time.elapsed}-${event.detail}-${index}`;
						return <View key={key}>{icon}</View>;
					})}
					{assistEvents?.map((event, index) => {
						const icon = getEventIcon(event.detail, true);
						if (!icon) return null;
						const key = `assist-${event.time.elapsed}-${event.detail}-${index}`;
						return <View key={key}>{icon}</View>;
					})}
					{playerInjury ? getInjuryIcon(playerInjury) : null}
				</View>
			) : null}
		</View>
	);
}

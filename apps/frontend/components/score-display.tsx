import type { FixtureStatusShort } from "@outscore/shared-types";
import {
	isFinishedStatus,
	isLiveStatus,
	isNotStartedStatus,
} from "@outscore/shared-types";
import { differenceInCalendarDays, format } from "date-fns";
import { View } from "react-native";

import { Text } from "@/components/ui/text";

interface ScoreDisplayProps {
	homeScore: number | null;
	awayScore: number | null;
	elapsed: number | null;
	status: FixtureStatusShort;
	date: string;
}

function formatTime(dateString: string): string {
	const date = new Date(dateString);
	return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatNotStartedLabel(dateString: string): string {
	const kickoff = new Date(dateString);
	const now = new Date();
	const daysUntil = differenceInCalendarDays(kickoff, now);

	// Today (or already started but still NS): show kickoff time
	if (daysUntil <= 0) {
		return formatTime(dateString);
	}

	if (daysUntil === 1) return "1 day left";
	if (daysUntil <= 3) return `in ${daysUntil} days`;

	// Beyond 3 days, show the date
	return format(kickoff, "MMM d");
}

function getStatusText(
	status: FixtureStatusShort,
	elapsed: number | null,
	date: string,
): string {
	if (isNotStartedStatus(status)) {
		return formatNotStartedLabel(date);
	}

	if (isLiveStatus(status)) {
		return typeof elapsed === "number" ? `${elapsed}'` : "LIVE";
	}

	if (isFinishedStatus(status)) {
		return "Fulltime";
	}

	return status;
}

export function ScoreDisplay({
	homeScore,
	awayScore,
	elapsed,
	status,
	date,
}: ScoreDisplayProps) {
	const isNotStarted = isNotStartedStatus(status);
	const statusText = getStatusText(status, elapsed, date);

	return (
		<View className="items-center justify-center">
			{/* Score */}
			<View className="flex-row items-center gap-x-32 gap-y-4">
				<Text variant="highlight-02" className="text-neu-01 text-right">
					{isNotStarted ? "-" : (homeScore ?? 0)}
				</Text>
				<Text variant="highlight-02" className="text-neu-01 text-left">
					{isNotStarted ? "-" : (awayScore ?? 0)}
				</Text>
			</View>

			{/* Status text */}
			<Text variant="body-01" className="mt-1 text-neu-01">
				{statusText}
			</Text>
		</View>
	);
}

import type { FixtureStatusShort } from "@outscore/shared-types";
import {
	isFinishedStatus,
	isLiveStatus,
	isNotStartedStatus,
} from "@outscore/shared-types";
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

function getStatusText(
	status: FixtureStatusShort,
	elapsed: number | null,
	date: string,
): string {
	if (isNotStartedStatus(status)) {
		return formatTime(date);
	}

	if (isLiveStatus(status)) {
		return elapsed !== null ? `${elapsed}'` : "LIVE";
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
			<View className="flex-row items-center gap-8">
				<Text variant="highlight-02" className="text-neu-01">
					{isNotStarted ? "-" : (homeScore ?? 0)}
				</Text>
				<Text variant="highlight-02" className="text-neu-01">
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

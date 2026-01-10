import type { FixtureStatusShort } from "@outscore/shared-types";
import { isFinishedStatus } from "@outscore/shared-types";
import { View } from "react-native";

interface FixtureProgressBarProps {
	elapsed: number | null;
	status: FixtureStatusShort;
	hasDots?: boolean;
}

function getFixtureDuration(status: FixtureStatusShort): number {
	// Extra time statuses
	if (status === "ET") return 120;
	// Penalty shootout (show full bar)
	if (status === "P" || status === "PEN") return 120;
	// Regular fixture (90 minutes)
	return 90;
}

function calculateProgress(
	elapsed: number | null,
	status: FixtureStatusShort,
): number {
	// Not started
	if (elapsed === null || elapsed === 0) return 0;

	// Finished - full progress
	if (isFinishedStatus(status)) return 100;

	const totalDuration = getFixtureDuration(status);
	const progress = (elapsed / totalDuration) * 100;

	// Cap at 100% for display purposes
	return Math.min(progress, 100);
}

export function FixtureProgressBar({
	elapsed,
	status,
	hasDots = true,
}: FixtureProgressBarProps) {
	const progress = calculateProgress(elapsed, status);

	return (
		<View className="relative h-1 w-full rounded-[22px] bg-m-01-light-01">
			{/* Progress fill */}
			<View
				className="h-full rounded-[22px] bg-m-01-light-03"
				style={{ width: `${progress}%` }}
			/>

			{/* Dots */}
			{hasDots && (
				<>
					{/* Start dot */}
					<View className="absolute -top-0.5 left-0 h-2 w-2 rounded-full bg-m-02-light-03" />
					{/* Middle dot */}
					<View className="absolute -top-0.5 left-1/2 -translate-x-1/2 h-2 w-2 rounded-full bg-m-02-light-03" />
					{/* End dot */}
					<View className="absolute -top-0.5 right-0 h-2 w-2 rounded-full bg-m-02-light-03" />
				</>
			)}
		</View>
	);
}

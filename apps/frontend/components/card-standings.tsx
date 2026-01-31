import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { View } from "react-native";

export type StandingsRowData = {
	rank: number;
	team: {
		id: number;
		name: string;
		logo?: string;
	};
	points: number;
	goalsDiff: number;
	played: number;
	win: number;
	draw: number;
	loss: number;
	goalsFor: number;
	goalsAgainst: number;
	form: string | null;
	description: string | null;
};

export type CardStandingsProps = {
	/** The standings row data */
	standing: StandingsRowData;
	/** Tailwind color class for position indicator (e.g., bg-m-01, bg-red) */
	indicatorColorClass?: string;
	/** Whether this row represents the team currently playing (live match) */
	isLive?: boolean;
};

/** Column widths for standings stats (shared with header) */
export const COLUMN_WIDTHS = {
	played: 18,
	win: 18,
	draw: 18,
	lose: 18,
	goals: 36,
	points: 24,
} as const;

/**
 * Single row in a standings table displaying team position, name, and stats
 */
export function CardStandings({
	standing,
	indicatorColorClass,
	isLive = false,
}: CardStandingsProps) {
	const { rank, team, points, played, win, draw, loss, goalsFor, goalsAgainst } = standing;
	const goalsDiff = `${goalsFor}:${goalsAgainst}`;

	const stats = [
		{ key: "played", value: played, width: COLUMN_WIDTHS.played },
		{ key: "win", value: win, width: COLUMN_WIDTHS.win },
		{ key: "draw", value: draw, width: COLUMN_WIDTHS.draw },
		{ key: "lose", value: loss, width: COLUMN_WIDTHS.lose },
		{ key: "goals", value: goalsDiff, width: COLUMN_WIDTHS.goals },
		{ key: "points", value: points, width: COLUMN_WIDTHS.points },
	];

	return (
		<View
			className={cn(
				"h-32 flex-row items-center gap-x-4 px-16",
				isLive && "bg-neu-03 dark:bg-neu-11",
			)}
		>
			{/* Rank with color indicator */}
			<View
				className={cn(
					"h-24 w-24 items-center justify-center rounded-full",
					indicatorColorClass ?? "bg-transparent",
				)}
			>
				<Text
					variant="body-02--semi"
					className={cn(
						indicatorColorClass ? "text-neu-01" : "text-neu-10 dark:text-neu-01",
					)}
				>
					{rank}
				</Text>
			</View>

			{/* Team name */}
			<View className="min-w-0 flex-1">
				<Text
					variant={isLive ? "body-02--semi" : "body-02"}
					className="text-neu-10 dark:text-neu-04"
					numberOfLines={1}
				>
					{team.name}
				</Text>
			</View>

			{/* Stats columns */}
			<View className="flex-row gap-2">
				{stats.map((stat) => (
					<Text
						key={stat.key}
						variant="body-02--semi"
						className="text-center text-neu-09/70 dark:text-neu-06"
						style={{ minWidth: stat.width }}
					>
						{stat.value}
					</Text>
				))}
			</View>
		</View>
	);
}

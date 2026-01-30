import type { Fixture, FixtureLineup } from "@outscore/shared-types";
import { Image } from "expo-image";
import {
	Platform,
	useColorScheme,
	useWindowDimensions,
	View,
} from "react-native";
import SvgGoal from "@/components/ui/SvgIcons/Goal";
import SvgMidfield from "@/components/ui/SvgIcons/Midfield";
import { Text } from "@/components/ui/text";
import { EventsLegend } from "./events-legend";
import { LineupsRow } from "./lineups-row";
import { LineupsTeamHeader } from "./lineups-team";
import { LineupsTeamList } from "./lineups-team-list";

// Import the field image
const fieldImage = require("@/assets/field.png");

type LineupsTabProps = {
	fixture: Fixture;
};

type ParsedPlayer = {
	id: number;
	name: string;
	number: number;
	pos: string;
	grid: string | null;
	row: number;
	col: number;
	rating?: number | null;
};

type PlayersByRow = Record<number, ParsedPlayer[]>;

/**
 * Parse player grid position (e.g., "2:4" -> { row: 2, col: 4 })
 * Returns { row: 0, col: 0 } for null/invalid grid values
 */
function parseGrid(grid: string | null): { row: number; col: number } {
	if (!grid) return { row: 0, col: 0 };
	const parts = grid.split(":");
	if (parts.length !== 2) return { row: 0, col: 0 };
	const row = Number.parseInt(parts[0], 10);
	const col = Number.parseInt(parts[1], 10);
	if (Number.isNaN(row) || Number.isNaN(col)) return { row: 0, col: 0 };
	return { row, col };
}

/**
 * Group players by their row position
 */
function groupPlayersByRow(players: ParsedPlayer[]): PlayersByRow {
	const byRow: PlayersByRow = {};
	for (const player of players) {
		if (!byRow[player.row]) {
			byRow[player.row] = [];
		}
		byRow[player.row].push(player);
	}
	// Sort players within each row by column
	for (const row of Object.keys(byRow)) {
		byRow[Number(row)].sort((a, b) => a.col - b.col);
	}
	return byRow;
}

/**
 * Parse lineup data and group by rows
 */
function parseLineup(lineup: FixtureLineup): {
	playersByRow: PlayersByRow;
	rows: number[];
} {
	const parsedPlayers: ParsedPlayer[] = lineup.startXI.map((entry) => {
		const { row, col } = parseGrid(entry.player.grid);
		return {
			id: entry.player.id,
			name: entry.player.name,
			number: entry.player.number,
			pos: entry.player.pos,
			grid: entry.player.grid,
			row,
			col,
			rating: null, // Placeholder for future rating data
		};
	});

	const playersByRow = groupPlayersByRow(parsedPlayers);
	const rows = Object.keys(playersByRow)
		.map(Number)
		.sort((a, b) => a - b);

	return { playersByRow, rows };
}

// Pitch aspect ratio (height / width) based on field.png
const PITCH_ASPECT_RATIO = 1.5;

export function LineupsTab({ fixture }: LineupsTabProps) {
	const { width: screenWidth, height: screenHeight } = useWindowDimensions();
	const isDark = useColorScheme() === "dark";
	const lineups = fixture.lineups;

	// No lineups available
	if (!lineups || lineups.length < 2) {
		return (
			<View className="p-24">
				<Text variant="body-02" className="text-neu-07 dark:text-neu-06">
					Lineups are not available for this match yet.
				</Text>
			</View>
		);
	}

	const homeTeamId = fixture.teams.home.id;
	const awayTeamId = fixture.teams.away.id;
	const homeLineup =
		lineups.find((lineup) => lineup.team.id === homeTeamId) ?? lineups[0];
	const awayLineup =
		lineups.find((lineup) => lineup.team.id === awayTeamId) ?? lineups[1];

	const homeParsed = parseLineup(homeLineup);
	const awayParsed = parseLineup(awayLineup);

	const isWebPlatform = Platform.OS === "web";
	// Calculate pitch dimensions (cap width on web for desktop layouts)
	const maxPitchWidth = isWebPlatform ? 768 : 768;
	const pitchWidth = Math.min(screenWidth - 32, maxPitchWidth);
	const pitchHeight = isWebPlatform
		? pitchWidth / PITCH_ASPECT_RATIO
		: pitchWidth * PITCH_ASPECT_RATIO;
	const halfPitchHeight = pitchHeight / 2;
	const contentWidth = isWebPlatform ? pitchHeight : pitchWidth;
	const contentHeight = isWebPlatform ? pitchWidth : pitchHeight;

	return (
		<View className="py-24">
			<View className="px-16">
				<View className="self-center" style={{ width: pitchWidth }}>
					{isWebPlatform ? (
						<View className="flex-row items-center justify-between">
							<LineupsTeamHeader
								teamName={homeLineup.team.name}
								formation={homeLineup.formation}
							/>
							<LineupsTeamHeader
								teamName={awayLineup.team.name}
								formation={awayLineup.formation}
							/>
						</View>
					) : (
						<LineupsTeamHeader
							teamName={homeLineup.team.name}
							formation={homeLineup.formation}
						/>
					)}

					{/* Pitch container */}
					<View
						className="overflow-hidden rounded-lg relative items-center justify-center"
						style={{ width: pitchWidth, height: pitchHeight }}
					>
						<View
							className="relative"
							style={{
								width: contentWidth,
								height: contentHeight,
								transform: isWebPlatform ? [{ rotate: "-90deg" }] : undefined,
							}}
						>
							{/* Pitch background image */}
							<Image
								source={fieldImage}
								style={{ width: contentWidth, height: contentHeight }}
								contentFit="cover"
							/>

							{/* Color overlay */}
							<View
								className="absolute left-0 top-0 z-[99]"
								style={{
									width: contentWidth,
									height: contentHeight,
									backgroundColor: isDark
										? "rgba(102, 227, 167, 0.14)"
										: "rgba(52, 183, 120, 0.10)",
								}}
							/>

							{/* Pitch markings */}
							<View
								className="absolute left-0 top-0 z-[9] items-center justify-center"
								style={{ width: contentWidth, height: contentHeight }}
							>
								{/* Midfield line */}
								<View className="absolute left-0 top-1/2 h-[2px] w-full -translate-y-1/2 bg-neu-01 dark:bg-neu-12" />

								{/* Top goal area */}
								<View className="absolute left-1/2 top-0 -translate-x-1/2 text-neu-01 dark:text-neu-12">
									<SvgGoal width={172} height={91} />
								</View>

								{/* Center circle */}
								<View className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-neu-01 dark:text-neu-12">
									<SvgMidfield width={94} height={94} />
								</View>

								{/* Bottom goal area (rotated 180deg) */}
								<View className="absolute bottom-0 left-1/2 -translate-x-1/2 rotate-180 text-neu-01 dark:text-neu-12">
									<SvgGoal width={172} height={91} />
								</View>
							</View>

							{/* Players overlay */}
							<View
								className="absolute left-0 top-0"
								style={{ width: contentWidth, height: contentHeight }}
							>
								{/* Home team (top half, rows from top to middle) */}
								<View
									style={{ height: contentHeight / 2 }}
									className="justify-around"
								>
									{homeParsed.rows.map((rowNum) => (
										<LineupsRow
											key={`home-row-${rowNum}`}
											players={homeParsed.playersByRow[rowNum]}
											teamVariant="home"
											isGoalkeeperRow={rowNum === 1}
										/>
									))}
								</View>

								{/* Away team (bottom half, rows from middle to bottom, reversed) */}
								<View
									style={{ height: contentHeight / 2 }}
									className="flex-col-reverse justify-around "
								>
									{awayParsed.rows.map((rowNum) => (
										<LineupsRow
											key={`away-row-${rowNum}`}
											players={awayParsed.playersByRow[rowNum]}
											teamVariant="away"
											isGoalkeeperRow={rowNum === 1}
										/>
									))}
								</View>
							</View>
						</View>
					</View>

					{!isWebPlatform && (
						<LineupsTeamHeader
							teamName={awayLineup.team.name}
							formation={awayLineup.formation}
						/>
					)}
				</View>
			</View>

			{/* Team lists with accordions */}
			<LineupsTeamList fixture={fixture} />

			{/* Events legend */}
			<EventsLegend />
		</View>
	);
}

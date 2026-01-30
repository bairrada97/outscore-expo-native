import { Platform, View } from "react-native";
import { LineupsPlayer } from "./lineups-player";

type PlayerData = {
	id: number;
	name: string;
	number: number;
	pos: string;
	rating?: number | null;
};

type LineupsRowProps = {
	players: PlayerData[];
	teamVariant: "home" | "away";
	isGoalkeeperRow?: boolean;
};

export function LineupsRow({
	players,
	teamVariant,
	isGoalkeeperRow = false,
}: LineupsRowProps) {
	if (players.length === 0) return null;

	const shouldReverse =
		Platform.OS === "web"
			? teamVariant === "home"
			: teamVariant === "away";
	const orderedPlayers = shouldReverse ? [...players].reverse() : players;

	return (
		<View className="w-full flex-row items-start justify-evenly px-4">
			{orderedPlayers.map((player) => (
				<View key={player.id} className="flex-1 items-center">
					<LineupsPlayer
						number={player.number}
						name={player.name}
						rating={player.rating}
						isGoalkeeper={isGoalkeeperRow}
						teamVariant={teamVariant}
					/>
				</View>
			))}
		</View>
	);
}

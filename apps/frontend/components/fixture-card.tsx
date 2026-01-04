import { cn } from "@/lib/utils";
import type { FormattedMatch } from "@outscore/shared-types";
import { Image, Pressable, Text, View } from "react-native";
import { FavouriteIcon } from "./favourite-icon";
import { FixtureStatusBadge } from "./fixture-status-badge";

interface FixtureCardProps {
	fixture: FormattedMatch;
	timezone: string;
	onPress?: () => void;
}

export function FixtureCard({ fixture, timezone, onPress }: FixtureCardProps) {
	const { teams, goals, status, time, timestamp } = fixture;

	return (
		<Pressable
			onPress={onPress}
			className="fixture-card relative flex flex-row items-center py-3 px-2 bg-neu-01 active:bg-neu-02"
		>
			{/* Left: Favourite icon */}
			<FavouriteIcon size={16} />

			{/* Center: Teams and scores */}
			<View className="flex-1 px-2">
				{/* Home team */}
				<View className="flex-row items-center justify-between py-1">
					<View className="flex-row items-center flex-1">
						<Image
							source={{ uri: teams.home.logo }}
							className="w-5 h-5 mr-2"
							resizeMode="contain"
						/>
						<Text
							className={cn(
								"text-sm font-medium",
								teams.home.winner ? "text-neu-13" : "text-neu-08",
							)}
							numberOfLines={1}
						>
							{teams.home.name}
						</Text>
					</View>
					<Text
						className={cn(
							"text-sm font-mono font-semibold min-w-[20px] text-right",
							teams.home.winner ? "text-neu-13" : "text-neu-08",
						)}
					>
						{goals.home ?? "-"}
					</Text>
				</View>

				{/* Away team */}
				<View className="flex-row items-center justify-between py-1">
					<View className="flex-row items-center flex-1">
						<Image
							source={{ uri: teams.away.logo }}
							className="w-5 h-5 mr-2"
							resizeMode="contain"
						/>
						<Text
							className={cn(
								"text-sm font-medium",
								teams.away.winner ? "text-neu-13" : "text-neu-08",
							)}
							numberOfLines={1}
						>
							{teams.away.name}
						</Text>
					</View>
					<Text
						className={cn(
							"text-sm font-mono font-semibold min-w-[20px] text-right",
							teams.away.winner ? "text-neu-13" : "text-neu-08",
						)}
					>
						{goals.away ?? "-"}
					</Text>
				</View>
			</View>

			{/* Right: Status badge */}
			<FixtureStatusBadge
				status={status}
				time={time}
				timestamp={timestamp}
				timezone={timezone}
			/>
		</Pressable>
	);
}

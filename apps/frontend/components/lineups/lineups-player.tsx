import { Rating } from "@/components/ui/rating";
import { Text } from "@/components/ui/text";
import { Platform, View } from "react-native";

type LineupsPlayerProps = {
	number: number;
	name: string;
	rating?: number | null;
	isGoalkeeper?: boolean;
	teamVariant: "home" | "away";
};

export function LineupsPlayer({
	number,
	name,
	rating,
	isGoalkeeper = false,
	teamVariant,
}: LineupsPlayerProps) {
	const showRating = rating != null;

	// Shorten name to first initial + last name (e.g., "Diogo Costa" -> "D. Costa")
	const displayName = formatPlayerName(name);

	// Goalkeeper has white background, outfield players have gradient based on team
	const chipBgClass = isGoalkeeper
		? "bg-neu-01"
		: teamVariant === "home"
			? "bg-linear-to-br from-m-01-light-01 to-m-02-dark-01"
			: "bg-linear-to-r from-neu-08 to-neu-07";

	// Goalkeeper text: home = m-01-light-01, away = neu-10
	// Outfield players: white text
	const chipTextClass = isGoalkeeper
		? teamVariant === "home"
			? "text-m-01-light-01"
			: "text-neu-10"
		: "text-neu-01";

	return (
		<View
			className="items-center gap-4"
			style={Platform.OS === "web" ? { transform: [{ rotate: "90deg" }] } : undefined}
		>
			{/* Player number chip */}
			<View className="relative">
				{/* Rating badge */}
				{showRating && (
					<View className="absolute -top-6 left-16 z-10">
						<Rating rating={rating} hasShadow />
					</View>
				)}

				{/* Number circle */}
				<View
					className={`h-24 w-24 items-center justify-center rounded-full ${chipBgClass}`}
					style={Platform.select({
						web: { boxShadow: "0 2px 4px rgba(0, 0, 0, 0.15)" },
						default: {
							shadowColor: "#000",
							shadowOpacity: 0.15,
							shadowRadius: 4,
							shadowOffset: { width: 0, height: 2 },
							elevation: 2,
						},
					})}
				>
					<Text variant="caption-01" className={chipTextClass}>
						{number}
					</Text>
				</View>
			</View>

			{/* Player name */}
			<Text
				variant="caption-03"
				className="text-center text-neu-10 dark:text-neu-01"
				numberOfLines={1}
			>
				{displayName}
			</Text>
		</View>
	);
}

function formatPlayerName(fullName: string): string {
	const parts = fullName.trim().split(/\s+/);
	if (parts.length === 1) return parts[0];
	const firstName = parts[0];
	const lastName = parts[parts.length - 1];
	return `${firstName.charAt(0)}. ${lastName}`;
}

import { Text } from "@/components/ui/text";
import { View } from "react-native";

export type RatingColor = "green" | "orange" | "red";

function getRatingColor(rating: number | null | undefined): RatingColor {
	if (rating == null) return "orange";
	if (rating >= 7.0) return "green";
	if (rating < 6.0) return "red";
	return "orange";
}

const ratingColorClasses: Record<RatingColor, string> = {
	green: "bg-green-500",
	orange: "bg-orange-400",
	red: "bg-red-500",
};

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
	const ratingColor = getRatingColor(rating);
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
		<View className="items-center gap-4">
			{/* Player number chip */}
			<View className="relative">
				{/* Rating badge */}
				{showRating && (
					<View
						className={`absolute -top-6 left-16 z-10 min-w-24 items-center justify-center rounded-lg px-4 ${ratingColorClasses[ratingColor]}`}
						style={{ boxShadow: "0 1px 3px rgba(0, 0, 0, 0.3)" }}
					>
						<Text variant="caption-03" className="text-neu-01">
							{rating.toFixed(1)}
						</Text>
					</View>
				)}

				{/* Number circle */}
				<View
					className={`h-24 w-24 items-center justify-center rounded-full ${chipBgClass}`}
					style={{ boxShadow: "0 2px 4px rgba(0, 0, 0, 0.15)" }}
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

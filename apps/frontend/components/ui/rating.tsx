import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { View } from "react-native";

type RatingColor = "green" | "orange" | "red";

function getRatingColor(rating: number): RatingColor {
	if (rating >= 7.0) return "green";
	if (rating < 6.0) return "red";
	return "orange";
}

const ratingBgClasses: Record<RatingColor, string> = {
	green: "bg-light-green",
	orange: "bg-orange",
	red: "bg-red",
};

export type RatingProps = {
	rating: number;
	hasShadow?: boolean;
	className?: string;
};

export function Rating({ rating, hasShadow = true, className }: RatingProps) {
	const color = getRatingColor(rating);

	return (
		<View
			className={cn(
				"min-w-24 items-center justify-center rounded-lg px-4",
				ratingBgClasses[color],
				className,
			)}
			style={hasShadow ? { boxShadow: "0 1px 3px rgba(0, 0, 0, 0.3)" } : undefined}
		>
			<Text variant="caption-03" className="text-neu-01">
				{rating.toFixed(1)}
			</Text>
		</View>
	);
}

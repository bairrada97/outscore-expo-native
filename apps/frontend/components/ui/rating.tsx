import { Text } from "@/components/ui/text";
import { getRatingColor, ratingBgClasses } from "@/components/ui/rating-utils";
import { cn } from "@/lib/utils";
import { Platform, View } from "react-native";

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
			style={
				hasShadow
					? Platform.select({
							web: { boxShadow: "0 1px 3px rgba(0, 0, 0, 0.3)" },
							default: {
								shadowColor: "#000",
								shadowOpacity: 0.3,
								shadowRadius: 3,
								shadowOffset: { width: 0, height: 1 },
								elevation: 2,
							},
						})
					: undefined
			}
		>
			<Text variant="caption-03" className="text-neu-01">
				{rating.toFixed(1)}
			</Text>
		</View>
	);
}

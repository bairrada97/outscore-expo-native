import { cn } from "@/lib/utils";
import { Text } from "@/components/ui/text";
import { View } from "react-native";

type MatchOutcome = "W" | "D" | "L";

type MatchOutcomeBadgeProps = {
	outcome: MatchOutcome;
	className?: string;
	textClassName?: string;
};

export function MatchOutcomeBadge({
	outcome,
	className,
	textClassName,
}: MatchOutcomeBadgeProps) {
	return (
		<View
			className={cn(
				"h-[22px] w-[22px] items-center justify-center rounded-[4px]",
				outcome === "W" && "bg-dark-green",
				outcome === "D" && "bg-neu-09",
				outcome === "L" && "bg-red",
				className,
			)}
		>
			<Text
				variant="body-02--semi"
				className={cn("text-neu-01", textClassName)}
			>
				{outcome}
			</Text>
		</View>
	);
}

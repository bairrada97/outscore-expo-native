import { cn } from "@/lib/utils";
import { Pressable, View } from "react-native";
import Svg, { Path } from "react-native-svg";

interface CalendarButtonProps {
	onPress?: () => void;
}

export function CalendarButton({ onPress }: CalendarButtonProps) {
	return (
		<Pressable
			onPress={onPress}
			className={cn(
				"w-full h-12 items-center justify-center",
				"bg-neu-02 border-r border-neu-04",
				"active:bg-neu-03",
			)}
		>
			<View className="w-6 h-6 items-center justify-center">
				<Svg
					width={24}
					height={24}
					viewBox="0 0 24 24"
					fill="none"
					stroke="#5E6763"
					strokeWidth={2}
					strokeLinecap="round"
					strokeLinejoin="round"
				>
					<Path d="M19 4H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2zM16 2v4M8 2v4M3 10h18" />
				</Svg>
			</View>
		</Pressable>
	);
}

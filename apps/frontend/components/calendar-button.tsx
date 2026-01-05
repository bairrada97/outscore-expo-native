import { cn } from "@/lib/utils";
import { Pressable, View } from "react-native";
import SvgB022 from "./ui/SvgIcons/B022";

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
			<SvgB022 width={24} height={24} className="text-m-01" />
		</Pressable>
	);
}

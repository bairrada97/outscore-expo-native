import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Animated, Pressable, View } from "react-native";
import SvgB021 from "../ui/SvgIcons/B021";
import { Text } from "../ui/text";

interface CalendarBarDayProps {
	date: Date;
	tabIndex: number;
	position: Animated.AnimatedInterpolation<number>;
	isToday: boolean;
	onPress: () => void;
}

export function CalendarBarDay({
	date,
	tabIndex,
	position,
	isToday,
	onPress,
}: CalendarBarDayProps) {
	const activeOpacity = position.interpolate({
		inputRange: [tabIndex - 1, tabIndex, tabIndex + 1],
		outputRange: [0, 1, 0],
		extrapolate: "clamp",
	});

	const inactiveOpacity = position.interpolate({
		inputRange: [tabIndex - 1, tabIndex, tabIndex + 1],
		outputRange: [1, 0, 1],
		extrapolate: "clamp",
	});

	const inactiveTextClass = isToday
		? "text-m-01 dark:text-m-01-light-04"
		: "text-neu-09/70 dark:text-neu-06";

	const accessibilityLabel = isToday
		? `Today, ${format(date, "MMMM d")}`
		: format(date, "EEEE, MMMM d");

	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="button"
			accessibilityLabel={accessibilityLabel}
			className="flex-1 items-center justify-center overflow-hidden z-10"
			style={{ backgroundColor: "transparent" }}
		>
			<View className="relative items-center justify-center">
				<Animated.View style={{ opacity: inactiveOpacity }} className="items-center">
					<Text variant="highlight-01" className={inactiveTextClass}>
						{format(date, "d")}
					</Text>
					<Text
						variant="caption-02"
						className={cn("uppercase", inactiveTextClass)}
					>
						{isToday ? "Today" : format(date, "EEE")}
					</Text>
				</Animated.View>

				<Animated.View
					style={{ opacity: activeOpacity, position: "absolute" }}
					className="items-center"
				>
					<Text variant="highlight-01" className="text-neu-01">
						{format(date, "d")}
					</Text>
					<Text variant="caption-02" className="uppercase text-neu-01">
						{isToday ? "Today" : format(date, "EEE")}
					</Text>
				</Animated.View>
			</View>
		</Pressable>
	);
}

interface LiveTabProps {
	tabIndex: number;
	position: Animated.AnimatedInterpolation<number>;
	label: string;
	onPress: () => void;
}

export function LiveTab({ tabIndex, position, label, onPress }: LiveTabProps) {
	const activeOpacity = position.interpolate({
		inputRange: [tabIndex - 1, tabIndex, tabIndex + 1],
		outputRange: [0, 1, 0],
		extrapolate: "clamp",
	});

	const inactiveOpacity = position.interpolate({
		inputRange: [tabIndex - 1, tabIndex, tabIndex + 1],
		outputRange: [1, 0, 1],
		extrapolate: "clamp",
	});

	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="button"
			accessibilityLabel="View live matches"
			className="flex-1 items-center justify-center z-10"
			style={{ backgroundColor: "transparent" }}
		>
			<View className="relative flex-row items-center justify-center">
				<Animated.View
					style={{ opacity: inactiveOpacity }}
					className="flex-col items-center gap-y-4"
				>
					<SvgB021 width={24} height={24} className="text-m-01" color="currentColor" />
					<Text variant="caption-01" className="uppercase text-m-01">
						{label}
					</Text>
				</Animated.View>

				<Animated.View
					style={{ opacity: activeOpacity, position: "absolute" }}
					className="flex-col items-center gap-y-4"
				>
					<SvgB021
						width={24}
						height={24}
						className="text-neu-01"
						color="currentColor"
					/>
					<Text variant="caption-01" className="uppercase text-neu-01">
						{label}
					</Text>
				</Animated.View>
			</View>
		</Pressable>
	);
}


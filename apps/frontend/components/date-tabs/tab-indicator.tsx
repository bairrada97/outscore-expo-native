import type { DateRoute } from "./types";
import { Animated, View } from "react-native";

interface TabIndicatorProps {
	position: Animated.AnimatedInterpolation<number>;
	routes: DateRoute[];
	tabWidth: number;
}

export function TabIndicator({ position, routes, tabWidth }: TabIndicatorProps) {
	const inputRange = routes.map((_, i) => i);
	const outputRange = routes.map((_, i) => i * tabWidth);

	const translateX = position.interpolate({
		inputRange,
		outputRange,
		extrapolate: "clamp",
	});

	return (
		<Animated.View
			style={{
				position: "absolute",
				top: 0,
				left: 0,
				width: tabWidth,
				height: "100%",
				zIndex: 1,
				transform: [{ translateX }],
			}}
		>
			<View className="absolute inset-0 bg-linear-to-r from-m-02 to-m-01-light-01" />
		</Animated.View>
	);
}


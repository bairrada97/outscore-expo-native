import { formatDateForApi } from "@/utils/date-utils";
import { isWeb } from "@/utils/platform";
import { useCallback } from "react";
import { type Animated, View } from "react-native";
import { type SceneRendererProps, TabView } from "react-native-tab-view";
import { FixturesScreen } from "../fixtures-screen";
import { CalendarBarButtonScreen, DateTabsTabBar } from "./tab-bar";
import type { DateRoute } from "./types";
import { useDateTabsController } from "./use-date-tabs-controller";

export function DateTabs() {
	const {
		today,
		routes,
		index,
		currentRoute,
		containerWidth,
		calendarButtonWidth,
		webAnimatedPosition,
		handleIndexChange,
	} = useDateTabsController();

	const renderScene = useCallback(
		({ route }: SceneRendererProps & { route: DateRoute }) => {
			if (route.key === "live") {
				return (
					<FixturesScreen
						key={`screen-live-${formatDateForApi(today)}`}
						date={formatDateForApi(today)}
						live
					/>
				);
			}
			return <FixturesScreen key={`screen-${route.key}`} date={route.key} />;
		},
		[today],
	);

	const renderTabBar = useCallback(
		(props: { position: Animated.AnimatedInterpolation<number> }) => (
			<DateTabsTabBar
				routes={routes}
				position={props.position}
				onIndexChange={handleIndexChange}
				today={today}
				containerWidth={containerWidth}
				calendarButtonWidth={calendarButtonWidth}
			/>
		),
		[routes, handleIndexChange, today, containerWidth, calendarButtonWidth],
	);

	if (isWeb) {
		return (
			<View>
				<View
					className="absolute left-0 right-0 h-12 z-20 shadow-sha-01 dark:shadow-sha-06"
					style={{ backgroundColor: "transparent" }}
					pointerEvents="none"
				/>
				<CalendarBarButtonScreen containerWidth={containerWidth} />
				<DateTabsTabBar
					routes={routes}
					position={webAnimatedPosition}
					onIndexChange={handleIndexChange}
					today={today}
					containerWidth={containerWidth}
					calendarButtonWidth={calendarButtonWidth}
				/>
				<View style={{ width: containerWidth }}>
					{currentRoute?.key === "live" ? (
						<FixturesScreen
							key={`screen-live-${formatDateForApi(today)}`}
							date={formatDateForApi(today)}
							live
						/>
					) : currentRoute ? (
						<FixturesScreen
							key={`screen-${currentRoute.key}`}
							date={currentRoute.key}
						/>
					) : null}
				</View>
			</View>
		);
	}

	return (
		<View className="flex-1">
			<View
				className="absolute left-0 right-0 h-12 z-20 shadow-sha-01 dark:shadow-sha-06"
				style={{ backgroundColor: "transparent" }}
				pointerEvents="none"
			/>
			<CalendarBarButtonScreen containerWidth={containerWidth} />
			<View style={{ flex: 1 }}>
				<TabView
					navigationState={{ index, routes }}
					renderScene={renderScene}
					onIndexChange={handleIndexChange}
					renderTabBar={renderTabBar}
					swipeEnabled
					lazy
					lazyPreloadDistance={2}
					style={{ flex: 1 }}
				/>
			</View>
		</View>
	);
}

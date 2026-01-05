import { usePrefetchFixtures } from "@/hooks/usePrefetchFixtures";
import { cn } from "@/lib/utils";
import { LIVE_BUTTON_LABEL } from "@/utils/constants";
import {
	formatDateForApi,
	getDateRange,
	getTodayTabIndex,
} from "@/utils/date-utils";
import { isWeb } from "@/utils/platform";
import { format, isSameDay } from "date-fns";
import { useGlobalSearchParams, useRouter } from "expo-router";
import { startTransition, useCallback, useMemo, useState } from "react";
import { Animated, Pressable, useWindowDimensions, View } from "react-native";
import { type SceneRendererProps, TabView } from "react-native-tab-view";
import { CalendarButton } from "./calendar-button";
import { FixturesScreen } from "./fixtures-screen";
import SvgB021 from "./ui/SvgIcons/B021";
import { Text } from "./ui/text";

interface DateRoute {
	key: string;
	title: string;
	date?: Date;
}

interface CalendarBarDayProps {
	date: Date;
	tabIndex: number;
	position: Animated.AnimatedInterpolation<number>;
	isToday: boolean;
	onPress: () => void;
}

function CalendarBarDay({
	date,
	tabIndex,
	position,
	isToday,
	onPress,
}: CalendarBarDayProps) {
	// Animate opacity based on how "active" this tab is (0 = not active, 1 = fully active)
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

	return (
		<Pressable
			onPress={onPress}
			className="flex-1 items-center justify-center overflow-hidden z-10"
			style={{ backgroundColor: "transparent" }}
		>
			<View className="relative items-center justify-center">
				{/* Inactive state (fades out when active) */}
				<Animated.View
					style={{ opacity: inactiveOpacity }}
					className="items-center"
				>
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

				{/* Active state (fades in when active) */}
				<Animated.View
					style={{
						opacity: activeOpacity,
						position: "absolute",
					}}
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
	onPress: () => void;
}

function LiveTab({ tabIndex, position, onPress }: LiveTabProps) {
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
			className="flex-1 items-center justify-center z-10"
			style={{ backgroundColor: "transparent" }}
		>
			<View className="relative flex-row items-center justify-center">
				{/* Inactive state */}
				<Animated.View
					style={{ opacity: inactiveOpacity }}
					className="flex-col items-center gap-x-4"
				>
					<SvgB021
						width={24}
						height={24}
						className="text-m-01"
						color="currentColor"
					/>
					<Text variant="caption-01" className="uppercase text-m-01">
						{LIVE_BUTTON_LABEL}
					</Text>
				</Animated.View>

				{/* Active state */}
				<Animated.View
					style={{
						opacity: activeOpacity,
						position: "absolute",
					}}
					className="flex-col items-center gap-x-4"
				>
					<SvgB021
						width={24}
						height={24}
						className="text-neu-01"
						color="currentColor"
					/>
					<Text variant="caption-01" className="uppercase text-neu-01">
						{LIVE_BUTTON_LABEL}
					</Text>
				</Animated.View>
			</View>
		</Pressable>
	);
}

interface TabIndicatorProps {
	position: Animated.AnimatedInterpolation<number>;
	routes: DateRoute[];
	tabWidth: number;
}

function TabIndicator({ position, routes, tabWidth }: TabIndicatorProps) {
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
			{/* Gradient background using gra-02: from m-02 to m-01-light-01 */}
			<View className="absolute inset-0 bg-linear-to-r from-m-02 to-m-01-light-01" />
		</Animated.View>
	);
}

interface CalendarBarButtonScreenProps {
	containerWidth: number;
}

export const CalendarBarButtonScreen = ({
	containerWidth,
}: CalendarBarButtonScreenProps) => {
	const calendarButtonWidth = containerWidth / 7;

	return (
		<View
			className={cn(
				"absolute left-0 z-10 flex h-48 flex-row items-center justify-start dark:bg-neu-11 box-border bg-neu-01",
			)}
			style={{
				width: calendarButtonWidth,
			}}
		>
			<CalendarButton onPress={() => {}} />
		</View>
	);
};

function createRoutes(dates: Date[]): DateRoute[] {
	const routes: DateRoute[] = dates.map((date) => ({
		key: formatDateForApi(date),
		title: format(date, "EEE"),
		date,
	}));

	routes.push({
		key: "live",
		title: LIVE_BUTTON_LABEL,
	});

	return routes;
}

interface TabBarProps {
	routes: DateRoute[];
	position: Animated.AnimatedInterpolation<number>;
	onIndexChange: (index: number) => void;
	today: Date;
	containerWidth: number;
	calendarButtonWidth: number;
}

function CustomTabBar({
	routes,
	position,
	onIndexChange,
	today,
	containerWidth,
	calendarButtonWidth,
}: TabBarProps) {
	const tabBarWidth = containerWidth - calendarButtonWidth;
	const tabWidth = tabBarWidth / routes.length;

	// Memoize tab press handlers to prevent unnecessary re-renders
	const createTabPressHandler = useCallback(
		(index: number) => () => onIndexChange(index),
		[onIndexChange],
	);

	return (
		<View
			className="flex-row items-stretch h-12 relative bg-neu-01 dark:bg-neu-11"
			style={{
				marginLeft: calendarButtonWidth,
			}}
		>
			{/* Animated indicator */}
			<TabIndicator position={position} routes={routes} tabWidth={tabWidth} />

			{/* Tab items (rendered on top of indicator) */}
			{routes.map((route, i) => {
				const isLive = route.key === "live";
				const isToday = !isLive && !!route.date && isSameDay(route.date, today);

				if (isLive) {
					return (
						<LiveTab
							key={route.key}
							tabIndex={i}
							position={position}
							onPress={createTabPressHandler(i)}
						/>
					);
				}

				if (!route.date) return null;

				return (
					<CalendarBarDay
						key={route.key}
						date={route.date}
						tabIndex={i}
						position={position}
						isToday={isToday}
						onPress={createTabPressHandler(i)}
					/>
				);
			})}
		</View>
	);
}

export function DateTabs() {
	const layout = useWindowDimensions();
	const router = useRouter();
	const params = useGlobalSearchParams<{ date?: string }>();

	// Prefetch all date tabs in the background for instant tab switching
	usePrefetchFixtures();

	const today = useMemo(() => new Date(), []);
	const dates = useMemo(() => getDateRange(today), [today]);
	const routes = useMemo(() => createRoutes(dates), [dates]);

	const initialIndex = useMemo(() => {
		if (params.date === "live") {
			return routes.length - 1;
		}
		if (params.date) {
			const idx = routes.findIndex((r) => r.key === params.date);
			if (idx >= 0) return idx;
		}
		return getTodayTabIndex();
	}, [params.date, routes]);

	const [index, setIndex] = useState(initialIndex);

	const handleIndexChange = useCallback(
		(newIndex: number) => {
			// Use startTransition to mark this as a non-urgent update
			// This keeps the tab animation smooth while React renders the new content
			startTransition(() => {
				setIndex(newIndex);

				if (isWeb) {
					const route = routes[newIndex];
					if (route) {
						router.setParams({ date: route.key });
					}
				}
			});
		},
		[routes, router],
	);

	const renderScene = useCallback(
		({ route }: SceneRendererProps & { route: DateRoute }) => {
			if (route.key === "live") {
				return <FixturesScreen date={formatDateForApi(today)} live />;
			}
			return <FixturesScreen date={route.key} />;
		},
		[today],
	);

	const containerWidth = useMemo(
		() => (isWeb ? Math.min(layout.width, 800) : layout.width),
		[layout.width],
	);
	const calendarButtonWidth = useMemo(
		() => containerWidth / 7,
		[containerWidth],
	);
	const tabViewWidth = useMemo(
		() => containerWidth - calendarButtonWidth,
		[containerWidth, calendarButtonWidth],
	);

	const renderTabBar = useCallback(
		(props: { position: Animated.AnimatedInterpolation<number> }) => (
			<CustomTabBar
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

	return (
		<View className={isWeb ? "" : "flex-1"}>
			{/* Shadow bar that spans the full width - transparent so tabs show through */}
			<View
				className="absolute left-0 right-0 h-12 z-20 shadow-sha-01 dark:shadow-sha-06"
				style={{ backgroundColor: "transparent" }}
				pointerEvents="none"
			/>
			<CalendarBarButtonScreen containerWidth={containerWidth} />
			<View>
				<TabView
					navigationState={{ index, routes }}
					renderScene={renderScene}
					onIndexChange={handleIndexChange}
					renderTabBar={renderTabBar}
					swipeEnabled={!isWeb}
					lazy
					lazyPreloadDistance={0}
					style={
						isWeb
							? { flex: undefined, position: "relative", width: containerWidth }
							: undefined
					}
					pagerStyle={{ width: tabViewWidth }}
				/>
			</View>
		</View>
	);
}

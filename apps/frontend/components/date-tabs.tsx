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
import {
	startTransition,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
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
			accessibilityRole="button"
			accessibilityLabel="View live matches"
			className="flex-1 items-center justify-center z-10"
			style={{ backgroundColor: "transparent" }}
		>
			<View className="relative flex-row items-center justify-center">
				{/* Inactive state */}
				<Animated.View
					style={{ opacity: inactiveOpacity }}
					className="flex-col items-center gap-y-4"
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
					className="flex-col items-center gap-y-4"
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
			<CalendarButton />
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
	position: Animated.AnimatedInterpolation<number> | Animated.Value;
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

	const tabPressHandlers = routes.map((_, i) => () => onIndexChange(i));

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
							onPress={tabPressHandlers[i]}
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
						onPress={tabPressHandlers[i]}
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

	// Track today's date and update at midnight
	const [today, setToday] = useState(() => new Date());

	useEffect(() => {
		const updateAtMidnight = () => {
			const now = new Date();
			const msUntilMidnight =
				new Date(
					now.getFullYear(),
					now.getMonth(),
					now.getDate() + 1,
				).getTime() - now.getTime();

			const timeoutId = setTimeout(() => {
				setToday(new Date());
			}, msUntilMidnight);

			return timeoutId;
		};

		const timeoutId = updateAtMidnight();

		return () => clearTimeout(timeoutId);
	}, []);

	const dates = getDateRange(today);
	const routes = createRoutes(dates);

	const initialIndex = (() => {
		if (params.date === "live") {
			return routes.length - 1;
		}
		if (params.date) {
			const idx = routes.findIndex((r) => r.key === params.date);
			if (idx >= 0) return idx;
		}
		return getTodayTabIndex();
	})();

	const [index, setIndex] = useState(initialIndex);

	// Animated position for web tab indicator (native uses TabView's position)
	const webAnimatedPosition = useRef(new Animated.Value(initialIndex)).current;

	// Sync index state when params.date changes (e.g., from deep link or browser navigation)
	useEffect(() => {
		setIndex(initialIndex);
	}, [initialIndex]);

	const handleIndexChange = useCallback(
		(newIndex: number) => {
			// Animate tab indicator on web
			if (isWeb) {
				Animated.spring(webAnimatedPosition, {
					toValue: newIndex,
					useNativeDriver: true,
					tension: 300,
					friction: 30,
				}).start();
			}

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
		[routes, router, webAnimatedPosition],
	);

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

	const containerWidth = isWeb ? Math.min(layout.width, 800) : layout.width;
	const calendarButtonWidth = containerWidth / 7;

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

	// Get current route for web rendering
	const currentRoute = routes[index];

	// On web, render tab bar and content directly (no pager = no fixed height issues)
	if (isWeb) {
		return (
			<View>
				{/* Shadow bar that spans the full width - transparent so tabs show through */}
				<View
					className="absolute left-0 right-0 h-12 z-20 shadow-sha-01 dark:shadow-sha-06"
					style={{ backgroundColor: "transparent" }}
					pointerEvents="none"
				/>
				<CalendarBarButtonScreen containerWidth={containerWidth} />
				{/* Tab bar */}
				<CustomTabBar
					routes={routes}
					position={webAnimatedPosition}
					onIndexChange={handleIndexChange}
					today={today}
					containerWidth={containerWidth}
					calendarButtonWidth={calendarButtonWidth}
				/>
				{/* Content - rendered directly, not through pager */}
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

	// On native, use TabView with pager for swipe gestures
	return (
		<View className="flex-1">
			{/* Shadow bar that spans the full width - transparent so tabs show through */}
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

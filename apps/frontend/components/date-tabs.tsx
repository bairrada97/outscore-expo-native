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
import { useState } from "react";
import { Dimensions, Pressable, useWindowDimensions, View } from "react-native";
import { type SceneRendererProps, TabView } from "react-native-tab-view";
import { CalendarButton } from "./calendar-button";
import { FixturesScreen } from "./fixtures-screen";
import { Text } from "./ui/text";

interface DateRoute {
	key: string;
	title: string;
	date?: Date;
}

interface CalendarBarDayProps {
	date: Date;
	isActive: boolean;
	isToday: boolean;
	onPress: () => void;
}

function CalendarBarDay({
	date,
	isActive,
	isToday,
	onPress,
}: CalendarBarDayProps) {
	const textColorClass = cn(
		isActive && "text-neu-01",
		!isActive && isToday && "text-m-01 dark:text-m-01-light-04",
		!isActive && !isToday && "text-neu-09/70 dark:text-neu-06",
	);

	return (
		<Pressable
			onPress={onPress}
			className={cn(
				"flex-1 items-center justify-center overflow-hidden",
				isActive && "bg-m-01",
				!isActive && "bg-neu-01 dark:bg-neu-11",
			)}
		>
			<Text variant="highlight-01" className={textColorClass}>
				{format(date, "d")}
			</Text>
			<Text variant="caption-02" className={cn("uppercase", textColorClass)}>
				{isToday ? "Today" : format(date, "EEE")}
			</Text>
		</Pressable>
	);
}

interface LiveTabProps {
	isActive: boolean;
	onPress: () => void;
}

function LiveTab({ isActive, onPress }: LiveTabProps) {
	return (
		<Pressable
			onPress={onPress}
			className={cn(
				"flex-1 items-center justify-center",
				isActive && "bg-m-01",
				!isActive && "bg-neu-01 dark:bg-neu-11",
			)}
		>
			<Text
				variant="caption-01"
				className={cn(
					"uppercase",
					isActive && "text-neu-01",
					!isActive && "text-m-01",
				)}
			>
				{LIVE_BUTTON_LABEL}
			</Text>
		</Pressable>
	);
}

export const CalendarBarButtonScreen = () => {
	const screenWidth = Dimensions.get("screen").width;

	return (
		<View
			className={cn(
				"absolute left-0 z-10 flex h-48 flex-row items-center justify-start dark:bg-neu-11 dark:shadow-sha-06 box-border bg-neu-01 shadow-sha-01",
			)}
			style={{
				width: (isWeb ? 800 : screenWidth) / 7,
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
	index: number;
	onIndexChange: (index: number) => void;
	today: Date;
}

function CustomTabBar({ routes, index, onIndexChange, today }: TabBarProps) {
	const screenWidth = Dimensions.get("screen").width;

	return (
		<View
			className="flex-row items-stretch h-12"
			style={{
				marginLeft: (isWeb ? 800 : screenWidth) / 7,
			}}
		>
			{routes.map((route, i) => {
				const isActive = i === index;
				const isLive = route.key === "live";
				const isToday = !isLive && !!route.date && isSameDay(route.date, today);

				if (isLive) {
					return (
						<LiveTab
							key={route.key}
							isActive={isActive}
							onPress={() => onIndexChange(i)}
						/>
					);
				}

				if (!route.date) return null;

				return (
					<CalendarBarDay
						key={route.key}
						date={route.date}
						isActive={isActive}
						isToday={isToday}
						onPress={() => onIndexChange(i)}
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

	const today = new Date();
	const dates = getDateRange(today);
	const routes = createRoutes(dates);

	function getInitialIndex(): number {
		if (params.date === "live") {
			return routes.length - 1;
		}
		if (params.date) {
			const idx = routes.findIndex((r) => r.key === params.date);
			if (idx >= 0) return idx;
		}
		return getTodayTabIndex();
	}

	const [index, setIndex] = useState(getInitialIndex);

	function handleIndexChange(newIndex: number) {
		setIndex(newIndex);

		if (isWeb) {
			const route = routes[newIndex];
			if (route) {
				router.setParams({ date: route.key });
			}
		}
	}

	function renderScene({ route }: SceneRendererProps & { route: DateRoute }) {
		if (route.key === "live") {
			return <FixturesScreen date={formatDateForApi(today)} live />;
		}
		return <FixturesScreen date={route.key} />;
	}

	const containerWidth = isWeb ? Math.min(layout.width, 800) : layout.width;
	const calendarButtonWidth = containerWidth / 7;
	const tabViewWidth = containerWidth - calendarButtonWidth;

	return (
		<View className={isWeb ? "" : "flex-1"}>
			<CalendarBarButtonScreen />
			<View>
				<TabView
					navigationState={{ index, routes }}
					renderScene={renderScene}
					onIndexChange={handleIndexChange}
					renderTabBar={() => (
						<CustomTabBar
							routes={routes}
							index={index}
							onIndexChange={handleIndexChange}
							today={today}
						/>
					)}
					swipeEnabled={!isWeb}
					lazy
					lazyPreloadDistance={1}
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

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
import { Pressable, Text, useWindowDimensions, View } from "react-native";
import { type SceneRendererProps, TabView } from "react-native-tab-view";
import { CalendarButton } from "./calendar-button";
import { FixturesScreen } from "./fixtures-screen";

interface DateRoute {
	key: string;
	title: string;
	date?: Date;
}

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
	return (
		<View className="flex-row items-stretch h-12 bg-neu-02 border-b border-neu-04">
			{routes.map((route, i) => {
				const isActive = i === index;
				const isLive = route.key === "live";
				const isToday = !isLive && route.date && isSameDay(route.date, today);

				return (
					<Pressable
						key={route.key}
						onPress={() => onIndexChange(i)}
						className={cn(
							"flex-1 items-center justify-center",
							isActive && "border-b-2 border-m-01",
						)}
					>
						<Text
							className={cn(
								"text-xs font-semibold uppercase",
								isActive && !isLive && "text-m-01",
								isActive && isLive && "text-red",
								!isActive && "text-neu-07",
							)}
						>
							{route.title}
						</Text>
						{!isLive && route.date && (
							<Text
								className={cn(
									"text-[10px]",
									isActive ? "text-m-01" : "text-neu-06",
								)}
							>
								{format(route.date, "d")}
							</Text>
						)}
						{isToday && (
							<View
								className={cn(
									"absolute bottom-1 w-1 h-1 rounded-full",
									isActive ? "bg-m-01" : "bg-neu-06",
								)}
							/>
						)}
					</Pressable>
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

	const calendarButtonWidth = 52;
	const tabViewWidth = layout.width - calendarButtonWidth;

	return (
		<View className={isWeb ? "flex-row" : "flex-1 flex-row"}>
			<CalendarButton
				onPress={() => {
					console.log("Calendar pressed");
				}}
			/>

			<View
				style={
					isWeb ? { width: tabViewWidth } : { flex: 1, width: tabViewWidth }
				}
			>
				<TabView
					navigationState={{ index, routes }}
					renderScene={renderScene}
					onIndexChange={handleIndexChange}
					initialLayout={{ width: tabViewWidth }}
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
					style={isWeb ? { flex: undefined } : undefined}
					sceneContainerStyle={isWeb ? { position: "relative" } : undefined}
				/>
			</View>
		</View>
	);
}

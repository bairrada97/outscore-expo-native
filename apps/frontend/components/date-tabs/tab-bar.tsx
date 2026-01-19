import { cn } from "@/lib/utils";
import { LIVE_BUTTON_LABEL } from "@/utils/constants";
import { formatDateForApi } from "@/utils/date-utils";
import { format, isSameDay } from "date-fns";
import { useMemo } from "react";
import { type Animated, View } from "react-native";
import { CalendarButton } from "../calendar-button";
import type { DateRoute } from "./types";
import { TabIndicator } from "./tab-indicator";
import { CalendarBarDay, LiveTab } from "./tab-items";

export function createDateRoutes(dates: Date[]): DateRoute[] {
	const routes: DateRoute[] = dates.map((date) => ({
		key: formatDateForApi(date),
		title: format(date, "EEE"),
		date,
	}));

	routes.push({ key: "live", title: LIVE_BUTTON_LABEL });
	return routes;
}

interface CalendarBarButtonScreenProps {
	containerWidth: number;
}

export function CalendarBarButtonScreen({
	containerWidth,
}: CalendarBarButtonScreenProps) {
	const calendarButtonWidth = containerWidth / 7;

	return (
		<View
			className={cn(
				"absolute left-0 z-10 flex h-48 flex-row items-center justify-start dark:bg-neu-11 box-border bg-neu-01",
			)}
			style={{ width: calendarButtonWidth }}
		>
			<CalendarButton />
		</View>
	);
}

interface DateTabsTabBarProps {
	routes: DateRoute[];
	position: Animated.AnimatedInterpolation<number> | Animated.Value;
	onIndexChange: (index: number) => void;
	today: Date;
	containerWidth: number;
	calendarButtonWidth: number;
}

export function DateTabsTabBar({
	routes,
	position,
	onIndexChange,
	today,
	containerWidth,
	calendarButtonWidth,
}: DateTabsTabBarProps) {
	const tabBarWidth = useMemo(
		() => containerWidth - calendarButtonWidth,
		[containerWidth, calendarButtonWidth],
	);
	const tabWidth = useMemo(
		() => tabBarWidth / routes.length,
		[tabBarWidth, routes.length],
	);

	const tabPressHandlers = useMemo(
		() => routes.map((_, i) => () => onIndexChange(i)),
		[routes, onIndexChange],
	);

	return (
		<View
			className="flex-row items-stretch h-12 relative bg-neu-01 dark:bg-neu-11"
			style={{ marginLeft: calendarButtonWidth }}
		>
			<TabIndicator
				position={position as Animated.AnimatedInterpolation<number>}
				routes={routes}
				tabWidth={tabWidth}
			/>

			{routes.map((route, i) => {
				const isLive = route.key === "live";
				const isToday = !isLive && !!route.date && isSameDay(route.date, today);

				if (isLive) {
					return (
						<LiveTab
							key={route.key}
							tabIndex={i}
							position={position as Animated.AnimatedInterpolation<number>}
							label={LIVE_BUTTON_LABEL}
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
						position={position as Animated.AnimatedInterpolation<number>}
						isToday={isToday}
						onPress={tabPressHandlers[i]}
					/>
				);
			})}
		</View>
	);
}


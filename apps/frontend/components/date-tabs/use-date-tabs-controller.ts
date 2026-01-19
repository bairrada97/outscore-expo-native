import { useSelectedDate } from "@/context/selected-date-context";
import { usePrefetchFixtures } from "@/hooks/usePrefetchFixtures";
import { formatDateForApi, getDateRange, getTodayTabIndex } from "@/utils/date-utils";
import { isWeb } from "@/utils/platform";
import { useGlobalSearchParams, useRouter } from "expo-router";
import {
	startTransition,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { Animated, useWindowDimensions } from "react-native";
import { createDateRoutes } from "./tab-bar";
import type { DateRoute } from "./types";

export function useDateTabsController() {
	const layout = useWindowDimensions();
	const router = useRouter();
	const params = useGlobalSearchParams<{ date?: string }>();
	const { setSelectedDate } = useSelectedDate();

	usePrefetchFixtures();

	const [today, setToday] = useState(() => new Date());
	useEffect(() => {
		const now = new Date();
		const msUntilMidnight =
			new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() -
			now.getTime();
		const timeoutId = setTimeout(() => setToday(new Date()), msUntilMidnight);
		return () => clearTimeout(timeoutId);
	}, []);

	const dates = useMemo(() => getDateRange(today), [today]);
	const routes = useMemo<DateRoute[]>(() => createDateRoutes(dates), [dates]);

	const initialIndex = useMemo(() => {
		if (params.date === "live") return routes.length - 1;
		if (params.date) {
			const idx = routes.findIndex((r) => r.key === params.date);
			if (idx >= 0) return idx;
		}
		return getTodayTabIndex();
	}, [params.date, routes]);

	const [index, setIndex] = useState(initialIndex);
	const webAnimatedPosition = useRef(new Animated.Value(initialIndex)).current;

	useEffect(() => {
		setIndex(initialIndex);
	}, [initialIndex]);

	const handleIndexChange = useCallback(
		(newIndex: number) => {
			if (isWeb) {
				Animated.spring(webAnimatedPosition, {
					toValue: newIndex,
					useNativeDriver: true,
					tension: 300,
					friction: 30,
				}).start();
			}

			startTransition(() => {
				setIndex(newIndex);

				const route = routes[newIndex];
				if (route) {
					const selected =
						route.key === "live" ? formatDateForApi(today) : route.key;
					setSelectedDate(selected);
				}

				if (isWeb && route) {
					router.setParams({ date: route.key });
				}
			});
		},
		[routes, router, setSelectedDate, today, webAnimatedPosition],
	);

	const containerWidth = useMemo(
		() => (isWeb ? Math.min(layout.width, 800) : layout.width),
		[layout.width],
	);
	const calendarButtonWidth = useMemo(() => containerWidth / 7, [containerWidth]);
	const currentRoute = routes[index];

	useEffect(() => {
		const route = routes[index];
		if (!route) return;
		const selected = route.key === "live" ? formatDateForApi(today) : route.key;
		setSelectedDate(selected);
	}, [index, routes, setSelectedDate, today]);

	return {
		today,
		routes,
		index,
		currentRoute,
		containerWidth,
		calendarButtonWidth,
		webAnimatedPosition,
		handleIndexChange,
	};
}


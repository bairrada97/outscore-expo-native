import {Dimensions, useWindowDimensions, View, Animated } from 'react-native'

import { ReactNode, useEffect, useState, useMemo, useCallback, memo } from 'react'
import { TabView, SceneMap, TabBarProps, Route, TabBar, TabDescriptor } from 'react-native-tab-view';
import { format } from 'date-fns'
import { useGlobalSearchParams, useLocalSearchParams, useRouter } from 'expo-router';
import { Text } from '@/components/ui/text';
import { isWeb } from '@gluestack-ui/nativewind-utils/IsWeb';
import { LIVE_BUTTON_LABEL } from '@/utils/constants';
import SvgB021 from '@/components/ui/SvgIcons/B021';
import { CalendarBarButton } from '@/components/CalendarBarButton/CalendarBarButton';
import SvgB022 from '@/components/ui/SvgIcons/B022';
import { cn } from '@/utils/misc';
import FixturesHomeScreen from '@/components/FixturesHomeScreen/FixturesHomeScreen';
import { getDateRange, getInitialTabIndex } from '@/utils/date-utils';
import { LinearGradient } from 'expo-linear-gradient';

type CustomRoute = Route & {
  key: string;
  title: string;
  weekDay: string | null;
  date: Date | null;
}

export const CalendarBarButtonScreen = () => {
	const screenWidth = Dimensions.get('screen').width

	return (
		<View
			className={cn(
				'absolute left-0 z-10 flex h-48 flex-row items-center justify-start dark:bg-neu-11 dark:shadow-sha-06 box-border bg-neu-01 shadow-sha-01',
			)}
			style={{
				width: (isWeb ? 800 : screenWidth) / 7,
			}}
		>
			<CalendarBarButton
				icon={<SvgB022 width={24} height={24} className="text-m-01" />}
				onPress={() => {}}
			/>
		</View>
	)
}

// Memoized fixture screen component
const MemoizedFixturesScreen = memo(FixturesHomeScreen);

// Create a custom gradient component
const GradientIndicator = memo(({ style }: { style: any }) => (
  <LinearGradient
    colors={['rgb(24,124,86)', 'rgb(38,151,108)']}
    start={{ x: 0, y: 0 }}
    end={{ x: 1, y: 0 }}
    style={[style]}
  />
));

export default function HomeScreen() {
	const { date } = useGlobalSearchParams()

	const router = useRouter()
	const layout = useWindowDimensions();

	const todayDate = new Date();
	const isLive = date === 'live'
	const currentDate = isLive ? 'live' : date ? new Date(date as string) : todayDate;
	
	// Use the utility function to get the date range
	const dates = getDateRange(todayDate); 

	// Use the utility function to get the initial tab index
	const initialIndex = getInitialTabIndex(currentDate, todayDate);
	const [index, setIndex] = useState(initialIndex);
	
	// Memoize the tabs array to prevent recreating on each render
	const tabs = useMemo<CustomRoute[]>(() => [
		...dates.map((date, index) => ({
		  key: `tab-${index}`,
		  title: format(date, 'EEE'),
		  weekDay: format(date, 'd'),
		  date
		})),
		{
		  key: 'tab-live',
		  title: LIVE_BUTTON_LABEL,
		  weekDay: null,
		  date: null
		}
	], [dates]);

	const [routes] = useState<CustomRoute[]>(tabs);

	// Add state to track if navigation is in progress
	const [isNavigating, setIsNavigating] = useState(false);
	
	// Improve the tab change handler with debouncing and navigation state
	const handleIndexChange = useCallback((newIndex: number) => {
		
		setIndex(newIndex);

    if (newIndex === 5) {
      router.setParams({ date: "live" });
    } else {
      const selectedDate = dates[newIndex];
      router.setParams({ date: format(selectedDate, 'yyyy-MM-dd') });
    }
	
	}, [dates, router, isNavigating]);

	// Memoize the tab bar render function with improved press handling
	const renderTabBar = useCallback((props: TabBarProps<CustomRoute>) => {
		const inputRange = props.navigationState.routes.map((_, i) => i);
		const translateX = props.position.interpolate({
			inputRange,
			outputRange: inputRange.map(i => i * ((isWeb ? 800 : layout.width) / 7)),
		});

		return (
			<View style={{ position: 'relative' }}>
				<View
					style={{
						position: 'absolute',
						left: (isWeb ? 800 : layout.width) / 7,
						top: 0,
						height: 48,
						width: (isWeb ? 800 : layout.width) * 6 / 7,
						backgroundColor: 'white',
						zIndex: 1
					}}
				/>
				<Animated.View
					style={{
						position: 'absolute',
						left: (isWeb ? 800 : layout.width) / 7,
						top: 0,
						height: 48,
						width: (isWeb ? 800 : layout.width) / 7,
						transform: [{ translateX }],
						zIndex: 2
					}}
				>
					<LinearGradient
						colors={['rgb(38,151,108)', 'rgb(106,184,69)']}
						start={{ x: 0, y: 0 }}
						end={{ x: 1, y: 0 }}
						style={{
							height: '100%',
							width: '100%',
						}}
					/>
				</Animated.View>
				<View
					style={{
						position: 'absolute',
						left: (isWeb ? 800 : layout.width) / 7,
						bottom: 0,
						height: 10,
						width: (isWeb ? 800 : layout.width) * 6 / 7,
						backgroundColor: 'transparent',
						shadowColor: 'rgb(19, 20, 19)',
						shadowOffset: { width: 0, height: 5 },
						shadowOpacity: 0.12,
						shadowRadius: 10,
						elevation: 5,
						zIndex: 3
					}}
				/>
				<TabBar
					{...props}
					style={{
						shadowColor: 'rgb(19, 20, 19)',
						shadowOffset: { width: 0, height: 5 },
						shadowOpacity: 0.12,
						shadowRadius: 10,
						elevation: 5,
						left: (isWeb ? 800 : layout.width) / 7,
						height: 48,
						backgroundColor: 'transparent',
						position: 'relative',
						zIndex: 10
					}}
					indicatorStyle={{
						backgroundColor: 'transparent',
						height: 0
					}}
					contentContainerStyle={{
						overflow: 'hidden',
					}}
					tabStyle={{
						width: (isWeb ? 800 : layout.width) / 7,
						padding: 0,
						alignContent: 'center',
						marginHorizontal: 0,
						marginVertical: 0,
						borderLeftWidth: 1,
						borderLeftColor: 'rgb(218,221,219)'
					}}
					pressColor='transparent'
					pressOpacity={1}
					activeColor='white'
					inactiveColor='rgba(94,103,99, 0.7)'
				/>
			</View>
		);
	}, [layout.width, isNavigating]);

	// Memoize the scene map
	const renderScene = useMemo(() => 
		SceneMap(
			routes.reduce<Record<string, () => ReactNode>>((scenes, route) => {
				scenes[route.key] = () => {
					if (route.key === 'tab-live') {
						return <MemoizedFixturesScreen day="live" />;
					} else {
						const formattedDate = route.date ? format(route.date, 'yyyy-MM-dd') : '';
						return <MemoizedFixturesScreen day={formattedDate} />;
					}
				};
				return scenes;
			}, {})
		),
		[routes]
	); 

	// Memoize common options
	const commonOptions = useMemo((): TabDescriptor<CustomRoute> => ({
		icon: ({ route, focused, color }) => {
			if(route.title === LIVE_BUTTON_LABEL) {
				return <SvgB021
					width={24}
					height={24}
					className={focused ? 'text-neu-01' : 'text-m-01'}
					color={focused ? 'white' : 'rgb(24,124,86)'}
				/>;
			}
			return (
				<Text
					style={{
						color,
						fontSize: 20,
						alignItems: 'center',
						textAlign: 'center',
						marginHorizontal: 0,
						marginVertical: 0,
					}}
				>
					{route.weekDay}
				</Text>
			);
		},
		label: ({route, focused, color}) => (
			<Text
				style={{
					color: focused ? 'white' : 'rgba(94,103,99,0.7)',
					textAlign: 'center',
					fontSize: 12,
					fontWeight: 'regular',
					textTransform: 'uppercase',
					alignItems: 'center',
					marginHorizontal: 0,
					marginVertical: 0,
				}}
			>
				{route.title}
			</Text>
		),
	}), []);

	return (
		<View style={{ height: "100%", flexDirection: 'row' }}>
			<CalendarBarButtonScreen/>
			<View style={{ flex: 1 }}>
				<TabView
					navigationState={{ index, routes }}
					renderScene={renderScene}
					onIndexChange={handleIndexChange}
					initialLayout={{ width: layout.width - (layout.width / 7) }}
					swipeEnabled={!isWeb}
					commonOptions={commonOptions}
					renderTabBar={renderTabBar}
					pagerStyle={{ zIndex: -1 }}
				/>
			</View>
		</View>
	);
}


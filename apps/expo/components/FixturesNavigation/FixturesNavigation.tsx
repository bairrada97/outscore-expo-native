import { useDatePicker } from '@/hooks/useDatePicker'
import { calendarBarDaysAtom } from '@/store/datepicker-store'
import { useAtomValue } from 'jotai'
import { useEffect, useMemo, useState } from 'react'
import { Dimensions } from 'react-native'
import { LIVE_BUTTON_LABEL } from '@/utils/constants'
import SvgB021 from '../ui/SvgIcons/B021'
import { Text } from '../ui/text'
import { isWeb } from '@gluestack-ui/nativewind-utils/IsWeb'
import { router, useGlobalSearchParams, useNavigation } from 'expo-router'
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs'
import FixturesHomeScreen from '../FixturesHomeScreen/FixturesHomeScreen'
import { useTimeZone } from '@/context/timezone-context'
import { NavigationContainer } from '@react-navigation/native'

const { Navigator, Screen, Group } = createMaterialTopTabNavigator()

export default function FixturesNavigation() {
	const { date } = useGlobalSearchParams()

	const calendarBarDays = useAtomValue(calendarBarDaysAtom)
	const { numericDay, weekDayShort } = useDatePicker()
	const screenWidth = Dimensions.get('screen').width

	return (
		<>
			{/* <CalendarBarButtonScreen /> */}
			<Navigator
				initialLayout={{
					width: isWeb ? 800 : screenWidth,
					height: 48,
				}}
				screenOptions={{
					swipeEnabled: !isWeb,
					lazy: true,
					lazyPreloadDistance: 1,
					tabBarContentContainerStyle: {
						left: (isWeb ? 800 : screenWidth) / 7,
						overflow: 'hidden',
					},
					tabBarStyle: {
						elevation: 5,
						shadowColor: 'rgb(19, 20, 19)',
						shadowOffset: { width: 0, height: 5 },
						shadowOpacity: 0.12,
						shadowRadius: 10,
					},
					tabBarIndicatorStyle: {
						left: (isWeb ? 800 : screenWidth) / 7,
						height: '100%',
						backgroundColor: 'rgb(24,124,86)',
					},
					tabBarInactiveTintColor: 'rgba(94,103,99, 0.7)',
					tabBarActiveTintColor: 'white',
					tabBarItemStyle: {
						width: (isWeb ? 800 : screenWidth) / 7,
						padding: 0,
						alignContent: 'center',
						marginHorizontal: 0,
						marginVertical: 0,
					},
					tabBarPressColor: 'transparent',
					tabBarPressOpacity: 0,
				}}
			>
				{calendarBarDays.map((day, index) => {
					return (
						<Screen
							key={day}
							name={`${day}`}
							options={{
								tabBarLabel: ({ focused, color }) => (
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
										{weekDayShort(new Date(day))}
									</Text>
								),
								tabBarIcon: ({ focused, color }) => (
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
										{numericDay(new Date(day))}
									</Text>
								),
							}}
						>
							{() => <FixturesHomeScreen day={day} />}
						</Screen>
					)
				})}

				<Screen
					key={5}
					name={`live`}
					initialParams={{ date: 'live' }}
					options={{
						tabBarLabel: ({ focused, color }) => (
							<Text
								style={{
									color: focused ? 'white' : 'rgb(24,124,86)',
									textAlign: 'center',
									fontSize: 12,
									fontWeight: 600,
									textTransform: 'uppercase',
									alignItems: 'center',
									marginHorizontal: 0,
									marginVertical: 0,
								}}
							>
								{LIVE_BUTTON_LABEL}
							</Text>
						),
						tabBarIcon: ({ focused }) => (
							<SvgB021
								width={24}
								height={24}
								className={focused ? 'text-neu-01' : 'text-m-01'}
								color={focused ? 'white' : 'rgb(24,124,86)'}
							/>
						),
					}}
				>
					{() => <FixturesHomeScreen day={'live'} />}
				</Screen>
			</Navigator>
		</>
	)
}

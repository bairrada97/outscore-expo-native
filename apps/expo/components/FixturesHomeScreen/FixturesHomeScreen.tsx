import React, { memo, useState } from 'react'
import { View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { useTimeZone } from '@/context/timezone-context'
import { useAtomValue } from 'jotai'
import { todaysDateAtom } from '@/store/datepicker-store'
import { LoadingIndicator } from '@/components/ui/loading-indicator'
import { useRefreshByUser } from '@/hooks/useRefreshByUser'
import { useRefreshOnFocus } from '@/hooks/useRefetchOnFocus'
import { fixturesByDateQuery } from '@/queries/fixture-by-date-query'
import FixturesByDate from '../FixturesByDate/FixturesByDate'
import { Text } from '@/components/ui/text'
import { format } from 'date-fns'

export default function FixturesHomeScreen({ day }: { day: string }) {
	const { timeZone } = useTimeZone()
	
	// If we're on the "live" tab, use today's date
	const queryDate = day === 'live' 
		? format(new Date(), 'yyyy-MM-dd')
		: day
	
	// Use the optimized query configuration from fixturesByDateQuery
	const queryOptions = fixturesByDateQuery({
		date: queryDate,
		timezone: timeZone || undefined
	}) 
	
	const { isPending, isError, error, data, refetch } = useQuery({
		...queryOptions,
		enabled: !!timeZone,
	})

	const { isRefetchingByUser, refetchByUser } = useRefreshByUser(refetch)
	useRefreshOnFocus(refetch)

	if (isPending) {
		// We should never see this since we're prefetching data
		// but we need to handle the case just in case
		return <LoadingIndicator />
	}
	
	if (isError) {
		return (
			<View className="flex-1 items-center justify-center">
				<Text>Error loading fixtures: {error?.message}</Text>
			</View>
		)
	}

	return <FixturesByDate data={data || []} />
} 

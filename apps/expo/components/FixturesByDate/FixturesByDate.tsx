import { useQuery } from '@tanstack/react-query'
import React, { memo, useMemo } from 'react'
import { Dimensions, ScrollView, SectionList, View } from 'react-native'
import {TitleSection} from '../ui/title-section'
import FixturesList from '../FixturesList/FixturesList'
import { Text } from '../ui/text'
import { FavoriteFixtureList } from '../FavoriteFixtureList/FavoriteFixtureList'
import { FormattedCountry, FormattedLeague, FormattedMatch } from '../../../../packages/shared-types'



export default function FixturesByDate({
	data,
	groupBy = true,
}: {
	data: FormattedCountry[]; // Use shared type
	groupBy?: boolean;
}) {

	if (!data || data.length === 0) {
		return (
			<ScrollView className="bg-neu-02 pt-16">
				<View className="flex-1 items-center justify-center py-40">
					<Text>No fixtures available for this date</Text>
				</View>
			</ScrollView>
		);
	}

	return (
		<>
			<ScrollView className="bg-neu-02 pt-16">
				<TitleSection>Favorite Competitions</TitleSection>
				<View className="px-16">
					<FavoriteFixtureList data={data} />
				</View>
				<TitleSection>All Competitions</TitleSection>
				<View className="px-16">
					<FixturesList data={data} />
				</View>
			</ScrollView>
		</>
	)
}

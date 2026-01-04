import { FormattedCountry, FormattedLeague } from '@outscore/shared-types'
import { CardMatch } from '../CardMatch/CardMatch'
import { CardsBlock } from '../CardsBlock/CardsBlock'
import { NoResultsBox } from '../NoResultsBox/NoResultsBox'
import { View } from 'react-native'

const List = ({ data, groupBy }: { data: FormattedLeague[]; groupBy?: boolean }) => {
	return (
		<View>
			{ data?.map((leagues, index: number) => {
						return (
							<CardsBlock
								key={leagues.name + index}
								title={leagues.name}
							>
								{leagues.matches.map((match) => {
									return (
										<CardMatch
											key={match.id}
											fixture={match}
											isLastMatch={false}
										/>
									)
								})}
							</CardsBlock>
						)
					})}
		</View>
	)
}

export const FavoriteFixtureList = ({
	data,
	groupBy = true,
}: {
	data: FormattedCountry[]
	groupBy?: boolean
}) => {
	const favoriteLeaguesID = [1, 2, 3, 5, 94, 39, 88, 140, 135, 61, 78, 743, 960, 858, 10, 34]
 
	let formatFavoriteData: FormattedLeague[] = []
	if (groupBy) {
		formatFavoriteData = data
			?.map((country) => country.leagues)
			.flat(1)
			?.filter((league: FormattedLeague) => 
				favoriteLeaguesID.includes(league.id)				
			)

	 }
	 // else {
	// 	formatFavoriteData = data.reduce((acc: any, match: FixtureOverview) => {
	// 		acc[match.league.name] = acc[match.league.name] || []
	// 		acc[match.league.name]?.push(match)

	// 		return acc
	// 	}, {}) as any
	// }

	return (
		<View>
			{Object.keys(formatFavoriteData).length ? (
				Array(formatFavoriteData).length ? (
					<List data={formatFavoriteData} groupBy={groupBy} />
					
				) : true ? (
					<NoResultsBox text="There are no ongoing matches on your favorite competitions." />
				) : (
					<NoResultsBox text="There are no matches happening today on your favorite competitions." />
				)
			) : (
				<NoResultsBox
					text="You don’t have any favorite competitions yet."
					ctaText="Search more teams to follow"
				/>
			)}
		</View>
	)
}

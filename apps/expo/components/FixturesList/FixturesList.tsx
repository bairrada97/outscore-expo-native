import { CardMatch } from '../CardMatch/CardMatch'
import { CardsBlock } from '../CardsBlock/CardsBlock'
import CountryItem from '../CountryItem/CountryItem'
import { View, Platform } from 'react-native'
import { LegendList } from '@legendapp/list'
import { Text } from '../ui/text'
import { memo, useCallback, useMemo, useState } from 'react'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion'
import { FormattedCountry, FormattedMatch } from '@outscore/shared-types'
import Animated, { LinearTransition } from 'react-native-reanimated'

type ItemProps = {
	item: FormattedCountry
}

// Memoize the Item component to prevent unnecessary re-renders
const Item = memo(({ item }: ItemProps) => {
	// Calculate total matches and live matches
	const totalMatches = item.leagues.reduce((acc, league) => acc + league.matches.length, 0)
	const totalLiveMatches = item.leagues.reduce((acc, league) => {
		return acc + league.matches.filter(match => match.status?.elapsed !== null).length
	}, 0)

	return (
		<Animated.View layout={LinearTransition.duration(Platform.OS !== 'web' ? 300 : 0)}>
			<AccordionItem value={item.name}>
				<AccordionTrigger>
					<CountryItem
						image={item.flag?.toLowerCase() || item.name.toLowerCase()}
						name={item.name}
						totalMatches={totalMatches}
						totalLiveMatches={totalLiveMatches}
					/> 
				</AccordionTrigger> 
				<AccordionContent>
					{item.leagues.map(league => (
						<CardsBlock key={league.id} title={league.name}>
							{league.matches.map((match, index) => (
								<CardMatch
									key={match.id}
									fixture={match}
									isLastMatch={index === league.matches.length - 1}
								/>
							))}
						</CardsBlock>
					))}
				</AccordionContent>
			</AccordionItem>
		</Animated.View>
	)
})

export default function FixturesList({
	data,
	groupBy = true,
}: {
	data: FormattedCountry[]
	groupBy?: boolean
}) {
	const [itemSizes, setItemSizes] = useState<Record<string, number>>({});
	const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

	// Memoize the renderItem function
	const renderItem = useCallback(
		({ item }: { item: FormattedCountry }) => {
			return <Item item={item} />
		},
		[],
	)

	// Handle item size changes
	const handleItemSizeChanged = useCallback((info: { 
		size: number;
		previous: number;
		index: number;
		itemKey: string;
		itemData: FormattedCountry;
	}) => {
		setItemSizes(prev => ({
			...prev,
			[info.itemKey]: info.size
		}));
	}, []);

	// Calculate average item size for better estimation
	const averageItemSize = useMemo(() => {
		const sizes = Object.values(itemSizes);
		if (sizes.length === 0) return Platform.OS === 'web' ? 40 : 200;
		return Math.round(sizes.reduce((a, b) => a + b, 0) / sizes.length);
	}, [itemSizes]);

	// Handle accordion value changes
	const handleValueChange = useCallback((value: string[]) => {
		setExpandedItems(new Set(value));
	}, []);

	return (
		<View className="flex-1">
			<Accordion
				type="multiple"
				className="w-full"
				value={Array.from(expandedItems)}
				onValueChange={handleValueChange}
			>
				<LegendList
					data={data}
					renderItem={renderItem}
					keyExtractor={item => item.name}
					estimatedItemSize={averageItemSize}
					drawDistance={Platform.OS === 'web' ? 120 : 500}
					maintainVisibleContentPosition={true}
					
					waitForInitialLayout={Platform.OS !== 'web'}
					recycleItems={false}
				/>
			</Accordion>
		</View>
	)
}

import { LegendList, type LegendListRenderItemProps } from "@legendapp/list";
import { type FormattedCountry, isLiveStatus } from "@outscore/shared-types";
import type { ReactNode } from "react";
import { useCallback } from "react";
import { Platform, Text, View } from "react-native";
import { CountryItem } from "./country-item";
import { Accordion } from "./ui/accordion";

interface FixturesListProps {
	countries: FormattedCountry[];
	isLoading?: boolean;
	isRefetching?: boolean;
	onFixturePress?: (fixtureId: number) => void;
	listHeader?: ReactNode;
	resetKey?: string; // Key to force remount when switching tabs
}

interface ItemProps {
	item: FormattedCountry;
	onFixturePress?: (fixtureId: number) => void;
}

function Item({ item, onFixturePress }: ItemProps) {
	const totalMatches = item.leagues.reduce((acc, league) => acc + league.matches.length, 0);
	const totalLiveMatches = item.leagues.reduce((acc, league) => {
		return (
			acc +
			league.matches.filter((match) => isLiveStatus(match.status?.short))
				.length
		);
	}, 0);

	return (
		<CountryItem
			country={item}
			totalMatches={totalMatches}
			totalLiveMatches={totalLiveMatches}
			onFixturePress={onFixturePress}
		/>
	);
}

export function FixturesList({
	countries,
	isLoading,
	isRefetching,
	onFixturePress,
	listHeader,
	resetKey,
}: FixturesListProps) {
	const renderItem = useCallback(
		({ item }: LegendListRenderItemProps<FormattedCountry>) => (
			<Item item={item} onFixturePress={onFixturePress} />
		),
		[onFixturePress],
	);

	const keyExtractor = useCallback(
		(country: FormattedCountry) => country.name,
		[],
	);

	if (isLoading) {
		return (
			<View className="flex-1 items-center justify-center py-20">
				<Text className="mt-4 text-sm text-neu-07">Loading fixtures...</Text>
			</View>
		);
	}

	if (countries.length === 0) {
		return (
			<View className="flex-1 items-center justify-center py-20">
				<Text className="text-lg font-sans-semibold text-neu-08">
					No fixtures found
				</Text>
				<Text className="mt-2 text-sm text-neu-07">
					Try selecting a different date
				</Text>
			</View>
		);
	}

	// On web, render content directly to use native page scrolling
	if (Platform.OS === "web") {
		return (
			<View className="pb-24">
				{listHeader}
			
				<Accordion type="multiple" className="w-full">
					{countries.map((country) => (
						<Item
							key={country.name}
							item={country}
							onFixturePress={onFixturePress}
						/>
					))}
				</Accordion>
			</View>
		);
	}

	// On native, use LegendList for virtualization
	// Force complete remount by using resetKey + countries count in key
	// This ensures scroll position and content height reset when switching tabs
	const uniqueKey = resetKey
		? `${resetKey}-${countries.length}`
		: `fallback-${countries.length}`;

	return (
		<View key={`wrapper-${uniqueKey}`} className="flex-1">
			<Accordion
				key={`accordion-${uniqueKey}`}
				type="multiple"
				defaultValue={[]}
				className="w-full flex-1"
			>
				<LegendList
					key={`legend-${uniqueKey}`}
					data={countries}
					renderItem={renderItem}
					keyExtractor={keyExtractor}
					estimatedItemSize={80}
					initialContainerPoolRatio={2}
					drawDistance={500}
					recycleItems={false}
					showsVerticalScrollIndicator={false}
					style={{ flex: 1 }}
					contentContainerStyle={{ paddingBottom: 100 }}
					ListHeaderComponent={
						<>
							{listHeader}
						</>
					}
				/>
			</Accordion>
		</View>
	);
}

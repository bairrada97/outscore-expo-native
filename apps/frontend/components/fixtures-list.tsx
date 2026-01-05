import { LegendList, type LegendListRenderItemProps } from "@legendapp/list";
import { type FormattedCountry, isLiveStatus } from "@outscore/shared-types";
import { useCallback, useMemo } from "react";
import { Platform, Text, View } from "react-native";
import { CountryItem } from "./country-item";
import { Accordion } from "./ui/accordion";

interface FixturesListProps {
	countries: FormattedCountry[];
	timezone: string;
	isLoading?: boolean;
	isRefetching?: boolean;
	onFixturePress?: (fixtureId: number) => void;
}

interface ItemProps {
	item: FormattedCountry;
	timezone: string;
	onFixturePress?: (fixtureId: number) => void;
}

function Item({ item, timezone, onFixturePress }: ItemProps) {
	const totalMatches = useMemo(
		() => item.leagues.reduce((acc, league) => acc + league.matches.length, 0),
		[item.leagues],
	);
	const totalLiveMatches = useMemo(
		() =>
			item.leagues.reduce((acc, league) => {
				return (
					acc +
					league.matches.filter((match) => isLiveStatus(match.status?.short))
						.length
				);
			}, 0),
		[item.leagues],
	);

	return (
		<CountryItem
			country={item}
			timezone={timezone}
			totalMatches={totalMatches}
			totalLiveMatches={totalLiveMatches}
			onFixturePress={onFixturePress}
		/>
	);
}

export function FixturesList({
	countries,
	timezone,
	isLoading,
	isRefetching,
	onFixturePress,
}: FixturesListProps) {
	const renderItem = useCallback(
		({ item }: LegendListRenderItemProps<FormattedCountry>) => (
			<Item item={item} timezone={timezone} onFixturePress={onFixturePress} />
		),
		[timezone, onFixturePress],
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
				{isRefetching && <View className="py-2 items-center" />}
				<Accordion type="multiple" className="w-full">
					{countries.map((country) => (
						<Item
							key={country.name}
							item={country}
							timezone={timezone}
							onFixturePress={onFixturePress}
						/>
					))}
				</Accordion>
			</View>
		);
	}

	// On native, use LegendList for virtualization
	return (
		<View className="flex-1">
			<Accordion type="multiple" className="w-full">
				<LegendList
					data={countries}
					renderItem={renderItem}
					keyExtractor={keyExtractor}
					estimatedItemSize={200}
					drawDistance={500}
					recycleItems={false}
					showsVerticalScrollIndicator={false}
					contentContainerStyle={{ paddingBottom: 100 }}
					ListHeaderComponent={
						isRefetching ? <View className="py-2 items-center" /> : null
					}
				/>
			</Accordion>
		</View>
	);
}

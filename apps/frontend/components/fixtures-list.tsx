import { LegendList, type LegendListRef, type LegendListRenderItemProps } from "@legendapp/list";
import { type FormattedCountry, isLiveStatus } from "@outscore/shared-types";
import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform, Text, View } from "react-native";
import { CountryItem } from "./country-item";
import { Accordion } from "./ui/accordion";

interface FixturesListProps {
	countries: FormattedCountry[];
	isLoading?: boolean;
	isRefetching?: boolean;
	listHeader?: ReactNode;
	resetKey?: string; // Key to force remount when switching tabs
}

interface ItemProps {
	item: FormattedCountry;
}

function Item({ item }: ItemProps) {
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
		/>
	);
}

export function FixturesList({
	countries,
	isLoading,
	isRefetching,
	listHeader,
	resetKey,
}: FixturesListProps) {
	// keep prop for API parity (callers may pass it)
	void isRefetching;

	const listRef = useRef<LegendListRef | null>(null);
	const [expandedCountries, setExpandedCountries] = useState<string[]>([]);

	useEffect(() => {
		// Reset accordion expansion + scroll position when switching date/live tabs.
		// This is much cheaper than remounting the entire list tree.
		void resetKey;
		setExpandedCountries([]);
		listRef.current?.scrollToOffset?.({ offset: 0, animated: false });
	}, [resetKey]);

	const renderItem = useCallback(
		({ item }: LegendListRenderItemProps<FormattedCountry>) => (
			<Item item={item} />
		),
		[],
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
						<Item key={country.name} item={country} />
					))}
				</Accordion>
			</View>
		);
	}

	// On native, use LegendList for virtualization
	return (
		<View className="flex-1">
			<Accordion
				type="multiple"
				value={expandedCountries}
				onValueChange={(value: string[]) =>
					setExpandedCountries(Array.isArray(value) ? value : [])
				}
				className="w-full flex-1"
			>
				<LegendList
					ref={listRef}
					data={countries}
					renderItem={renderItem}
					keyExtractor={keyExtractor}
					estimatedItemSize={80}
					initialContainerPoolRatio={2}
					drawDistance={500}
					recycleItems={false}
					showsVerticalScrollIndicator={false}
					style={{ flex: 1 }}
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

import {
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import type { FormattedCountry } from "@outscore/shared-types";
import { View } from "react-native";
import { CardsBlock } from "./cards-block";
import { CountryDailyMatches } from "./country-daily-matches";
import { FixtureCard } from "./fixture-card";
import { SvgFlag } from "./svg-flag";
import { Text } from "./ui/text";

interface CountryItemProps {
	country: FormattedCountry;
	totalMatches: number;
	totalLiveMatches: number;
	onFixturePress?: (fixtureId: number) => void;
}

export function CountryItem({
	country,
	totalMatches,
	totalLiveMatches,
	onFixturePress,
}: CountryItemProps) {
	const leaguesContent = country.leagues.map((league, index) => (
		<CardsBlock
			key={`${league.id}-${index}`}
			title={league.name}
			cardsClassName="gap-0"
		>
			{league.matches.map((match, matchIndex) => (
				<FixtureCard
					key={match.id}
					fixture={match}
					isLastMatch={matchIndex === league.matches.length - 1}
					onPress={() => onFixturePress?.(match.id)}
				/>
			))}
		</CardsBlock>
	));

	return (
		<AccordionItem value={country.name} className="mb-0 border-0">
			<AccordionTrigger className="group/trigger relative h-40 min-h-40 flex-row items-center justify-between px-16 py-0 in-data-[state=expanded]:bg-linear-to-br in-data-[state=expanded]:from-m-01-light-01 in-data-[state=expanded]:to-m-02-dark-01 hover:no-underline">
				{/* Divider - full width minus 8px on each side, hidden when expanded */}
				<View className="absolute bottom-0 left-8 right-8 h-px bg-neu-03 dark:bg-neu-10 in-data-[state=expanded]:hidden" />
				<View className="flex-1 flex-row items-center gap-x-16">
					{/* Flag container with circular border */}
					<View
						className={cn(
							"relative h-24 w-24 items-center justify-center rounded-full",
							"shadow-sha-01 dark:shadow-sha-06",
						)}
					>
						{/* Outer border ring */}
						<View
							className={cn(
								"absolute -top-px -left-px h-[26px] w-[26px] rounded-full border-2",
								"border-neu-01 dark:border-neu-10",
								"in-data-[state=expanded]:border-m-01-light-03 in-data-[state=expanded]:shadow-sha-01",
								"dark:in-data-[state=expanded]:shadow-sha-06",
							)}
						/>
						{/* Flag image container */}
						<View className="absolute h-full w-full items-center justify-center overflow-hidden rounded-full">
							{/* Overlay for depth */}
							<View className="absolute inset-0 z-10 rounded-full bg-neu-10 opacity-[0.08]" />
							{country.flag ? (
								<SvgFlag uri={country.flag} size={24} />
							) : (
								<View className="h-full w-full items-center justify-center bg-neu-03 dark:bg-neu-09">
									<Text className="text-10 text-neu-06">🌍</Text>
								</View>
							)}
						</View>
					</View>

					{/* Country name */}
					<Text
						variant="body-01--semi"
						className="text-left text-neu-10 dark:text-neu-06 in-data-[state=expanded]:text-neu-01"
					>
						{country.name}
					</Text>
				</View>

				{/* Match count badge */}
				<CountryDailyMatches
					dailyMatchesLength={totalMatches}
					liveMatchesLength={totalLiveMatches}
				/>
			</AccordionTrigger>

			<AccordionContent className="pb-0 pt-8 px-8">
				{leaguesContent}
			</AccordionContent>
		</AccordionItem>
	);
}

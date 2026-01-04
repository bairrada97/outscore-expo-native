import {
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import type { FormattedCountry } from "@outscore/shared-types";
import { View } from "react-native";
import { CompetitionSection } from "./competition-section";
import { CountryDailyMatches } from "./country-daily-matches";
import { SvgFlag } from "./svg-flag";
import { Text } from "./ui/text";

interface CountryItemProps {
	country: FormattedCountry;
	timezone: string;
	totalMatches: number;
	totalLiveMatches: number;
	onFixturePress?: (fixtureId: number) => void;
}

export function CountryItem({
	country,
	timezone,
	totalMatches,
	totalLiveMatches,
	onFixturePress,
}: CountryItemProps) {
	// Use world icon for "World" country
	const isWorld = country.name === "World";

	return (
		<AccordionItem value={country.name} className="mb-0 border-0">
			<AccordionTrigger className="h-40 min-h-40 flex-row items-center justify-between border-b border-neu-03 px-16 py-0 data-[state=expanded]:bg-m-01 dark:border-neu-10 hover:no-underline">
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
								"data-[state=expanded]:border-m-01-light-03 data-[state=expanded]:shadow-sha-01",
								"dark:data-[state=expanded]:shadow-sha-06",
							)}
						/>
						{/* Flag image container */}
						<View className="absolute h-full w-full items-center justify-center overflow-hidden rounded-full">
							{/* Overlay for depth */}
							<View className="absolute inset-0 z-10 rounded-full bg-neu-10 opacity-[0.08]" />
							{country.flag && !isWorld ? (
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
						className="text-left text-neu-10 dark:text-neu-06"
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

			<AccordionContent className="pb-0">
				{country.leagues.map((league) => (
					<CompetitionSection
						key={league.id}
						league={league}
						timezone={timezone}
						onFixturePress={onFixturePress}
					/>
				))}
			</AccordionContent>
		</AccordionItem>
	);
}

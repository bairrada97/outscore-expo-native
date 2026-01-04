import {
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import type { FormattedCountry } from "@outscore/shared-types";
import { Image, Text, View } from "react-native";
import { CompetitionSection } from "./competition-section";

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
	return (
		<AccordionItem value={country.name} className="mb-1 border-0">
			<AccordionTrigger className="flex-row items-center justify-between px-3 py-3 bg-m-01 data-[state=open]:bg-m-01-dark-01">
				<View className="flex-row items-center flex-1">
					{country.flag ? (
						<Image
							source={{ uri: country.flag }}
							className="w-6 h-4 mr-3 rounded-sm"
							resizeMode="cover"
						/>
					) : (
						<View className="w-6 h-4 mr-3 bg-neu-05 rounded-sm" />
					)}
					<Text className="text-sm font-semibold text-neu-01">
						{country.name}
					</Text>
				</View>
				<View className="flex-row items-center gap-2">
					{totalLiveMatches > 0 && (
						<View className="bg-m-01-light-03 px-2 py-0.5 rounded-full">
							<Text className="text-xs font-semibold text-neu-01">
								{totalLiveMatches}
							</Text>
						</View>
					)}
					<View className="border border-neu-01/30 px-2 py-0.5 rounded-full">
						<Text className="text-xs font-medium text-neu-01">
							{totalMatches}
						</Text>
					</View>
				</View>
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

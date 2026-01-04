import type { FormattedLeague } from "@outscore/shared-types";
import { Image, Pressable, Text, View } from "react-native";
import { FixtureCard } from "./fixture-card";

interface CompetitionSectionProps {
  league: FormattedLeague;
  timezone: string;
  onFixturePress?: (fixtureId: number) => void;
}

export function CompetitionSection({ league, timezone, onFixturePress }: CompetitionSectionProps) {
  return (
    <View className="mb-2">
      {/* League header */}
      <Pressable className="flex-row items-center px-3 py-2 bg-neu-02 active:bg-neu-03">
        <Image
          source={{ uri: league.logo }}
          className="w-5 h-5 mr-2"
          resizeMode="contain"
        />
        <Text className="text-sm font-sans-regular text-neu-10 flex-1" numberOfLines={1}>
          {league.name}
        </Text>
      </Pressable>

      {/* Fixtures */}
      <View className="bg-neu-01">
        {league.matches.map((fixture) => (
          <FixtureCard
            key={fixture.id}
            fixture={fixture}
            timezone={timezone}
            onPress={() => onFixturePress?.(fixture.id)}
          />
        ))}
      </View>
    </View>
  );
}

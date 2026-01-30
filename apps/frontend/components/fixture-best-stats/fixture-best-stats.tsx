import { Text } from "@/components/ui/text";
import type { Fixture } from "@outscore/shared-types";
import { View } from "react-native";
import {
  BEST_STATS,
  calculateShare,
  findStatValue,
  formatNumber,
  POSSESSION_KEYS,
  type FixtureWithStatistics,
} from "./fixture-best-stats.helpers";

type StatCardProps = {
  label: string;
  homeValue: number | null;
  awayValue: number | null;
  precision: number;
};

function BestStatCard({
  label,
  homeValue,
  awayValue,
  precision,
}: StatCardProps) {
  const share = calculateShare(homeValue, awayValue);
  const safeHome = homeValue ?? 0;
  const safeAway = awayValue ?? 0;
  const homeIsHigher = safeHome > safeAway;
  const awayIsHigher = safeAway > safeHome;

  return (
    <View className="h-full rounded-lg bg-neu-01 px-16 py-16 shadow-sha-01 dark:bg-neu-11 dark:shadow-sha-06">
      <Text
        selectable
        variant="caption-03"
        className="mb-8 text-center uppercase text-neu-07 dark:text-neu-06"
      >
        {label}
      </Text>

      <View className="flex-row items-center justify-between">
        <Text
          selectable
          variant={homeIsHigher ? "highlight-02" : "body-02"}
          className={homeIsHigher ? "text-m-02" : "text-neu-07 dark:text-neu-06"}
        >
          {formatNumber(homeValue, precision)}
        </Text>
        <Text
          selectable
          variant={awayIsHigher ? "highlight-02" : "body-02"}
          className={awayIsHigher ? "text-m-02" : "text-neu-07 dark:text-neu-06"}
        >
          {formatNumber(awayValue, precision)}
        </Text>
      </View>

      <View className="mt-8 h-4 w-full flex-row overflow-hidden rounded-full bg-neu-03 dark:bg-neu-12">
        <View
          className={
            homeIsHigher
              ? "h-full bg-linear-to-l from-m-02-dark-01 to-m-02-light-02"
              : "h-full bg-linear-to-l from-neu-05 to-neu-06"
          }
          style={{ width: `${share.home}%` }}
        />
        <View
          className={
            awayIsHigher
              ? "h-full bg-linear-to-r from-m-02-dark-01 to-m-02-light-02"
              : "h-full bg-linear-to-r from-neu-06 to-neu-05"
          }
          style={{ width: `${share.away}%` }}
        />
      </View>
    </View>
  );
}

type FixtureBestStatsProps = {
  fixture: Fixture;
};

export function FixtureBestStats({ fixture }: FixtureBestStatsProps) {
  const stats = (fixture as FixtureWithStatistics).statistics;
  if (!stats || stats.length === 0) return null;

  const homeStats =
    stats.find((entry) => entry.team.id === fixture.teams.home.id) ?? stats[0];
  const awayStats =
    stats.find((entry) => entry.team.id === fixture.teams.away.id) ?? stats[1];

  if (!homeStats || !awayStats) return null;

  const possessionHome = findStatValue(homeStats.statistics, POSSESSION_KEYS);
  const possessionAway = findStatValue(awayStats.statistics, POSSESSION_KEYS);
  const possessionShare = calculateShare(possessionHome, possessionAway);
  const safePossessionHome = possessionHome ?? 0;
  const safePossessionAway = possessionAway ?? 0;
  const possessionHomeIsHigher = safePossessionHome > safePossessionAway;
  const possessionAwayIsHigher = safePossessionAway > safePossessionHome;

  const hasAnyStat =
    possessionHome != null ||
    possessionAway != null ||
    BEST_STATS.some((stat) => {
      const homeValue = findStatValue(homeStats.statistics, stat.keys);
      const awayValue = findStatValue(awayStats.statistics, stat.keys);
      return homeValue != null || awayValue != null;
    });

  if (!hasAnyStat) return null;

  return (
    <View className="mb-16 gap-16">
      <View className="rounded-lg bg-neu-01 px-16 py-16 shadow-sha-01 dark:bg-neu-11 dark:shadow-sha-06">
        <View className="flex-row items-center justify-between">
          <Text
            selectable
            variant={possessionHomeIsHigher ? "highlight-02" : "body-02"}
            className={
              possessionHomeIsHigher ? "text-m-02" : "text-neu-07 dark:text-neu-06"
            }
          >
            {possessionHome == null ? "—" : `${Math.round(possessionHome)}%`}
          </Text>
          <Text
            selectable
            variant="caption-03"
            className="uppercase text-neu-07 dark:text-neu-06"
          >
            POSSESSION
          </Text>
          <Text
            selectable
            variant={possessionAwayIsHigher ? "highlight-02" : "body-02"}
            className={
              possessionAwayIsHigher ? "text-m-02" : "text-neu-07 dark:text-neu-06"
            }
          >
            {possessionAway == null ? "—" : `${Math.round(possessionAway)}%`}
          </Text>
        </View>

        <View className="mt-8 h-8 w-full flex-row overflow-hidden rounded-full bg-neu-03 dark:bg-neu-12">
          <View
            className={
              possessionHomeIsHigher
                ? "h-full bg-linear-to-l from-m-02-dark-01 to-m-02-light-02"
                : "h-full bg-linear-to-l from-neu-05 to-neu-06"
            }
            style={{ width: `${possessionShare.home}%` }}
          />
          <View
            className={
              possessionAwayIsHigher
                ? "h-full bg-linear-to-r from-m-02-dark-01 to-m-02-light-02"
                : "h-full bg-linear-to-r from-neu-06 to-neu-05"
            }
            style={{ width: `${possessionShare.away}%` }}
          />
        </View>
      </View>

      <View className="flex-row items-stretch justify-between gap-8">
        {BEST_STATS.map((stat) => {
          const homeValue = findStatValue(homeStats.statistics, stat.keys);
          const awayValue = findStatValue(awayStats.statistics, stat.keys);
          return (
            <View key={stat.id} className="flex-1 min-w-0">
              <BestStatCard
                label={stat.label}
                homeValue={homeValue}
                awayValue={awayValue}
                precision={stat.precision}
              />
            </View>
          );
        })}
      </View>
    </View>
  );
}

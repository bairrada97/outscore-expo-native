import type { Fixture } from "@outscore/shared-types";

export type FixtureStatisticsItem = {
  type: string;
  value: number | string | null;
};

export type FixtureStatisticsEntry = {
  team: {
    id: number;
    name: string;
    logo: string;
  };
  statistics: FixtureStatisticsItem[];
};

export type FixtureWithStatistics = Fixture & {
  statistics?: FixtureStatisticsEntry[];
};

/**
 * Normalize a stat value to a number (handles strings like "46%", "0.98")
 */
function normalizeStatValue(
  value: FixtureStatisticsItem["value"],
): number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const trimmed = value.replace("%", "").trim();
    const parsed = Number.parseFloat(trimmed);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

/**
 * Find a stat value by matching against a list of possible keys (case-insensitive)
 */
export function findStatValue(
  statistics: FixtureStatisticsItem[],
  keys: string[],
): number | null {
  const normalizedKeys = keys.map((key) => key.toLowerCase());
  const stat = statistics.find((item) =>
    normalizedKeys.includes(item.type.toLowerCase()),
  );
  return stat ? normalizeStatValue(stat.value) : null;
}

/**
 * Find a stat value by exact type match (case-insensitive)
 */
export function findStatByType(
  statistics: FixtureStatisticsItem[],
  type: string,
): number | null {
  const stat = statistics.find(
    (item) => item.type.toLowerCase() === type.toLowerCase(),
  );
  return stat ? normalizeStatValue(stat.value) : null;
}

/**
 * Format a number with given precision
 */
export function formatStatNumber(
  value: number | null,
  precision: number,
): string {
  if (value == null) return "—";
  if (precision === 0) return Math.round(value).toString();
  return value.toFixed(precision);
}

/**
 * Calculate percentage share between two values for progress bar display
 */
export function calculateShare(
  homeValue: number | null,
  awayValue: number | null,
) {
  if (homeValue == null && awayValue == null) {
    return { home: 50, away: 50 };
  }
  const safeHome = homeValue ?? 0;
  const safeAway = awayValue ?? 0;
  const total = safeHome + safeAway;
  if (!total) return { home: 50, away: 50 };
  return {
    home: (safeHome / total) * 100,
    away: (safeAway / total) * 100,
  };
}

/**
 * Determine which side has the higher value
 */
export function getHigherSide(
  homeValue: number | null,
  awayValue: number | null,
): "home" | "away" | "equal" {
  const safeHome = homeValue ?? 0;
  const safeAway = awayValue ?? 0;
  if (safeHome > safeAway) return "home";
  if (safeAway > safeHome) return "away";
  return "equal";
}

/**
 * Check if a stat value includes percentage
 */
export const percentageStats = ["ball possession", "possession", "passes %"];

export function isPercentageStat(
  type: string,
  statValue?: string,
): boolean {
  const normalizedType = type.toLowerCase();
  if (percentageStats.includes(normalizedType)) return true;
  return typeof statValue === "string" && statValue.toLowerCase().includes("%");
}

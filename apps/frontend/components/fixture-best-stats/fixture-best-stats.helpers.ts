// Re-export shared utilities
export {
	calculateShare,
	findStatValue,
	formatStatNumber as formatNumber,
	type FixtureStatisticsEntry,
	type FixtureStatisticsItem,
	type FixtureWithStatistics,
} from "@/utils/fixture-statistics";

export type BestStatConfig = {
	id: string;
	label: string;
	keys: string[];
	precision: number;
};

export const BEST_STATS: BestStatConfig[] = [
	{
		id: "expected-goals",
		label: "XG GOALS",
		keys: ["expected goals", "expected_goals", "xg", "expected goals (xg)"],
		precision: 2,
	},
	{
		id: "total-shots",
		label: "TOTAL SHOTS",
		keys: ["total shots"],
		precision: 0,
	},
	{
		id: "shots-on-target",
		label: "ON TARGET",
		keys: ["shots on goal", "shots on target"],
		precision: 0,
	},
];

export const POSSESSION_KEYS = ["ball possession", "possession"];

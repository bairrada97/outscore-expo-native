/**
 * Head-to-Head (H2H) Pattern Detection
 *
 * Detects patterns in head-to-head matchups between teams:
 * - BTTS streaks and rates
 * - H2H dominance
 * - Over/Under 2.5 trends
 * - Goal patterns
 *
 * Reference: docs/implementation-plan/phase2.md - Section 2.2
 * Algorithm: docs/betting-insights-Algorithm.md - H2H Pattern Detection section
 */

import type { H2HData, ProcessedMatch } from "../types";
import type { Pattern, PatternSeverity, PatternType } from "./team-patterns";

// ============================================================================
// H2H PATTERN TYPES
// ============================================================================

/**
 * H2H specific pattern types
 */
export type H2HPatternType =
	| "H2H_BTTS_STREAK"
	| "H2H_HIGH_BTTS_RATE"
	| "H2H_NO_BTTS_STREAK"
	| "H2H_LOW_BTTS_RATE"
	| "H2H_DOMINANCE"
	| "H2H_DRAWS_COMMON"
	| "H2H_HIGH_SCORING"
	| "H2H_LOW_SCORING"
	| "H2H_OVER_25_STREAK"
	| "H2H_UNDER_25_STREAK"
	| "H2H_HOME_DOMINANCE"
	| "H2H_AWAY_UPSET_TREND";

// ============================================================================
// THRESHOLDS
// ============================================================================

/**
 * H2H pattern thresholds
 */
const H2H_THRESHOLDS = {
	// BTTS
	bttsStreakHigh: 4,
	bttsStreakMedium: 3,
	bttsRateHigh: 0.8, // 80%
	bttsRateMedium: 0.7, // 70%
	noBttsRateMedium: 0.7, // 70% without BTTS

	// Dominance
	dominanceHigh: 0.8, // 80% win rate
	dominanceMedium: 0.7, // 70% win rate

	// Draws
	drawsCommonThreshold: 0.4, // 40% draws

	// Goals
	highScoringThreshold: 3.5, // Average goals
	lowScoringThreshold: 1.5,

	// Over/Under
	over25StreakMedium: 3,
	over25RateHigh: 0.8, // 80%
	over25RateMedium: 0.7, // 70%
	under25RateMedium: 0.7,

	// Minimum matches for reliable H2H analysis
	minMatches: 3,
	idealMatches: 5,
} as const;

/**
 * Priority scores for H2H patterns
 */
const H2H_PATTERN_PRIORITIES: Record<H2HPatternType, number> = {
	H2H_DOMINANCE: 90,
	H2H_HOME_DOMINANCE: 88,
	H2H_BTTS_STREAK: 85,
	H2H_HIGH_BTTS_RATE: 82,
	H2H_HIGH_SCORING: 80,
	H2H_OVER_25_STREAK: 78,
	H2H_AWAY_UPSET_TREND: 75,
	H2H_DRAWS_COMMON: 72,
	H2H_NO_BTTS_STREAK: 70,
	H2H_LOW_BTTS_RATE: 68,
	H2H_UNDER_25_STREAK: 65,
	H2H_LOW_SCORING: 60,
};

// ============================================================================
// MAIN DETECTION FUNCTION
// ============================================================================

/**
 * Detect all H2H patterns between two teams
 *
 * @param h2hData - Processed H2H data
 * @param homeTeamName - Home team name for descriptions
 * @param awayTeamName - Away team name for descriptions
 * @returns Array of detected patterns
 */
export function detectH2HPatterns(
	h2hData: H2HData,
	homeTeamName: string = "Home team",
	awayTeamName: string = "Away team",
): Pattern[] {
	const patterns: Pattern[] = [];

	// Need minimum matches for reliable analysis
	if (h2hData.h2hMatchCount < H2H_THRESHOLDS.minMatches) {
		return patterns;
	}

	// Detect dominance patterns
	patterns.push(
		...detectH2HDominancePatterns(h2hData, homeTeamName, awayTeamName),
	);

	// Detect goal patterns
	patterns.push(...detectH2HGoalPatterns(h2hData, homeTeamName, awayTeamName));

	// Detect over/under patterns
	patterns.push(
		...detectH2HOverUnderPatterns(h2hData, homeTeamName, awayTeamName),
	);

	// Detect draw patterns
	patterns.push(...detectH2HDrawPatterns(h2hData, homeTeamName, awayTeamName));

	// Sort by priority
	return patterns.sort((a, b) => b.priority - a.priority);
}

// ============================================================================
// BTTS PATTERN DETECTION
// ============================================================================

/**
 * Count consecutive BTTS matches in H2H history
 */
function countH2HConsecutiveBTTS(matches: ProcessedMatch[]): number {
	let count = 0;
	for (const match of matches) {
		const homeScore = match.score.home ?? match.goalsScored;
		const awayScore = match.score.away ?? match.goalsConceded;
		const isBTTS = homeScore > 0 && awayScore > 0;
		if (isBTTS) {
			count++;
		} else {
			break;
		}
	}
	return count;
}

/**
 * Count consecutive non-BTTS matches in H2H history
 */
function countH2HConsecutiveNoBTTS(matches: ProcessedMatch[]): number {
	let count = 0;
	for (const match of matches) {
		const homeScore = match.score.home ?? match.goalsScored;
		const awayScore = match.score.away ?? match.goalsConceded;
		const isBTTS = homeScore > 0 && awayScore > 0;
		if (!isBTTS) {
			count++;
		} else {
			break;
		}
	}
	return count;
}

/**
 * Detect BTTS patterns in H2H
 */
function detectH2HBTTSPatterns(
	h2hData: H2HData,
	homeTeamName: string,
	awayTeamName: string,
): Pattern[] {
	const patterns: Pattern[] = [];

	// BTTS streak
	const bttsStreak = countH2HConsecutiveBTTS(h2hData.matches);
	if (bttsStreak >= H2H_THRESHOLDS.bttsStreakMedium) {
		const severity: PatternSeverity =
			bttsStreak >= H2H_THRESHOLDS.bttsStreakHigh ? "HIGH" : "MEDIUM";
		patterns.push({
			type: "H2H_BTTS_STREAK" as PatternType,
			severity,
			priority: H2H_PATTERN_PRIORITIES.H2H_BTTS_STREAK,
			description: `Both teams have scored in the last ${bttsStreak} meetings between ${homeTeamName} and ${awayTeamName}`,
			data: { streak: bttsStreak },
		});
	}

	// High BTTS rate (even without streak)
	const bttsRate = h2hData.bttsPercentage / 100;
	if (
		bttsRate >= H2H_THRESHOLDS.bttsRateMedium &&
		bttsStreak < H2H_THRESHOLDS.bttsStreakMedium
	) {
		const severity: PatternSeverity =
			bttsRate >= H2H_THRESHOLDS.bttsRateHigh ? "HIGH" : "MEDIUM";
		patterns.push({
			type: "H2H_HIGH_BTTS_RATE" as PatternType,
			severity,
			priority: H2H_PATTERN_PRIORITIES.H2H_HIGH_BTTS_RATE,
			description: `Both teams score in ${Math.round(bttsRate * 100)}% of matches between ${homeTeamName} and ${awayTeamName}`,
			data: {
				bttsRate: Math.round(bttsRate * 100),
				bttsCount: h2hData.bttsCount,
				matchCount: h2hData.h2hMatchCount,
			},
		});
	}

	// No BTTS streak
	const noBttsStreak = countH2HConsecutiveNoBTTS(h2hData.matches);
	if (noBttsStreak >= H2H_THRESHOLDS.bttsStreakMedium) {
		patterns.push({
			type: "H2H_NO_BTTS_STREAK" as PatternType,
			severity: "MEDIUM",
			priority: H2H_PATTERN_PRIORITIES.H2H_NO_BTTS_STREAK,
			description: `At least one team failed to score in the last ${noBttsStreak} meetings between ${homeTeamName} and ${awayTeamName}`,
			data: { streak: noBttsStreak },
		});
	}

	// Low BTTS rate
	if (
		bttsRate <= 1 - H2H_THRESHOLDS.noBttsRateMedium &&
		noBttsStreak < H2H_THRESHOLDS.bttsStreakMedium
	) {
		patterns.push({
			type: "H2H_LOW_BTTS_RATE" as PatternType,
			severity: "MEDIUM",
			priority: H2H_PATTERN_PRIORITIES.H2H_LOW_BTTS_RATE,
			description: `Both teams score in only ${Math.round(bttsRate * 100)}% of matches between ${homeTeamName} and ${awayTeamName}`,
			data: {
				bttsRate: Math.round(bttsRate * 100),
				matchCount: h2hData.h2hMatchCount,
			},
		});
	}

	return patterns;
}

// ============================================================================
// DOMINANCE PATTERN DETECTION
// ============================================================================

/**
 * Detect H2H dominance patterns
 */
function detectH2HDominancePatterns(
	h2hData: H2HData,
	homeTeamName: string,
	awayTeamName: string,
): Pattern[] {
	const patterns: Pattern[] = [];
	const totalMatches = h2hData.h2hMatchCount;

	if (totalMatches < H2H_THRESHOLDS.minMatches) {
		return patterns;
	}

	// Calculate win rates
	const homeWinRate = h2hData.homeTeamWins / totalMatches;
	const awayWinRate = h2hData.awayTeamWins / totalMatches;

	// Home team dominance
	if (homeWinRate >= H2H_THRESHOLDS.dominanceMedium) {
		const severity: PatternSeverity =
			homeWinRate >= H2H_THRESHOLDS.dominanceHigh ? "HIGH" : "MEDIUM";
		patterns.push({
			type: "H2H_DOMINANCE" as PatternType,
			severity,
			priority: H2H_PATTERN_PRIORITIES.H2H_DOMINANCE,
			description: `${homeTeamName} has won ${Math.round(homeWinRate * 100)}% of matches against ${awayTeamName}`,
			data: {
				dominantTeam: "home",
				winRate: Math.round(homeWinRate * 100),
				wins: h2hData.homeTeamWins,
				totalMatches,
			},
		});
	}

	// Away team dominance
	if (awayWinRate >= H2H_THRESHOLDS.dominanceMedium) {
		const severity: PatternSeverity =
			awayWinRate >= H2H_THRESHOLDS.dominanceHigh ? "HIGH" : "MEDIUM";
		patterns.push({
			type: "H2H_DOMINANCE" as PatternType,
			severity,
			priority: H2H_PATTERN_PRIORITIES.H2H_DOMINANCE,
			description: `${awayTeamName} has won ${Math.round(awayWinRate * 100)}% of matches against ${homeTeamName}`,
			data: {
				dominantTeam: "away",
				winRate: Math.round(awayWinRate * 100),
				wins: h2hData.awayTeamWins,
				totalMatches,
			},
		});
	}

	// Check for home venue dominance specifically
	// Filter matches where the current home team was actually at home
	const homeVenueMatches = h2hData.matches.filter((m) => m.isHome);
	if (homeVenueMatches.length >= 3) {
		const homeVenueWins = homeVenueMatches.filter(
			(m) => m.result === "W",
		).length;
		const homeVenueWinRate = homeVenueWins / homeVenueMatches.length;

		if (homeVenueWinRate >= H2H_THRESHOLDS.dominanceMedium) {
			patterns.push({
				type: "H2H_HOME_DOMINANCE" as PatternType,
				severity: "MEDIUM",
				priority: H2H_PATTERN_PRIORITIES.H2H_HOME_DOMINANCE,
				description: `${homeTeamName} wins ${Math.round(homeVenueWinRate * 100)}% at home against ${awayTeamName}`,
				data: {
					homeVenueWinRate: Math.round(homeVenueWinRate * 100),
					homeVenueMatches: homeVenueMatches.length,
				},
			});
		}
	}

	// Away upset trend (away team wins more than expected at the current home team's venue)
	// IMPORTANT: `m.result` is from the current home team's perspective.
	// So an away-team win at this venue is `m.result === "L"` in matches where `m.isHome === true`.
	if (homeVenueMatches.length >= 3) {
		const awayVenueWins = homeVenueMatches.filter((m) => m.result === "L").length;
		const awayVenueWinRate = awayVenueWins / homeVenueMatches.length;

		// Away team winning 50%+ at this venue is notable
		if (awayVenueWinRate >= 0.5) {
			patterns.push({
				type: "H2H_AWAY_UPSET_TREND" as PatternType,
				severity: "MEDIUM",
				priority: H2H_PATTERN_PRIORITIES.H2H_AWAY_UPSET_TREND,
				description: `${awayTeamName} has won ${Math.round(awayVenueWinRate * 100)}% at ${homeTeamName}'s venue`,
				data: {
					awayVenueWinRate: Math.round(awayVenueWinRate * 100),
					homeVenueMatches: homeVenueMatches.length,
				},
			});
		}
	}

	return patterns;
}

// ============================================================================
// GOAL PATTERN DETECTION
// ============================================================================

/**
 * Detect H2H goal patterns
 */
function detectH2HGoalPatterns(
	h2hData: H2HData,
	homeTeamName: string,
	awayTeamName: string,
): Pattern[] {
	const patterns: Pattern[] = [];

	// High scoring H2H
	if (h2hData.avgGoals >= H2H_THRESHOLDS.highScoringThreshold) {
		patterns.push({
			type: "H2H_HIGH_SCORING" as PatternType,
			severity: "HIGH",
			priority: H2H_PATTERN_PRIORITIES.H2H_HIGH_SCORING,
			description: `Matches between ${homeTeamName} and ${awayTeamName} average ${h2hData.avgGoals.toFixed(1)} goals`,
			data: {
				avgGoals: Math.round(h2hData.avgGoals * 10) / 10,
				matchCount: h2hData.h2hMatchCount,
			},
		});
	}

	// Low scoring H2H
	if (h2hData.avgGoals <= H2H_THRESHOLDS.lowScoringThreshold) {
		patterns.push({
			type: "H2H_LOW_SCORING" as PatternType,
			severity: "MEDIUM",
			priority: H2H_PATTERN_PRIORITIES.H2H_LOW_SCORING,
			description: `Matches between ${homeTeamName} and ${awayTeamName} average only ${h2hData.avgGoals.toFixed(1)} goals`,
			data: {
				avgGoals: Math.round(h2hData.avgGoals * 10) / 10,
				matchCount: h2hData.h2hMatchCount,
			},
		});
	}

	return patterns;
}

// ============================================================================
// OVER/UNDER PATTERN DETECTION
// ============================================================================

/**
 * Count consecutive Over 2.5 matches in H2H
 */
function countH2HConsecutiveOver25(matches: ProcessedMatch[]): number {
	let count = 0;
	for (const match of matches) {
		const homeScore = match.score.home ?? match.goalsScored;
		const awayScore = match.score.away ?? match.goalsConceded;
		const totalGoals = homeScore + awayScore;
		if (totalGoals > 2.5) {
			count++;
		} else {
			break;
		}
	}
	return count;
}

/**
 * Count consecutive Under 2.5 matches in H2H
 */
function countH2HConsecutiveUnder25(matches: ProcessedMatch[]): number {
	let count = 0;
	for (const match of matches) {
		const homeScore = match.score.home ?? match.goalsScored;
		const awayScore = match.score.away ?? match.goalsConceded;
		const totalGoals = homeScore + awayScore;
		if (totalGoals < 2.5) {
			count++;
		} else {
			break;
		}
	}
	return count;
}

/**
 * Detect H2H over/under patterns
 */
function detectH2HOverUnderPatterns(
	h2hData: H2HData,
	homeTeamName: string,
	awayTeamName: string,
): Pattern[] {
	const patterns: Pattern[] = [];
	const over25Pct = h2hData.goalLineOverPct?.["2.5"] ?? 0;
	const over25Count = h2hData.goalLineOverCount?.["2.5"] ?? 0;

	// Over 2.5 streak
	const over25Streak = countH2HConsecutiveOver25(h2hData.matches);
	if (over25Streak >= H2H_THRESHOLDS.over25StreakMedium) {
		patterns.push({
			type: "H2H_OVER_25_STREAK" as PatternType,
			severity: "HIGH",
			priority: H2H_PATTERN_PRIORITIES.H2H_OVER_25_STREAK,
			description: `The last ${over25Streak} meetings between ${homeTeamName} and ${awayTeamName} had 3+ goals`,
			data: { streak: over25Streak },
		});
	}

	// High Over 2.5 rate (even without streak)
	const over25Rate = over25Pct / 100;
	if (
		over25Rate >= H2H_THRESHOLDS.over25RateMedium &&
		over25Streak < H2H_THRESHOLDS.over25StreakMedium
	) {
		const severity: PatternSeverity =
			over25Rate >= H2H_THRESHOLDS.over25RateHigh ? "HIGH" : "MEDIUM";
		patterns.push({
			type: "H2H_OVER_25_STREAK" as PatternType,
			severity,
			priority: H2H_PATTERN_PRIORITIES.H2H_OVER_25_STREAK - 3,
			description: `${Math.round(over25Rate * 100)}% of matches between ${homeTeamName} and ${awayTeamName} have 3+ goals`,
			data: {
				over25Rate: Math.round(over25Rate * 100),
				over25Count,
				matchCount: h2hData.h2hMatchCount,
			},
		});
	}

	// Under 2.5 streak
	const under25Streak = countH2HConsecutiveUnder25(h2hData.matches);
	if (under25Streak >= H2H_THRESHOLDS.over25StreakMedium) {
		patterns.push({
			type: "H2H_UNDER_25_STREAK" as PatternType,
			severity: "MEDIUM",
			priority: H2H_PATTERN_PRIORITIES.H2H_UNDER_25_STREAK,
			description: `The last ${under25Streak} meetings between ${homeTeamName} and ${awayTeamName} had fewer than 3 goals`,
			data: { streak: under25Streak },
		});
	}

	// High Under 2.5 rate
	const under25Rate = 1 - over25Rate;
	if (
		under25Rate >= H2H_THRESHOLDS.under25RateMedium &&
		under25Streak < H2H_THRESHOLDS.over25StreakMedium
	) {
		patterns.push({
			type: "H2H_UNDER_25_STREAK" as PatternType,
			severity: "MEDIUM",
			priority: H2H_PATTERN_PRIORITIES.H2H_UNDER_25_STREAK - 3,
			description: `${Math.round(under25Rate * 100)}% of matches between ${homeTeamName} and ${awayTeamName} have fewer than 3 goals`,
			data: {
				under25Rate: Math.round(under25Rate * 100),
				matchCount: h2hData.h2hMatchCount,
			},
		});
	}

	return patterns;
}

// ============================================================================
// DRAW PATTERN DETECTION
// ============================================================================

/**
 * Detect H2H draw patterns
 */
function detectH2HDrawPatterns(
	h2hData: H2HData,
	homeTeamName: string,
	awayTeamName: string,
): Pattern[] {
	const patterns: Pattern[] = [];

	const drawRate = h2hData.draws / h2hData.h2hMatchCount;

	// High draw rate
	if (drawRate >= H2H_THRESHOLDS.drawsCommonThreshold) {
		patterns.push({
			type: "H2H_DRAWS_COMMON" as PatternType,
			severity: "MEDIUM",
			priority: H2H_PATTERN_PRIORITIES.H2H_DRAWS_COMMON,
			description: `${Math.round(drawRate * 100)}% of matches between ${homeTeamName} and ${awayTeamName} end in draws`,
			data: {
				drawRate: Math.round(drawRate * 100),
				draws: h2hData.draws,
				matchCount: h2hData.h2hMatchCount,
			},
		});
	}

	return patterns;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get H2H pattern summary
 */
export function getH2HSummary(h2hData: H2HData): {
	bttsRate: number;
	over25Rate: number;
	homeWinRate: number;
	awayWinRate: number;
	drawRate: number;
	avgGoals: number;
	hasSufficientData: boolean;
} {
	const total = h2hData.h2hMatchCount;

	return {
		bttsRate: h2hData.bttsPercentage,
		over25Rate: h2hData.goalLineOverPct?.["2.5"] ?? 0,
		homeWinRate: total > 0 ? (h2hData.homeTeamWins / total) * 100 : 0,
		awayWinRate: total > 0 ? (h2hData.awayTeamWins / total) * 100 : 0,
		drawRate: total > 0 ? (h2hData.draws / total) * 100 : 0,
		avgGoals: h2hData.avgGoals,
		hasSufficientData: h2hData.hasSufficientData,
	};
}

/**
 * Check if H2H suggests value on a specific market
 */
export function h2hSuggestsMarket(
	h2hData: H2HData,
	market: "BTTS_YES" | "BTTS_NO" | "OVER_25" | "UNDER_25",
): boolean {
	const over25Pct = h2hData.goalLineOverPct?.["2.5"] ?? 0;
	switch (market) {
		case "BTTS_YES":
			return h2hData.bttsPercentage >= H2H_THRESHOLDS.bttsRateMedium * 100;
		case "BTTS_NO":
			return (
				h2hData.bttsPercentage <= (1 - H2H_THRESHOLDS.noBttsRateMedium) * 100
			);
		case "OVER_25":
			return over25Pct >= H2H_THRESHOLDS.over25RateMedium * 100;
		case "UNDER_25":
			return over25Pct <= (1 - H2H_THRESHOLDS.under25RateMedium) * 100;
		default:
			return false;
	}
}

/**
 * Get dominant team from H2H (if any)
 */
export function getH2HDominantTeam(h2hData: H2HData): "home" | "away" | null {
	const total = h2hData.h2hMatchCount;
	if (total < H2H_THRESHOLDS.minMatches) return null;

	const homeWinRate = h2hData.homeTeamWins / total;
	const awayWinRate = h2hData.awayTeamWins / total;

	if (homeWinRate >= H2H_THRESHOLDS.dominanceMedium) return "home";
	if (awayWinRate >= H2H_THRESHOLDS.dominanceMedium) return "away";

	return null;
}

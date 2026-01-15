/**
 * End-of-Season Detection and Adjustments
 *
 * Detects and adjusts for end-of-season pressure situations:
 * - Title race
 * - Champions League qualification
 * - Europa League qualification
 * - Relegation battle
 * - Nothing to play for
 *
 * Reference: docs/implementation-plan/phase3.5.md - Section 3.5.7
 */

import type { MotivationLevel, TeamData, Adjustment } from "../types";
import { createAdjustment } from "../utils/capped-adjustments";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Season stakes for a team - what they're fighting for
 */
export type SeasonStakes =
	| "TITLE_RACE" // Fighting for league title (1st-2nd)
	| "CL_QUALIFICATION" // Fighting for Champions League spots (3rd-4th)
	| "EUROPA_RACE" // Fighting for Europa League (5th-7th)
	| "CONFERENCE_RACE" // Fighting for Conference League
	| "RELEGATION_BATTLE" // Fighting to stay up (bottom 3-4)
	| "NOTHING_TO_PLAY" // Mid-table, secured position
	| "ALREADY_RELEGATED" // Already relegated mathematically
	| "ALREADY_CHAMPION"; // Already won the title

/**
 * End of season context for a match
 */
export interface EndOfSeasonContext {
	/** Whether the match is in end-of-season period (last 5 rounds or 85%+) */
	isEndOfSeason: boolean;

	/** Round number within the season */
	roundNumber?: number;

	/** Total rounds in the season */
	totalRounds?: number;

	/** Season completion percentage (0-100) */
	seasonProgress?: number;

	/** Home team's season stakes */
	homeStakes: SeasonStakes;

	/** Away team's season stakes */
	awayStakes: SeasonStakes;

	/** Motivation gap: positive = home more motivated, negative = away more motivated */
	motivationGap: number;

	/** Whether this is a "six-pointer" (both teams fighting for same goal) */
	isSixPointer: boolean;

	/** Human-readable summary */
	summary: string;

	/** Probability adjustments based on end-of-season context */
	adjustments: EndOfSeasonAdjustments;
}

/**
 * Probability adjustments for end-of-season situations
 */
export interface EndOfSeasonAdjustments {
	/** Home win probability boost/reduction (percentage points) */
	homeWinAdjustment: number;

	/** Away win probability boost/reduction (percentage points) */
	awayWinAdjustment: number;

	/** BTTS adjustment: negative = more cagey, positive = more open */
	bttsAdjustment: number;

	/** Goals adjustment: negative = fewer goals expected, positive = more goals */
	goalsAdjustment: number;

	/** Draw probability adjustment */
	drawAdjustment: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** End of season detection: last N rounds */
const END_OF_SEASON_ROUNDS = 5;

/** End of season detection: percentage threshold */
const END_OF_SEASON_THRESHOLD = 0.85;

/** Default total rounds for major leagues */
const DEFAULT_TOTAL_ROUNDS = 38;

/** Position thresholds for different leagues (default 20-team league) */
const POSITION_THRESHOLDS = {
	titleRace: 2, // 1st-2nd
	clSpots: 4, // 1st-4th
	europaSpots: 7, // 5th-7th
	conferenceSpots: 8, // 8th
	relegationZone: 3, // Bottom 3
};

/** Stakes priority for motivation comparison (higher = more motivated) */
const STAKES_PRIORITY: Record<SeasonStakes, number> = {
	TITLE_RACE: 100,
	RELEGATION_BATTLE: 95,
	CL_QUALIFICATION: 80,
	EUROPA_RACE: 60,
	CONFERENCE_RACE: 50,
	NOTHING_TO_PLAY: 20,
	ALREADY_RELEGATED: 10,
	ALREADY_CHAMPION: 15,
};

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

/**
 * Detect end-of-season context and calculate adjustments
 *
 * @param homeTeam - Home team data
 * @param awayTeam - Away team data
 * @param roundNumber - Current round number
 * @param totalRounds - Total rounds in the season
 * @param leagueSize - Number of teams in the league (default 20)
 * @returns Complete end-of-season context
 */
export function detectEndOfSeason(
	homeTeam: TeamData,
	awayTeam: TeamData,
	roundNumber?: number,
	totalRounds?: number,
	leagueSize: number = 20,
): EndOfSeasonContext {
	const effectiveTotalRounds = totalRounds ?? DEFAULT_TOTAL_ROUNDS;
	const effectiveRoundNumber = roundNumber ?? effectiveTotalRounds;

	// Calculate season progress
	const seasonProgress =
		effectiveTotalRounds > 0 ? (effectiveRoundNumber / effectiveTotalRounds) * 100 : 0;

	// Detect if we're in end-of-season
	const isEndOfSeason = detectIsEndOfSeason(effectiveRoundNumber, effectiveTotalRounds);

	// Analyze stakes for each team
	const homeStakes = analyzeSeasonStakes(homeTeam, leagueSize, isEndOfSeason);
	const awayStakes = analyzeSeasonStakes(awayTeam, leagueSize, isEndOfSeason);

	// Calculate motivation gap
	const motivationGap = calculateMotivationGap(homeStakes, awayStakes);

	// Detect six-pointer
	const isSixPointer = detectSixPointer(homeStakes, awayStakes);

	// Calculate adjustments
	const adjustments = calculateEndOfSeasonAdjustments(
		homeStakes,
		awayStakes,
		motivationGap,
		isSixPointer,
		isEndOfSeason,
	);

	// Build summary
	const summary = buildEndOfSeasonSummary(
		homeTeam.name,
		awayTeam.name,
		homeStakes,
		awayStakes,
		isSixPointer,
		isEndOfSeason,
	);

	return {
		isEndOfSeason,
		roundNumber: effectiveRoundNumber,
		totalRounds: effectiveTotalRounds,
		seasonProgress,
		homeStakes,
		awayStakes,
		motivationGap,
		isSixPointer,
		summary,
		adjustments,
	};
}

/**
 * Check if we're in end-of-season period
 */
export function detectIsEndOfSeason(roundNumber: number, totalRounds: number): boolean {
	if (!roundNumber || !totalRounds || totalRounds === 0) {
		return false;
	}

	const remainingRounds = totalRounds - roundNumber;
	const progress = roundNumber / totalRounds;

	return remainingRounds < END_OF_SEASON_ROUNDS || progress > END_OF_SEASON_THRESHOLD;
}

/**
 * Analyze what a team is fighting for based on position and points
 */
export function analyzeSeasonStakes(
	team: TeamData,
	leagueSize: number = 20,
	isEndOfSeason: boolean = false,
): SeasonStakes {
	const position = team.stats.leaguePosition;
	const pointsFromFirst = team.stats.pointsFromFirst ?? 0;
	const pointsFromRelegation = team.stats.pointsFromRelegation ?? 0;
	const pointsFromCL = team.stats.pointsFromCL ?? 0;

	// Already use safetyFlags motivation if available
	const motivation = team.safetyFlags?.motivation;
	if (motivation) {
		return mapMotivationToStakes(motivation);
	}

	// Calculate dynamic thresholds based on league size
	const clThreshold = Math.min(POSITION_THRESHOLDS.clSpots, Math.floor(leagueSize * 0.2));
	const europaThreshold = Math.min(
		POSITION_THRESHOLDS.europaSpots,
		Math.floor(leagueSize * 0.35),
	);
	const relegationStart = leagueSize - POSITION_THRESHOLDS.relegationZone + 1;

	// Already relegated check
	if (
		isEndOfSeason &&
		position &&
		position >= relegationStart &&
		pointsFromRelegation < -10
	) {
		return "ALREADY_RELEGATED";
	}

	// Already champion check
	if (isEndOfSeason && position === 1 && pointsFromFirst === 0 && pointsFromCL > 10) {
		return "ALREADY_CHAMPION";
	}

	// Title race: 1st-2nd with realistic chance
	if (position && position <= POSITION_THRESHOLDS.titleRace) {
		if (pointsFromFirst <= 6) {
			return "TITLE_RACE";
		}
	}

	// CL qualification: positions 3-4 (or within reach)
	if (position && position <= clThreshold) {
		return "CL_QUALIFICATION";
	}

	// Within striking distance of CL
	if (pointsFromCL >= -6 && pointsFromCL < 0) {
		return "CL_QUALIFICATION";
	}

	// Europa League race
	if (position && position <= europaThreshold) {
		return "EUROPA_RACE";
	}

	// Conference League race
	if (position && position === europaThreshold + 1) {
		return "CONFERENCE_RACE";
	}

	// Relegation battle
	if (position && position >= relegationStart) {
		return "RELEGATION_BATTLE";
	}

	// Close to relegation zone
	if (pointsFromRelegation <= 6) {
		return "RELEGATION_BATTLE";
	}

	// Default: nothing to play for
	return "NOTHING_TO_PLAY";
}

/**
 * Map existing MotivationLevel to SeasonStakes
 */
function mapMotivationToStakes(motivation: MotivationLevel): SeasonStakes {
	switch (motivation) {
		case "TITLE_RACE":
			return "TITLE_RACE";
		case "CL_RACE":
			return "CL_QUALIFICATION";
		case "EUROPA_RACE":
			return "EUROPA_RACE";
		case "RELEGATION_BATTLE":
			return "RELEGATION_BATTLE";
		case "MID_TABLE":
		case "SECURE":
			return "NOTHING_TO_PLAY";
		default:
			return "NOTHING_TO_PLAY";
	}
}

/**
 * Calculate motivation gap between teams
 *
 * @returns Number from -100 to +100. Positive = home more motivated
 */
export function calculateMotivationGap(
	homeStakes: SeasonStakes,
	awayStakes: SeasonStakes,
): number {
	const homePriority = STAKES_PRIORITY[homeStakes];
	const awayPriority = STAKES_PRIORITY[awayStakes];

	return homePriority - awayPriority;
}

/**
 * Detect if this is a "six-pointer" match
 *
 * Six-pointer: both teams fighting for the same objective
 */
export function detectSixPointer(homeStakes: SeasonStakes, awayStakes: SeasonStakes): boolean {
	// Same stakes = six-pointer
	if (homeStakes === awayStakes && homeStakes !== "NOTHING_TO_PLAY") {
		return true;
	}

	// Both in relegation zone
	if (homeStakes === "RELEGATION_BATTLE" && awayStakes === "RELEGATION_BATTLE") {
		return true;
	}

	// Both chasing European spots
	const europeanStakes: SeasonStakes[] = [
		"CL_QUALIFICATION",
		"EUROPA_RACE",
		"CONFERENCE_RACE",
	];
	if (europeanStakes.includes(homeStakes) && europeanStakes.includes(awayStakes)) {
		return true;
	}

	return false;
}

// ============================================================================
// ADJUSTMENT CALCULATIONS
// ============================================================================

/**
 * Calculate probability adjustments based on end-of-season context
 */
function calculateEndOfSeasonAdjustments(
	homeStakes: SeasonStakes,
	awayStakes: SeasonStakes,
	motivationGap: number,
	isSixPointer: boolean,
	isEndOfSeason: boolean,
): EndOfSeasonAdjustments {
	const adjustments: EndOfSeasonAdjustments = {
		homeWinAdjustment: 0,
		awayWinAdjustment: 0,
		bttsAdjustment: 0,
		goalsAdjustment: 0,
		drawAdjustment: 0,
	};

	// No adjustments if not end of season
	if (!isEndOfSeason) {
		return adjustments;
	}

	// Base motivation-based win adjustments
	// Max ±8% based on motivation gap
	adjustments.homeWinAdjustment = Math.min(8, Math.max(-8, motivationGap * 0.08));
	adjustments.awayWinAdjustment = -adjustments.homeWinAdjustment;

	// Six-pointer adjustments
	if (isSixPointer) {
		// Six-pointers are typically cagier
		adjustments.bttsAdjustment -= 4;
		adjustments.goalsAdjustment -= 3;
		adjustments.drawAdjustment += 3;
	}

	// Stakes-specific adjustments
	adjustments.homeWinAdjustment += getStakesWinAdjustment(homeStakes);
	adjustments.awayWinAdjustment += getStakesWinAdjustment(awayStakes);

	// Goals adjustments based on stakes
	adjustments.goalsAdjustment += getStakesGoalsAdjustment(homeStakes, awayStakes);

	// BTTS adjustments
	adjustments.bttsAdjustment += getStakesBttsAdjustment(homeStakes, awayStakes);

	// Clamp all values
	adjustments.homeWinAdjustment = clamp(adjustments.homeWinAdjustment, -12, 12);
	adjustments.awayWinAdjustment = clamp(adjustments.awayWinAdjustment, -12, 12);
	adjustments.bttsAdjustment = clamp(adjustments.bttsAdjustment, -8, 8);
	adjustments.goalsAdjustment = clamp(adjustments.goalsAdjustment, -6, 6);
	adjustments.drawAdjustment = clamp(adjustments.drawAdjustment, -5, 8);

	return adjustments;
}

/**
 * Get win probability adjustment for specific stakes
 */
function getStakesWinAdjustment(stakes: SeasonStakes): number {
	switch (stakes) {
		case "TITLE_RACE":
			return 3; // Highly motivated
		case "RELEGATION_BATTLE":
			return 4; // Fight for survival
		case "CL_QUALIFICATION":
			return 2;
		case "EUROPA_RACE":
			return 1;
		case "ALREADY_RELEGATED":
			return -5; // Demoralized
		case "ALREADY_CHAMPION":
			return -3; // May rest players
		case "NOTHING_TO_PLAY":
			return -2;
		default:
			return 0;
	}
}

/**
 * Get goals adjustment based on combined stakes
 */
function getStakesGoalsAdjustment(homeStakes: SeasonStakes, awayStakes: SeasonStakes): number {
	let adjustment = 0;

	// Teams with nothing to play for tend to be more open
	if (homeStakes === "NOTHING_TO_PLAY") adjustment += 2;
	if (awayStakes === "NOTHING_TO_PLAY") adjustment += 2;

	// Already relegated teams often concede more
	if (homeStakes === "ALREADY_RELEGATED") adjustment += 3;
	if (awayStakes === "ALREADY_RELEGATED") adjustment += 3;

	// High-stakes matches are typically tighter
	if (homeStakes === "RELEGATION_BATTLE" && awayStakes === "RELEGATION_BATTLE") {
		adjustment -= 4;
	}

	if (homeStakes === "TITLE_RACE" || awayStakes === "TITLE_RACE") {
		adjustment -= 2;
	}

	return adjustment;
}

/**
 * Get BTTS adjustment based on combined stakes
 */
function getStakesBttsAdjustment(homeStakes: SeasonStakes, awayStakes: SeasonStakes): number {
	let adjustment = 0;

	// Already relegated tend to be leaky defensively
	if (homeStakes === "ALREADY_RELEGATED") adjustment += 4;
	if (awayStakes === "ALREADY_RELEGATED") adjustment += 4;

	// Nothing to play for = more open
	if (homeStakes === "NOTHING_TO_PLAY" && awayStakes === "NOTHING_TO_PLAY") {
		adjustment += 3;
	}

	// High stakes = more defensive
	if (homeStakes === "RELEGATION_BATTLE" || awayStakes === "RELEGATION_BATTLE") {
		adjustment -= 3;
	}

	return adjustment;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Clamp a value between min and max
 */
function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

/**
 * Build human-readable summary of end-of-season context
 */
function buildEndOfSeasonSummary(
	homeTeamName: string,
	awayTeamName: string,
	homeStakes: SeasonStakes,
	awayStakes: SeasonStakes,
	isSixPointer: boolean,
	isEndOfSeason: boolean,
): string {
	if (!isEndOfSeason) {
		return "Not end of season";
	}

	const parts: string[] = [];

	// Home team stakes
	parts.push(`${homeTeamName}: ${formatStakes(homeStakes)}`);

	// Away team stakes
	parts.push(`${awayTeamName}: ${formatStakes(awayStakes)}`);

	// Six-pointer
	if (isSixPointer) {
		parts.push("Six-pointer match");
	}

	return parts.join(". ");
}

/**
 * Format stakes for human-readable output
 */
function formatStakes(stakes: SeasonStakes): string {
	switch (stakes) {
		case "TITLE_RACE":
			return "Fighting for title";
		case "CL_QUALIFICATION":
			return "Fighting for Champions League";
		case "EUROPA_RACE":
			return "Fighting for Europa League";
		case "CONFERENCE_RACE":
			return "Fighting for Conference League";
		case "RELEGATION_BATTLE":
			return "Fighting relegation";
		case "NOTHING_TO_PLAY":
			return "Nothing to play for";
		case "ALREADY_RELEGATED":
			return "Already relegated";
		case "ALREADY_CHAMPION":
			return "Already champions";
		default:
			return "Unknown";
	}
}

/**
 * Get stakes description for insights
 */
export function getStakesDescription(stakes: SeasonStakes): string {
	return formatStakes(stakes);
}

/**
 * Convert end-of-season context to adjustments array for simulations
 */
export function getEndOfSeasonAdjustments(
	context: EndOfSeasonContext,
): Adjustment[] {
	const adjustments: Adjustment[] = [];

	if (!context.isEndOfSeason) {
		return adjustments;
	}

	// Add motivation gap adjustment
	if (Math.abs(context.motivationGap) > 20) {
		const moreMotivated = context.motivationGap > 0 ? "Home" : "Away";
		adjustments.push(
			createAdjustment(
				"motivation",
				context.motivationGap > 0
					? context.adjustments.homeWinAdjustment
					: context.adjustments.awayWinAdjustment,
				`${moreMotivated} team significantly more motivated (end of season)`,
			),
		);
	}

	// Add six-pointer adjustment
	if (context.isSixPointer) {
		adjustments.push(
			createAdjustment(
				"context",
				context.adjustments.drawAdjustment,
				"Six-pointer match - higher draw probability",
			),
		);
	}

	// Add relegation battle adjustment
	if (
		context.homeStakes === "RELEGATION_BATTLE" ||
		context.awayStakes === "RELEGATION_BATTLE"
	) {
		adjustments.push(
			createAdjustment(
				"motivation",
				3,
				"Relegation battle - expect intense, low-scoring affair",
			),
		);
	}

	// Add title race adjustment
	if (context.homeStakes === "TITLE_RACE" || context.awayStakes === "TITLE_RACE") {
		adjustments.push(
			createAdjustment("motivation", 2, "Title race match - high intensity expected"),
		);
	}

	// Add nothing-to-play-for adjustment
	if (
		context.homeStakes === "NOTHING_TO_PLAY" &&
		context.awayStakes === "NOTHING_TO_PLAY"
	) {
		adjustments.push(
			createAdjustment(
				"context",
				-3,
				"Neither team has anything to play for - potential dead rubber",
			),
		);
	}

	return adjustments;
}

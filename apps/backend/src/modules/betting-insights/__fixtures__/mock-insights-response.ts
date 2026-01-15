/**
 * Mock fixtures for integration tests
 */

import type { BettingInsightsResponse } from "../types";

/**
 * Creates a minimal valid BettingInsightsResponse for testing
 */
export function createMockInsightsResponse(
	overrides: Partial<BettingInsightsResponse> = {},
): BettingInsightsResponse {
	return {
		fixtureId: 1234567,
		match: {
			homeTeam: "Liverpool",
			awayTeam: "Manchester City",
			league: "Premier League",
			date: "2026-01-20T15:00:00Z",
			status: "NS",
		},
		homeTeamContext: {
			id: 40,
			name: "Liverpool",
			form: "WWDWW",
			leaguePosition: 2,
			daysSinceLastMatch: 4,
			motivation: "TITLE_RACE",
			mind: {
				performanceTier: 1,
				tier: 1,
				efficiencyIndex: 2.5,
				tierIsDivisionAware: false,
			},
			mood: {
				performanceTier: 1,
				tier: 1,
				isSleepingGiant: false,
				isOverPerformer: false,
				tierIsDivisionAware: false,
			},
			dna: {
				mostPlayedFormation: "4-3-3",
				goalLineOverPct: { "2.5": 65 },
				cleanSheetPercentage: 35,
				isLateStarter: false,
			},
		},
		awayTeamContext: {
			id: 50,
			name: "Manchester City",
			form: "WLWWW",
			leaguePosition: 1,
			daysSinceLastMatch: 3,
			motivation: "TITLE_RACE",
			mind: {
				performanceTier: 1,
				tier: 1,
				efficiencyIndex: 2.7,
				tierIsDivisionAware: false,
			},
			mood: {
				performanceTier: 1,
				tier: 1,
				isSleepingGiant: false,
				isOverPerformer: false,
				tierIsDivisionAware: false,
			},
			dna: {
				mostPlayedFormation: "4-3-3",
				goalLineOverPct: { "2.5": 70 },
				cleanSheetPercentage: 40,
				isLateStarter: false,
			},
		},
		matchContext: {
			matchType: "LEAGUE",
			matchImportance: "HIGH",
			isKnockout: false,
			isDerby: false,
			isNeutralVenue: false,
			isEarlySeason: false,
			roundNumber: 22,
			isPostInternationalBreak: false,
			isEndOfSeason: false,
			formationStability: {
				homeFormation: "4-3-3",
				awayFormation: "4-3-3",
				homeMostPlayedFormation: "4-3-3",
				awayMostPlayedFormation: "4-3-3",
				homeFormationUsage: 85,
				awayFormationUsage: 90,
				homeIsExperimental: false,
				awayIsExperimental: false,
				homeFormationReduction: 0,
				awayFormationReduction: 0,
				totalFormationReduction: 0,
			},
		},
		simulations: [
			{
				scenarioType: "BothTeamsToScore",
				probabilityDistribution: {
					yes: 65,
					no: 35,
				},
				signalStrength: "Moderate",
				modelReliability: "HIGH",
				insights: [],
				mostProbableOutcome: "Yes",
				adjustmentsApplied: [],
			},
			{
				scenarioType: "MatchOutcome",
				probabilityDistribution: {
					home: 45,
					draw: 28,
					away: 27,
				},
				signalStrength: "Balanced",
				modelReliability: "MEDIUM",
				insights: [],
				mostProbableOutcome: "Home",
			},
			{
				scenarioType: "TotalGoalsOverUnder",
				line: 2.5,
				probabilityDistribution: {
					over: 58,
					under: 42,
				},
				signalStrength: "Moderate",
				modelReliability: "MEDIUM",
				insights: [],
				mostProbableOutcome: "Over 2.5",
			},
			{
				scenarioType: "FirstHalfActivity",
				probabilityDistribution: {
					yes: 68,
					no: 32,
				},
				signalStrength: "Moderate",
				modelReliability: "MEDIUM",
				insights: [],
				mostProbableOutcome: "Goals in first half",
			},
		],
		homeInsights: [
			{
				text: "Liverpool are on a 4-match winning streak",
				emoji: "🔥",
				category: "FORM",
				severity: "HIGH",
				priority: 95,
			},
		],
		awayInsights: [
			{
				text: "Manchester City have scored in their last 10 matches",
				emoji: "⚽",
				category: "SCORING",
				severity: "HIGH",
				priority: 90,
			},
		],
		h2hInsights: [
			{
				text: "Both teams have scored in 4 of their last 5 meetings",
				emoji: "🤝",
				category: "H2H",
				severity: "MEDIUM",
				priority: 85,
			},
		],
		dataQuality: {
			mindDataQuality: "HIGH",
			moodDataQuality: "HIGH",
			h2hDataQuality: "MEDIUM",
			overallConfidenceMultiplier: 0.9,
			warnings: [],
		},
		overallConfidence: "MEDIUM",
		generatedAt: new Date().toISOString(),
		source: "API",
		...overrides,
	};
}

/**
 * Creates a mock response for an upcoming match
 */
export function createMockUpcomingMatchResponse(): BettingInsightsResponse {
	const futureDate = new Date();
	futureDate.setDate(futureDate.getDate() + 3);

	return createMockInsightsResponse({
		match: {
			homeTeam: "Liverpool",
			awayTeam: "Manchester City",
			league: "Premier League",
			date: futureDate.toISOString(),
			status: "NS",
		},
	});
}

/**
 * Creates a mock response for a live match
 */
export function createMockLiveMatchResponse(): BettingInsightsResponse {
	return createMockInsightsResponse({
		match: {
			homeTeam: "Liverpool",
			awayTeam: "Manchester City",
			league: "Premier League",
			date: new Date().toISOString(),
			status: "1H",
		},
	});
}

/**
 * Creates a mock response for a finished match
 */
export function createMockFinishedMatchResponse(): BettingInsightsResponse {
	const pastDate = new Date();
	pastDate.setDate(pastDate.getDate() - 1);

	return createMockInsightsResponse({
		match: {
			homeTeam: "Liverpool",
			awayTeam: "Manchester City",
			league: "Premier League",
			date: pastDate.toISOString(),
			status: "FT",
		},
	});
}

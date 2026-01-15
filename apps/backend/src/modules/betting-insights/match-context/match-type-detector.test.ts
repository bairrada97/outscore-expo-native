/**
 * Tests for match-type-detector.ts
 *
 * Match type detection including league/cup/international/friendly classification,
 * knockout stage detection, importance calculation, and weight adjustments.
 */

import { describe, expect, it } from "vitest";
import {
	detectMatchType,
	getWeightAdjustments,
	isHighStakes,
	shouldBeConservative,
	getMatchTypeConfidenceReduction,
	applyWeightAdjustmentsToMarket,
	type MatchType,
} from "./match-type-detector";

describe("detectMatchType", () => {
	describe("match type category detection", () => {
		it("should detect league match", () => {
			const result = detectMatchType("Premier League", "Regular Season - 15");
			expect(result.type).toBe("LEAGUE");
		});

		it("should detect league match for La Liga", () => {
			const result = detectMatchType("La Liga", "Regular Season - 20");
			expect(result.type).toBe("LEAGUE");
		});

		it("should detect cup match from FA Cup", () => {
			const result = detectMatchType("FA Cup", "Round 3");
			expect(result.type).toBe("CUP");
		});

		it("should detect cup match from Copa del Rey", () => {
			const result = detectMatchType("Copa del Rey", "Round of 16");
			expect(result.type).toBe("CUP");
		});

		it("should detect cup match from DFB Pokal", () => {
			const result = detectMatchType("DFB-Pokal", "Quarter-final");
			expect(result.type).toBe("CUP");
		});

		it("should detect cup match from Taça de Portugal with accents", () => {
			const result = detectMatchType("Taça de Portugal", "Semi-final");
			expect(result.type).toBe("CUP");
		});

		it("should detect international match from Champions League", () => {
			const result = detectMatchType("UEFA Champions League", "Group A");
			expect(result.type).toBe("INTERNATIONAL");
		});

		it("should detect international match from Europa League", () => {
			const result = detectMatchType("UEFA Europa League", "Round of 16");
			expect(result.type).toBe("INTERNATIONAL");
		});

		it("should detect international match from Conference League", () => {
			const result = detectMatchType("UEFA Europa Conference League", "Semi-final");
			expect(result.type).toBe("INTERNATIONAL");
		});

		it("should detect international match from Copa Libertadores", () => {
			const result = detectMatchType("Copa Libertadores", "Final");
			expect(result.type).toBe("INTERNATIONAL");
		});

		it("should detect friendly match", () => {
			const result = detectMatchType("Club Friendlies", "Friendly");
			expect(result.type).toBe("FRIENDLY");
		});

		it("should detect preseason match", () => {
			const result = detectMatchType("Pre-season Tournament", "Group Stage");
			expect(result.type).toBe("FRIENDLY");
		});

		it("should detect amistoso (Spanish friendly)", () => {
			const result = detectMatchType("Amistoso Internacional", "1st Leg");
			expect(result.type).toBe("FRIENDLY");
		});
	});

	describe("knockout stage detection", () => {
		it("should detect final as knockout", () => {
			const result = detectMatchType("FA Cup", "Final");
			expect(result.isKnockout).toBe(true);
		});

		it("should detect semi-final as knockout", () => {
			const result = detectMatchType("Copa del Rey", "Semi-final");
			expect(result.isKnockout).toBe(true);
		});

		it("should detect quarter-final as knockout", () => {
			const result = detectMatchType("DFB-Pokal", "Quarter-final");
			expect(result.isKnockout).toBe(true);
		});

		it("should detect round of 16 as knockout", () => {
			const result = detectMatchType("UEFA Champions League", "Round of 16");
			expect(result.isKnockout).toBe(true);
		});

		it("should detect 1/8 notation as knockout", () => {
			const result = detectMatchType("Copa del Rey", "1/8 Final");
			expect(result.isKnockout).toBe(true);
		});

		it("should detect playoff as knockout", () => {
			const result = detectMatchType("Championship", "Playoff Semi-final");
			expect(result.isKnockout).toBe(true);
		});

		it("should NOT detect group stage as knockout", () => {
			const result = detectMatchType("UEFA Champions League", "Group A - Matchday 3");
			expect(result.isKnockout).toBe(false);
		});

		it("should NOT detect regular season as knockout", () => {
			const result = detectMatchType("Premier League", "Regular Season - 20");
			expect(result.isKnockout).toBe(false);
		});
	});

	describe("importance calculation", () => {
		it("should mark final as CRITICAL", () => {
			const result = detectMatchType("FA Cup", "Final");
			expect(result.importance).toBe("CRITICAL");
		});

		it("should mark championship as CRITICAL", () => {
			const result = detectMatchType("Championship Playoff", "Final");
			expect(result.importance).toBe("CRITICAL");
		});

		it("should mark title decider as CRITICAL", () => {
			const result = detectMatchType("Premier League Title Decider", "Matchday 38");
			expect(result.importance).toBe("CRITICAL");
		});

		it("should NOT mark quarter-final as CRITICAL (should be HIGH)", () => {
			const result = detectMatchType("FA Cup", "Quarter-final");
			expect(result.importance).toBe("HIGH");
		});

		it("should NOT mark semi-final as CRITICAL (should be HIGH)", () => {
			const result = detectMatchType("Copa del Rey", "Semi-final");
			expect(result.importance).toBe("HIGH");
		});

		it("should mark Champions League group as HIGH", () => {
			const result = detectMatchType("UEFA Champions League", "Group A");
			expect(result.importance).toBe("HIGH");
		});

		it("should mark friendly as LOW", () => {
			const result = detectMatchType("Club Friendlies", "Friendly");
			expect(result.importance).toBe("LOW");
		});

		it("should mark regular league match as MEDIUM", () => {
			const result = detectMatchType("Premier League", "Matchday 15");
			expect(result.importance).toBe("MEDIUM");
		});
	});

	describe("neutral venue detection", () => {
		it("should detect Super Cup as neutral venue", () => {
			const result = detectMatchType("UEFA Super Cup", "Final");
			expect(result.isNeutralVenue).toBe(true);
		});

		it("should detect Community Shield as neutral venue", () => {
			const result = detectMatchType("Community Shield", "2024");
			expect(result.isNeutralVenue).toBe(true);
		});

		it("should detect Supercopa as neutral venue", () => {
			const result = detectMatchType("Supercopa de España", "Final");
			expect(result.isNeutralVenue).toBe(true);
		});

		it("should detect cup final as neutral venue", () => {
			const result = detectMatchType("FA Cup", "Final");
			expect(result.isNeutralVenue).toBe(true);
		});

		it("should NOT detect quarter-final as neutral venue", () => {
			const result = detectMatchType("FA Cup", "Quarter-final");
			expect(result.isNeutralVenue).toBe(false);
		});

		it("should NOT detect semi-final as neutral venue", () => {
			const result = detectMatchType("FA Cup", "Semi-final");
			expect(result.isNeutralVenue).toBe(false);
		});

		it("should NOT detect league match as neutral venue", () => {
			const result = detectMatchType("Premier League", "Matchday 15");
			expect(result.isNeutralVenue).toBe(false);
		});
	});

	describe("stage name extraction", () => {
		it("should extract Final stage name", () => {
			const result = detectMatchType("FA Cup", "Final");
			expect(result.stageName).toBe("Final");
		});

		it("should extract Semi-Final stage name", () => {
			const result = detectMatchType("FA Cup", "Semi-final");
			expect(result.stageName).toBe("Semi-Final");
		});

		it("should extract Quarter-Final stage name", () => {
			const result = detectMatchType("FA Cup", "Quarter-final");
			expect(result.stageName).toBe("Quarter-Final");
		});

		it("should extract Round of 16 stage name", () => {
			const result = detectMatchType("Champions League", "Round of 16");
			expect(result.stageName).toBe("Round of 16");
		});

		it("should extract Group Stage stage name", () => {
			const result = detectMatchType("Champions League", "Group Stage - Matchday 3");
			expect(result.stageName).toBe("Group Stage");
		});

		it("should extract Playoff stage name", () => {
			const result = detectMatchType("Championship", "Playoff Final");
			expect(result.stageName).toBe("Playoff");
		});

		it("should NOT extract stage name for regular league match", () => {
			const result = detectMatchType("Premier League", "Matchday 15");
			expect(result.stageName).toBeUndefined();
		});
	});

	describe("edge cases", () => {
		it("should handle empty round", () => {
			const result = detectMatchType("Premier League");
			expect(result.type).toBe("LEAGUE");
		});

		it("should handle numeric round", () => {
			const result = detectMatchType("Serie A", 25);
			expect(result.type).toBe("LEAGUE");
		});

		it("should normalize accented characters", () => {
			// "Taça" should match "taca" keyword
			const result = detectMatchType("Taça de Portugal", "Final");
			expect(result.type).toBe("CUP");
		});

		it("should be case insensitive", () => {
			const result = detectMatchType("FA CUP", "FINAL");
			expect(result.type).toBe("CUP");
			expect(result.importance).toBe("CRITICAL");
		});
	});
});

describe("getWeightAdjustments", () => {
	describe("friendly adjustments", () => {
		it("should reduce all weights for friendlies", () => {
			const matchType: MatchType = {
				type: "FRIENDLY",
				importance: "LOW",
				isKnockout: false,
				isNeutralVenue: false,
				isDerby: false,
				isEndOfSeason: false,
				isPostInternationalBreak: false,
			};

			const adjustments = getWeightAdjustments(matchType);

			expect(adjustments.recentForm).toBe(0.7);
			expect(adjustments.h2h).toBe(0.5);
			expect(adjustments.homeAdvantage).toBe(0.5);
			expect(adjustments.motivation).toBe(0.5);
			expect(adjustments.goalScoring).toBe(1.1);
		});
	});

	describe("cup adjustments", () => {
		it("should increase motivation for knockout cup matches", () => {
			const matchType: MatchType = {
				type: "CUP",
				importance: "HIGH",
				isKnockout: true,
				isNeutralVenue: false,
				isDerby: false,
				isEndOfSeason: false,
				isPostInternationalBreak: false,
			};

			const adjustments = getWeightAdjustments(matchType);

			expect(adjustments.motivation).toBe(1.5);
			expect(adjustments.recentForm).toBe(0.9);
			expect(adjustments.goalScoring).toBe(0.85);
		});

		it("should have moderate adjustments for early cup rounds", () => {
			const matchType: MatchType = {
				type: "CUP",
				importance: "MEDIUM",
				isKnockout: false,
				isNeutralVenue: false,
				isDerby: false,
				isEndOfSeason: false,
				isPostInternationalBreak: false,
			};

			const adjustments = getWeightAdjustments(matchType);

			expect(adjustments.motivation).toBe(1.2);
			expect(adjustments.recentForm).toBe(0.95);
		});
	});

	describe("international adjustments", () => {
		it("should increase H2H and motivation for international matches", () => {
			const matchType: MatchType = {
				type: "INTERNATIONAL",
				importance: "HIGH",
				isKnockout: false,
				isNeutralVenue: false,
				isDerby: false,
				isEndOfSeason: false,
				isPostInternationalBreak: false,
			};

			const adjustments = getWeightAdjustments(matchType);

			expect(adjustments.h2h).toBe(1.2);
			expect(adjustments.motivation).toBe(1.3);
			expect(adjustments.recentForm).toBe(0.85);
		});
	});

	describe("league adjustments", () => {
		it("should return neutral adjustments for regular league match", () => {
			const matchType: MatchType = {
				type: "LEAGUE",
				importance: "MEDIUM",
				isKnockout: false,
				isNeutralVenue: false,
				isDerby: false,
				isEndOfSeason: false,
				isPostInternationalBreak: false,
			};

			const adjustments = getWeightAdjustments(matchType);

			expect(adjustments.recentForm).toBe(1.0);
			expect(adjustments.h2h).toBe(1.0);
			expect(adjustments.homeAdvantage).toBe(1.0);
			expect(adjustments.motivation).toBe(1.0);
			expect(adjustments.goalScoring).toBe(1.0);
		});

		it("should apply knockout adjustments for league playoffs", () => {
			const matchType: MatchType = {
				type: "LEAGUE",
				importance: "HIGH",
				isKnockout: true,
				isNeutralVenue: false,
				isDerby: false,
				isEndOfSeason: false,
				isPostInternationalBreak: false,
			};

			const adjustments = getWeightAdjustments(matchType);

			expect(adjustments.motivation).toBe(1.3);
			expect(adjustments.goalScoring).toBe(0.9);
		});
	});

	describe("neutral venue adjustment", () => {
		it("should reduce home advantage by 50% for neutral venue", () => {
			const matchType: MatchType = {
				type: "LEAGUE",
				importance: "MEDIUM",
				isKnockout: false,
				isNeutralVenue: true,
				isDerby: false,
				isEndOfSeason: false,
				isPostInternationalBreak: false,
			};

			const adjustments = getWeightAdjustments(matchType);

			expect(adjustments.homeAdvantage).toBe(0.5);
		});
	});

	describe("derby adjustment", () => {
		it("should increase motivation and decrease form reliability for derbies", () => {
			const matchType: MatchType = {
				type: "LEAGUE",
				importance: "MEDIUM",
				isKnockout: false,
				isNeutralVenue: false,
				isDerby: true,
				isEndOfSeason: false,
				isPostInternationalBreak: false,
			};

			const adjustments = getWeightAdjustments(matchType);

			expect(adjustments.motivation).toBe(1.2);
			expect(adjustments.recentForm).toBe(0.85);
		});
	});

	describe("end-of-season adjustment", () => {
		it("should increase motivation for end-of-season matches", () => {
			const matchType: MatchType = {
				type: "LEAGUE",
				importance: "MEDIUM",
				isKnockout: false,
				isNeutralVenue: false,
				isDerby: false,
				isEndOfSeason: true,
				isPostInternationalBreak: false,
			};

			const adjustments = getWeightAdjustments(matchType);

			expect(adjustments.motivation).toBe(1.25);
		});
	});

	describe("post-international break adjustment", () => {
		it("should reduce form reliability and increase H2H after international break", () => {
			const matchType: MatchType = {
				type: "LEAGUE",
				importance: "MEDIUM",
				isKnockout: false,
				isNeutralVenue: false,
				isDerby: false,
				isEndOfSeason: false,
				isPostInternationalBreak: true,
			};

			const adjustments = getWeightAdjustments(matchType);

			expect(adjustments.recentForm).toBe(0.8);
			expect(adjustments.h2h).toBe(1.15);
		});
	});

	describe("combined adjustments", () => {
		it("should stack multiple adjustments", () => {
			const matchType: MatchType = {
				type: "LEAGUE",
				importance: "MEDIUM",
				isKnockout: false,
				isNeutralVenue: false,
				isDerby: true,
				isEndOfSeason: true,
				isPostInternationalBreak: false,
			};

			const adjustments = getWeightAdjustments(matchType);

			// Derby: motivation * 1.2, form * 0.85
			// End of season: motivation * 1.25
			// Combined: motivation = 1.2 * 1.25 = 1.5
			expect(adjustments.motivation).toBe(1.5);
			expect(adjustments.recentForm).toBe(0.85);
		});
	});
});

describe("isHighStakes", () => {
	it("should return true for CRITICAL importance", () => {
		const matchType: MatchType = {
			type: "CUP",
			importance: "CRITICAL",
			isKnockout: true,
			isNeutralVenue: true,
			isDerby: false,
			isEndOfSeason: false,
			isPostInternationalBreak: false,
		};

		expect(isHighStakes(matchType)).toBe(true);
	});

	it("should return true for HIGH importance", () => {
		const matchType: MatchType = {
			type: "CUP",
			importance: "HIGH",
			isKnockout: true,
			isNeutralVenue: false,
			isDerby: false,
			isEndOfSeason: false,
			isPostInternationalBreak: false,
		};

		expect(isHighStakes(matchType)).toBe(true);
	});

	it("should return true for knockout regardless of importance", () => {
		const matchType: MatchType = {
			type: "CUP",
			importance: "MEDIUM",
			isKnockout: true,
			isNeutralVenue: false,
			isDerby: false,
			isEndOfSeason: false,
			isPostInternationalBreak: false,
		};

		expect(isHighStakes(matchType)).toBe(true);
	});

	it("should return false for regular league match", () => {
		const matchType: MatchType = {
			type: "LEAGUE",
			importance: "MEDIUM",
			isKnockout: false,
			isNeutralVenue: false,
			isDerby: false,
			isEndOfSeason: false,
			isPostInternationalBreak: false,
		};

		expect(isHighStakes(matchType)).toBe(false);
	});

	it("should return false for LOW importance non-knockout", () => {
		const matchType: MatchType = {
			type: "FRIENDLY",
			importance: "LOW",
			isKnockout: false,
			isNeutralVenue: false,
			isDerby: false,
			isEndOfSeason: false,
			isPostInternationalBreak: false,
		};

		expect(isHighStakes(matchType)).toBe(false);
	});
});

describe("shouldBeConservative", () => {
	it("should return true for friendlies", () => {
		const matchType: MatchType = {
			type: "FRIENDLY",
			importance: "LOW",
			isKnockout: false,
			isNeutralVenue: false,
			isDerby: false,
			isEndOfSeason: false,
			isPostInternationalBreak: false,
		};

		expect(shouldBeConservative(matchType)).toBe(true);
	});

	it("should return true for LOW importance", () => {
		const matchType: MatchType = {
			type: "LEAGUE",
			importance: "LOW",
			isKnockout: false,
			isNeutralVenue: false,
			isDerby: false,
			isEndOfSeason: false,
			isPostInternationalBreak: false,
		};

		expect(shouldBeConservative(matchType)).toBe(true);
	});

	it("should return false for regular league match", () => {
		const matchType: MatchType = {
			type: "LEAGUE",
			importance: "MEDIUM",
			isKnockout: false,
			isNeutralVenue: false,
			isDerby: false,
			isEndOfSeason: false,
			isPostInternationalBreak: false,
		};

		expect(shouldBeConservative(matchType)).toBe(false);
	});

	it("should return false for cup matches", () => {
		const matchType: MatchType = {
			type: "CUP",
			importance: "HIGH",
			isKnockout: true,
			isNeutralVenue: false,
			isDerby: false,
			isEndOfSeason: false,
			isPostInternationalBreak: false,
		};

		expect(shouldBeConservative(matchType)).toBe(false);
	});
});

describe("getMatchTypeConfidenceReduction", () => {
	it("should return 20 for friendlies", () => {
		const matchType: MatchType = {
			type: "FRIENDLY",
			importance: "LOW",
			isKnockout: false,
			isNeutralVenue: false,
			isDerby: false,
			isEndOfSeason: false,
			isPostInternationalBreak: false,
		};

		expect(getMatchTypeConfidenceReduction(matchType)).toBe(20);
	});

	it("should return 10 for knockout matches", () => {
		const matchType: MatchType = {
			type: "CUP",
			importance: "HIGH",
			isKnockout: true,
			isNeutralVenue: false,
			isDerby: false,
			isEndOfSeason: false,
			isPostInternationalBreak: false,
		};

		expect(getMatchTypeConfidenceReduction(matchType)).toBe(10);
	});

	it("should return 5 for international matches", () => {
		const matchType: MatchType = {
			type: "INTERNATIONAL",
			importance: "HIGH",
			isKnockout: false,
			isNeutralVenue: false,
			isDerby: false,
			isEndOfSeason: false,
			isPostInternationalBreak: false,
		};

		expect(getMatchTypeConfidenceReduction(matchType)).toBe(5);
	});

	it("should return 0 for derbies (derby variance is handled by derby-detector adjustments)", () => {
		const matchType: MatchType = {
			type: "LEAGUE",
			importance: "MEDIUM",
			isKnockout: false,
			isNeutralVenue: false,
			isDerby: true,
			isEndOfSeason: false,
			isPostInternationalBreak: false,
		};

		expect(getMatchTypeConfidenceReduction(matchType)).toBe(0);
	});

	it("should return 0 for regular league match", () => {
		const matchType: MatchType = {
			type: "LEAGUE",
			importance: "MEDIUM",
			isKnockout: false,
			isNeutralVenue: false,
			isDerby: false,
			isEndOfSeason: false,
			isPostInternationalBreak: false,
		};

		expect(getMatchTypeConfidenceReduction(matchType)).toBe(0);
	});

	it("should prioritize friendly over knockout", () => {
		// If somehow a friendly is marked as knockout, friendly takes precedence
		const matchType: MatchType = {
			type: "FRIENDLY",
			importance: "LOW",
			isKnockout: true,
			isNeutralVenue: false,
			isDerby: false,
			isEndOfSeason: false,
			isPostInternationalBreak: false,
		};

		expect(getMatchTypeConfidenceReduction(matchType)).toBe(20);
	});
});

describe("applyWeightAdjustmentsToMarket", () => {
	const baseWeights = {
		recentForm: 25,
		h2hScore: 20,
		homeAdvantage: 15,
		motivationLevel: 20,
		goalScoringRate: 20,
	};

	it("should apply adjustments to matching weight keys", () => {
		const adjustments = {
			recentForm: 0.8,
			h2h: 1.2,
			homeAdvantage: 0.5,
			motivation: 1.5,
			goalScoring: 0.9,
		};

		const result = applyWeightAdjustmentsToMarket(baseWeights, adjustments);

		// Values should change but be normalized
		// The function normalizes to maintain original sum
		expect(result.recentForm).not.toBe(baseWeights.recentForm);
		expect(result.h2hScore).not.toBe(baseWeights.h2hScore);
	});

	it("should maintain approximate sum after normalization", () => {
		const adjustments = {
			recentForm: 0.5,
			h2h: 1.5,
			homeAdvantage: 0.5,
			motivation: 1.5,
			goalScoring: 1.0,
		};

		const result = applyWeightAdjustmentsToMarket(baseWeights, adjustments);

		const originalSum = Object.values(baseWeights).reduce((a, b) => a + b, 0);
		const adjustedSum = Object.values(result).reduce((a, b) => a + b, 0);

		// Should be approximately equal due to normalization
		expect(Math.abs(originalSum - adjustedSum)).toBeLessThan(0.01);
	});

	it("should not modify unmatched keys", () => {
		const weightsWithExtra = {
			...baseWeights,
			customWeight: 10,
		};

		const adjustments = {
			recentForm: 0.8,
			h2h: 1.2,
			homeAdvantage: 0.5,
			motivation: 1.5,
			goalScoring: 0.9,
		};

		const result = applyWeightAdjustmentsToMarket(weightsWithExtra, adjustments);

		// Custom weight should exist (may be normalized)
		expect(result.customWeight).toBeDefined();
	});

	it("should handle empty weights", () => {
		const emptyWeights = {};
		const adjustments = {
			recentForm: 0.8,
			h2h: 1.2,
			homeAdvantage: 0.5,
			motivation: 1.5,
			goalScoring: 0.9,
		};

		const result = applyWeightAdjustmentsToMarket(emptyWeights, adjustments);

		expect(Object.keys(result).length).toBe(0);
	});
});

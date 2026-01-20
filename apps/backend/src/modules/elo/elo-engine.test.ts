import { describe, expect, it } from "vitest";
import {
	applySeasonRegression,
	calculateAssociationOffset,
	calculateClubOffset,
	calculateEloBalanceShift,
	calculateEloConfidence,
	calculateEloGapAdjustment,
	calculateGoalMultiplier,
	calculateStartingElo,
	updateElo,
} from "./elo-engine";

describe("elo-engine", () => {
	it("updates elo symmetrically for home win", () => {
		const result = updateElo({
			homeElo: 1500,
			awayElo: 1500,
			matchType: "LEAGUE",
			goalDiff: 1,
			homeAdvantage: 0,
		});

		expect(result.homeElo).toBeGreaterThan(1500);
		expect(result.awayElo).toBeLessThan(1500);
		expect(result.homeDelta).toBeCloseTo(-result.awayDelta, 5);
	});

	it("caps goal multiplier for large margins", () => {
		expect(calculateGoalMultiplier(1)).toBe(1);
		expect(calculateGoalMultiplier(4)).toBeLessThanOrEqual(1.5);
	});

	it("applies season regression toward 1500", () => {
		expect(applySeasonRegression(1800, 0.2)).toBeLessThan(1800);
		expect(applySeasonRegression(1400, 0.2)).toBeGreaterThan(1400);
	});

	it("bounds elo gap adjustments", () => {
		const adj = calculateEloGapAdjustment(300, 1, 8);
		expect(adj).toBeLessThanOrEqual(8);
		expect(adj).toBeGreaterThanOrEqual(-8);
	});

	it("bounds elo balance shift", () => {
		const shift = calculateEloBalanceShift(300, 1, 0.08);
		expect(shift).toBeLessThanOrEqual(0.08);
		expect(shift).toBeGreaterThanOrEqual(-0.08);
	});

	it("calculates priors offsets with bounds", () => {
		expect(calculateAssociationOffset(100)).toBeLessThanOrEqual(120);
		expect(calculateClubOffset(120)).toBeLessThanOrEqual(120);
	});

	it("builds starting elo with priors", () => {
		const elo = calculateStartingElo({
			associationCoefficient5y: 60,
			clubCoefficient: 80,
		});
		expect(elo).toBeGreaterThan(1500);
	});

	it("confidence grows with games", () => {
		expect(calculateEloConfidence(0)).toBe(0);
		expect(calculateEloConfidence(50)).toBe(1);
	});
});

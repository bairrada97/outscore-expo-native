/**
 * Tests for derby-detector.ts
 *
 * Derby and rivalry detection including known rivalries,
 * same-city detection, name-based detection, and weight adjustments.
 */

import { describe, expect, it } from "vitest";
import {
	detectDerby,
	getDerbyWeightAdjustments,
	getDerbyName,
	getTeamDerbies,
	hasKnownDerbies,
	type DerbyInfo,
} from "./derby-detector";

describe("detectDerby", () => {
	describe("known rivalries", () => {
		it("should detect El Clásico (Barcelona vs Real Madrid)", () => {
			const result = detectDerby(529, 541);

			expect(result.isDerby).toBe(true);
			expect(result.derbyType).toBe("HISTORICAL");
			expect(result.derbyName).toBe("El Clásico");
			expect(result.intensity).toBe("EXTREME");
		});

		it("should detect El Clásico in reverse order", () => {
			const result = detectDerby(541, 529);

			expect(result.isDerby).toBe(true);
			expect(result.derbyName).toBe("El Clásico");
		});

		it("should detect Manchester Derby (Man Utd vs Man City)", () => {
			const result = detectDerby(33, 34);

			expect(result.isDerby).toBe(true);
			expect(result.derbyType).toBe("LOCAL");
			expect(result.derbyName).toBe("Manchester Derby");
			expect(result.intensity).toBe("EXTREME");
		});

		it("should detect North London Derby (Arsenal vs Tottenham)", () => {
			const result = detectDerby(42, 47);

			expect(result.isDerby).toBe(true);
			expect(result.derbyType).toBe("LOCAL");
			expect(result.derbyName).toBe("North London Derby");
			expect(result.intensity).toBe("EXTREME");
		});

		it("should detect Merseyside Derby (Liverpool vs Everton)", () => {
			const result = detectDerby(40, 39);

			expect(result.isDerby).toBe(true);
			expect(result.derbyType).toBe("LOCAL");
			expect(result.derbyName).toBe("Merseyside Derby");
		});

		it("should detect Derby della Madonnina (Inter vs AC Milan)", () => {
			const result = detectDerby(489, 505);

			expect(result.isDerby).toBe(true);
			expect(result.derbyType).toBe("LOCAL");
			expect(result.derbyName).toBe("Derby della Madonnina");
			expect(result.intensity).toBe("EXTREME");
		});

		it("should detect O Clássico (Benfica vs Porto)", () => {
			const result = detectDerby(211, 212);

			expect(result.isDerby).toBe(true);
			expect(result.derbyType).toBe("HISTORICAL");
			expect(result.derbyName).toBe("O Clássico");
			expect(result.intensity).toBe("EXTREME");
		});

		it("should detect Old Firm (Celtic vs Rangers)", () => {
			const result = detectDerby(247, 248);

			expect(result.isDerby).toBe(true);
			expect(result.derbyType).toBe("LOCAL");
			expect(result.derbyName).toBe("Old Firm");
			expect(result.intensity).toBe("EXTREME");
		});

		it("should detect Der Klassiker (Bayern vs Dortmund)", () => {
			const result = detectDerby(157, 165);

			expect(result.isDerby).toBe(true);
			expect(result.derbyType).toBe("HISTORICAL");
			expect(result.derbyName).toBe("Der Klassiker");
			expect(result.intensity).toBe("EXTREME");
		});

		it("should detect Le Classique (PSG vs Marseille)", () => {
			const result = detectDerby(85, 80);

			expect(result.isDerby).toBe(true);
			expect(result.derbyType).toBe("HISTORICAL");
			expect(result.derbyName).toBe("Le Classique");
			expect(result.intensity).toBe("EXTREME");
		});

		it("should detect Superclásico (Boca vs River)", () => {
			const result = detectDerby(448, 449);

			expect(result.isDerby).toBe(true);
			expect(result.derbyType).toBe("LOCAL");
			expect(result.derbyName).toBe("Superclásico");
			expect(result.intensity).toBe("EXTREME");
		});

		it("should detect historical rivalry (Man Utd vs Liverpool)", () => {
			const result = detectDerby(33, 40);

			expect(result.isDerby).toBe(true);
			expect(result.derbyType).toBe("HISTORICAL");
			expect(result.derbyName).toBe("Northwest Derby");
			expect(result.intensity).toBe("HIGH");
		});

		it("should detect regional derby (Athletic Bilbao vs Real Sociedad)", () => {
			const result = detectDerby(532, 536);

			expect(result.isDerby).toBe(true);
			expect(result.derbyType).toBe("REGIONAL");
			expect(result.derbyName).toBe("Basque Derby");
			expect(result.intensity).toBe("HIGH");
		});
	});

	describe("same-city detection", () => {
		it("should detect London derby between non-listed teams", () => {
			// Chelsea (49) vs Crystal Palace (52) - both in London teams list
			const result = detectDerby(49, 52);

			expect(result.isDerby).toBe(true);
			expect(result.derbyType).toBe("LOCAL");
			expect(result.intensity).toBe("MEDIUM");
		});

		it("should detect Madrid derby between non-rivalry teams", () => {
			// Real Madrid (541) vs Getafe (546) - same city
			const result = detectDerby(541, 546);

			expect(result.isDerby).toBe(true);
			expect(result.derbyType).toBe("LOCAL");
		});
	});

	describe("name-based detection", () => {
		it("should detect derby by shared city name in team names", () => {
			const result = detectDerby(
				9999,
				9998,
				"Sheffield United",
				"Sheffield Wednesday",
			);

			expect(result.isDerby).toBe(true);
			expect(result.derbyType).toBe("LOCAL");
			expect(result.intensity).toBe("MEDIUM");
		});

		it("should NOT detect derby for unrelated team names", () => {
			const result = detectDerby(
				9999,
				9998,
				"Brighton",
				"Newcastle",
			);

			expect(result.isDerby).toBe(false);
		});

		it("should filter out common football terms", () => {
			// "United" should not match "United"
			const result = detectDerby(
				9999,
				9998,
				"Manchester United",
				"Leeds United",
			);

			// Should not be a derby just because both have "United"
			// But "Manchester" != "Leeds"
			expect(result.isDerby).toBe(false);
		});

		it("should handle case insensitivity", () => {
			const result = detectDerby(
				9999,
				9998,
				"BRISTOL City",
				"Bristol Rovers",
			);

			expect(result.isDerby).toBe(true);
		});
	});

	describe("non-derby matches", () => {
		it("should return not a derby for unrelated teams", () => {
			const result = detectDerby(40, 157); // Liverpool vs Bayern

			expect(result.isDerby).toBe(false);
			expect(result.derbyType).toBe("NONE");
			expect(result.intensity).toBe("LOW");
			expect(result.derbyName).toBeUndefined();
		});

		it("should return not a derby for unknown team IDs", () => {
			const result = detectDerby(99999, 99998);

			expect(result.isDerby).toBe(false);
		});
	});
});

describe("getDerbyWeightAdjustments", () => {
	describe("EXTREME intensity", () => {
		it("should return maximum adjustments", () => {
			const derbyInfo: DerbyInfo = {
				isDerby: true,
				derbyType: "LOCAL",
				derbyName: "El Clásico",
				intensity: "EXTREME",
			};

			const adjustments = getDerbyWeightAdjustments(derbyInfo);

			expect(adjustments.motivationMultiplier).toBe(1.4);
			expect(adjustments.formReliabilityMultiplier).toBe(0.75);
			expect(adjustments.goalScoringMultiplier).toBe(0.9);
			expect(adjustments.confidenceReduction).toBe(12);
		});
	});

	describe("HIGH intensity", () => {
		it("should return high adjustments", () => {
			const derbyInfo: DerbyInfo = {
				isDerby: true,
				derbyType: "HISTORICAL",
				derbyName: "Northwest Derby",
				intensity: "HIGH",
			};

			const adjustments = getDerbyWeightAdjustments(derbyInfo);

			expect(adjustments.motivationMultiplier).toBe(1.25);
			expect(adjustments.formReliabilityMultiplier).toBe(0.85);
			expect(adjustments.goalScoringMultiplier).toBe(0.95);
			expect(adjustments.confidenceReduction).toBe(8);
		});
	});

	describe("MEDIUM intensity", () => {
		it("should return medium adjustments", () => {
			const derbyInfo: DerbyInfo = {
				isDerby: true,
				derbyType: "REGIONAL",
				intensity: "MEDIUM",
			};

			const adjustments = getDerbyWeightAdjustments(derbyInfo);

			expect(adjustments.motivationMultiplier).toBe(1.15);
			expect(adjustments.formReliabilityMultiplier).toBe(0.9);
			expect(adjustments.goalScoringMultiplier).toBe(0.97);
			expect(adjustments.confidenceReduction).toBe(5);
		});
	});

	describe("LOW intensity", () => {
		it("should return low adjustments", () => {
			const derbyInfo: DerbyInfo = {
				isDerby: true,
				derbyType: "LOCAL",
				intensity: "LOW",
			};

			const adjustments = getDerbyWeightAdjustments(derbyInfo);

			expect(adjustments.motivationMultiplier).toBe(1.1);
			expect(adjustments.formReliabilityMultiplier).toBe(0.95);
			expect(adjustments.goalScoringMultiplier).toBe(1.0);
			expect(adjustments.confidenceReduction).toBe(3);
		});
	});

	describe("non-derby", () => {
		it("should return neutral adjustments for non-derby", () => {
			const derbyInfo: DerbyInfo = {
				isDerby: false,
				derbyType: "NONE",
				intensity: "LOW",
			};

			const adjustments = getDerbyWeightAdjustments(derbyInfo);

			expect(adjustments.motivationMultiplier).toBe(1.0);
			expect(adjustments.formReliabilityMultiplier).toBe(1.0);
			expect(adjustments.goalScoringMultiplier).toBe(1.0);
			expect(adjustments.confidenceReduction).toBe(0);
		});
	});
});

describe("getDerbyName", () => {
	it("should return derby name for known rivalry", () => {
		const name = getDerbyName(529, 541);
		expect(name).toBe("El Clásico");
	});

	it("should return derby name for reversed team order", () => {
		const name = getDerbyName(541, 529);
		expect(name).toBe("El Clásico");
	});

	it("should return undefined for unknown rivalry", () => {
		const name = getDerbyName(99999, 99998);
		expect(name).toBeUndefined();
	});

	it("should return undefined for non-rival teams", () => {
		const name = getDerbyName(40, 157);
		expect(name).toBeUndefined();
	});
});

describe("getTeamDerbies", () => {
	it("should return all derbies for Real Madrid", () => {
		const derbies = getTeamDerbies(541);

		expect(derbies.length).toBeGreaterThan(0);

		// Should include El Clásico
		const elClasico = derbies.find((d) => d.derbyName === "El Clásico");
		expect(elClasico).toBeDefined();
		expect(elClasico?.opponentId).toBe(529); // Barcelona
	});

	it("should return all derbies for Liverpool", () => {
		const derbies = getTeamDerbies(40);

		// Should include Merseyside Derby and Northwest Derby
		expect(derbies.length).toBeGreaterThanOrEqual(2);

		const merseyside = derbies.find((d) => d.derbyName === "Merseyside Derby");
		expect(merseyside).toBeDefined();
		expect(merseyside?.opponentId).toBe(39); // Everton

		const northwest = derbies.find((d) => d.derbyName === "Northwest Derby");
		expect(northwest).toBeDefined();
		expect(northwest?.opponentId).toBe(33); // Man Utd
	});

	it("should return multiple derbies for Benfica", () => {
		const derbies = getTeamDerbies(211);

		// Should include O Clássico and Lisbon Derby
		expect(derbies.length).toBeGreaterThanOrEqual(2);

		const classicoExists = derbies.some((d) => d.derbyName === "O Clássico");
		expect(classicoExists).toBe(true);

		const lisbonDerbyExists = derbies.some((d) => d.derbyName === "Lisbon Derby");
		expect(lisbonDerbyExists).toBe(true);
	});

	it("should include derby details", () => {
		const derbies = getTeamDerbies(33); // Man Utd

		const manchesterDerby = derbies.find((d) => d.derbyName === "Manchester Derby");
		expect(manchesterDerby).toBeDefined();
		expect(manchesterDerby?.type).toBe("LOCAL");
		expect(manchesterDerby?.intensity).toBe("EXTREME");
	});

	it("should return empty array for team with no known derbies", () => {
		const derbies = getTeamDerbies(99999);
		expect(derbies).toEqual([]);
	});
});

describe("hasKnownDerbies", () => {
	it("should return true for teams with known rivalries", () => {
		expect(hasKnownDerbies(529)).toBe(true); // Barcelona
		expect(hasKnownDerbies(541)).toBe(true); // Real Madrid
		expect(hasKnownDerbies(40)).toBe(true); // Liverpool
		expect(hasKnownDerbies(157)).toBe(true); // Bayern
	});

	it("should return false for teams without known rivalries", () => {
		expect(hasKnownDerbies(99999)).toBe(false);
		expect(hasKnownDerbies(0)).toBe(false);
	});
});

describe("edge cases", () => {
	it("should handle both teams from same city without specific rivalry", () => {
		// Multiple London teams - West Ham (62) vs Fulham (55)
		const result = detectDerby(62, 55);

		expect(result.isDerby).toBe(true);
		expect(result.derbyType).toBe("LOCAL");
		expect(result.intensity).toBe("MEDIUM");
		expect(result.derbyName).toBeUndefined();
	});

	it("should prioritize known rivalry over same-city detection", () => {
		// Arsenal (42) vs Tottenham (47) - known rivalry with specific name
		const result = detectDerby(42, 47);

		expect(result.isDerby).toBe(true);
		expect(result.derbyName).toBe("North London Derby");
		expect(result.intensity).toBe("EXTREME"); // Known rivalry intensity, not default MEDIUM
	});

	it("should handle Turkish derbies with multiple teams", () => {
		// Fenerbahce vs Galatasaray
		const result1 = detectDerby(645, 610);
		expect(result1.isDerby).toBe(true);
		expect(result1.derbyName).toBe("Intercontinental Derby");

		// Fenerbahce vs Besiktas
		const result2 = detectDerby(645, 611);
		expect(result2.isDerby).toBe(true);

		// Galatasaray vs Besiktas
		const result3 = detectDerby(610, 611);
		expect(result3.isDerby).toBe(true);
	});

	it("should handle Brazilian rivalries", () => {
		// Grenal (Gremio vs Internacional)
		const result = detectDerby(130, 121);
		expect(result.isDerby).toBe(true);
		expect(result.derbyName).toBe("Grenal");
		expect(result.intensity).toBe("EXTREME");
	});
});

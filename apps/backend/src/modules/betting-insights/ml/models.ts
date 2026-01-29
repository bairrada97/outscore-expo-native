/**
 * ML Model Loading and Management
 *
 * Handles loading of exported LightGBM JSON models and provides
 * a unified interface for running inference across all markets.
 */

import type { H2HData, TeamData } from "../types";
import { computeMLFeatures, featuresToRecord } from "./compute-features";
import {
	createFeatureArray,
	predictBinary,
	predictMulticlass,
	type LightGBMModel,
} from "./lightgbm-inference";

// ============================================================================
// MODEL IMPORTS
// ============================================================================

// Import JSON models directly (bundled with worker)
// Note: These are large files (~3MB each), consider lazy loading for production
import model1x2 from "../../../../../../ml/models/output/1x2/model.json";
import modelBtts from "../../../../../../ml/models/output/btts/model.json";
import modelOu05 from "../../../../../../ml/models/output/ou_0_5/model.json";
import modelOu15 from "../../../../../../ml/models/output/ou_1_5/model.json";
import modelOu25 from "../../../../../../ml/models/output/ou_2_5/model.json";
import modelOu35 from "../../../../../../ml/models/output/ou_3_5/model.json";
import modelOu45 from "../../../../../../ml/models/output/ou_4_5/model.json";
import modelOu55 from "../../../../../../ml/models/output/ou_5_5/model.json";

// ============================================================================
// TYPES
// ============================================================================

export type MarketType =
	| "1x2"
	| "btts"
	| "ou_0_5"
	| "ou_1_5"
	| "ou_2_5"
	| "ou_3_5"
	| "ou_4_5"
	| "ou_5_5";

export interface MatchOutcomePrediction {
	home: number;
	draw: number;
	away: number;
	confidence: "high" | "medium" | "low";
}

export interface BttsPrediction {
	yes: number;
	no: number;
	confidence: "high" | "medium" | "low";
}

export interface OverUnderPrediction {
	over: number;
	under: number;
	line: number;
	confidence: "high" | "medium" | "low";
}

// ============================================================================
// MODEL REGISTRY
// ============================================================================

const models: Record<MarketType, LightGBMModel> = {
	"1x2": model1x2 as LightGBMModel,
	btts: modelBtts as LightGBMModel,
	ou_0_5: modelOu05 as LightGBMModel,
	ou_1_5: modelOu15 as LightGBMModel,
	ou_2_5: modelOu25 as LightGBMModel,
	ou_3_5: modelOu35 as LightGBMModel,
	ou_4_5: modelOu45 as LightGBMModel,
	ou_5_5: modelOu55 as LightGBMModel,
};

/**
 * Get a model by market type
 */
export function getModel(market: MarketType): LightGBMModel {
	const model = models[market];
	if (!model) {
		throw new Error(`Model not found for market: ${market}`);
	}
	return model;
}

/**
 * Get model metadata
 */
export function getModelInfo(market: MarketType): {
	numTrees: number;
	numFeatures: number;
	numClasses: number;
} {
	const model = getModel(market);
	return {
		numTrees: model.metadata.num_trees,
		numFeatures: model.feature_names.length,
		numClasses: model.metadata.num_class,
	};
}

// ============================================================================
// CONFIDENCE CALCULATION
// ============================================================================

/**
 * Calculate confidence based on data quality
 */
function calculateConfidence(
	homeTeam: TeamData,
	awayTeam: TeamData,
	h2h: H2HData | undefined,
): "high" | "medium" | "low" {
	let score = 0;

	// Check home team data quality
	if (homeTeam.mood?.formString && homeTeam.mood.formString.length >= 5) score++;
	if (homeTeam.mind?.matchCount >= 20) score++;
	if (homeTeam.elo?.confidence > 0.7) score++;

	// Check away team data quality
	if (awayTeam.mood?.formString && awayTeam.mood.formString.length >= 5) score++;
	if (awayTeam.mind?.matchCount >= 20) score++;
	if (awayTeam.elo?.confidence > 0.7) score++;

	// Check H2H data quality
	if (h2h && h2h.h2hMatchCount >= 3) score++;
	if (h2h && h2h.h2hMatchCount >= 5) score++;

	if (score >= 6) return "high";
	if (score >= 3) return "medium";
	return "low";
}

// ============================================================================
// PUBLIC PREDICTION FUNCTIONS
// ============================================================================

/**
 * Predict match outcome (1X2) using ML model
 *
 * @param homeTeam - Home team data
 * @param awayTeam - Away team data
 * @param h2h - Head-to-head data (optional)
 * @param season - Current season year
 * @param leagueId - League ID (optional)
 * @returns Match outcome probabilities
 */
export function predictMatchOutcome(
	homeTeam: TeamData,
	awayTeam: TeamData,
	h2h: H2HData | undefined,
	season: number,
	leagueId: number | null,
): MatchOutcomePrediction {
	const model = getModel("1x2");
	const features = computeMLFeatures(homeTeam, awayTeam, h2h, season, leagueId);
	const featureRecord = featuresToRecord(features);
	const featureArray = createFeatureArray(model, featureRecord);

	const prediction = predictMulticlass(model, featureArray);
	const confidence = calculateConfidence(homeTeam, awayTeam, h2h);

	return {
		home: prediction.home * 100,
		draw: prediction.draw * 100,
		away: prediction.away * 100,
		confidence,
	};
}

/**
 * Predict BTTS using ML model
 *
 * @param homeTeam - Home team data
 * @param awayTeam - Away team data
 * @param h2h - Head-to-head data (optional)
 * @param season - Current season year
 * @param leagueId - League ID (optional)
 * @returns BTTS probabilities
 */
export function predictBTTS(
	homeTeam: TeamData,
	awayTeam: TeamData,
	h2h: H2HData | undefined,
	season: number,
	leagueId: number | null,
): BttsPrediction {
	const model = getModel("btts");
	const features = computeMLFeatures(homeTeam, awayTeam, h2h, season, leagueId);
	const featureRecord = featuresToRecord(features);
	const featureArray = createFeatureArray(model, featureRecord);

	const prediction = predictBinary(model, featureArray);
	const confidence = calculateConfidence(homeTeam, awayTeam, h2h);

	return {
		yes: prediction.probability * 100,
		no: (1 - prediction.probability) * 100,
		confidence,
	};
}

/**
 * Predict Over/Under using ML model
 *
 * @param homeTeam - Home team data
 * @param awayTeam - Away team data
 * @param h2h - Head-to-head data (optional)
 * @param season - Current season year
 * @param leagueId - League ID (optional)
 * @param line - Goal line (0.5, 1.5, 2.5, 3.5, 4.5, or 5.5)
 * @returns Over/Under probabilities
 */
export function predictOverUnder(
	homeTeam: TeamData,
	awayTeam: TeamData,
	h2h: H2HData | undefined,
	season: number,
	leagueId: number | null,
	line: 0.5 | 1.5 | 2.5 | 3.5 | 4.5 | 5.5,
): OverUnderPrediction {
	const marketMap: Record<
		0.5 | 1.5 | 2.5 | 3.5 | 4.5 | 5.5,
		MarketType
	> = {
		0.5: "ou_0_5",
		1.5: "ou_1_5",
		2.5: "ou_2_5",
		3.5: "ou_3_5",
		4.5: "ou_4_5",
		5.5: "ou_5_5",
	};

	const model = getModel(marketMap[line]);
	const features = computeMLFeatures(homeTeam, awayTeam, h2h, season, leagueId);
	const featureRecord = featuresToRecord(features);
	const featureArray = createFeatureArray(model, featureRecord);

	const prediction = predictBinary(model, featureArray);
	const confidence = calculateConfidence(homeTeam, awayTeam, h2h);

	return {
		over: prediction.probability * 100,
		under: (1 - prediction.probability) * 100,
		line,
		confidence,
	};
}

/**
 * Predict all Over/Under lines
 */
export function predictAllOverUnderLines(
	homeTeam: TeamData,
	awayTeam: TeamData,
	h2h: H2HData | undefined,
	season: number,
	leagueId: number | null,
): Record<string, OverUnderPrediction> {
	return {
		"0.5": predictOverUnder(homeTeam, awayTeam, h2h, season, leagueId, 0.5),
		"1.5": predictOverUnder(homeTeam, awayTeam, h2h, season, leagueId, 1.5),
		"2.5": predictOverUnder(homeTeam, awayTeam, h2h, season, leagueId, 2.5),
		"3.5": predictOverUnder(homeTeam, awayTeam, h2h, season, leagueId, 3.5),
		"4.5": predictOverUnder(homeTeam, awayTeam, h2h, season, leagueId, 4.5),
		"5.5": predictOverUnder(homeTeam, awayTeam, h2h, season, leagueId, 5.5),
	};
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if ML models are loaded and ready
 */
export function areModelsLoaded(): boolean {
	try {
		for (const market of Object.keys(models) as MarketType[]) {
			const model = models[market];
			if (!model || !model.tree_info || model.tree_info.length === 0) {
				return false;
			}
		}
		return true;
	} catch {
		return false;
	}
}

/**
 * Get feature names for a market (useful for debugging)
 */
export function getFeatureNames(market: MarketType): string[] {
	return getModel(market).feature_names;
}

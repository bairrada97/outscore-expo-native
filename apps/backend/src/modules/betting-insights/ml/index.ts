/**
 * ML Module
 *
 * Provides ML-based predictions using trained LightGBM models.
 * This module handles:
 * - Feature computation from team/H2H data
 * - Model inference using pure TypeScript tree traversal
 * - Prediction APIs for all markets (1X2, BTTS, Over/Under)
 */

export {
	predictMatchOutcome,
	predictBTTS,
	predictOverUnder,
	predictAllOverUnderLines,
	areModelsLoaded,
	getModelInfo,
	getFeatureNames,
	type MarketType,
	type MatchOutcomePrediction,
	type BttsPrediction,
	type OverUnderPrediction,
} from "./models";

export {
	computeMLFeatures,
	featuresToRecord,
	type MLFeatures,
} from "./compute-features";

export {
	predictBinary,
	predictMulticlass,
	createFeatureArray,
	validateFeatures,
	type LightGBMModel,
	type BinaryPrediction,
	type MulticlassPrediction,
} from "./lightgbm-inference";

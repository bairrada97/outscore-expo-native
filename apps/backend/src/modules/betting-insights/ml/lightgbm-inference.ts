/**
 * LightGBM Inference Engine
 *
 * Pure TypeScript implementation of LightGBM tree traversal for inference.
 * This enables running trained LightGBM models in Cloudflare Workers without
 * ONNX or WebAssembly dependencies.
 *
 * Supports:
 * - Binary classification (sigmoid output)
 * - Multiclass classification (softmax output)
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * A node in the decision tree - either a split node or a leaf node
 *
 * MINIFIED STRUCTURE: Only inference-required fields are present in exported models.
 * Training diagnostics (gain, weights, counts, indices) are stripped to reduce size.
 */
export interface TreeNode {
	// Split node properties (required for inference)
	split_feature?: number;
	threshold?: number;
	default_left?: boolean;
	left_child?: TreeNode;
	right_child?: TreeNode;

	// Leaf node properties (required for inference)
	leaf_value?: number;
}

/**
 * Information about a single tree in the ensemble
 *
 * MINIFIED STRUCTURE: Only tree_index, shrinkage, and tree_structure are kept.
 */
export interface TreeInfo {
	tree_index: number;
	shrinkage: number;
	tree_structure: TreeNode;
}

/**
 * Model metadata
 */
export interface ModelMetadata {
	market: string;
	num_trees: number;
	num_class: number;
	feature_names: string[];
	objective: string;
}

/**
 * Complete exported model structure
 */
export interface LightGBMModel {
	metadata: ModelMetadata;
	tree_info: TreeInfo[];
	feature_names: string[];
}

/**
 * Prediction result for binary classification
 */
export interface BinaryPrediction {
	probability: number; // Probability of positive class (e.g., BTTS Yes, Over)
}

/**
 * Prediction result for multiclass classification (1X2)
 */
export interface MulticlassPrediction {
	home: number; // Probability of home win
	draw: number; // Probability of draw
	away: number; // Probability of away win
}

// ============================================================================
// TREE TRAVERSAL
// ============================================================================

/**
 * Traverse a single decision tree to get the leaf value
 *
 * @param node - Current node in the tree
 * @param features - Feature values array (ordered by feature index)
 * @returns Leaf value at the end of traversal
 */
function traverseTree(node: TreeNode, features: number[]): number {
	// Leaf node - return the value
	if (node.leaf_value !== undefined) {
		return node.leaf_value;
	}

	// Split node - decide which branch to take
	const featureIndex = node.split_feature!;
	const featureValue = features[featureIndex];

	// Handle missing values
	if (featureValue === null || featureValue === undefined || Number.isNaN(featureValue)) {
		// Use default direction for missing values
		if (node.default_left) {
			return traverseTree(node.left_child!, features);
		}
		return traverseTree(node.right_child!, features);
	}

	// Standard comparison (LightGBM uses <= for left branch)
	if (featureValue <= node.threshold!) {
		return traverseTree(node.left_child!, features);
	}
	return traverseTree(node.right_child!, features);
}

/**
 * Compute raw scores by summing all tree predictions
 *
 * For multiclass, trees are interleaved: tree 0 for class 0, tree 1 for class 1, etc.
 *
 * @param model - The LightGBM model
 * @param features - Feature values array
 * @returns Raw scores (one per class)
 */
function computeRawScores(model: LightGBMModel, features: number[]): number[] {
	const numClasses = model.metadata.num_class;
	const scores = new Array(numClasses).fill(0);

	for (let i = 0; i < model.tree_info.length; i++) {
		const tree = model.tree_info[i];
		const classIndex = i % numClasses;
		const leafValue = traverseTree(tree.tree_structure, features);
		// Note: dump_model leaf_value already includes shrinkage (learning rate).
		// Applying shrinkage again would double-scale and distort probabilities.
		scores[classIndex] += leafValue;
	}

	return scores;
}

// ============================================================================
// ACTIVATION FUNCTIONS
// ============================================================================

/**
 * Sigmoid activation for binary classification
 */
function sigmoid(x: number): number {
	// Clamp to avoid overflow
	const clampedX = Math.max(-500, Math.min(500, x));
	return 1 / (1 + Math.exp(-clampedX));
}

/**
 * Softmax activation for multiclass classification
 */
function softmax(scores: number[]): number[] {
	// Find max for numerical stability
	const maxScore = Math.max(...scores);
	const expScores = scores.map((s) => Math.exp(s - maxScore));
	const sumExp = expScores.reduce((a, b) => a + b, 0);
	return expScores.map((e) => e / sumExp);
}

// ============================================================================
// PUBLIC INFERENCE FUNCTIONS
// ============================================================================

/**
 * Run inference for binary classification (BTTS, Over/Under)
 *
 * @param model - The LightGBM model
 * @param features - Feature values array (ordered by feature_names)
 * @returns Probability of positive class
 */
export function predictBinary(
	model: LightGBMModel,
	features: number[],
): BinaryPrediction {
	const scores = computeRawScores(model, features);
	const probability = sigmoid(scores[0]);

	return { probability };
}

/**
 * Run inference for multiclass classification (1X2)
 *
 * @param model - The LightGBM model
 * @param features - Feature values array (ordered by feature_names)
 * @returns Probabilities for home, draw, away
 */
export function predictMulticlass(
	model: LightGBMModel,
	features: number[],
): MulticlassPrediction {
	const scores = computeRawScores(model, features);
	const probs = softmax(scores);

	// LightGBM multiclass order: HOME=0, DRAW=1, AWAY=2
	return {
		home: probs[0],
		draw: probs[1],
		away: probs[2],
	};
}

/**
 * Create a feature array from a feature map using the model's feature order
 *
 * @param model - The LightGBM model (for feature name order)
 * @param featureMap - Map of feature name to value
 * @returns Ordered feature array
 */
export function createFeatureArray(
	model: LightGBMModel,
	featureMap: Record<string, number | null | undefined>,
): number[] {
	return model.feature_names.map((name) => {
		const value = featureMap[name];
		// Return NaN for missing values - traverseTree handles this
		if (value === null || value === undefined) {
			return Number.NaN;
		}
		return value;
	});
}

/**
 * Validate that a feature map has all required features
 *
 * @param model - The LightGBM model
 * @param featureMap - Map of feature name to value
 * @returns List of missing feature names (empty if all present)
 */
export function validateFeatures(
	model: LightGBMModel,
	featureMap: Record<string, number | null | undefined>,
): string[] {
	const missing: string[] = [];
	for (const name of model.feature_names) {
		if (!(name in featureMap)) {
			missing.push(name);
		}
	}
	return missing;
}

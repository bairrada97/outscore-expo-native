"""
Export LightGBM models to JSON format for TypeScript inference.

This script exports trained LightGBM models to a JSON format that can be
parsed and used for inference in pure TypeScript without ONNX dependencies.

The export is MINIFIED to reduce bundle size for Cloudflare Workers:
- Only keeps fields required for inference (split_feature, threshold, etc.)
- Removes training diagnostics (gain, weights, counts)
- Removes debug identifiers (split_index, leaf_index)

Usage:
    python ml/models/export-to-json.py [--markets MARKETS] [--no-minify]

Examples:
    python ml/models/export-to-json.py
    python ml/models/export-to-json.py --markets 1x2,btts
    python ml/models/export-to-json.py --no-minify  # Keep all fields
"""

import argparse
import json
from pathlib import Path

import joblib


# Markets to export by default
DEFAULT_MARKETS = [
    "1x2",
    "btts",
    "ou_0_5",
    "ou_1_5",
    "ou_2_5",
    "ou_3_5",
    "ou_4_5",
    "ou_5_5",
]

# Fields to keep in minified mode (all others are stripped)
# These are the ONLY fields needed for inference
KEEP_SPLIT_FIELDS = {"split_feature", "threshold", "default_left", "left_child", "right_child"}
KEEP_LEAF_FIELDS = {"leaf_value"}


def minify_node(node: dict) -> dict:
    """
    Recursively minify a tree node, keeping only inference-required fields.
    
    For split nodes: split_feature, threshold, default_left, left_child, right_child
    For leaf nodes: leaf_value
    """
    if node is None:
        return None
    
    # Check if this is a leaf node
    if "leaf_value" in node:
        return {"leaf_value": node["leaf_value"]}
    
    # Split node - keep only required fields and recurse
    minified = {}
    
    if "split_feature" in node:
        minified["split_feature"] = node["split_feature"]
    if "threshold" in node:
        minified["threshold"] = node["threshold"]
    if "default_left" in node:
        minified["default_left"] = node["default_left"]
    if "left_child" in node:
        minified["left_child"] = minify_node(node["left_child"])
    if "right_child" in node:
        minified["right_child"] = minify_node(node["right_child"])
    
    return minified


def minify_tree_info(tree_info: list) -> list:
    """Minify all trees in the tree_info array."""
    minified_trees = []
    
    for tree in tree_info:
        minified_tree = {
            "tree_index": tree.get("tree_index", 0),
            "shrinkage": tree.get("shrinkage", 1),
            "tree_structure": minify_node(tree.get("tree_structure", {})),
        }
        minified_trees.append(minified_tree)
    
    return minified_trees


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Export LightGBM models to JSON format."
    )
    parser.add_argument(
        "--markets",
        default=",".join(DEFAULT_MARKETS),
        help="Comma-separated list of markets to export.",
    )
    parser.add_argument(
        "--model-dir",
        default="ml/models/output",
        help="Directory containing model subdirectories.",
    )
    parser.add_argument(
        "--no-minify",
        action="store_true",
        help="Disable minification (keep all fields).",
    )
    return parser.parse_args()


def export_model(model_dir: Path, market: str, minify: bool = True) -> dict:
    """Export a single model to JSON format.
    
    Args:
        model_dir: Directory containing model subdirectories
        market: Market name (e.g., "1x2", "btts")
        minify: If True, strip unnecessary fields to reduce size
    
    Returns:
        Dict with model data, or None if model not found
    """
    model_path = model_dir / market / "model.pkl"
    
    if not model_path.exists():
        print(f"⚠️  Model not found: {model_path}")
        return None
    
    print(f"📦 Loading model: {market}")
    model = joblib.load(model_path)
    
    # Get the booster from the model
    if hasattr(model, "booster_"):
        booster = model.booster_
    else:
        booster = model
    
    # Dump the model to JSON format
    model_json = booster.dump_model()
    
    # Extract feature names
    feature_names = model_json.get("feature_names", [])
    
    # Get actual tree count from tree_info array
    tree_info = model_json.get("tree_info", [])
    num_trees = len(tree_info)
    
    # Minify tree_info if requested
    if minify:
        tree_info = minify_tree_info(tree_info)
    
    # Get model metadata
    metadata = {
        "market": market,
        "num_trees": num_trees,
        "num_class": model_json.get("num_class", 1),
        "feature_names": feature_names,
        "objective": model_json.get("objective", ""),
    }
    
    # Create output structure
    output = {
        "metadata": metadata,
        "tree_info": tree_info,
        "feature_names": feature_names,
    }
    
    return output


def main() -> None:
    args = parse_args()
    model_dir = Path(args.model_dir)
    markets = [m.strip() for m in args.markets.split(",") if m.strip()]
    minify = not args.no_minify
    
    print(f"🚀 Exporting models: {markets}")
    print(f"📁 Model directory: {model_dir}")
    print(f"🗜️  Minification: {'ENABLED' if minify else 'DISABLED'}")
    
    results = []
    
    for market in markets:
        output = export_model(model_dir, market, minify=minify)
        if output is None:
            continue
        
        # Write JSON file (no indent when minified for smaller size)
        output_path = model_dir / market / "model.json"
        if minify:
            # Compact JSON without whitespace
            output_path.write_text(json.dumps(output, separators=(',', ':')))
        else:
            # Pretty-printed JSON for debugging
            output_path.write_text(json.dumps(output, indent=2))
        
        # Calculate sizes
        pkl_size = (model_dir / market / "model.pkl").stat().st_size / 1024
        json_size = output_path.stat().st_size / 1024
        
        results.append({
            "market": market,
            "num_trees": output["metadata"]["num_trees"],
            "num_features": len(output["feature_names"]),
            "pkl_size_kb": round(pkl_size, 1),
            "json_size_kb": round(json_size, 1),
        })
        
        print(f"✅ Exported {market}: {output['metadata']['num_trees']} trees, "
              f"{len(output['feature_names'])} features, "
              f"{round(json_size, 1)}KB")
    
    # Print summary
    print("\n📊 Export Summary:")
    print("-" * 60)
    total_json_size = sum(r["json_size_kb"] for r in results)
    for r in results:
        print(f"  {r['market']:12} | {r['num_trees']:4} trees | "
              f"{r['num_features']:3} features | {r['json_size_kb']:8.1f} KB")
    print("-" * 60)
    print(f"  {'TOTAL':12} | {' '*4}       | {' '*3}          | {total_json_size:8.1f} KB")
    
    if minify:
        print(f"\n💡 Models are minified. Use --no-minify to keep all fields.")
    print(f"\n✅ All models exported successfully!")


if __name__ == "__main__":
    main()

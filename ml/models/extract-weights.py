import argparse
import json
from pathlib import Path

import joblib
import pandas as pd


FACTOR_GROUPS = {
    "form": {
        "homeFormScore",
        "awayFormScore",
        "homePPG10",
        "awayPPG10",
    },
    "attackStrength": {
        "homeGF10",
        "awayGF10",
    },
    "defenseStrength": {
        "homeGA10",
        "awayGA10",
    },
    "homeAwayStrength": {
        "homeHomeFormScore",
        "awayAwayFormScore",
    },
    "rest": {
        "homeDaysSince",
        "awayDaysSince",
    },
    "meta": {
        "season",
        "leagueId",
    },
}


def normalize_weights(raw: dict[str, float]) -> dict[str, float]:
    total = sum(raw.values())
    if total <= 0:
        return {k: 0.0 for k in raw}
    return {k: round(v / total, 6) for k, v in raw.items()}


def group_feature(feature: str) -> str:
    if feature.startswith("h2h_"):
        return "h2h"
    for group, members in FACTOR_GROUPS.items():
        if feature in members:
            return group
    return "other"


def extract_model_weights(model_path: Path) -> dict[str, float]:
    model = joblib.load(model_path)
    importances = model.feature_importances_
    feature_names = model.feature_name_

    grouped: dict[str, float] = {}
    for feature, importance in zip(feature_names, importances):
        group = group_feature(feature)
        grouped[group] = grouped.get(group, 0.0) + float(importance)
    return normalize_weights(grouped)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Extract grouped factor weights from LightGBM models."
    )
    parser.add_argument(
        "--model-dir",
        default="ml/models/output",
        help="Directory containing market subfolders with model.pkl.",
    )
    parser.add_argument(
        "--out",
        default="ml/models/output/weights.json",
        help="Output weights JSON path.",
    )
    parser.add_argument(
        "--markets",
        default="all",
        help="Comma-separated market keys or 'all'.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    model_dir = Path(args.model_dir)

    if args.markets == "all":
        markets = sorted(
            [p.name for p in model_dir.iterdir() if (p / "model.pkl").exists()]
        )
    else:
        markets = [m.strip() for m in args.markets.split(",") if m.strip()]

    results: dict[str, dict[str, float]] = {}
    for market in markets:
        model_path = model_dir / market / "model.pkl"
        if not model_path.exists():
            continue
        results[market] = extract_model_weights(model_path)

    out_path = Path(args.out)
    out_path.write_text(json.dumps(results, indent=2))
    print(f"✅ Weights written to {out_path}")


if __name__ == "__main__":
    main()

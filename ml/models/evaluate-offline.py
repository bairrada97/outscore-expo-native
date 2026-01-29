import argparse
import json
import math
from pathlib import Path

import joblib
import pandas as pd


MARKETS = {
    "1x2": {"target": "result", "type": "multiclass"},
    "btts": {"target": "btts_yes", "type": "binary"},
    "ou_0_5": {"target": "ou_over_0_5", "type": "binary"},
    "ou_1_5": {"target": "ou_over_1_5", "type": "binary"},
    "ou_2_5": {"target": "ou_over_2_5", "type": "binary"},
    "ou_3_5": {"target": "ou_over_3_5", "type": "binary"},
    "ou_4_5": {"target": "ou_over_4_5", "type": "binary"},
    "ou_5_5": {"target": "ou_over_5_5", "type": "binary"},
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Offline evaluation (brier/logloss) on historical dataset."
    )
    parser.add_argument(
        "--input",
        default="ml/data/features/training_with_targets.csv",
        help="CSV with features + targets (training_with_targets.csv).",
    )
    parser.add_argument(
        "--model-dir",
        default="ml/models/output",
        help="Directory with trained model.pkl files.",
    )
    parser.add_argument(
        "--markets",
        default="1x2,btts,ou_2_5",
        help="Comma-separated market keys (e.g., 1x2,btts,ou_2_5).",
    )
    parser.add_argument("--season", type=int, default=None, help="Filter by season.")
    parser.add_argument(
        "--from-season", type=int, default=None, help="Start season filter."
    )
    parser.add_argument("--to-season", type=int, default=None, help="End season filter.")
    return parser.parse_args()


def prepare_features(df: pd.DataFrame, target_columns: set[str]) -> pd.DataFrame:
    numeric_df = df.select_dtypes(include=["number"]).copy()
    drop_cols = [
        "homeGoals",
        "awayGoals",
        "totalGoals",
        "HTHome",
        "HTAway",
        "HomeCorners",
        "AwayCorners",
        "HomeYellow",
        "AwayYellow",
        "HomeRed",
        "AwayRed",
        "fh_goals_total",
        "sh_goals_total",
        "home_cards",
        "away_cards",
        "total_cards",
        "home_corners",
        "away_corners",
        "total_corners",
    ]
    drop_cols.extend(sorted(target_columns))
    for col in drop_cols:
        if col in numeric_df.columns:
            numeric_df = numeric_df.drop(columns=[col])
    for col in list(numeric_df.columns):
        if (
            col.startswith("ou_over_")
            or col.startswith("total_range_")
            or col.startswith("home_range_")
            or col.startswith("away_range_")
            or col.startswith("clean_sheet_")
        ):
            numeric_df = numeric_df.drop(columns=[col])
    return numeric_df


def brier_binary(y_true, prob_yes) -> float:
    return sum((p - y) ** 2 for p, y in zip(prob_yes, y_true)) / len(y_true)


def logloss_binary(y_true, prob_yes) -> float:
    eps = 1e-12
    total = 0.0
    for p, y in zip(prob_yes, y_true):
        p = min(max(p, eps), 1 - eps)
        total += -(y * math.log(p) + (1 - y) * math.log(1 - p))
    return total / len(y_true)


def brier_multiclass(y_true, prob_rows) -> float:
    total = 0.0
    for y, probs in zip(y_true, prob_rows):
        actual = [1 if y == idx else 0 for idx in range(len(probs))]
        total += sum((p - a) ** 2 for p, a in zip(probs, actual))
    return total / len(y_true)


def logloss_multiclass(y_true, prob_rows) -> float:
    eps = 1e-12
    total = 0.0
    for y, probs in zip(y_true, prob_rows):
        p = min(max(probs[y], eps), 1 - eps)
        total += -math.log(p)
    return total / len(y_true)


def load_model(model_dir: Path, market: str):
    model_path = model_dir / market / "model.pkl"
    if not model_path.exists():
        raise FileNotFoundError(f"Model not found: {model_path}")
    return joblib.load(model_path)


def filter_seasons(df: pd.DataFrame, args: argparse.Namespace) -> pd.DataFrame:
    if args.season is not None:
        return df[df["season"] == args.season]
    if args.from_season is not None or args.to_season is not None:
        start = args.from_season if args.from_season is not None else df["season"].min()
        end = args.to_season if args.to_season is not None else df["season"].max()
        return df[(df["season"] >= start) & (df["season"] <= end)]
    return df


def evaluate_market(df: pd.DataFrame, market: str, model_dir: Path) -> dict:
    if market not in MARKETS:
        return {"market": market, "status": "skipped", "reason": "unknown market"}

    target = MARKETS[market]["target"]
    market_type = MARKETS[market]["type"]
    subset = df[df[target].notna()].copy()
    if subset.empty:
        return {"market": market, "status": "skipped", "reason": "empty target"}

    if market_type == "multiclass":
        subset = subset[subset[target].isin(["HOME", "DRAW", "AWAY"])]
        label_map = {"HOME": 0, "DRAW": 1, "AWAY": 2}
        y = subset[target].map(label_map).astype(int).tolist()
    else:
        y = subset[target].astype(int).tolist()

    target_columns = {config["target"] for config in MARKETS.values()}
    X = prepare_features(subset, target_columns)

    model = load_model(model_dir, market)
    prob = model.predict_proba(X)

    if market_type == "multiclass":
        brier = brier_multiclass(y, prob.tolist())
        loss = logloss_multiclass(y, prob.tolist())
    else:
        prob_yes = [row[1] for row in prob]
        brier = brier_binary(y, prob_yes)
        loss = logloss_binary(y, prob_yes)

    return {
        "market": market,
        "status": "ok",
        "rows": len(y),
        "brier": brier,
        "logloss": loss,
    }


def main() -> None:
    args = parse_args()
    df = pd.read_csv(args.input)
    df = filter_seasons(df, args)

    markets = [m.strip() for m in args.markets.split(",") if m.strip()]
    model_dir = Path(args.model_dir)
    results = [evaluate_market(df, m, model_dir) for m in markets]
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()

import argparse
import json
import math
from pathlib import Path

import joblib
import lightgbm as lgb
import optuna
import pandas as pd
from sklearn.metrics import log_loss, mean_squared_error


MARKETS = {
    "1x2": {"target": "result", "type": "multiclass"},
    "btts": {"target": "btts_yes", "type": "binary"},
    "ou_0_5": {"target": "ou_over_0_5", "type": "binary"},
    "ou_1_5": {"target": "ou_over_1_5", "type": "binary"},
    "ou_2_5": {"target": "ou_over_2_5", "type": "binary"},
    "ou_3_5": {"target": "ou_over_3_5", "type": "binary"},
    "ou_4_5": {"target": "ou_over_4_5", "type": "binary"},
    "ou_5_5": {"target": "ou_over_5_5", "type": "binary"},
    "fh_1x2": {"target": "fh_result", "type": "multiclass"},
    "fh_goals": {"target": "fh_goals_total", "type": "regression"},
    "sh_goals": {"target": "sh_goals_total", "type": "regression"},
    "clean_sheet_home": {"target": "clean_sheet_home", "type": "binary"},
    "clean_sheet_away": {"target": "clean_sheet_away", "type": "binary"},
    "total_cards": {"target": "total_cards", "type": "regression"},
    "home_cards": {"target": "home_cards", "type": "regression"},
    "away_cards": {"target": "away_cards", "type": "regression"},
    "total_corners": {"target": "total_corners", "type": "regression"},
    "home_corners": {"target": "home_corners", "type": "regression"},
    "away_corners": {"target": "away_corners", "type": "regression"},
}


def add_range_markets() -> None:
    ranges = [
        (1, 2),
        (1, 3),
        (1, 4),
        (1, 5),
        (1, 6),
        (2, 3),
        (2, 4),
        (2, 5),
        (2, 6),
        (3, 4),
        (3, 5),
        (3, 6),
        (4, 5),
        (4, 6),
        (5, 6),
    ]
    for low, high in ranges:
        MARKETS[f"total_range_{low}_{high}"] = {
            "target": f"total_range_{low}_{high}",
            "type": "binary",
        }
        MARKETS[f"home_range_{low}_{high}"] = {
            "target": f"home_range_{low}_{high}",
            "type": "binary",
        }
        MARKETS[f"away_range_{low}_{high}"] = {
            "target": f"away_range_{low}_{high}",
            "type": "binary",
        }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train LightGBM markets with Optuna.")
    parser.add_argument(
        "--input",
        default="ml/data/features/training_with_targets.csv",
        help="Training dataset with targets.",
    )
    parser.add_argument(
        "--out-dir",
        default="ml/models/output",
        help="Output directory for models and metrics.",
    )
    parser.add_argument("--trials", type=int, default=30, help="Optuna trials.")
    parser.add_argument(
        "--timeout",
        type=int,
        default=600,
        help="Optuna timeout in seconds (per market).",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Enable verbose Optuna logging.",
    )
    parser.add_argument(
        "--train-end", type=int, default=2022, help="Last season for training."
    )
    parser.add_argument("--val", type=int, default=2023, help="Validation season.")
    parser.add_argument(
        "--test-start", type=int, default=2024, help="First test season."
    )
    parser.add_argument(
        "--markets",
        default="all",
        help="Comma-separated market keys or 'all'.",
    )
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


def split_by_season(
    df: pd.DataFrame, train_end: int, val_season: int, test_start: int
):
    train = df[df["season"] <= train_end]
    val = df[df["season"] == val_season]
    test = df[df["season"] >= test_start]
    return train, val, test


def objective(trial, X_train, y_train, X_val, y_val, market_type):
    params = {
        "learning_rate": trial.suggest_float("learning_rate", 0.01, 0.2),
        "num_leaves": trial.suggest_int("num_leaves", 16, 128),
        "min_child_samples": trial.suggest_int("min_child_samples", 10, 100),
        "subsample": trial.suggest_float("subsample", 0.6, 1.0),
        "colsample_bytree": trial.suggest_float("colsample_bytree", 0.6, 1.0),
        "reg_alpha": trial.suggest_float("reg_alpha", 0.0, 1.0),
        "reg_lambda": trial.suggest_float("reg_lambda", 0.0, 1.0),
        "verbose": -1,
    }

    if market_type == "regression":
        model = lgb.LGBMRegressor(**params)
        model.fit(X_train, y_train)
        preds = model.predict(X_val)
        mse = mean_squared_error(y_val, preds)
        return math.sqrt(mse)

    if market_type == "multiclass":
        classes = sorted(y_train.unique())
        model = lgb.LGBMClassifier(
            objective="multiclass",
            num_class=len(classes),
            **params,
        )
        model.fit(X_train, y_train)
        preds = model.predict_proba(X_val)
        return log_loss(y_val, preds, labels=classes)

    model = lgb.LGBMClassifier(objective="binary", **params)
    model.fit(X_train, y_train)
    preds = model.predict_proba(X_val)[:, 1]
    return log_loss(y_val, preds)


def train_market(
    df: pd.DataFrame,
    market_key: str,
    config: dict,
    args,
    target_columns: set[str],
) -> dict:
    target = config["target"]
    market_type = config["type"]
    subset = df[df[target].notna()].copy()

    if market_type == "multiclass":
        subset = subset[subset[target].isin(["HOME", "DRAW", "AWAY"])]
        label_map = {"HOME": 0, "DRAW": 1, "AWAY": 2}
        subset[target] = subset[target].map(label_map)

    train, val, test = split_by_season(
        subset, args.train_end, args.val, args.test_start
    )
    if train.empty or val.empty or test.empty:
        return {"market": market_key, "status": "skipped", "reason": "empty split"}

    X_train = prepare_features(train, target_columns)
    y_train = train[target]
    X_val = prepare_features(val, target_columns)
    y_val = val[target]
    X_test = prepare_features(test, target_columns)
    y_test = test[target]

    verbosity = optuna.logging.INFO if args.verbose else optuna.logging.WARNING
    optuna.logging.set_verbosity(verbosity)
    study = optuna.create_study(direction="minimize")
    study.optimize(
        lambda trial: objective(
            trial, X_train, y_train, X_val, y_val, market_type
        ),
        n_trials=args.trials,
        timeout=args.timeout,
    )

    best_params = study.best_params
    if market_type == "regression":
        model = lgb.LGBMRegressor(**best_params)
        model.fit(pd.concat([X_train, X_val]), pd.concat([y_train, y_val]))
        preds = model.predict(X_test)
        metric = math.sqrt(mean_squared_error(y_test, preds))
        metric_name = "rmse"
    elif market_type == "multiclass":
        model = lgb.LGBMClassifier(
            objective="multiclass",
            num_class=3,
            **best_params,
        )
        model.fit(pd.concat([X_train, X_val]), pd.concat([y_train, y_val]))
        preds = model.predict_proba(X_test)
        metric = log_loss(y_test, preds, labels=[0, 1, 2])
        metric_name = "log_loss"
    else:
        model = lgb.LGBMClassifier(objective="binary", **best_params)
        model.fit(pd.concat([X_train, X_val]), pd.concat([y_train, y_val]))
        preds = model.predict_proba(X_test)[:, 1]
        metric = log_loss(y_test, preds)
        metric_name = "log_loss"

    output_dir = Path(args.out_dir) / market_key
    output_dir.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, output_dir / "model.pkl")

    metrics = {
        "market": market_key,
        "target": target,
        "type": market_type,
        "metric": metric_name,
        "value": float(metric),
        "best_params": best_params,
        "rows": {
            "train": len(train),
            "val": len(val),
            "test": len(test),
        },
    }
    (output_dir / "metrics.json").write_text(json.dumps(metrics, indent=2))
    return metrics


def main() -> None:
    args = parse_args()
    add_range_markets()

    df = pd.read_csv(args.input)
    target_columns = {config["target"] for config in MARKETS.values()}
    requested = (
        list(MARKETS.keys())
        if args.markets == "all"
        else [m.strip() for m in args.markets.split(",") if m.strip()]
    )

    summary = []
    for market_key in requested:
        config = MARKETS.get(market_key)
        if not config:
            summary.append({"market": market_key, "status": "skipped", "reason": "unknown"})
            continue
        summary.append(train_market(df, market_key, config, args, target_columns))

    output_dir = Path(args.out_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "summary.json").write_text(json.dumps(summary, indent=2))
    print(f"✅ Training complete. Summary at {output_dir / 'summary.json'}")


if __name__ == "__main__":
    main()

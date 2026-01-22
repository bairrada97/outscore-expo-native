import argparse
import json
from bisect import bisect_left
from dataclasses import dataclass
from pathlib import Path

import pandas as pd


LEAGUE_NAME_MAP = {
    "premier league": 39,
    "english premier league": 39,
    "epl": 39,
    "e0": 39,
    "la liga": 140,
    "spanish la liga": 140,
    "primera division": 140,
    "primera división": 140,
    "sp1": 140,
    "serie a": 135,
    "italian serie a": 135,
    "i1": 135,
    "bundesliga": 78,
    "german bundesliga": 78,
    "d1": 78,
    "ligue 1": 61,
    "french ligue 1": 61,
    "f1": 61,
    "primeira liga": 94,
    "liga portugal": 94,
    "portuguese league": 94,
    "p1": 94,
    "eredivisie": 88,
    "dutch eredivisie": 88,
    "n1": 88,
}

STOP_WORDS = {
    "fc",
    "cf",
    "sc",
    "afc",
    "ac",
    "ss",
    "cd",
    "ud",
    "de",
    "al",
    "the",
}

REPLACEMENTS = {
    "á": "a",
    "à": "a",
    "â": "a",
    "ã": "a",
    "ä": "a",
    "é": "e",
    "è": "e",
    "ê": "e",
    "ë": "e",
    "í": "i",
    "ì": "i",
    "î": "i",
    "ï": "i",
    "ó": "o",
    "ò": "o",
    "ô": "o",
    "õ": "o",
    "ö": "o",
    "ú": "u",
    "ù": "u",
    "û": "u",
    "ü": "u",
    "ç": "c",
    "ñ": "n",
}


def normalize_team_name(raw: str) -> str:
    value = raw.strip().lower()
    for src, dst in REPLACEMENTS.items():
        value = value.replace(src, dst)
    value = "".join(ch if ch.isalnum() or ch.isspace() else " " for ch in value)
    parts = [part for part in value.split() if part and part not in STOP_WORDS]
    return " ".join(parts).strip()


def resolve_league_id(raw: str) -> int | None:
    key = str(raw).strip().lower()
    return LEAGUE_NAME_MAP.get(key)


@dataclass(frozen=True)
class H2HMatch:
    date: pd.Timestamp
    home_team: str
    away_team: str
    home_goals: int
    away_goals: int


def build_pair_key(home_team: str, away_team: str) -> str:
    return "__".join(sorted([home_team, away_team]))


def compute_h2h_stats(
    matches: list[H2HMatch],
    current_home: str,
    current_away: str,
    current_date: pd.Timestamp,
    max_matches: int = 5,
    venue_only: bool = False,
) -> dict[str, float | int | None]:
    if not matches:
        return {
            "matches": 0,
            "home_win_pct": None,
            "away_win_pct": None,
            "draw_pct": None,
            "avg_goals": None,
            "btts_pct": None,
            "over_2_5_pct": None,
        }

    dates = [m.date for m in matches]
    cutoff = bisect_left(dates, current_date)
    if cutoff <= 0:
        return {
            "matches": 0,
            "home_win_pct": None,
            "away_win_pct": None,
            "draw_pct": None,
            "avg_goals": None,
            "btts_pct": None,
            "over_2_5_pct": None,
        }

    if venue_only:
        selected: list[H2HMatch] = []
        for idx in range(cutoff - 1, -1, -1):
            match = matches[idx]
            if match.home_team == current_home and match.away_team == current_away:
                selected.append(match)
                if len(selected) >= max_matches:
                    break
        selected = list(reversed(selected))
    else:
        selected = matches[:cutoff][-max_matches:]

    if not selected:
        return {
            "matches": 0,
            "home_win_pct": None,
            "away_win_pct": None,
            "draw_pct": None,
            "avg_goals": None,
            "btts_pct": None,
            "over_2_5_pct": None,
        }

    home_wins = 0
    away_wins = 0
    draws = 0
    total_goals = 0
    btts = 0
    over_2_5 = 0

    for match in selected:
        if match.home_team == current_home:
            home_goals = match.home_goals
            away_goals = match.away_goals
        else:
            home_goals = match.away_goals
            away_goals = match.home_goals

        if home_goals > away_goals:
            home_wins += 1
        elif away_goals > home_goals:
            away_wins += 1
        else:
            draws += 1

        total = home_goals + away_goals
        total_goals += total
        if home_goals > 0 and away_goals > 0:
            btts += 1
        if total > 2.5:
            over_2_5 += 1

    count = len(selected)
    return {
        "matches": count,
        "home_win_pct": (home_wins / count) * 100,
        "away_win_pct": (away_wins / count) * 100,
        "draw_pct": (draws / count) * 100,
        "avg_goals": total_goals / count,
        "btts_pct": (btts / count) * 100,
        "over_2_5_pct": (over_2_5 / count) * 100,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Create ML targets by merging raw matches with training features."
    )
    parser.add_argument(
        "--features",
        default="ml/data/features/training.csv",
        help="Path to training features CSV.",
    )
    parser.add_argument(
        "--raw",
        default="ml/data/raw/historical.csv",
        help="Path to raw historical CSV (Matches.csv).",
    )
    parser.add_argument(
        "--team-map",
        default="ml/data/team-name-map.json",
        help="Path to team-name-map.json.",
    )
    parser.add_argument(
        "--out",
        default="ml/data/features/training_with_targets.csv",
        help="Output CSV path.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    features_path = Path(args.features)
    raw_path = Path(args.raw)
    team_map_path = Path(args.team_map)
    out_path = Path(args.out)

    features = pd.read_csv(features_path)
    raw = pd.read_csv(raw_path)

    team_map = json.loads(team_map_path.read_text())
    mappings = team_map.get("mappings", {})

    raw["leagueId"] = raw["Division"].apply(resolve_league_id)
    raw = raw[raw["leagueId"].notna()].copy()

    raw["homeTeamNorm"] = raw["HomeTeam"].astype(str).apply(normalize_team_name)
    raw["awayTeamNorm"] = raw["AwayTeam"].astype(str).apply(normalize_team_name)
    raw["homeTeam"] = raw["homeTeamNorm"].map(mappings).fillna(raw["HomeTeam"])
    raw["awayTeam"] = raw["awayTeamNorm"].map(mappings).fillna(raw["AwayTeam"])
    raw["date"] = pd.to_datetime(raw["MatchDate"])

    numeric_cols = [
        "FTHome",
        "FTAway",
        "HTHome",
        "HTAway",
        "HomeCorners",
        "AwayCorners",
        "HomeYellow",
        "AwayYellow",
        "HomeRed",
        "AwayRed",
    ]
    for col in numeric_cols:
        if col in raw.columns:
            raw[col] = pd.to_numeric(raw[col], errors="coerce")

    h2h_source = raw[
        ["date", "homeTeam", "awayTeam", "FTHome", "FTAway"]
    ].dropna()

    pair_map: dict[str, list[H2HMatch]] = {}
    for row in h2h_source.itertuples(index=False):
        if pd.isna(row.FTHome) or pd.isna(row.FTAway):
            continue
        key = build_pair_key(row.homeTeam, row.awayTeam)
        match = H2HMatch(
            date=row.date,
            home_team=row.homeTeam,
            away_team=row.awayTeam,
            home_goals=int(row.FTHome),
            away_goals=int(row.FTAway),
        )
        pair_map.setdefault(key, []).append(match)

    for key, matches in pair_map.items():
        matches.sort(key=lambda m: m.date)

    raw = raw[
        [
            "date",
            "leagueId",
            "homeTeam",
            "awayTeam",
            "HTHome",
            "HTAway",
            "HomeCorners",
            "AwayCorners",
            "HomeYellow",
            "AwayYellow",
            "HomeRed",
            "AwayRed",
        ]
    ]
    raw["date"] = raw["date"].dt.date.astype(str)

    merged = features.merge(
        raw,
        on=["date", "leagueId", "homeTeam", "awayTeam"],
        how="left",
        validate="many_to_one",
    )

    merged["totalGoals"] = merged["homeGoals"] + merged["awayGoals"]
    merged["btts_yes"] = ((merged["homeGoals"] > 0) & (merged["awayGoals"] > 0)).astype(
        "int"
    )

    for line in [0.5, 1.5, 2.5, 3.5, 4.5, 5.5]:
        col = f"ou_over_{str(line).replace('.', '_')}"
        merged[col] = (merged["totalGoals"] > line).astype("int")

    total_ranges = [
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
    for low, high in total_ranges:
        col = f"total_range_{low}_{high}"
        merged[col] = merged["totalGoals"].between(low, high, inclusive="both").astype(
            "int"
        )
        merged[f"home_range_{low}_{high}"] = merged["homeGoals"].between(
            low, high, inclusive="both"
        ).astype("int")
        merged[f"away_range_{low}_{high}"] = merged["awayGoals"].between(
            low, high, inclusive="both"
        ).astype("int")

    merged["clean_sheet_home"] = (merged["awayGoals"] == 0).astype("int")
    merged["clean_sheet_away"] = (merged["homeGoals"] == 0).astype("int")

    merged["fh_goals_total"] = merged["HTHome"] + merged["HTAway"]
    merged["sh_goals_total"] = merged["totalGoals"] - merged["fh_goals_total"]

    def half_result(row: pd.Series) -> str | None:
        if pd.isna(row["HTHome"]) or pd.isna(row["HTAway"]):
            return None
        if row["HTHome"] > row["HTAway"]:
            return "HOME"
        if row["HTHome"] < row["HTAway"]:
            return "AWAY"
        return "DRAW"

    merged["fh_result"] = merged.apply(half_result, axis=1)

    merged["home_cards"] = merged["HomeYellow"] + merged["HomeRed"]
    merged["away_cards"] = merged["AwayYellow"] + merged["AwayRed"]
    merged["total_cards"] = merged["home_cards"] + merged["away_cards"]

    merged["home_corners"] = merged["HomeCorners"]
    merged["away_corners"] = merged["AwayCorners"]
    merged["total_corners"] = merged["home_corners"] + merged["away_corners"]

    h2h_overall = []
    h2h_venue = []
    for row in merged[["date", "homeTeam", "awayTeam"]].itertuples(index=False):
        current_date = pd.to_datetime(row.date)
        key = build_pair_key(row.homeTeam, row.awayTeam)
        matches = pair_map.get(key, [])
        overall_stats = compute_h2h_stats(
            matches,
            row.homeTeam,
            row.awayTeam,
            current_date,
            max_matches=5,
            venue_only=False,
        )
        venue_stats = compute_h2h_stats(
            matches,
            row.homeTeam,
            row.awayTeam,
            current_date,
            max_matches=5,
            venue_only=True,
        )
        h2h_overall.append(overall_stats)
        h2h_venue.append(venue_stats)

    overall_df = pd.DataFrame(h2h_overall)
    venue_df = pd.DataFrame(h2h_venue)

    merged["h2h_overall_matches"] = overall_df["matches"]
    merged["h2h_overall_home_win_pct"] = overall_df["home_win_pct"]
    merged["h2h_overall_away_win_pct"] = overall_df["away_win_pct"]
    merged["h2h_overall_draw_pct"] = overall_df["draw_pct"]
    merged["h2h_overall_avg_goals"] = overall_df["avg_goals"]
    merged["h2h_overall_btts_pct"] = overall_df["btts_pct"]
    merged["h2h_overall_over_2_5_pct"] = overall_df["over_2_5_pct"]

    merged["h2h_venue_matches"] = venue_df["matches"]
    merged["h2h_venue_home_win_pct"] = venue_df["home_win_pct"]
    merged["h2h_venue_away_win_pct"] = venue_df["away_win_pct"]
    merged["h2h_venue_draw_pct"] = venue_df["draw_pct"]
    merged["h2h_venue_avg_goals"] = venue_df["avg_goals"]
    merged["h2h_venue_btts_pct"] = venue_df["btts_pct"]
    merged["h2h_venue_over_2_5_pct"] = venue_df["over_2_5_pct"]

    out_path.parent.mkdir(parents=True, exist_ok=True)
    merged.to_csv(out_path, index=False)

    coverage = {
        "fh_goals_total": int(merged["fh_goals_total"].notna().sum()),
        "total_cards": int(merged["total_cards"].notna().sum()),
        "total_corners": int(merged["total_corners"].notna().sum()),
    }
    print(f"✅ Targets written to {out_path}")
    print("Coverage:", coverage)


if __name__ == "__main__":
    main()

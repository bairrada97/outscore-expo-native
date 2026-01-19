# Elo Pre-ML Plan (Global Strength + Cross-League Calibration)

## Goals

- Produce a **global, cross-league team strength rating** that is robust to “easy domestic schedule” inflation.
- Use it **before ML** to improve calibration for international/cross-league matches (UCL/UEL/etc) while keeping the system explainable and bounded.
- Ensure Elo influences **MatchOutcome** and (lightly) the **goal distribution** so O/U and BTTS stay coherent.

## Key decisions (locked)

- **Source**: compute **our own Elo** internally (no external Elo dataset dependency).
- **Scope**: update on **all competitive matches** (league + cups + internationals), exclude friendlies.
- **History**: seed/backfill from **last 5 seasons**.
- **Cross-league priors**: use **UEFA association + club coefficients** as priors; ingest **semi-manually** (paste/update via a CLI/admin task), and **decay** their influence over time.

## Why this is needed (example)

Domestic “Tier 1” is not comparable across leagues. In UCL, a team like PSG can be materially stronger overall than a domestic Tier 1 team from a smaller league. A global Elo + UEFA priors provides an objective cross-league baseline so MatchOutcome isn’t driven by within-league tiers alone.

---

## Current architecture hooks we will reuse

- **Mind layer** is baseline strength and the natural place to expose “global strength” (Elo-derived).
- Shared distribution backbone already exists:
  - `buildGoalDistribution()` produces a `scoreMatrix` used for BTTS and O/U.
- The backend already persists “team season context” and has D1 entities/mappings; Elo needs its own storage because it is not season-scoped.

---

## Data model & persistence

### New D1 tables (recommended)

Create dedicated tables because Elo and UEFA coefficients are not purely season stats and need auditability.

#### 1) `team_elo_ratings`

- `team_id` (internal FK)
- `as_of_date` (UTC date/time string)
- `elo` (number)
- `games` (int)
- `last_fixture_provider` (e.g. `api_football`)
- `last_fixture_id` (provider fixture id) **idempotency key**
- `updated_at`

Indexes:
- `(team_id, as_of_date DESC)`
- `(last_fixture_provider, last_fixture_id)` unique (or unique composite)

#### 2) UEFA priors storage

##### `uefa_association_coefficients`
- `season` (e.g. 2025)
- `country_code` (UEFA country key; store mapping from API-Football country to UEFA country if needed)
- `rank` (optional)
- `coefficient_5y` (number)
- `updated_at`

##### `uefa_club_coefficients`
- `season`
- `uefa_club_key` (string; canonical identifier in our system)
- `club_name` (for display/debug)
- `coefficient` (number)
- `updated_at`

##### `uefa_club_team_map`
- `uefa_club_key`
- `team_id` (internal)
- `confidence` (0–1)
- `method` (e.g. `manual`, `fuzzy_name`, `api_standings`)
- `updated_at`

---

## Required data & API-Football endpoints

### Minimum fixture fields needed for Elo

- **Fixture identity**: `fixture.id`
- **Date**: `fixture.date` (UTC)
- **Teams**: `teams.home.id`, `teams.away.id` (provider ids → internal ids via existing mapping)
- **Score**: `goals.home`, `goals.away` (prefer 90’ score where available)
- **Status**: `fixture.status.short` (include only finished competitive matches)
- **Competition metadata**: `league.id`, `league.name`, `league.type`, `league.season`, `country.code`

### Standings for backtests/training (avoid leakage)

Important caveat:
- API standings for a past season are usually “final table”, but they are **not a safe training feature** because using end-of-season standings for matches earlier in that season is **lookahead leakage**.

Planned approach:
- **Compute standings ourselves from fixtures** for any backtest/ML feature that depends on league position/points:
  - Fetch all finished fixtures for `leagueId + season`.
  - Sort chronologically.
  - Build a rolling table (points, GD, rank) **as-of each match date/round**.
  - Use this “as-of” standings snapshot for feature generation and model evaluation.
- If we still fetch API standings (e.g., for UI/ops), treat them as **snapshots** and store `fetched_at`; do not use “final table” directly in training/backtests.

### Suggested API-Football endpoints

Backfill (5 seasons):
- **By league + season**: `/fixtures?league={leagueId}&season={seasonYear}`
  - best for bulk processing for supported leagues
- **By team + season**: `/fixtures?team={teamId}&season={seasonYear}`
  - fallback for teams/leagues not covered by league batching

Incremental updates:
- **By date range**: `/fixtures?from=YYYY-MM-DD&to=YYYY-MM-DD`
  - run daily (or every few hours) and process newly finished fixtures

Competition classification support:
- **Leagues metadata**: `/leagues?id={leagueId}`
  - use `league.type` and `league.name` heuristics to classify league/cup/international/friendly

---

## Elo computation spec

### Match inclusion rules

- Include only **competitive matches**:
  - Domestic leagues
  - Domestic cups
  - International club competitions (UCL/UEL/UECL, etc.)
- Exclude:
  - Friendlies
  - Youth/reserve competitions (if identifiable)
  - Matches without reliable final score / finished status

### Elo update formula

- Expected score (logistic):
  - \(E_A = 1 / (1 + 10^{-(R_A - R_B + H)/400})\)
- Actual score:
  - Win = 1, Draw = 0.5, Loss = 0
- Update:
  - \(R'_A = R_A + K \cdot G \cdot (S_A - E_A)\)

Recommended initial parameters (tunable, but bounded):
- **Home advantage** \(H\): start around **+60 Elo** (or split by match type if desired).
- **K-factor by match type**:
  - League: **20**
  - Domestic cup: **18** (more variance/rotation)
  - International: **24** (strongest signal for cross-league calibration)
- **Goal margin multiplier** \(G\):
  - small, bounded multiplier based on goal difference (avoid extreme blowout effects)

### Season carry-over / decay

At season rollover:
- Regress ratings slightly toward mean (e.g. **10–20%**) to reduce stale inflation.

### Promotions / relegations (early-season correctness)

Problem we want to solve:
- A promoted team can look like “Tier 1” (within its previous division) and appear too strong early season.
- A global Elo should preserve the **division gap** so a newly promoted team is not treated like an established top-flight champion.

Planned behavior:
- Carry over each team’s Elo into the new season (then apply season regression).
- When a team’s primary league/division changes (promotion/relegation), apply a small **league/division baseline shift**:
  - If we can infer division level from `/leagues` (or via an override), adjust Elo toward the new division’s baseline.
  - If division is unknown, keep neutral and rely on Elo results + UEFA priors (for Europe) + caps.
- Use `games`-based reliability gating so early-season results don’t swing Elo or predictions too aggressively.

### Seeding/backfill (5 seasons)

- Backfill chronologically using fixture history.
- Initialize unknown teams at `1500 + priors` (see UEFA priors section).
- Track `games` for confidence gating and decay.

---

## League/division strength (non-UEFA) priors

We should **not** assume `league.id` ordering correlates with strength.

Instead:
- Use `/leagues` fields (`country.code`, `league.type`, `league.name`) to infer a **division level** when possible.
- If division cannot be inferred safely, treat it as **unknown** (neutral), and rely on match results + UEFA priors.
- Maintain a small **override map** keyed by `league.id` for exceptions.

### Division inference rules (high level)

1) Only apply to `league.type === "League"` (cups are separate).
2) Parse `league.name` using generic patterns (e.g. `1`, `2`, `3`, `Serie A/B`, `Liga 1/2/3`, `Bundesliga 2`).
3) If still unknown, remain neutral and require override if needed.

This primarily solves within-country gaps (D1 vs D3) without requiring global rankings.

### Promotion/relegation baseline shift (division-aware)

If a team transitions between divisions/seasons:
- Apply a bounded baseline correction so a dominant lower-division team does not start equal to top-flight champions.
- Prefer division inference from `/leagues` name/type; fallback to a small `league.id` override map where names are ambiguous.
- Keep this correction smaller than UEFA priors and smaller than what results will learn over ~40–60 games (it is a stability aid, not the main signal).

---

## UEFA coefficient priors (pre-ML, hybrid, decaying)

### Goal

Improve cross-league calibration (especially UCL/UEL/UECL) immediately by seeding Elo with **objective priors**:
- **UEFA association coefficients** (country strength over ~5 years)
- **UEFA club coefficients** (team strength prior within/above league)

These priors must **fade out** as the team accumulates enough competitive Elo matches.

### Ingestion approach (semi-manual)

Add a CLI/admin task that accepts pasted JSON/CSV payloads and stores them in D1:
- upsert association coefficients by season
- upsert club coefficients by season
- upsert club → internal team mapping (with confidence + review flow)

Update cadence:
- Once per season (or when UEFA updates are published)
- Keep old seasons for auditability

### How priors apply

We compute a starting Elo for each team:

- `eloBase = 1500`
- `assocOffset = clamp(f(associationCoefficientOrRank), -120, +120)`
- `clubOffset = clamp(g(clubCoefficient), -80, +120)`
- `eloStart = eloBase + assocOffset + clubOffset`

Where:
- `f` and `g` are simple, monotonic mappings (documented and testable).
- Offsets are **bounded** to prevent priors dominating.

### Decay (priors fade out)

Use games-based decay:
- `games = number of competitive Elo-updated matches`
- `w = clamp((N - games) / N, 0, 1)` with `N ≈ 40–60`

Recommended usage:
- Apply priors for **initialization** (starting Elo), plus use `games` as a **confidence gate** to cap Elo influence on predictions until stable.

### Missing UEFA data fallback

- If club mapping missing: use association-only.
- If association missing: neutral (0) offset and mark Elo confidence lower.

---

## Integrating Elo into the insights algorithm

### 1) MatchOutcome (primary impact)

- Add an **Elo-gap factor** to match outcome simulation.
- Convert Elo difference into a **bounded probability adjustment** (percentage points).
- Route through existing caps/asymmetric adjustment machinery so it cannot dominate.

### 2) Goal distribution modifiers (secondary, coherence)

Add small Elo-based modifiers into goal distribution modifiers:
- Stronger team gets a small increase in attack multiplier and/or opponent defense adjustment.
- Keep effect small (e.g. max ±8% on lambdas).

This ensures:
- win probability aligns with expected goals
- O/U and BTTS remain coherent with match outcome

### 3) Confidence / explainability

Expose and log:
- team Elo, opponent Elo, Elo gap
- games played (reliability)
- which priors were applied (association/club offsets)

---

## Jobs & orchestration

### Backfill job (5 seasons)

- Fetch fixtures chronologically by league-season and/or team-season.
- Filter finished competitive fixtures.
- Apply Elo updates deterministically.
- Persist Elo snapshots with idempotency keys.

### Incremental job

- Run daily (or periodic).
- Fetch fixtures in last N days.
- Apply updates for newly finished fixtures only.

---

## Edge cases & data-quality guardrails

### Data completeness
- Missing history for a team → baseline Elo + LOW confidence until enough matches.
- Early season instability → rely on season carry-over + games-based confidence gating.
- Sparse cross-league bridges → priors + caps prevent drift.

### Bad / inconsistent fixture data
- Non-finished statuses (PST/CANC/ABD/etc): exclude.
- Awarded/walkover results: exclude unless reliably detected.
- Penalty shootouts:
  - default: treat as draw for Elo if drawn after 90/120; avoid counting shootout “winner” as normal W/L unless explicitly decided.
- Extra time:
  - default: use 90-minute result when available; ET adds variance.
- Duplicate fixtures:
  - enforce idempotency via provider fixture id.
- Team identity drift:
  - always resolve provider team ids to internal ids using existing mapping.

### Competition variance
- Domestic cups have higher variance → lower K than league.
- Exclude friendlies/youth competitions.

---

## Validation & measurement

- Unit tests:
  - deterministic Elo updates
  - idempotency
  - match-type weighting
  - home advantage sanity
  - bounded priors + bounded conversion to probability
- Integration checks:
  - Sporting vs PSG-type UCL matchups behave sensibly (PSG not underdog purely from domestic tier)
  - domestic leagues don’t drift unrealistically due to priors
- Metrics:
  - Brier/logloss deltas for MatchOutcome and (indirectly) BTTS/O-U
  - alert on systematic bias or cap overuse

---

## Appendix A — Suggested UEFA priors payload schema (semi-manual ingestion)

Use a single JSON document you can paste into a CLI/admin command.

```json
{
  "asOfSeason": 2025,
  "associations": [
    { "countryCode": "ENG", "rank": 1, "coefficient5y": 106.123 },
    { "countryCode": "FRA", "rank": 5, "coefficient5y":  60.456 },
    { "countryCode": "POR", "rank": 7, "coefficient5y":  52.789 }
  ],
  "clubs": [
    { "uefaClubKey": "psg", "name": "Paris Saint-Germain", "countryCode": "FRA", "coefficient": 104.000 },
    { "uefaClubKey": "sporting", "name": "Sporting CP", "countryCode": "POR", "coefficient":  45.000 }
  ],
  "clubTeamMap": [
    {
      "uefaClubKey": "psg",
      "apiFootballTeamId": 85,
      "confidence": 1.0,
      "method": "manual"
    },
    {
      "uefaClubKey": "sporting",
      "apiFootballTeamId": 228,
      "confidence": 1.0,
      "method": "manual"
    }
  ]
}
```

Notes:
- Store `apiFootballTeamId` then resolve to internal `team_id` via existing `external_ids` mapping.
- Keep `uefaClubKey` stable (slug-like) to avoid rename problems.
- If mapping confidence < 1.0, keep a review queue.


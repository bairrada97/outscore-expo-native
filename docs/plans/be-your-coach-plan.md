## Be Your Coach (Premium) — Implementation Plan (V1)

### Overview
- **Goal**: Premium-only, fully algorithmic “what-if” match simulations with before/after comparisons.
- **V1 scope**: **Pre-match + hypothetical scenarios only** (no explicit live state inputs like current minute/current score in V1).
- **Modifier depth**: **Hybrid**
  - Unit-level sliders (attack/mid/def/keeper), formation, style
  - Injuries/availability via **player importance** logic (aligns with injuries concepts in Phase 4.7)
  - Limited “key player present/absent” toggles when player stats are available; graceful fallback when not
- **Outputs**:
  - **Win/Draw/Loss probabilities**
  - **Expected goals** (\(\lambda_H, \lambda_A\))
  - **Shots / shots on target / big chances** (simulated, with uncertainty)
  - Optional: compact structured event list (non-narrative)

### Architecture alignment (Cloudflare Workers / Hono)
- Follow the backend patterns described in `docs/backend-architecture-guidelines.md`:
  - **Zod validation** for payloads
  - Use existing caching conventions where applicable, but **per-user what-if requests are mostly uncacheable**
  - Rely on **rate limiting + deterministic seeds** for safety and UX stability

### API design (new endpoint, premium-gated)
- **Endpoint**: `POST /api/fixtures/:fixtureId/coach-sim` (premium-only)
- **Request payload** (Zod schema):
  - `iterations`: preset enum (e.g., `FAST_1000`, `STANDARD_5000`)
  - `seed`: optional (for reproducible results)
  - `modifiers`: array of typed modifiers (formation change, style sliders, injury override, key-player present/absent)
- **Response**:
  - `baseline`: existing insights-style distributions + \(\lambda\) + stats
  - `whatIf`: same fields
  - `delta`: after−before diffs and per-modifier contribution summary (numeric)
  - `meta`: algorithmVersion/weightsVersion/configHash + runtime + reliability + dataQuality flags

### Premium enforcement + rate limiting
- **Premium gating (server-side)**: require a premium auth token/claim; reject with 402/403 when not premium.
- **Rate limits**:
  - Tight per-user limits for coach simulations (CPU-heavy)
  - Consider a dedicated Durable Object counter for per-user daily usage (same “atomic counter” spirit as quota/rate patterns)

### Performance budget (V1 hard constraints)
- **Iteration presets** (example defaults):
  - `FAST_1000`: intended for “try changes quickly”
  - `STANDARD_5000`: intended for “stable deltas”
- **Hard timeout**: if execution exceeds a time budget, stop early and return partial results with:
  - `meta.truncated=true`
  - reliability downgrade and explicit reason(s)
- **Target latency** (guideline):
  - Baseline: inherits existing insights caching behavior
  - Coach simulation (uncached): set explicit p95 target (e.g., <400–700ms depending on iterations) and enforce via timeout + rate limits

### Simulation engine (algorithmic, bounded)
- Implement a Monte Carlo simulation that produces:
  - \(\lambda_H, \lambda_A\) baseline from existing factors/weights
  - Shots via Poisson/NegBin proxy tied to \(\lambda\) and style
  - On-target and goals derived via chained probabilities
- **Deterministic deltas**:
  - Use **common random numbers**: baseline and what-if share the same random streams per iteration so deltas are stable and interpretable
- **Caps & confidence**:
  - Apply **cumulative caps** to prevent extreme swings from stacked modifiers
  - Downgrade reliability when inputs exceed supported data quality (too many overrides, missing critical data, truncation)

### Data availability & fallbacks (V1)
- **Key principle**: never “fake precision”. If required data is missing, fall back to a coarser modifier and downgrade reliability.
- **Examples**:
  - If player statistics are unavailable for a selected key player: treat it as a **unit-level** toggle (attack/mid/def) using league-average importance buckets.
  - If injuries endpoint fails: proceed with no injury effects and set `meta.dataQuality.injuries='unavailable'`.
  - If formation is unknown: disable formation-change modifier (or treat as low-impact) and mark LOW reliability.

### Input validation & realism guardrails (V1)
- **Modifier limits**:
  - Max N modifiers per run (prevents abuse and compounding nonsense)
  - Clamp slider ranges (e.g., press/tempo ±20%)
- **Cumulative caps**:
  - Cap total swing in \(\Delta \lambda\) and in probability space
  - Record cap hits in `meta` for transparency
- **Reliability downgrade rules**:
  - Too many overrides, missing critical data, or truncated runtime should lower reliability

### Modifier system (mapping to model deltas)
- Typed modifier catalog:
  - **FormationChange**: bounded \(\Delta\lambda\) based on formation stability and historical formation tendencies
  - **StyleSliders**: press intensity, line height, tempo → shot volume + defensive concession
  - **AvailabilityToggle**: key-player present/absent (when importance is known) → attack/defense deltas
  - **InjuryOverride**: mark player out/doubtful/minor → same importance scaling rules as injury integration
- Single entrypoint function:
  - `applyModifiersToBaselineFeatures(baselineFeatures, modifiers) -> adjustedFeatures + appliedAdjustments[]`

### Store-safe positioning checklist (V1)
- No odds, implied odds, “value”, “bet”, “stake”, ROI, “pick”, “tip”, “recommended”.
- No CTA tied to wagering; feature is framed as match dynamics / analytics.
- If you later add live mode (V2), keep it off marketing surfaces initially and consider age-rating impact.

### Frontend UX (premium-first, store-safe)
- Match Detail → Insights tab:
  - Card: “Be Your Coach” (locked for free users)
  - Builder UI (accordion sections): Lineup/Availability, Tactics, Conditions
  - Run button with iteration preset (fast/standard) and an uncertainty hint
  - Results: Before/After + Delta; show reliability badge prominently
- Avoid betting language globally (align with `docs/insights-new-implementation.md`)

### Caching strategy
- Baseline insights: use existing caching (per your Phase 5 patterns).
- What-if simulations:
  - Do **not** rely on Edge Cache for personalized payloads
  - Optionally cache identical payloads per user for a very short TTL (only if privacy-safe)

### Observability & safety
- Metrics:
  - median runtime by iteration preset
  - rejection counts (non-premium, rate-limited)
  - adjustment cap-hit rate (how often caps trigger)
- Kill-switch config flag to disable coach endpoint independently.

### Implementation order
1. Types + Zod schema for modifiers and request/response.
2. Premium gating + per-user rate limits for the new endpoint.
3. Baseline extraction: reuse existing simulation outputs as baseline inputs.
4. Modifier mapping layer (bounded deltas + per-modifier contributions).
5. Monte Carlo runner with deterministic seeds + common random numbers.
6. Response builder (baseline/whatIf/delta/meta).
7. Frontend card + builder + results UI (locked state + premium CTA).
8. Metrics + kill-switch.

### Key files likely involved
- Backend:
  - `apps/backend/src/modules/betting-insights/routes/` (new coach route)
  - `apps/backend/src/modules/betting-insights/services/` (coach simulation service)
  - `apps/backend/src/modules/betting-insights/simulations/` (Monte Carlo runner)
  - `apps/backend/src/modules/betting-insights/adjustments/` (modifier mapping/caps)
  - `apps/backend/src/modules/cache/cache-strategies.ts` (only if adding a short-lived strategy)
- Frontend (Expo): match detail insights UI components (paths depend on app structure)

### Acceptance criteria (V1)
- Premium-only access enforced server-side.
- Before/after deltas are stable across reruns with same inputs.
- Outputs are purely numeric/structured (no narrative generation).
- Bounded swings + confidence downgrades prevent unrealistic outputs.
- Rate limits prevent abuse; expensive runs can be disabled via kill-switch.
- Missing data does not break the endpoint (graceful fallback + explicit dataQuality flags).
- Runtime stays within the defined performance budget (or returns truncated-with-warning deterministically).


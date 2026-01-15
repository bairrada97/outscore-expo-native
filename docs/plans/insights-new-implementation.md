Product positioning (core principle)
Analytics tool, not betting tips: no odds, no “bet/pick/tip/value/ROI/staking/guarantee”.
Output tendencies + uncertainty + what can break it, so users learn football variance and you reduce “you told me X” blame.
Freemium strategy (€15/mo)
Free gives value but avoids “free tips”:
Only Key Facts (streaks/rates/H2H facts).
Result only as a neutral label (no %). Expanded details are paid.
Paid unlocks the real system:
All probability distributions, reliability, counter-signals, scenarios, tables/graphs, and “higher-likelihood alternatives”.
UX architecture (inside Match Detail → Insights)
Single Insights tab (no extra screens needed).
Use accordion cards (tap to expand inline).
Use bottom sheets for dense content (tables/charts), so the main view stays clean.
Card order & content (your final structure)
1) Key Facts (Free + Paid)
Use backend: homeInsights, awayInsights, h2hInsights.
Short 1-line facts (e.g., “Chelsea has scored in 10 consecutive matches”).
Paid can add a tiny expand: “why it matters / watch-out” (optional).
2) Result (Free limited, Paid full)
Powered by simulations where scenarioType = "MatchOutcome".
Free: “Slight home edge / Balanced / Slight away edge”.
Paid: Home/Draw/Away % + reliability reasons + conflicting signals.
3) Goals (Paid)
Card title: Total Goals Threshold Analysis
Includes:
“Both teams scoring likelihood” (never label as BTTS)
Total goals thresholds 0.5 → 5.5
Default (collapsed): show 1–2 highlights only.
Bottom sheet title: Goals Distribution Scenarios
Best UX: a small sparkline/line chart (pattern) + table (exact %).
Tap a row/point expands a mini explanation (2–4 lines max): Why + Watch-out.
4) Timing (Paid)
Powered by first-half simulation + minute buckets.
Collapsed: one-liner early/late tendency + badge.
Bottom sheet: minute histogram (0–15…76–90), optionally scoring vs conceding.
“Alternatives” (paid, must be higher-likelihood)
Lives inside Goals as “Higher-likelihood alternatives” (not “easier prediction”).
Can suggest:
Less demanding thresholds (2.5 → 1.5)
Cross-outcome like “Both teams scoring” only if higher likelihood
Rules:
Alternative probability must be ≥ current + 8–12 pts
Alternative reliability must be not worse
Max 2 suggestions
Add one short safety line: “Higher likelihood can still have downsides. Analysis, not advice.”
Threshold labeling (2.5 vs 3+ confusion)
Keep 2.5 for fast scanning, but add a tiny mapping to avoid misunderstandings:
Row subtitle: “=3+” (micro-legend), not long sentences.
Optional (i) legend in header: “2.5 → at least 3 goals”.
Disclaimers (heavy but not spammy)
One global micro-disclaimer at top of Insights.
One per-card micro-disclaimer (short).
Use reliability/volatility explanations as the “education layer” instead of repeating long legal text everywhere.
Graphs vs tables (goal thresholds)
Best: graph + table in paid bottom sheet.
If forced to choose one initially: table first, add sparkline later.
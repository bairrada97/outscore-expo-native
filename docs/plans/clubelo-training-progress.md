# ClubElo Training Alignment - Progress

## Data & Cleaning
- [x] Extend column detection for Elo and Bet365 odds
- [x] Include Elo/odds fields in cleaned matches output

## Training Features
- [x] Use dataset `HomeElo/AwayElo` instead of computed Elo
- [ ] Add de-vigged market implied probabilities (1X2 + O/U 2.5)

## Inference (Odds + ML)
- [ ] Fetch Bet365 odds for fixtures (1X2 + O/U 2.5)
- [ ] Pass odds into ML feature computation (guarded)
- [ ] Add market implied probability features in ML inference

## ClubElo Continuity
- [ ] Seed Elo from latest ClubElo snapshot
- [ ] Continue Elo updates internally from API-Football results
- [ ] Add ClubElo-compatible update logic (home adv, K-factor, goal diff)

## Weekly Training Refresh
- [ ] Build weekly training snapshot from API-Football
- [ ] Retrain + recalibrate models on new snapshots
- [ ] Compare ML+algo vs baselines (Elo-only, ML-only, algo-only)
- [ ] Track drift (accuracy/log-loss/calibration) and alert on regressions

## Notes
- Odds are optional at inference; missing odds fall back to null features.

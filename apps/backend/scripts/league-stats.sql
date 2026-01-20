INSERT INTO league_stats
 (provider, league_id, season, matches, avg_goals, over_2_5_rate, btts_rate, home_goals_avg, away_goals_avg, updated_at)
 VALUES ('api_football', 848, 2024, 409, 2.8166, 0.5281, 0.4719, 1.6675, 1.1491, datetime('now'))
 ON CONFLICT(provider, league_id, season) DO UPDATE SET
   matches = excluded.matches,
   avg_goals = excluded.avg_goals,
   over_2_5_rate = excluded.over_2_5_rate,
   btts_rate = excluded.btts_rate,
   home_goals_avg = excluded.home_goals_avg,
   away_goals_avg = excluded.away_goals_avg,
   updated_at = datetime('now');
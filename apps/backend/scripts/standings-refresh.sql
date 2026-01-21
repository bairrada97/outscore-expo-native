INSERT INTO standings_current (league_id, season, provider, fetched_at)
VALUES (95, 2025, 'api_football', datetime('now'))
ON CONFLICT(league_id, season)
DO UPDATE SET provider = excluded.provider, fetched_at = excluded.fetched_at, updated_at = datetime('now');
DELETE FROM standings_current_row WHERE league_id = 95 AND season = 2025;
INSERT INTO standings_current_row
 (league_id, season, team_id, rank, points, played, win, draw, loss, goals_for, goals_against, goal_diff, form, group_name, description, team_name, league_name)
 VALUES (95, 2025, 1367, 1, 52, 18, 17, 1, 0, 37, 4, 33, 'WWWWW', 'Primeira Liga', 'Promotion - Champions League (League phase)', 'FC Porto', 'Primeira Liga');
INSERT INTO standings_current_row
 (league_id, season, team_id, rank, points, played, win, draw, loss, goals_for, goals_against, goal_diff, form, group_name, description, team_name, league_name)
 VALUES (95, 2025, 1687, 2, 45, 18, 14, 3, 1, 50, 9, 41, 'WDWWW', 'Primeira Liga', 'Promotion - Champions League (Qualification)', 'Sporting CP', 'Primeira Liga');
INSERT INTO standings_current_row
 (league_id, season, team_id, rank, points, played, win, draw, loss, goals_for, goals_against, goal_diff, form, group_name, description, team_name, league_name)
 VALUES (95, 2025, 1368, 3, 42, 18, 12, 6, 0, 38, 11, 27, 'WWDWW', 'Primeira Liga', 'Promotion - Europa League (Qualification)', 'Benfica', 'Primeira Liga');
INSERT INTO standings_current_row
 (league_id, season, team_id, rank, points, played, win, draw, loss, goals_for, goals_against, goal_diff, form, group_name, description, team_name, league_name)
 VALUES (95, 2025, 1688, 4, 31, 18, 8, 7, 3, 24, 13, 11, 'WDDDD', 'Primeira Liga', 'Promotion - Conference League (Qualification)', 'GIL Vicente', 'Primeira Liga');
INSERT INTO standings_current_row
 (league_id, season, team_id, rank, points, played, win, draw, loss, goals_for, goals_against, goal_diff, form, group_name, description, team_name, league_name)
 VALUES (95, 2025, 1612, 5, 30, 18, 8, 6, 4, 32, 18, 14, 'WDDLW', 'Primeira Liga', NULL, 'SC Braga', 'Primeira Liga');
INSERT INTO standings_current_row
 (league_id, season, team_id, rank, points, played, win, draw, loss, goals_for, goals_against, goal_diff, form, group_name, description, team_name, league_name)
 VALUES (95, 2025, 1689, 6, 27, 18, 8, 3, 7, 25, 26, -1, 'LWWDL', 'Primeira Liga', NULL, 'Moreirense', 'Primeira Liga');
INSERT INTO standings_current_row
 (league_id, season, team_id, rank, points, played, win, draw, loss, goals_for, goals_against, goal_diff, form, group_name, description, team_name, league_name)
 VALUES (95, 2025, 1691, 7, 26, 18, 7, 5, 6, 21, 14, 7, 'WLLLW', 'Primeira Liga', NULL, 'Famalicao', 'Primeira Liga');
INSERT INTO standings_current_row
 (league_id, season, team_id, rank, points, played, win, draw, loss, goals_for, goals_against, goal_diff, form, group_name, description, team_name, league_name)
 VALUES (95, 2025, 1690, 8, 25, 18, 7, 4, 7, 18, 23, -5, 'LWDLW', 'Primeira Liga', NULL, 'Guimaraes', 'Primeira Liga');
INSERT INTO standings_current_row
 (league_id, season, team_id, rank, points, played, win, draw, loss, goals_for, goals_against, goal_diff, form, group_name, description, team_name, league_name)
 VALUES (95, 2025, 1692, 9, 23, 18, 6, 5, 7, 33, 29, 4, 'WLWWL', 'Primeira Liga', NULL, 'Estoril', 'Primeira Liga');
INSERT INTO standings_current_row
 (league_id, season, team_id, rank, points, played, win, draw, loss, goals_for, goals_against, goal_diff, form, group_name, description, team_name, league_name)
 VALUES (95, 2025, 1694, 10, 23, 18, 7, 2, 9, 19, 28, -9, 'WWLLL', 'Primeira Liga', NULL, 'Alverca', 'Primeira Liga');
INSERT INTO standings_current_row
 (league_id, season, team_id, rank, points, played, win, draw, loss, goals_for, goals_against, goal_diff, form, group_name, description, team_name, league_name)
 VALUES (95, 2025, 1693, 11, 20, 18, 4, 8, 6, 22, 31, -9, 'LWLDL', 'Primeira Liga', NULL, 'Rio Ave', 'Primeira Liga');
INSERT INTO standings_current_row
 (league_id, season, team_id, rank, points, played, win, draw, loss, goals_for, goals_against, goal_diff, form, group_name, description, team_name, league_name)
 VALUES (95, 2025, 1695, 12, 19, 18, 4, 7, 7, 23, 32, -9, 'LDWDL', 'Primeira Liga', NULL, 'Estrela', 'Primeira Liga');
INSERT INTO standings_current_row
 (league_id, season, team_id, rank, points, played, win, draw, loss, goals_for, goals_against, goal_diff, form, group_name, description, team_name, league_name)
 VALUES (95, 2025, 1696, 13, 17, 18, 4, 5, 9, 14, 20, -6, 'LDLDL', 'Primeira Liga', NULL, 'Santa Clara', 'Primeira Liga');
INSERT INTO standings_current_row
 (league_id, season, team_id, rank, points, played, win, draw, loss, goals_for, goals_against, goal_diff, form, group_name, description, team_name, league_name)
 VALUES (95, 2025, 1697, 14, 17, 18, 4, 5, 9, 22, 28, -6, 'LDLDW', 'Primeira Liga', NULL, 'Nacional', 'Primeira Liga');
INSERT INTO standings_current_row
 (league_id, season, team_id, rank, points, played, win, draw, loss, goals_for, goals_against, goal_diff, form, group_name, description, team_name, league_name)
 VALUES (95, 2025, 1699, 15, 17, 18, 4, 5, 9, 19, 42, -23, 'WLDDW', 'Primeira Liga', NULL, 'Arouca', 'Primeira Liga');
INSERT INTO standings_current_row
 (league_id, season, team_id, rank, points, played, win, draw, loss, goals_for, goals_against, goal_diff, form, group_name, description, team_name, league_name)
 VALUES (95, 2025, 1698, 16, 14, 18, 3, 5, 10, 17, 35, -18, 'LLDWD', 'Primeira Liga', 'Liga Portugal (Relegation)', 'Casa Pia', 'Primeira Liga');
INSERT INTO standings_current_row
 (league_id, season, team_id, rank, points, played, win, draw, loss, goals_for, goals_against, goal_diff, form, group_name, description, team_name, league_name)
 VALUES (95, 2025, 1700, 17, 12, 18, 3, 3, 12, 12, 30, -18, 'LLWLL', 'Primeira Liga', 'Relegation - Liga Portugal 2', 'Tondela', 'Primeira Liga');
INSERT INTO standings_current_row
 (league_id, season, team_id, rank, points, played, win, draw, loss, goals_for, goals_against, goal_diff, form, group_name, description, team_name, league_name)
 VALUES (95, 2025, 1701, 18, 4, 18, 0, 4, 14, 11, 44, -33, 'LLLDL', 'Primeira Liga', 'Relegation - Liga Portugal 2', 'AVS', 'Primeira Liga');
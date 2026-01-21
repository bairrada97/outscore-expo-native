import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import type { FixturesResponse } from "@outscore/shared-types";
import { getFootballApiFixturesByLeagueSeason } from "../src/pkg/util/football-api";

type CliArgs = {
	leagueId: number;
	season: number;
	dbName: string;
	configPath: string;
	isRemote: boolean;
	apply: boolean;
	outputPath: string;
};

const FINISHED_STATUSES = new Set(["FT", "AET", "PEN"]);

const parseArg = (args: string[], key: string) => {
	const index = args.findIndex((a) => a === key);
	if (index === -1) return null;
	return args[index + 1] ?? null;
};

const hasFlag = (args: string[], key: string) => args.includes(key);

const buildWranglerArgs = (params: {
	dbName: string;
	configPath?: string | null;
	isRemote?: boolean;
}): string[] => {
	const base = ["wrangler", "d1", "execute", params.dbName];
	if (params.configPath) {
		base.push("--config", params.configPath);
	}
	if (params.isRemote) {
		base.push("--remote");
	}
	return base;
};

const parseArgs = (): CliArgs => {
	const args = process.argv.slice(2);
	const leagueId = Number(parseArg(args, "--league-id"));
	const season = Number(parseArg(args, "--season"));
	const dbName = parseArg(args, "--db") ?? "ENTITIES_DB";
	const configPath =
		parseArg(args, "--config") ?? resolve(__dirname, "../wrangler.toml");
	const outputPath =
		parseArg(args, "--output") ?? resolve(__dirname, "league-stats.sql");

	if (!Number.isFinite(leagueId) || !Number.isFinite(season)) {
		throw new Error(
			"Usage: --league-id <id> --season <year> [--db ENTITIES_DB] [--config path] [--remote] [--apply] [--output path]",
		);
	}

	return {
		leagueId,
		season,
		dbName,
		configPath,
		isRemote: hasFlag(args, "--remote"),
		apply: hasFlag(args, "--apply"),
		outputPath,
	};
};

const buildSql = (params: {
	leagueId: number;
	season: number;
	matches: number;
	avgGoals: number;
	over25Rate: number;
	bttsRate: number;
	homeGoalsAvg: number;
	awayGoalsAvg: number;
}) => `INSERT INTO league_stats
 (provider, league_id, season, matches, avg_goals, over_2_5_rate, btts_rate, home_goals_avg, away_goals_avg, updated_at)
 VALUES ('api_football', ${params.leagueId}, ${params.season}, ${params.matches}, ${params.avgGoals.toFixed(4)}, ${params.over25Rate.toFixed(4)}, ${params.bttsRate.toFixed(4)}, ${params.homeGoalsAvg.toFixed(4)}, ${params.awayGoalsAvg.toFixed(4)}, datetime('now'))
 ON CONFLICT(provider, league_id, season) DO UPDATE SET
   matches = excluded.matches,
   avg_goals = excluded.avg_goals,
   over_2_5_rate = excluded.over_2_5_rate,
   btts_rate = excluded.btts_rate,
   home_goals_avg = excluded.home_goals_avg,
   away_goals_avg = excluded.away_goals_avg,
   updated_at = datetime('now');`;

const main = async () => {
	const args = parseArgs();

	const data: FixturesResponse = await getFootballApiFixturesByLeagueSeason(
		args.leagueId,
		args.season,
		process.env.FOOTBALL_API_URL,
		process.env.RAPIDAPI_KEY,
	);

	const fixtures = data.response.filter(
		(fixture) =>
			FINISHED_STATUSES.has(fixture.fixture.status.short) &&
			fixture.goals.home !== null &&
			fixture.goals.away !== null,
	);

	const matches = fixtures.length;
	if (matches === 0) {
		throw new Error("No finished fixtures found for league stats.");
	}

	let totalGoals = 0;
	let over25Count = 0;
	let bttsCount = 0;
	let homeGoals = 0;
	let awayGoals = 0;

	for (const fixture of fixtures) {
		const home = fixture.goals.home ?? 0;
		const away = fixture.goals.away ?? 0;
		const total = home + away;

		totalGoals += total;
		homeGoals += home;
		awayGoals += away;
		if (total > 2.5) over25Count += 1;
		if (home > 0 && away > 0) bttsCount += 1;
	}

	const avgGoals = totalGoals / matches;
	const over25Rate = over25Count / matches;
	const bttsRate = bttsCount / matches;
	const homeGoalsAvg = homeGoals / matches;
	const awayGoalsAvg = awayGoals / matches;

	const sql = buildSql({
		leagueId: args.leagueId,
		season: args.season,
		matches,
		avgGoals,
		over25Rate,
		bttsRate,
		homeGoalsAvg,
		awayGoalsAvg,
	});

	writeFileSync(args.outputPath, sql);
	console.log(
		`✅ Wrote league stats for ${args.leagueId} ${args.season} to ${args.outputPath}`,
	);

	if (args.apply) {
		execFileSync(
			"bunx",
			[
				...buildWranglerArgs({
					dbName: args.dbName,
					configPath: args.configPath,
					isRemote: args.isRemote,
				}),
				"--file",
				args.outputPath,
			],
			{ stdio: "inherit" },
		);
	}
};

main().catch((error) => {
	console.error("❌ League stats failed:", error);
	process.exit(1);
});

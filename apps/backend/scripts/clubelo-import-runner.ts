import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { similarityRatio } from "../../../ml/data-acquisition/fuzzy-matching";
import { normalizeTeamName } from "../../../ml/data-acquisition/team-name-normalizer";
import { parseCsv, toRecords } from "../../../ml/utils/csv";
import { buildWranglerArgs, loadRows } from "./lib/elo-utils";

type MappingOutput = {
	mappings: Record<string, string>;
	unmatched: Array<{
		raw: string;
		normalized: string;
		bestMatch: string | null;
		score: number;
	}>;
};

type TeamNameMap = {
	mappings: Record<string, string>;
};

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));

const ALIAS_TOKENS: Record<string, string> = {
	ath: "athletic",
	atl: "atletico",
	atlet: "atletico",
	sp: "sporting",
	st: "saint",
	dep: "deportivo",
	int: "inter",
	uni: "united",
};

const parseArg = (args: string[], key: string) => {
	const index = args.findIndex((value) => value === key);
	if (index === -1) return null;
	return args[index + 1] ?? null;
};

const hasFlag = (args: string[], key: string) => args.includes(key);

const isHttpUrl = (value: string) =>
	value.startsWith("http://") || value.startsWith("https://");

const ensureDir = (path: string) => {
	mkdirSync(path, { recursive: true });
	return path;
};

const resolveHeader = (headers: string[], candidates: string[]) => {
	const lower = headers.map((header) => header.trim().toLowerCase());
	for (const candidate of candidates) {
		const idx = lower.indexOf(candidate);
		if (idx !== -1) return headers[idx];
	}
	return null;
};

const loadClubNames = (inputPath: string) => {
	const raw = readFileSync(inputPath, "utf-8");
	const rows = toRecords(parseCsv(raw));
	if (!rows.length) {
		throw new Error("No rows parsed from EloRatings.csv");
	}
	const headers = Object.keys(rows[0]);
	const clubCol = resolveHeader(headers, ["club", "team", "team_name"]);
	if (!clubCol) {
		throw new Error(
			`Missing club column. Found headers: ${headers.join(", ")}`,
		);
	}

	const clubs = new Set<string>();
	for (const row of rows) {
		const club = String(row[clubCol] ?? "").trim();
		if (club) clubs.add(club);
	}
	return Array.from(clubs.values());
};

const loadCanonicalTeams = (params: {
	dbName: string;
	configPath?: string | null;
	isRemote?: boolean;
	canonicalPath?: string | null;
}) => {
	if (params.canonicalPath) {
		const payload = JSON.parse(
			readFileSync(params.canonicalPath, "utf-8"),
		) as string[];
		return payload.filter(Boolean);
	}

	const rows = loadRows([
		...buildWranglerArgs({
			dbName: params.dbName,
			configPath: params.configPath,
			isRemote: params.isRemote,
		}),
		"--command",
		"SELECT name FROM teams",
		"--json",
	]);
	return rows.map((row) => String(row.name)).filter(Boolean);
};

const loadOverrides = (overridesPath: string) => {
	if (!existsSync(overridesPath)) return {};
	const rawOverrides = JSON.parse(
		readFileSync(overridesPath, "utf-8"),
	) as Record<string, string>;
	return Object.fromEntries(
		Object.entries(rawOverrides).map(([raw, canonical]) => [
			normalizeTeamName(raw),
			canonical,
		]),
	);
};

const normalizeForMatching = (raw: string) => {
	const normalized = normalizeTeamName(raw);
	const expanded = normalized
		.split(/\s+/)
		.map((token) => ALIAS_TOKENS[token] ?? token)
		.join(" ")
		.trim();
	return { normalized, expanded };
};

const buildTeamMap = (params: {
	clubNames: string[];
	canonicalTeams: string[];
	overrides: Record<string, string>;
	threshold: number;
	relaxedThreshold: number;
	minGap: number;
}) => {
	const canonicalNormalized = params.canonicalTeams.map((name) => ({
		raw: name,
		normalized: normalizeTeamName(name),
	}));
	const canonicalIndex = new Map<string, string | null>();
	for (const entry of canonicalNormalized) {
		const existing = canonicalIndex.get(entry.normalized);
		canonicalIndex.set(entry.normalized, existing ? null : entry.raw);
	}
	const mappings: Record<string, string> = {};
	const unmatched: MappingOutput["unmatched"] = [];

	for (const raw of params.clubNames) {
		const { normalized, expanded } = normalizeForMatching(raw);
		const override = params.overrides[normalized];
		if (override) {
			mappings[normalized] = override;
			continue;
		}

		const exactCanonical = canonicalIndex.get(normalized);
		if (exactCanonical) {
			mappings[normalized] = exactCanonical;
			continue;
		}

		let bestMatch: string | null = null;
		let bestScore = 0;
		let runnerUpScore = 0;
		for (const canonical of canonicalNormalized) {
			const score = similarityRatio(normalized, canonical.normalized);
			const expandedScore =
				expanded && expanded !== normalized
					? similarityRatio(expanded, canonical.normalized)
					: score;
			const effectiveScore = Math.max(score, expandedScore);
			if (effectiveScore > bestScore) {
				runnerUpScore = bestScore;
				bestScore = effectiveScore;
				bestMatch = canonical.raw;
			} else if (effectiveScore > runnerUpScore) {
				runnerUpScore = effectiveScore;
			}
		}

		if (bestMatch && bestScore >= params.threshold) {
			mappings[normalized] = bestMatch;
		} else if (
			bestMatch &&
			bestScore >= params.relaxedThreshold &&
			bestScore - runnerUpScore >= params.minGap
		) {
			mappings[normalized] = bestMatch;
		} else {
			unmatched.push({ raw, normalized, bestMatch, score: bestScore });
		}
	}

	return { mappings, unmatched } satisfies MappingOutput;
};

const fetchIfNeeded = async (inputPath: string, workDir: string) => {
	if (!isHttpUrl(inputPath)) return resolve(inputPath);
	const response = await fetch(inputPath);
	if (!response.ok) {
		throw new Error(
			`Failed to download ${inputPath}: ${response.status} ${response.statusText}`,
		);
	}
	const data = await response.text();
	const fileName = basename(new URL(inputPath).pathname) || "EloRatings.csv";
	const outputPath = resolve(workDir, fileName);
	writeFileSync(outputPath, data, "utf-8");
	return outputPath;
};

const runScript = (scriptPath: string, args: string[]) => {
	execFileSync("bun", [scriptPath, ...args], { stdio: "inherit" });
};

const main = async () => {
	const args = process.argv.slice(2);
	const inputPath = parseArg(args, "--input");
	const dbName = parseArg(args, "--db");
	const teamMapPath = parseArg(args, "--team-map");
	const countryMapPath = parseArg(args, "--country-map");
	const configPath =
		parseArg(args, "--config") ?? resolve(SCRIPT_DIR, "../wrangler.toml");
	const canonicalPath = parseArg(args, "--canonical");
	const teamMapOut =
		parseArg(args, "--team-map-out") ??
		resolve(process.cwd(), "ml/data/team-name-map.json");
	const overridesPath =
		parseArg(args, "--overrides") ??
		resolve(process.cwd(), "ml/config/team-name-overrides.json");
	const threshold = Number(parseArg(args, "--threshold") ?? "0.85");
	const relaxedThreshold = Number(
		parseArg(args, "--relaxed-threshold") ?? "0.78",
	);
	const minGap = Number(parseArg(args, "--min-gap") ?? "0.08");
	const unmatchedOut =
		parseArg(args, "--unmatched-out") ??
		resolve(process.cwd(), "ml/data/team-name-unmatched.json");
	const apply = hasFlag(args, "--apply");
	const isRemote = hasFlag(args, "--remote");

	if (!inputPath || !dbName) {
		throw new Error(
			"Usage: --input <EloRatings.csv|url> --db ENTITIES_DB [--team-map map.json] [--team-map-out path] [--canonical teams.json] [--country-map map.json] [--overrides overrides.json] [--threshold 0.85] [--relaxed-threshold 0.78] [--min-gap 0.08] [--unmatched-out path] [--config path] [--remote] [--apply]",
		);
	}

	const workDir = ensureDir(resolve(tmpdir(), "clubelo-import"));
	const resolvedInput = await fetchIfNeeded(inputPath, workDir);
	let resolvedTeamMap = teamMapPath ? resolve(teamMapPath) : null;

	if (!resolvedTeamMap) {
		const clubNames = loadClubNames(resolvedInput);
		const canonicalTeams = loadCanonicalTeams({
			dbName,
			configPath,
			isRemote,
			canonicalPath,
		});
		const overrides = loadOverrides(overridesPath);
		const mapping = buildTeamMap({
			clubNames,
			canonicalTeams,
			overrides,
			threshold,
			relaxedThreshold,
			minGap,
		});
		const payload: TeamNameMap = { mappings: mapping.mappings };
		writeFileSync(teamMapOut, JSON.stringify(payload, null, 2), "utf-8");
		resolvedTeamMap = teamMapOut;
		console.log(`✅ Team map written to ${resolvedTeamMap}`);
		writeFileSync(
			unmatchedOut,
			JSON.stringify(mapping.unmatched, null, 2),
			"utf-8",
		);
		if (mapping.unmatched.length) {
			console.warn(`⚠️ Unmatched clubs: ${mapping.unmatched.length}`);
			console.warn(`📄 Unmatched list written to ${unmatchedOut}`);
		}
	}

	const importArgs = [
		"--input",
		resolvedInput,
		"--db",
		dbName,
		"--team-map",
		resolvedTeamMap,
		"--config",
		configPath,
	];
	if (countryMapPath) {
		importArgs.push("--country-map", resolve(countryMapPath));
	}
	if (isRemote) importArgs.push("--remote");
	if (apply) importArgs.push("--apply");

	const importScript = resolve(SCRIPT_DIR, "clubelo-import.ts");
	runScript(importScript, importArgs);
};

main().catch((error) => {
	console.error("❌ ClubElo import runner failed:", error);
	process.exit(1);
});

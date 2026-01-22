import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseCsv, toRecords } from "../utils/csv";
import { normalizeTeamName } from "./team-name-normalizer";
import { similarityRatio } from "./fuzzy-matching";

type MappingOutput = {
	mappings: Record<string, string>;
	unmatched: Array<{ raw: string; normalized: string; bestMatch: string | null; score: number }>;
};

const args = process.argv.slice(2);
const inputIndex = args.indexOf("--input");
const canonicalIndex = args.indexOf("--canonical");
const outIndex = args.indexOf("--out");
const thresholdIndex = args.indexOf("--threshold");
const overridesIndex = args.indexOf("--overrides");

if (inputIndex === -1 || canonicalIndex === -1) {
	console.error(
		"Usage: bun ml/data-acquisition/team-name-mapping.ts --input <raw.csv|clean.csv> --canonical <canonical.json> [--out <map.json>] [--threshold 0.85] [--overrides <overrides.json>]",
	);
	process.exit(1);
}

const inputPath = resolve(args[inputIndex + 1]);
const canonicalPath = resolve(args[canonicalIndex + 1]);
const outputPath =
	outIndex !== -1
		? resolve(args[outIndex + 1])
		: resolve("ml/data/team-name-map.json");
const threshold =
	thresholdIndex !== -1 ? Number(args[thresholdIndex + 1]) : 0.85;
const overridesPath =
	overridesIndex !== -1
		? resolve(args[overridesIndex + 1])
		: resolve("ml/config/team-name-overrides.json");

let overrides: Record<string, string> = {};
if (existsSync(overridesPath)) {
	const rawOverrides = JSON.parse(readFileSync(overridesPath, "utf-8")) as Record<
		string,
		string
	>;
	overrides = Object.fromEntries(
		Object.entries(rawOverrides).map(([raw, canonical]) => [
			normalizeTeamName(raw),
			canonical,
		]),
	);
}

const canonicalList = JSON.parse(readFileSync(canonicalPath, "utf-8")) as string[];
const canonicalNormalized = canonicalList.map((name) => ({
	raw: name,
	normalized: normalizeTeamName(name),
}));

const rawTeams = new Set<string>();
if (inputPath.endsWith(".csv")) {
	const rows = toRecords(parseCsv(readFileSync(inputPath, "utf-8")));
	for (const record of rows) {
		if (record.homeTeam) rawTeams.add(record.homeTeam);
		if (record.awayTeam) rawTeams.add(record.awayTeam);
		if (record.HomeTeam) rawTeams.add(record.HomeTeam);
		if (record.AwayTeam) rawTeams.add(record.AwayTeam);
	}
} else {
	const lines = readFileSync(inputPath, "utf-8")
		.split("\n")
		.filter(Boolean);
	for (const line of lines) {
		const row = JSON.parse(line);
		if (row.homeTeam) rawTeams.add(row.homeTeam);
		if (row.awayTeam) rawTeams.add(row.awayTeam);
	}
}

const mappings: Record<string, string> = {};
const unmatched: MappingOutput["unmatched"] = [];

for (const raw of rawTeams) {
	const normalized = normalizeTeamName(raw);
	const override = overrides[normalized];
	if (override) {
		mappings[normalized] = override;
		continue;
	}
	let bestMatch: string | null = null;
	let bestScore = 0;

	for (const canonical of canonicalNormalized) {
		const score = similarityRatio(normalized, canonical.normalized);
		if (score > bestScore) {
			bestScore = score;
			bestMatch = canonical.raw;
		}
	}

	if (bestMatch && bestScore >= threshold) {
		mappings[normalized] = bestMatch;
	} else {
		unmatched.push({ raw, normalized, bestMatch, score: bestScore });
	}
}

const output: MappingOutput = { mappings, unmatched };
writeFileSync(outputPath, JSON.stringify(output, null, 2), "utf-8");
console.log(`✅ Mapping created at ${outputPath}`);
console.log(`Mapped: ${Object.keys(mappings).length}, Unmatched: ${unmatched.length}`);

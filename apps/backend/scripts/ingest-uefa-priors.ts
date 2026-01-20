import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

type AssociationPayload = {
  countryCode: string;
  rank?: number;
  coefficient5y?: number;
};

type ClubPayload = {
  uefaClubKey: string;
  name: string;
  countryCode?: string | null;
  coefficient?: number | null;
};

type ClubTeamMapPayload = {
  uefaClubKey: string;
  apiFootballTeamId: number;
  confidence?: number | null;
  method?: string | null;
};

type PriorsPayload = {
  asOfSeason: number;
  associations: AssociationPayload[];
  clubs: ClubPayload[];
  clubTeamMap: ClubTeamMapPayload[];
};

type CliArgs = {
  payloadPath: string;
  dbName: string;
  apply: boolean;
  sqlPath: string;
};

const DEFAULT_PAYLOAD_PATH = resolve(
  process.cwd(),
  "../../docs/plans/uefa-priors-payload.json",
);

const DEFAULT_DB_NAME = "outscore-entities";

const escapeSqlString = (value: string) =>
  value.replace(/'/g, "''").split("\u0000").join("");

const sqlValue = (value: unknown) => {
  if (value === null || value === undefined || value === "") return "NULL";
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return `'${escapeSqlString(String(value))}'`;
};

const parseArgs = (): CliArgs => {
  const args = process.argv.slice(2);
  const getArg = (flag: string) => {
    const index = args.indexOf(flag);
    if (index === -1) return undefined;
    return args[index + 1];
  };

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Usage: bun scripts/ingest-uefa-priors.ts [options]

Options:
  --payload <path>   Path to payload JSON (default: ${DEFAULT_PAYLOAD_PATH})
  --db <name>        D1 database name (default: ${DEFAULT_DB_NAME})
  --apply            Execute SQL with wrangler (default: dry-run)
  --sql <path>       Write SQL to this path (default: temp file)
  --help             Show this help
`);
    process.exit(0);
  }

  const payloadPath = resolve(getArg("--payload") ?? DEFAULT_PAYLOAD_PATH);
  const dbName = getArg("--db") ?? DEFAULT_DB_NAME;
  const apply = args.includes("--apply");
  const sqlPath =
    getArg("--sql") ??
    resolve(tmpdir(), `uefa-priors-${Date.now().toString()}.sql`);

  return { payloadPath, dbName, apply, sqlPath };
};

const buildSql = (payload: PriorsPayload) => {
  const lines: string[] = [];
  const asOfSeason = payload.asOfSeason;

  for (const assoc of payload.associations) {
    lines.push(`
INSERT INTO uefa_association_coefficients (
  country_code,
  as_of_season,
  rank,
  coefficient5y,
  updated_at
) VALUES (
  ${sqlValue(assoc.countryCode)},
  ${sqlValue(asOfSeason)},
  ${sqlValue(assoc.rank ?? null)},
  ${sqlValue(assoc.coefficient5y ?? null)},
  datetime('now')
)
ON CONFLICT(country_code, as_of_season)
DO UPDATE SET
  rank = excluded.rank,
  coefficient5y = excluded.coefficient5y,
  updated_at = datetime('now');
`);
  }

  for (const club of payload.clubs) {
    lines.push(`
INSERT INTO uefa_club_coefficients (
  uefa_club_key,
  as_of_season,
  name,
  country_code,
  coefficient,
  updated_at
) VALUES (
  ${sqlValue(club.uefaClubKey)},
  ${sqlValue(asOfSeason)},
  ${sqlValue(club.name)},
  ${sqlValue(club.countryCode ?? null)},
  ${sqlValue(club.coefficient ?? null)},
  datetime('now')
)
ON CONFLICT(uefa_club_key, as_of_season)
DO UPDATE SET
  name = excluded.name,
  country_code = excluded.country_code,
  coefficient = excluded.coefficient,
  updated_at = datetime('now');
`);
  }

  for (const map of payload.clubTeamMap) {
    lines.push(`
INSERT INTO uefa_club_team_map (
  uefa_club_key,
  as_of_season,
  api_football_team_id,
  team_id,
  confidence,
  method,
  updated_at
) VALUES (
  ${sqlValue(map.uefaClubKey)},
  ${sqlValue(asOfSeason)},
  ${sqlValue(map.apiFootballTeamId)},
  (
    SELECT internal_id FROM external_ids
    WHERE provider = 'api_football'
      AND entity_type = 'team'
      AND provider_id = ${sqlValue(map.apiFootballTeamId)}
  ),
  ${sqlValue(map.confidence ?? null)},
  ${sqlValue(map.method ?? null)},
  datetime('now')
)
ON CONFLICT(uefa_club_key, as_of_season)
DO UPDATE SET
  api_football_team_id = excluded.api_football_team_id,
  team_id = excluded.team_id,
  confidence = excluded.confidence,
  method = excluded.method,
  updated_at = datetime('now');
`);
  }

  return lines.join("\n");
};

const main = () => {
  const { payloadPath, dbName, apply, sqlPath } = parseArgs();
  const raw = readFileSync(payloadPath, "utf-8");
  let payload: PriorsPayload;
  try {
    payload = JSON.parse(raw) as PriorsPayload;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);
    const preview = raw.slice(0, 200).replace(/\s+/g, " ");
    console.error(
      `❌ Failed to parse JSON payload at ${payloadPath}: ${message}\nPreview: ${preview}`,
    );
    throw error;
  }

  if (!payload.asOfSeason) {
    throw new Error("Payload is missing asOfSeason.");
  }

  if (!payload.associations?.length || !payload.clubs?.length) {
    throw new Error("Payload is missing associations or clubs.");
  }

  const sql = buildSql(payload);
  writeFileSync(sqlPath, sql, "utf-8");

  if (!apply) {
    console.log(`SQL written to: ${sqlPath}`);
    console.log(`Run:\n  wrangler d1 execute ${dbName} --file ${sqlPath}`);
    return;
  }

  execFileSync("wrangler", ["d1", "execute", dbName, "--file", sqlPath], {
    stdio: "inherit",
  });
};

main();

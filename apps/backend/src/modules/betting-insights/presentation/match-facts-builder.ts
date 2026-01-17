import type {
  FactCard,
  H2HData,
  MatchContext,
  ProcessedMatch,
  TeamContext,
  TeamData,
} from "../types";
import type { FixtureInjuries } from "../data/injuries";

type FactCandidate = {
  id: string;
  build: () => FactCard | null;
};

const MAX_FACTS = 6;
const H2H_MIN_SAMPLE = 3;

function formatPair(left: string, right: string): string {
  return `${left} | ${right}`;
}

function formatPercent(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`;
}

function formatNumber(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return "0";
  const rounded = Math.round(value * 10 ** digits) / 10 ** digits;
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(digits);
}

function formatFixed(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return (0).toFixed(digits);
  return value.toFixed(digits);
}

function formatLabel(raw: string): string {
  return raw
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getLatestMatches(matches: ProcessedMatch[], limit: number): ProcessedMatch[] {
  return [...matches]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, limit);
}

function computeWdl(matches: ProcessedMatch[]) {
  let wins = 0;
  let draws = 0;
  let losses = 0;
  for (const match of matches) {
    if (match.result === "W") wins += 1;
    else if (match.result === "D") draws += 1;
    else losses += 1;
  }
  return { wins, draws, losses };
}

function buildFormFact({
  id,
  title,
  matches,
  subtitle,
  side,
}: {
  id: string;
  title: string;
  matches: ProcessedMatch[];
  subtitle: string;
  side: FactCard["side"];
}): FactCard | null {
  const lastMatches = getLatestMatches(matches, 5);
  if (lastMatches.length === 0) return null;
  const { wins, draws, losses } = computeWdl(lastMatches);
  return {
    id,
    title,
    value: `${wins}W-${draws}D-${losses}L`,
    subtitle,
    side,
  };
}

function buildAvgGoalsScoredFact(home: TeamData, away: TeamData): FactCard | null {
  return {
    id: "avg_goals_scored_season_each",
    title: "Avg Scored",
    value: formatPair(
      formatFixed(home.stats.avgGoalsScored, 1),
      formatFixed(away.stats.avgGoalsScored, 1),
    ),
    subtitle: "Season",
    side: "BOTH",
  };
}

function buildAvgGoalsConcededFact(home: TeamData, away: TeamData): FactCard | null {
  return {
    id: "avg_goals_conceded_season_each",
    title: "Avg Conceded",
    value: formatPair(
      formatFixed(home.stats.avgGoalsConceded, 1),
      formatFixed(away.stats.avgGoalsConceded, 1),
    ),
    subtitle: "Season",
    side: "BOTH",
  };
}

function buildAvgTotalGoalsFact(home: TeamData, away: TeamData): FactCard | null {
  const homeTotal = home.stats.avgGoalsScored + home.stats.avgGoalsConceded;
  const awayTotal = away.stats.avgGoalsScored + away.stats.avgGoalsConceded;
  return {
    id: "avg_total_goals_season_each",
    title: "Avg Total Goals",
    value: formatPair(formatFixed(homeTotal, 1), formatFixed(awayTotal, 1)),
    subtitle: "Season",
    side: "BOTH",
  };
}

function buildH2HFact(h2h: H2HData): FactCard | null {
  if (h2h.matches.length < H2H_MIN_SAMPLE) return null;
  const lastMatches = getLatestMatches(h2h.matches, Math.min(7, h2h.matches.length));
  const { wins, draws, losses } = computeWdl(lastMatches);
  return {
    id: "h2h_lastN_summary",
    title: "H2H Record",
    value: `${wins}W-${draws}D-${losses}L`,
    subtitle: `Last ${lastMatches.length} H2H`,
    side: "BOTH",
  };
}

function buildLeaguePositionFact(
  homeContext: TeamContext,
  awayContext: TeamContext,
  matchContext: MatchContext,
): FactCard | null {
  if (matchContext.matchType !== "LEAGUE") return null;
  if (!homeContext.leaguePosition || !awayContext.leaguePosition) return null;
  return {
    id: "league_position_gap",
    title: "League Position",
    value: formatPair(`${homeContext.leaguePosition}`, `${awayContext.leaguePosition}`),
    subtitle: "Standings",
    side: "BOTH",
    icon: "#",
  };
}

function buildInjuriesAbsencesFact(injuries: FixtureInjuries | null | undefined): FactCard | null {
  if (!injuries) return null;
  return {
    id: "injury_absences_total_each",
    title: "Injuries",
    value: formatPair(`${injuries.homeInjuries.length}`, `${injuries.awayInjuries.length}`),
    subtitle: "Fixture absences",
    side: "BOTH",
  };
}

function buildCleanSheetFact(
  homeContext: TeamContext,
  awayContext: TeamContext,
): FactCard | null {
  return {
    id: "clean_sheets_season_each",
    title: "Clean Sheets",
    value: formatPair(
      formatPercent(homeContext.dna.cleanSheetPercentage),
      formatPercent(awayContext.dna.cleanSheetPercentage),
    ),
    subtitle: "Season rate",
    side: "BOTH",
  };
}

function buildRestDaysFact(homeContext: TeamContext, awayContext: TeamContext): FactCard {
  return {
    id: "rest_days_each",
    title: "Rest Days",
    value: formatPair(`${homeContext.daysSinceLastMatch}`, `${awayContext.daysSinceLastMatch}`),
    subtitle: "Since last match",
    side: "BOTH",
  };
}

function buildMotivationFact(
  homeContext: TeamContext,
  awayContext: TeamContext,
  matchContext: MatchContext,
): FactCard | null {
  if (matchContext.matchType !== "LEAGUE") return null;
  if (!homeContext.motivation || !awayContext.motivation) return null;
  return {
    id: "motivation_each",
    title: "Motivation",
    value: formatPair(
      formatLabel(homeContext.motivation),
      formatLabel(awayContext.motivation),
    ),
    subtitle: "Season stakes",
    side: "BOTH",
  };
}

function buildLateStarterFact(
  homeContext: TeamContext,
  awayContext: TeamContext,
): FactCard {
  return {
    id: "late_starter_each",
    title: "Late Starters",
    value: formatPair(
      homeContext.dna.isLateStarter ? "Yes" : "No",
      awayContext.dna.isLateStarter ? "Yes" : "No",
    ),
    subtitle: "First 15 mins scoring",
    side: "BOTH",
  };
}

function buildOverallFormFact(
  homeContext: TeamContext,
  awayContext: TeamContext,
): FactCard | null {
  return {
    id: "overall_form_each",
    title: "Recent Form",
    value: formatPair(homeContext.form || "—", awayContext.form || "—"),
    subtitle: "Overall last 5",
    side: "BOTH",
  };
}

function buildMatchTypeFact(matchContext: MatchContext): FactCard {
  return {
    id: "match_type",
    title: "Match Type",
    value: formatLabel(matchContext.matchType),
    subtitle: "Competition format",
    side: "BOTH",
  };
}

export function buildMatchFacts({
  homeTeam,
  awayTeam,
  homeContext,
  awayContext,
  h2h,
  matchContext,
  injuries,
}: {
  homeTeam: TeamData;
  awayTeam: TeamData;
  homeContext: TeamContext;
  awayContext: TeamContext;
  h2h: H2HData;
  matchContext: MatchContext;
  injuries?: FixtureInjuries | null;
}): FactCard[] {
  const primaryFacts: FactCandidate[] = [
    {
      id: "home_form_last5_home",
      build: () =>
        buildFormFact({
          id: "home_form_last5_home",
          title: "Home Form",
          matches: homeTeam.lastHomeMatches,
          subtitle: "Last 5 (Home)",
          side: "HOME",
        }),
    },
    {
      id: "away_form_last5_away",
      build: () =>
        buildFormFact({
          id: "away_form_last5_away",
          title: "Away Form",
          matches: awayTeam.lastAwayMatches,
          subtitle: "Last 5 (Away)",
          side: "AWAY",
        }),
    },
    {
      id: "avg_goals_scored_season_each",
      build: () => buildAvgGoalsScoredFact(homeTeam, awayTeam),
    },
    {
      id: "avg_goals_conceded_season_each",
      build: () => buildAvgGoalsConcededFact(homeTeam, awayTeam),
    },
    {
      id: "league_position_gap",
      build: () => buildLeaguePositionFact(homeContext, awayContext, matchContext),
    },
    {
      id: "h2h_lastN_summary",
      build: () => buildH2HFact(h2h),
    },
  ];

  const fallbackFacts: FactCandidate[] = [
    {
      id: "injury_absences_total_each",
      build: () => buildInjuriesAbsencesFact(injuries),
    },
    {
      id: "avg_total_goals_season_each",
      build: () => buildAvgTotalGoalsFact(homeTeam, awayTeam),
    },
    {
      id: "rest_days_each",
      build: () => buildRestDaysFact(homeContext, awayContext),
    },
    {
      id: "clean_sheets_season_each",
      build: () => buildCleanSheetFact(homeContext, awayContext),
    },
    {
      id: "overall_form_each",
      build: () => buildOverallFormFact(homeContext, awayContext),
    },
    {
      id: "late_starter_each",
      build: () => buildLateStarterFact(homeContext, awayContext),
    },
    {
      id: "motivation_each",
      build: () => buildMotivationFact(homeContext, awayContext, matchContext),
    },
    {
      id: "match_type",
      build: () => buildMatchTypeFact(matchContext),
    },
  ];

  const selected: FactCard[] = [];
  const usedIds = new Set<string>();

  for (const candidate of primaryFacts) {
    const fact = candidate.build();
    if (fact) {
      selected.push(fact);
      usedIds.add(candidate.id);
    }
  }

  for (const candidate of fallbackFacts) {
    if (selected.length >= MAX_FACTS) break;
    if (usedIds.has(candidate.id)) continue;
    const fact = candidate.build();
    if (!fact) continue;
    selected.push(fact);
    usedIds.add(candidate.id);
  }

  return selected.slice(0, MAX_FACTS);
}

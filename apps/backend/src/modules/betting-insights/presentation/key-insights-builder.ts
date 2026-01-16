import type { Insight, TeamContext, TeamData } from "../types";
import { buildLeagueRelativeInsightsForTeam, type LeagueStandingsRow } from "./league-relative-insights";

const MAX_KEY_INSIGHTS = 3;
const MIN_LEAGUE_RELATIVE_PRIORITY_TO_FORCE = 80;

function buildFallbackInsight(
  text: string,
  category: Insight["category"] = "CONTEXT",
): Insight {
  return {
    text,
    emoji: "ℹ️",
    priority: 10,
    category,
    severity: "LOW",
  };
}

function formatPercent(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`;
}

function formatFixed(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return (0).toFixed(digits);
  return value.toFixed(digits);
}

function buildFallbacksForTeam(
  teamContext: TeamContext,
  teamData: TeamData,
): Insight[] {
  const teamName = teamContext.name;

  const candidates: Array<Insight | null> = [
    teamData.stats.gamesPlayed > 0
      ? buildFallbackInsight(
          `${teamName} have kept ${teamData.stats.cleanSheetsTotal} clean sheets in ${teamData.stats.gamesPlayed} league matches this season.`,
          "DEFENSIVE",
        )
      : buildFallbackInsight(
          `${teamName} have kept a clean sheet in ${formatPercent(
            teamContext.dna.cleanSheetPercentage,
          )} of matches this season.`,
          "DEFENSIVE",
        ),
    buildFallbackInsight(
      `${teamName} have averaged ${formatFixed(teamData.stats.avgGoalsScored, 1)} goals per game this season.`,
      "SCORING",
    ),
    buildFallbackInsight(
      `${teamName} had ${teamContext.daysSinceLastMatch} days of rest since the last match.`,
      "CONTEXT",
    ),
    teamContext.dna.isLateStarter
      ? buildFallbackInsight(
          `${teamName} are often late starters in the first 15 minutes.`,
          "TIMING",
        )
      : null,
  ];

  return candidates.filter(Boolean) as Insight[];
}

function takeTop(
  insights: Insight[],
  limit: number,
  existingTexts: Set<string>,
): Insight[] {
  const picked: Insight[] = [];
  for (const insight of insights) {
    if (picked.length >= limit) break;
    if (existingTexts.has(insight.text)) continue;
    picked.push(insight);
    existingTexts.add(insight.text);
  }
  return picked;
}

function maybeInjectLeagueRelativeInsight({
  selected,
  usedTexts,
  leagueInsights,
}: {
  selected: Insight[];
  usedTexts: Set<string>;
  leagueInsights: Insight[];
}) {
  const candidate = leagueInsights.find(
    (i) =>
      !usedTexts.has(i.text) &&
      typeof i.priority === "number" &&
      i.priority >= MIN_LEAGUE_RELATIVE_PRIORITY_TO_FORCE,
  );
  if (!candidate) return;

  if (selected.length < MAX_KEY_INSIGHTS) {
    selected.push(...takeTop([candidate], 1, usedTexts));
    return;
  }

  // Replace the weakest insight if the league insight is stronger.
  let weakestIdx = -1;
  let weakestPriority = Number.POSITIVE_INFINITY;
  for (let i = 0; i < selected.length; i += 1) {
    const p = selected[i]?.priority ?? 0;
    if (p < weakestPriority) {
      weakestPriority = p;
      weakestIdx = i;
    }
  }

  if (weakestIdx >= 0 && candidate.priority > weakestPriority) {
    usedTexts.delete(selected[weakestIdx].text);
    selected[weakestIdx] = candidate;
    usedTexts.add(candidate.text);
  }
}

export function buildKeyInsights({
  homeInsights,
  awayInsights,
  homeContext,
  awayContext,
  homeTeam,
  awayTeam,
  leagueName,
  standingsRows,
}: {
  homeInsights: Insight[];
  awayInsights: Insight[];
  homeContext: TeamContext;
  awayContext: TeamContext;
  homeTeam: TeamData;
  awayTeam: TeamData;
  leagueName: string;
  standingsRows?: LeagueStandingsRow[] | null;
}): { home: Insight[]; away: Insight[] } {
  const homeSelected = homeInsights.slice(0, MAX_KEY_INSIGHTS);
  const awaySelected = awayInsights.slice(0, MAX_KEY_INSIGHTS);

  const usedHomeTexts = new Set(homeSelected.map((insight) => insight.text));
  const usedAwayTexts = new Set(awaySelected.map((insight) => insight.text));

  // Always try to include at least one league-relative insight when available.
  // If we already have 3, replace the weakest when the league insight is strong (top/bottom-3 type).
  if (standingsRows && standingsRows.length > 0) {
    const homeLeagueInsights = buildLeagueRelativeInsightsForTeam({
      teamId: homeTeam.id,
      teamName: homeContext.name,
      leagueName,
      standingsRows,
      teamRole: "HOME",
    });
    maybeInjectLeagueRelativeInsight({
      selected: homeSelected,
      usedTexts: usedHomeTexts,
      leagueInsights: homeLeagueInsights,
    });

    const awayLeagueInsights = buildLeagueRelativeInsightsForTeam({
      teamId: awayTeam.id,
      teamName: awayContext.name,
      leagueName,
      standingsRows,
      teamRole: "AWAY",
    });
    maybeInjectLeagueRelativeInsight({
      selected: awaySelected,
      usedTexts: usedAwayTexts,
      leagueInsights: awayLeagueInsights,
    });
  }

  if (homeSelected.length < MAX_KEY_INSIGHTS) {
    const fallbacks = buildFallbacksForTeam(homeContext, homeTeam);
    homeSelected.push(
      ...takeTop(
        fallbacks,
        MAX_KEY_INSIGHTS - homeSelected.length,
        usedHomeTexts,
      ),
    );
  }

  if (awaySelected.length < MAX_KEY_INSIGHTS) {
    const fallbacks = buildFallbacksForTeam(awayContext, awayTeam);
    awaySelected.push(
      ...takeTop(
        fallbacks,
        MAX_KEY_INSIGHTS - awaySelected.length,
        usedAwayTexts,
      ),
    );
  }

  return { home: homeSelected, away: awaySelected };
}

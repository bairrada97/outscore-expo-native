import type { Insight } from "../types";

export type LeagueStandingsRow = {
  teamId: number;
  teamName: string;
  rank: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  form: string | null;
  description: string | null;
  home: {
    played: number;
    win: number;
    draw: number;
    loss: number;
    goalsFor: number;
    goalsAgainst: number;
  };
  away: {
    played: number;
    win: number;
    draw: number;
    loss: number;
    goalsFor: number;
    goalsAgainst: number;
  };
};

function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  const mod10 = n % 10;
  if (mod10 === 1) return `${n}st`;
  if (mod10 === 2) return `${n}nd`;
  if (mod10 === 3) return `${n}rd`;
  return `${n}th`;
}

function rankSuffix(tied: boolean): string {
  return tied ? " (tied)" : "";
}

function mostRankPhrase(rank: number): string {
  if (rank === 1) return "the most";
  return `the ${ordinal(rank)} most`;
}

function bestRankPhrase(rank: number): string {
  if (rank === 1) return "the best";
  return `the ${ordinal(rank)} best`;
}

function worstRankPhrase(rank: number): string {
  if (rank === 1) return "the worst";
  return `the ${ordinal(rank)} worst`;
}

function pointsFromForm(form: string): number {
  let points = 0;
  for (const ch of form) {
    if (ch === "W") points += 3;
    else if (ch === "D") points += 1;
  }
  return points;
}

type RankedItem = {
  teamId: number;
  value: number;
};

function rankByValue(
  items: RankedItem[],
  {
    direction,
  }: {
    direction: "desc" | "asc";
  },
): Map<number, { rank: number; tied: boolean; value: number }> {
  const sorted = [...items].sort((a, b) =>
    direction === "desc" ? b.value - a.value : a.value - b.value,
  );

  const rankMap = new Map<number, { rank: number; tied: boolean; value: number }>();

  let currentRank = 1;
  let i = 0;
  while (i < sorted.length) {
    const value = sorted[i].value;
    const group: RankedItem[] = [];
    while (i < sorted.length && sorted[i].value === value) {
      group.push(sorted[i]);
      i += 1;
    }
    const tied = group.length > 1;
    for (const item of group) {
      rankMap.set(item.teamId, { rank: currentRank, tied, value });
    }
    currentRank += group.length;
  }

  return rankMap;
}

function makeInsight({
  text,
  category,
  severity,
  priority,
}: Pick<Insight, "text" | "category" | "severity" | "priority">): Insight {
  return {
    text,
    emoji: "📊",
    category,
    severity,
    priority,
  };
}

function priorityForExtremeness(rank: number): number | null {
  if (rank === 1) return 90;
  if (rank === 2) return 85;
  if (rank === 3) return 80;
  return null;
}

function isRelegationDescription(description: string | null | undefined): boolean {
  if (!description) return false;
  return /relegation/i.test(description);
}

export function buildLeagueRelativeInsightsForTeam({
  teamId,
  teamName,
  leagueName,
  standingsRows,
  teamRole,
}: {
  teamId: number;
  teamName: string;
  leagueName: string;
  standingsRows: LeagueStandingsRow[];
  teamRole: "HOME" | "AWAY";
}): Insight[] {
  const row = standingsRows.find((r) => r.teamId === teamId);
  if (!row) return [];

  const insights: Insight[] = [];

  // --- Attack rank (GF)
  const gfRank = rankByValue(
    standingsRows.map((r) => ({ teamId: r.teamId, value: r.goalsFor })),
    { direction: "desc" },
  ).get(teamId);
  if (gfRank) {
    const pri = priorityForExtremeness(gfRank.rank);
    if (pri) {
      insights.push(
        makeInsight({
          text: `${teamName} are the team with ${mostRankPhrase(gfRank.rank)} goals in the league (${row.goalsFor})${rankSuffix(
            gfRank.tied,
          )}.`,
          category: "SCORING",
          severity: "MEDIUM",
          priority: pri,
        }),
      );
    }
  }

  // --- Conceded rank (GA, worst defense)
  const gaMostRank = rankByValue(
    standingsRows.map((r) => ({ teamId: r.teamId, value: r.goalsAgainst })),
    { direction: "desc" },
  ).get(teamId);
  if (gaMostRank) {
    const pri = priorityForExtremeness(gaMostRank.rank);
    if (pri) {
      insights.push(
        makeInsight({
          text: `${teamName} are the team with ${mostRankPhrase(gaMostRank.rank)} goals conceded in the league (${row.goalsAgainst})${rankSuffix(
            gaMostRank.tied,
          )}.`,
          category: "DEFENSIVE",
          severity: "MEDIUM",
          priority: pri,
        }),
      );
    }
  }

  // --- Best defense (fewest conceded)
  const gaFewestRank = rankByValue(
    standingsRows.map((r) => ({ teamId: r.teamId, value: r.goalsAgainst })),
    { direction: "asc" },
  ).get(teamId);
  if (gaFewestRank) {
    const pri = priorityForExtremeness(gaFewestRank.rank);
    if (pri) {
      insights.push(
        makeInsight({
          text: `${teamName} have ${bestRankPhrase(gaFewestRank.rank)} defense in the league (${row.goalsAgainst} conceded)${rankSuffix(
            gaFewestRank.tied,
          )}.`,
          category: "DEFENSIVE",
          severity: "MEDIUM",
          priority: pri,
        }),
      );
    }
  }

  // --- Goal difference
  const gdBestRank = rankByValue(
    standingsRows.map((r) => ({ teamId: r.teamId, value: r.goalDiff })),
    { direction: "desc" },
  ).get(teamId);
  if (gdBestRank) {
    const pri = priorityForExtremeness(gdBestRank.rank);
    if (pri) {
      insights.push(
        makeInsight({
          text: `${teamName} have ${bestRankPhrase(gdBestRank.rank)} goal difference in the league (${row.goalDiff})${rankSuffix(
            gdBestRank.tied,
          )}.`,
          category: "CONTEXT",
          severity: "LOW",
          priority: pri - 5,
        }),
      );
    }
  }
  const gdWorstRank = rankByValue(
    standingsRows.map((r) => ({ teamId: r.teamId, value: r.goalDiff })),
    { direction: "asc" },
  ).get(teamId);
  if (gdWorstRank) {
    const pri = priorityForExtremeness(gdWorstRank.rank);
    if (pri) {
      insights.push(
        makeInsight({
          text: `${teamName} have ${worstRankPhrase(gdWorstRank.rank)} goal difference in the league (${row.goalDiff})${rankSuffix(
            gdWorstRank.tied,
          )}.`,
          category: "WARNING",
          severity: "LOW",
          priority: pri - 5,
        }),
      );
    }
  }

  // --- Home/away points ranks
  const homePointsMap = rankByValue(
    standingsRows.map((r) => ({
      teamId: r.teamId,
      value: r.home.win * 3 + r.home.draw,
    })),
    { direction: "desc" },
  );
  const awayPointsMap = rankByValue(
    standingsRows.map((r) => ({
      teamId: r.teamId,
      value: r.away.win * 3 + r.away.draw,
    })),
    { direction: "desc" },
  );
  const homePts = row.home.win * 3 + row.home.draw;
  const awayPts = row.away.win * 3 + row.away.draw;
  const homePtsRank = homePointsMap.get(teamId);
  const awayPtsRank = awayPointsMap.get(teamId);

  if (homePtsRank) {
    const pri = priorityForExtremeness(homePtsRank.rank);
    if (pri && teamRole === "HOME") {
      insights.push(
        makeInsight({
          text: `${teamName} have ${bestRankPhrase(homePtsRank.rank)} home record in the league (${homePts} points)${rankSuffix(
            homePtsRank.tied,
          )}.`,
          category: "CONTEXT",
          severity: "LOW",
          priority: pri - 10,
        }),
      );
    }
  }
  if (awayPtsRank) {
    const pri = priorityForExtremeness(awayPtsRank.rank);
    if (pri && teamRole === "AWAY") {
      insights.push(
        makeInsight({
          text: `${teamName} have ${bestRankPhrase(awayPtsRank.rank)} away record in the league (${awayPts} points)${rankSuffix(
            awayPtsRank.tied,
          )}.`,
          category: "CONTEXT",
          severity: "LOW",
          priority: pri - 10,
        }),
      );
    }
  }

  // --- Winless home (strong narrative)
  if (teamRole === "HOME" && row.home.played >= 5 && row.home.win === 0) {
    insights.push(
      makeInsight({
        text: `${teamName} are winless at home this season (${row.home.played} matches).`,
        category: "WARNING",
        severity: "MEDIUM",
        priority: 88,
      }),
    );
  }

  // --- Recent form points rank (last 5) if form exists for all teams
  const formItems = standingsRows
    .filter((r) => typeof r.form === "string" && (r.form?.length ?? 0) >= 5)
    .map((r) => ({ teamId: r.teamId, value: pointsFromForm(r.form as string) }));
  if (formItems.length >= Math.max(10, Math.floor(standingsRows.length * 0.6)) && row.form) {
    const formRank = rankByValue(formItems, { direction: "desc" }).get(teamId);
    if (formRank) {
      const pri = priorityForExtremeness(formRank.rank);
      if (pri) {
        const pts = pointsFromForm(row.form);
        insights.push(
          makeInsight({
            text: `${teamName} have ${bestRankPhrase(formRank.rank)} recent form in the league (${pts} points from the last 5)${rankSuffix(
              formRank.tied,
            )}.`,
            category: "FORM",
            severity: "LOW",
            priority: pri - 15,
          }),
        );
      }
    }
  }

  // --- Relegation context (based on description signals)
  const relegationRows = standingsRows.filter((r) => isRelegationDescription(r.description));
  if (relegationRows.length > 0) {
    const boundaryRank = Math.min(...relegationRows.map((r) => r.rank));
    const boundary = standingsRows.find((r) => r.rank === boundaryRank);
    const inRelegation = isRelegationDescription(row.description);

    if (inRelegation) {
      insights.push(
        makeInsight({
          text: `${teamName} are currently in the relegation zone in ${leagueName}.`,
          category: "WARNING",
          severity: "MEDIUM",
          priority: 92,
        }),
      );
    } else if (boundary && row.rank < boundaryRank) {
      const diff = row.points - boundary.points;
      if (diff <= 5) {
        insights.push(
          makeInsight({
            text: `${teamName} are ${diff} point${diff === 1 ? "" : "s"} above the relegation zone in ${leagueName}.`,
            category: "CONTEXT",
            severity: "LOW",
            priority: diff <= 2 ? 86 : 78,
          }),
        );
      }
    }
  }

  // Sort by priority desc and keep unique texts
  const seen = new Set<string>();
  return insights
    .sort((a, b) => b.priority - a.priority)
    .filter((i) => {
      if (seen.has(i.text)) return false;
      seen.add(i.text);
      return true;
    });
}


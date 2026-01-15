import type { Insight, MatchContext, TeamContext } from "../types";

type EnrichmentContext = {
  team?: TeamContext;
  match?: MatchContext;
};

function appendOnce(text: string, addition: string): string {
  if (!addition) return text;
  if (text.includes(addition)) return text;
  return `${text} ${addition}`;
}

/**
 * Deterministically enrich insight text with short human/context explanations.
 * This is intentionally lightweight: one clause max per insight to avoid spam.
 */
export function enrichInsights(
  insights: Insight[],
  ctx: EnrichmentContext,
): Insight[] {
  return insights.map((insight) => {
    const team = ctx.team;
    const match = ctx.match;

    let extra = "";

    // Team DNA / timing
    if (
      !extra &&
      team?.dna?.isLateStarter &&
      (insight.category === "TIMING" ||
        insight.text.toLowerCase().includes("late") ||
        insight.text.toLowerCase().includes("first 15"))
    ) {
      extra =
        "This can be influenced by late-starter DNA, meaning key moments tend to come later.";
    }

    // Mood vs Mind conflicts
    if (!extra && team?.mood?.isSleepingGiant) {
      extra =
        "Mood vs Mind gap suggests current form may understate baseline quality and confidence.";
    }
    if (!extra && team?.mood?.isOverPerformer) {
      extra =
        "Over-performance signals can regress as fixtures normalize and variance evens out.";
    }

    // Match context
    if (!extra && match?.isDerby) {
      extra =
        "Derby context often increases emotional intensity and can disrupt normal patterns.";
    }
    if (!extra && match?.isNeutralVenue) {
      extra =
        "Neutral venue reduces familiar home conditions, which can soften typical home effects.";
    }
    if (!extra && match?.isPostInternationalBreak) {
      extra =
        "Post-international break effects can add uncertainty due to travel, rotation, and rhythm changes.";
    }
    if (!extra && match?.isEndOfSeason) {
      extra =
        "End-of-season dynamics can change motivation and risk-taking, making patterns less stable.";
    }

    if (!extra) return insight;

    return {
      ...insight,
      text: appendOnce(insight.text, extra),
    };
  });
}



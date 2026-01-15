import type { GoalLine, RelatedScenario, Simulation } from "../types";
import { DEFAULT_GOAL_LINES } from "../types";
import { buildMostProbableOutcome } from "../presentation/simulation-presenter";

type OverUnderSide = "OVER" | "UNDER";

function getPrimarySide(sim: Simulation): OverUnderSide | null {
  if (sim.scenarioType !== "TotalGoalsOverUnder") return null;
  const over = sim.probabilityDistribution.over;
  const under = sim.probabilityDistribution.under;
  if (typeof over !== "number" || typeof under !== "number") return null;
  return over >= under ? "OVER" : "UNDER";
}

function buildTotalGoalsOutcome(line: GoalLine, side: OverUnderSide): string {
  return buildMostProbableOutcome({
    scenarioType: "TotalGoalsOverUnder",
    probabilityDistribution: side === "OVER" ? { over: 100 } : { under: 100 },
    line,
  });
}

/**
 * Attach minimal related scenarios for TotalGoalsOverUnder simulations.
 *
 * - If primary is OVER(line), show OVER(previousLine) when available
 * - If primary is UNDER(line), show UNDER(nextLine) when available
 */
export function attachRelatedScenarios(
  simulations: Simulation[],
  opts?: {
    minProbabilityGain?: number; // percentage points
  },
): Simulation[] {
  const minProbabilityGain = opts?.minProbabilityGain ?? 3;

  const byLine = new Map<GoalLine, Simulation>();
  for (const s of simulations) {
    if (s.scenarioType === "TotalGoalsOverUnder" && s.line !== undefined) {
      byLine.set(s.line, s);
    }
  }

  return simulations.map((s) => {
    if (s.scenarioType !== "TotalGoalsOverUnder" || s.line === undefined) return s;

    const primarySide = getPrimarySide(s);
    if (!primarySide) return s;

    const idx = DEFAULT_GOAL_LINES.indexOf(s.line);
    if (idx === -1) return s;

    let saferLine: GoalLine | null = null;
    let saferSide: OverUnderSide | null = null;

    if (primarySide === "OVER") {
      const prev = DEFAULT_GOAL_LINES[idx - 1];
      if (prev !== undefined) {
        saferLine = prev;
        saferSide = "OVER";
      }
    } else {
      const next = DEFAULT_GOAL_LINES[idx + 1];
      if (next !== undefined) {
        saferLine = next;
        saferSide = "UNDER";
      }
    }

    if (!saferLine || !saferSide) return s;

    const saferPred = byLine.get(saferLine);
    if (!saferPred) return s;

    const primaryProb =
      primarySide === "OVER"
        ? s.probabilityDistribution.over
        : s.probabilityDistribution.under;
    const saferProb =
      saferSide === "OVER"
        ? saferPred.probabilityDistribution.over
        : saferPred.probabilityDistribution.under;

    if (typeof primaryProb !== "number" || typeof saferProb !== "number") {
      return s;
    }

    const gain = saferProb - primaryProb;
    if (gain < minProbabilityGain) return s;

    const related: RelatedScenario = {
      scenarioType: "TotalGoalsOverUnder",
      line: saferLine,
      probability: saferProb,
      modelReliability: saferPred.modelReliability,
      rationale:
        primarySide === "OVER"
          ? `Nearby line: Over ${saferLine} has a higher modelled probability than Over ${s.line}`
          : `Nearby line: Under ${saferLine} has a higher modelled probability than Under ${s.line}`,
      mostProbableOutcome: buildTotalGoalsOutcome(saferLine, saferSide),
    };

    return {
      ...s,
      relatedScenarios: [related],
    };
  });
}



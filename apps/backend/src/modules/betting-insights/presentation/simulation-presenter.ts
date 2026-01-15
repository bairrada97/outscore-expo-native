import type {
  ConfidenceLevel,
  GoalLine,
  MatchType,
  ModelReliabilityBreakdown,
  ProbabilityDistribution,
  ScenarioType,
  SignalStrength,
  Simulation,
} from "../types";

export type SimulationBase = Omit<Simulation, "signalStrength" | "mostProbableOutcome"> & {
  signalStrength?: SignalStrength;
  mostProbableOutcome?: string;
};

function maxProbability(dist: ProbabilityDistribution): number {
  const values = Object.values(dist).filter(
    (v): v is number => typeof v === "number" && Number.isFinite(v),
  );
  return values.length ? Math.max(...values) : 0;
}

export function signalStrengthFromMaxProbability(maxProb: number): SignalStrength {
  if (maxProb >= 65) return "Strong";
  if (maxProb >= 55) return "Moderate";
  if (maxProb >= 45) return "Balanced";
  return "Weak";
}

export function buildMostProbableOutcome(params: {
  scenarioType: ScenarioType;
  probabilityDistribution: ProbabilityDistribution;
  line?: GoalLine;
}): string {
  const { scenarioType, probabilityDistribution: d, line } = params;

  // If the top outcome is only marginally ahead, avoid sounding overly decisive.
  const SLIGHT_LEAN_MARGIN_PCT = 5;
  function isSlightLean(options: number[]): boolean {
    const sorted = [...options].filter(Number.isFinite).sort((a, b) => b - a);
    if (sorted.length < 2) return false;
    return sorted[0] - sorted[1] <= SLIGHT_LEAN_MARGIN_PCT;
  }

  switch (scenarioType) {
    case "BothTeamsToScore": {
      const yes = d.yes ?? 0;
      const no = d.no ?? 0;
      const pick = yes >= no ? "Yes" : "No";
      const prefix = isSlightLean([yes, no]) ? "Slight lean: " : "";
      return `Both Teams To Score: ${prefix}${pick} (highest probability based on historical patterns)`;
    }
    case "TotalGoalsOverUnder": {
      const over = d.over ?? 0;
      const under = d.under ?? 0;
      const pick = over >= under ? "Over" : "Under";
      const lineText = typeof line === "number" ? String(line) : "—";
      const prefix = isSlightLean([over, under]) ? "Slight lean: " : "";
      return `Total Goals (line ${lineText}): ${prefix}${pick} (highest probability based on historical patterns)`;
    }
    case "MatchOutcome": {
      const home = d.home ?? 0;
      const draw = d.draw ?? 0;
      const away = d.away ?? 0;

      let pick: string = "Draw";
      if (home >= draw && home >= away) pick = "Home side";
      else if (away >= draw) pick = "Away side";

      const prefix = isSlightLean([home, draw, away]) ? "Slight lean: " : "";
      return `Match Outcome: ${prefix}${pick} (highest probability based on historical patterns)`;
    }
    case "FirstHalfActivity": {
      const yes = d.yes ?? 0;
      const no = d.no ?? 0;
      const pick = yes >= no ? "Yes" : "No";
      const prefix = isSlightLean([yes, no]) ? "Slight lean: " : "";
      return `First Half Activity: Goals in first half — ${prefix}${pick} (highest probability based on historical patterns)`;
    }
    default: {
      // Exhaustiveness fallback
      return "Most probable outcome (highest probability based on historical patterns)";
    }
  }
}

export function buildModelReliabilityBreakdown(params: {
  level: ConfidenceLevel;
  homeMatchCount: number;
  awayMatchCount: number;
  h2hMatchCount: number;
  h2hHasSufficientData: boolean;
  matchType: MatchType;
  isKnockout?: boolean;
  isDerby: boolean;
  isNeutralVenue: boolean;
  isPostInternationalBreak: boolean;
  isEndOfSeason: boolean;
  capsHit?: boolean;
  overcorrectionWarning?: string;
  totalAdjustment?: number;
}): ModelReliabilityBreakdown {
  const reasons: string[] = [];

  // Data coverage
  const minMind = Math.min(params.homeMatchCount, params.awayMatchCount);
  if (minMind < 15) {
    reasons.push(
      "Limited baseline match history for one or both teams (Mind layer).",
    );
  } else if (minMind < 30) {
    reasons.push("Moderate baseline sample size (Mind layer).");
  }

  if (!params.h2hHasSufficientData || params.h2hMatchCount < 3) {
    reasons.push("Limited head-to-head history between the teams.");
  }

  // Context volatility
  if (params.matchType === "CUP" && params.isKnockout) {
    reasons.push(
      "Knockout cup matches can be more tactical and less pattern-stable than league games.",
    );
  }
  if (params.isDerby) {
    reasons.push(
      "Derby context can be emotionally volatile and less pattern-stable.",
    );
  }
  if (params.isNeutralVenue) {
    reasons.push("Neutral venue can reduce typical home/away patterns.");
  }
  if (params.isPostInternationalBreak) {
    reasons.push(
      "Post-international-break effects add uncertainty (travel, rotation, rhythm).",
    );
  }
  if (params.isEndOfSeason) {
    reasons.push(
      "End-of-season motivation shifts can make historical patterns less stable.",
    );
  }
  if (params.matchType === "FRIENDLY") {
    reasons.push(
      "Friendly matches are often less reliable due to experimentation and rotation.",
    );
  }

  // Model stability signals
  if (params.capsHit) {
    reasons.push(
      "The model hit adjustment caps, indicating strong or conflicting inputs.",
    );
  }
  if (params.overcorrectionWarning) {
    reasons.push(
      "The model detected potential overcorrection from competing signals.",
    );
  }
  if (
    typeof params.totalAdjustment === "number" &&
    Math.abs(params.totalAdjustment) >= 15
  ) {
    reasons.push(
      "Large adjustment swing suggests higher uncertainty around the base signal.",
    );
  }

  // Keep it short for mobile
  const trimmedReasons = reasons.slice(0, 4);

  return {
    level: params.level,
    reasons: trimmedReasons,
    signals: {
      mindSample: {
        homeMatchCount: params.homeMatchCount,
        awayMatchCount: params.awayMatchCount,
      },
      h2h: {
        hasSufficientData: params.h2hHasSufficientData,
        matchCount: params.h2hMatchCount,
      },
      context: {
        matchType: params.matchType,
        isKnockout: params.isKnockout,
        isDerby: params.isDerby,
        isNeutralVenue: params.isNeutralVenue,
        isPostInternationalBreak: params.isPostInternationalBreak,
        isEndOfSeason: params.isEndOfSeason,
      },
      stability: {
        capsHit: params.capsHit,
        overcorrectionWarning: params.overcorrectionWarning,
        totalAdjustment: params.totalAdjustment,
      },
    },
  };
}

export function finalizeSimulation(base: SimulationBase): Simulation {
  const maxProb = maxProbability(base.probabilityDistribution);
  return {
    ...base,
    signalStrength:
      base.signalStrength ?? signalStrengthFromMaxProbability(maxProb),
    mostProbableOutcome:
      base.mostProbableOutcome ??
      buildMostProbableOutcome({
        scenarioType: base.scenarioType,
        probabilityDistribution: base.probabilityDistribution,
        line: base.line,
      }),
  };
}



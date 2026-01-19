import { useMemo, useState } from "react";
import { GoalAnalysisCardView } from "./goal-analysis-card-view";
import type { GoalAnalysisCardProps } from "./types";
import {
	getGoalLineLabel,
	normalizeLabel,
	titleCase,
} from "./utils";

export function GoalAnalysisCard({
	overUnderSimulations,
	bttsSimulation,
}: GoalAnalysisCardProps) {
	const [activeKey, setActiveKey] = useState<"over_under" | "btts">(
		"over_under",
	);

	const activeOverUnder = useMemo(() => {
		if (!overUnderSimulations.length) return undefined;
		const byLine = overUnderSimulations.find((s) => s.line === 2.5);
		if (byLine) return byLine;
		return [...overUnderSimulations].sort(
			(a, b) => (a.line ?? 0) - (b.line ?? 0),
		)[0];
	}, [overUnderSimulations]);

	const activeSimulation =
		activeKey === "btts" ? (bttsSimulation ?? undefined) : activeOverUnder;

	const probability = activeSimulation?.probabilityDistribution ?? {};
	const overValue = probability.over ?? 0;
	const underValue = probability.under ?? 0;
	const yesValue = probability.yes ?? 0;
	const noValue = probability.no ?? 0;
	const isOverUnder = activeKey === "over_under";

	const leftValue = isOverUnder ? overValue : yesValue;
	const rightValue = isOverUnder ? underValue : noValue;
	const total = leftValue + rightValue || 1;
	const maxSide = Math.max(leftValue, rightValue);

	const strengthLabel = titleCase(
		normalizeLabel(activeSimulation?.signalStrength),
	);
	const reliabilityLabel = titleCase(
		normalizeLabel(activeSimulation?.modelReliability),
	);

	const headline = isOverUnder
		? getGoalLineLabel(activeOverUnder?.line, overValue >= underValue)
		: yesValue >= noValue
			? "Favors both teams to score"
			: "Favors a clean sheet";

	const leftLabel = isOverUnder
		? `Over ${activeOverUnder?.line ?? "—"}`
		: "Yes";
	const rightLabel = isOverUnder
		? `Under ${activeOverUnder?.line ?? "—"}`
		: "No";

	return (
		<GoalAnalysisCardView
			activeKey={activeKey}
			onSelectKey={setActiveKey}
			isOverUnder={isOverUnder}
			overUnderSimulationsCount={overUnderSimulations.length}
			headline={headline}
			strengthLabel={strengthLabel}
			reliabilityLabel={reliabilityLabel}
			leftLabel={leftLabel}
			rightLabel={rightLabel}
			leftValue={leftValue}
			rightValue={rightValue}
			total={total}
			maxSide={maxSide}
			insights={activeSimulation?.insights ?? []}
		/>
	);
}

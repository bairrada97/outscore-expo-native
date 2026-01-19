import type BottomSheet from "@gorhom/bottom-sheet";
import { useCallback, useMemo, useRef, useState } from "react";
import { GoalAnalysisCardView } from "./goal-analysis-card-view";
import { GoalLinesBottomSheet } from "./goal-lines-bottom-sheet";
import type { GoalAnalysisCardProps } from "./types";
import { getGoalLineLabel, normalizeLabel, titleCase } from "./utils";

export function GoalAnalysisCard({
	overUnderSimulations,
	bttsSimulation,
	homeGoalLineOverPct,
	awayGoalLineOverPct,
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

	const bottomSheetRef = useRef<BottomSheet>(null);
	const defaultSheetLine = useMemo(() => {
		const preferred = overUnderSimulations.find((s) => s.line === 2.5)?.line;
		if (typeof preferred === "number") return preferred;
		const first = [...overUnderSimulations].sort(
			(a, b) => (a.line ?? 0) - (b.line ?? 0),
		)[0]?.line;
		return typeof first === "number" ? first : 2.5;
	}, [overUnderSimulations]);
	const [sheetSelectedLine, setSheetSelectedLine] =
		useState<number>(defaultSheetLine);

	const handleOpenGoalLinesBreakdown = useCallback(() => {
		// Keep sheet selection independent from the main card,
		// but default to the currently shown line when opening.
		const line =
			typeof activeOverUnder?.line === "number"
				? activeOverUnder.line
				: defaultSheetLine;
		setSheetSelectedLine(line);
		// Open at first snap point (smaller), user can drag up to expand
		bottomSheetRef.current?.snapToIndex(0);
	}, [activeOverUnder?.line, defaultSheetLine]);

	return (
		<>
			<GoalAnalysisCardView
				activeKey={activeKey}
				onSelectKey={setActiveKey}
				isOverUnder={isOverUnder}
				overUnderSimulationsCount={overUnderSimulations.length}
				onPressGoalLinesBreakdown={handleOpenGoalLinesBreakdown}
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

			{overUnderSimulations.length > 1 ? (
				<GoalLinesBottomSheet
					sheetRef={bottomSheetRef}
					simulations={overUnderSimulations}
					selectedLine={sheetSelectedLine}
					onSelectLine={setSheetSelectedLine}
					homeGoalLineOverPct={homeGoalLineOverPct}
					awayGoalLineOverPct={awayGoalLineOverPct}
				/>
			) : null}
		</>
	);
}

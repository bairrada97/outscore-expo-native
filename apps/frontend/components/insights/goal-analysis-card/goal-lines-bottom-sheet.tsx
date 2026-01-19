import { isWeb } from "@/utils/platform";
import BottomSheet, {
	BottomSheetBackdrop,
	type BottomSheetBackgroundProps,
	type BottomSheetHandleProps,
	BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import { Portal } from "@rn-primitives/portal";
import type { RefObject } from "react";
import { useEffect, useMemo } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
	GoalLinesProbabilitySection,
	GoalLinesSeasonTrends,
	GoalLinesSheetHeader,
} from "./goal-lines-bottom-sheet-sections";
import { GoalLinesGraph } from "./goal-lines-graph";
import type { GoalSimulation } from "./types";
import { normalizeLabel, titleCase } from "./utils";

function SheetBackground({ style }: BottomSheetBackgroundProps) {
	return (
		<View
			style={style}
			className="bg-neu-01 dark:bg-neu-11 rounded-t-2xl overflow-hidden"
		/>
	);
}

type SheetHandleProps = BottomSheetHandleProps & { style?: ViewStyle };

function SheetHandle(props: BottomSheetHandleProps) {
	const { style } = props as SheetHandleProps;
	return (
		<View
			style={style}
			className="bg-neu-01 dark:bg-neu-11 rounded-t-2xl pt-12 pb-8 items-center"
		>
			<View className="h-4 w-48 rounded-full bg-neu-04 dark:bg-neu-09" />
		</View>
	);
}

function getLinePct(
	line: number,
	goalLineOverPct?: Record<string, number | undefined>,
) {
	const raw = goalLineOverPct?.[String(line)];
	return typeof raw === "number" ? raw : null;
}

export type GoalLinesBottomSheetProps = {
	sheetRef: RefObject<BottomSheet | null>;
	simulations: GoalSimulation[];
	selectedLine: number;
	onSelectLine: (line: number) => void;
	homeGoalLineOverPct?: Record<string, number | undefined>;
	awayGoalLineOverPct?: Record<string, number | undefined>;
};

export function GoalLinesBottomSheet({
	sheetRef,
	simulations,
	selectedLine,
	onSelectLine,
	homeGoalLineOverPct,
	awayGoalLineOverPct,
}: GoalLinesBottomSheetProps) {
	const snapPoints = useMemo(
		() => (isWeb ? ["50%", "90%"] : ["40%", "90%"]),
		[],
	);
	const insets = useSafeAreaInsets();

	useEffect(() => {
		// Force closed on mount (web + native).
		requestAnimationFrame(() => sheetRef.current?.close());
	}, [sheetRef]);

	const selectedSimulation = useMemo(() => {
		return (
			simulations.find(
				(s) =>
					s.scenarioType === "TotalGoalsOverUnder" && s.line === selectedLine,
			) ??
			simulations
				.filter((s) => s.scenarioType === "TotalGoalsOverUnder")
				.sort((a, b) => (a.line ?? 0) - (b.line ?? 0))[0]
		);
	}, [simulations, selectedLine]);

	const over = selectedSimulation?.probabilityDistribution?.over ?? 0;
	const under = selectedSimulation?.probabilityDistribution?.under ?? 0;
	const isOver = over >= under;
	const primaryValue = isOver ? over : under;
	const strengthLabel = titleCase(
		normalizeLabel(selectedSimulation?.signalStrength),
	);
	const reliabilityLabel = titleCase(
		normalizeLabel(selectedSimulation?.modelReliability),
	);

	const homePct = getLinePct(selectedLine, homeGoalLineOverPct);
	const awayPct = getLinePct(selectedLine, awayGoalLineOverPct);
	const bothAvg =
		typeof homePct === "number" && typeof awayPct === "number"
			? (homePct + awayPct) / 2
			: null;

	return (
		<Portal name="goal-lines-bottom-sheet">
			<View style={StyleSheet.absoluteFill} pointerEvents="box-none">
				<BottomSheet
					ref={sheetRef}
					index={-1}
					snapPoints={snapPoints}
					enableDynamicSizing={false}
					animateOnMount={false}
					enablePanDownToClose
					topInset={insets.top}
					backgroundComponent={SheetBackground}
					handleComponent={SheetHandle}
					backdropComponent={(props) => (
						<BottomSheetBackdrop
							{...props}
							appearsOnIndex={0}
							disappearsOnIndex={-1}
							opacity={0.4}
						/>
					)}
				>
					<BottomSheetScrollView
						contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
						showsVerticalScrollIndicator={false}
						className={isWeb ? "scrollbar-hide" : undefined}
					>
						<View className="px-16 gap-y-16">
							<GoalLinesSheetHeader
								selectedLine={selectedLine}
								isOver={isOver}
								primaryValue={primaryValue}
								strengthLabel={strengthLabel}
								reliabilityLabel={reliabilityLabel}
							/>

							{/* Graph */}
							<View className="gap-y-8">
								<GoalLinesGraph
									simulations={simulations}
									selectedLine={selectedLine}
									onSelectLine={onSelectLine}
								/>
							</View>

							{/* Season trends */}
							<GoalLinesSeasonTrends
								homePct={homePct}
								awayPct={awayPct}
								bothAvg={bothAvg}
							/>

							{/* Probability & insights */}
							<GoalLinesProbabilitySection
								simulations={simulations}
								onSelectLine={onSelectLine}
							/>
						</View>
					</BottomSheetScrollView>
				</BottomSheet>
			</View>
		</Portal>
	);
}

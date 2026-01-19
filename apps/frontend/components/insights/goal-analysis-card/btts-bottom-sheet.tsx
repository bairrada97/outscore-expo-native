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
	type BttsOutcome,
	BttsProbabilityInsights,
	BttsSeasonTrends,
	BttsSheetHeader,
} from "./btts-bottom-sheet-sections";
import { BttsGraph } from "./btts-graph";
import type { GoalInsight } from "./types";
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
			className="bg-neu-01 dark:bg-neu-11 rounded-t-2xl pt-16 pb-8 items-center"
		>
			<View className="h-4 w-48 rounded-full bg-neu-04 dark:bg-neu-09" />
		</View>
	);
}

export type BttsBottomSheetProps = {
	sheetRef: RefObject<BottomSheet | null>;
	selectedOutcome: BttsOutcome;
	onSelectOutcome: (value: BttsOutcome) => void;
	probabilityDistribution?: { yes?: number; no?: number };
	signalStrength?: string;
	modelReliability?: string;
	insights?: GoalInsight[];
	homeBttsYesPct?: number;
	awayBttsYesPct?: number;
};

export function BttsBottomSheet({
	sheetRef,
	selectedOutcome,
	onSelectOutcome,
	probabilityDistribution,
	signalStrength,
	modelReliability,
	insights = [],
	homeBttsYesPct,
	awayBttsYesPct,
}: BttsBottomSheetProps) {
	const snapPoints = useMemo(
		() => (isWeb ? ["50%", "90%"] : ["40%", "90%"]),
		[],
	);
	const insets = useSafeAreaInsets();

	useEffect(() => {
		// Force closed on mount (web + native).
		requestAnimationFrame(() => sheetRef.current?.close());
	}, [sheetRef]);

	const yesPct = probabilityDistribution?.yes ?? 0;
	const noPct = probabilityDistribution?.no ?? 0;

	const strengthLabel = titleCase(normalizeLabel(signalStrength));
	const reliabilityLabel = titleCase(normalizeLabel(modelReliability));

	return (
		<Portal name="btts-bottom-sheet">
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
							<BttsSheetHeader
								selectedOutcome={selectedOutcome}
								yesPct={yesPct}
								noPct={noPct}
								strengthLabel={strengthLabel}
								reliabilityLabel={reliabilityLabel}
							/>

							<BttsGraph
								selectedOutcome={selectedOutcome}
								onSelectOutcome={onSelectOutcome}
								yesPct={yesPct}
								noPct={noPct}
							/>

							<BttsSeasonTrends
								selectedOutcome={selectedOutcome}
								homeYesPct={homeBttsYesPct}
								awayYesPct={awayBttsYesPct}
							/>

							<BttsProbabilityInsights
								selectedOutcome={selectedOutcome}
								onSelectOutcome={onSelectOutcome}
								yesPct={yesPct}
								noPct={noPct}
								insights={insights}
							/>
						</View>
					</BottomSheetScrollView>
				</BottomSheet>
			</View>
		</Portal>
	);
}

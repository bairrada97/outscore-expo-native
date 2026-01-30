import { FilterPillGroup } from "@/components/ui/filter-pill";
import { View } from "react-native";

type GoalAnalysisTabKey = "over_under" | "btts";

const GOAL_ANALYSIS_OPTIONS: { key: GoalAnalysisTabKey; label: string }[] = [
	{ key: "over_under", label: "Over/Under" },
	{ key: "btts", label: "BTTS" },
];

export function GoalAnalysisCardTabs({
	activeKey,
	onSelectKey,
}: {
	activeKey: GoalAnalysisTabKey;
	onSelectKey: (key: GoalAnalysisTabKey) => void;
}) {
	return (
		<View className="py-8">
			<FilterPillGroup
				options={GOAL_ANALYSIS_OPTIONS}
				activeKey={activeKey}
				onSelect={onSelectKey}
			/>
		</View>
	);
}

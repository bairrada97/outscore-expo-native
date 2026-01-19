import { Text } from "@/components/ui/text";
import { Pressable, View } from "react-native";
import type { BttsOutcome } from "./btts-bottom-sheet-sections";
import { formatPercent } from "./utils";

type BarProps = {
	label: string;
	value: number;
	isSelected: boolean;
	onPress: () => void;
};

function Bar({ label, value, isSelected, onPress }: BarProps) {
	return (
		<Pressable
			onPress={onPress}
			className={`flex-1 rounded-lg border overflow-hidden ${
				isSelected
					? "border-m-01/40 bg-neu-01 dark:bg-neu-11"
					: "border-neu-04/60 dark:border-neu-10/60 bg-neu-02 dark:bg-neu-12"
			}`}
		>
			<View className="p-16 gap-y-8">
				<Text
					variant="caption-03"
					className="uppercase text-neu-07 dark:text-neu-06"
				>
					{label}
				</Text>
				<Text
					variant="highlight-03"
					className={
						isSelected
							? "text-m-01 dark:text-m-01-light-04"
							: "text-neu-10 dark:text-neu-01"
					}
				>
					{formatPercent(value)}
				</Text>
			</View>

			<View className="px-16 pb-16">
				<View className="h-8 bg-neu-03 dark:bg-neu-12 rounded-full overflow-hidden">
					<View
						style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
						className={
							isSelected
								? "h-8 bg-m-01 dark:bg-m-01-light-04"
								: "h-8 bg-neu-06 dark:bg-neu-09"
						}
					/>
				</View>
			</View>
		</Pressable>
	);
}

export function BttsGraph({
	selectedOutcome,
	onSelectOutcome,
	yesPct,
	noPct,
}: {
	selectedOutcome: BttsOutcome;
	onSelectOutcome: (value: BttsOutcome) => void;
	yesPct: number;
	noPct: number;
}) {
	return (
		<View className="gap-y-8">
			<Text
				variant="caption-01"
				className="uppercase text-neu-07 dark:text-neu-06"
			>
				BTTS probability
			</Text>

			<View className="flex-row gap-16">
				<Bar
					label="Yes"
					value={yesPct}
					isSelected={selectedOutcome === "yes"}
					onPress={() => onSelectOutcome("yes")}
				/>
				<Bar
					label="No"
					value={noPct}
					isSelected={selectedOutcome === "no"}
					onPress={() => onSelectOutcome("no")}
				/>
			</View>
		</View>
	);
}

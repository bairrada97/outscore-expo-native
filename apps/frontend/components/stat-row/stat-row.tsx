import { Text } from "@/components/ui/text";
import {
	calculateShare,
	formatStatNumber,
	getHigherSide,
} from "@/utils/fixture-statistics";
import { View } from "react-native";

export type StatRowProps = {
	label: string;
	homeValue: number | null;
	awayValue: number | null;
	/** Number of decimal places (default: 0) */
	precision?: number;
	/** Whether to show % suffix for values */
	isPercentage?: boolean;
};

export function StatRow({
	label,
	homeValue,
	awayValue,
	precision = 0,
	isPercentage = false,
}: StatRowProps) {
	const share = calculateShare(homeValue, awayValue);
	const higherSide = getHigherSide(homeValue, awayValue);

	const homeIsHigher = higherSide === "home";
	const awayIsHigher = higherSide === "away";

	const formatValue = (value: number | null) => {
		const formatted = formatStatNumber(value, precision);
		if (formatted === "—") return formatted;
		return isPercentage ? `${formatted}%` : formatted;
	};

	return (
		<View>
			<View className="flex-row items-center justify-between mb-8">
				<Text
					selectable
					variant={homeIsHigher ? "highlight-04" : "body-02"}
					className={
						homeIsHigher ? "text-m-02" : "text-neu-09 dark:text-neu-06"
					}
				>
					{formatValue(homeValue)}
				</Text>
				<Text
					selectable
					variant="body-02--semi"
					className="text-neu-10 dark:text-neu-01"
				>
					{label}
				</Text>
				<Text
					selectable
					variant={awayIsHigher ? "highlight-04" : "body-02"}
					className={
						awayIsHigher ? "text-m-02" : "text-neu-09 dark:text-neu-06"
					}
				>
					{formatValue(awayValue)}
				</Text>
			</View>

			<View className="h-8 w-full flex-row">
				{/* Home progress bar - rounded on left only */}
				<View
					className="h-full overflow-hidden rounded-l-full bg-neu-03 dark:bg-neu-11"
					style={{ width: `${share.home}%` }}
				>
					<View
						className={
							homeIsHigher
								? "h-full w-full bg-linear-to-l from-m-02-dark-01 to-m-02-light-02"
								: "h-full w-full bg-linear-to-l from-neu-06 to-neu-07 dark:from-neu-08 dark:to-neu-07"
						}
					/>
				</View>
				{/* Away progress bar - rounded on right only */}
				<View
					className="h-full overflow-hidden rounded-r-full bg-neu-03 dark:bg-neu-11"
					style={{ width: `${share.away}%` }}
				>
					<View
						className={
							awayIsHigher
								? "h-full w-full bg-linear-to-r from-m-02-dark-01 to-m-02-light-02"
								: "h-full w-full bg-linear-to-r from-neu-07 to-neu-06 dark:from-neu-07 dark:to-neu-08"
						}
					/>
				</View>
			</View>
		</View>
	);
}

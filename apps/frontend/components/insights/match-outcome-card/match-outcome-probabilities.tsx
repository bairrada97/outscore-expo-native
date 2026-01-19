import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { View } from "react-native";
import { formatPercent } from "./utils";

export function MatchOutcomeProbabilities({
	homeValue,
	drawValue,
	awayValue,
	total,
	maxSide,
}: {
	homeValue: number;
	drawValue: number;
	awayValue: number;
	total: number;
	maxSide: number;
}) {
	return (
		<View className="gap-y-8">
			<View className="flex-row items-stretch">
				<View className="flex-1 justify-between">
					<Text
						variant="caption-03"
						className="uppercase text-neu-07 dark:text-neu-06"
					>
						Home
					</Text>
					<View className="justify-end">
						<Text
							variant={homeValue === maxSide ? "highlight-01" : "body-02"}
							className={cn(
								homeValue === maxSide
									? "text-m-02"
									: "text-neu-07 dark:text-neu-06",
							)}
						>
							{formatPercent(homeValue)}
						</Text>
					</View>
				</View>
				<View className="flex-1 justify-between items-center">
					<Text
						variant="caption-03"
						className="uppercase text-neu-07 dark:text-neu-06"
					>
						Draw
					</Text>
					<View className="justify-end">
						<Text
							variant={drawValue === maxSide ? "highlight-03" : "body-02"}
							className={cn(
								drawValue === maxSide
									? "text-m-02"
									: "text-neu-07 dark:text-neu-06",
							)}
						>
							{formatPercent(drawValue)}
						</Text>
					</View>
				</View>
				<View className="flex-1 justify-between items-end">
					<Text
						variant="caption-03"
						className="uppercase text-neu-07 dark:text-neu-06"
					>
						Away
					</Text>
					<View className="justify-end items-end">
						<Text
							variant={awayValue === maxSide ? "highlight-03" : "body-02"}
							className={cn(
								awayValue === maxSide
									? "text-m-02"
									: "text-neu-07 dark:text-neu-06",
							)}
						>
							{formatPercent(awayValue)}
						</Text>
					</View>
				</View>
			</View>

			<View className="h-8 bg-neu-03 dark:bg-neu-12 rounded-full overflow-hidden flex-row">
				<View
					style={{ flexGrow: homeValue / total }}
					className={
						homeValue === maxSide
							? "bg-linear-to-l from-m-02-dark-01 to-m-02-light-02"
							: "bg-linear-to-l from-neu-05 to-neu-06 "
					}
				/>
				<View
					style={{ flexGrow: drawValue / total }}
					className={
						drawValue === maxSide
							? "bg-linear-to-r from-m-02-dark-01 to-m-02-light-02"
							: "bg-neu-04 dark:bg-neu-10"
					}
				/>
				<View
					style={{ flexGrow: awayValue / total }}
					className={
						awayValue === maxSide
							? "bg-linear-to-r from-m-02-dark-01 to-m-02-light-02"
							: "bg-linear-to-r from-neu-06 to-neu-05 "
					}
				/>
			</View>
		</View>
	);
}

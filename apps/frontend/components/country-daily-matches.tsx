import { cn } from "@/lib/utils";
import { View } from "react-native";
import { Text } from "./ui/text";

export interface CountryDailyMatchesProps {
	dailyMatchesLength: number;
	liveMatchesLength?: number;
}

/**
 * Badge showing match count, with live indicator when matches are live
 */
export function CountryDailyMatches({
	dailyMatchesLength,
	liveMatchesLength = 0,
}: CountryDailyMatchesProps) {
	const hasLiveMatches = liveMatchesLength > 0;

	return (
		<View
			className={cn(
				"flex min-w-24 flex-row items-center justify-center rounded-[32px] gap-x-4 px-8 h-24",
				hasLiveMatches ? "bg-m-01" : "border border-neu-04 dark:border-neu-10",
			)}
		>
			{hasLiveMatches ? (
				<>
					<Text variant="body-02--semi" className="text-neu-01">
						{liveMatchesLength}
					</Text>
					<Text variant="body-02" className=" text-neu-01/60">
						/
					</Text>
					<Text variant="body-02" className="text-neu-01">
						{dailyMatchesLength}
					</Text>
				</>
			) : (
				<Text className="text-12 font-medium text-neu-09 dark:text-neu-05">
					{dailyMatchesLength}
				</Text>
			)}
		</View>
	);
}

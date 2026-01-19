import { Icon } from "@/components/ui/icon";
import { Badge } from "@/components/ui/SvgIcons/badge";
import { Text } from "@/components/ui/text";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react-native";
import { View } from "react-native";

const tooltipText = "test";

export function MatchOutcomeBadges({
	strengthLabel,
	reliabilityLabel,
}: {
	strengthLabel: string;
	reliabilityLabel: string;
}) {
	return (
		<View className="flex-row items-center gap-8">
			<Tooltip>
				<TooltipTrigger asChild>
					<Badge className="bg-m-01-light-03/20 dark:bg-m-01-light-04/20 border-transparent px-8 py-4">
						<View className="flex-row items-center gap-4">
							<Icon
								as={Info}
								className="size-3 text-m-01 dark:text-m-01-light-04"
							/>
							<Text
								variant="caption-03"
								className="uppercase text-m-01 dark:text-m-01-light-04"
							>
								Strength: {strengthLabel}
							</Text>
						</View>
					</Badge>
				</TooltipTrigger>
				<TooltipContent>{tooltipText}</TooltipContent>
			</Tooltip>
			<Tooltip>
				<TooltipTrigger asChild>
					<Badge className="bg-m-01-light-03/20 dark:bg-m-01-light-04/20 border-transparent px-8 py-4">
						<View className="flex-row items-center gap-4">
							<Icon
								as={Info}
								className="size-3 text-m-01 dark:text-m-01-light-04"
							/>
							<Text
								variant="caption-03"
								className="uppercase text-m-01 dark:text-m-01-light-04"
							>
								Reliability: {reliabilityLabel}
							</Text>
						</View>
					</Badge>
				</TooltipTrigger>
				<TooltipContent>{tooltipText}</TooltipContent>
			</Tooltip>
		</View>
	);
}


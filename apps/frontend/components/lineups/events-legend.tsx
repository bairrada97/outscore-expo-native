import SvgB027 from "@/components/ui/SvgIcons/B027";
import SvgB030 from "@/components/ui/SvgIcons/B030";
import SvgB031 from "@/components/ui/SvgIcons/B031";
import SvgB033 from "@/components/ui/SvgIcons/B033";
import SvgB035 from "@/components/ui/SvgIcons/B035";
import SvgB042 from "@/components/ui/SvgIcons/B042";
import SvgB043 from "@/components/ui/SvgIcons/B043";
import SvgB044 from "@/components/ui/SvgIcons/B044";
import { Text } from "@/components/ui/text";
import type { ReactElement } from "react";
import { View } from "react-native";

const ICON_SIZE = 16;

type LegendItem = {
	type: string;
	icon: ReactElement;
};

const EVENTS_LEGEND: LegendItem[] = [
	{
		type: "Assist",
		icon: <SvgB033 width={ICON_SIZE} height={ICON_SIZE} className="text-m-01-light-02" />,
	},
	{
		type: "Yellow Card",
		icon: <SvgB031 width={ICON_SIZE} height={ICON_SIZE} className="text-yellow" />,
	},
	{
		type: "Goal",
		icon: <SvgB027 width={ICON_SIZE} height={ICON_SIZE} className="text-m-01-light-02" />,
	},
	{
		type: "Red Card",
		icon: <SvgB031 width={ICON_SIZE} height={ICON_SIZE} className="text-red" />,
	},
	{
		type: "Own Goal",
		icon: <SvgB027 width={ICON_SIZE} height={ICON_SIZE} className="text-red" />,
	},
	{
		type: "Penalty",
		icon: <SvgB042 width={ICON_SIZE} height={ICON_SIZE} className="text-m-01-light-02" />,
	},
	{
		type: "Missed Penalty",
		icon: <SvgB042 width={ICON_SIZE} height={ICON_SIZE} className="text-red" />,
	},
	{
		type: "Injured",
		icon: <SvgB030 width={ICON_SIZE} height={ICON_SIZE} />,
	},
	{
		type: "Sub In",
		icon: <SvgB043 width={ICON_SIZE} height={ICON_SIZE} className="text-m-01-light-02" />,
	},
	{
		type: "Questionable",
		icon: <SvgB035 width={ICON_SIZE} height={ICON_SIZE} className="text-neu-07" />,
	},
	{
		type: "Sub Out",
		icon: <SvgB044 width={ICON_SIZE} height={ICON_SIZE} className="text-red" />,
	},
];

export function EventsLegend() {
	return (
		<View className="mt-24 flex-row flex-wrap gap-x-24 gap-y-8 px-16">
			{EVENTS_LEGEND.map((event) => (
				<View
					key={event.type}
					className="w-[calc(50%-12px)] flex-row items-center gap-8"
				>
					{event.icon}
					<Text variant="body-02" className="text-neu-09 dark:text-neu-07">
						{event.type}
					</Text>
				</View>
			))}
		</View>
	);
}

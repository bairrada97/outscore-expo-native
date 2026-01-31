import type { Fixture } from "@outscore/shared-types";
import { format } from "date-fns";
import type { LucideIcon } from "lucide-react-native";
import type { ComponentType } from "react";
import { View } from "react-native";
import type { SvgProps } from "react-native-svg";
import { Icon } from "@/components/ui/icon";
import { B016, Calendar, Referee, Stadium } from "@/components/ui/SvgIcons";
import { Text } from "@/components/ui/text";

type FixtureOverviewDetailsProps = {
	fixture: Fixture;
};

type DetailItem =
	| {
			id: string;
			label: string;
			value: string;
			iconType: "lucide";
			icon: LucideIcon;
	  }
	| {
			id: string;
			label: string;
			value: string;
			iconType: "svg";
			icon: ComponentType<SvgProps>;
	  };

type DetailItemRowProps = {
	items: DetailItem[];
};

function DetailItemRow({ items }: DetailItemRowProps) {
	return (
		<View className="flex-row gap-16">
			{items.map((item) => {
				const SvgIcon = item.iconType === "svg" ? item.icon : null;

				return (
					<View key={item.id} className="flex-1 items-center gap-8">
						<View className="h-32 w-32 items-center justify-center rounded-lg bg-neu-02 dark:bg-neu-10">
							{item.iconType === "lucide" ? (
								<Icon className="size-24 text-neu-08 dark:text-neu-04" as={item.icon} />
							) : SvgIcon ? (
								<SvgIcon
									width={20}
									height={20}
									className="text-neu-08 dark:text-neu-04"
								/>
							) : null}
						</View>
						<View className="items-center">
							<Text
								variant="body-02--semi"
								className="text-neu-07 dark:text-neu-06"
							>
								{item.label}
							</Text>
							<Text
								variant="body-02"
								className="text-center text-neu-10 dark:text-neu-01"
								numberOfLines={2}
							>
								{item.value}
							</Text>
						</View>
					</View>
				);
			})}
		</View>
	);
}

function formatMatchDate(dateString?: string | null): string {
	if (!dateString) return "—";
	const date = new Date(dateString);
	if (Number.isNaN(date.getTime())) return "—";
	return format(date, "EEE, d MMM yyyy, HH:mm");
}

export function FixtureOverviewDetails({
	fixture,
}: FixtureOverviewDetailsProps) {
	const items: DetailItem[] = [
		{
			id: "match-date",
			label: "Match Date",
			value: formatMatchDate(fixture.fixture.date),
			iconType: "svg",
			icon: Calendar,
		},
		{
			id: "competition",
			label: "Competition",
			value: fixture.league.name || "—",
			iconType: "svg",
			icon: B016,
		},
		{
			id: "stadium",
			label: "Stadium",
			value: fixture.fixture.venue?.name || "—",
			iconType: "svg",
			icon: Stadium,
		},
		{
			id: "referee",
			label: "Referee",
			value: fixture.fixture.referee || "—",
			iconType: "svg",
			icon: Referee,
		},
	];

	return (
		<View className="rounded-lg bg-neu-01 px-16 py-16 shadow-sha-01 dark:bg-neu-11 dark:shadow-sha-06">
			<View className="mb-16">
				<DetailItemRow items={items.slice(0, 2)} />
			</View>
			<DetailItemRow items={items.slice(2, 4)} />
		</View>
	);
}

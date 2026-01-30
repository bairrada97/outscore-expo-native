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

type DetailItem = {
	id: string;
	label: string;
	value: string;
	iconType: "lucide" | "svg";
	icon: LucideIcon | ComponentType<SvgProps>;
};

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
			<View className="mb-16 flex-row gap-16">
				{items.slice(0, 2).map((item) => (
					<View key={item.id} className="flex-1 flex-row items-center gap-16">
						<View className="h-24 w-24 items-center justify-center rounded-lg bg-neu-02 dark:bg-neu-10">
							{item.iconType === "lucide" ? (
								<Icon
									as={item.icon as LucideIcon}
									className="size-24 text-neu-08 dark:text-neu-04"
								/>
							) : (
								(() => {
									const SvgIcon = item.icon as ComponentType<SvgProps>;
									return (
										<SvgIcon
											width={18}
											height={18}
											className="text-neu-08 dark:text-neu-04"
										/>
									);
								})()
							)}
						</View>
						<View className="flex-1">
							<Text
								variant="body-02--semi"
								className="text-neu-07 dark:text-neu-06"
							>
								{item.label}
							</Text>
							<Text
								variant="body-02"
								className="text-neu-10 dark:text-neu-01"
								numberOfLines={2}
							>
								{item.value}
							</Text>
						</View>
					</View>
				))}
			</View>
			<View className="flex-row gap-16">
				{items.slice(2, 4).map((item) => (
					<View key={item.id} className="flex-1 flex-row items-center gap-16">
						<View className="h-24 w-24 items-center justify-center rounded-lg bg-neu-02 dark:bg-neu-10">
							{item.iconType === "lucide" ? (
								<Icon
									as={item.icon as LucideIcon}
									className="size-24 text-neu-08 dark:text-neu-04"
								/>
							) : (
								(() => {
									const SvgIcon = item.icon as ComponentType<SvgProps>;
									return (
										<SvgIcon
											width={18}
											height={18}
											className="text-neu-08 dark:text-neu-04"
										/>
									);
								})()
							)}
						</View>
						<View className="flex-1">
							<Text
								variant="body-02--semi"
								className="uppercase text-neu-07 dark:text-neu-06"
							>
								{item.label}
							</Text>
							<Text
								variant="body-02"
								className="text-neu-10 dark:text-neu-01"
								numberOfLines={2}
							>
								{item.value}
							</Text>
						</View>
					</View>
				))}
			</View>
		</View>
	);
}

import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { Pressable, View } from "react-native";

export type FilterPillProps = {
	label: string;
	isActive: boolean;
	onPress: () => void;
};

export function FilterPill({ label, isActive, onPress }: FilterPillProps) {
	return (
		<Pressable
			onPress={onPress}
			className={cn(
				"h-32 items-center justify-center rounded-full px-24",
				isActive
					? "bg-linear-to-r from-m-02 to-m-01-light-01 shadow-sha-03"
					: "bg-neu-01 shadow-sha-01 dark:bg-neu-09 dark:shadow-sha-06",
			)}
		>
			<Text
				variant="title-02"
				className={cn(
					"uppercase",
					isActive ? "text-neu-01" : "text-neu-09 dark:text-neu-04",
				)}
			>
				{label}
			</Text>
		</Pressable>
	);
}

export type FilterPillGroupProps<T extends string> = {
	options: { key: T; label: string }[];
	activeKey: T;
	onSelect: (key: T) => void;
};

export function FilterPillGroup<T extends string>({
	options,
	activeKey,
	onSelect,
}: FilterPillGroupProps<T>) {
	return (
		<View className="flex-row gap-8">
			{options.map((option) => (
				<View key={option.key} className="flex-1">
					<FilterPill
						label={option.label}
						isActive={activeKey === option.key}
						onPress={() => onSelect(option.key)}
					/>
				</View>
			))}
		</View>
	);
}

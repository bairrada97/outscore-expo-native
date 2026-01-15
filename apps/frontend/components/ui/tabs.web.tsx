import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";

export type TabsItem = {
	key: string;
	title: string;
	render: () => ReactNode;
};

export interface TabsProps {
	tabs: TabsItem[];
	defaultKey?: string;
	activeKey?: string;
	onChangeKey?: (key: string) => void;
	swipeEnabled?: boolean; // ignored on web
	tabWidthClassName?: string;
	containerClassName?: string;
}

export function Tabs({
	tabs,
	defaultKey,
	activeKey,
	onChangeKey,
	tabWidthClassName = "w-[120px]",
	containerClassName,
}: TabsProps) {
	const firstKey = tabs[0]?.key;
	const fallbackKey = defaultKey ?? firstKey;
	const [internalKey, setInternalKey] = useState<string | undefined>(fallbackKey);

	const selectedKey = activeKey ?? internalKey ?? fallbackKey;
	const selectedIndex = useMemo(() => {
		const idx = tabs.findIndex((t) => t.key === selectedKey);
		return idx >= 0 ? idx : 0;
	}, [selectedKey, tabs]);

	function setKey(nextKey: string) {
		if (!activeKey) setInternalKey(nextKey);
		onChangeKey?.(nextKey);
	}

	return (
		<View className={cn("w-full", containerClassName)}>
			{/* Tab bar */}
			<View className="h-40 shadow-sha-01 bg-neu-01 dark:bg-neu-11">
				<ScrollView horizontal showsHorizontalScrollIndicator={false}>
					<View className="flex-row h-40">
						{tabs.map((tab) => {
							const isActive = tab.key === selectedKey;
							return (
								<View key={tab.key} className={cn("h-40", tabWidthClassName)}>
									<Pressable
										onPress={() => setKey(tab.key)}
										className={cn(
											"px-3 py-1.5 text-sm h-full w-full items-center justify-center whitespace-nowrap uppercase",
											isActive ? "text-neu-01" : "text-neu-09",
										)}
									>
										<Text
											variant="body-02--semi"
											className={cn(
												"uppercase",
												isActive
													? "text-m-01 dark:text-m-01-light-04"
													: "text-neu-09",
											)}
										>
											{tab.title}
										</Text>
										{isActive && (
											<View className="absolute bottom-0 left-0 right-0 h-1 bg-linear-to-r from-m-02 to-m-01-light-01" />
										)}
									</Pressable>
								</View>
							);
						})}
					</View>
				</ScrollView>
			</View>

			{/* Panels */}
			<View>{tabs[selectedIndex]?.render?.()}</View>
		</View>
	);
}



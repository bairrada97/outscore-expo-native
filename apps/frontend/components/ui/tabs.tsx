import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { isWeb } from "@/utils/platform";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { type SceneRendererProps, TabView } from "react-native-tab-view";
import type { TabsProps } from "./tabs.types";
import { clamp, MIN_TAB_WIDTH_PX } from "./tabs.types";

export type { TabsItem, TabsProps } from "./tabs.types";

export function Tabs({
	tabs,
	defaultKey,
	activeKey,
	onChangeKey,
	swipeEnabled = true,
	minTabWidthPx = MIN_TAB_WIDTH_PX,
	containerClassName,
}: TabsProps) {
	const firstKey = tabs[0]?.key;
	const fallbackKey = defaultKey ?? firstKey;
	const [internalKey, setInternalKey] = useState<string | undefined>(
		fallbackKey,
	);
	const [tabBarWidth, setTabBarWidth] = useState(0);

	const selectedKey = activeKey ?? internalKey ?? fallbackKey;
	const selectedIndex = useMemo(() => {
		const idx = tabs.findIndex((t) => t.key === selectedKey);
		return idx >= 0 ? idx : 0;
	}, [selectedKey, tabs]);

	const shouldFit =
		tabBarWidth > 0 && tabBarWidth / Math.max(tabs.length, 1) >= minTabWidthPx;

	const scrollRef = useRef<ScrollView>(null);

	const scrollToActiveTab = useCallback(
		(index: number) => {
			if (!scrollRef.current) return;
			if (tabBarWidth <= 0) return;
			if (shouldFit) return;

			const itemWidth = minTabWidthPx;
			const totalWidth = itemWidth * tabs.length;
			const desiredCenter = index * itemWidth + itemWidth / 2;
			const targetX = clamp(
				desiredCenter - tabBarWidth / 2,
				0,
				Math.max(0, totalWidth - tabBarWidth),
			);
			scrollRef.current.scrollTo({ x: targetX, animated: true });
		},
		[minTabWidthPx, shouldFit, tabBarWidth, tabs.length],
	);

	const routes = useMemo(
		() => tabs.map((t) => ({ key: t.key, title: t.title })),
		[tabs],
	);
	const [index, setIndex] = useState(selectedIndex);

	// Keep TabView + header in sync when selection is controlled externally
	useEffect(() => {
		setIndex(selectedIndex);
		scrollToActiveTab(selectedIndex);
	}, [scrollToActiveTab, selectedIndex]);

	const setKey = useCallback(
		(nextKey: string) => {
			if (!activeKey) setInternalKey(nextKey);
			onChangeKey?.(nextKey);
			const nextIndex = tabs.findIndex((t) => t.key === nextKey);
			if (nextIndex >= 0) {
				setIndex(nextIndex);
				scrollToActiveTab(nextIndex);
			}
		},
		[activeKey, onChangeKey, scrollToActiveTab, tabs],
	);

	const renderScene = useCallback(
		({ route }: SceneRendererProps & { route: { key: string } }) => {
			const tab = tabs.find((t) => t.key === route.key);
			return (
				<ScrollView
					className="flex-1"
					contentContainerStyle={{ flexGrow: 1 }}
					nestedScrollEnabled
					directionalLockEnabled
					showsVerticalScrollIndicator={false}
				>
					{tab?.render()}
				</ScrollView>
			);
		},
		[tabs],
	);

	return (
		<View className={cn("w-full", containerClassName, isWeb ? "" : "flex-1")}>
			{/* Tab bar */}
			<View
				className="h-40 shadow-sha-01 bg-neu-01 dark:bg-neu-11"
				onLayout={(e) => setTabBarWidth(e.nativeEvent.layout.width)}
			>
				{shouldFit ? (
					// Fit mode: equal widths, fill container (no scroll)
					<View className="flex-row h-40 w-full">
						{tabs.map((tab) => {
							const isActive = tab.key === selectedKey;
							return (
								<View key={tab.key} className="h-40 flex-1">
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
											<View className="absolute bottom-0 left-8 right-8 h-1 bg-linear-to-r from-m-02 to-m-01-light-01 rounded-[26px_42px_0_0]" />
										)}
									</Pressable>
								</View>
							);
						})}
					</View>
				) : (
					// Overflow mode: lock to min width and enable horizontal scroll
					<ScrollView
						ref={scrollRef}
						horizontal
						showsHorizontalScrollIndicator={false}
					>
						<View className="flex-row h-40">
							{tabs.map((tab) => {
								const isActive = tab.key === selectedKey;
								return (
									<View
										key={tab.key}
										className="h-40"
										style={{ width: minTabWidthPx }}
									>
										<Pressable
											onPress={() => setKey(tab.key)}
											className={cn(
												"px-3 py-1.5 text-sm h-full w-full items-center justify-center whitespace-nowrap uppercase",
												isActive ? "text-neu-01" : "text-neu-09",
											)}
										>
											<Text
												variant="title-02"
												className={cn(
													"uppercase",
													isActive
														? "text-m-01 dark:text-m-01-light-04"
														: "text-neu-09 dark:text-neu-04",
												)}
											>
												{tab.title}
											</Text>
											{isActive && (
												<View className="absolute bottom-0 left-8 right-8 h-1 bg-linear-to-r from-m-02 to-m-01-light-01 rounded-[26px_42px_0_0]" />
											)}
										</Pressable>
									</View>
								);
							})}
						</View>
					</ScrollView>
				)}
			</View>

			{/* Panels */}
			{isWeb ? (
				<View>{tabs[selectedIndex]?.render?.()}</View>
			) : (
				<View className="flex-1">
					<TabView
						navigationState={{ index, routes }}
						renderScene={renderScene}
						onIndexChange={(newIndex) => {
							setIndex(newIndex);
							const nextKey = tabs[newIndex]?.key;
							if (nextKey) {
								if (!activeKey) setInternalKey(nextKey);
								onChangeKey?.(nextKey);
							}
						}}
						renderTabBar={() => null}
						swipeEnabled={swipeEnabled}
						style={{ flex: 1 }}
					/>
				</View>
			)}
		</View>
	);
}

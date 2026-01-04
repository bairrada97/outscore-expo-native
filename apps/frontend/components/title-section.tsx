import type { ReactNode } from "react";
import { View } from "react-native";
import { Text } from "./ui/text";

export interface TitleSectionProps {
	children: ReactNode;
	icon?: ReactNode;
}

/**
 * Section title with a gradient accent bar.
 * Uses a View instead of pseudo-element for native compatibility.
 */
export function TitleSection({ children, icon }: TitleSectionProps) {
	return (
		<View className="flex h-40 flex-row items-center justify-between px-0">
			<View className="flex flex-row items-center gap-2">
				{/* Gradient accent bar (replaces pseudo-element for native compat) */}
				<View className="h-4 w-16 rounded-r-lg bg-linear-to-r from-m-02-dark-01 to-m-02-light-02" />

				<Text
					variant="title-02"
					className="text-m-01 dark:text-m-01-light-04"
				>
					{children}
				</Text>
			</View>

			{icon && <View className="mr-4">{icon}</View>}
		</View>
	);
}


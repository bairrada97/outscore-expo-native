import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { Image } from "expo-image";
import type { ReactNode } from "react";
import { View } from "react-native";

export type CardGenericProps = {
	/** Image URL to display in the circular avatar */
	imageUrl?: string;
	/** Primary text/name to display */
	title: string;
	/** Secondary text (e.g., country name) */
	subtitle?: string;
	/** Optional trailing content (e.g., icons, buttons) */
	trailing?: ReactNode;
	/** Whether to show a bottom border separator */
	showBorder?: boolean;
	/** Whether the card is in an active/expanded state */
	isActive?: boolean;
};

export function CardGeneric({
	imageUrl,
	title,
	subtitle,
	trailing,
	showBorder = false,
	isActive = false,
}: CardGenericProps) {
	return (
		<View
			className={cn(
				"relative h-40 flex-1 flex-row items-center gap-16",
				showBorder && "border-b border-neu-03 dark:border-neu-11",
			)}
		>
			{/* Avatar */}
			{imageUrl && (
				<View
					className="h-32 w-32 items-center justify-center rounded-full border-2 border-neu-01 bg-neu-01 shadow-sha-01 dark:border-neu-08 dark:shadow-sha-06"
				>
					<View className="h-full w-full overflow-hidden rounded-full">
						<Image
							source={{ uri: imageUrl }}
							style={{ width: "100%", height: "100%" }}
							contentFit="cover"
							transition={200}
						/>
						{/* Subtle overlay for depth */}
						<View className="absolute inset-0 rounded-full bg-neu-10 opacity-[0.08]" />
					</View>
				</View>
			)}

			{/* Text content */}
			<View className="flex-1 gap-4">
				<Text
					variant="body-01--semi"
					className={
						isActive
							? "text-neu-01"
							: "text-neu-10 dark:text-neu-06"
					}
					numberOfLines={1}
				>
					{title}
				</Text>
				{subtitle && (
					<Text
						variant="caption-02"
						className={
							isActive
								? "text-neu-01/60"
								: "text-neu-10/60 dark:text-neu-06/60"
						}
						numberOfLines={1}
					>
						{subtitle}
					</Text>
				)}
			</View>

			{/* Trailing content (icons, etc.) */}
			{trailing}
		</View>
	);
}

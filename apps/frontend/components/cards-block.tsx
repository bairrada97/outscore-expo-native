import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { View } from "react-native";
import { TitleBlock } from "./ui/title-block";

export interface CardsBlockProps {
	title: string;
	extraInfo?: ReactNode;
	className?: string;
	cardsClassName?: string;
	children: ReactNode;
}

/**
 * Container component for displaying a list of cards.
 * Provides a styled block with a title and optional extra info.
 */
export function CardsBlock({
	title,
	extraInfo,
	className,
	cardsClassName,
	children,
}: CardsBlockProps) {
	return (
		<View
			className={cn(
				"mb-8 flex rounded-lg bg-neu-01 shadow-sha-01 dark:bg-neu-11 dark:shadow-sha-06",
				className,
			)}
		>
			<TitleBlock extraInfo={extraInfo}>{title}</TitleBlock>
			<View className={cn("px-4 pb-4", cardsClassName)}>{children}</View>
		</View>
	);
}

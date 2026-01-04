import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { View } from "react-native";
import type { ClassNameValue } from "tailwind-merge";
import { Text } from "./text";

export interface TitleBlockProps {
	children: ReactNode;
	extraInfo?: ReactNode;
	className?: ClassNameValue;
}

export function TitleBlock({
	children,
	extraInfo,
	className,
}: TitleBlockProps) {
	return (
		<View
			className={cn(
				"relative box-border flex h-40 flex-row items-center gap-x-8 gap-y-0 rounded-tl-[8px] rounded-tr-[8px] border-x-4 border-t-4 border-white bg-neu-03 px-16 py-0",
				className,
			)}
		>
			<Text variant="body-01--semi" className="translate-x-[-4px] text-neu-10">
				{children}
			</Text>
			{extraInfo && (
				<View className="ml-auto translate-x-4 translate-y-1 uppercase">
					{extraInfo}
				</View>
			)}
		</View>
	);
}

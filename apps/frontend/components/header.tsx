import { cn } from "@/lib/utils";
import { isWeb } from "@/utils/platform";
import type { ReactNode } from "react";
import { View } from "react-native";

interface HeaderProps {
	children?: ReactNode;
	className?: string;
}

interface HeaderSlotProps {
	children?: ReactNode;
	className?: string;
}

function LeftSlot({ children, className }: HeaderSlotProps) {
	return (
		<View className={cn("flex-row items-center gap-3", className)}>
			{children}
		</View>
	);
}

function CenterSlot({ children, className }: HeaderSlotProps) {
	return (
		<View className={cn("flex-1 items-center justify-center", className)}>
			{children}
		</View>
	);
}

function RightSlot({ children, className }: HeaderSlotProps) {
	return (
		<View className={cn("flex-row items-center gap-4", className)}>
			{children}
		</View>
	);
}

function Header({ children, className }: HeaderProps) {
	return (
		<View
			className={cn(
				"z-50 h-12 w-full flex-row items-center justify-between bg-m-01 px-16",
				isWeb && "max-w-[800px] self-center",
				className,
			)}
		>
			{children}
		</View>
	);
}

Header.Left = LeftSlot;
Header.Center = CenterSlot;
Header.Right = RightSlot;

export { Header };

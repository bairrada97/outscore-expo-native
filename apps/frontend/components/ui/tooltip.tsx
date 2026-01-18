import { cn } from "@/lib/utils";
import * as TooltipPrimitive from "@rn-primitives/tooltip";
import * as React from "react";
import { Platform } from "react-native";
import { Text, TextClassContext } from "./text";

function Tooltip({
	children,
	...props
}: TooltipPrimitive.RootProps & React.RefAttributes<TooltipPrimitive.RootRef>) {
	return <TooltipPrimitive.Root {...props}>{children}</TooltipPrimitive.Root>;
}

function TooltipTrigger({
	children,
	...props
}: TooltipPrimitive.TriggerProps &
	React.RefAttributes<TooltipPrimitive.TriggerRef>) {
	return (
		<TooltipPrimitive.Trigger {...props}>{children}</TooltipPrimitive.Trigger>
	);
}

const TooltipContent = React.forwardRef<
	TooltipPrimitive.ContentRef,
	TooltipPrimitive.ContentProps
>(({ className, children, sideOffset = 6, ...props }, ref) => (
	<TooltipPrimitive.Portal>
		<TooltipPrimitive.Content
			ref={ref}
			sideOffset={sideOffset}
			className={cn(
				"z-50 rounded-md border border-neu-04 bg-neu-01 px-8 py-6 shadow-sha-01 dark:border-neu-10 dark:bg-neu-11",
				Platform.select({ web: "animate-in fade-in-0 zoom-in-95" }),
				className,
			)}
			{...props}
		>
			<TextClassContext.Provider value="text-xs">
				<Text className="text-neu-10 dark:text-neu-01">{children}</Text>
			</TextClassContext.Provider>
		</TooltipPrimitive.Content>
	</TooltipPrimitive.Portal>
));
TooltipContent.displayName = "TooltipContent";

export { Tooltip, TooltipContent, TooltipTrigger };

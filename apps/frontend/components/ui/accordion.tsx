import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import * as AccordionPrimitive from "@rn-primitives/accordion";
import { ChevronDown } from "lucide-react-native";
import * as React from "react";
import { Platform, Pressable, View } from "react-native";
import Animated, {
	FadeOutUp,
	LayoutAnimationConfig,
	LinearTransition,
	useAnimatedStyle,
	useDerivedValue,
	withTiming,
} from "react-native-reanimated";
import { TextClassContext } from "./text";

function Accordion({
	children,
	...props
}: Omit<AccordionPrimitive.RootProps, "asChild"> &
	React.RefAttributes<AccordionPrimitive.RootRef>) {
	// Skip heavy layout animations on web for better performance
	if (Platform.OS === "web") {
		return (
			<AccordionPrimitive.Root {...(props as AccordionPrimitive.RootProps)}>
				{children}
			</AccordionPrimitive.Root>
		);
	}

	return (
		<LayoutAnimationConfig skipEntering>
			<AccordionPrimitive.Root
				{...(props as AccordionPrimitive.RootProps)}
				asChild
			>
				<Animated.View layout={LinearTransition.duration(200)}>
					{children}
				</Animated.View>
			</AccordionPrimitive.Root>
		</LayoutAnimationConfig>
	);
}

function AccordionItem({
	children,
	className,
	value,
	...props
}: AccordionPrimitive.ItemProps &
	React.RefAttributes<AccordionPrimitive.ItemRef>) {
	const itemClassName = cn(
		"border-border border-b",
		Platform.select({ web: "last:border-b-0" }),
		className,
	);

	// Skip Animated.View wrapper on web for better performance
	if (Platform.OS === "web") {
		return (
			<AccordionPrimitive.Item
				className={itemClassName}
				value={value}
				{...props}
			>
				{children}
			</AccordionPrimitive.Item>
		);
	}

	return (
		<AccordionPrimitive.Item
			className={itemClassName}
			value={value}
			asChild
			{...props}
		>
			<Animated.View
				className="overflow-hidden"
				layout={LinearTransition.duration(200)}
			>
				{children}
			</Animated.View>
		</AccordionPrimitive.Item>
	);
}

const Trigger = Platform.OS === "web" ? View : Pressable;

function AccordionTrigger({
	className,
	children,
	...props
}: AccordionPrimitive.TriggerProps & {
	children?: React.ReactNode;
} & React.RefAttributes<AccordionPrimitive.TriggerRef>) {
	const { isExpanded } = AccordionPrimitive.useItemContext();

	const progress = useDerivedValue(
		() =>
			isExpanded
				? withTiming(1, { duration: 250 })
				: withTiming(0, { duration: 200 }),
		[isExpanded],
	);
	const chevronStyle = useAnimatedStyle(
		() => ({
			transform: [{ rotate: `${progress.value * 180}deg` }],
		}),
		[progress],
	);

	return (
		<TextClassContext.Provider
			value={cn(
				"text-left text-sm font-medium",
				Platform.select({ web: "group-hover:underline" }),
			)}
		>
			<AccordionPrimitive.Header>
				<AccordionPrimitive.Trigger {...props} asChild={Platform.OS !== "web"}>
					<Trigger
						className={cn(
							"flex-row items-start justify-between gap-4 rounded-md py-4 disabled:opacity-50",
							Platform.select({
								web: "focus-visible:border-ring focus-visible:ring-ring/50 flex flex-1 outline-none transition-all hover:underline focus-visible:ring-[3px] disabled:pointer-events-none [&[data-state=open]>svg]:rotate-180",
							}),
							className,
						)}
					>
						<>{children}</>
						<Animated.View style={chevronStyle}>
							<Icon
								as={ChevronDown}
								size={16}
								className={cn(
									"text-muted-foreground shrink-0",
									Platform.select({
										web: "pointer-events-none translate-y-0.5 transition-transform duration-200",
									}),
								)}
							/>
						</Animated.View>
					</Trigger>
				</AccordionPrimitive.Trigger>
			</AccordionPrimitive.Header>
		</TextClassContext.Provider>
	);
}

function AccordionContent({
	className,
	children,
	...props
}: AccordionPrimitive.ContentProps &
	React.RefAttributes<AccordionPrimitive.ContentRef>) {
	const { isExpanded } = AccordionPrimitive.useItemContext();

	// Lazy render: only render children when expanded (or was expanded)
	// This dramatically reduces initial render cost for large lists
	const [hasBeenExpanded, setHasBeenExpanded] = React.useState(isExpanded);

	React.useEffect(() => {
		if (isExpanded && !hasBeenExpanded) {
			setHasBeenExpanded(true);
		}
	}, [isExpanded, hasBeenExpanded]);

	return (
		<TextClassContext.Provider value="text-sm">
			<AccordionPrimitive.Content
				className={cn(
					"overflow-hidden",
					Platform.select({
						web: isExpanded ? "animate-accordion-down" : "animate-accordion-up",
					}),
				)}
				{...props}
			>
				<Animated.View
					exiting={Platform.select({ native: FadeOutUp.duration(200) })}
					className={cn("pb-4", className)}
				>
					{/* Only render children if accordion has been opened at least once */}
					{hasBeenExpanded ? children : null}
				</Animated.View>
			</AccordionPrimitive.Content>
		</TextClassContext.Provider>
	);
}

export { Accordion, AccordionContent, AccordionItem, AccordionTrigger };

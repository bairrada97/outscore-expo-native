import { cn } from "@/lib/utils";
import * as AccordionPrimitive from "@rn-primitives/accordion";
import * as React from "react";
import { Platform, Pressable, View } from "react-native";
import Animated, {
	Easing,
	LayoutAnimationConfig,
	LinearTransition,
	useAnimatedStyle,
	useDerivedValue,
	withTiming,
} from "react-native-reanimated";
import SvgB007 from "./SvgIcons/B007";
import { TextClassContext } from "./text";

// Smooth easing curve for accordion animations
const smoothTransition = LinearTransition.duration(300).easing(
	Easing.bezier(0.25, 0.1, 0.25, 1), // ease-out curve
);

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
				<Animated.View layout={smoothTransition}>{children}</Animated.View>
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
			<Animated.View className="overflow-hidden" layout={smoothTransition}>
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
				? withTiming(1, {
						duration: 300,
						easing: Easing.bezier(0.25, 0.1, 0.25, 1),
					})
				: withTiming(0, {
						duration: 250,
						easing: Easing.bezier(0.25, 0.1, 0.25, 1),
					}),
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
				"text-left text-sm font-sans-regular",
				Platform.select({ web: "group-hover:underline" }),
			)}
		>
			<AccordionPrimitive.Header>
				<AccordionPrimitive.Trigger {...props} asChild={Platform.OS !== "web"}>
					<Trigger
						className={cn(
							"flex-row items-start justify-between gap-4 py-4 disabled:opacity-50",
							Platform.select({
								web: "focus-visible:border-ring focus-visible:ring-ring/50 flex flex-1 outline-none transition-all hover:underline focus-visible:ring-[3px] disabled:pointer-events-none [&[data-state=expanded]>svg]:rotate-180",
							}),
							className,
						)}
					>
						<>{children}</>
						<Animated.View
							style={chevronStyle}
							className={cn(
								"items-center justify-center",
								Platform.select({
									web: "origin-center",
								}),
							)}
						>
							<SvgB007
								width={24}
								height={24}
								className={cn(
									"text-neu-07 shrink-0 in-data-[state=expanded]:text-neu-01",
									Platform.select({
										web: "pointer-events-none",
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

	// Track if content has been expanded at least once (for lazy rendering)
	const [hasBeenExpanded, setHasBeenExpanded] = React.useState(isExpanded);

	React.useEffect(() => {
		if (isExpanded && !hasBeenExpanded) {
			setHasBeenExpanded(true);
		}
	}, [isExpanded, hasBeenExpanded]);

	// Animated opacity for smooth fade in/out
	const opacity = useDerivedValue(
		() =>
			isExpanded
				? withTiming(1, {
						duration: 250,
						easing: Easing.bezier(0.25, 0.1, 0.25, 1),
					})
				: withTiming(0, {
						duration: 150,
						easing: Easing.bezier(0.25, 0.1, 0.25, 1),
					}),
		[isExpanded],
	);

	const animatedStyle = useAnimatedStyle(() => ({
		opacity: opacity.value,
	}));

	// Web: use CSS animations
	if (Platform.OS === "web") {
		return (
			<TextClassContext.Provider value="text-sm">
				<AccordionPrimitive.Content
					className={cn(
						"overflow-hidden",
						isExpanded ? "animate-accordion-down" : "animate-accordion-up",
					)}
					{...props}
				>
					<View className={cn("pb-4", className)}>
						{hasBeenExpanded ? children : null}
					</View>
				</AccordionPrimitive.Content>
			</TextClassContext.Provider>
		);
	}

	// Native: render content immediately, animate opacity for smooth transition
	return (
		<TextClassContext.Provider value="text-sm">
			<AccordionPrimitive.Content className="overflow-hidden" {...props}>
				<Animated.View style={animatedStyle} className={cn("pb-4", className)}>
					{hasBeenExpanded ? children : null}
				</Animated.View>
			</AccordionPrimitive.Content>
		</TextClassContext.Provider>
	);
}

export { Accordion, AccordionContent, AccordionItem, AccordionTrigger };

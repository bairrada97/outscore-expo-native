import { cn } from "@/lib/utils";
import * as Slot from "@rn-primitives/slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { Platform, Text as RNText, type Role } from "react-native";

const textVariants = cva(
	cn(
		"text-foreground text-base",
		Platform.select({
			web: "font-sourceSansPro tracking-sm my-0 bg-transparent border-0 box-border list-none p-0 relative text-start no-underline whitespace-pre-wrap break-words select-text",
		}),
	),
	{
		variants: {
			size: {
				"2xs": "text-2xs",
				xs: "text-xs",
				sm: "text-sm",
				md: "",
				lg: "text-lg",
				xl: "text-xl",
				"2xl": "text-2xl",
				"3xl": "text-3xl",
				"4xl": "text-4xl",
				"5xl": "text-5xl",
				"6xl": "text-6xl",
				"10": "text-[0.625rem]",
				"12": "text-[0.75rem]",
				"14": "text-[0.875rem]",
				"16": "text-[1rem]",
				"18": "text-[1.125rem]",
				"20": "text-[1.25rem]",
			},
			variant: {
				default: "",
				"title-01": "font-semibold uppercase max-w-[400px]",
				"title-02": "font-semibold uppercase text-[0.875rem] max-w-[400px]",
				"highlight-01": "font-normal text-[1.25rem] max-w-[400px]",
				"highlight-02": "font-bold text-[1.25rem] max-w-[400px]",
				"highlight-03": "font-normal text-[1.125rem] max-w-[400px]",
				"highlight-04": "font-bold text-[1.125rem] max-w-[400px]",
				"body-01": "font-normal text-[1rem] max-w-[400px]",
				"body-01--semi": "font-semibold text-[1rem] max-w-[400px]",
				"body-02": "font-normal text-[0.875rem] max-w-[400px]",
				"body-02--semi": "font-semibold text-[0.875rem] max-w-[400px]",
				"caption-01": "font-semibold text-[0.75rem] max-w-[400px]",
				"caption-02": "font-normal text-[0.75rem] max-w-[400px]",
				"caption-03": "font-semibold text-[0.625rem] max-w-[400px]",
				h1: cn(
					"text-center text-4xl font-extrabold tracking-tight",
					Platform.select({ web: "scroll-m-20 text-balance" }),
				),
				h2: cn(
					"border-border border-b pb-2 text-3xl font-semibold tracking-tight",
					Platform.select({ web: "scroll-m-20 first:mt-0" }),
				),
				h3: cn(
					"text-2xl font-semibold tracking-tight",
					Platform.select({ web: "scroll-m-20" }),
				),
				h4: cn(
					"text-xl font-semibold tracking-tight",
					Platform.select({ web: "scroll-m-20" }),
				),
				p: "mt-3 leading-7 sm:mt-6",
				blockquote: "mt-4 border-l-2 pl-3 italic sm:mt-6 sm:pl-6",
				code: cn(
					"bg-muted relative rounded px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold",
				),
				lead: "text-muted-foreground text-xl",
				large: "text-lg font-semibold",
				small: "text-sm font-medium leading-none",
				muted: "text-muted-foreground text-sm",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	},
);

type TextVariantProps = VariantProps<typeof textVariants>;

type TextVariant = NonNullable<TextVariantProps["variant"]>;

const ROLE: Partial<Record<TextVariant, Role>> = {
	h1: "heading",
	h2: "heading",
	h3: "heading",
	h4: "heading",
	blockquote: Platform.select({ web: "blockquote" as Role }),
	code: Platform.select({ web: "code" as Role }),
};

const ARIA_LEVEL: Partial<Record<TextVariant, string>> = {
	h1: "1",
	h2: "2",
	h3: "3",
	h4: "4",
};

const TextClassContext = React.createContext<string | undefined>(undefined);

function Text({
	className,
	asChild = false,
	variant = "default",
	...props
}: React.ComponentProps<typeof RNText> &
	TextVariantProps &
	React.RefAttributes<RNText> & {
		asChild?: boolean;
	}) {
	const textClass = React.useContext(TextClassContext);
	const Component = asChild ? Slot.Text : RNText;
	return (
		<Component
			className={cn(textClass, textVariants({ variant }), className)}
			role={variant ? ROLE[variant] : undefined}
			aria-level={variant ? ARIA_LEVEL[variant] : undefined}
			{...props}
		/>
	);
}

export { Text, TextClassContext };

import { TextClassContext } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import * as Slot from "@rn-primitives/slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { Pressable } from "react-native";

const buttonVariants = cva(
	"rounded-[40px] h-40 gap-y-0 gap-x-16 inline-flex items-center justify-center whitespace-nowrap text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
	{
		variants: {
			variant: {
				"cta-01": "bg-linear-to-r from-m-02 to-m-01-light-01",
				"cta-02":
					"text-m-01 border-m-01/20 border-solid border-[1px] dark:border-m-01-light-04/20 dark:text-m-01-light-04",
				"cta-03":
					"text-neu-07 border-[1px] border-solid border-neu-07/20 box-border gap-y-0 gap-x-8 dark:text-neu-06 dark:border-neu-06/20",
				"alt-01": "text-neu-07 h-auto",
			},
		},
		defaultVariants: {
			variant: "cta-01",
		},
	},
);

const buttonTextVariants = cva("text-sm font-medium", {
	variants: {
		variant: {
			"cta-01": "text-neu-01",
			"cta-02": "text-m-01 dark:text-m-01-light-04",
			"cta-03": "text-neu-07 dark:text-neu-06",
			"alt-01": "text-neu-07",
		},
	},
	defaultVariants: {
		variant: "cta-01",
	},
});

export interface ButtonProps
	extends React.ComponentPropsWithoutRef<typeof Pressable>,
		VariantProps<typeof buttonVariants> {
	asChild?: boolean;
}

const Button = React.forwardRef<React.ElementRef<typeof Pressable>, ButtonProps>(
	({ className, variant, asChild = false, ...props }, ref) => {
		const Component = asChild ? Slot.Pressable : Pressable;
		return (
			<TextClassContext.Provider value={buttonTextVariants({ variant })}>
				<Component
					ref={ref}
					className={cn(buttonVariants({ variant, className }))}
					{...props}
				/>
			</TextClassContext.Provider>
		);
	},
);
Button.displayName = "Button";

export { Button, buttonVariants };

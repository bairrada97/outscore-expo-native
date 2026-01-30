import { cn } from "@/lib/utils";
import { cva } from "class-variance-authority";
import { View } from "react-native";
import { Text } from "./ui/text";

const fixtureStatus = cva([], {
	variants: {
		matchIsLiveOrFinished: {
			true: ["text-neu-10", "dark:text-neu-06"],
		},
	},
});

export interface FixtureStatusProps {
	status: string;
	matchIsLiveOrFinished: boolean;
}

export function FixtureStatus({
	status,
	matchIsLiveOrFinished,
}: FixtureStatusProps) {
	return (
		<View className="min-w-40">
			<Text
				variant={!matchIsLiveOrFinished ? "body-02--semi" : undefined}
				className={cn(
					"font-sans-semibold text-neu-08 dark:text-neu-06",
					fixtureStatus({ matchIsLiveOrFinished }),
				)}
			>
				{status}
			</Text>
		</View>
	);
}

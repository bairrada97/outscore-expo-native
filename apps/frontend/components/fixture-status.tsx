import { cn } from "@/lib/utils";
import { tva } from "@gluestack-ui/nativewind-utils/tva";
import { View } from "react-native";
import { Text } from "./ui/text";

const fixtureStatus = tva({
	base: "",
	variants: {
		matchIsLiveOrFinished: {
			true: ["text-neu-10", "dark:text-neu-04"],
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
		<View>
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

import { cn } from "@/utils/misc";
import { tva } from "@gluestack-ui/nativewind-utils/tva";
import { memo } from "react";
import { View } from "react-native";
import { Text } from "../ui/text";

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

const fixtureStatusPropsAreEqual = (prevProps: any, nextProps: any) => {
  return prevProps === nextProps;
};
export const FixtureStatus = memo(
  ({ status, matchIsLiveOrFinished }: FixtureStatusProps) => {
    return (
      <View className="w-[40px]">
        <Text
          variant={!matchIsLiveOrFinished ? "body-02--semi" : undefined}
          className={cn(
            "dark:text-neu-06 font-semibold text-neu-08",
            fixtureStatus({ matchIsLiveOrFinished }),
          )}
        >
          {status}
        </Text>
      </View>
    );
  },
  fixtureStatusPropsAreEqual,
);

FixtureStatus.displayName = "FixtureStatus";

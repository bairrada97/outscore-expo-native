import { tva } from "@gluestack-ui/nativewind-utils/tva";
import { Text } from "../ui/text";
import { View } from "react-native";
import { cn } from "@/utils/misc";

const fixtureTeam = tva({
  base: "flex flex-row gap-y-0 gap-x-8",
  variants: {
    bold: {
      true: ["font-bold", "dark:text-neu-01"],
    },
  },
});

export interface FixtureTeamProps {
  isInFavorites?: boolean;
  isGoal: boolean;
  score: number;
  name: string;
  winner: boolean;
}

export const FixtureTeam = ({
  isInFavorites,
  isGoal,
  score,
  name,
  winner,
}: FixtureTeamProps) => {
  return (
    <View className={fixtureTeam({ bold: winner || isGoal })}>
      <Text
        className={cn("min-w-[16px]", fixtureTeam({ bold: winner || isGoal }))}
      >
        {score}
      </Text>
      <Text
        className={cn(
          "block overflow-hidden overflow-ellipsis whitespace-nowrap",
          fixtureTeam({ bold: winner || isGoal }),
        )}
      >
        {name}
      </Text>
      {isInFavorites ? (
        <View className="text-red">
          {/* <SvgB019 width={8} height={8} has-gradient={true} /> */}
        </View>
      ) : null}
    </View>
  );
};

FixtureTeam.displayName = "FixtureTeam";

// const StyledFixtureTeam = styled("div", {
//   display: "flex",
//   gap: "0 $spacing2",
//   variants: {
//     bold: {
//       true: {
//         fontWeight: "700",
//         [`[data-theme="dark"] &`]: {
//           fontWeight: "700",
//           color: "rgb($neu-01)",
//         },
//       },
//     },
//   },
// });

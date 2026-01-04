import { MouseEvent } from "react";
import SvgB018 from "../ui/SvgIcons/B018";
import SvgB019 from "../ui/SvgIcons/B019";
import { Pressable } from "react-native";

export const FavoritesIcon = ({
  handlePress,
  isActive,
  activeWithGradient = true,
}: {
  handlePress: (e: any) => void;
  isActive: boolean;
  activeWithGradient?: boolean;
}) => {
  return (
    <Pressable
      // animate={{
      // 	scale: isActive ? [1, 1.18, 1] : 1,
      // 	transition: {
      // 		duration: 0.15,
      // 		ease: cubicBezier(0, 0.47, 0.53, 0.33),
      // 	},
      // }}

      onPress={handlePress}
    >
      {isActive ? (
        <SvgB019
          width={24}
          height={24}
          has-gradient={activeWithGradient ? activeWithGradient : undefined}
          aria-label="following icon"
          className="z-9 text-neu-06"
        />
      ) : (
        <SvgB018
          width={24}
          height={24}
          aria-label="following icon"
          className="z-9 text-neu-06"
        />
      )}
    </Pressable>
  );
};

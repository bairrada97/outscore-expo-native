import { cn } from "@/lib/utils";
import { Pressable, View } from "react-native";
import Svg, { Path } from "react-native-svg";

interface FavouriteIconProps {
  isFavourite?: boolean;
  onPress?: () => void;
  size?: number;
}

export function FavouriteIcon({
  isFavourite = false,
  onPress,
  size = 20,
}: FavouriteIconProps) {
  const svgContent = (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={isFavourite ? "#FFD12E" : "none"}
      stroke={isFavourite ? "#FFD12E" : "#8B9591"}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </Svg>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        className={cn(
          "items-center justify-center p-1",
          "active:opacity-70"
        )}
      >
        {svgContent}
      </Pressable>
    );
  }

  return (
    <View className="items-center justify-center p-1">
      {svgContent}
    </View>
  );
}

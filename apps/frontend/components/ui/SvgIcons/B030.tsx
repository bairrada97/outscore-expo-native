import * as React from "react";
import Svg, { SvgProps, Path } from "react-native-svg";

interface B030Props extends SvgProps {
  primaryColor?: string;
  secondaryColor?: string;
}

const SvgB030 = ({ primaryColor = "currentColor", secondaryColor = "currentColor", ...props }: B030Props) => (
  <Svg width="1em" height="1em" fill="none" viewBox="0 0 24 24" role="img" {...props}>
    <Path
      fill={primaryColor}
      d="M12 7a1 1 0 0 1 1 1v3h3a1 1 0 1 1 0 2h-3v3a1 1 0 1 1-2 0v-3H8a1 1 0 1 1 0-2h3V8a1 1 0 0 1 1-1Z"
    />
    <Path
      fill={secondaryColor}
      d="M12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm-9 7a9 9 0 1 1 18 0 9 9 0 0 1-18 0Z"
    />
  </Svg>
);
export default SvgB030;

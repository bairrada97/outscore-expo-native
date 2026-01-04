import * as React from "react";
import Svg, { SvgProps, Path, Rect } from "react-native-svg";

const SvgEventSub = (props: SvgProps) => (
  <Svg
    width="1em"
    height="1em"
    viewBox="0 0 24 24"
    fill="none"
    role="img"
    {...props}
  >
    <Path d="M6.998 7h10v3l4-4-4-4v3h-12v6h2V7Z" fill="#609B15" />
    <Path d="M17 17H7v-3l-4 4 4 4v-3h12v-6h-2v4Z" fill="#D26D6D" />
  </Svg>
);

export default SvgEventSub;

import * as React from "react";
import Svg, { SvgProps, Path, Rect } from "react-native-svg";
const SvgEventCardSecondYellow = (props: SvgProps) => (
  <Svg
    width="1em"
    height="1em"
    viewBox="0 0 24 25"
    fill="none"
    role="img"
    {...props}
  >
    <Rect x={3} width={14} height={20} rx={2} fill="#FFB72D" />
    <Rect
      x={7}
      y={4}
      width={14}
      height={20}
      rx={2}
      fill="#D26D6D"
      stroke="#fff"
    />
  </Svg>
);

export default SvgEventCardSecondYellow;

import * as React from "react";
import Svg, { SvgProps, Rect } from "react-native-svg";
const SvgEventCardRed = (props: SvgProps) => (
  <Svg
    width="1em"
    height="1em"
    viewBox="0 0 24 24"
    fill="none"
    role="img"
    {...props}
  >
    <Rect x={5} y={2} width={14} height={20} rx={2} fill="#D26D6D" />
  </Svg>
);

export default SvgEventCardRed;

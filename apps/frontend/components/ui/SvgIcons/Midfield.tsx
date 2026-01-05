import * as React from "react";
import Svg, { SvgProps, Circle } from "react-native-svg";
const SvgMidfield = (props: SvgProps) => (
  <Svg
    width="1em"
    height="1em"
    viewBox="0 0 94 94"
    fill="none"
    role="img"
    {...props}
  >
    <Circle cx={47} cy={47} r={46} stroke="currentColor" strokeWidth={2} />
  </Svg>
);

export default SvgMidfield;

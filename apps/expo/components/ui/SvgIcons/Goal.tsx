import * as React from "react";
import Svg, { SvgProps, Path, Rect } from "react-native-svg";
const SvgGoal = (props: SvgProps) => (
  <Svg
    width="1em"
    height="1em"
    viewBox="0 0 174 92"
    fill="none"
    role="img"
    {...props}
  >
    <Path
      d="M173 0v68a8 8 0 0 1-8 8H9a8 8 0 0 1-8-8V0"
      stroke="currentColor"
      strokeWidth={2}
    />
    <path
      d="M127 0v11c0 2.761-2.245 5-5.007 5H52.007A5.006 5.006 0 0 1 47 11V0M112 75c0 8.837-11.193 16-25 16s-25-7.163-25-16"
      stroke="currentColor"
      strokeWidth={2}
    />
  </Svg>
);

export default SvgGoal;

import * as React from "react";
import Svg, { SvgProps, Path } from "react-native-svg";
const SvgArrowDown = (props: SvgProps) => (
  <Svg width="1em" height="1em" fill="none" viewBox="0 0 24 24" {...props}>
    <Path
      fill="currentColor"
      d="m7.41 8.295 4.59 4.58 4.59-4.58L18 9.705l-6 6-6-6 1.41-1.41Z"
    />
  </Svg>
);
export default SvgArrowDown;

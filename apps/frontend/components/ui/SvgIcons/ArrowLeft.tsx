import * as React from "react";
import Svg, { SvgProps, Path } from "react-native-svg";
const SvgArrowLeft = (props: SvgProps) => (
  <Svg width="1em" height="1em" fill="none" viewBox="0 0 24 24" {...props}>
    <Path
      fill="currentColor"
      d="M15.705 16.59 11.125 12l4.58-4.59L14.295 6l-6 6 6 6 1.41-1.41Z"
    />
  </Svg>
);
export default SvgArrowLeft;

import * as React from "react";
import Svg, { SvgProps, Path, Rect, Circle } from "react-native-svg";
const SvgNavMatches = (props: SvgProps) => (
  <Svg
    width="1em"
    height="1em"
    viewBox="0 0 24 24"
    fill="none"
    role="img"
    {...props}
  >
    <Path
      d="M23 4H1a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h22a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1ZM12 14c-1.103 0-2-.897-2-2 0-1.104.897-2 2-2s2 .896 2 2c0 1.103-.897 2-2 2ZM2 10h2v4H2v-4Zm0 6h4V8H2V6h9v2.142c-1.72.448-3 2-3 3.858s1.28 3.41 3 3.858V18H2v-2Zm20-2h-2v-4h2v4Zm-4-6v8h4v2h-9v-2.142c1.72-.448 3-2 3-3.858s-1.28-3.41-3-3.858V6h9v2h-4Z"
      fill="currentColor"
    />
  </Svg>
);

export default SvgNavMatches;

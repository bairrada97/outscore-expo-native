import * as React from "react";
import Svg, { SvgProps, Path } from "react-native-svg";
const SvgInjury = (props: SvgProps) => (
  <Svg
    width="1em"
    height="1em"
    viewBox="0 0 16 17"
    fill="none"
    role="img"
    {...props}
  >
    <Path
      d="M8.667 5.167H7.333v2.667H4.667v1.333h2.666v2.667h1.334V9.167h2.666V7.834H8.667V5.167Z"
      fill="#D26D6D"
    />
    <Path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M1.333 8.5A6.67 6.67 0 0 1 8 1.833 6.669 6.669 0 0 1 14.667 8.5 6.669 6.669 0 0 1 8 15.167 6.67 6.67 0 0 1 1.333 8.5Zm1.334 0A5.34 5.34 0 0 0 8 13.834 5.34 5.34 0 0 0 13.333 8.5 5.34 5.34 0 0 0 8 3.167 5.34 5.34 0 0 0 2.667 8.5Z"
      fill="#C4C4C4"
    />
  </Svg>
);

export default SvgInjury;

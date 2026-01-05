import * as React from "react";
import Svg, { SvgProps, Path } from "react-native-svg";
const SvgCalendar = (props: SvgProps) => (
  <Svg
    width="1em"
    height="1em"
    viewBox="0 0 24 24"
    fill="none"
    role="img"
    {...props}
  >
    <Path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M20 3h-1V1h-2v2H7V1H5v2H4c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2Zm0 18H4V10h16v11ZM4 8h16V5H4v3Z"
      fill="currentColor"
    />
  </Svg>
);

export default SvgCalendar;

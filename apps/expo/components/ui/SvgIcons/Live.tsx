import * as React from "react";
import Svg, { SvgProps, Path, Rect } from "react-native-svg";
const SvgLive = (props: SvgProps) => (
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
      d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2ZM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8ZM11 7h1.5v5.25l4.5 2.67-.75 1.23L11 13V7Z"
      fill="currentColor"
    />
  </Svg>
);

export default SvgLive;

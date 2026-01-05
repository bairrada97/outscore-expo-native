import * as React from "react";
import Svg, { SvgProps, Path, Rect, Circle } from "react-native-svg";
const SvgNavLeagues = (props: SvgProps) => (
  <Svg
    width="1em"
    height="1em"
    viewBox="0 0 24 24"
    fill="none"
    role="img"
    {...props}
  >
    <Path
      d="M2 2v9c0 1 1 2 2 2h2.2c.4 2 1.7 3.7 4.8 4v2.1c-2.2.2-3 1.3-3 2.6v.3h8v-.3c0-1.3-.8-2.4-3-2.6V17c3.1-.3 4.4-2 4.8-4H20c1 0 2-1 2-2V2h-4c-.9 0-2 1-2 2H8c0-1-1.1-2-2-2H2Zm2 2h2v7H4V4Zm14 0h2v7h-2V4ZM8 6h8v5.5c0 1.933-.585 3.5-4 3.5s-4-1.567-4-3.5V6Z"
      fill="currentColor"
    />
  </Svg>
);

export default SvgNavLeagues;

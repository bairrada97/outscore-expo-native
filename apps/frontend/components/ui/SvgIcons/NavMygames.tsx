import * as React from "react";
import Svg, { SvgProps, Path } from "react-native-svg";
const SvgNavMygames = (props: SvgProps) => (
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
      d="M20.1 3H3.9c-.5 0-.9.4-.9.9v16.2c0 .4.4.9.9.9h16.2c.4 0 .9-.5.9-.9V3.9c0-.5-.5-.9-.9-.9ZM9 7H7v2h2V7Zm8 0h-6v2h6V7Zm0 4h-6v2h6v-2Zm-6 4h6v2h-6v-2Zm-4-4h2v2H7v-2Zm2 4H7v2h2v-2Zm-4 4h14V5H5v14Z"
      fill="currentColor"
    />
  </Svg>
);

export default SvgNavMygames;

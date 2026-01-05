import * as React from "react";
import Svg, { SvgProps, Path } from "react-native-svg";
const SvgEventPenaltyGoal = (props: SvgProps) => (
  <Svg
    width="1em"
    height="1em"
    viewBox="0 0 24 24"
    fill="none"
    role="img"
    {...props}
  >
    <Path
      d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2Zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8Zm-5-5h10v2H7v-2Zm3.3-3.8L8.4 9.3 7 10.7l3.3 3.3L17 7.3l-1.4-1.4-5.3 5.3Z"
      fill="#797979"
    />
  </Svg>
);

export default SvgEventPenaltyGoal;

import * as React from "react";
import Svg, { SvgProps, Path, Rect, Circle } from "react-native-svg";
const SvgWorld = (props: SvgProps) => (
  <Svg
    width="1em"
    height="1em"
    viewBox="0 0 28 20"
    fill="none"
    role="img"
    {...props}
  >
    <Path fill="#34B778" d="M0 0h28v20H0z" />
    <Path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M14 17.333a7.333 7.333 0 1 0 0-14.666 7.333 7.333 0 0 0 0 14.666Zm5.963-6.666a6.006 6.006 0 0 1-3.746 4.91c.65-1.324 1.03-3.049 1.103-4.91h2.643Zm-3.977 0c-.098 2.249-.685 4.236-1.6 5.32a6.079 6.079 0 0 1-.771 0c-.916-1.084-1.503-3.071-1.6-5.32h3.97Zm-5.306 0c.073 1.861.453 3.586 1.103 4.91a6.006 6.006 0 0 1-3.746-4.91h2.643Zm1.334-1.334h3.972c-.098-2.249-.685-4.236-1.6-5.32a6.086 6.086 0 0 0-.771 0c-.916 1.084-1.503 3.071-1.6 5.32Zm-.231-4.91c-.65 1.324-1.03 3.05-1.103 4.91H8.037a6.006 6.006 0 0 1 3.746-4.91Zm8.18 4.91H17.32c-.073-1.86-.453-3.586-1.103-4.91a6.006 6.006 0 0 1 3.747 4.91Z"
      fill="#fff"
    />
  </Svg>
);

export default SvgWorld;

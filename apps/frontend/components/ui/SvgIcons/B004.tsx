import { cssInterop } from "nativewind";
import * as React from "react";
import Svg, { SvgProps, Path } from "react-native-svg";

const SvgB004 = (props: SvgProps) => {
  cssInterop(Svg, {
    className: {
      target: "style",
      nativeStyleToProp: { width: true, height: true },
    },
  });
  return (
    <Svg fill="none" role="img" {...props}>
      <Path
        fill="currentColor"
        d="M14 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm-2 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"
      />
    </Svg>
  );
};

export default SvgB004;

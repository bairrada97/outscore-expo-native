import { cssInterop } from "nativewind";
import * as React from "react";
import Svg, { SvgProps, Path } from "react-native-svg";

cssInterop(Svg, {
  className: {
    target: "style",
    nativeStyleToProp: { width: true, height: true },
  },
});

const SvgB004 = (props: SvgProps) => {
  return (
    <Svg width="1em" height="1em" fill="none" viewBox="0 0 24 24" role="img" {...props}>
      <Path
        fill="currentColor"
        d="M14 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm-2 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"
      />
    </Svg>
  );
};

export default SvgB004;

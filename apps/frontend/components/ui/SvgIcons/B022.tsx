import { cssInterop } from "nativewind";
import * as React from "react";
import Svg, { SvgProps, Path } from "react-native-svg";

cssInterop(Svg, {
  className: {
    target: "style",
    nativeStyleToProp: { width: true, height: true },
  },
});

const SvgB022 = (props: SvgProps) => {
  return (
    <Svg width="1em" height="1em" fill="none" viewBox="0 0 24 24" role="img" {...props}>
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M7 6a1 1 0 0 1-1-1H4v3h16V5h-2a1 1 0 1 1-2 0H8a1 1 0 0 1-1 1Zm9-3H8V2a1 1 0 0 0-2 0v1H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-2V2a1 1 0 1 0-2 0v1ZM4 10h16v9H4v-9Z"
        fill="currentColor"
      />
    </Svg>
  );
};
export default SvgB022;

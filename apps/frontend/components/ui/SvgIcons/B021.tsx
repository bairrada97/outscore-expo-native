import { cssInterop } from "nativewind";
import * as React from "react";
import Svg, { SvgProps, Path } from "react-native-svg";

cssInterop(Svg, {
  className: {
    target: "style",
    nativeStyleToProp: { width: true, height: true },
  },
});

const SvgB021 = (props: SvgProps) => {
  return (
    <Svg width="1em" height="1em" fill="none" viewBox="0 0 24 24" role="img" {...props}>
      <Path
        fill={props.color}
        d="M6.343 6.343a8 8 0 0 0 0 11.314A1 1 0 1 1 4.93 19.07c-3.905-3.905-3.905-10.237 0-14.142 3.905-3.905 10.237-3.905 14.142 0 3.905 3.905 3.905 10.237 0 14.142a1 1 0 0 1-1.414-1.414A8 8 0 0 0 6.343 6.343Zm2.864 2.864a3.95 3.95 0 0 0 0 5.586 1 1 0 1 1-1.414 1.414 5.95 5.95 0 1 1 8.414 0 1 1 0 0 1-1.414-1.414 3.95 3.95 0 1 0-5.586-5.586ZM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"
      />
    </Svg>
  );
};

export default SvgB021;

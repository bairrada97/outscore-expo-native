import { cssInterop } from "nativewind";
import * as React from "react";
import Svg, { SvgProps, Path } from "react-native-svg";

cssInterop(Svg, {
  className: {
    target: "style",
    nativeStyleToProp: { width: true, height: true },
  },
});

const SvgB018 = (props: SvgProps) => {
  return (
    <Svg width="1em" height="1em" fill="none" viewBox="0 0 24 24" role="img" {...props}>
      <Path
        fill="currentColor"
        d="M12 2a1 1 0 0 1 .905.573l2.56 5.421 5.689.886a1 1 0 0 1 .564 1.684L17.58 14.83l.965 6.01a1 1 0 0 1-1.469 1.035l-5.075-2.79-5.077 2.791a1 1 0 0 1-1.469-1.035l.965-6.01-4.138-4.266a1 1 0 0 1 .564-1.684l5.689-.886 2.561-5.422A1 1 0 0 1 12.001 2Zm0 3.341L10.117 9.33a1 1 0 0 1-.75.561l-4.304.67L8.204 13.8a1 1 0 0 1 .27.855l-.72 4.484 3.765-2.07a1 1 0 0 1 .963 0l3.764 2.069-.72-4.485a1 1 0 0 1 .27-.854l3.14-3.24-4.302-.67a1 1 0 0 1-.75-.56L12 5.34Z"
      />
    </Svg>
  );
};

export default SvgB018;

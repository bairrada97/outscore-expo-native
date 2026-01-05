import { cssInterop } from "nativewind";
import Svg, { SvgProps, Path, Defs, Stop } from "react-native-svg";

cssInterop(Svg, {
  className: {
    target: "style",
    nativeStyleToProp: { width: true, height: true },
  },
});

const SvgB019 = (props: SvgProps) => {
  return (
    <Svg width="1em" height="1em" fill="none" viewBox="0 0 24 24" role="img" {...props}>
      <Defs>
        <linearGradient id="B-019_svg__a" x1="0%" y1="0%" x2="100%" y2="0%">
          <Stop
            offset="10.93%"
            stopColor="#76c427"
            stopOpacity={1}
          />
          <Stop
            offset="88.2%"
            stopColor="#26976c"
            stopOpacity={1}
          />
        </linearGradient>
      </Defs>
      <Path
        d="M12 2a1 1 0 0 1 .905.573l2.56 5.421 5.689.886a1 1 0 0 1 .564 1.684L17.58 14.83l.965 6.01a1 1 0 0 1-1.469 1.035l-5.075-2.79-5.077 2.791a1 1 0 0 1-1.469-1.035l.965-6.01-4.138-4.266a1 1 0 0 1 .564-1.684l5.689-.886 2.561-5.422A1 1 0 0 1 12.001 2Z"
        fill="url(#B-019_svg__a)"
      />
    </Svg>
  );
};

export default SvgB019;

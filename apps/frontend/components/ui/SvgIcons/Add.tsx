import * as React from "react";
import Svg, { SvgProps, Path } from "react-native-svg";
const SvgAdd = (props: SvgProps) => (
  <Svg width="1em" height="1em" fill="none" viewBox="0 0 25 24" {...props}>
    <Path fill="#797979" d="M19.997 13h-6v6h-2v-6h-6v-2h6V5h2v6h6v2Z" />
  </Svg>
);
export default SvgAdd;

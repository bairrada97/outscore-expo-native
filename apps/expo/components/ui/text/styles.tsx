import { tva } from "@gluestack-ui/nativewind-utils/tva";
import { isWeb } from "@gluestack-ui/nativewind-utils/IsWeb";

const baseStyle = isWeb
  ? "font-sourceSansPro tracking-sm my-0 bg-transparent border-0 box-border display-inline list-none margin-0 padding-0 position-relative text-start no-underline whitespace-pre-wrap word-wrap-break-word"
  : "";

export const textStyle = tva({
  base: `${baseStyle}`,
  variants: {
    isTruncated: {
      true: "web:truncate",
    },
    bold: {
      true: "font-bold",
    },
    underline: {
      true: "underline",
    },
    strikeThrough: {
      true: "line-through",
    },
    size: {
      "2xs": "text-2xs",
      xs: "text-xs",
      sm: "text-sm",
      md: "",
      lg: "text-lg",
      xl: "text-xl",
      "2xl": "text-2xl",
      "3xl": "text-3xl",
      "4xl": "text-4xl",
      "5xl": "text-5xl",
      "6xl": "text-6xl",
      "10": "text-[0.625rem]",
      "12": "text-[0.75rem]",
      "14": "text-[0.875rem]",
      "16": "text-[1rem]",
      "18": "text-[1.125rem]",
      "20": "text-[1.25rem]",
    },
    sub: {
      true: "text-xs",
    },
    italic: {
      true: "italic",
    },
    highlight: {
      true: "bg-yellow-500",
    },
    variant: {
      "title-01": "font-semibold uppercase max-w-[400px]",
      "title-02": "font-semibold uppercase text-[0.875rem] max-w-[400px]",
      "highlight-01": "font-normal text-[1.25rem] max-w-[400px]",
      "highlight-02": "font-bold text-[1.25rem] max-w-[400px]",
      "highlight-03": "font-normal text-[1.125rem] max-w-[400px]",
      "highlight-04": "font-bold text-[1.125rem] max-w-[400px]",
      "body-01": "font-normal text-[1rem] max-w-[400px]",
      "body-01--semi": "font-semibold text-[1rem] max-w-[400px]",
      "body-02": "font-normal text-[0.875rem] max-w-[400px]",
      "body-02--semi": "font-semibold text-[0.875rem] max-w-[400px]",
      "caption-01": "font-semibold text-[0.75rem] max-w-[400px]",
      "caption-02": "font-normal text-[0.75rem] max-w-[400px]",
      "caption-03": "font-semibold text-[0.625rem] max-w-[400px]",
    },
  },
});

import { cn } from "@/utils/misc";
import { type ReactNode } from "react";
import { type ClassNameValue } from "tailwind-merge";
import { Text } from "../text";
import { Animated, View } from "react-native";

export interface TitleBlockProps {
  children: ReactNode;
  extraInfo?: ReactNode;
  className?: ClassNameValue;
}

export const TitleBlock = ({
  children,
  extraInfo,
  className,
}: TitleBlockProps) => {
  return (
    <View
      className={cn(
        `relative box-border flex h-40 flex-row items-center gap-x-8 gap-y-0 rounded-tl-[8px] rounded-tr-[8px] border-x-4 border-t-4 border-[white] bg-neu-03 px-16 py-0 ${className}`,
      )}
    >
      <Text variant="body-01--semi" className="translate-x-[-4px] text-neu-10">
        {children}
      </Text>
      {extraInfo && (
        <View className="translate-y-1 ml-auto translate-x-4 uppercase">
          {extraInfo}
        </View>
      )}
    </View>
  );
};

// export const StyleTitleBlock = styled("div", {
//   //   position: "relative",
//   //   color: "rgb($neu-10)",
//   //   height: "$sizes6",
//   //   display: "flex",
//   //   alignItems: "center",
//   //   gap: "0 $spacing2",
//   //   borderWidth: "4px 4px 0 4px",
//   //   borderRadius: "8px 8px 0 0",
//   //   borderStyle: "solid",
//   //   borderColor: "rgb($neu-01)",
//   //   background: "rgb($neu-03)",
//   //   padding: "0 $spacing3",
//   //   boxSizing: "border-box",
//   [`[data-theme="dark"] &`]: {
//     borderColor: "rgb($neu-11)",
//     background: "rgb($neu-10)",
//     color: "rgb($neu-04)",
//   },

//   //   "& .title": {
//   //     transform: "translateX(-4px)",
//   //   },

//   //   "& .extraInfo": {
//   //     marginLeft: "auto",
//   //     textTransform: "uppercase",
//   //     transform: "translate(4px, 1px)",
//   //   },
// });


import { type ReactNode } from "react";
import { View } from "react-native";
import { Heading } from "../heading";

export interface TitleSectionProps {
  icon?: ReactNode;
  children: ReactNode;
}

export const TitleSection = ({ children, icon }: TitleSectionProps) => {
  return (
    <View className="flex h-40 flex-row items-center justify-between gap-x-8 gap-y-0">
      <View className="relative flex flex-row items-center gap-x-8 gap-y-0 before:flex before:h-4 before:w-16 before:flex-row before:rounded-r-[8px] before:bg-gra-03 before:content-['']">
        <Heading
          variant="title-02"
          className="dark:text-m-01--light-04 text-m-01"
        >
          {children}
        </Heading>
      </View>

      {/* {icon && <View className="mr-16">{icon}</View>} */}
    </View>
  );
};

// export const StyleTitleSection = styled("div", {
//   color: "rgb($m-01)",
//   height: "$sizes6",
//   display: "flex",
//   alignItems: "center",
//   justifyContent: "space-between",
//   gap: "0 $spacing2",
//   [`[data-theme="dark"] &`]: {
//     color: "rgb($m-01--light-04)",
//   },

//   "& .title-container": {
//     position: "relative",
//     display: "flex",
//     alignItems: "center",
//     gap: "0 $spacing2",
//     "&:before": {
//       content: "",
//       display: "flex",
//       width: "$sizes3",
//       height: "$sizes1",
//       linearGradient: "$gra-03",
//       borderTopRightRadius: "8px",
//       borderBottomRightRadius: "8px",
//     },
//   },
//   "& .icon-container": {
//     marginRight: "$spacing3",
//   },
// });

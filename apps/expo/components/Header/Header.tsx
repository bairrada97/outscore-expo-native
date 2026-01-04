import { cn } from "@/utils/misc";
import { type ReactNode } from "react";
import { Platform, View } from "react-native";
import { Text } from "../ui/text";

export interface HeaderProps {
  children: ReactNode[];
  classNames?: string;
  innerContainerClassName?: string;
}

export const LeftIcons = ({ children }: { children: ReactNode }) => {
  return <>{children}</>;
};

export const RightIcons = ({ children }: { children: ReactNode }) => {
  return <View className="flex items-center gap-x-4 gap-y-0">{children}</View>;
};
export const Header = ({
  classNames,
  innerContainerClassName,
  children,
}: HeaderProps) => {
  return (
    <View
      className={cn(
        "z-9999 top-0 box-border flex h-48 w-full max-w-[800px] cursor-pointer flex-row items-center justify-between bg-m-01 px-16 py-0",
        classNames,
      )}
    >
      <Text></Text>
      <View
        className={cn(
          `flex w-full flex-row items-center gap-x-16 gap-y-0 ${innerContainerClassName}`,
        )}
      >
        {children}
      </View>
    </View>
  );
};

Header.LeftIcons = LeftIcons;
Header.RightIcons = RightIcons;
// export const StyledHeader = styled("header", {
//   top: "0",
//   width: "100%",
//   backgroundColor: "rgb($m-01)",
//   color: "rgb($neu-01)",
//   display: "flex",
//   justifyContent: "space-between",
//   padding: "0 $defaultPadding",
//   height: "$sizes7",
//   boxSizing: "border-box",
//   zIndex: "9999",
//   maxWidth: "$appSize",

//   "& .header__container": {
//     display: "flex",
//     alignItems: "center",
//     gap: "0 $spacing3",

//     "& a": {
//       display: "flex",
//     },
//   },
//   "& .header__container--icons": {
//     display: "flex",
//     alignItems: "center",
//     gap: "0 $spacing4",
//     cursor: "pointer",
//   },
// });

import { cn } from "@/utils/misc";
import { tva } from "@gluestack-ui/nativewind-utils/tva";
import { Text } from "../ui/text";
import { TouchableOpacity, View } from "react-native";

const calendarBarButton = tva({
  base: "",
  variants: {
    state: {
      active: [
        "text-neu-01",
        "dark:text-neu-01",
        "delay-200",
        "duration-100",
        "ease",
      ],
    },
  },
});

export interface CalendarBarButtonProps {
  state?: any;
  icon?: JSX.Element | null;
  ["aria-pressed"]?: boolean;
  label?: string;
  onPress?: () => void;
}

export const CalendarBarButton = ({
  label,
  icon,
  state,
  onPress,
  ...props
}: CalendarBarButtonProps) => {
  return (
    <TouchableOpacity
      className={cn(
        "dark:bg-neu-11 h-full dark:text-m-01--light-04 flex flex-1 flex-col items-center justify-center bg-neu-01 uppercase text-m-01",
        calendarBarButton({ state: state && "active" }),
      )}
      onPress={onPress}
      {...props}
    >
      <View className="z-10">{icon}</View>
      {label && (
        <View
          className={cn(
            "",
            state
              ? "ease z-10 text-neu-01 delay-200 duration-100"
              : "dark:text-m-01--light-04 text-m-01",
          )}
        >
          <Text variant="caption-01">{label}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

// const StyledCalendarBarButton = styled("button", {
//   display: "flex",
//   alignItems: "center",
//   justifyContent: "center",
//   flexDirection: "column",
//   color: "rgb($m-01)",
//   textTransform: "uppercase",
//   background: "rgb($neu-01)",
//   [`[data-theme="dark"] &`]: {
//     color: "rgb($m-01--light-04)",
//     background: "rgb($neu-11)",
//   },
//   variants: {
//     active: {
//       true: {
//         color: "rgb($neu-01) !important",
//         transition: "0.1s ease",
//         transitionDelay: `0.2s`,
//         [`[data-theme="dark"] &`]: {
//           color: "rgb($neu-01) !important",
//         },
//         "& .label": {
//           color: "rgb($neu-01) !important",
//           transition: "0.1s ease",
//           transitionDelay: `0.2s`,
//           zIndex: "1",
//         },
//       },
//     },
//   },
//   "& svg": {
//     zIndex: "1",
//   },
//   "& .label": {
//     color: "rgb($m-01)",
//     [`[data-theme="dark"] &`]: {
//       color: "rgb($m-01--light-04)",
//     },
//   },
// });

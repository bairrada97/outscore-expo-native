import { cn } from "@/utils/misc";
import { tva } from "@gluestack-ui/nativewind-utils/tva";
import { Text } from "../ui/text";
import { Link, usePathname } from "expo-router";
import { useDatePicker } from "@/hooks/useDatePicker";
import { Pressable, TouchableOpacity, View } from "react-native";
import { datePickerAtom } from "@/store/datepicker-store";
import { useAtom } from "jotai";
import usePrevious from "@/hooks/usePrevious";

const calendarBarDay = tva({
  base: "",
  variants: {
    selectedDayState: {
      true: "text-neu-01 ease bg-m-01",
    },
    todayState: {
      true: "dark:text-m-01--light-04 text-m-01",
    },
  },
  compoundVariants: [
    {
      selectedDayState: true,
      todayState: true,
      class: "dark:text-neu-01 text-neu-01",
    },
  ],
});

export interface CalendarBarDayProps {
  day: string;
  ["data-index"]?: number;
  onPress?: () => void;
  selectedDayState?: boolean;
  todayState?: boolean;
  selectedDateIndex?: number;
}

export const CalendarBarDay = ({
  day,
  onPress,
  ...props
}: CalendarBarDayProps) => {
  const pathname = usePathname();
  const isLive = pathname.includes("live");
  const { numericDay, weekDayShort } = useDatePicker();
  const [datePicker] = useAtom(datePickerAtom);

  const selectedDayClass = day === datePicker.selectedDate;
  const selectedDateIndex = datePicker.selectedDateIndex;
  const todayState = new Date(day).toDateString() === new Date().toDateString();
  const selectedDayState = !isLive && selectedDayClass;

  const previousSelectedDateIndex = usePrevious(selectedDateIndex);

  return (
    <View
      className={cn(
        "dark:bg-neu-11 relative flex h-full w-full flex-1 flex-row items-center justify-center overflow-hidden bg-neu-01 transition-none delay-0",
        `data-[is-today=true]:delay-[${
          selectedDateIndex! >= 0 && selectedDateIndex! <= 4
            ? 0.05 * Math.abs(previousSelectedDateIndex! - selectedDateIndex!)
            : 0
        }], ${calendarBarDay({ selectedDayState })}`,
      )}
      {...props}
    >
      <Link href={`/date/${day}`} asChild>
        <Pressable
          onPress={onPress}
          className="z-10 flex flex-1 flex-col items-center"
        >
          <Text
            variant="highlight-01"
            className={cn(
              "numericDay dark:text-neu-06 uppercase text-neu-09/70",
              calendarBarDay({ selectedDayState, todayState }),
            )}
          >
            {numericDay(new Date(day))}
          </Text>
          <Text
            variant="caption-02"
            className={cn(
              "weekDay dark:text-neu-06 uppercase text-neu-09/70",
              calendarBarDay({ selectedDayState, todayState }),
            )}
          >
            {weekDayShort(new Date(day))}
          </Text>
        </Pressable>
      </Link>
    </View>
  );
};

// const StyledCalendarBarDay = styled("div", {
//   // position: "relative",
//   // display: "flex",
//   // flexDirection: "column",
//   // alignItems: "center",
//   // justifyContent: "center",
//   // width: "100%",
//   // height: "100%",
//   // color: "rgb($neu-09, 0.7)",
//   // overflow: "hidden",
//   // transition: "none",
//   // transitionDelay: `none`,
//   // textTransform: "uppercase",
//   "& .calendarBarDay-container": {
//     display: "flex",
//     flexDirection: "column",
//     alignItems: "center",
//     width: "100%",
//     zIndex: 2,
//   },
//   "&[data-is-today='true']": {
//     color: "rgb($m-01)",

//     [`[data-theme="dark"] &`]: {
//       color: "rgb($m-01--light-04)",
//     },
//   },
//   [`[data-theme="dark"] &`]: {
//     color: "rgb($neu-06)",
//   },

//   variants: {
//     selectedDayState: {
//       true: {
//         color: "rgb($neu-01)",
//         transition: "0.1s ease ",

//         "&[data-is-today]": {
//           color: "rgb($neu-01)",
//           background: "rgb($m-01)",

//           [`[data-theme="dark"] &`]: {
//             color: "rgb($neu-01)",
//           },
//         },
//       },
//     },
//   },
// });

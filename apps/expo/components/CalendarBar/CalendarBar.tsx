import { cn } from "@/utils/misc";
import { CalendarBarButton } from "../CalendarBarButton/CalendarBarButton";

import SvgB022 from "../ui/SvgIcons/B022";
import SvgB021 from "../ui/SvgIcons/B021";
import { LIVE_BUTTON_LABEL } from "@/utils/constants";
import { ScrollView, View } from "react-native";
import { Text } from "../ui/text";
import { CalendarBarDays } from "../CalendarBarDays/CalendarBarDays";
import { useAtom, useAtomValue } from "jotai";
import {
  calendarBarDaysAtom,
  datePickerAtom,
  selectedDateAtom,
  selectedDateIndexAtom,
} from "@/store/datepicker-store";
import { formatDateBasedOnTimezone } from "@/hooks/formatTimezone";
import { useTimeZone } from "@/context/timezone-context";
import { useLocalSearchParams, usePathname } from "expo-router";
import { router } from "expo-router";
import { CalendarBarDay } from "../CalendarBarDay/CalendarBarDay";
// const calculateTransitionSpeed = (
//   index: number,
//   previousIndex: number,
//   isLive: boolean,
// ) => {
//   return `${
//     index >= 0 && index <= 6
//       ? 0.1 * Math.abs(previousIndex! - (isLive ? 6 : Math.abs(index)))
//       : 0
//   }s`;
// };

// const calculateOpacity = (index: number) => {
//   return index >= 0 && index <= 6 ? 1 : 0;
// };

// const calculateTranslateAmount = (
//   index: number,
//   isPrevious: boolean,
//   isLive: boolean,
// ) => {
//   return `calc((100%/7) * ${
//     isLive ? 6 : index >= 0 && index <= 6 ? Math.abs(index + 1) : 2
//   } * 7`;
// };

// const CalendarGradient = ({
//   index,
//   previousIndex,
//   isLive,
// }: {
//   index: number;
//   previousIndex: number;
//   isLive: boolean;
// }) => {
//   const translateXAmount = calculateTranslateAmount(index, true, isLive);
//   const transitionAmount = calculateTransitionSpeed(
//     index,
//     previousIndex!,
//     isLive,
//   );
//   const opacityAmount = calculateOpacity(index);
//   return (
//     <View
//       className={cn(
//         `absolute left-0 top-0 z-10 h-full w-[calc(100%_/_7)] translate-x-[300%] bg-gra-02`,
//       )}
//       style={{
//         transform: `translateX(${translateXAmount})`,
//         opacity: opacityAmount,
//       }}
//     ></View>
//   );
// };

export const CalendarBar = ({ children }: any) => {
  // const navigate = useNavigate()
  // const location = useLocation()
  const pathname = usePathname();
  const { timeZone } = useTimeZone();
  const isLive = pathname.includes("live");
  const [datePicker, setDatePicker] = useAtom(datePickerAtom);
  const selectedDate = useAtomValue(selectedDateAtom);
  const [selectedDateIndex, previousSelectedDateIndex] = useAtomValue<any>(
    selectedDateIndexAtom,
  );

  const calendarBarDays = useAtomValue(calendarBarDaysAtom);

  const onPressSelectDate = (day: string) => {
    setDatePicker({
      ...datePicker,
      selectedDate: formatDateBasedOnTimezone(new Date(day), timeZone!),
      selectedDateIndex: calendarBarDays && calendarBarDays?.indexOf(day)!,
    });
  };

  const handlePressOnLive = (timezone: string) => {
    if (isLive) {
      setDatePicker({
        ...datePicker,
        selectedDateIndex: 2,
        selectedDate: formatDateBasedOnTimezone(new Date(), timezone),
      });
      router.navigate(`?date=${selectedDate}`);
    } else {
      setDatePicker({
        ...datePicker,
        selectedDateIndex: 5,
        selectedDate: formatDateBasedOnTimezone(new Date(), timezone),
      });
      router.navigate(`?date=live`);
    }
  };

  return (
    <ScrollView 
      horizontal
      showsHorizontalScrollIndicator={false}
      className="dark:bg-neu-11 dark:shadow-sha-06 flex h-48 box-border flex-row bg-neu-01 shadow-sha-01"
      contentContainerStyle={{ flex: 1 }}
    >
      <CalendarBarButton
        icon={<SvgB022 width={24} height={24} className="text-m-01" />}
        onPress={() => {}}
      />
      {children}
      <CalendarBarButton
        state={!!isLive}
        label={LIVE_BUTTON_LABEL}
        icon={<SvgB021 width={24} height={24} className="text-m-01" />}
        onPress={() => handlePressOnLive(timeZone!)}
      />
    </ScrollView>
  );
};

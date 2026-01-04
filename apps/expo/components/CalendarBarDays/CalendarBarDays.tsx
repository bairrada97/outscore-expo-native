import { memo } from "react";
import { CalendarBarDay } from "../CalendarBarDay/CalendarBarDay";
import { View } from "react-native";
import {
  calendarBarDaysAtom,
  datePickerAtom,
  IDatePickerState,
} from "@/store/datepicker-store";
import { useAtom, useAtomValue } from "jotai";
import { formatDateBasedOnTimezone } from "@/hooks/formatTimezone";
import { useTimeZone } from "@/context/timezone-context";

export const CalendarBarDays = ({ days }: { days: string[] }) => {
  const { timeZone } = useTimeZone();

  const [datePicker, setDatePicker] = useAtom(datePickerAtom);
  const calendarBarDays = useAtomValue(calendarBarDaysAtom);

  const onPressSelectDate = (day: string) => {
    setDatePicker({
      ...datePicker,
      selectedDate: formatDateBasedOnTimezone(new Date(day), timeZone!),
      selectedDateIndex: calendarBarDays && calendarBarDays?.indexOf(day)!,
    });
  };

  return (
    <View className="dark:border-l-neu-10 dark:border-r-neu-10 flex flex-5 cursor-pointer flex-row items-center border-l-[1px] border-r-[1px] border-l-neu-05 border-r-neu-05">
      {days?.map((day, index) => {
        return (
          <CalendarBarDay
            key={index}
            data-index={index}
            day={day}
            onPress={() => onPressSelectDate(day)}
          />
        );
      })}
    </View>
  );
};

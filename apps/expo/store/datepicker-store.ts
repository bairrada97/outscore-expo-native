import { formatDateBasedOnTimezone } from "@/hooks/formatTimezone";
import { USER_TIMEZONE } from "@/utils/constants";
import { atom, createStore } from "jotai";
import { selectAtom } from "jotai/utils";

export interface Calendar {
  currentMonth?: number;
  currentYear?: number;
  currentMonthName?: string;
  getMonth?: number;
  lastDayOfMonth?: number;
  lastDayOfPreviousMonth?: number;
  startDay?: number;
  endDay?: number;
  isSelected?: boolean;
}

export type DatePickerState = {
  weekNames: string[];
  calendarBarDaysState: string[];
  today: Date;
  todaysDate: string;
  selectedDate: string;
  selectedDateIndex: number;
  timezone: string;
  calendarMonths: Calendar[];
  isCalendarOpen: boolean;
  isCalendarInitialized: boolean;
};

export type SetState = {
  setTodaysDate?: (todaysDate: string | Date) => void;
  setCalendarBarDaysState?: () => void;
  setDate: (day: Date) => void;
  selectDateIndex: (index: number) => void;
  setTimezone: (timezone: string) => void;
  setCalendarMonths: (calendar: Calendar[]) => void;
  setCalendarOpen: (isCalendarOpen: boolean) => void;
  setCalendarInitialized: (setCalendarInitialized: boolean) => void;
  resetDate: () => void;
};

export const datePickerStore = createStore();

const initialState: DatePickerState = {
  weekNames: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  today: new Date(),
  todaysDate: formatDateBasedOnTimezone(
    new Date(),
    Intl.DateTimeFormat().resolvedOptions().timeZone || USER_TIMEZONE,
  ),
  calendarBarDaysState: [
    formatDateBasedOnTimezone(
      new Date(new Date().setDate(new Date().getDate() - 2)),
      Intl.DateTimeFormat().resolvedOptions().timeZone || USER_TIMEZONE,
    ),
    formatDateBasedOnTimezone(
      new Date(new Date().setDate(new Date().getDate() - 1)),
      Intl.DateTimeFormat().resolvedOptions().timeZone || USER_TIMEZONE,
    ),
    formatDateBasedOnTimezone(
      new Date(new Date().setDate(new Date().getDate())),
      Intl.DateTimeFormat().resolvedOptions().timeZone || USER_TIMEZONE,
    ),
    formatDateBasedOnTimezone(
      new Date(new Date().setDate(new Date().getDate() + 1)),
      Intl.DateTimeFormat().resolvedOptions().timeZone || USER_TIMEZONE,
    ),
    formatDateBasedOnTimezone(
      new Date(new Date().setDate(new Date().getDate() + 2)),
      Intl.DateTimeFormat().resolvedOptions().timeZone || USER_TIMEZONE,
    ),
  ],
  selectedDate: formatDateBasedOnTimezone(
    new Date(),
    Intl.DateTimeFormat().resolvedOptions().timeZone || USER_TIMEZONE,
  ),
  selectedDateIndex: 2,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || USER_TIMEZONE,
  calendarMonths: [{}, {}, {}],
  isCalendarOpen: false,
  isCalendarInitialized: false,
};

export type IDatePickerState = DatePickerState & SetState;

export const datePickerAtom = atom(initialState);

datePickerStore.set(datePickerAtom, initialState);

export const todaysDateAtom = selectAtom(
  datePickerAtom,
  (state) => state.todaysDate,
);
export const calendarBarDaysAtom = selectAtom(
  datePickerAtom,
  (state) => state.calendarBarDaysState,
);
export const selectedDateAtom = selectAtom(
  datePickerAtom,
  (state) => state.selectedDate,
);
export const selectedDateIndexAtom = selectAtom(
  datePickerAtom,
  (state, prevSlice) => {
    return [state.selectedDateIndex, prevSlice] as [number, number];
  },
);
export const timezoneAtom = selectAtom(
  datePickerAtom,
  (state) => state.timezone,
);
export const calendarMonthsAtom = selectAtom(
  datePickerAtom,
  (state) => state.calendarMonths,
);
export const calendarOpenAtom = selectAtom(
  datePickerAtom,
  (state) => state.isCalendarOpen,
);
export const calendarInitializedAtom = selectAtom(
  datePickerAtom,
  (state) => state.isCalendarInitialized,
);

// const resetDateATom = selectAtom(datePickerAtom, (state) => state.resetDate);

// export const initializeDatePickerStore = (
//   preloadState?: Partial<DatePickerState>
// ) => {
//   return create(
//     combine<Partial<DatePickerState>, SetState>(
//       { ...initialState, ...preloadState },
//       (set) => ({
//         setTodaysDate: (day) =>
//           set((state) => ({
//             ...state,
//             todaysDate: formatDateBasedOnTimezone(
//               new Date(day),
//               state.timezone
//             ),
//             selectedDateIndex:
//               new Date(state.todaysDate!).getDate() -
//               new Date(state.selectedDate!).getDate(),
//           })),
//         setCalendarBarDaysState: () =>
//           set((state) => ({
//             ...state,
//             calendarBarDaysState: [
//               formatDateBasedOnTimezone(
//                 new Date(new Date().setDate(new Date().getDate() - 2)),
//                 state.timezone
//               ),
//               formatDateBasedOnTimezone(
//                 new Date(new Date().setDate(new Date().getDate() - 1)),
//                 state.timezone
//               ),
//               formatDateBasedOnTimezone(
//                 new Date(new Date().setDate(new Date().getDate())),
//                 state.timezone
//               ),
//               formatDateBasedOnTimezone(
//                 new Date(new Date().setDate(new Date().getDate() + 1)),
//                 state.timezone
//               ),
//               formatDateBasedOnTimezone(
//                 new Date(new Date().setDate(new Date().getDate() + 2)),
//                 state.timezone
//               ),
//             ],
//           })),
//         setDate: (day) =>
//           set((state) => ({
//             ...state,
//             selectedDate: formatDateBasedOnTimezone(day, state.timezone),
//           })),
//         selectDateIndex: (index) =>
//           set((state) => ({
//             ...state,
//             selectedDateIndex: index,
//           })),
//         setTimezone: (timezone) =>
//           set((state) => ({
//             ...state,
//             timezone: timezone,
//           })),
//         setCalendarMonths: (calendar) =>
//           set((state) => ({
//             ...state,
//             calendarMonths: calendar,
//           })),
//         setCalendarOpen: (isCalendarOpen) =>
//           set((state) => ({
//             ...state,
//             isCalendarOpen,
//           })),
//         setCalendarInitialized: (isCalendarInitialized) =>
//           set((state) => ({
//             ...state,
//             isCalendarInitialized,
//           })),
//         resetDate: () =>
//           set((state) => ({
//             ...state,
//             selectedDate: formatDateBasedOnTimezone(
//               state.today!,
//               state.timezone
//             ),
//           })),
//       })
//     )
//   );
// };

// export function useCreateDatePickerStore(initialState?: DatePickerState) {
//   // For SSR & SSG, always use a new store.
//   if (typeof window === "undefined") {
//     return () => initializeDatePickerStore(initialState);
//   }

//   // const [cookie] = useCookie("timezone", null);

//   // And if initialState changes, then merge states in the next render cycle.
//   //
//   // eslint complaining "React Hooks must be called in the exact same order in every component render"
//   // is ignorable as this code runs in same order in a given environment
//   // eslint-disable-next-line react-hooks/rules-of-hooks
//   store = store ?? initializeDatePickerStore(initialState);

//   useLayoutEffect(() => {
//     if (initialState && store) {
//       store.setState({
//         ...store.getState(),
//         ...initialState,
//       });
//     }
//   }, [initialState]);

//   return () => store;
// }

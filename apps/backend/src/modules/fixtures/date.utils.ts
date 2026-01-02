import { format } from 'date-fns';


export const getCurrentUtcDateString = (): string => {
  const now = new Date();
  const utcNow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return format(utcNow, 'yyyy-MM-dd');
};


export const normalizeToUtcDate = (dateStr?: string): string => {
  if (!dateStr) {
    return getCurrentUtcDateString();
  }
  return dateStr.trim();
};


export const getUtcDateInfo = (date: string): {
  utcToday: string;
  yesterdayStr: string;
  tomorrowStr: string;
  isToday: boolean;
  isYesterday: boolean;
  isTomorrow: boolean;
  isInThreeDayWindow: boolean;
  isPast: boolean;
  isFuture: boolean;
} => {
  const now = new Date();
  const utcNow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const utcToday = format(utcNow, 'yyyy-MM-dd');

  // Calculate yesterday and tomorrow in UTC
  const utcYesterday = new Date(utcNow);
  utcYesterday.setDate(utcNow.getDate() - 1);
  const yesterdayStr = format(utcYesterday, 'yyyy-MM-dd');

  const utcTomorrow = new Date(utcNow);
  utcTomorrow.setDate(utcNow.getDate() + 1);
  const tomorrowStr = format(utcTomorrow, 'yyyy-MM-dd');

  const isToday = date === utcToday;
  const isYesterday = date === yesterdayStr;
  const isTomorrow = date === tomorrowStr;
  const isInThreeDayWindow = isToday || isYesterday || isTomorrow;
  const isPast = date < utcToday;
  const isFuture = date > utcToday;

  return {
    utcToday,
    yesterdayStr,
    tomorrowStr,
    isToday,
    isYesterday,
    isTomorrow,
    isInThreeDayWindow,
    isPast,
    isFuture,
  };
};


export const getAdjacentDate = (date: string, offsetDays: number): string => {
  // Parse yyyy-MM-dd as UTC to avoid timezone issues
  const [year, month, day] = date.split('-').map(Number);
  const dateObj = new Date(Date.UTC(year, month - 1, day + offsetDays));
  return format(dateObj, 'yyyy-MM-dd');
};


import { format } from "date-fns";

/**
 * Hook for date formatting utilities
 */
export function useDatePicker() {
	const getDateInHoursAndMinutes = (
		date: string | number,
		timezone: string,
	): string => {
		const dateObj = typeof date === "string" ? new Date(date) : new Date(date);

		try {
			// Format date in the specified timezone
			return new Intl.DateTimeFormat("en-US", {
				hour: "numeric",
				minute: "numeric",
				timeZone: timezone,
			}).format(dateObj);
		} catch {
			// Fallback to local time if timezone is invalid
			return format(dateObj, "HH:mm");
		}
	};

	const numericDay = (date: Date): string => {
		return format(date, "d");
	};

	const weekDayShort = (date: Date): string => {
		return format(date, "EEE");
	};

	return {
		getDateInHoursAndMinutes,
		numericDay,
		weekDayShort,
	};
}


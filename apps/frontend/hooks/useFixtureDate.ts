import { DEFAULT_TIMEZONE } from "@/utils/constants";
import { useDatePicker } from "./useDatePicker";
import { queryToTimezone } from "@/utils/format-timezone";
import { useTimeZone } from "@/context/timezone-context";

export function useFixtureDate() {
	const { getDateInHoursAndMinutes } = useDatePicker();
	const { timeZone } = useTimeZone();

	const fixtureStartingTime = (timestamp: number): string => {
		const date = new Date(timestamp * 1000);
		const hours = date.getHours();
		const minutes = date.getMinutes();

		const formattedHours = hours < 10 ? `0${hours}` : hours.toString();
		const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes.toString();

		return `${formattedHours}:${formattedMinutes}`;
	};

	const fixtureInHours = (date: string): string => {
		return new Intl.DateTimeFormat("en-US", {
			hour: "numeric",
			minute: "numeric",
		}).format(new Date(date));
	};

	const fixtureDay = (date: string | number): string => {
		const day = new Date(date).getDate();
		return day < 10 ? `0${day}` : day.toString();
	};

	const fixtureMonth = (date: string | number): string => {
		const month = new Date(date).getMonth() + 1;
		return month < 10 ? `0${month}` : month.toString();
	};

	const fixtureYear = (date: string | number): string => {
		const currentYear = new Date().getFullYear();
		const year = new Date(date).getFullYear();
		return currentYear !== year ? year.toString() : "";
	};

	function fixtureInDays(date: string | number): string {
		const today = new Date();
		const differenceInTime = new Date(date).getTime() - today.getTime();
		const differenceInDays = differenceInTime / (1000 * 3600 * 24);
		const differenceInHours = differenceInTime / (1000 * 3600);
		const isToday = today.toDateString() === new Date(date).toDateString();

		if (Math.floor(differenceInDays) <= 5) {
			const daysLeft = Math.floor(differenceInDays);
			let daysLeftText = "";

			if (!isToday && daysLeft < 1) {
				daysLeftText = `in ${Math.floor(differenceInHours)}h `;
			} else {
				if (daysLeft) {
					daysLeftText = `${daysLeft} ${daysLeft > 1 ? "days " : "day "}`;
				} else {
					daysLeftText = "";
				}
			}

			return (
				daysLeftText +
				getDateInHoursAndMinutes(
					date,
					queryToTimezone(timeZone) || queryToTimezone(DEFAULT_TIMEZONE),
				)
			);
		} else {
			return fixtureDate(date);
		}
	}

	const fixtureDate = (date: string | number): string => {
		return `${fixtureDay(date)}.${fixtureMonth(date)} ${fixtureYear(date)}`.trim();
	};

	return {
		fixtureStartingTime,
		fixtureDate,
		fixtureInDays,
		fixtureInHours,
	};
}


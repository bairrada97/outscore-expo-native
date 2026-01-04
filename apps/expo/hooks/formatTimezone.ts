import { LOCALE } from "@/utils/constants"


export const queryToTimezone = (timezone: string) => {
	return timezone.split('-').join('/')
}

export const timezoneToQuery = (timezone: string) => {
	return timezone.split('/').join('-').toLocaleLowerCase()
}

export const formatDateBasedOnTimezone = (date: Date, timezone?: string) => {
	const formatter = new Intl.DateTimeFormat(LOCALE, {
		timeZone: queryToTimezone(timezone!),
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	})
	return formatter.format(date)
}
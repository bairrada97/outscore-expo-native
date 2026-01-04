

import { LOCALE } from '@/utils/constants'
import { formatDateBasedOnTimezone } from './formatTimezone'

export const useDatePicker = () => {
	const TODAY = 'Today'

	const formatDateToDash = (date: string) => {
		const receivedDate = date.split('/')
		const newDate =
			receivedDate[1] + '/' + receivedDate[0] + '/' + receivedDate[2]

		return new Date(newDate)
	}

	const numericDay = (date: Date) => {
		return date.toLocaleDateString(LOCALE, { day: 'numeric' })
	}

	const isTodayDate = (date: Date) => {
		return new Date(date).toDateString() === new Date().toDateString()
	}

	const weekDayShort = (date: Date) => {
		return isTodayDate(date)
			? TODAY
			: date.toLocaleDateString('en-GB', { weekday: 'short' })
	}

	const getDateInHoursAndMinutes = (
		date: string | number,
		timezone: string,
	) => {
		const formatter = new Intl.DateTimeFormat('en-GB', {
			timeZone: timezone,
			hour: 'numeric',
			minute: 'numeric',
		})

		return formatter.format(new Date(date))
	}

	const formattedShortDate = (dateString: string) => {
		const date = new Date(dateString)
		return new Intl.DateTimeFormat('en-GB', {
			weekday: 'short',
			day: 'numeric',
			month: 'short',
			year: 'numeric',
		}).format(date)
	}

	const formatMatchDate = ({
		matchDate,
		timezone,
	}: {
		matchDate: string
		timezone: string
	}) => {
		const today = formatDateBasedOnTimezone(new Date(), timezone!)
		let tomorrow: Date | string = new Date(today)
		let yesterday: Date | string = new Date(today)

		tomorrow = formatDateBasedOnTimezone(
			new Date(tomorrow.setDate(tomorrow.getDate() + 1)),
			timezone!,
		)

		yesterday = formatDateBasedOnTimezone(
			new Date(yesterday.setDate(yesterday.getDate() - 1)),
			timezone!,
		)

		let formattedMatchDateByString = formatDateBasedOnTimezone(
			new Date(matchDate),
			timezone!,
		)

		switch (formattedMatchDateByString) {
			case today:
				return (formattedMatchDateByString = 'Today')

			case tomorrow:
				return (formattedMatchDateByString = 'Tomorrow')

			case yesterday:
				return (formattedMatchDateByString = 'Yesterday')
		}

		return formattedMatchDateByString
	}

	return {
		formatDateToDash,
		formattedShortDate,
		numericDay,
		weekDayShort,
		getDateInHoursAndMinutes,
		formatMatchDate,
	}
}
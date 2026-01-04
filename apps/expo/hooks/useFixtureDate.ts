
import { DEFAULT_TIMEZONE } from '@/utils/constants'
import { useDatePicker } from './useDatePicker'
import { queryToTimezone } from './formatTimezone'
import { useTimeZone } from '@/context/timezone-context'

export const useFixtureDate = () => {
	const { getDateInHoursAndMinutes } = useDatePicker()
  const { timeZone } = useTimeZone();

	//const [timezone] = useCookie('timezone', '')

	const fixtureStartingTime = (timestamp: number) => {
		let hours: string | number = new Date(timestamp * 1000).getHours()
		let minutes: string | number = new Date(timestamp * 1000).getMinutes()

		hours = hours < 10 ? '0' + hours : hours
		minutes = minutes < 10 ? '0' + minutes : minutes

		return hours + ':' + minutes
	}

	const fixtureInHours = (date: string) => {
		return new Intl.DateTimeFormat('en-US', {
			hour: 'numeric',
			minute: 'numeric',
		}).format(new Date(date))
	}

	const fixtureDay = (date: string | number) =>
		(new Date(date).getDate() < 10 ? '0' : '') + new Date(date).getDate()

	const fixtureMonth = (date: string | number) => {
		let month = new Date(date).getMonth() + 1
		return month < 10 ? '0' + month : '' + month
	}

	const fixtureYear = (date: string | number) => {
		let currentYear = new Date().getFullYear()
		let year = new Date(date).getFullYear()
		return currentYear != year ? year : ''
	}

	function fixtureInDays(date: string | number) {
		const today = new Date()
		const differenceInTime = new Date(date).getTime() - today.getTime()
		const differenceInDays = differenceInTime / (1000 * 3600 * 24)
		const differenceInHours = differenceInTime / (1000 * 3600)
		const isToday = today.toDateString() == new Date(date).toDateString()

		if (Math.floor(differenceInDays) <= 5) {
			const daysLeft = Math.floor(differenceInDays)
			let daysLeftText
			if (!isToday && daysLeft < 1) {
				daysLeftText = `in ${Math.floor(differenceInHours)}h `
			} else {
				if (daysLeft) {
					daysLeftText = `${daysLeft} ${daysLeft > 1 ? ' days ' : ' day '}`
				} else {
					daysLeftText = ''
				}
			}
			return (
				daysLeftText +
				getDateInHoursAndMinutes(
					date!,
					queryToTimezone(timeZone!) || queryToTimezone(DEFAULT_TIMEZONE!),
				)
			)
		} else {
			return fixtureDate(date!)
		}
	}

	const fixtureDate = (date: string | number) => {
		return fixtureDay(date) + '.' + fixtureMonth(date) + ' ' + fixtureYear(date)
	}

	return {
		fixtureStartingTime,
		fixtureDate,
		fixtureInDays,
		fixtureInHours,
	}
}

import { FixtureStatus } from "@/utils/outscore-repository"
import { useDatePicker } from "./useDatePicker"
import { useFixtureDate } from "./useFixtureDate"
import { FIXTURE_HALF_TIME, FIXTURE_HAVE_NOT_STARTED, FIXTURE_IS_FINISHED_STATUS, FIXTURE_IS_LIVE_STATUS, FIXTURE_WILL_NOT_START_STATUS } from "@/utils/fixturesStatusConstants"
import { H2H } from "@/utils/constants"



interface FixtureStatusShort {
	isLive: boolean
	isFinished: boolean
	willNotStart: boolean
	haveNotStarted: boolean
}

interface FixtureStatusProps {
	status?: FixtureStatus
	date?: string | number
	type?: 'H2H' | 'favorite-team' | null
	timezone: string
}

export const useFixtureStatus = ({
	status,
	date,
	timezone,
	type = null,
}: FixtureStatusProps) => {
	const { getDateInHoursAndMinutes } = useDatePicker()
	const { fixtureDate, fixtureInDays } = useFixtureDate()

	const currentFixtureStatus = status?.short
	const fixtureStatus: FixtureStatusShort = {
		isLive: FIXTURE_IS_LIVE_STATUS.includes(currentFixtureStatus!),
		isFinished: FIXTURE_IS_FINISHED_STATUS.includes(currentFixtureStatus!),
		willNotStart: FIXTURE_WILL_NOT_START_STATUS.includes(currentFixtureStatus!),
		haveNotStarted: FIXTURE_HAVE_NOT_STARTED == currentFixtureStatus,
	}

	const isH2H = type == H2H
	const isFavoriteTeam = type === 'favorite-team'

	const renderFixtureStatus = () => {
		const state = {
			live:
				currentFixtureStatus == FIXTURE_HALF_TIME
					? currentFixtureStatus
					: currentFixtureStatus == 'P' ||
						  currentFixtureStatus == 'BT' ||
						  currentFixtureStatus == 'INT'
						? currentFixtureStatus
						: status?.elapsed + '’',
			preOrPostFixture: fixtureStatus.haveNotStarted
				? getDateInHoursAndMinutes(date!, timezone)
				: currentFixtureStatus,
			h2h:
				fixtureStatus.isFinished || fixtureStatus.haveNotStarted
					? fixtureDate(date!)
					: currentFixtureStatus,
			isFavoriteTeam: fixtureStatus.haveNotStarted
				? fixtureInDays(date!)
				: currentFixtureStatus,
		}

		if (fixtureStatus.isLive) return state.live
		else if (isH2H) return state.h2h
		else if (isFavoriteTeam) return state.isFavoriteTeam
		else return state.preOrPostFixture
	}

	return {
		renderFixtureStatus,
		fixtureStatus,
	}
}
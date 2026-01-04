import { H2H } from "@/utils/constants";
import {
	FIXTURE_HALF_TIME,
	FIXTURE_HAVE_NOT_STARTED,
	FIXTURE_IS_FINISHED_STATUS,
	FIXTURE_IS_LIVE_STATUS,
	FIXTURE_WILL_NOT_START_STATUS,
} from "@/utils/fixtures-status-constants";
import type { FixtureStatusShort } from "@outscore/shared-types";
import { useDatePicker } from "./useDatePicker";
import { useFixtureDate } from "./useFixtureDate";

interface FixtureStatus {
	short: FixtureStatusShort;
	elapsed: number | null;
}

interface FixtureStatusState {
	isLive: boolean;
	isFinished: boolean;
	willNotStart: boolean;
	haveNotStarted: boolean;
}

interface UseFixtureStatusProps {
	status?: FixtureStatus;
	date?: string | number;
	time?: string;
	type?: "H2H" | "favorite-team" | null;
	timezone: string;
}

/**
 * Hook to determine fixture status and render status text
 */
export function useFixtureStatus({
	status,
	date,
	time,
	timezone,
	type = null,
}: UseFixtureStatusProps) {
	const { getDateInHoursAndMinutes } = useDatePicker();
	const { fixtureDate, fixtureInDays } = useFixtureDate();

	const currentFixtureStatus = status?.short;
	const fixtureStatus: FixtureStatusState = {
		isLive: currentFixtureStatus
			? FIXTURE_IS_LIVE_STATUS.includes(currentFixtureStatus)
			: false,
		isFinished: currentFixtureStatus
			? FIXTURE_IS_FINISHED_STATUS.includes(currentFixtureStatus)
			: false,
		willNotStart: currentFixtureStatus
			? FIXTURE_WILL_NOT_START_STATUS.includes(currentFixtureStatus)
			: false,
		haveNotStarted: FIXTURE_HAVE_NOT_STARTED === currentFixtureStatus,
	};

	const isH2H = type === H2H;
	const isFavoriteTeam = type === "favorite-team";

	const renderFixtureStatus = (): string | null => {
		if (!currentFixtureStatus) return null;

		const state = {
			live:
				currentFixtureStatus === FIXTURE_HALF_TIME
					? currentFixtureStatus
					: currentFixtureStatus === "P" ||
							currentFixtureStatus === "BT" ||
							currentFixtureStatus === "INT"
						? currentFixtureStatus
						: status && status.elapsed !== null && status.elapsed !== undefined
							? `${status.elapsed}'`
							: "LIVE",
			preOrPostFixture: fixtureStatus.haveNotStarted
				? time || (date ? getDateInHoursAndMinutes(date, timezone) : null)
				: currentFixtureStatus,
			h2h:
				fixtureStatus.isFinished || fixtureStatus.haveNotStarted
					? date
						? fixtureDate(date)
						: null
					: currentFixtureStatus,
			isFavoriteTeam: fixtureStatus.haveNotStarted
				? date
					? fixtureInDays(date)
					: null
				: currentFixtureStatus,
		};

		if (fixtureStatus.isLive) return state.live;
		if (isH2H) return state.h2h;
		if (isFavoriteTeam) return state.isFavoriteTeam;
		return state.preOrPostFixture;
	};

	return {
		renderFixtureStatus,
		fixtureStatus,
	};
}

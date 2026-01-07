export const FIXTURE_WILL_NOT_START_STATUS = [
	'CANC',
	'PST',
	'ABD',
	'WO',
	'INT',
	'TBD',
	'NS',
]
export const FIXTURE_SHORT_NAMES_STATUS = [
	'CANC',
	'PST',
	'ABD',
	'WO',
	'FT',
	'HT',
	'INT',
	'PEN',
	'AET',
	'TBD',
	'BT',
	'P',
]

// Live match statuses (for polling/refetch logic)
export const FIXTURE_IS_LIVE_STATUS = ['LIVE', '1H', '2H', 'HT', 'ET', 'INT', 'BT', 'P']

// Finished match statuses (for stopping polling)
export const FIXTURE_IS_FINISHED_STATUS = ['FT', 'AET', 'PEN', 'PST', 'CANC', 'ABD', 'AWD', 'WO']

export const FIXTURE_HAVE_NOT_STARTED = 'NS'
export const FIXTURE_FINISHED = 'FT'
export const FIXTURE_HALF_TIME = 'HT'
export const FIXTURE_PENALTY_SHOOTOUT = 'PEN'
export const FIXTURE_PENALTY = 'P'
export const FIXTURE_BREAK_TIME = 'BT'
export const FIXTURE_INTERRUPTED = 'INT'
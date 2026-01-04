export const LOCALE = 'fr-CA'
export const DEFAULT_TIMEZONE = 'europe/amsterdam'
export const LIVE_BUTTON_LABEL = 'Live'
export const ONE_DAY_CACHE = 86400000
export const FIFTEEN_SECONDS_CACHE = 15000
export const ONE_MINUTE_CACHE = 60000
export const SECONDS_UNTIL_END_OF_THE_DAY =
	86400 - (Math.floor(new Date().getTime() / 1000) % 86400)
export const OVERVIEW = 'Overview'
export const LINEUPS = 'Lineups'
export const STATISTICS = 'Statistics'
export const BETSHELPER = 'BetsHelper'
export const H2H = 'H2H'
export const STANDINGS = 'Standings'
export const MATCHES = 'Matches'
export const TEAMS = 'Teams'
export const LEAGUES = 'Leagues'
export const PLAYERS = 'Players'
export const DARK_THEME = 'dark'
export const LIGHT_THEME = 'light-theme'
export const USER_TIMEZONE =
	Intl.DateTimeFormat().resolvedOptions().timeZone != 'UTC'
		? Intl.DateTimeFormat().resolvedOptions().timeZone
		: DEFAULT_TIMEZONE
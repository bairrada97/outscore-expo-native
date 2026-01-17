import type { FixtureStatusShort } from "@outscore/shared-types";
import { FIXTURE_STATUS } from "@outscore/shared-types";

/**
 * Single source of truth for `fixture.status.short` classification lives in `@outscore/shared-types`.
 * This file keeps the existing frontend export names to avoid large refactors.
 */

// Statuses that mean the fixture will NOT be played (cancellation/postponement/etc)
// NOTE: Do NOT include 'NS' (not started yet) or 'INT'/'SUSP' (can resume).
export const FIXTURE_WILL_NOT_START_STATUS = [
	...FIXTURE_STATUS.CANCELLED,
] as readonly string[];

// Statuses we might show as short labels (instead of minutes)
export const FIXTURE_SHORT_NAMES_STATUS = [
	...FIXTURE_STATUS.CANCELLED,
	...FIXTURE_STATUS.FINISHED,
	...FIXTURE_STATUS.LIVE,
	...FIXTURE_STATUS.NOT_STARTED,
] as readonly string[];

// Live match statuses (for polling/refetch logic)
export const FIXTURE_IS_LIVE_STATUS = [...FIXTURE_STATUS.LIVE] as readonly string[];

// Finished match statuses (for stopping polling)
export const FIXTURE_IS_FINISHED_STATUS = [...FIXTURE_STATUS.FINISHED] as readonly string[];

export const FIXTURE_HAVE_NOT_STARTED = FIXTURE_STATUS.NOT_STARTED[0]; // 'NS'
export const FIXTURE_FINISHED = FIXTURE_STATUS.FINISHED[0]; // 'FT'
export const FIXTURE_HALF_TIME = "HT";
export const FIXTURE_PENALTY_SHOOTOUT = "PEN";
export const FIXTURE_PENALTY = "P";
export const FIXTURE_BREAK_TIME = "BT";
export const FIXTURE_INTERRUPTED = "INT";

export const FIXTURE_STATUS_LABELS: Partial<
	Record<FixtureStatusShort, string>
> = {
	HT: "Half Time",
	BT: "Break",
	INT: "Interrupted",
	SUSP: "Suspended",
	ET: "Extra Time",
	P: "Penalties",
	FT: "Full Time",
	AET: "After Extra Time",
	PEN: "Penalties",
	AWD: "Awarded",
	CANC: "Cancelled",
	PST: "Postponed",
	ABD: "Abandoned",
	WO: "Walkover",
	TBD: "TBD",
};

export const FIXTURE_HIDE_SCORE_STATUS: readonly FixtureStatusShort[] = [
	"INT",
	"SUSP",
	"CANC",
	"PST",
	"ABD",
	"WO",
];
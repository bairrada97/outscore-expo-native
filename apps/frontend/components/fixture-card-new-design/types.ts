import type { FormattedMatch } from "@outscore/shared-types";

export interface ExtendedFormattedMatch extends FormattedMatch {
	type?: "H2H" | "favorite-team" | null;
}

export type TeamScoredState = {
	home: boolean;
	away: boolean;
};


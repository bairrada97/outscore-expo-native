import { useEffect, useRef, useState } from "react";

const TIME_TO_RESET_GOAL_STYLES = 60_000; // 1 minute
const NO_GOALS = { home: false, away: false };

/**
 * Detects goal scoring for live matches only.
 * Pass null for homeGoals/awayGoals to disable detection (non-live matches).
 * Returns a stable object reference when disabled to prevent re-renders.
 */
export function useGoalDetection(
	homeGoals: number | null,
	awayGoals: number | null,
): { home: boolean; away: boolean } {
	// For non-live matches, return stable reference immediately
	const isDisabled = homeGoals === null || awayGoals === null;

	const [teamScored, setTeamScored] = useState(NO_GOALS);
	const prevHomeRef = useRef<number | null>(null);
	const prevAwayRef = useRef<number | null>(null);

	useEffect(() => {
		if (isDisabled) {
			prevHomeRef.current = null;
			prevAwayRef.current = null;
			return;
		}

		// Detect home goal
		if (prevHomeRef.current !== null && homeGoals > prevHomeRef.current) {
			setTeamScored((prev) => ({ ...prev, home: true }));
			const timer = setTimeout(() => {
				setTeamScored((prev) => ({ ...prev, home: false }));
			}, TIME_TO_RESET_GOAL_STYLES);
			prevHomeRef.current = homeGoals;
			return () => clearTimeout(timer);
		}

		prevHomeRef.current = homeGoals;
	}, [homeGoals, isDisabled]);

	useEffect(() => {
		if (isDisabled) return;

		// Detect away goal
		if (prevAwayRef.current !== null && awayGoals > prevAwayRef.current) {
			setTeamScored((prev) => ({ ...prev, away: true }));
			const timer = setTimeout(() => {
				setTeamScored((prev) => ({ ...prev, away: false }));
			}, TIME_TO_RESET_GOAL_STYLES);
			prevAwayRef.current = awayGoals;
			return () => clearTimeout(timer);
		}

		prevAwayRef.current = awayGoals;
	}, [awayGoals, isDisabled]);

	// Return stable reference for non-live matches
	return isDisabled ? NO_GOALS : teamScored;
}


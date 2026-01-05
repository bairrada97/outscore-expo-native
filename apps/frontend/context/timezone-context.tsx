import { isWeb } from "@/utils/platform";
import { getDeviceTimeZone } from "@/utils/timezone";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState, type AppStateStatus } from "react-native";

interface TimeZoneContextType {
	timeZone: string;
}

const TimeZoneContext = createContext<TimeZoneContextType | null>(null);

// 2 hours in milliseconds
const POLLING_INTERVAL_MS = 2 * 60 * 60 * 1000;

export function TimeZoneProvider({ children }: { children: ReactNode }) {
	const [timeZone, setTimeZone] = useState<string>(getDeviceTimeZone());
	const timeZoneRef = useRef<string>(timeZone);

	// Update ref when timezone changes
	useEffect(() => {
		timeZoneRef.current = timeZone;
	}, [timeZone]);

	useEffect(() => {
		// Check if timezone has changed and update if needed
		const checkTimezoneChange = () => {
			const newTimeZone = getDeviceTimeZone();
			if (newTimeZone !== timeZoneRef.current) {
				setTimeZone(newTimeZone);
			}
		};

		if (isWeb) {
			// Type guards for web APIs - access through globalThis with type assertions
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const doc =
				typeof globalThis !== "undefined" && "document" in globalThis
					? (globalThis as any).document
					: undefined;
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const win =
				typeof globalThis !== "undefined" && "window" in globalThis
					? (globalThis as any).window
					: undefined;

			if (!doc || !win) {
				return;
			}

			// Web: Use visibilitychange and focus events
			const handleVisibilityChange = () => {
				if (doc.visibilityState === "visible") {
					checkTimezoneChange();
				}
			};

			const handleFocus = () => {
				checkTimezoneChange();
			};

			doc.addEventListener("visibilitychange", handleVisibilityChange);
			win.addEventListener("focus", handleFocus);

			// Polling on web using requestIdleCallback
			let idleCallbackId: number | null = null;
			let intervalId: ReturnType<typeof setInterval> | null = null;

			const scheduleIdleCheck = () => {
				if ("requestIdleCallback" in globalThis) {
					type IdleCallback = typeof globalThis & {
						requestIdleCallback: (
							cb: () => void,
							opts?: { timeout: number },
						) => number;
						cancelIdleCallback: (id: number) => void;
					};
					const global = globalThis as IdleCallback;

					idleCallbackId = global.requestIdleCallback(
						() => {
							if (doc && doc.visibilityState === "visible") {
								checkTimezoneChange();
							}
							// Schedule next check
							intervalId = setTimeout(scheduleIdleCheck, POLLING_INTERVAL_MS);
						},
						{ timeout: POLLING_INTERVAL_MS },
					);
				} else {
					// Fallback to setInterval if requestIdleCallback not available
					intervalId = setInterval(() => {
						if (doc && doc.visibilityState === "visible") {
							checkTimezoneChange();
						}
					}, POLLING_INTERVAL_MS);
				}
			};

			scheduleIdleCheck();

			return () => {
				if (doc) {
					doc.removeEventListener("visibilitychange", handleVisibilityChange);
				}
				if (win) {
					win.removeEventListener("focus", handleFocus);
				}

				if (idleCallbackId !== null && "cancelIdleCallback" in globalThis) {
					type IdleCallback = typeof globalThis & {
						cancelIdleCallback: (id: number) => void;
					};
					const global = globalThis as IdleCallback;
					global.cancelIdleCallback(idleCallbackId);
				}

				if (intervalId !== null) {
					clearInterval(intervalId);
				}
			};
		} else {
			// Native: Use AppState listener
			const subscription = AppState.addEventListener(
				"change",
				(nextAppState: AppStateStatus) => {
					if (nextAppState === "active") {
						checkTimezoneChange();
					}
				},
			);

			// Polling on native only when app is active
			let intervalId: ReturnType<typeof setInterval> | null = null;

			const startPolling = () => {
				if (AppState.currentState === "active") {
					intervalId = setInterval(() => {
						if (AppState.currentState === "active") {
							checkTimezoneChange();
						}
					}, POLLING_INTERVAL_MS);
				}
			};

			// Start polling if app is already active
			if (AppState.currentState === "active") {
				startPolling();
			}

			// Restart polling when app becomes active
			const appStateSubscription = AppState.addEventListener(
				"change",
				(nextAppState: AppStateStatus) => {
					if (nextAppState === "active") {
						if (intervalId === null) {
							startPolling();
						}
					} else {
						if (intervalId !== null) {
							clearInterval(intervalId);
							intervalId = null;
						}
					}
				},
			);

			return () => {
				subscription.remove();
				appStateSubscription.remove();
				if (intervalId !== null) {
					clearInterval(intervalId);
				}
			};
		}
	}, []); // Empty deps - we use refs to avoid recreating listeners

	return (
		<TimeZoneContext.Provider value={{ timeZone }}>
			{children}
		</TimeZoneContext.Provider>
	);
}

export function useTimeZone(): TimeZoneContextType {
	const context = useContext(TimeZoneContext);
	if (!context) {
		throw new Error("useTimeZone must be used within a TimeZoneProvider");
	}
	return context;
}

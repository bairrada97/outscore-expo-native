import { useEffect, useState } from "react";

/**
 * Hook to delay a value update
 */
export function useDelay<T>(value: T, delay: number): T {
	const [delayedValue, setDelayedValue] = useState<T>(value);

	useEffect(() => {
		const timer = setTimeout(() => {
			setDelayedValue(value);
		}, delay);

		return () => clearTimeout(timer);
	}, [value, delay]);

	return delayedValue;
}


import { useEffect, useRef } from "react";

/**
 * Hook to track the previous value of a variable
 */
export default function usePrevious<T>(value: T): T | undefined {
	const ref = useRef<T>();

	useEffect(() => {
		ref.current = value;
	}, [value]);

	return ref.current;
}


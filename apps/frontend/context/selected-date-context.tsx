import {
	createContext,
	type ReactNode,
	useContext,
	useMemo,
	useState,
} from "react";

interface SelectedDateContextType {
	selectedDate: string | null;
	setSelectedDate: (date: string | null) => void;
}

const SelectedDateContext = createContext<SelectedDateContextType | null>(null);

export function SelectedDateProvider({ children }: { children: ReactNode }) {
	const [selectedDate, setSelectedDate] = useState<string | null>(null);

	const value = useMemo(
		() => ({ selectedDate, setSelectedDate }),
		[selectedDate],
	);

	return (
		<SelectedDateContext.Provider value={value}>
			{children}
		</SelectedDateContext.Provider>
	);
}

export function useSelectedDate(): SelectedDateContextType {
	const context = useContext(SelectedDateContext);
	if (!context) {
		throw new Error("useSelectedDate must be used within a SelectedDateProvider");
	}
	return context;
}



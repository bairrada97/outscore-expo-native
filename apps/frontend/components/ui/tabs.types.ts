import type { ReactNode } from "react";

export function clamp(n: number, min: number, max: number) {
	return Math.max(min, Math.min(max, n));
}

export type TabsItem = {
	key: string;
	title: string;
	render: () => ReactNode;
};

export const MIN_TAB_WIDTH_PX = 94;

export interface TabsProps {
	tabs: TabsItem[];
	defaultKey?: string;
	activeKey?: string;
	onChangeKey?: (key: string) => void;
	swipeEnabled?: boolean;
	minTabWidthPx?: number;
	containerClassName?: string;
}


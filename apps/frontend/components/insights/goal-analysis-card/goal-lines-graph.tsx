import { useCallback, useMemo, useState } from "react";
import { useColorScheme, View } from "react-native";
import Svg, { Circle, G, Path, Text as SvgText } from "react-native-svg";
import type { GoalSimulation } from "./types";

type GoalLinePoint = {
	line: number;
	over: number;
	under: number;
};

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

function toPointKey(line: number) {
	return String(line);
}

function buildSmoothPath(points: Array<{ x: number; y: number }>) {
	if (points.length === 0) return "";
	if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

	const d: string[] = [`M ${points[0].x} ${points[0].y}`];
	for (let i = 0; i < points.length - 1; i++) {
		const p0 = points[i - 1] ?? points[i];
		const p1 = points[i];
		const p2 = points[i + 1];
		const p3 = points[i + 2] ?? p2;

		// Catmull-Rom to Bezier conversion
		const c1x = p1.x + (p2.x - p0.x) / 6;
		const c1y = p1.y + (p2.y - p0.y) / 6;
		const c2x = p2.x - (p3.x - p1.x) / 6;
		const c2y = p2.y - (p3.y - p1.y) / 6;

		d.push(`C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`);
	}
	return d.join(" ");
}

function getColors(isDark: boolean) {
	return {
		m01: "rgb(24 124 86)",
		m01Light04: "rgb(102 227 167)",
		neu01: "rgb(255 255 255)",
		neu03: "rgb(240 241 241)",
		neu04: "rgb(227 229 228)",
		neu06: "rgb(195 200 198)",
		neu07: "rgb(139 149 145)",
		neu10: "rgb(79 86 84)",
		neu11: "rgb(49 53 52)",
		neu12: "rgb(31 34 32)",
		stroke: isDark ? "rgb(102 227 167)" : "rgb(24 124 86)",
		text: isDark ? "rgb(255 255 255)" : "rgb(79 86 84)",
	};
}

export type GoalLinesGraphProps = {
	simulations: GoalSimulation[];
	selectedLine: number;
	onSelectLine: (line: number) => void;
};

export function GoalLinesGraph({
	simulations,
	selectedLine,
	onSelectLine,
}: GoalLinesGraphProps) {
	const colorScheme = useColorScheme();
	const isDark = colorScheme === "dark";
	const colors = getColors(isDark);

	const data = useMemo<GoalLinePoint[]>(() => {
		return simulations
			.filter((s) => s.scenarioType === "TotalGoalsOverUnder")
			.map((s) => {
				const line = s.line ?? 0;
				const over = s.probabilityDistribution?.over ?? 0;
				const under = s.probabilityDistribution?.under ?? 0;
				return { line, over, under };
			})
			.filter((p) => Number.isFinite(p.line))
			.sort((a, b) => a.line - b.line);
	}, [simulations]);

	const [layoutWidth, setLayoutWidth] = useState(0);
	const height = 120;
	const containerPaddingX = 0;
	const width =
		layoutWidth > 0 ? Math.max(0, layoutWidth - containerPaddingX ) : 320;
	const paddingX = 24;
	const paddingTop = 16;
	const paddingBottom = 16;

	const points = useMemo(() => {
		if (!data.length || width <= 0 || height <= 0) return [];
		const usableW = Math.max(1, width - paddingX * 2);
		const usableH = Math.max(1, height - paddingTop - paddingBottom);

		return data.map((p, idx) => {
			const x =
				data.length === 1
					? paddingX + usableW / 2
					: paddingX + (usableW * idx) / (data.length - 1);
			const y = paddingTop + ((100 - clamp(p.over, 0, 100)) / 100) * usableH;
			return { key: toPointKey(p.line), line: p.line, x, y };
		});
	}, [data, width]);

	const pathD = useMemo(() => buildSmoothPath(points), [points]);

	const handlePress = useCallback(
		(event: { nativeEvent: { locationX: number; locationY: number } }) => {
			if (!points.length) return;
			const { locationX, locationY } = event.nativeEvent;
			let closest = points[0];
			let minDist = Number.POSITIVE_INFINITY;
			for (const point of points) {
				const dist = Math.hypot(point.x - locationX, point.y - locationY);
				if (dist < minDist) {
					minDist = dist;
					closest = point;
				}
			}
			// Generous hit zone so taps inside/near dots register reliably.
			if (minDist <= 48) {
				onSelectLine(closest.line);
			}
		},
		[onSelectLine, points],
	);

	return (
		<View
			onLayout={(e) => setLayoutWidth(e.nativeEvent.layout.width)}
			className="rounded-lg bg-neu-01/70 dark:bg-neu-11/40 py-16"
		>
			<Svg
				width={width}
				height={height}
				onStartShouldSetResponder={() => true}
				onPress={handlePress}
			>
				{/* Curve */}
				<Path
					d={pathD}
					stroke={colors.stroke}
					strokeWidth={4}
					fill="none"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>

				{/* Dots */}
				{points.map((pt) => {
					const isSelected = pt.line === selectedLine;
					const outerR = isSelected ? 22 : 18;
					const innerR = isSelected ? 18 : 14;
					const hitR = isSelected ? 38 : 34;

					const baseFill = isSelected
						? colors.m01
						: isDark
							? colors.neu12
							: colors.neu01;
					const baseStroke = isSelected
						? "rgba(0,0,0,0)"
						: isDark
							? colors.neu11
							: colors.neu04;
					const labelColor = isSelected ? colors.neu01 : colors.text;

					return (
						<G key={pt.key}>
							{/* Hit target (nearly transparent) */}
							<Circle
								cx={pt.x}
								cy={pt.y}
								r={hitR}
								fill="rgba(0,0,0,0.01)"
								pointerEvents="none"
							/>
							{/* Outer subtle halo for selected */}
							{isSelected ? (
								<Circle
									cx={pt.x}
									cy={pt.y}
									r={outerR}
									fill={
										isDark ? "rgba(255,255,255,0.06)" : "rgba(24,124,86,0.12)"
									}
									pointerEvents="none"
								/>
							) : null}
							<Circle
								cx={pt.x}
								cy={pt.y}
								r={innerR}
								fill={baseFill}
								stroke={baseStroke}
								strokeWidth={2}
								pointerEvents="none"
							/>
							<SvgText
								x={pt.x}
								y={pt.y + 4}
								fontSize={12}
								fontWeight={isSelected ? "700" : "600"}
								fill={labelColor}
								textAnchor="middle"
								pointerEvents="none"
							>
								{pt.line}
							</SvgText>
						</G>
					);
				})}
			</Svg>
		</View>
	);
}

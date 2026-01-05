import { Canvas, FitBox, ImageSVG, rect, Skia, type SkSVG } from "@shopify/react-native-skia";
import { memo, useEffect, useMemo, useState } from "react";
import { View } from "react-native";

interface SvgFlagProps {
	uri: string;
	size: number;
}

interface SvgData {
	svg: SkSVG;
	width: number;
	height: number;
}

// Simple in-memory cache for SVG data
const svgCache = new Map<string, SvgData>();

// Parse viewBox or width/height from SVG string
function parseSvgDimensions(svgString: string): { width: number; height: number } {
	const viewBoxMatch = svgString.match(/viewBox=["']([^"']+)["']/);
	if (viewBoxMatch) {
		const parts = viewBoxMatch[1].split(/[\s,]+/).map(Number);
		if (parts.length >= 4) {
			return { width: parts[2], height: parts[3] };
		}
	}
	const widthMatch = svgString.match(/width=["']?(\d+)/);
	const heightMatch = svgString.match(/height=["']?(\d+)/);
	return {
		width: widthMatch ? Number(widthMatch[1]) : 100,
		height: heightMatch ? Number(heightMatch[1]) : 100,
	};
}

// Native: use Skia for GPU-accelerated SVG rendering
export const SvgFlag = memo(function SvgFlag({ uri, size }: SvgFlagProps) {
	const [data, setData] = useState<SvgData | null>(() => svgCache.get(uri) ?? null);

	useEffect(() => {
		// Already have data
		if (data) return;

		// Check cache first
		const cached = svgCache.get(uri);
		if (cached) {
			setData(cached);
			return;
		}

		let cancelled = false;

		fetch(uri)
			.then((res) => res.text())
			.then((svgString) => {
				if (cancelled) return;
				const svg = Skia.SVG.MakeFromString(svgString);
				if (!svg) return;
				const dims = parseSvgDimensions(svgString);
				const result = { svg, ...dims };
				svgCache.set(uri, result);
				setData(result);
			})
			.catch(() => {});

		return () => {
			cancelled = true;
		};
	}, [uri, data]);

	const rects = useMemo(() => {
		if (!data) return null;
		return {
			src: rect(0, 0, data.width, data.height),
			dst: rect(0, 0, size, size),
		};
	}, [data, size]);

	if (!data || !rects) {
		return <View style={{ width: size, height: size }} />;
	}

	return (
		<Canvas style={{ width: size, height: size }}>
			<FitBox src={rects.src} dst={rects.dst} fit="cover">
				<ImageSVG svg={data.svg} width={data.width} height={data.height} />
			</FitBox>
		</Canvas>
	);
});


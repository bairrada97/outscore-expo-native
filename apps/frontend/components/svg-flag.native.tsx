import { Canvas, ImageSVG, Skia } from "@shopify/react-native-skia";
import { useQuery } from "@tanstack/react-query";
import { View } from "react-native";

interface SvgFlagProps {
	uri: string;
	size: number;
}

// Native: use Skia for GPU-accelerated SVG rendering
export function SvgFlag({ uri, size }: SvgFlagProps) {
	const { data: svg } = useQuery({
		queryKey: ["flag-svg", uri],
		queryFn: async () => {
			const response = await fetch(uri);
			const svgString = await response.text();
			return Skia.SVG.MakeFromString(svgString);
		},
		staleTime: Number.POSITIVE_INFINITY,
		gcTime: 1000 * 60 * 60 * 24,
	});

	if (!svg) {
		return <View style={{ width: size, height: size }} />;
	}

	return (
		<Canvas style={{ width: size, height: size }}>
			<ImageSVG svg={svg} width={size} height={size} />
		</Canvas>
	);
}


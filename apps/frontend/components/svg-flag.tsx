import { useQuery } from "@tanstack/react-query";
import { Image, View } from "react-native";

interface SvgFlagProps {
	uri: string;
	size: number;
}

// Web: fetch SVG and cache via react-query, render with img
export function SvgFlag({ uri, size }: SvgFlagProps) {
	const { data: dataUri } = useQuery({
		queryKey: ["flag-svg", uri],
		queryFn: async () => {
			const response = await fetch(uri);
			const svgText = await response.text();
			// Convert to data URI for caching
			return `data:image/svg+xml;base64,${btoa(svgText)}`;
		},
		staleTime: Number.POSITIVE_INFINITY,
		gcTime: 1000 * 60 * 60 * 24,
	});

	if (!dataUri) {
		return <View style={{ width: size, height: size }} />;
	}

	return (
		<Image
			source={{ uri: dataUri }}
			style={{ width: size, height: size }}
			resizeMode="cover"
		/>
	);
}

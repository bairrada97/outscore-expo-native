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
			try {
				const response = await fetch(uri);
				if (!response.ok) {
					throw new Error(`Failed to load flag SVG: ${response.status} ${response.statusText}`);
				}
				const contentType = response.headers.get('content-type');
				if (contentType && !contentType.includes('svg') && !contentType.includes('image/svg+xml')) {
					throw new Error(`Invalid content type for SVG: ${contentType}`);
				}
				const svgText = await response.text();
				const trimmed = svgText.trim();
				// Check if it's a valid SVG (may have XML declaration or whitespace)
				if (!trimmed.includes('<svg')) {
					throw new Error('Invalid SVG format: missing <svg> tag');
				}
				// Convert to data URI for caching
				return `data:image/svg+xml;base64,${btoa(svgText)}`;
			} catch (error) {
				console.error('Failed to load flag SVG', error);
				throw error;
			}
		},
		staleTime: Infinity,
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

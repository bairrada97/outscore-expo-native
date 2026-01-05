import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Image, Platform, View } from "react-native";

interface SvgFlagProps {
	uri: string;
	size: number;
	priority?: "high" | "low"; // For performance: high = load immediately, low = defer
}

// Web: fetch SVG and cache via react-query, render with img
export function SvgFlag({ uri, size, priority = "low" }: SvgFlagProps) {
	// Defer loading for low-priority flags to improve initial page load
	const [shouldLoad, setShouldLoad] = useState(priority === "high");

	useEffect(() => {
		if (priority === "high" || shouldLoad) return;

		// Defer loading low-priority flags until after initial render
		// Use requestIdleCallback on web, or a small timeout as fallback
		if (Platform.OS === "web" && "requestIdleCallback" in globalThis) {
			type IdleCallback = typeof globalThis & {
				requestIdleCallback: (
					cb: () => void,
					opts?: { timeout: number },
				) => number;
				cancelIdleCallback: (id: number) => void;
			};
			const global = globalThis as IdleCallback;
			const idleId = global.requestIdleCallback(() => setShouldLoad(true), {
				timeout: 2000,
			});
			return () => global.cancelIdleCallback(idleId);
		}

		// Fallback: small delay for non-web or if requestIdleCallback unavailable
		const timeoutId = setTimeout(() => setShouldLoad(true), 100);
		return () => clearTimeout(timeoutId);
	}, [priority, shouldLoad]);

	const { data: dataUri } = useQuery({
		queryKey: ["flag-svg", uri],
		queryFn: async () => {
			try {
				const response = await fetch(uri);
				if (!response.ok) {
					throw new Error(
						`Failed to load flag SVG: ${response.status} ${response.statusText}`,
					);
				}
				const contentType = response.headers.get("content-type");
				if (
					contentType &&
					!contentType.includes("svg") &&
					!contentType.includes("image/svg+xml")
				) {
					throw new Error(`Invalid content type for SVG: ${contentType}`);
				}
				const svgText = await response.text();
				const trimmed = svgText.trim();
				// Check if it's a valid SVG (may have XML declaration or whitespace)
				if (!trimmed.includes("<svg")) {
					throw new Error("Invalid SVG format: missing <svg> tag");
				}
				// Convert to data URI for caching
				return `data:image/svg+xml;base64,${btoa(svgText)}`;
			} catch (error) {
				console.error("Failed to load flag SVG", error);
				throw error;
			}
		},
		enabled: shouldLoad, // Only fetch when shouldLoad is true
		staleTime: Infinity,
		gcTime: 1000 * 60 * 60 * 24,
	});

	if (!dataUri) {
		return <View style={{ width: size, height: size }} />;
	}

	// React Native Web's Image component doesn't officially support loading attribute
	// but we can pass it for potential browser optimization
	const imageProps =
		Platform.OS === "web" && priority === "low"
			? { loading: "lazy" as "lazy" | "eager" }
			: {};

	return (
		<Image
			source={{ uri: dataUri }}
			style={{ width: size, height: size }}
			resizeMode="cover"
			{...imageProps}
		/>
	);
}

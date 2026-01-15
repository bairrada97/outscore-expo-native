import type { PropsWithChildren } from "react";

/**
 * This file is web-only and used to configure the root HTML for every web page during static rendering.
 * The contents of this function only run in Node.js environments and do not have access to the DOM or browser APIs.
 */
export default function Root({ children }: PropsWithChildren) {
	return (
		<html lang="en">
			<head>
				<meta charSet="utf-8" />
				<meta httpEquiv="X-UA-Compatible" content="IE=edge" />
				<meta
					name="viewport"
					content="width=device-width, initial-scale=1, shrink-to-fit=no"
				/>

				{/* Resource hints for API - improves connection setup time */}
				<link
					rel="preconnect"
					href="https://outscore-api.outscore.workers.dev"
					crossOrigin="anonymous"
				/>
				<link
					rel="dns-prefetch"
					href="https://outscore-api.outscore.workers.dev"
				/>

				{/* Using raw CSS styles as an escape-hatch to ensure the background color never flickers in dark-mode. */}
				<style>{responsiveBackground}</style>
			</head>
			<body>{children}</body>
		</html>
	);
}

const responsiveBackground = `
body {
  background-color: #f9f9f9;
}
@media (prefers-color-scheme: dark) {
  body {
    background-color: #131413;
  }
}

/* Critical CSS - primary color for icons using currentColor */
:root {
  --color-m-01: rgb(24 124 86);
}

/* Remove opacity:0 to improve FCP - content renders immediately */
/* React Query will handle loading states gracefully */
`;

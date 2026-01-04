
import { View } from 'react-native'
import { Text } from '../ui/text'
import { Image } from '../ui/image'
import { memo } from 'react'
import { SvgUri } from 'react-native-svg'
import { cn } from '@/utils/misc'
import { Platform } from 'react-native'

export interface CountryItemProps {
	image: string
	name: string
	totalMatches: number
	totalLiveMatches?: number
}

export default function CountryItem({
	image,
	name,
	totalMatches,
	totalLiveMatches,
}: CountryItemProps) {

	return (
		<View className="relative flex h-40 flex-1 flex-row items-center">
				<View className="flex flex-1 flex-row items-center gap-x-16">
					<View className="rounded-1/2  absolute flex h-full w-full flex-row items-center justify-center overflow-hidden">
						{/* <Image
								source={{ uri: image }}
								className="h-40 w-40"
								resizeMode="cover"
							/> */}
					</View>
				<Text
					className={cn(
						"dark:text-neu-06 text-left font-semibold text-neu-10 [[data-state=expanded]_&]:text-neu-01",
						// isExpanded && "text-neu-01"
					)}
				>
					{name}
				</Text>
			</View>

			{/* <CountryDailyMatches
				liveMatchesLength={totalLiveMatches}
				dailyMatchesLength={totalMatches}
			/> */}
		</View>
	)
}

// const StyledCountryItem = styled("div", {
//   display: "grid",
//   alignItems: "center",
//   gridTemplateColumns: "auto 1fr auto",
//   gap: "0 $spacing3",
//   width: "100%",
//   "& .countryItem__image-border": {
//     borderRadius: "50%",
//     boxSizing: "border-box",
//     boxShadow: "$sha-01",
//     display: "flex",
//     alignItems: "center",
//     justifyContent: "center",
//     position: "relative",
//     width: "$sizes4",
//     height: "$sizes4",
//     [`[data-theme="dark"] &`]: {
//       boxShadow: "$sha-06",
//     },

//     "&:before": {
//       content: "",
//       width: "100%",
//       height: "100%",
//       position: "absolute",
//       top: "50%",
//       left: "50%",
//       transform: "translate(-50%, -50%)",
//       border: "2px solid rgb($neu-01)",
//       borderRadius: "50%",
//       [`[data-theme="dark"] &`]: {
//         border: "2px solid rgb($neu-10)",
//       },
//       '[data-state="expanded"] &': {
//         border: "2px solid rgb($m-01--light-03)",
//         boxShadow: "$sha-01",
//         [`[data-theme="dark"] &`]: {
//           boxShadow: "$sha-06",
//         },
//       },
//     },
//   },
//   "& .countryItem__image": {
//     width: "100%",
//     height: "100%",
//     display: "flex",
//     alignItems: "center",
//     justifyContent: "center",
//     position: "absolute",
//     overflow: "hidden",
//     borderRadius: "50%",

//     "&:before": {
//       content: "",
//       position: "absolute",
//       top: 0,
//       left: 0,
//       width: "100%",
//       height: "100%",
//       background: "rgb($neu-10)",
//       opacity: 0.08,
//       borderRadius: "50%",
//       zIndex: "$1",
//     },

//     "& img": {
//       width: "100%",
//       height: "100%",
//       objectFit: "cover",
//     },
//   },
//   "& .countryItem__matchesLength": {
//     display: "flex",
//     justifyContent: "center",
//     alignItems: "center",
//     gap: "0 $spacing1",
//     color: "rgb($neu-09)",
//     borderRadius: "32px",
//     minWidth: "$sizes4",
//     padding: "0 $spacing2",
//     height: "$sizes4",
//     boxShadow: "inset 0px 0px 0px 1px rgb(240, 241, 241)",
//     boxSizing: "border-box",

//     [`[data-theme="dark"] &`]: {
//       color: "rgb($neu-01)",
//       boxShadow: "inset 0px 0px 0px 1px rgb(49, 53, 52)",
//     },
//   },
//   "& .countryItem__title": {
//     color: "rgb($neu-10)",
//     [`[data-theme="dark"] &`]: {
//       color: "rgb($neu-06)",
//     },
//   },
//   "& .countryItem__liveMatchLength": {
//     color: "rgb($neu-01)",
//     background: "rgb($m-01)",
//     boxShadow: "none",

//     [`[data-theme="dark"] &`]: {
//       boxShadow: "none",
//     },
//   },

//   '[data-state="expanded"] &': {
//     "& .countryItem__matchesLength": {
//       color: "rgb($neu-01)",
//       boxShadow: "inset 0px 0px 0px 1px rgb(240, 241, 241, 0.3)",
//     },
//     "& .countryItem__liveMatchLength": {
//       boxShadow: "none",
//     },
//     "& .countryItem__title": {
//       color: "rgb($neu-01)",
//     },
//   },
// });
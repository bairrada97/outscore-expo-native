import { View } from "react-native"
import { Text } from "../ui/text"


export interface NoResultsBoxProps {
	text: string
	ctaText?: string
	variant?: 'alternate'
}

export const NoResultsBox = ({ text }: NoResultsBoxProps) => {
	return (
		<View className="flex flex-col gap-y-16 rounded-[8px] border-[1px] border-neu-04 px-24 py-16 text-neu-09/70 dark:border-neu-10 dark:text-neu-07">
			<Text variant="body-02" className="m-auto max-w-[640px]">
				{text}
			</Text>
			{/* {ctaText && <Button variant="alt-01">{ctaText}</Button>} */}
		</View>
	)
}

// const StyledNoResultsBox = styled("div", {
//   border: "1px solid rgb($neu-04)",
//   borderRadius: "8px",
//   padding: "$spacing3 $spacing4",
//   display: "flex",
//   flexDirection: "column",
//   gap: "$spacing3 0",
//   color: "rgba($neu-09, 0.7)",
//   [`[data-theme="dark"] &`]: {
//     border: "1px solid rgb($neu-10)",
//     color: "rgba($neu-07)",
//   },
//   variants: {
//     variant: {
//       alternate: {
//         border: "none",
//         padding: "$spacing3",

//         "& .noResultsBox__text": {
//           margin: "0",
//           textAlign: "left",
//         },
//       },
//     },
//   },
// });
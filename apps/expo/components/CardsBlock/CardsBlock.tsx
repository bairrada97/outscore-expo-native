import { type ReactNode } from "react";
import { View } from "react-native";
import { TitleBlock } from "../ui/title-block/title-block";
import { cn } from "@/utils/misc";

export const CardsBlock = ({
  title,
  extraInfo,
  className,
  cardsBlockClassName,
  children,
}: {
  title: string;
  extraInfo?: ReactNode;
  className?: string;
  cardsBlockClassName?: string;
  children: ReactNode[] | ReactNode;
}) => {
  return (
    <View
      className={cn(
        `dark:bg-neu-11 dark:shadow-sha-06 mb-8 flex  rounded-[8px] bg-[white] shadow-sha-01 ${className}`,
      )}
    >
      <TitleBlock extraInfo={extraInfo} className="">
        {title}
      </TitleBlock>
      <View className={`${cardsBlockClassName}`}>{children}</View>
    </View>
  );
};

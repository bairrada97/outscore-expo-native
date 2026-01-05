import { cn } from "@/lib/utils";
import { isFinishedStatus, isLiveStatus, type FixtureStatusShort } from "@outscore/shared-types";
import { Text, View } from "react-native";

interface FixtureStatusBadgeProps {
  status: {
    short: FixtureStatusShort;
    elapsed: number | null;
  };
  time: string;
  timestamp: number;
  timezone: string;
}

export function FixtureStatusBadge({ status, time }: FixtureStatusBadgeProps) {
  const isLive = isLiveStatus(status.short);
  const isFinished = isFinishedStatus(status.short);

  function getDisplayText(): string {
    if (isLive) {
      if (status.short === "HT") return "HT";
      if (status.short === "P") return "PEN";
      if (status.short === "BT") return "BT";
      if (status.short === "INT") return "INT";
      return `${status.elapsed}'`;
    }

    if (isFinished) {
      return status.short;
    }

    return time;
  }

  return (
    <View
      className={cn(
        "min-w-12 items-center justify-center rounded-md px-2 py-1",
        isLive && "bg-red/10",
        isFinished && "bg-neu-03"
      )}
    >
      <Text
        className={cn(
          "text-xs font-sans-semibold font-mono",
          isLive && "text-red",
          isFinished && "text-neu-07",
          !isLive && !isFinished && "text-neu-10"
        )}
      >
        {getDisplayText()}
      </Text>
    </View>
  );
}

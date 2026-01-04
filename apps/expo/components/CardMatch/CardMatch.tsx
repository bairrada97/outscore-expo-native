// const favoriteMatchesAtom = focusAtom(userPreferencesState, (optic) =>
//   optic.prop("favorite_matches")
// );
// const favoriteTeamsAtom = focusAtom(userPreferencesState, (optic) =>
//   optic.prop("favorite_teams")
// );

import React, { useEffect, useState } from 'react';
import { useDelay } from "@/hooks/useDelay";
import { useFixtureStatus } from "@/hooks/useFixtureStatus";
import usePrevious from "@/hooks/usePrevious";
import {
  FIXTURE_IS_FINISHED_STATUS,
  FIXTURE_IS_LIVE_STATUS,
} from "@/utils/fixturesStatusConstants";
import { cn } from "@/utils/misc";
import { tva } from "@gluestack-ui/nativewind-utils/tva";
import { Link } from "expo-router";
import { Pressable, TouchableOpacity, View } from "react-native";
import { Text } from "../ui/text";
import SvgB004 from "../ui/SvgIcons/B004";
import { FavoritesIcon } from "../FavoritesIcon/FavoritesIcon";
import { FormattedMatch } from "@outscore/shared-types";
import { FixtureStatus } from "../FixtureStatus/FixtureStatus";
import { FixtureTeam } from "../FixtureTeam/FixtureTeam";

// Define the MatchOutcomeType type
type MatchOutcomeType = 'win' | 'loss' | 'draw' | null;

// Add additional properties to FormattedMatch for this component
interface ExtendedFormattedMatch extends FormattedMatch {
  type?: 'H2H' | 'favorite-team' | null;
}

// const globalUserPreferencesAtom = atom(
//   (get) => get(userPreferencesState).notification_settings
// );

const cardMatch = tva({
  base: ".cardMatch",
  variants: {
    isMatchLive: {
      true: [
        'before:content-[""]',
        "before:absolute",
        "before:top-[calc(50%_/_48px_/_2)]",
        "before:left-[6px]",
        "before:bg-m-01--light-03",
        "before:h-48",
        "before:w-[2px]",
        "before:rounded-[4px]",
        "before:z-[0]",
      ],
    },
  },
});

interface CardMatchProps {
  fixture: ExtendedFormattedMatch;
  isLastMatch?: boolean;
  isFromFavorites?: boolean;
  onFavoritePress?: () => void;
}

const CardMatchComponent: React.FC<CardMatchProps> = ({
  fixture,
  isLastMatch = false,
  isFromFavorites = false,
  onFavoritePress,
}) => {
  const [teamScored, setTeamScored] = useState<{ home: boolean; away: boolean }>({
    home: false,
    away: false,
  });

  const { id, status, teams, score, goals, timezone, timestamp, date, type = null } = fixture;
  
  const { renderFixtureStatus, fixtureStatus } = useFixtureStatus({
    status,
    date,
    timezone,
    type,
  });

  const matchIsLive = fixtureStatus.isLive;
  const matchIsFinished = fixtureStatus.isFinished;
  
  // Safely get the home and away goals with proper null checks
  const homeTeamGoals = (score?.fulltime?.home ?? score?.penalty?.home) ?? goals?.home ?? 0;
  const awayTeamGoals = (score?.fulltime?.away ?? score?.penalty?.away) ?? goals?.away ?? 0;

  const [statusState, setStatus] = useState<string | null>(null);

  const TIME_TO_RESET_GOAL_STYLES = 60_000; //1 minute;

  const matchCurrentTime = status?.elapsed;
  const notH2H = type !== "H2H";

  const resetValues = () => {
    setTeamScored({
      home: false,
      away: false,
    });
  };

  useEffect(() => {
    setStatus(renderFixtureStatus()!);
  }, [status, timestamp, type, renderFixtureStatus]);

  console.log(teams)
  const url = `fixture/${id}-${teams.home
    .name!.toLowerCase()
    .replace("/", "")
    .split(" ")
    .join("-")}-vs-${teams.away
    .name!.toLowerCase()
    .replace("/", "")
    .split(" ")
    .join("-")}`;

  return (
    <Pressable className="h-64 font-sourceSansPro text-16">
      <View
        className={cn(
          "dark:text-neu-04 cardMatch relative box-border flex flex-1 flex-row items-center gap-x-8 px-16",
          !isLastMatch ? "border-b-[1px] border-neu-04" : "",
        )}
      >
        {fixtureStatus.isLive && (
          <View className="absolute left-[6px] top-[calc(50%-48px/2)] z-10 h-48 w-[2px] rounded-[4px] bg-m-01--light-03" />
        )}

        {(teamScored.home || teamScored.away) && (
          <View
            className={cn(
              "",
              teamScored.home || teamScored.away
                ? "absolute left-4 top-4 h-[calc(100%_-_8px)] w-[calc(100%_-_8px)] rounded-[4px] bg-m-01--light-02 opacity-[0.1]"
                : "",
            )}
          ></View>
        )}
        <FixtureStatus
          status={statusState!}
          matchIsLiveOrFinished={
            matchIsLive ||
            (matchIsFinished && notH2H)
          }
        />

        <View className="flex min-w-0 flex-1 flex-col gap-y-4 self-center">
          <FixtureTeam
            isGoal={teamScored.home}
            score={homeTeamGoals}
            name={teams.home.name!}
            winner={
              matchIsFinished &&
              teams.home.winner!
            }
          />
          <FixtureTeam
            isGoal={teamScored.away}
            score={awayTeamGoals}
            name={teams.away.name!}
            winner={
              matchIsFinished &&
              teams.away.winner!
            }
          />
        </View>
        {/* {notH2H && (
          <>
            <FavoritesIcon
              handlePress={(e: MouseEvent) => {
                e.preventDefault();
                // toggleMatchToFavorites(id!);
              }}
              isActive={
                // !!isMatchInFavorites({ favoriteMatches, matchId: id! })
                false
              }
            />

            <Pressable
              className=""
              onPress={(e) => {
                e.preventDefault();
                setPopupOpen(true);
              }}
            >
              <SvgB004
                width={24}
                height={24}
                aria-label="View More Icon"
                className="z-70 dark:text-neu-04 ml-8 text-neu-07"
              />
            </Pressable>
          </>
        )} */}
        {/* Additional commented code remains unchanged */}
      </View>
    </Pressable>
  );
};

// Memoize the component with a custom comparison function
export const CardMatch = React.memo(CardMatchComponent, (prevProps, nextProps) => {
  // Only re-render if these props change
  return (
    prevProps.fixture.id === nextProps.fixture.id &&
    prevProps.fixture.status.elapsed === nextProps.fixture.status.elapsed &&
    prevProps.fixture.score.fulltime?.home === nextProps.fixture.score.fulltime?.home &&
    prevProps.fixture.score.fulltime?.away === nextProps.fixture.score.fulltime?.away &&
    prevProps.fixture.goals.home === nextProps.fixture.goals.home &&
    prevProps.fixture.goals.away === nextProps.fixture.goals.away &&
    prevProps.isLastMatch === nextProps.isLastMatch &&
    prevProps.isFromFavorites === nextProps.isFromFavorites
  );
});

// const StyledCardMatch = styled(Link, {
//   display: "grid",
//   gridTemplateColumns: "$sizes6 1fr auto auto",
//   alignItems: "center",
//   gap: "0 $spacing2",
//   height: "$sizes9",
//   boxSizing: "border-box",
//   color: "inherit",
//   position: "relative",
//   padding: "0 $spacing3",
//   [`[data-theme="dark"] &`]: {
//     color: "rgb($neu-04)",
//   },

//   "&:not(last-of-type)": {
//     "&:after": {
//       content: "",
//       position: "absolute",
//       bottom: "0",
//       left: "50%",
//       transform: "translateX(-50%)",
//       background: "rgb($neu-04)",
//       height: "1px",
//       width: "calc(100% - $sizes3)",
//       [`[data-theme="dark"] &`]: {
//         background: "rgb($neu-12)",
//       },
//     },
//   },
//   "& .cardMatch__teamsContainer": {
//     display: "flex",
//     flexDirection: "column",
//     gap: "$spacing1 0",
//     minWidth: "0",
//     width: "100%",
//   },
//   "& .favoriteIcon": {
//     color: "rgb($neu-06)",
//     zIndex: "9",
//     [`[data-theme="dark"] &`]: {
//       color: "rgb($neu-08)",
//     },
//     "&.isFavorite": {
//       "&:before": {
//         content: "",
//         position: "absolute",
//         top: "50%",
//         transform: "translateY(-50%)",
//         linearGradient: "gra-02",
//         height: "100%",
//         width: "100%",
//         zIndex: "0",
//       },
//     },
//   },
//   "& .viewMoreIcon": {
//     color: "rgb($neu-07)",
//     zIndex: "9",
//     marginLeft: "$spacing2",
//     [`[data-theme="dark"] &`]: {
//       color: "rgb($neu-04)",
//     },
//   },

//   "& .isGoal": {
//     position: "absolute",
//     top: "4px",
//     left: "4px",
//     width: "calc(100% - 8px)",
//     height: "calc(100% - 8px)",
//     backgroundColor: "rgb($m-01--light-02)",
//     opacity: 0.1,
//     borderRadius: "4px",
//     [`[data-theme="dark"] &`]: {
//       backgroundColor: "rgb($m-01--light-04)",
//     },
//   },

//   variants: {
//     isMatchLive: {
//       true: {
//         "&:before": {
//           content: "",
//           position: "absolute",
//           top: "calc(50% - 48px / 2)",
//           left: "6px",
//           background: "rgb($m-01--light-03)",
//           height: "$sizes7",
//           width: "2px",
//           borderRadius: "4px",
//           zIndex: "0",
//         },
//       },
//     },
//   },
// });

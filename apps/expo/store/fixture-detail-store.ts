// import create from "zustand";

// import {
//   BETSHELPER,
//   H2H,
//   LINEUPS,
//   OVERVIEW,
//   STANDINGS,
//   STATISTICS,
// } from "../utilities/constants";
// import {
//   FetchFixtureByIDResponse,
//   FetchFixtureStandingsResponse,
//   FetchFixturesBetsHelperResponse,
// } from "../utilities/useOutscoreRepository";

// export type FixtureTabsType =
//   | "Overview"
//   | "Lineups"
//   | "Statistics"
//   | "BetsHelper"
//   | "H2H"
//   | "Standings";

// export type FollowingTabsType = "Matches" | "Teams" | "Leagues" | "Players";

// export interface FixtureDetailState {
//   fixture: FetchFixtureByIDResponse["response"][0] | null;
//   lastHomeTeamMatches: FetchFixtureByIDResponse["response"];
//   lastAwayTeamMatches: FetchFixtureByIDResponse["response"];
//   awayTeamH2H: FetchFixtureByIDResponse["response"][];
//   homeTeamH2H: FetchFixtureByIDResponse["response"][];
//   h2h: FetchFixtureByIDResponse["response"][] | null;
//   betsHelper: FetchFixturesBetsHelperResponse | null;
//   standings:
//     | FetchFixtureStandingsResponse["response"][0]["league"]["standings"]
//     | null;
//   selectedTab: FixtureTabsType | FollowingTabsType | null;

//   fixtureTabs: FixtureTabsType[];
//   setFixture: (payload: FetchFixtureByIDResponse["response"][0] | null) => void;
//   setSelectedTab: (tab: FixtureTabsType | FollowingTabsType | null) => void;
//   setBetsHelper: (payload: FetchFixturesBetsHelperResponse) => void;
//   setStandings: (payload: any) => void;
//   setH2H(payload: FetchFixtureByIDResponse["response"][]): void;
//   setLastHomeTeamMatches(payload: FetchFixtureByIDResponse["response"]): void;
//   setLastAwayTeamMatches(payload: FetchFixtureByIDResponse["response"]): void;

//   resetFixtureDetailState: () => void;
// }

// export const useFixtureDetailStore = create<FixtureDetailState>(
//   (set): FixtureDetailState => ({
//     fixture: null,
//     lastHomeTeamMatches: [],
//     lastAwayTeamMatches: [],
//     awayTeamH2H: [],
//     homeTeamH2H: [],
//     h2h: null,
//     betsHelper: null,
//     standings: null,
//     selectedTab: null,
//     fixtureTabs: [OVERVIEW, LINEUPS, STATISTICS, BETSHELPER, H2H, STANDINGS],
//     setSelectedTab: (tab) =>
//       set((state) => ({
//         ...state,
//         selectedTab: tab,
//       })),
//     setFixture: (payload) =>
//       set((state) => ({
//         ...state,
//         fixture: payload,
//       })),
//     setBetsHelper: (payload) =>
//       set((state) => ({
//         ...state,
//         betsHelper: payload,
//       })),
//     setH2H: (payload) =>
//       set((state) => ({
//         ...state,
//         h2h: payload,
//       })),
//     setStandings: (payload) =>
//       set((state) => ({
//         ...state,
//         standings: payload,
//       })),
//     setLastHomeTeamMatches: (payload) =>
//       set((state) => ({
//         ...state,
//         lastHomeTeamMatches: payload,
//       })),
//     setLastAwayTeamMatches: (payload) =>
//       set((state) => ({
//         ...state,
//         lastAwayTeamMatches: payload,
//       })),

//     resetFixtureDetailState: () =>
//       set(() => ({
//         ...initialStoreState,
//       })),
//   })
// );

// const initialStoreState = useFixtureDetailStore.getState();

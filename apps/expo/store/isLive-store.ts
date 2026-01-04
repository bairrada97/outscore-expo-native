import { atom, createStore } from 'jotai'

export const liveFixtureStateStore = createStore()

// import create from "zustand";
interface LiveFixtureState {
	isLive: boolean
}

export const initialState: LiveFixtureState = {
	isLive: false,
}

export const liveFixturesAtom = atom(initialState)

// export const useIsLiveStore = create<State>((set) => ({
//   isLive: false,
//   feedbackForm: false,
//   toggleIsLive: () =>
//     set((state) => ({
//       isLive: !state.isLive,
//     })),
//   setFeedbackForm: (payload: boolean) =>
//     set((state) => ({
//       feedbackForm: payload,
//     })),
//   resetIsLive: () =>
//     set(() => ({
//       isLive: initialStoreState.isLive,
//     })),
//   setIsLive: (payload: boolean) =>
//     set(() => ({
//       isLive: payload,
//     })),
// }));

// const initialStoreState = useIsLiveStore.getState();

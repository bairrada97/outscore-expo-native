export const useDelay = () => async (ms?: number) =>
	await new Promise(resolve => setTimeout(resolve, ms))
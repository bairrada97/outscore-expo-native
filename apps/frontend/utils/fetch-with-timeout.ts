export class FetchError extends Error {
	constructor(
		message: string,
		public status: number,
	) {
		super(message);
		this.name = "FetchError";
	}
}

interface FetchJsonOptions {
	url: string;
	signal?: AbortSignal;
	timeoutMs?: number;
	errorMessage: string;
	fetchOptions?: RequestInit;
}

export async function fetchJsonWithTimeout<T>({
	url,
	signal,
	timeoutMs = 30000,
	errorMessage,
	fetchOptions,
}: FetchJsonOptions): Promise<T> {
	const controller = signal ? null : new AbortController();
	const abortSignal = signal ?? controller?.signal;

	let timeoutId: ReturnType<typeof setTimeout> | null = null;
	if (!signal && timeoutMs > 0 && controller) {
		timeoutId = setTimeout(() => {
			controller.abort();
		}, timeoutMs);
	}

	try {
		const response = await fetch(url, {
			...fetchOptions,
			signal: abortSignal as RequestInit["signal"],
		});

		if (timeoutId) clearTimeout(timeoutId);

		if (!response.ok) {
			throw new FetchError(`${errorMessage}: ${response.statusText}`, response.status);
		}

		return (await response.json()) as T;
	} catch (error) {
		if (timeoutId) clearTimeout(timeoutId);
		if (error instanceof Error && error.name === "AbortError") {
			throw new FetchError("Request timeout or aborted", 408);
		}
		throw error;
	}
}


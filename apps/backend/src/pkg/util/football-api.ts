import type {
  FixturesResponse,
  InjuriesResponse,
  StandingsResponse,
  TeamStatisticsResponse,
} from "@outscore/shared-types";

/**
 * Fetch a single fixture detail from the third-party Football API
 */
export const getFootballApiFixtureDetail = async (
	fixtureId: number,
	apiUrl?: string,
	apiKey?: string,
): Promise<FixturesResponse> => {
	console.log(`🌐 [API] Request: fixtureId=${fixtureId}`);

	if (!apiUrl || !apiKey) {
		throw new Error("API URL or API Key not provided");
	}

	const url = new URL(`${apiUrl}/fixtures`);
	url.searchParams.append("id", fixtureId.toString());

	console.log(`🌐 [API] URL: ${url.toString()}`);

	const startTime = performance.now();

	try {
		const response = await fetch(url.toString(), {
			method: "GET",
			headers: {
				"x-rapidapi-host": "api-football-v1.p.rapidapi.com",
				"x-rapidapi-key": apiKey,
			},
		});

		const duration = (performance.now() - startTime).toFixed(2);

		if (!response.ok) {
			const errorText = await response.text();
			console.error(`❌ [API] Error (${duration}ms): ${response.statusText}`);
			throw new Error(
				`API request failed: ${response.statusText} - ${errorText}`,
			);
		}

		const data = await response.json();

		// Check for API errors
		if (data.errors && Array.isArray(data.errors) && data.errors.length > 0) {
			throw new Error(`API returned errors: ${JSON.stringify(data.errors)}`);
		}

		console.log(
			`✅ [API] Success (${duration}ms): fixture ${fixtureId} fetched`,
		);

		return data as FixturesResponse;
	} catch (error) {
		console.error("❌ [API] Error fetching fixture detail:", error);
		throw error;
	}
};

/**
 * Fetch multiple fixture details by IDs from the third-party Football API
 *
 * API-Football supports: GET /fixtures?ids=ID1-ID2-ID3
 * This is a quota optimization for batch workloads (e.g., 3am prefetch).
 */
export const getFootballApiFixturesByIds = async (
  fixtureIds: number[],
  apiUrl?: string,
  apiKey?: string
): Promise<FixturesResponse> => {
  if (!apiUrl || !apiKey) {
    throw new Error('API URL or API Key not provided');
  }

  if (fixtureIds.length === 0) {
    return {
      get: 'fixtures',
      parameters: {},
      errors: [],
      results: 0,
      paging: { current: 1, total: 1 },
      response: [],
    } satisfies FixturesResponse;
  }

  const idsParam = fixtureIds.join('-');
  console.log(`🌐 [API] Request: fixtures by ids (${fixtureIds.length})`);

  const url = new URL(`${apiUrl}/fixtures`);
  url.searchParams.append('ids', idsParam);
  console.log(`🌐 [API] URL: ${url.toString()}`);

  const startTime = performance.now();

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'x-rapidapi-host': 'api-football-v1.p.rapidapi.com',
      'x-rapidapi-key': apiKey,
    },
  });

  const duration = (performance.now() - startTime).toFixed(2);

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ [API] Error (${duration}ms): ${response.statusText}`);
    throw new Error(`API request failed: ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();

  // Check for API errors
  if (data.errors && Array.isArray(data.errors) && data.errors.length > 0) {
    throw new Error(`API returned errors: ${JSON.stringify(data.errors)}`);
  }

  console.log(
    `✅ [API] Success (${duration}ms): fixtures by ids -> ${data.response?.length || 0} fixtures`,
  );

  return data as FixturesResponse;
};

/**
 * Fetch fixtures from the third-party Football API
 */
export const getFootballApiFixtures = async (
	date: string,
	live?: "live",
	apiUrl?: string,
	apiKey?: string,
): Promise<FixturesResponse> => {
	console.log(
		`🌐 [API] Request: date=${date}, live=${live ? "true" : "false"}`,
	);

	if (!apiUrl || !apiKey) {
		throw new Error("API URL or API Key not provided");
	}

	const params: Record<string, string> = {};
	if (live === "live") {
		params.live = "all";
	} else {
		params.date = date;
	}

	const url = new URL(`${apiUrl}/fixtures`);
	Object.entries(params).forEach(([paramKey, paramValue]) => {
		url.searchParams.append(paramKey, paramValue);
	});

	console.log(`🌐 [API] URL: ${url.toString()}`);

	const startTime = performance.now();

	try {
		const response = await fetch(url.toString(), {
			method: "GET",
			headers: {
				"x-rapidapi-host": "api-football-v1.p.rapidapi.com",
				"x-rapidapi-key": apiKey,
			},
		});

		const duration = (performance.now() - startTime).toFixed(2);

		if (!response.ok) {
			const errorText = await response.text();
			console.error(`❌ [API] Error (${duration}ms): ${response.statusText}`);
			throw new Error(
				`API request failed: ${response.statusText} - ${errorText}`,
			);
		}

		const data = await response.json();

		// Check for API errors
		if (data.errors && Array.isArray(data.errors) && data.errors.length > 0) {
			throw new Error(`API returned errors: ${JSON.stringify(data.errors)}`);
		}

		console.log(
			`✅ [API] Success (${duration}ms): ${data.response?.length || 0} fixtures`,
		);

		return data as FixturesResponse;
	} catch (error) {
		console.error("❌ [API] Error fetching fixtures:", error);
		throw error;
	}
};

/**
 * Fetch team's recent fixtures from the third-party Football API
 * Endpoint: /fixtures?team=${teamId}&last=${last}
 */
export const getFootballApiTeamFixtures = async (
	teamId: number,
	last: number,
	apiUrl?: string,
	apiKey?: string,
): Promise<FixturesResponse> => {
	console.log(`🌐 [API] Request: teamFixtures teamId=${teamId}, last=${last}`);

	if (!apiUrl || !apiKey) {
		throw new Error("API URL or API Key not provided");
	}

	const url = new URL(`${apiUrl}/fixtures`);
	url.searchParams.append("team", teamId.toString());
	url.searchParams.append("last", last.toString());

	console.log(`🌐 [API] URL: ${url.toString()}`);

	const startTime = performance.now();

	try {
		const response = await fetch(url.toString(), {
			method: "GET",
			headers: {
				"x-rapidapi-host": "api-football-v1.p.rapidapi.com",
				"x-rapidapi-key": apiKey,
			},
		});

		const duration = (performance.now() - startTime).toFixed(2);

		if (!response.ok) {
			const errorText = await response.text();
			console.error(`❌ [API] Error (${duration}ms): ${response.statusText}`);
			throw new Error(
				`API request failed: ${response.statusText} - ${errorText}`,
			);
		}

		const data = await response.json();

		if (data.errors && Array.isArray(data.errors) && data.errors.length > 0) {
			throw new Error(`API returned errors: ${JSON.stringify(data.errors)}`);
		}

		console.log(
			`✅ [API] Success (${duration}ms): ${data.response?.length || 0} team fixtures`,
		);

		return data as FixturesResponse;
	} catch (error) {
		console.error("❌ [API] Error fetching team fixtures:", error);
		throw error;
	}
};

/**
 * Fetch team statistics from the third-party Football API
 * Endpoint: /teams/statistics?league=${league}&season=${season}&team=${team}
 */
export const getFootballApiTeamStatistics = async (
	league: number,
	season: number,
	team: number,
	apiUrl?: string,
	apiKey?: string,
): Promise<TeamStatisticsResponse> => {
	console.log(
		`🌐 [API] Request: teamStatistics league=${league}, season=${season}, team=${team}`,
	);

	if (!apiUrl || !apiKey) {
		throw new Error("API URL or API Key not provided");
	}

	const url = new URL(`${apiUrl}/teams/statistics`);
	url.searchParams.append("league", league.toString());
	url.searchParams.append("season", season.toString());
	url.searchParams.append("team", team.toString());

	console.log(`🌐 [API] URL: ${url.toString()}`);

	const startTime = performance.now();

	try {
		const response = await fetch(url.toString(), {
			method: "GET",
			headers: {
				"x-rapidapi-host": "api-football-v1.p.rapidapi.com",
				"x-rapidapi-key": apiKey,
			},
		});

		const duration = (performance.now() - startTime).toFixed(2);

		if (!response.ok) {
			const errorText = await response.text();
			console.error(`❌ [API] Error (${duration}ms): ${response.statusText}`);
			throw new Error(
				`API request failed: ${response.statusText} - ${errorText}`,
			);
		}

		const data = await response.json();

		if (data.errors && Array.isArray(data.errors) && data.errors.length > 0) {
			throw new Error(`API returned errors: ${JSON.stringify(data.errors)}`);
		}

		console.log(`✅ [API] Success (${duration}ms): team statistics fetched`);

		return data as TeamStatisticsResponse;
	} catch (error) {
		console.error("❌ [API] Error fetching team statistics:", error);
		throw error;
	}
};

/**
 * Fetch head-to-head fixtures from the third-party Football API
 * Endpoint: /fixtures/headtohead?h2h=${team1}-${team2}&last=${last}
 */
export const getFootballApiH2HFixtures = async (
	team1: number,
	team2: number,
	last: number,
	apiUrl?: string,
	apiKey?: string,
): Promise<FixturesResponse> => {
	console.log(
		`🌐 [API] Request: h2hFixtures team1=${team1}, team2=${team2}, last=${last}`,
	);

	if (!apiUrl || !apiKey) {
		throw new Error("API URL or API Key not provided");
	}

	const url = new URL(`${apiUrl}/fixtures/headtohead`);
	url.searchParams.append("h2h", `${team1}-${team2}`);
	url.searchParams.append("last", last.toString());

	console.log(`🌐 [API] URL: ${url.toString()}`);

	const startTime = performance.now();

	try {
		const response = await fetch(url.toString(), {
			method: "GET",
			headers: {
				"x-rapidapi-host": "api-football-v1.p.rapidapi.com",
				"x-rapidapi-key": apiKey,
			},
		});

		const duration = (performance.now() - startTime).toFixed(2);

		if (!response.ok) {
			const errorText = await response.text();
			console.error(`❌ [API] Error (${duration}ms): ${response.statusText}`);
			throw new Error(
				`API request failed: ${response.statusText} - ${errorText}`,
			);
		}

		const data = await response.json();

		if (data.errors && Array.isArray(data.errors) && data.errors.length > 0) {
			throw new Error(`API returned errors: ${JSON.stringify(data.errors)}`);
		}

		console.log(
			`✅ [API] Success (${duration}ms): ${data.response?.length || 0} h2h fixtures`,
		);

		return data as FixturesResponse;
	} catch (error) {
		console.error("❌ [API] Error fetching h2h fixtures:", error);
		throw error;
	}
};

/**
 * Fetch injuries for a fixture from the third-party Football API
 * Endpoint: /injuries?fixture=${fixtureId}
 */
export const getFootballApiInjuries = async (
	fixtureId: number,
	season: number,
	apiUrl?: string,
	apiKey?: string,
): Promise<InjuriesResponse> => {
	console.log(
		`🌐 [API] Request: injuries fixtureId=${fixtureId}, season=${season}`,
	);

	if (!apiUrl || !apiKey) {
		throw new Error("API URL or API Key not provided");
	}

	const url = new URL(`${apiUrl}/injuries`);
	url.searchParams.append("fixture", fixtureId.toString());
	url.searchParams.append("season", season.toString());

	console.log(`🌐 [API] URL: ${url.toString()}`);

	const startTime = performance.now();

	try {
		const response = await fetch(url.toString(), {
			method: "GET",
			headers: {
				"x-rapidapi-host": "api-football-v1.p.rapidapi.com",
				"x-rapidapi-key": apiKey,
			},
		});

		const duration = (performance.now() - startTime).toFixed(2);

		if (!response.ok) {
			const errorText = await response.text();
			console.error(`❌ [API] Error (${duration}ms): ${response.statusText}`);
			throw new Error(
				`API request failed: ${response.statusText} - ${errorText}`,
			);
		}

		const data = await response.json();

		if (data.errors && Array.isArray(data.errors) && data.errors.length > 0) {
			throw new Error(`API returned errors: ${JSON.stringify(data.errors)}`);
		}

		// Validate response structure - ensure it's an InjuriesResponse, not FixturesResponse
		if (!data.get || data.get !== "injuries") {
			console.error(
				`❌ [API] Invalid response structure. Expected 'get: injuries', got 'get: ${data.get}'`,
			);
			throw new Error(
				`Invalid API response: Expected injuries endpoint response, but got ${data.get || "unknown"} endpoint response`,
			);
		}

		// Ensure response is an array (injuries array)
		if (!Array.isArray(data.response)) {
			console.error(
				`❌ [API] Invalid response structure. Expected 'response' to be an array, got ${typeof data.response}`,
			);
			throw new Error(
				`Invalid API response: Expected 'response' to be an array of injuries`,
			);
		}

		console.log(
			`✅ [API] Success (${duration}ms): ${data.response?.length || 0} injuries`,
		);

		return data as InjuriesResponse;
	} catch (error) {
		console.error("❌ [API] Error fetching injuries:", error);
		throw error;
	}
};

/**
 * Fetch standings from the third-party Football API
 * Endpoint: /standings?league=${league}&season=${season}
 */
export const getFootballApiStandings = async (
	league: number,
	season: number,
	apiUrl?: string,
	apiKey?: string,
): Promise<StandingsResponse> => {
	console.log(`🌐 [API] Request: standings league=${league}, season=${season}`);

	if (!apiUrl || !apiKey) {
		throw new Error("API URL or API Key not provided");
	}

	const url = new URL(`${apiUrl}/standings`);
	url.searchParams.append("league", league.toString());
	url.searchParams.append("season", season.toString());

	console.log(`🌐 [API] URL: ${url.toString()}`);

	const startTime = performance.now();

	try {
		const response = await fetch(url.toString(), {
			method: "GET",
			headers: {
				"x-rapidapi-host": "api-football-v1.p.rapidapi.com",
				"x-rapidapi-key": apiKey,
			},
		});

		const duration = (performance.now() - startTime).toFixed(2);

		if (!response.ok) {
			const errorText = await response.text();
			console.error(`❌ [API] Error (${duration}ms): ${response.statusText}`);
			throw new Error(
				`API request failed: ${response.statusText} - ${errorText}`,
			);
		}

		const data = await response.json();

		if (data.errors && Array.isArray(data.errors) && data.errors.length > 0) {
			throw new Error(`API returned errors: ${JSON.stringify(data.errors)}`);
		}

		console.log(`✅ [API] Success (${duration}ms): standings fetched`);

		return data as StandingsResponse;
	} catch (error) {
		console.error("❌ [API] Error fetching standings:", error);
		throw error;
	}
};

import type { FixturesResponse } from '@outscore/shared-types';

/**
 * Fetch a single fixture detail from the third-party Football API
 */
export const getFootballApiFixtureDetail = async (
  fixtureId: number,
  apiUrl?: string,
  apiKey?: string
): Promise<FixturesResponse> => {
  console.log(`🌐 [API] Request: fixtureId=${fixtureId}`);

  if (!apiUrl || !apiKey) {
    throw new Error('API URL or API Key not provided');
  }

  const url = new URL(`${apiUrl}/fixtures`);
  url.searchParams.append('id', fixtureId.toString());

  console.log(`🌐 [API] URL: ${url.toString()}`);

  const startTime = performance.now();

  try {
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

    console.log(`✅ [API] Success (${duration}ms): fixture ${fixtureId} fetched`);

    return data as FixturesResponse;
  } catch (error) {
    console.error('❌ [API] Error fetching fixture detail:', error);
    throw error;
  }
};

/**
 * Fetch fixtures from the third-party Football API
 */
export const getFootballApiFixtures = async (
  date: string,
  live?: 'live',
  apiUrl?: string,
  apiKey?: string
): Promise<FixturesResponse> => {
  console.log(`🌐 [API] Request: date=${date}, live=${live ? 'true' : 'false'}`);

  if (!apiUrl || !apiKey) {
    throw new Error('API URL or API Key not provided');
  }

  const params: Record<string, string> = {};
  if (live === 'live') {
    params.live = 'all';
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

    console.log(`✅ [API] Success (${duration}ms): ${data.response?.length || 0} fixtures`);

    return data as FixturesResponse;
  } catch (error) {
    console.error('❌ [API] Error fetching fixtures:', error);
    throw error;
  }
};


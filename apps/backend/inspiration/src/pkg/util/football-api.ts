import { FixturesResponse } from '@outscore/shared-types';

export const getFootballApiFixtures = async (
  date: string, 
  live?: 'live',
  apiUrl?: string,
  apiKey?: string
): Promise<FixturesResponse> => {
  console.log(`🌐 API Request: date=${date}, live=${live ? 'true' : 'false'}`);
  
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
  Object.entries(params).forEach(([key, value]) => {
    console.log(`Adding parameter: ${key}=${value}`);
    url.searchParams.append(key, value);
  });
  console.log(`Built URL: ${url.toString()}`);

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'x-rapidapi-host': 'api-football-v1.p.rapidapi.com',
        'x-rapidapi-key': apiKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error Response:', errorText);
      throw new Error(`API request failed: ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();

    // Make sure the data conforms to the expected type
    if (data.errors && Array.isArray(data.errors) && data.errors.length > 0) {
      throw new Error(`API returned errors: ${JSON.stringify(data.errors)}`);
    }

    return data as FixturesResponse;
  } catch (error) {
    console.error('Error fetching fixtures:', error);
    throw error;
  }
};
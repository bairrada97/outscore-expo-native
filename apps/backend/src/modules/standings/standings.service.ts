import type { StandingsResponse } from '@outscore/shared-types';
import { getFootballApiStandings } from '../../pkg/util/football-api';
import {
  type CacheEnv,
  cacheGet,
  cacheSet,
  getCacheKey,
  isStale,
  withDeduplication,
} from '../cache';

export interface StandingsEnv extends CacheEnv {
  FOOTBALL_API_URL: string;
  RAPIDAPI_KEY: string;
}

export interface StandingsServiceResult {
  data: StandingsResponse;
  source: string;
}

export const standingsService = {
  /**
   * Get league standings for a specific season
   * Caching strategy:
   * - 1 hour TTL (API updates hourly)
   */
  async getStandings({
    league,
    season,
    env,
    ctx,
  }: {
    league: number;
    season: number;
    env: StandingsEnv;
    ctx: ExecutionContext;
  }): Promise<StandingsServiceResult> {
    console.log(`🔍 [Standings] Request: league=${league}, season=${season}`);

    const params = { 
      leagueId: league.toString(), 
      season: season.toString() 
    };
    const dedupKey = getCacheKey('standings', params);

    return withDeduplication(dedupKey, async () => {
      // 1. Check cache
      const cacheResult = await cacheGet<StandingsResponse>(env, 'standings', params);
      let staleData: StandingsResponse | null = null;

      if (cacheResult.data && cacheResult.source !== 'none') {
        if (!isStale(cacheResult.meta, 'standings', params)) {
          console.log(`✅ [Standings] Cache hit for league ${league}`);
          return {
            data: cacheResult.data,
            source: cacheResult.source === 'edge' ? 'Edge Cache' : cacheResult.source === 'r2' ? 'R2' : 'KV',
          };
        }

        staleData = cacheResult.data;
        console.log(`⏳ [Standings] Cache data is stale`);
      }

      // 2. Fetch from API
      console.log(`🌐 [Standings] Fetching league ${league} standings from API`);
      try {
        const response = await getFootballApiStandings(
          league,
          season,
          env.FOOTBALL_API_URL,
          env.RAPIDAPI_KEY
        );

        // Cache response (non-blocking)
        ctx.waitUntil(
          cacheSet(env, 'standings', params, response)
            .then((success) => {
              if (success) {
                console.log(`✅ [Standings] Successfully cached league ${league} standings`);
              }
            })
            .catch((err) => {
              console.error(`❌ [Standings] Failed to cache league ${league} standings:`, err);
            })
        );

        return {
          data: response,
          source: 'API',
        };
      } catch (error) {
        console.error(`❌ [Standings] API fetch failed for league ${league}:`, error);

        if (staleData) {
          console.log(`⚠️ [Standings] Using stale data as fallback`);
          return {
            data: staleData,
            source: 'Stale Cache',
          };
        }

        throw error;
      }
    });
  },
};


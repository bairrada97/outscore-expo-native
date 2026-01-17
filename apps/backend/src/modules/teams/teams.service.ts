import type { TeamStatisticsResponse } from '@outscore/shared-types';
import { getFootballApiTeamStatistics } from '../../pkg/util/football-api';
import {
  type CacheEnv,
  cacheGet,
  cacheSet,
  getCacheKey,
  isStale,
  withDeduplication,
} from '../cache';

export interface TeamsEnv extends CacheEnv {
  FOOTBALL_API_URL: string;
  RAPIDAPI_KEY: string;
}

export interface TeamStatisticsServiceResult {
  data: TeamStatisticsResponse;
  source: string;
}

export const teamsService = {
  /**
   * Get team statistics for a specific league and season
   * Caching strategy:
   * - 1 hour TTL (API updates hourly)
   */
  async getTeamStatistics({
    league,
    season,
    team,
    env,
    ctx,
  }: {
    league: number;
    season: number;
    team: number;
    env: TeamsEnv;
    ctx: ExecutionContext;
  }): Promise<TeamStatisticsServiceResult> {
    console.log(`🔍 [TeamStatistics] Request: league=${league}, season=${season}, team=${team}`);

    const params = { 
      league: league.toString(), 
      season: season.toString(), 
      team: team.toString() 
    };
    const dedupKey = getCacheKey('teamStatistics', params);

    return withDeduplication(dedupKey, async () => {
      // 1. Check cache
      const cacheResult = await cacheGet<TeamStatisticsResponse>(env, 'teamStatistics', params);
      let staleData: TeamStatisticsResponse | null = null;

      if (cacheResult.data && cacheResult.source !== 'none') {
        if (!isStale(cacheResult.meta, 'teamStatistics', params)) {
          console.log(`✅ [TeamStatistics] Cache hit for team ${team} in league ${league}`);
          return {
            data: cacheResult.data,
            source: cacheResult.source === 'edge' ? 'Edge Cache' : cacheResult.source === 'r2' ? 'R2' : 'KV',
          };
        }

        staleData = cacheResult.data;
        console.log(`⏳ [TeamStatistics] Cache data is stale`);
      }

      // 2. Fetch from API
      console.log(`🌐 [TeamStatistics] Fetching team ${team} statistics from API`);
      try {
        const response = await getFootballApiTeamStatistics(
          league,
          season,
          team,
          env.FOOTBALL_API_URL,
          env.RAPIDAPI_KEY
        );

        // Cache response (non-blocking)
        ctx.waitUntil(
          cacheSet(env, 'teamStatistics', params, response)
            .then((success) => {
              if (success) {
                console.log(`✅ [TeamStatistics] Successfully cached team ${team} statistics`);
              }
            })
            .catch((err) => {
              console.error(`❌ [TeamStatistics] Failed to cache team ${team} statistics:`, err);
            })
        );

        return {
          data: response,
          source: 'API',
        };
      } catch (error) {
        console.error(`❌ [TeamStatistics] API fetch failed for team ${team}:`, error);

        if (staleData) {
          console.log(`⚠️ [TeamStatistics] Using stale data as fallback`);
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


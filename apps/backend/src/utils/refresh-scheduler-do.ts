/**
 * Refresh Scheduler Durable Object
 *
 * Provides 15-second interval scheduling for fixture refreshes.
 * Uses Durable Object alarms since Cloudflare cron minimum is 1 minute.
 *
 * Also handles standings refresh:
 * - Active leagues (with live fixtures): refresh hourly
 * - Recently finished leagues: refresh with backoff (+10m, +30m, hourly cap)
 */

import {
  refreshTodayFixturesWithAnalysis,
  type SchedulerEnv,
} from '../modules/scheduler';
import {
  analyzeFixtures,
  checkAndRegenerateForLeague,
  createInitialState,
  deserializeState,
  fetchStandingsForLeague,
  getLeaguesToRefresh,
  recordStandingsRefresh,
  serializeState,
  type StandingsRefreshState,
  updateStateFromAnalysis,
} from '../modules/scheduler/standings-refresh';

const REFRESH_INTERVAL_MS = 15_000; // 15 seconds
const STANDINGS_STATE_KEY = 'standings_refresh_state';

/**
 * Refresh Scheduler Durable Object class
 *
 * Handles alarm-based scheduling for sub-minute fixture refreshes.
 * The alarm chain self-perpetuates once started.
 */
export class RefreshSchedulerDurableObject {
  private state: DurableObjectState;
  private env: SchedulerEnv;
  private standingsState: StandingsRefreshState | null = null;

  constructor(state: DurableObjectState, env: SchedulerEnv) {
    this.state = state;
    this.env = env;
  }

  /**
   * Load standings refresh state from storage
   */
  private async loadStandingsState(): Promise<StandingsRefreshState> {
    if (this.standingsState) {
      return this.standingsState;
    }

    const stored = await this.state.storage.get<string>(STANDINGS_STATE_KEY);
    this.standingsState = stored
      ? deserializeState(stored)
      : createInitialState();
    return this.standingsState;
  }

  /**
   * Save standings refresh state to storage
   */
  private async saveStandingsState(): Promise<void> {
    if (this.standingsState) {
      await this.state.storage.put(
        STANDINGS_STATE_KEY,
        serializeState(this.standingsState),
      );
    }
  }

  /**
   * Alarm handler - called every 15 seconds
   * This is the core of the sub-minute scheduling
   */
  async alarm(): Promise<void> {
    const startTime = performance.now();
    const now = Date.now();
    console.log(`⏰ [RefreshScheduler] Alarm triggered at ${new Date().toISOString()}`);

    try {
      // Load standings state
      const standingsState = await this.loadStandingsState();

      // Refresh today's fixtures and get the fixtures data for analysis
      const fixtures = await refreshTodayFixturesWithAnalysis(this.env);

      if (fixtures && fixtures.length > 0) {
        // Analyze fixtures for active leagues and FT transitions
        const analysis = analyzeFixtures(
          fixtures,
          standingsState.previousFixtureStatuses,
        );

        // Update state based on analysis
        updateStateFromAnalysis(standingsState, analysis, now);

        // Check which leagues need standings refresh
        const leaguesToRefresh = getLeaguesToRefresh(standingsState, now);

        // Log active leagues status
        if (standingsState.activeLeagues.size > 0) {
          console.log(
            `📊 [RefreshScheduler] ${standingsState.activeLeagues.size} active leagues, ` +
            `${standingsState.recentlyFinishedLeagues.size} recently finished`,
          );
        }

        // Refresh standings for leagues that need it (non-blocking)
        const allLeaguesToRefresh = [
          ...leaguesToRefresh.fromActive,
          ...leaguesToRefresh.fromRecentlyFinished,
        ];

        if (allLeaguesToRefresh.length > 0) {
          console.log(
            `🔄 [RefreshScheduler] Refreshing standings for ${allLeaguesToRefresh.length} leagues`,
          );

          // Process standings refresh and signature-driven regeneration
          await Promise.all(
            allLeaguesToRefresh.map(async (league) => {
              const success = await fetchStandingsForLeague(
                league.leagueId,
                league.season,
                this.env,
              );
              if (success) {
                recordStandingsRefresh(
                  standingsState,
                  league.leagueId,
                  league.season,
                  now,
                );

                // Check for NS fixtures that need insights regeneration
                // (due to standings signature changes)
                try {
                  const regenerated = await checkAndRegenerateForLeague(
                    fixtures,
                    league.leagueId,
                    league.season,
                    this.env,
                  );
                  if (regenerated > 0) {
                    console.log(
                      `✅ [RefreshScheduler] Regenerated ${regenerated} insights for league ${league.leagueId}`,
                    );
                  }
                } catch (regenError) {
                  console.warn(
                    `⚠️ [RefreshScheduler] Regeneration check failed for league ${league.leagueId}:`,
                    regenError,
                  );
                }
              }
            }),
          );
        }

        // Save updated state
        await this.saveStandingsState();
      }

      const duration = (performance.now() - startTime).toFixed(2);
      console.log(`✅ [RefreshScheduler] Refresh completed in ${duration}ms`);
    } catch (error) {
      console.error(`❌ [RefreshScheduler] Refresh failed:`, error);
      // Continue the chain even on error
    }

    // Schedule next alarm in 15 seconds
    await this.state.storage.setAlarm(Date.now() + REFRESH_INTERVAL_MS);
  }

  /**
   * Start the alarm chain
   */
  async start(): Promise<{ started: boolean; nextAlarm: number }> {
    const currentAlarm = await this.state.storage.getAlarm();

    if (currentAlarm) {
      console.log(`ℹ️ [RefreshScheduler] Alarm chain already running, next at ${new Date(currentAlarm).toISOString()}`);
      return { started: false, nextAlarm: currentAlarm };
    }

    // Start immediately
    const nextAlarm = Date.now() + 1000; // 1 second from now
    await this.state.storage.setAlarm(nextAlarm);
    console.log(`🚀 [RefreshScheduler] Started alarm chain, first alarm at ${new Date(nextAlarm).toISOString()}`);

    return { started: true, nextAlarm };
  }

  /**
   * Stop the alarm chain
   */
  async stop(): Promise<{ stopped: boolean }> {
    const currentAlarm = await this.state.storage.getAlarm();

    if (!currentAlarm) {
      console.log(`ℹ️ [RefreshScheduler] No alarm chain running`);
      return { stopped: false };
    }

    await this.state.storage.deleteAlarm();
    console.log(`🛑 [RefreshScheduler] Stopped alarm chain`);

    return { stopped: true };
  }

  /**
   * Get current status
   */
  async status(): Promise<{ running: boolean; nextAlarm: number | null }> {
    const currentAlarm = await this.state.storage.getAlarm();
    return {
      running: currentAlarm !== null,
      nextAlarm: currentAlarm,
    };
  }

  /**
   * Handle HTTP requests
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (path === '/start' && request.method === 'POST') {
        const result = await this.start();
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (path === '/stop' && request.method === 'POST') {
        const result = await this.stop();
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (path === '/status' && request.method === 'GET') {
        const result = await this.status();
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Default: ensure alarm chain is running (called by cron as failsafe)
      if (path === '/ensure' || path === '/') {
        const result = await this.start();
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response('Not found', { status: 404 });
    } catch (error) {
      console.error('Error in RefreshSchedulerDurableObject:', error);
      return new Response(
        JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  }
}

export default RefreshSchedulerDurableObject;


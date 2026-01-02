/**
 * Refresh Scheduler Durable Object
 *
 * Provides 15-second interval scheduling for fixture refreshes.
 * Uses Durable Object alarms since Cloudflare cron minimum is 1 minute.
 */

import { refreshTodayFixtures, type SchedulerEnv } from '../modules/scheduler';

const REFRESH_INTERVAL_MS = 15_000; // 15 seconds

/**
 * Refresh Scheduler Durable Object class
 *
 * Handles alarm-based scheduling for sub-minute fixture refreshes.
 * The alarm chain self-perpetuates once started.
 */
export class RefreshSchedulerDurableObject {
  private state: DurableObjectState;
  private env: SchedulerEnv;

  constructor(state: DurableObjectState, env: SchedulerEnv) {
    this.state = state;
    this.env = env;
  }

  /**
   * Alarm handler - called every 15 seconds
   * This is the core of the sub-minute scheduling
   */
  async alarm(): Promise<void> {
    const startTime = performance.now();
    console.log(`⏰ [RefreshScheduler] Alarm triggered at ${new Date().toISOString()}`);

    try {
      // Refresh today's fixtures
      await refreshTodayFixtures(this.env);

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


/**
 * API Quota Manager
 * 
 * Tracks third-party API usage and provides alerts when approaching limits.
 * Uses Cloudflare Durable Objects for atomic counter increments to prevent
 * lost increments under concurrent requests.
 */

import type { DurableObjectNamespace } from '@cloudflare/workers-types';
import type { IncrementResponse } from './quota-durable-object';

/**
 * Quota configuration
 */
interface QuotaConfig {
  dailyLimit: number;
  hourlyLimit: number;
  alertThreshold: number;
}

/**
 * Quota state stored in the Durable Object
 */
interface QuotaState {
  date: string;
  dailyCalls: number;
  currentHour: number;
  hourlyCalls: number;
  lastUpdated: string;
}

/**
 * Default quota configuration
 * Based on Football API limits
 */
const DEFAULT_CONFIG: QuotaConfig = {
  dailyLimit: 70000,
  hourlyLimit: 3000,
  alertThreshold: 0.8, // 80%
};

/**
 * Quota Manager class
 * 
 * Uses a Durable Object for atomic increments to ensure thread-safety
 * under concurrent requests.
 */
export class QuotaManager {
  private durableObjectNamespace: DurableObjectNamespace;
  private config: QuotaConfig;
  private durableObjectId: DurableObjectId;

  constructor(
    durableObjectNamespace: DurableObjectNamespace,
    config: Partial<QuotaConfig> = {}
  ) {
    this.durableObjectNamespace = durableObjectNamespace;
    this.config = { ...DEFAULT_CONFIG, ...config };
    // Use a single Durable Object instance for quota tracking
    // The ID is deterministic based on a fixed name
    this.durableObjectId = durableObjectNamespace.idFromName('quota-tracker');
  }

  /**
   * Get the Durable Object stub
   */
  private getStub() {
    return this.durableObjectNamespace.get(this.durableObjectId);
  }

  /**
   * Ensure the Durable Object is configured with the current config
   */
  private async ensureConfigured(): Promise<void> {
    const stub = this.getStub();
    // Configure the Durable Object with current config
    // This is idempotent, so safe to call multiple times
    await stub.fetch('https://quota.local/configure', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(this.config),
    });
  }

  /**
   * Get current quota state from the Durable Object
   */
  async getState(): Promise<QuotaState> {
    await this.ensureConfigured();
    const stub = this.getStub();
    const response = await stub.fetch('https://quota.local/state', {
      method: 'GET',
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get quota state: ${response.statusText}`);
    }
    
    return await response.json<QuotaState>();
  }

  /**
   * Record an API call
   * 
   * Atomically increments counters via the Durable Object and returns
   * the authoritative quota status. This ensures no lost increments
   * under concurrent requests.
   */
  async recordCall(): Promise<{
    allowed: boolean;
    dailyRemaining: number;
    hourlyRemaining: number;
    shouldAlert: boolean;
  }> {
    await this.ensureConfigured();
    const stub = this.getStub();
    
    // Call the Durable Object's atomic increment operation
    const response = await stub.fetch('https://quota.local/increment', {
      method: 'POST',
    });
    
    if (!response.ok) {
      throw new Error(`Failed to record quota call: ${response.statusText}`);
    }
    
    const result = await response.json<IncrementResponse>();
    
    // Return the authoritative response from the Durable Object
    return {
      allowed: result.allowed,
      dailyRemaining: result.dailyRemaining,
      hourlyRemaining: result.hourlyRemaining,
      shouldAlert: result.shouldAlert,
    };
  }

  /**
   * Get current usage stats
   */
  async getStats(): Promise<{
    dailyCalls: number;
    dailyLimit: number;
    dailyPercentage: number;
    hourlyCalls: number;
    hourlyLimit: number;
    hourlyPercentage: number;
  }> {
    const state = await this.getState();

    return {
      dailyCalls: state.dailyCalls,
      dailyLimit: this.config.dailyLimit,
      dailyPercentage: (state.dailyCalls / this.config.dailyLimit) * 100,
      hourlyCalls: state.hourlyCalls,
      hourlyLimit: this.config.hourlyLimit,
      hourlyPercentage: (state.hourlyCalls / this.config.hourlyLimit) * 100,
    };
  }

  /**
   * Check if we can make an API call (without recording)
   */
  async canMakeCall(): Promise<boolean> {
    const state = await this.getState();
    return (
      state.dailyCalls < this.config.dailyLimit &&
      state.hourlyCalls < this.config.hourlyLimit
    );
  }
}

/**
 * Create a quota manager instance
 */
export const createQuotaManager = (
  durableObjectNamespace: DurableObjectNamespace,
  config?: Partial<QuotaConfig>
): QuotaManager => {
  return new QuotaManager(durableObjectNamespace, config);
};


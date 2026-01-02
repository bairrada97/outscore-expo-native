/**
 * API Quota Manager
 * 
 * Tracks third-party API usage and provides alerts when approaching limits.
 * Uses KV to persist quota state across worker instances.
 */

/**
 * Quota configuration
 */
interface QuotaConfig {
  dailyLimit: number;
  hourlyLimit: number;

  alertThreshold: number;
}

/**
 * Quota state stored in KV
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
 */
export class QuotaManager {
  private kv: KVNamespace;
  private config: QuotaConfig;
  private key = 'api:quota:state';

  constructor(kv: KVNamespace, config: Partial<QuotaConfig> = {}) {
    this.kv = kv;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get current quota state
   */
  async getState(): Promise<QuotaState> {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentHour = now.getUTCHours();

    // Try to get existing state
    const stored = await this.kv.get<QuotaState>(this.key, { type: 'json' });

    if (stored) {
      // Check if we need to reset daily counter
      if (stored.date !== today) {
        return {
          date: today,
          dailyCalls: 0,
          currentHour,
          hourlyCalls: 0,
          lastUpdated: now.toISOString(),
        };
      }

      // Check if we need to reset hourly counter
      if (stored.currentHour !== currentHour) {
        return {
          ...stored,
          currentHour,
          hourlyCalls: 0,
          lastUpdated: now.toISOString(),
        };
      }

      return stored;
    }

    // Initialize new state
    return {
      date: today,
      dailyCalls: 0,
      currentHour,
      hourlyCalls: 0,
      lastUpdated: now.toISOString(),
    };
  }

  /**
   * Record an API call
   */
  async recordCall(): Promise<{
    allowed: boolean;
    dailyRemaining: number;
    hourlyRemaining: number;
    shouldAlert: boolean;
  }> {
    const state = await this.getState();

    // Increment counters
    state.dailyCalls++;
    state.hourlyCalls++;
    state.lastUpdated = new Date().toISOString();

    // Calculate remaining
    const dailyRemaining = this.config.dailyLimit - state.dailyCalls;
    const hourlyRemaining = this.config.hourlyLimit - state.hourlyCalls;

    // Check if we're over limits
    const allowed = dailyRemaining >= 0 && hourlyRemaining >= 0;

    // Check if we should alert
    const dailyPercentage = state.dailyCalls / this.config.dailyLimit;
    const shouldAlert = dailyPercentage >= this.config.alertThreshold;

    // Save state
    await this.kv.put(this.key, JSON.stringify(state), {
      expirationTtl: 86400 * 2, // 2 days
    });

    if (!allowed) {
      console.warn(
        `⚠️ [Quota] Limit exceeded! Daily: ${state.dailyCalls}/${this.config.dailyLimit}, ` +
          `Hourly: ${state.hourlyCalls}/${this.config.hourlyLimit}`
      );
    } else if (shouldAlert) {
      console.warn(
        `⚠️ [Quota] Approaching limit! Daily usage: ${(dailyPercentage * 100).toFixed(1)}%`
      );
    }

    return {
      allowed,
      dailyRemaining: Math.max(0, dailyRemaining),
      hourlyRemaining: Math.max(0, hourlyRemaining),
      shouldAlert,
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
  kv: KVNamespace,
  config?: Partial<QuotaConfig>
): QuotaManager => {
  return new QuotaManager(kv, config);
};


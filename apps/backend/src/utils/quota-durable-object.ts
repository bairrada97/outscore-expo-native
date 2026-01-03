/**
 * Quota Durable Object
 * 
 * Provides atomic increment operations for API quota tracking.
 * Ensures thread-safe counter increments under concurrent requests.
 */

/**
 * Quota configuration passed to the Durable Object
 */
interface QuotaConfig {
  dailyLimit: number;
  hourlyLimit: number;
  alertThreshold: number;
}

/**
 * Validation constants for configuration
 */
const CONFIG_VALIDATION = {
  dailyLimit: { min: 1, max: 10_000_000 },
  hourlyLimit: { min: 1, max: 1_000_000 },
  alertThreshold: { min: 0, max: 1 },
} as const;

const ALLOWED_CONFIG_KEYS = new Set(['dailyLimit', 'hourlyLimit', 'alertThreshold']);

/**
 * Validation result type
 */
type ValidationResult = { valid: true; config: QuotaConfig } | { valid: false; error: string };

/**
 * Validate quota configuration payload
 */
function validateQuotaConfig(payload: unknown): ValidationResult {
  // Check payload is an object
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    return { valid: false, error: 'Request body must be a JSON object' };
  }

  const obj = payload as Record<string, unknown>;

  // Check for unknown keys
  const unknownKeys = Object.keys(obj).filter(key => !ALLOWED_CONFIG_KEYS.has(key));
  if (unknownKeys.length > 0) {
    return { valid: false, error: `Unknown keys: ${unknownKeys.join(', ')}` };
  }

  // Validate dailyLimit
  if (!('dailyLimit' in obj)) {
    return { valid: false, error: 'Missing required field: dailyLimit' };
  }
  if (typeof obj.dailyLimit !== 'number' || !Number.isFinite(obj.dailyLimit)) {
    return { valid: false, error: 'dailyLimit must be a finite number' };
  }
  if (!Number.isInteger(obj.dailyLimit)) {
    return { valid: false, error: 'dailyLimit must be an integer' };
  }
  if (obj.dailyLimit < CONFIG_VALIDATION.dailyLimit.min || obj.dailyLimit > CONFIG_VALIDATION.dailyLimit.max) {
    return { valid: false, error: `dailyLimit must be between ${CONFIG_VALIDATION.dailyLimit.min} and ${CONFIG_VALIDATION.dailyLimit.max}` };
  }

  // Validate hourlyLimit
  if (!('hourlyLimit' in obj)) {
    return { valid: false, error: 'Missing required field: hourlyLimit' };
  }
  if (typeof obj.hourlyLimit !== 'number' || !Number.isFinite(obj.hourlyLimit)) {
    return { valid: false, error: 'hourlyLimit must be a finite number' };
  }
  if (!Number.isInteger(obj.hourlyLimit)) {
    return { valid: false, error: 'hourlyLimit must be an integer' };
  }
  if (obj.hourlyLimit < CONFIG_VALIDATION.hourlyLimit.min || obj.hourlyLimit > CONFIG_VALIDATION.hourlyLimit.max) {
    return { valid: false, error: `hourlyLimit must be between ${CONFIG_VALIDATION.hourlyLimit.min} and ${CONFIG_VALIDATION.hourlyLimit.max}` };
  }

  // Validate alertThreshold
  if (!('alertThreshold' in obj)) {
    return { valid: false, error: 'Missing required field: alertThreshold' };
  }
  if (typeof obj.alertThreshold !== 'number' || !Number.isFinite(obj.alertThreshold)) {
    return { valid: false, error: 'alertThreshold must be a finite number' };
  }
  if (obj.alertThreshold < CONFIG_VALIDATION.alertThreshold.min || obj.alertThreshold > CONFIG_VALIDATION.alertThreshold.max) {
    return { valid: false, error: `alertThreshold must be between ${CONFIG_VALIDATION.alertThreshold.min} and ${CONFIG_VALIDATION.alertThreshold.max}` };
  }

  // Logical validation: hourlyLimit should not exceed dailyLimit
  if (obj.hourlyLimit > obj.dailyLimit) {
    return { valid: false, error: 'hourlyLimit cannot exceed dailyLimit' };
  }

  return {
    valid: true,
    config: {
      dailyLimit: obj.dailyLimit,
      hourlyLimit: obj.hourlyLimit,
      alertThreshold: obj.alertThreshold,
    },
  };
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
 * Response from increment operation
 */
export interface IncrementResponse {
  allowed: boolean;
  dailyRemaining: number;
  hourlyRemaining: number;
  shouldAlert: boolean;
  dailyCalls: number;
  hourlyCalls: number;
}

/**
 * Quota Durable Object class
 * 
 * Handles atomic increment operations for quota tracking.
 * All state mutations happen within this single-threaded Durable Object,
 * ensuring no lost increments under concurrent requests.
 */
export class QuotaDurableObject {
  private state: DurableObjectState;
  private config: QuotaConfig | null = null;
  private stateCache: QuotaState | null = null;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  /**
   * Initialize or update configuration
   */
  async configure(config: QuotaConfig): Promise<void> {
    this.config = config;
    await this.ensureState();
  }

  /**
   * Ensure state is initialized and reset if needed
   */
  private async ensureState(): Promise<QuotaState> {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentHour = now.getUTCHours();

    // Try to get cached state
    if (this.stateCache) {
      // Check if we need to reset daily counter
      if (this.stateCache.date !== today) {
        this.stateCache = {
          date: today,
          dailyCalls: 0,
          currentHour,
          hourlyCalls: 0,
          lastUpdated: now.toISOString(),
        };
        await this.state.storage.put('quota', this.stateCache);
        return this.stateCache;
      }

      // Check if we need to reset hourly counter
      if (this.stateCache.currentHour !== currentHour) {
        this.stateCache = {
          ...this.stateCache,
          currentHour,
          hourlyCalls: 0,
          lastUpdated: now.toISOString(),
        };
        await this.state.storage.put('quota', this.stateCache);
        return this.stateCache;
      }

      return this.stateCache;
    }

    // Try to load from storage
    const stored = await this.state.storage.get<QuotaState>('quota');

    if (stored) {
      // Check if we need to reset daily counter
      if (stored.date !== today) {
        this.stateCache = {
          date: today,
          dailyCalls: 0,
          currentHour,
          hourlyCalls: 0,
          lastUpdated: now.toISOString(),
        };
        await this.state.storage.put('quota', this.stateCache);
        return this.stateCache;
      }

      // Check if we need to reset hourly counter
      if (stored.currentHour !== currentHour) {
        this.stateCache = {
          ...stored,
          currentHour,
          hourlyCalls: 0,
          lastUpdated: now.toISOString(),
        };
        await this.state.storage.put('quota', this.stateCache);
        return this.stateCache;
      }

      this.stateCache = stored;
      return this.stateCache;
    }

    // Initialize new state
    this.stateCache = {
      date: today,
      dailyCalls: 0,
      currentHour,
      hourlyCalls: 0,
      lastUpdated: now.toISOString(),
    };
    await this.state.storage.put('quota', this.stateCache);
    return this.stateCache;
  }

  /**
   * Atomically increment counters and return quota status
   * 
   * This is the core atomic operation that ensures thread-safety.
   * All increments happen within this single-threaded Durable Object.
   */
  async increment(): Promise<IncrementResponse> {
    if (!this.config) {
      throw new Error('Quota Durable Object not configured');
    }

    // Ensure state is up to date (handles day/hour rollovers)
    const state = await this.ensureState();

    // Atomically increment counters
    state.dailyCalls++;
    state.hourlyCalls++;
    state.lastUpdated = new Date().toISOString();

    // Save updated state
    await this.state.storage.put('quota', state);
    this.stateCache = state;

    // Calculate remaining
    const dailyRemaining = this.config.dailyLimit - state.dailyCalls;
    const hourlyRemaining = this.config.hourlyLimit - state.hourlyCalls;

    // Check if we're over limits
    const allowed = dailyRemaining >= 0 && hourlyRemaining >= 0;

    // Check if we should alert
    const dailyPercentage = state.dailyCalls / this.config.dailyLimit;
    const shouldAlert = dailyPercentage >= this.config.alertThreshold;

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
      dailyCalls: state.dailyCalls,
      hourlyCalls: state.hourlyCalls,
    };
  }

  /**
   * Get current state without incrementing
   */
  async getState(): Promise<QuotaState> {
    return await this.ensureState();
  }

  /**
   * Handle HTTP requests (for direct access if needed)
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (path === '/increment' && request.method === 'POST') {
        const result = await this.increment();
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (path === '/state' && request.method === 'GET') {
        const state = await this.getState();
        return new Response(JSON.stringify(state), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (path === '/configure' && request.method === 'POST') {
        // Validate Content-Type header
        const contentType = request.headers.get('Content-Type');
        if (!contentType || !contentType.includes('application/json')) {
          return new Response(
            JSON.stringify({ error: 'Content-Type must be application/json' }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }

        // Parse JSON body with error handling
        let payload: unknown;
        try {
          payload = await request.json();
        } catch {
          return new Response(
            JSON.stringify({ error: 'Invalid JSON in request body' }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }

        // Validate the payload
        const validationResult = validateQuotaConfig(payload);
        if (!validationResult.valid) {
          return new Response(
            JSON.stringify({ error: validationResult.error }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }

        // Configuration is valid, apply it
        await this.configure(validationResult.config);
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response('Not found', { status: 404 });
    } catch (error) {
      console.error('Error in QuotaDurableObject:', error);
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

/**
 * Export the Durable Object class for Cloudflare Workers
 */
export default QuotaDurableObject;


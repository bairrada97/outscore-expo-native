/**
 * Metrics and Logging Utilities
 * 
 * Provides structured logging and metrics tracking for the API.
 * Can be extended to send metrics to external services.
 */

interface CacheMetrics {
  edgeHits: number;
  edgeMisses: number;
  kvHits: number;
  kvMisses: number;
  r2Hits: number;
  r2Misses: number;
  apiCalls: number;
}

interface ResponseTimeBuckets {
  under10ms: number;
  under50ms: number;
  under100ms: number;
  under500ms: number;
  over500ms: number;
}

interface MetricsState {
  cache: CacheMetrics;
  responseTimes: ResponseTimeBuckets;
  requestCount: number;
  errorCount: number;
  startTime: number;
}

/**
 * Global metrics state (resets on worker restart)
 */
let metricsState: MetricsState = {
  cache: {
    edgeHits: 0,
    edgeMisses: 0,
    kvHits: 0,
    kvMisses: 0,
    r2Hits: 0,
    r2Misses: 0,
    apiCalls: 0,
  },
  responseTimes: {
    under10ms: 0,
    under50ms: 0,
    under100ms: 0,
    under500ms: 0,
    over500ms: 0,
  },
  requestCount: 0,
  errorCount: 0,
  startTime: Date.now(),
};

/**
 * Record a cache hit
 */
export const recordCacheHit = (source: 'edge' | 'kv' | 'r2' | 'api'): void => {
  switch (source) {
    case 'edge':
      metricsState.cache.edgeHits++;
      break;
    case 'kv':
      metricsState.cache.kvHits++;
      break;
    case 'r2':
      metricsState.cache.r2Hits++;
      break;
    case 'api':
      metricsState.cache.apiCalls++;
      break;
  }
};

/**
 * Record a cache miss
 */
export const recordCacheMiss = (layer: 'edge' | 'kv' | 'r2'): void => {
  switch (layer) {
    case 'edge':
      metricsState.cache.edgeMisses++;
      break;
    case 'kv':
      metricsState.cache.kvMisses++;
      break;
    case 'r2':
      metricsState.cache.r2Misses++;
      break;
  }
};

/**
 * Record a response time
 */
export const recordResponseTime = (timeMs: number): void => {
  metricsState.requestCount++;

  if (timeMs < 10) {
    metricsState.responseTimes.under10ms++;
  } else if (timeMs < 50) {
    metricsState.responseTimes.under50ms++;
  } else if (timeMs < 100) {
    metricsState.responseTimes.under100ms++;
  } else if (timeMs < 500) {
    metricsState.responseTimes.under500ms++;
  } else {
    metricsState.responseTimes.over500ms++;
  }
};

/**
 * Record an error
 */
export const recordError = (): void => {
  metricsState.errorCount++;
};

/**
 * Get current metrics snapshot
 */
export const getMetrics = (): {
  cache: CacheMetrics & { hitRate: string };
  responseTimes: ResponseTimeBuckets & { p50Bucket: string };
  requests: { total: number; errors: number; errorRate: string };
  uptime: number;
} => {
  const totalCacheOperations =
    metricsState.cache.edgeHits +
    metricsState.cache.edgeMisses +
    metricsState.cache.kvHits +
    metricsState.cache.kvMisses +
    metricsState.cache.r2Hits +
    metricsState.cache.r2Misses;

  const totalHits =
    metricsState.cache.edgeHits +
    metricsState.cache.kvHits +
    metricsState.cache.r2Hits;

  const hitRate = totalCacheOperations > 0 
    ? ((totalHits / totalCacheOperations) * 100).toFixed(2) + '%'
    : 'N/A';

  // Calculate p50 bucket (simple approximation)
  const halfRequests = metricsState.requestCount / 2;
  let runningCount = 0;
  let p50Bucket = 'N/A';

  if (metricsState.requestCount > 0) {
    const buckets = [
      { name: '<10ms', count: metricsState.responseTimes.under10ms },
      { name: '<50ms', count: metricsState.responseTimes.under50ms },
      { name: '<100ms', count: metricsState.responseTimes.under100ms },
      { name: '<500ms', count: metricsState.responseTimes.under500ms },
      { name: '>500ms', count: metricsState.responseTimes.over500ms },
    ];

    for (const bucket of buckets) {
      runningCount += bucket.count;
      if (runningCount >= halfRequests) {
        p50Bucket = bucket.name;
        break;
      }
    }
  }

  const errorRate = metricsState.requestCount > 0
    ? ((metricsState.errorCount / metricsState.requestCount) * 100).toFixed(2) + '%'
    : '0%';

  return {
    cache: {
      ...metricsState.cache,
      hitRate,
    },
    responseTimes: {
      ...metricsState.responseTimes,
      p50Bucket,
    },
    requests: {
      total: metricsState.requestCount,
      errors: metricsState.errorCount,
      errorRate,
    },
    uptime: Date.now() - metricsState.startTime,
  };
};

/**
 * Reset metrics (useful for testing)
 */
export const resetMetrics = (): void => {
  metricsState = {
    cache: {
      edgeHits: 0,
      edgeMisses: 0,
      kvHits: 0,
      kvMisses: 0,
      r2Hits: 0,
      r2Misses: 0,
      apiCalls: 0,
    },
    responseTimes: {
      under10ms: 0,
      under50ms: 0,
      under100ms: 0,
      under500ms: 0,
      over500ms: 0,
    },
    requestCount: 0,
    errorCount: 0,
    startTime: Date.now(),
  };
};

/**
 * Log structured event
 */
export const logEvent = (
  event: string,
  data: Record<string, unknown> = {},
  level: 'info' | 'warn' | 'error' = 'info'
): void => {
  const logData = {
    timestamp: new Date().toISOString(),
    event,
    ...data,
  };

  switch (level) {
    case 'error':
      console.error(`❌ [${event}]`, JSON.stringify(logData));
      break;
    case 'warn':
      console.warn(`⚠️ [${event}]`, JSON.stringify(logData));
      break;
    default:
      console.log(`ℹ️ [${event}]`, JSON.stringify(logData));
  }
};

/**
 * Log cache operation
 */
export const logCacheOperation = (
  operation: 'get' | 'set' | 'delete',
  layer: 'edge' | 'kv' | 'r2',
  key: string,
  hit: boolean,
  durationMs?: number
): void => {
  if (operation === 'get') {
    if (hit) {
      recordCacheHit(layer);
    } else {
      recordCacheMiss(layer);
    }
  }

  logEvent('cache_operation', {
    operation,
    layer,
    key: key.slice(0, 50), // Truncate for logging
    hit,
    durationMs,
  });
};

/**
 * Log API call
 */
export const logApiCall = (
  endpoint: string,
  success: boolean,
  durationMs: number,
  error?: string
): void => {
  recordCacheHit('api'); // Count as API call

  logEvent('api_call', {
    endpoint,
    success,
    durationMs,
    error,
  }, success ? 'info' : 'error');
};

/**
 * Log request completion
 */
export const logRequest = (
  path: string,
  method: string,
  statusCode: number,
  durationMs: number,
  source?: string
): void => {
  recordResponseTime(durationMs);
  
  if (statusCode >= 500) {
    recordError();
  }

  logEvent('request', {
    path,
    method,
    statusCode,
    durationMs,
    source,
  }, statusCode >= 500 ? 'error' : 'info');
};


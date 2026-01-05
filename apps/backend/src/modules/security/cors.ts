import type { MiddlewareHandler } from 'hono';

/**
 * CORS configuration options
 */
interface CorsConfig {
  /**
   * Allowed origins (can be string, array, or function)
   */
  origins?: string | string[] | ((origin: string) => boolean);

  /**
   * Allowed HTTP methods
   */
  methods?: string[];

  /**
   * Allowed headers
   */
  allowedHeaders?: string[];

  /**
   * Exposed headers (visible to client)
   */
  exposedHeaders?: string[];

  /**
   * Whether to allow credentials
   */
  credentials?: boolean;

  /**
   * Preflight cache time in seconds
   */
  maxAge?: number;
}

/**
 * Default allowed origins
 */
const defaultOrigins = [
  'https://outscore.live',
  'https://www.outscore.live',
  'http://localhost:3000',
  'http://localhost:8081',
  'exp://127.0.0.1:8081', // Expo development server (iOS simulator)
  'exp://localhost:8081', // Expo development server (alternative)
  'http://10.0.2.2:3000', // Android emulator
  'http://10.0.2.2:8081', // Android emulator (alternative)
  'https://outscore-native-expo--h69qqvvhew.expo.app', 
  // Expo development server (alternative)
];

/**
 * Allowed Expo origin patterns
 * Only accept exp:// protocol origins for security
 */
const ALLOWED_EXPO_ORIGINS = [
  'exp://127.0.0.1:8081', // Expo development server (iOS simulator)
  'exp://localhost:8081', // Expo development server (alternative)
] as const;

/**
 * Check if origin is from Expo Go (strict check)
 * Only accepts exp:// protocol origins to avoid matching unrelated hosts
 */
const isExpoOrigin = (origin: string): boolean => {
  if (!origin) return false;
  // Only accept exp:// protocol origins
  return origin.startsWith('exp://');
};

/**
 * Check if origin is allowed
 */
const isOriginAllowed = (
  origin: string,
  allowedOrigins: string | string[] | ((origin: string) => boolean)
): boolean => {
  // Allow requests with no origin (e.g., native apps, Postman, curl)
  if (!origin || origin === 'null') {
    return true;
  }

  if (typeof allowedOrigins === 'function') {
    return allowedOrigins(origin);
  }

  if (typeof allowedOrigins === 'string') {
    return allowedOrigins === '*' || allowedOrigins === origin;
  }

  // Check exact match
  if (allowedOrigins.includes(origin)) {
    return true;
  }

  // Check if it's an Expo origin and we have any exp:// origins configured
  if (isExpoOrigin(origin)) {
    const hasExpoOrigins = allowedOrigins.some((o) => o.startsWith('exp://'));
    if (hasExpoOrigins) {
      return true; // Allow any exp:// origin if we have exp:// origins configured
    }
  }

  return false;
};

/**
 * Check if origins configuration contains a wildcard
 */
const hasWildcardOrigin = (origins: string | string[] | ((origin: string) => boolean) | undefined): boolean => {
  return origins === '*' || (Array.isArray(origins) && origins.includes('*'));
};

/**
 * Get the Access-Control-Allow-Origin header value and Vary header flag
 * @returns Object with origin value (or null if not allowed) and shouldVary flag
 */
const getAllowedOriginHeader = (
  origins: string | string[] | ((origin: string) => boolean),
  requestOrigin: string
): { origin: string | null; shouldVary: boolean } => {
  // Check for wildcard (simplified: origins === '*' handles the string case)
  if (origins === '*') {
    return { origin: '*', shouldVary: false };
  }

  // Check if request origin is allowed
  if (requestOrigin && isOriginAllowed(requestOrigin, origins)) {
    return { origin: requestOrigin, shouldVary: true };
  }

  return { origin: null, shouldVary: false };
};

/**
 * CORS middleware
 */
export const cors = (config: CorsConfig = {}): MiddlewareHandler => {
  const {
    origins = defaultOrigins,
    methods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders = ['Content-Type', 'Authorization', 'X-API-Key'],
    exposedHeaders = [
      'X-Response-Time',
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
      'X-Source',
    ],
    credentials = false,
    maxAge = 86400, // 24 hours
  } = config;

  // Validate configuration at startup: credentials cannot be used with wildcard origins
  if (credentials && hasWildcardOrigin(origins)) {
    throw new Error(
      'CORS configuration error: Access-Control-Allow-Credentials cannot be set to true when origins is "*" or contains "*". ' +
      'Either set credentials to false or specify explicit origins instead of using a wildcard.'
    );
  }

  return async (context, next) => {
    const requestOrigin = context.req.header('origin') || '';
    
    // Debug logging for Expo Go (only in non-production)
    if (process.env.NODE_ENV !== 'production' && requestOrigin && requestOrigin.startsWith('exp://')) {
      console.log(`[CORS] Expo origin detected: ${requestOrigin}`);
    }

    // Handle preflight OPTIONS request
    if (context.req.method === 'OPTIONS') {
      const headers: Record<string, string> = {
        'Access-Control-Allow-Methods': methods.join(', '),
        'Access-Control-Allow-Headers': allowedHeaders.join(', '),
        'Access-Control-Max-Age': maxAge.toString(),
      };

      // Set origin header
      const { origin: allowedOrigin, shouldVary } = getAllowedOriginHeader(origins, requestOrigin);
      const isWildcardOrigin = allowedOrigin === '*';
      if (allowedOrigin) {
        headers['Access-Control-Allow-Origin'] = allowedOrigin;
        if (shouldVary) {
          headers['Vary'] = 'Origin';
        }
      }

      // Guard: Never send credentials with wildcard origin (invalid per CORS spec)
      if (credentials && !isWildcardOrigin) {
        headers['Access-Control-Allow-Credentials'] = 'true';
      } else if (credentials && isWildcardOrigin) {
        console.warn(
          '[CORS] Warning: Access-Control-Allow-Credentials is ignored because Access-Control-Allow-Origin is "*". ' +
          'This is invalid per CORS specification. Consider fixing your CORS configuration.'
        );
      }

      return new Response(null, {
        status: 204,
        headers,
      });
    }

    // Process request
    await next();

    // Add CORS headers to response
    const { origin: allowedOrigin, shouldVary } = getAllowedOriginHeader(origins, requestOrigin);
    const isWildcardOrigin = allowedOrigin === '*';
    if (allowedOrigin) {
      context.header('Access-Control-Allow-Origin', allowedOrigin);
      if (shouldVary) {
        context.header('Vary', 'Origin');
      }
    }

    context.header('Access-Control-Allow-Methods', methods.join(', '));
    context.header('Access-Control-Expose-Headers', exposedHeaders.join(', '));

    // Guard: Never send credentials with wildcard origin (invalid per CORS spec)
    if (credentials && !isWildcardOrigin) {
      context.header('Access-Control-Allow-Credentials', 'true');
    } else if (credentials && isWildcardOrigin) {
      console.warn(
        '[CORS] Warning: Access-Control-Allow-Credentials is ignored because Access-Control-Allow-Origin is "*". ' +
        'This is invalid per CORS specification. Consider fixing your CORS configuration.'
      );
    }
  };
};

/**
 * Create CORS middleware with environment-based origins
 */
export const createCors = (envOrigins?: string): MiddlewareHandler => {
  const origins = envOrigins ? envOrigins.split(',').map((origin) => origin.trim()) : defaultOrigins;

  return cors({ origins });
};


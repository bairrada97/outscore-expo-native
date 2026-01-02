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
  'http://10.0.2.2:3000', // Android emulator
];

/**
 * Check if origin is allowed
 */
const isOriginAllowed = (
  origin: string,
  allowedOrigins: string | string[] | ((origin: string) => boolean)
): boolean => {
  if (typeof allowedOrigins === 'function') {
    return allowedOrigins(origin);
  }

  if (typeof allowedOrigins === 'string') {
    return allowedOrigins === '*' || allowedOrigins === origin;
  }

  return allowedOrigins.includes(origin);
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

  return async (context, next) => {
    const requestOrigin = context.req.header('origin') || '';

    // Handle preflight OPTIONS request
    if (context.req.method === 'OPTIONS') {
      const headers: Record<string, string> = {
        'Access-Control-Allow-Methods': methods.join(', '),
        'Access-Control-Allow-Headers': allowedHeaders.join(', '),
        'Access-Control-Max-Age': maxAge.toString(),
      };

      // Set origin header
      if (origins === '*' || (typeof origins === 'string' && origins === '*')) {
        headers['Access-Control-Allow-Origin'] = '*';
      } else if (requestOrigin && isOriginAllowed(requestOrigin, origins)) {
        headers['Access-Control-Allow-Origin'] = requestOrigin;
        headers['Vary'] = 'Origin';
      }

      if (credentials) {
        headers['Access-Control-Allow-Credentials'] = 'true';
      }

      return new Response(null, {
        status: 204,
        headers,
      });
    }

    // Process request
    await next();

    // Add CORS headers to response
    if (origins === '*' || (typeof origins === 'string' && origins === '*')) {
      context.header('Access-Control-Allow-Origin', '*');
    } else if (requestOrigin && isOriginAllowed(requestOrigin, origins)) {
      context.header('Access-Control-Allow-Origin', requestOrigin);
      context.header('Vary', 'Origin');
    }

    context.header('Access-Control-Allow-Methods', methods.join(', '));
    context.header('Access-Control-Expose-Headers', exposedHeaders.join(', '));

    if (credentials) {
      context.header('Access-Control-Allow-Credentials', 'true');
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


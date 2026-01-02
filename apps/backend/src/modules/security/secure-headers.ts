import type { MiddlewareHandler } from 'hono';

/**
 * Secure headers configuration
 */
interface SecureHeadersConfig {
  /**
   * Strict-Transport-Security header value
   */
  hsts?: string | false;

  /**
   * X-Content-Type-Options header value
   */
  contentTypeOptions?: string | false;

  /**
   * X-Frame-Options header value
   */
  frameOptions?: string | false;

  /**
   * X-XSS-Protection header value
   */
  xssProtection?: string | false;

  /**
   * Content-Security-Policy header value
   */
  contentSecurityPolicy?: string | false;

  /**
   * Referrer-Policy header value
   */
  referrerPolicy?: string | false;
}

/**
 * Default secure headers configuration
 */
const defaultConfig: Omit<Required<SecureHeadersConfig>, 'xssProtection'> = {
  hsts: 'max-age=63072000; includeSubDomains; preload',
  contentTypeOptions: 'nosniff',
  frameOptions: 'DENY',
  contentSecurityPolicy: "default-src 'self'",
  referrerPolicy: 'strict-origin-when-cross-origin',
};

/**
 * Secure headers middleware
 * Adds security-related HTTP headers to responses
 */
export const secureHeaders = (config: SecureHeadersConfig = {}): MiddlewareHandler => {
  const mergedConfig = { ...defaultConfig, ...config };

  return async (context, next) => {
    await next();

    // Add security headers
    if (mergedConfig.hsts) {
      context.header('Strict-Transport-Security', mergedConfig.hsts);
    }

    if (mergedConfig.contentTypeOptions) {
      context.header('X-Content-Type-Options', mergedConfig.contentTypeOptions);
    }

    if (mergedConfig.frameOptions) {
      context.header('X-Frame-Options', mergedConfig.frameOptions);
    }

    if (mergedConfig.xssProtection) {
      context.header('X-XSS-Protection', mergedConfig.xssProtection);
    }

    if (mergedConfig.contentSecurityPolicy) {
      context.header('Content-Security-Policy', mergedConfig.contentSecurityPolicy);
    }

    if (mergedConfig.referrerPolicy) {
      context.header('Referrer-Policy', mergedConfig.referrerPolicy);
    }
  };
};


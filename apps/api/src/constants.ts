/**
 * Named constants for the Nibras API.
 */

/** Default global rate-limit: requests per minute per token/IP. */
export const DEFAULT_RATE_LIMIT_MAX = 100;

/** Rate-limit time window. */
export const RATE_LIMIT_TIME_WINDOW = '1 minute';

/** Default connection timeout for Fastify (ms). */
export const DEFAULT_CONNECTION_TIMEOUT_MS = 10_000;

/** Default request timeout for Fastify (ms). */
export const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;

/** Default body size limit for Fastify (bytes). 512 KB. */
export const DEFAULT_BODY_LIMIT_BYTES = 524_288;

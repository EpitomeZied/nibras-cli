/**
 * Shared queue constants and connection helper.
 * Used by both the BullMQ producer (API) and the BullMQ consumer (worker).
 */

export const VERIFICATION_QUEUE_NAME = 'nibras:verification';

export type VerificationJobPayload = {
  jobId: string;
  submissionAttemptId: string;
  attempt: number;
  maxAttempts: number;
};

/** Parse a redis:// or rediss:// URL into a BullMQ-compatible connection object. */
export function parseRedisUrl(url: string): {
  host: string;
  port: number;
  password?: string;
  tls?: Record<string, never>;
} {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port) || 6379,
    password: parsed.password || undefined,
    tls: parsed.protocol === 'rediss:' ? ({} as Record<string, never>) : undefined,
  };
}

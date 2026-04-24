/**
 * Named constants for the Nibras worker.
 * Centralised here to make timeouts and limits easy to discover and adjust.
 */

/** Maximum age of a running job before it is considered stale and re-queued. */
export const MAX_CLAIM_AGE_MS = 5 * 60_000; // 5 minutes

/** Default interval between DB-polling ticks when Redis is not configured. */
export const DEFAULT_POLL_INTERVAL_MS = 2_000; // 2 seconds

/** Default HTTP port for the worker health server. */
export const DEFAULT_HEALTH_PORT = 9_090;

/** Maximum student year level before auto-promotion stops. */
export const MAX_STUDENT_LEVEL = 4;

/** Timeout for git-clone during AI grading (ms). */
export const GIT_CLONE_TIMEOUT_MS = 60_000; // 60 seconds

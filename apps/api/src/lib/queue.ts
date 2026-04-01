/**
 * BullMQ producer for the API process.
 *
 * Enqueues verification jobs to Redis when REDIS_URL is set.
 * When Redis is not configured this is a no-op — the worker falls back to
 * polling the VerificationJob table directly (SELECT FOR UPDATE SKIP LOCKED).
 */
import { Queue } from 'bullmq';

const VERIFICATION_QUEUE_NAME = 'nibras:verification';

type RedisConnection = { host: string; port: number; password?: string };

function parseRedisUrl(url: string): RedisConnection {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port) || 6379,
    password: parsed.password || undefined,
  };
}

let _queue: Queue | null = null;

function getQueue(): Queue | null {
  if (!process.env.REDIS_URL) return null;
  if (!_queue) {
    _queue = new Queue(VERIFICATION_QUEUE_NAME, {
      connection: parseRedisUrl(process.env.REDIS_URL),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 200 },
      },
    });
    _queue.on('error', (err) => {
      // Log but don't crash — worker will pick up via DB polling as fallback
      console.error(JSON.stringify({ level: 'error', msg: 'BullMQ queue error', error: err.message }));
    });
  }
  return _queue;
}

export type VerificationJobPayload = {
  jobId: string;
  submissionAttemptId: string;
  attempt: number;
  maxAttempts: number;
};

/**
 * Enqueue a verification job to Redis.
 * No-op when REDIS_URL is not set (DB polling worker will handle it).
 */
export async function enqueueVerificationJob(data: VerificationJobPayload): Promise<void> {
  const queue = getQueue();
  if (!queue) return;
  try {
    await queue.add('verify', data, {
      jobId: data.jobId, // Idempotent deduplication by VerificationJob DB id
    });
  } catch {
    // Redis unavailable — the DB polling worker will claim the job
  }
}

/** Close the queue connection gracefully (called on API shutdown). */
export async function closeQueue(): Promise<void> {
  if (_queue) {
    await _queue.close();
    _queue = null;
  }
}

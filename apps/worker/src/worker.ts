import { Prisma, PrismaClient, SubmissionStatus } from "@prisma/client";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";

const POLL_INTERVAL_MS = parseInt(process.env.WORKER_POLL_INTERVAL_MS || "2000", 10);
const HEALTH_PORT = parseInt(process.env.WORKER_HEALTH_PORT || "9090", 10);
const MAX_CLAIM_AGE_MS = 5 * 60_000;

let shuttingDown = false;

type ClaimedJob = {
  id: string;
  submissionAttemptId: string;
  attempt: number;
  maxAttempts: number;
};

function log(level: "info" | "warn" | "error", message: string, extra?: Record<string, unknown>) {
  const entry = {
    level,
    time: new Date().toISOString(),
    pid: process.pid,
    msg: message,
    ...extra
  };
  process.stdout.write(JSON.stringify(entry) + "\n");
}

async function claimJob(
  prisma: PrismaClient
): Promise<ClaimedJob | null> {
  const staleBefore = new Date(Date.now() - MAX_CLAIM_AGE_MS);
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.$queryRaw<ClaimedJob[]>(Prisma.sql`
      WITH candidate AS (
        SELECT id
        FROM "VerificationJob"
        WHERE
          "status" = 'queued'::"SubmissionStatus"
          OR (
            "status" = 'running'::"SubmissionStatus"
            AND "claimedAt" IS NOT NULL
            AND "claimedAt" < ${staleBefore}
          )
        ORDER BY "createdAt" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      ),
      claimed AS (
        UPDATE "VerificationJob"
        SET
          "status" = 'running'::"SubmissionStatus",
          "claimedAt" = NOW(),
          "finishedAt" = NULL,
          "updatedAt" = NOW()
        WHERE id IN (SELECT id FROM candidate)
        RETURNING id, "submissionAttemptId", attempt, "maxAttempts"
      )
      SELECT * FROM claimed
    `);
    const job = claimed[0] || null;
    if (!job) {
      return null;
    }

    await tx.submissionAttempt.update({
      where: { id: job.submissionAttemptId },
      data: {
        status: SubmissionStatus.running,
        summary: "Verification is running."
      }
    });
    await tx.verificationRun.updateMany({
      where: {
        submissionAttemptId: job.submissionAttemptId,
        attempt: job.attempt,
        startedAt: null
      },
      data: {
        status: SubmissionStatus.running,
        startedAt: new Date(),
        log: "Verification is running."
      }
    });
    return job;
  });
}

async function runVerification(
  submissionAttemptId: string,
  prisma: PrismaClient
): Promise<{ exitCode: number; log: string }> {
  // Fetch the submission context
  const attempt = await prisma.submissionAttempt.findUniqueOrThrow({
    where: { id: submissionAttemptId },
    include: {
      project: {
        include: {
          releases: { orderBy: { createdAt: "desc" }, take: 1 }
        }
      },
      userProjectRepo: true
    }
  });

  const manifest = attempt.project.releases[0]?.manifestJson as
    | { test?: { command?: string } }
    | null;
  const testCommand = manifest?.test?.command || "npm test";

  // If there are stored local test results, use them directly without re-running.
  if (attempt.localTestExitCode !== null) {
    return {
      exitCode: attempt.localTestExitCode,
      log: `Using stored local test result. Exit code: ${attempt.localTestExitCode}`
    };
  }

  // Otherwise run the test command against the repo URL.
  // For now this is a placeholder shell exec; in a real deploy this would
  // clone the repo into a sandbox and execute the command there.
  const cloneUrl = attempt.userProjectRepo.cloneUrl;
  if (!cloneUrl) {
    return {
      exitCode: 1,
      log: "No clone URL available for verification."
    };
  }

  const verificationId = randomUUID();
  const workDir = `/tmp/nibras-verify-${verificationId}`;
  const cloneResult = spawnSync("git", ["clone", "--depth", "1", "--branch", attempt.branch, cloneUrl, workDir], {
    encoding: "utf8",
    timeout: 60_000
  });
  if (cloneResult.status !== 0) {
    return {
      exitCode: cloneResult.status ?? 1,
      log: `git clone failed:\n${cloneResult.stderr}`
    };
  }

  const testParts = testCommand.split(" ");
  const testResult = spawnSync(testParts[0], testParts.slice(1), {
    cwd: workDir,
    encoding: "utf8",
    timeout: 120_000
  });

  spawnSync("rm", ["-rf", workDir]);

  return {
    exitCode: testResult.status ?? 1,
    log: [testResult.stdout, testResult.stderr].filter(Boolean).join("\n")
  };
}

async function finalizeJob(
  jobId: string,
  submissionAttemptId: string,
  attempt: number,
  exitCode: number,
  verificationLog: string,
  prisma: PrismaClient
): Promise<void> {
  const finalStatus = exitCode === 0 ? SubmissionStatus.passed : SubmissionStatus.failed;
  const summary =
    exitCode === 0 ? "Verification passed." : "Verification failed.";

  await prisma.$transaction([
    prisma.verificationJob.update({
      where: { id: jobId },
      data: {
        status: finalStatus,
        claimedAt: null,
        finishedAt: new Date()
      }
    }),
    prisma.verificationRun.update({
      where: {
        submissionAttemptId_attempt: {
          submissionAttemptId,
          attempt
        }
      },
      data: {
        status: finalStatus,
        log: verificationLog,
        finishedAt: new Date()
      }
    }),
    prisma.submissionAttempt.update({
      where: { id: submissionAttemptId },
      data: { status: finalStatus, summary }
    })
  ]);
}

async function failJob(
  jobId: string,
  submissionAttemptId: string,
  attempt: number,
  maxAttempts: number,
  errorMessage: string,
  prisma: PrismaClient
): Promise<void> {
  const nextAttempt = attempt + 1;
  const exhausted = nextAttempt >= maxAttempts;
  const nextStatus = exhausted ? SubmissionStatus.failed : SubmissionStatus.queued;
  const summary = exhausted
    ? `Verification failed after ${maxAttempts} attempts: ${errorMessage}`
    : `Attempt ${nextAttempt}/${maxAttempts} failed, will retry: ${errorMessage}`;
  await prisma.$transaction(async (tx) => {
    await tx.verificationJob.update({
      where: { id: jobId },
      data: {
        status: nextStatus,
        attempt: nextAttempt,
        claimedAt: null,
        finishedAt: exhausted ? new Date() : null
      }
    });
    await tx.verificationRun.update({
      where: {
        submissionAttemptId_attempt: {
          submissionAttemptId,
          attempt
        }
      },
      data: {
        status: exhausted ? SubmissionStatus.failed : SubmissionStatus.queued,
        log: errorMessage,
        finishedAt: exhausted ? new Date() : null
      }
    });
    if (!exhausted) {
      await tx.verificationRun.create({
        data: {
          submissionAttemptId,
          attempt: nextAttempt,
          status: SubmissionStatus.queued,
          log: "Queued for retry"
        }
      });
    }
    await tx.submissionAttempt.update({
      where: { id: submissionAttemptId },
      data: {
        status: exhausted ? SubmissionStatus.failed : SubmissionStatus.queued,
        summary
      }
    });
  });
}

async function tick(prisma: PrismaClient): Promise<void> {
  const job = await claimJob(prisma);
  if (!job) {
    return;
  }
  log("info", "Claimed job", { jobId: job.id, submissionAttemptId: job.submissionAttemptId });

  try {
    const { exitCode, log: verificationLog } = await runVerification(job.submissionAttemptId, prisma);
    await finalizeJob(job.id, job.submissionAttemptId, job.attempt, exitCode, verificationLog, prisma);
    log("info", "Job completed", { jobId: job.id, exitCode });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log("error", "Job failed", { jobId: job.id, error: message });
    await failJob(job.id, job.submissionAttemptId, job.attempt, job.maxAttempts, message, prisma);
  }
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  const healthServer = createServer((request, response) => {
    if (request.url === "/healthz") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ ok: true }));
      return;
    }
    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "Not found" }));
  });

  process.on("SIGTERM", () => {
    log("info", "Received SIGTERM, draining and shutting down");
    shuttingDown = true;
  });
  process.on("SIGINT", () => {
    log("info", "Received SIGINT, draining and shutting down");
    shuttingDown = true;
  });

  await new Promise<void>((resolve) => {
    healthServer.listen(HEALTH_PORT, "0.0.0.0", resolve);
  });
  log("info", "Worker started", { pollIntervalMs: POLL_INTERVAL_MS });

  while (!shuttingDown) {
    try {
      await tick(prisma);
    } catch (err) {
      log("error", "Unexpected error in worker tick", {
        error: err instanceof Error ? err.message : String(err)
      });
    }
    if (!shuttingDown) {
      await new Promise<void>((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }

  await prisma.$disconnect();
  await new Promise<void>((resolve, reject) => {
    healthServer.close((error) => error ? reject(error) : resolve());
  });
  log("info", "Worker shut down cleanly");
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Worker crashed:", err);
  process.exit(1);
});

import { execFile } from "node:child_process";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { Prisma, PrismaClient, SubmissionStatus } from "@prisma/client";
import { createServer } from "node:http";
import * as Sentry from "@sentry/node";
import { gradeSemanticAnswer, type AiConfig, type GradingQuestion, type AiGradeResult } from "@nibras/grading";
import {
  loadGitHubAppConfig,
  createInstallationAccessToken,
  postCommitStatus,
  type CommitStatusState
} from "@nibras/github";
import {
  sendSubmissionStatusEmail,
  sendReviewReadyEmail
} from "./email";
import { runSandboxed } from "./sandbox";

const execFileAsync = promisify(execFile);

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
    tracesSampleRate: 0.1
  });
}

const POLL_INTERVAL_MS = parseInt(process.env.WORKER_POLL_INTERVAL_MS || "2000", 10);
const HEALTH_PORT = parseInt(process.env.WORKER_HEALTH_PORT || "9090", 10);
const MAX_CLAIM_AGE_MS = 5 * 60_000;

let shuttingDown = false;

type ClaimedJob = {
  id: string;
  submissionAttemptId: string;
  traceId: string;
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
        RETURNING id, "submissionAttemptId", "traceId", attempt, "maxAttempts"
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

  // Run the test command in an isolated sandbox (ulimit + optional network namespace).
  const cloneUrl = attempt.userProjectRepo.cloneUrl;
  if (!cloneUrl) {
    return {
      exitCode: 1,
      log: "No clone URL available for verification."
    };
  }

  return runSandboxed(cloneUrl, attempt.branch, testCommand);
}

type AiRunResult = {
  gradeResult: AiGradeResult;
  model: string;
  gradedAt: Date;
  reviewRequired: boolean;
};

function loadAiConfig(): AiConfig | null {
  const apiKey = process.env.NIBRAS_AI_API_KEY;
  if (!apiKey) return null;
  const model = process.env.NIBRAS_AI_MODEL;
  if (!model) return null;
  return {
    apiKey,
    model,
    baseUrl: process.env.NIBRAS_AI_BASE_URL,
    timeoutMs: process.env.NIBRAS_AI_TIMEOUT_MS ? Number(process.env.NIBRAS_AI_TIMEOUT_MS) : undefined,
    maxRetries: process.env.NIBRAS_AI_MAX_RETRIES ? Number(process.env.NIBRAS_AI_MAX_RETRIES) : undefined,
    minConfidence: process.env.NIBRAS_AI_MIN_CONFIDENCE ? Number(process.env.NIBRAS_AI_MIN_CONFIDENCE) : undefined
  };
}

async function runAiGrading(
  submissionAttemptId: string,
  prisma: PrismaClient
): Promise<AiRunResult | null> {
  const aiConfig = loadAiConfig();
  if (!aiConfig) return null;

  const attempt = await prisma.submissionAttempt.findUniqueOrThrow({
    where: { id: submissionAttemptId },
    include: {
      project: {
        include: { releases: { orderBy: { createdAt: "desc" }, take: 1 } }
      },
      userProjectRepo: true
    }
  });

  type ManifestJson = {
    projectKey?: string;
    grading?: {
      questions: Array<{
        id: string;
        mode: string;
        prompt?: string;
        points: number;
        answerFile: string;
        rubric?: Array<{ id: string; description: string; points: number }>;
        examples?: Array<{ label: string; answer: string }>;
        minConfidence?: number;
      }>;
    };
  };

  const manifest = attempt.project.releases[0]?.manifestJson as ManifestJson | null;
  const gradingConfig = manifest?.grading;
  if (!gradingConfig) return null;

  const semanticQuestions = gradingConfig.questions.filter(
    (q) => q.mode === "semantic" && Array.isArray(q.rubric) && q.rubric.length > 0
  );
  if (semanticQuestions.length === 0) return null;

  const cloneUrl = attempt.userProjectRepo.cloneUrl;
  if (!cloneUrl) return null;

  const tmpDir = await mkdtemp(join(tmpdir(), "nibras-ai-"));
  try {
    await execFileAsync("git", ["clone", "--depth=1", "--branch", attempt.branch, cloneUrl, tmpDir], {
      timeout: 60_000
    });

    const projectKey = manifest?.projectKey ?? attempt.project.slug;
    const minConfidence = aiConfig.minConfidence ?? 0.8;

    let totalEarned = 0;
    let anyNeedsReview = false;
    const allCriterionScores: AiGradeResult["criterionScores"] = [];
    const allEvidenceQuotes: string[] = [];
    let lastResult: AiGradeResult | null = null;

    for (const q of semanticQuestions) {
      const answerPath = join(tmpDir, q.answerFile);
      let answerText: string;
      try {
        answerText = await readFile(answerPath, "utf8");
      } catch {
        log("warn", "AI grading: answer file not found", { answerFile: q.answerFile, questionId: q.id });
        continue;
      }

      const question: GradingQuestion = {
        id: q.id,
        prompt: q.prompt ?? q.id,
        points: q.points,
        rubric: q.rubric ?? [],
        examples: q.examples,
        minConfidence: q.minConfidence
      };

      try {
        const result = await gradeSemanticAnswer({
          aiConfig,
          subject: "Programming",
          project: projectKey,
          question,
          answerText
        });

        totalEarned += result.score;
        allCriterionScores.push(...result.criterionScores);
        allEvidenceQuotes.push(...result.evidenceQuotes);
        if (result.needsReview || result.confidence < (q.minConfidence ?? minConfidence)) {
          anyNeedsReview = true;
        }
        lastResult = result;
      } catch (err) {
        log("warn", "AI grading failed for question", {
          questionId: q.id,
          error: err instanceof Error ? err.message : String(err)
        });
        anyNeedsReview = true;
      }
    }

    if (!lastResult) return null;

    const aggregated: AiGradeResult = {
      score: totalEarned,
      confidence: lastResult.confidence,
      needsReview: anyNeedsReview,
      criterionScores: allCriterionScores,
      reasoningSummary: lastResult.reasoningSummary,
      evidenceQuotes: allEvidenceQuotes
    };

    return {
      gradeResult: aggregated,
      model: aiConfig.model,
      gradedAt: new Date(),
      reviewRequired: anyNeedsReview
    };
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}

async function postJobCommitStatus(
  submissionAttemptId: string,
  finalStatus: SubmissionStatus,
  prisma: PrismaClient
): Promise<void> {
  const ghConfig = loadGitHubAppConfig();
  if (!ghConfig) return;

  const attempt = await prisma.submissionAttempt.findUnique({
    where: { id: submissionAttemptId },
    select: {
      commitSha: true,
      userProjectRepo: { select: { owner: true, name: true } },
      user: { select: { githubAccount: { select: { installationId: true } } } }
    }
  });

  const installationId = attempt?.user.githubAccount?.installationId;
  if (!attempt || !installationId) return;

  const stateMap: Record<SubmissionStatus, CommitStatusState> = {
    passed: "success",
    failed: "failure",
    needs_review: "pending",
    queued: "pending",
    running: "pending"
  };
  const descriptionMap: Record<SubmissionStatus, string> = {
    passed: "All tests passed",
    failed: "Tests failed",
    needs_review: "Tests passed — awaiting instructor review",
    queued: "Queued for verification",
    running: "Verification running"
  };

  const webBaseUrl = process.env.NIBRAS_WEB_BASE_URL;
  const targetUrl = webBaseUrl ? `${webBaseUrl}/submissions/${submissionAttemptId}` : undefined;

  try {
    const token = await createInstallationAccessToken(ghConfig, installationId);
    await postCommitStatus(
      ghConfig,
      token,
      attempt.userProjectRepo.owner,
      attempt.userProjectRepo.name,
      attempt.commitSha,
      stateMap[finalStatus],
      { description: descriptionMap[finalStatus], targetUrl, context: "nibras/verification" }
    );
  } catch (err) {
    // Non-fatal: log and continue — a failed status post must not break the submission record
    log("warn", "Failed to post GitHub commit status", {
      submissionAttemptId,
      error: err instanceof Error ? err.message : String(err)
    });
  }
}

async function finalizeJob(
  jobId: string,
  submissionAttemptId: string,
  attempt: number,
  exitCode: number,
  verificationLog: string,
  aiResult: AiRunResult | null,
  prisma: PrismaClient
): Promise<void> {
  const verificationPassed = exitCode === 0;
  const finalStatus = !verificationPassed
    ? SubmissionStatus.failed
    : aiResult?.reviewRequired
      ? SubmissionStatus.needs_review
      : SubmissionStatus.passed;

  const summary = !verificationPassed
    ? "Verification failed."
    : aiResult?.reviewRequired
      ? "Verification passed — AI flagged for human review."
      : "Verification passed.";

  await prisma.$transaction(async (tx) => {
    await tx.verificationJob.update({
      where: { id: jobId },
      data: { status: finalStatus, claimedAt: null, finishedAt: new Date() }
    });
    await tx.verificationRun.update({
      where: { submissionAttemptId_attempt: { submissionAttemptId, attempt } },
      data: { status: finalStatus, log: verificationLog, finishedAt: new Date() }
    });
    await tx.submissionAttempt.update({
      where: { id: submissionAttemptId },
      data: { status: finalStatus, summary }
    });

    // Create a draft review with AI results when AI grading ran
    if (verificationPassed && aiResult) {
      const r = aiResult.gradeResult;
      // Use a system user id (first admin or fallback to the submission's user)
      const submission = await tx.submissionAttempt.findUniqueOrThrow({
        where: { id: submissionAttemptId },
        select: { userId: true }
      });
      await tx.review.create({
        data: {
          submissionAttemptId,
          reviewerUserId: submission.userId,
          status: "pending",
          score: r.score,
          feedback: r.reasoningSummary,
          rubricJson: [],
          aiConfidence: r.confidence,
          aiNeedsReview: r.needsReview,
          aiReasoningSummary: r.reasoningSummary,
          aiCriterionScores: r.criterionScores,
          aiEvidenceQuotes: r.evidenceQuotes,
          aiModel: aiResult.model,
          aiGradedAt: aiResult.gradedAt
        }
      });
    }
  });

  await postJobCommitStatus(submissionAttemptId, finalStatus, prisma);
  await sendSubmissionEmails(submissionAttemptId, finalStatus, prisma);
}

async function sendSubmissionEmails(
  submissionAttemptId: string,
  finalStatus: SubmissionStatus,
  prisma: PrismaClient
): Promise<void> {
  if (finalStatus === SubmissionStatus.queued || finalStatus === SubmissionStatus.running) return;

  const webBaseUrl = process.env.NIBRAS_WEB_BASE_URL;
  const submissionUrl = webBaseUrl ? `${webBaseUrl}/submissions/${submissionAttemptId}` : "";

  try {
    const attempt = await prisma.submissionAttempt.findUnique({
      where: { id: submissionAttemptId },
      select: {
        user: { select: { email: true, username: true } },
        project: {
          select: {
            name: true,
            course: {
              select: {
                memberships: {
                  where: { role: { in: ["instructor", "ta"] } },
                  select: { user: { select: { email: true, username: true } } }
                }
              }
            }
          }
        }
      }
    });
    if (!attempt) return;

    const studentEmail = attempt.user.email;
    const studentName = attempt.user.username;
    const projectName = attempt.project.name;

    // Notify student
    await sendSubmissionStatusEmail({
      studentEmail,
      studentName,
      projectName,
      status: finalStatus as "passed" | "failed" | "needs_review",
      submissionUrl
    });

    // Notify instructors when human review is required
    if (finalStatus === SubmissionStatus.needs_review) {
      const reviewQueueUrl = webBaseUrl ? `${webBaseUrl}/review-queue` : "";
      const instructors = attempt.project.course?.memberships ?? [];
      await Promise.allSettled(
        instructors.map((m) =>
          sendReviewReadyEmail({
            instructorEmail: m.user.email,
            instructorName: m.user.username,
            studentName,
            projectName,
            reviewQueueUrl
          })
        )
      );
    }
  } catch (err) {
    log("warn", "Failed to send submission emails", {
      submissionAttemptId,
      error: err instanceof Error ? err.message : String(err)
    });
  }
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
  log("info", "Claimed job", { jobId: job.id, traceId: job.traceId, submissionAttemptId: job.submissionAttemptId });

  const transaction = process.env.SENTRY_DSN
    ? Sentry.startInactiveSpan({ name: "verification-job", op: "worker.job" })
    : null;

  try {
    const { exitCode, log: verificationLog } = await runVerification(job.submissionAttemptId, prisma);
    let aiResult: AiRunResult | null = null;
    if (exitCode === 0) {
      try {
        aiResult = await runAiGrading(job.submissionAttemptId, prisma);
      } catch (err) {
        log("warn", "AI grading error (non-fatal)", {
          jobId: job.id, traceId: job.traceId,
          error: err instanceof Error ? err.message : String(err)
        });
      }
    }
    await finalizeJob(job.id, job.submissionAttemptId, job.attempt, exitCode, verificationLog, aiResult, prisma);
    log("info", "Job completed", { jobId: job.id, traceId: job.traceId, exitCode, aiRan: aiResult !== null });
    transaction?.setStatus({ code: 1, message: "ok" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log("error", "Job failed", { jobId: job.id, traceId: job.traceId, error: message });
    if (process.env.SENTRY_DSN) {
      Sentry.captureException(err, { tags: { jobId: job.id, traceId: job.traceId } });
    }
    transaction?.setStatus({ code: 2, message: "internal_error" });
    await failJob(job.id, job.submissionAttemptId, job.attempt, job.maxAttempts, message, prisma);
  } finally {
    transaction?.end();
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

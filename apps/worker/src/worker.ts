import { execFile } from 'node:child_process';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { Prisma, PrismaClient, SubmissionStatus } from '@prisma/client';
import { createServer } from 'node:http';
import * as Sentry from '@sentry/node';
import { Worker as BullWorker, type Job } from 'bullmq';
import {
  gradeSemanticAnswer,
  gradeMCQ,
  gradeExam,
  gradeFile,
  type AiConfig,
  type GradingConfig,
  type GradingQuestion,
  type AiGradeResult,
} from '@nibras/grading';
import { runSandboxed } from './sandbox';
import { VERIFICATION_QUEUE_NAME, parseRedisUrl, type VerificationJobPayload } from './queue';

const execFileAsync = promisify(execFile);

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0.1,
  });
}

const POLL_INTERVAL_MS = parseInt(process.env.WORKER_POLL_INTERVAL_MS || '2000', 10);
const HEALTH_PORT = parseInt(process.env.WORKER_HEALTH_PORT || '9090', 10);
const MAX_CLAIM_AGE_MS = 5 * 60_000;

let shuttingDown = false;

type ClaimedJob = {
  id: string;
  submissionAttemptId: string;
  attempt: number;
  maxAttempts: number;
};

function log(level: 'info' | 'warn' | 'error', message: string, extra?: Record<string, unknown>) {
  const entry = {
    level,
    time: new Date().toISOString(),
    pid: process.pid,
    msg: message,
    ...extra,
  };
  process.stdout.write(JSON.stringify(entry) + '\n');
}

async function claimJob(prisma: PrismaClient): Promise<ClaimedJob | null> {
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
        summary: 'Verification is running.',
      },
    });
    await tx.verificationRun.updateMany({
      where: {
        submissionAttemptId: job.submissionAttemptId,
        attempt: job.attempt,
        startedAt: null,
      },
      data: {
        status: SubmissionStatus.running,
        startedAt: new Date(),
        log: 'Verification is running.',
      },
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
          releases: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      },
      userProjectRepo: true,
    },
  });

  const manifest = attempt.project.releases[0]?.manifestJson as {
    test?: { command?: string };
  } | null;
  const testCommand = manifest?.test?.command || 'npm test';

  // If there are stored local test results, use them directly without re-running.
  if (attempt.localTestExitCode !== null) {
    return {
      exitCode: attempt.localTestExitCode,
      log: `Using stored local test result. Exit code: ${attempt.localTestExitCode}`,
    };
  }

  // Run the test command in an isolated sandbox (ulimit + optional network namespace).
  const cloneUrl = attempt.userProjectRepo.cloneUrl;
  if (!cloneUrl) {
    return {
      exitCode: 1,
      log: 'No clone URL available for verification.',
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
  const model = process.env.NIBRAS_AI_MODEL ?? 'gpt-4o-mini';
  return {
    apiKey,
    model,
    baseUrl: process.env.NIBRAS_AI_BASE_URL,
    timeoutMs: process.env.NIBRAS_AI_TIMEOUT_MS
      ? Number(process.env.NIBRAS_AI_TIMEOUT_MS)
      : undefined,
    maxRetries: process.env.NIBRAS_AI_MAX_RETRIES
      ? Number(process.env.NIBRAS_AI_MAX_RETRIES)
      : undefined,
    minConfidence: process.env.NIBRAS_AI_MIN_CONFIDENCE
      ? Number(process.env.NIBRAS_AI_MIN_CONFIDENCE)
      : undefined,
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
        include: { releases: { orderBy: { createdAt: 'desc' }, take: 1 } },
      },
      userProjectRepo: true,
    },
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
        // MCQ fields
        options?: string[];
        // Exam fields
        type?: 'mcq' | 'short_answer' | 'long_answer' | 'true_false';
        modelAnswer?: string;
        gradingCriteria?: string;
        // File fields
        fileType?: 'pdf' | 'text' | 'code' | 'other';
        assignmentInstructions?: string;
        modelAnswerQuestions?: Array<{
          id: string;
          question: string;
          type: 'mcq' | 'short_answer' | 'long_answer' | 'true_false';
          maxScore: number;
          modelAnswer: string;
          gradingCriteria?: string;
        }>;
      }>;
    };
  };

  const manifest = attempt.project.releases[0]?.manifestJson as ManifestJson | null;
  const manifestGrading = manifest?.grading;
  if (!manifestGrading) return null;
  if (manifestGrading.questions.length === 0) return null;

  const cloneUrl = attempt.userProjectRepo.cloneUrl;
  if (!cloneUrl) return null;

  const tmpDir = await mkdtemp(join(tmpdir(), 'nibras-ai-'));
  try {
    await execFileAsync(
      'git',
      ['clone', '--depth=1', '--branch', attempt.branch, cloneUrl, tmpDir],
      {
        timeout: 60_000,
      }
    );

    const projectKey = manifest?.projectKey ?? attempt.project.slug;
    const minConfidence = aiConfig.minConfidence ?? 0.8;

    const gradingConfig: GradingConfig = {
      apiKey: aiConfig.apiKey,
      model: aiConfig.model,
      baseURL: aiConfig.baseUrl,
      minConfidence: aiConfig.minConfidence,
      maxRetries: aiConfig.maxRetries,
      timeoutMs: aiConfig.timeoutMs,
    };

    let totalEarned = 0;
    let anyNeedsReview = false;
    const allCriterionScores: AiGradeResult['criterionScores'] = [];
    const allEvidenceQuotes: string[] = [];
    const allConfidences: number[] = [];
    const allReasoningSummaries: string[] = [];
    let gradedAny = false;

    const allQuestions = manifestGrading.questions;

    for (const q of allQuestions) {
      const answerPath = join(tmpDir, q.answerFile);
      let answerText: string;
      try {
        answerText = await readFile(answerPath, 'utf8');
      } catch {
        log('warn', 'AI grading: answer file not found', {
          answerFile: q.answerFile,
          questionId: q.id,
        });
        anyNeedsReview = true;
        continue;
      }

      try {
        if (q.mode === 'semantic' && Array.isArray(q.rubric) && q.rubric.length > 0) {
          // ── Semantic path ─────────────────────────────────────────
          const question: GradingQuestion = {
            id: q.id,
            prompt: q.prompt ?? q.id,
            points: q.points,
            rubric: q.rubric ?? [],
            examples: q.examples,
            minConfidence: q.minConfidence,
          };
          const result = await gradeSemanticAnswer({
            aiConfig,
            subject: 'Programming',
            project: projectKey,
            question,
            answerText,
          });
          totalEarned += result.score;
          allCriterionScores.push(...result.criterionScores);
          allEvidenceQuotes.push(...result.evidenceQuotes);
          allConfidences.push(result.confidence);
          allReasoningSummaries.push(result.reasoningSummary);
          if (result.needsReview || result.confidence < (q.minConfidence ?? minConfidence)) {
            anyNeedsReview = true;
          }
          gradedAny = true;
        } else if (q.mode === 'mcq') {
          // ── MCQ path ──────────────────────────────────────────────
          const result = await gradeMCQ(
            [
              {
                id: q.id,
                question: q.prompt ?? q.id,
                options: q.options ?? [],
                studentAnswer: answerText.trim(),
              },
            ],
            gradingConfig
          );
          const r = result.results[0];
          if (r) {
            const earned = r.isCorrect ? q.points : 0;
            totalEarned += earned;
            allCriterionScores.push({
              id: r.questionId,
              points: q.points,
              earned,
              justification: r.explanation,
            });
            allConfidences.push(r.confidence);
            allReasoningSummaries.push(
              `${q.prompt ?? q.id}: ${r.isCorrect ? 'Correct' : 'Incorrect'} — ${r.explanation}`
            );
            if (r.confidence < (q.minConfidence ?? minConfidence)) {
              anyNeedsReview = true;
            }
            gradedAny = true;
          }
        } else if (q.mode === 'exam') {
          // ── Exam path ─────────────────────────────────────────────
          const result = await gradeExam(
            [
              {
                id: q.id,
                question: q.prompt ?? q.id,
                type: q.type ?? 'short_answer',
                maxScore: q.points,
                modelAnswer: q.modelAnswer ?? '',
                gradingCriteria: q.gradingCriteria,
              },
            ],
            [{ questionId: q.id, answer: answerText }],
            gradingConfig
          );
          const r = result.results[0];
          if (r) {
            totalEarned += r.score;
            allCriterionScores.push({
              id: r.questionId,
              points: r.maxScore,
              earned: r.score,
              justification: r.feedback,
            });
            allConfidences.push(r.confidence);
            allReasoningSummaries.push(r.feedback);
            if (r.needsHumanReview) anyNeedsReview = true;
            gradedAny = true;
          }
        } else if (q.mode === 'file') {
          // ── File path ─────────────────────────────────────────────
          const modelAnswerQuestions = (q.modelAnswerQuestions ?? []).map((mq) => ({
            id: mq.id,
            question: mq.question,
            type: mq.type,
            maxScore: mq.maxScore,
            modelAnswer: mq.modelAnswer,
            gradingCriteria: mq.gradingCriteria,
          }));

          if (modelAnswerQuestions.length === 0) {
            log('warn', 'AI grading: file mode question has no modelAnswerQuestions', {
              questionId: q.id,
            });
            anyNeedsReview = true;
            continue;
          }

          const result = await gradeFile(
            {
              fileContent: answerText,
              fileType: q.fileType ?? 'text',
              modelAnswerQuestions,
              assignmentInstructions: q.assignmentInstructions,
            },
            gradingConfig
          );

          totalEarned += result.totalScore;
          for (const r of result.results) {
            allCriterionScores.push({
              id: r.questionId,
              points: r.maxScore,
              earned: r.score,
              justification: r.feedback,
            });
            allConfidences.push(r.confidence);
          }
          const summaryText = result.extractionNotes
            ? `[File Extraction Notes: ${result.extractionNotes}]\n\n${result.results.map((r) => r.feedback).join('\n')}`
            : result.results.map((r) => r.feedback).join('\n');
          allReasoningSummaries.push(summaryText);
          if (result.needsHumanReview) anyNeedsReview = true;
          gradedAny = true;
        } else {
          log('warn', 'AI grading: unknown question mode, skipping', {
            questionId: q.id,
            mode: q.mode,
          });
        }
      } catch (err) {
        log('warn', 'AI grading failed for question', {
          questionId: q.id,
          mode: q.mode,
          error: err instanceof Error ? err.message : String(err),
        });
        anyNeedsReview = true;
      }
    }

    if (!gradedAny) return null;

    const avgConfidence =
      allConfidences.length > 0
        ? allConfidences.reduce((sum, c) => sum + c, 0) / allConfidences.length
        : 0;

    const aggregated: AiGradeResult = {
      score: totalEarned,
      confidence: avgConfidence,
      needsReview: anyNeedsReview,
      criterionScores: allCriterionScores,
      reasoningSummary: allReasoningSummaries.join('\n\n'),
      evidenceQuotes: allEvidenceQuotes,
    };

    return {
      gradeResult: aggregated,
      model: aiConfig.model,
      gradedAt: new Date(),
      reviewRequired: anyNeedsReview,
    };
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
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
    ? 'Verification failed.'
    : aiResult?.reviewRequired
      ? 'Verification passed — AI flagged for human review.'
      : 'Verification passed.';

  await prisma.$transaction(async (tx) => {
    await tx.verificationJob.update({
      where: { id: jobId },
      data: { status: finalStatus, claimedAt: null, finishedAt: new Date() },
    });
    await tx.verificationRun.update({
      where: { submissionAttemptId_attempt: { submissionAttemptId, attempt } },
      data: { status: finalStatus, log: verificationLog, finishedAt: new Date() },
    });
    await tx.submissionAttempt.update({
      where: { id: submissionAttemptId },
      data: { status: finalStatus, summary },
    });

    // Create a draft review with AI results when AI grading ran
    if (verificationPassed && aiResult) {
      const r = aiResult.gradeResult;
      // Use the first admin user as reviewer; fall back to the submission owner
      const [submission, adminUser] = await Promise.all([
        tx.submissionAttempt.findUniqueOrThrow({
          where: { id: submissionAttemptId },
          select: { userId: true },
        }),
        tx.user.findFirst({
          where: { systemRole: 'admin' },
          select: { id: true },
          orderBy: { createdAt: 'asc' },
        }),
      ]);
      const reviewerUserId = adminUser?.id ?? submission.userId;
      if (!adminUser) {
        log('warn', 'AI review: no admin user found, attributing review to submission owner', {
          submissionAttemptId,
        });
      }
      await tx.review.create({
        data: {
          submissionAttemptId,
          reviewerUserId,
          status: 'pending',
          score: r.score,
          feedback: r.reasoningSummary,
          rubricJson: [],
          aiConfidence: r.confidence,
          aiNeedsReview: r.needsReview,
          aiReasoningSummary: r.reasoningSummary,
          aiCriterionScores: r.criterionScores,
          aiEvidenceQuotes: r.evidenceQuotes,
          aiModel: aiResult.model,
          aiGradedAt: aiResult.gradedAt,
        },
      });
    }
  });
}

async function checkAndAutoUpgradeStudentLevel(
  submissionAttemptId: string,
  prisma: PrismaClient
): Promise<void> {
  const MAX_LEVEL = 4;

  const submission = await prisma.submissionAttempt.findUnique({
    where: { id: submissionAttemptId },
    include: { project: true },
  });
  if (!submission?.project.courseId) return;

  const { userId } = submission;

  // Find the student's membership for the course this submission belongs to
  const triggerMembership = await prisma.courseMembership.findFirst({
    where: { courseId: submission.project.courseId, userId, role: 'student' },
  });
  if (!triggerMembership || triggerMembership.level >= MAX_LEVEL) return;

  const currentLevel = triggerMembership.level;

  // Find ALL courses this student is enrolled in at the current level.
  // A student must complete every published project (all milestones) across
  // ALL their enrolled courses at their current level before advancing.
  const allMemberships = await prisma.courseMembership.findMany({
    where: { userId, role: 'student', level: currentLevel },
  });

  for (const mem of allMemberships) {
    const levelProjects = await prisma.project.findMany({
      where: { courseId: mem.courseId, level: currentLevel, status: 'published' },
      include: { milestones: true },
    });
    // A course with no projects at this level does not block advancement
    if (levelProjects.length === 0) continue;

    for (const proj of levelProjects) {
      for (const milestone of proj.milestones) {
        const passedSub = await prisma.submissionAttempt.findFirst({
          where: { userId, projectId: proj.id, milestoneId: milestone.id, status: 'passed' },
        });
        if (!passedSub) return; // still work to do in this course
      }
    }
  }

  // All courses at currentLevel are cleared — promote across every enrollment
  const nextLevel = currentLevel + 1;
  const membershipIds = allMemberships.map((m) => m.id);
  await prisma.courseMembership.updateMany({
    where: { id: { in: membershipIds } },
    data: { level: nextLevel },
  });

  // Auto-enrol the student in every active Year-N+1 course so they
  // immediately see the next year's curriculum in their dashboard.
  const nextYearCourses = await prisma.course.findMany({
    where: { isActive: true, termLabel: { startsWith: `Year ${nextLevel}` } },
    select: { id: true },
  });
  await Promise.all(
    nextYearCourses.map((course) =>
      prisma.courseMembership.upsert({
        where: { courseId_userId: { courseId: course.id, userId } },
        update: { level: nextLevel },
        create: { courseId: course.id, userId, role: 'student', level: nextLevel },
      })
    )
  );

  log(
    'info',
    `Student auto-promoted across ${membershipIds.length} course(s): level ${currentLevel} → ${nextLevel}`,
    {
      userId,
      fromLevel: currentLevel,
      toLevel: nextLevel,
      courseIds: allMemberships.map((m) => m.courseId),
    }
  );
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
        finishedAt: exhausted ? new Date() : null,
      },
    });
    await tx.verificationRun.update({
      where: {
        submissionAttemptId_attempt: {
          submissionAttemptId,
          attempt,
        },
      },
      data: {
        status: exhausted ? SubmissionStatus.failed : SubmissionStatus.queued,
        log: errorMessage,
        finishedAt: exhausted ? new Date() : null,
      },
    });
    if (!exhausted) {
      await tx.verificationRun.create({
        data: {
          submissionAttemptId,
          attempt: nextAttempt,
          status: SubmissionStatus.queued,
          log: 'Queued for retry',
        },
      });
    }
    await tx.submissionAttempt.update({
      where: { id: submissionAttemptId },
      data: {
        status: exhausted ? SubmissionStatus.failed : SubmissionStatus.queued,
        summary,
      },
    });
  });
}

async function tick(prisma: PrismaClient): Promise<void> {
  const job = await claimJob(prisma);
  if (!job) {
    return;
  }
  log('info', 'Claimed job', { jobId: job.id, submissionAttemptId: job.submissionAttemptId });

  const transaction = process.env.SENTRY_DSN
    ? Sentry.startInactiveSpan({ name: 'verification-job', op: 'worker.job' })
    : null;

  try {
    const { exitCode, log: verificationLog } = await runVerification(
      job.submissionAttemptId,
      prisma
    );
    let aiResult: AiRunResult | null = null;
    if (exitCode === 0) {
      try {
        aiResult = await runAiGrading(job.submissionAttemptId, prisma);
      } catch (err) {
        log('warn', 'AI grading error (non-fatal)', {
          jobId: job.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    await finalizeJob(
      job.id,
      job.submissionAttemptId,
      job.attempt,
      exitCode,
      verificationLog,
      aiResult,
      prisma
    );
    if (exitCode === 0) {
      try {
        await checkAndAutoUpgradeStudentLevel(job.submissionAttemptId, prisma);
      } catch (err) {
        log('warn', 'Auto-upgrade check error (non-fatal)', {
          jobId: job.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    log('info', 'Job completed', { jobId: job.id, exitCode, aiRan: aiResult !== null });
    transaction?.setStatus({ code: 1, message: 'ok' });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log('error', 'Job failed', { jobId: job.id, error: message });
    if (process.env.SENTRY_DSN) {
      Sentry.captureException(err, { tags: { jobId: job.id } });
    }
    transaction?.setStatus({ code: 2, message: 'internal_error' });
    await failJob(job.id, job.submissionAttemptId, job.attempt, job.maxAttempts, message, prisma);
  } finally {
    transaction?.end();
  }
}

async function processBullJob(
  job: Job<VerificationJobPayload>,
  prisma: PrismaClient
): Promise<void> {
  const { jobId, submissionAttemptId, attempt, maxAttempts } = job.data;
  log('info', 'BullMQ job received', { jobId, submissionAttemptId });

  const transaction = process.env.SENTRY_DSN
    ? Sentry.startInactiveSpan({ name: 'verification-job', op: 'worker.job' })
    : null;

  try {
    const { exitCode, log: verificationLog } = await runVerification(submissionAttemptId, prisma);
    let aiResult: AiRunResult | null = null;
    if (exitCode === 0) {
      try {
        aiResult = await runAiGrading(submissionAttemptId, prisma);
      } catch (err) {
        log('warn', 'AI grading error (non-fatal)', {
          jobId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    await finalizeJob(
      jobId,
      submissionAttemptId,
      attempt,
      exitCode,
      verificationLog,
      aiResult,
      prisma
    );
    if (exitCode === 0) {
      try {
        await checkAndAutoUpgradeStudentLevel(submissionAttemptId, prisma);
      } catch (err) {
        log('warn', 'Auto-upgrade check error (non-fatal)', {
          jobId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    log('info', 'BullMQ job completed', { jobId, exitCode, aiRan: aiResult !== null });
    transaction?.setStatus({ code: 1, message: 'ok' });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log('error', 'BullMQ job failed', { jobId, error: message });
    if (process.env.SENTRY_DSN) Sentry.captureException(err, { tags: { jobId } });
    transaction?.setStatus({ code: 2, message: 'internal_error' });
    await failJob(jobId, submissionAttemptId, attempt, maxAttempts, message, prisma);
    throw err; // Let BullMQ handle retries
  } finally {
    transaction?.end();
  }
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  const healthServer = createServer((request, response) => {
    if (request.url === '/healthz') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ ok: true }));
      return;
    }
    response.writeHead(404, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ error: 'Not found' }));
  });

  process.on('SIGTERM', () => {
    log('info', 'Received SIGTERM, draining and shutting down');
    shuttingDown = true;
  });
  process.on('SIGINT', () => {
    log('info', 'Received SIGINT, draining and shutting down');
    shuttingDown = true;
  });

  await new Promise<void>((resolve) => {
    healthServer.listen(HEALTH_PORT, '0.0.0.0', resolve);
  });

  const redisUrl = process.env.REDIS_URL;

  if (redisUrl) {
    // ── BullMQ mode: instant dispatch via Redis ───────────────────────────────
    log('info', 'Starting in BullMQ mode', {
      queue: VERIFICATION_QUEUE_NAME,
      concurrency: Number(process.env.WORKER_CONCURRENCY ?? 1),
    });

    const bullWorker = new BullWorker<VerificationJobPayload>(
      VERIFICATION_QUEUE_NAME,
      (job) => processBullJob(job, prisma),
      {
        connection: parseRedisUrl(redisUrl),
        concurrency: Number(process.env.WORKER_CONCURRENCY ?? 1),
      }
    );

    bullWorker.on('error', (err) => {
      log('error', 'BullMQ worker error', { error: err.message });
      if (process.env.SENTRY_DSN) Sentry.captureException(err);
    });

    // Wait until shutdown signal
    await new Promise<void>((resolve) => {
      const check = () => (shuttingDown ? resolve() : setTimeout(check, 500));
      check();
    });

    await bullWorker.close();
  } else {
    // ── DB polling mode: backward-compatible fallback ─────────────────────────
    log('info', 'Starting in DB polling mode', { pollIntervalMs: POLL_INTERVAL_MS });

    while (!shuttingDown) {
      try {
        await tick(prisma);
      } catch (err) {
        log('error', 'Unexpected error in worker tick', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
      if (!shuttingDown) {
        await new Promise<void>((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }
    }
  }

  await prisma.$disconnect();
  await new Promise<void>((resolve, reject) => {
    healthServer.close((error) => (error ? reject(error) : resolve()));
  });
  log('info', 'Worker shut down cleanly');
}

main().catch((err) => {
  console.error('Worker crashed:', err);
  process.exit(1);
});

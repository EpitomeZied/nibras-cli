import { FastifyInstance } from "fastify";
import { AppStore, SubmissionWorkflowStatus } from "../../store";
import { requireUser } from "../../lib/auth";
import { requestBaseUrl } from "../../lib/request-base-url";

const OVERRIDE_STATUSES: SubmissionWorkflowStatus[] = ["passed", "failed", "needs_review"];

function requireAdmin(
  auth: Awaited<ReturnType<typeof requireUser>>,
  reply: Parameters<typeof requireUser>[1]
): auth is NonNullable<typeof auth> {
  if (!auth) return false;
  if (auth.user.systemRole !== "admin") {
    reply.code(403).send({ error: "Admin access required." });
    return false;
  }
  return true;
}

export function registerAdminRoutes(app: FastifyInstance, store: AppStore): void {
  /**
   * GET /v1/admin/submissions
   * List all submissions with optional status/project filtering.
   * Admin only.
   */
  app.get("/v1/admin/submissions", async (request, reply) => {
    const auth = await requireUser(request, reply, store);
    if (!requireAdmin(auth, reply)) return;

    const query = request.query as {
      status?: SubmissionWorkflowStatus;
      projectId?: string;
    };
    const results = await store.listTrackingReviewQueue(requestBaseUrl(request), {
      status: query.status,
      projectId: query.projectId
    });
    return { submissions: results };
  });

  /**
   * PATCH /v1/admin/submissions/:submissionId/status
   * Manually override the verification status of a submission.
   * Allowed statuses: passed, failed, needs_review.
   * Admin only.
   */
  app.patch("/v1/admin/submissions/:submissionId/status", async (request, reply) => {
    const auth = await requireUser(request, reply, store);
    if (!requireAdmin(auth, reply)) return;

    const params = request.params as { submissionId: string };
    const body = request.body as { status?: string; summary?: string };

    if (!body.status || !OVERRIDE_STATUSES.includes(body.status as SubmissionWorkflowStatus)) {
      return reply.code(400).send({
        error: `status must be one of: ${OVERRIDE_STATUSES.join(", ")}`
      });
    }

    const submission = await store.getSubmissionForAdmin(requestBaseUrl(request), params.submissionId);
    if (!submission) {
      return reply.code(404).send({ error: "Unknown submission." });
    }

    const summary = body.summary || (body.status === "passed"
      ? "Manually marked as passed by admin."
      : body.status === "needs_review"
        ? "Manually flagged for review by admin."
        : "Manually marked as failed by admin.");

    const updated = await store.overrideSubmissionStatus(
      requestBaseUrl(request),
      params.submissionId,
      body.status as SubmissionWorkflowStatus,
      summary,
      auth.user.id
    );
    if (!updated) {
      return reply.code(404).send({ error: "Unknown submission." });
    }

    return { ok: true, submissionId: params.submissionId, status: updated.status, summary: updated.summary };
  });

  app.get("/v1/admin/submissions/:submissionId/logs", async (request, reply) => {
    const auth = await requireUser(request, reply, store);
    if (!requireAdmin(auth, reply)) return;

    const params = request.params as { submissionId: string };
    const submission = await store.getSubmissionForAdmin(requestBaseUrl(request), params.submissionId);
    if (!submission) {
      return reply.code(404).send({ error: "Unknown submission." });
    }

    const logs = await store.listSubmissionVerificationLogs(requestBaseUrl(request), params.submissionId);
    return { submissionId: params.submissionId, logs };
  });

  /**
   * GET /v1/admin/projects
   * List all projects across all courses. Admin only.
   */
  app.get("/v1/admin/projects", async (request, reply) => {
    const auth = await requireUser(request, reply, store);
    if (!requireAdmin(auth, reply)) return;

    const courses = await store.listTrackingCourses(requestBaseUrl(request), auth!.user.id);
    const projectsByCourse = await Promise.all(
      courses.map(async (course) => {
        const projects = await store.listTrackingProjects(requestBaseUrl(request), course.id);
        return { course, projects };
      })
    );
    return { courses: projectsByCourse };
  });

  /**
   * POST /v1/admin/projects/:projectId/archive
   * Archive a project. Admin only.
   */
  app.post("/v1/admin/projects/:projectId/archive", async (request, reply) => {
    const auth = await requireUser(request, reply, store);
    if (!requireAdmin(auth, reply)) return;

    const params = request.params as { projectId: string };
    const project = await store.getTrackingProjectById(requestBaseUrl(request), params.projectId);
    if (!project) {
      return reply.code(404).send({ error: "Unknown project." });
    }
    const updated = await store.setTrackingProjectStatus(
      requestBaseUrl(request),
      auth!.user.id,
      params.projectId,
      "archived"
    );
    return { ok: true, project: updated };
  });
}

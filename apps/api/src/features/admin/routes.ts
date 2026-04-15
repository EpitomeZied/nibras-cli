import { FastifyInstance } from 'fastify';
import { AppStore, SubmissionWorkflowStatus } from '../../store';
import { requireUser } from '../../lib/auth';
import { requestBaseUrl } from '../../lib/request-base-url';
import { Errors } from '../../lib/errors';
import { validateId } from '../../lib/validate';

const OVERRIDE_STATUSES: SubmissionWorkflowStatus[] = ['passed', 'failed', 'needs_review'];

function requireAdmin(
  auth: Awaited<ReturnType<typeof requireUser>>,
  reply: Parameters<typeof requireUser>[1]
): auth is NonNullable<typeof auth> {
  if (!auth) return false;
  if (auth.user.systemRole !== 'admin') {
    reply.code(403).send(Errors.forbidden());
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
  app.get(
    '/v1/admin/submissions',
    { schema: { tags: ['admin'], summary: 'List all submissions (admin)' } },
    async (request, reply) => {
      const auth = await requireUser(request, reply, store);
      if (!requireAdmin(auth, reply)) return;

      const query = request.query as {
        status?: SubmissionWorkflowStatus;
        projectId?: string;
      };
      const results = await store.listTrackingReviewQueue(requestBaseUrl(request), {
        status: query.status,
        projectId: query.projectId,
      });
      return { submissions: results };
    }
  );

  /**
   * PATCH /v1/admin/submissions/:submissionId/status
   * Manually override the verification status of a submission.
   * Allowed statuses: passed, failed, needs_review.
   * Admin only.
   */
  app.patch(
    '/v1/admin/submissions/:submissionId/status',
    { schema: { tags: ['admin'], summary: 'Override submission verification status' } },
    async (request, reply) => {
      const auth = await requireUser(request, reply, store);
      if (!requireAdmin(auth, reply)) return;

      const params = request.params as { submissionId: string };
      if (!validateId(params.submissionId, reply, 'submissionId')) return;
      const body = request.body as { status?: string; summary?: string };

      if (!body.status || !OVERRIDE_STATUSES.includes(body.status as SubmissionWorkflowStatus)) {
        return reply
          .code(400)
          .send(Errors.validation(`status must be one of: ${OVERRIDE_STATUSES.join(', ')}`));
      }

      const submission = await store.getSubmissionForAdmin(
        requestBaseUrl(request),
        params.submissionId
      );
      if (!submission) {
        return reply.code(404).send(Errors.notFound('Submission'));
      }

      const summary =
        body.summary ||
        (body.status === 'passed'
          ? 'Manually marked as passed by admin.'
          : body.status === 'needs_review'
            ? 'Manually flagged for review by admin.'
            : 'Manually marked as failed by admin.');

      const updated = await store.overrideSubmissionStatus(
        requestBaseUrl(request),
        params.submissionId,
        body.status as SubmissionWorkflowStatus,
        summary,
        auth.user.id
      );
      if (!updated) {
        return reply.code(404).send(Errors.notFound('Submission'));
      }

      return {
        ok: true,
        submissionId: params.submissionId,
        status: updated.status,
        summary: updated.summary,
      };
    }
  );

  app.get(
    '/v1/admin/submissions/:submissionId/logs',
    { schema: { tags: ['admin'], summary: 'Get submission verification logs' } },
    async (request, reply) => {
      const auth = await requireUser(request, reply, store);
      if (!requireAdmin(auth, reply)) return;

      const params = request.params as { submissionId: string };
      if (!validateId(params.submissionId, reply, 'submissionId')) return;
      const submission = await store.getSubmissionForAdmin(
        requestBaseUrl(request),
        params.submissionId
      );
      if (!submission) {
        return reply.code(404).send(Errors.notFound('Submission'));
      }

      const logs = await store.listSubmissionVerificationLogs(
        requestBaseUrl(request),
        params.submissionId
      );
      return { submissionId: params.submissionId, logs };
    }
  );

  /**
   * POST /v1/admin/submissions/:submissionId/retry
   * Re-queue a submission for verification. Admin only.
   */
  app.post(
    '/v1/admin/submissions/:submissionId/retry',
    { schema: { tags: ['admin'], summary: 'Re-queue submission for verification' } },
    async (request, reply) => {
      const auth = await requireUser(request, reply, store);
      if (!requireAdmin(auth, reply)) return;

      const params = request.params as { submissionId: string };
      if (!validateId(params.submissionId, reply, 'submissionId')) return;
      const submission = await store.getSubmissionForAdmin(
        requestBaseUrl(request),
        params.submissionId
      );
      if (!submission) {
        return reply.code(404).send(Errors.notFound('Submission'));
      }

      const updated = await store.overrideSubmissionStatus(
        requestBaseUrl(request),
        params.submissionId,
        'queued',
        'Manually re-queued by admin.',
        auth!.user.id
      );
      if (!updated) {
        return reply.code(404).send(Errors.notFound('Submission'));
      }

      return { ok: true, submissionId: params.submissionId, status: 'queued' };
    }
  );

  /**
   * GET /v1/admin/projects
   * List all projects across all courses. Admin only.
   */
  app.get(
    '/v1/admin/projects',
    { schema: { tags: ['admin'], summary: 'List all projects across all courses' } },
    async (request, reply) => {
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
    }
  );

  /**
   * GET /v1/admin/users
   * List all users. Admin only.
   */
  app.get(
    '/v1/admin/users',
    { schema: { tags: ['admin'], summary: 'List all users' } },
    async (request, reply) => {
      const auth = await requireUser(request, reply, store);
      if (!requireAdmin(auth, reply)) return;
      const users = await store.listUsers(requestBaseUrl(request));
      return { users };
    }
  );

  /**
   * PATCH /v1/admin/users/:userId/role
   * Change a user's system role (user ↔ admin). Admin only.
   */
  app.patch(
    '/v1/admin/users/:userId/role',
    { schema: { tags: ['admin'], summary: 'Change user system role' } },
    async (request, reply) => {
      const auth = await requireUser(request, reply, store);
      if (!requireAdmin(auth, reply)) return;
      const params = request.params as { userId: string };
      if (!validateId(params.userId, reply, 'userId')) return;
      const body = request.body as { role?: string };
      if (!body.role || !['user', 'admin'].includes(body.role)) {
        return reply.code(400).send(Errors.validation('role must be "user" or "admin"'));
      }
      const updated = await store.setUserSystemRole(
        requestBaseUrl(request),
        params.userId,
        body.role as 'user' | 'admin'
      );
      if (!updated) {
        return reply.code(404).send(Errors.notFound('User'));
      }
      return { ok: true, userId: params.userId, systemRole: updated.systemRole };
    }
  );

  /**
   * GET /v1/admin/students
   * List all students with their global year level. Admin only.
   */
  app.get(
    '/v1/admin/students',
    { schema: { tags: ['admin'], summary: 'List students with year level' } },
    async (request, reply) => {
      const auth = await requireUser(request, reply, store);
      if (!requireAdmin(auth, reply)) return;
      const students = await store.listStudentsWithYearLevel(requestBaseUrl(request));
      return { students };
    }
  );

  /**
   * PATCH /v1/admin/students/:userId/year
   * Set a student's global year level. Admin only.
   */
  app.patch(
    '/v1/admin/students/:userId/year',
    { schema: { tags: ['admin'], summary: 'Set student global year level' } },
    async (request, reply) => {
      const auth = await requireUser(request, reply, store);
      if (!requireAdmin(auth, reply)) return;

      const params = request.params as { userId: string };
      if (!validateId(params.userId, reply, 'userId')) return;
      const body = request.body as { yearLevel?: number };
      if (
        typeof body.yearLevel !== 'number' ||
        !Number.isInteger(body.yearLevel) ||
        body.yearLevel < 1 ||
        body.yearLevel > 4
      ) {
        return reply
          .code(400)
          .send(Errors.validation('yearLevel must be an integer between 1 and 4'));
      }

      await store.syncStudentYearGlobal(requestBaseUrl(request), params.userId, body.yearLevel);
      return { ok: true, userId: params.userId, yearLevel: body.yearLevel };
    }
  );

  /**
   * POST /v1/admin/projects/:projectId/archive
   * Archive a project. Admin only.
   */
  app.post(
    '/v1/admin/projects/:projectId/archive',
    { schema: { tags: ['admin'], summary: 'Archive a project' } },
    async (request, reply) => {
      const auth = await requireUser(request, reply, store);
      if (!requireAdmin(auth, reply)) return;

      const params = request.params as { projectId: string };
      if (!validateId(params.projectId, reply, 'projectId')) return;
      const project = await store.getTrackingProjectById(requestBaseUrl(request), params.projectId);
      if (!project) {
        return reply.code(404).send(Errors.notFound('Project'));
      }
      const updated = await store.setTrackingProjectStatus(
        requestBaseUrl(request),
        auth!.user.id,
        params.projectId,
        'archived'
      );
      return { ok: true, project: updated };
    }
  );
}

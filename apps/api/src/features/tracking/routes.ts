import { FastifyInstance } from 'fastify';
import {
  AddCourseMemberRequestSchema,
  CourseMemberSchema,
  CreateProjectRoleApplicationRequestSchema,
  CreateProjectTemplateRequestSchema,
  CreateMilestoneRequestSchema,
  CreateReviewRequestSchema,
  CreateTrackingCourseRequestSchema,
  CreateTrackingProjectRequestSchema,
  CreateTrackingSubmissionRequestSchema,
  GenerateTeamFormationRequestSchema,
  LockTeamFormationRequestSchema,
  ProjectRoleApplicationSchema,
  ProjectTemplateSchema,
  ReviewQueueResponseSchema,
  TeamFormationRunSchema,
  TeamSchema,
  TrackingCourseSummarySchema,
  TrackingMilestoneSchema,
  TrackingProjectDetailSchema,
  TrackingProjectSummarySchema,
  TrackingReviewSchema,
  TrackingSubmissionSchema,
  UpdateProjectTemplateRequestSchema,
  UpdateTeamRequestSchema,
  UpdateMilestoneRequestSchema,
  UpdateStudentLevelRequestSchema,
  UpdateTrackingProjectRequestSchema,
  UpdateTrackingSubmissionRequestSchema,
} from '@nibras/contracts';
import { requireUser, type AuthenticatedRequest } from '../../lib/auth';
import { sendReviewSubmittedEmail } from '../../lib/email';
import { Errors, apiError } from '../../lib/errors';
import { requestBaseUrl } from '../../lib/request-base-url';
import { validateId } from '../../lib/validate';
import { AppStore, PaginationOpts } from '../../store';
import {
  presentInstructorDashboard,
  presentHomeDashboard,
  presentMilestone,
  presentProject,
  presentStudentDashboard,
} from './presenters/dashboard';
import {
  canManageCourse,
  canManageProject,
  canViewCourse,
  canViewSubmission,
  hasAnyInstructorAccess,
} from './policies/access';

function isReviewRecord<T>(value: T | null): value is T {
  return value !== null;
}

function isStudentMember(auth: AuthenticatedRequest, courseId: string): boolean {
  return auth.memberships.some((entry) => entry.courseId === courseId && entry.role === 'student');
}

/**
 * Parse optional `limit` and `offset` query string params into a PaginationOpts object.
 * Returns undefined when neither is present (backward-compatible — no pagination applied).
 * Clamps limit to [1, 200].
 */
function parsePaginationOpts(query: {
  limit?: string;
  offset?: string;
}): PaginationOpts | undefined {
  if (query.limit === undefined && query.offset === undefined) return undefined;
  const limit =
    query.limit !== undefined ? Math.min(200, Math.max(1, parseInt(query.limit, 10) || 50)) : 50;
  const offset = query.offset !== undefined ? Math.max(0, parseInt(query.offset, 10) || 0) : 0;
  return { limit, offset };
}

export function registerTrackingRoutes(app: FastifyInstance, store: AppStore): void {
  app.get(
    '/v1/tracking/courses',
    { schema: { tags: ['tracking'], summary: 'List courses for the current user' } },
    async (request, reply) => {
      const auth = await requireUser(request, reply, store);
      if (!auth) return;
      const query = request.query as { limit?: string; offset?: string };
      const opts = parsePaginationOpts(query);
      const [courses, total] = await Promise.all([
        store.listTrackingCourses(requestBaseUrl(request), auth.user.id, opts),
        opts
          ? store.countTrackingCourses(requestBaseUrl(request), auth.user.id)
          : Promise.resolve(undefined),
      ]);
      if (total !== undefined) void reply.header('X-Total-Count', String(total));
      return courses;
    }
  );

  app.get(
    '/v1/tracking/courses/:courseId/members',
    { schema: { tags: ['tracking'], summary: 'List course members' } },
    async (request, reply) => {
      const auth = await requireUser(request, reply, store);
      if (!auth) return;
      const params = request.params as { courseId: string };
      if (!validateId(params.courseId, reply, 'courseId')) return;
      if (!canManageCourse(auth, params.courseId)) {
        reply.code(403).send(Errors.forbidden());
        return;
      }
      const members = await store.listCourseMembersForInstructor(
        requestBaseUrl(request),
        params.courseId
      );
      return members.map((m) => CourseMemberSchema.parse(m));
    }
  );

  app.post(
    '/v1/tracking/courses/:courseId/members',
    { schema: { tags: ['tracking'], summary: 'Add a member to a course' } },
    async (request, reply) => {
      const auth = await requireUser(request, reply, store);
      if (!auth) return;
      const params = request.params as { courseId: string };
      if (!validateId(params.courseId, reply, 'courseId')) return;
      if (!canManageCourse(auth, params.courseId)) {
        reply.code(403).send(Errors.forbidden());
        return;
      }
      const payload = AddCourseMemberRequestSchema.parse(request.body);
      try {
        const member = await store.addCourseMember(
          requestBaseUrl(request),
          params.courseId,
          payload.githubLogin,
          payload.role
        );
        reply.code(201);
        return CourseMemberSchema.parse(member);
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode || 409;
        reply
          .code(statusCode)
          .send(apiError('CONFLICT', err instanceof Error ? err.message : 'Failed to add member.'));
      }
    }
  );

  app.delete(
    '/v1/tracking/courses/:courseId/members/:userId',
    { schema: { tags: ['tracking'], summary: 'Remove a member from a course' } },
    async (request, reply) => {
      const auth = await requireUser(request, reply, store);
      if (!auth) return;
      const params = request.params as { courseId: string; userId: string };
      if (!validateId(params.courseId, reply, 'courseId')) return;
      if (!validateId(params.userId, reply, 'userId')) return;
      if (!canManageCourse(auth, params.courseId)) {
        reply.code(403).send(Errors.forbidden());
        return;
      }
      await store.removeCourseMember(requestBaseUrl(request), params.courseId, params.userId);
      return { ok: true };
    }
  );

  app.patch(
    '/v1/tracking/courses/:courseId/members/:userId/level',
    { schema: { tags: ['tracking'], summary: 'Set student level (instructor/TA only)' } },
    async (request, reply) => {
      const auth = await requireUser(request, reply, store);
      if (!auth) return;
      const params = request.params as { courseId: string; userId: string };
      if (!validateId(params.courseId, reply, 'courseId')) return;
      if (!validateId(params.userId, reply, 'userId')) return;
      if (!canManageCourse(auth, params.courseId)) {
        reply.code(403).send(Errors.forbidden());
        return;
      }
      const payload = UpdateStudentLevelRequestSchema.parse(request.body);
      const membership = await store.updateStudentLevel(
        requestBaseUrl(request),
        params.courseId,
        params.userId,
        payload.level
      );
      if (!membership) {
        reply.code(404).send(Errors.notFound('Student membership'));
        return;
      }
      return { ok: true, level: membership.level };
    }
  );

  app.post(
    '/v1/tracking/courses',
    { schema: { tags: ['tracking'], summary: 'Create a new course' } },
    async (request, reply) => {
      const auth = await requireUser(request, reply, store);
      if (!auth) return;
      if (auth.user.systemRole !== 'admin' && !hasAnyInstructorAccess(auth)) {
        reply.code(403).send(Errors.forbidden());
        return;
      }
      const payload = CreateTrackingCourseRequestSchema.parse(request.body);
      const course = await store.createTrackingCourse(
        requestBaseUrl(request),
        auth.user.id,
        payload
      );
      reply.code(201);
      return TrackingCourseSummarySchema.parse(course);
    }
  );

  app.get(
    '/v1/tracking/courses/:courseId/templates',
    { schema: { tags: ['tracking'], summary: 'List project templates in a course' } },
    async (request, reply) => {
      const auth = await requireUser(request, reply, store);
      if (!auth) return;
      const params = request.params as { courseId: string };
      if (!validateId(params.courseId, reply, 'courseId')) return;
      if (!canViewCourse(auth, params.courseId)) {
        reply.code(403).send(Errors.forbidden());
        return;
      }
      const templates = await store.listCourseProjectTemplates(
        requestBaseUrl(request),
        params.courseId
      );
      return templates.map((entry) => ProjectTemplateSchema.parse(entry));
    }
  );

  app.post(
    '/v1/tracking/courses/:courseId/templates',
    { schema: { tags: ['tracking'], summary: 'Create a project template in a course' } },
    async (request, reply) => {
      const auth = await requireUser(request, reply, store);
      if (!auth) return;
      const params = request.params as { courseId: string };
      if (!validateId(params.courseId, reply, 'courseId')) return;
      if (!canManageCourse(auth, params.courseId)) {
        reply.code(403).send(Errors.forbidden());
        return;
      }
      const payload = CreateProjectTemplateRequestSchema.parse(request.body);
      const created = await store.createCourseProjectTemplate(
        requestBaseUrl(request),
        auth.user.id,
        params.courseId,
        payload
      );
      reply.code(201);
      return ProjectTemplateSchema.parse(created);
    }
  );

  app.get(
    '/v1/tracking/courses/:courseId/projects',
    { schema: { tags: ['tracking'], summary: 'List projects in a course' } },
    async (request, reply) => {
      const auth = await requireUser(request, reply, store);
      if (!auth) return;
      const params = request.params as { courseId: string };
      if (!validateId(params.courseId, reply, 'courseId')) return;
      if (!canViewCourse(auth, params.courseId)) {
        reply.code(403).send(Errors.forbidden());
        return;
      }
      const query = request.query as { limit?: string; offset?: string };
      const opts = parsePaginationOpts(query);
      const [projects, total] = await Promise.all([
        store.listTrackingProjects(requestBaseUrl(request), params.courseId, opts),
        opts
          ? store.countTrackingProjects(requestBaseUrl(request), params.courseId)
          : Promise.resolve(undefined),
      ]);
      if (total !== undefined) void reply.header('X-Total-Count', String(total));
      return projects.map(presentProject);
    }
  );

  app.post(
    '/v1/tracking/projects',
    { schema: { tags: ['tracking'], summary: 'Create a new project' } },
    async (request, reply) => {
      const auth = await requireUser(request, reply, store);
      if (!auth) return;
      const payload = CreateTrackingProjectRequestSchema.parse(request.body);
      if (!canManageCourse(auth, payload.courseId)) {
        reply.code(403).send(Errors.forbidden());
        return;
      }
      const created = await store.createTrackingProject(
        requestBaseUrl(request),
        auth.user.id,
        payload
      );
      reply.code(201);
      return TrackingProjectSummarySchema.parse(presentProject(created));
    }
  );

  app.get(
    '/v1/tracking/templates/:templateId',
    { schema: { tags: ['tracking'], summary: 'Get project template details' } },
    async (request, reply) => {
      const auth = await requireUser(request, reply, store);
      if (!auth) return;
      const params = request.params as { templateId: string };
      if (!validateId(params.templateId, reply, 'templateId')) return;
      const template = await store.getProjectTemplateById(requestBaseUrl(request), params.templateId);
      if (!template) {
        reply.code(404).send(Errors.notFound('Project template'));
        return;
      }
      if (!canViewCourse(auth, template.courseId)) {
        reply.code(403).send(Errors.forbidden());
        return;
      }
      return ProjectTemplateSchema.parse(template);
    }
  );

  app.patch(
    '/v1/tracking/templates/:templateId',
    { schema: { tags: ['tracking'], summary: 'Update a project template' } },
    async (request, reply) => {
      const auth = await requireUser(request, reply, store);
      if (!auth) return;
      const params = request.params as { templateId: string };
      if (!validateId(params.templateId, reply, 'templateId')) return;
      const existing = await store.getProjectTemplateById(requestBaseUrl(request), params.templateId);
      if (!existing) {
        reply.code(404).send(Errors.notFound('Project template'));
        return;
      }
      if (!canManageCourse(auth, existing.courseId)) {
        reply.code(403).send(Errors.forbidden());
        return;
      }
      const payload = UpdateProjectTemplateRequestSchema.parse(request.body);
      const updated = await store.updateProjectTemplate(
        requestBaseUrl(request),
        auth.user.id,
        params.templateId,
        payload
      );
      if (!updated) {
        reply.code(404).send(Errors.notFound('Project template'));
        return;
      }
      return ProjectTemplateSchema.parse(updated);
    }
  );

  app.get(
    '/v1/tracking/projects/:projectId',
    { schema: { tags: ['tracking'], summary: 'Get project details' } },
    async (request, reply) => {
      const auth = await requireUser(request, reply, store);
      if (!auth) return;
      const params = request.params as { projectId: string };
      if (!validateId(params.projectId, reply, 'projectId')) return;
      const project = await store.getTrackingProjectById(requestBaseUrl(request), params.projectId);
      if (!project) {
        reply.code(404).send(Errors.notFound('Project'));
        return;
      }
      if (!project.courseId || !canViewCourse(auth, project.courseId)) {
        reply.code(403).send(Errors.forbidden());
        return;
      }
      const milestones = await store.listTrackingMilestones(requestBaseUrl(request), project.id);
      const template = project.templateId
        ? await store.getProjectTemplateById(requestBaseUrl(request), project.templateId)
        : null;
      return TrackingProjectDetailSchema.parse({
        ...presentProject(project),
        milestones: milestones.map((milestone) => presentMilestone(milestone, [], [])),
        template,
      });
    }
  );

  app.patch(
    '/v1/tracking/projects/:projectId',
    { schema: { tags: ['tracking'], summary: 'Update a project' } },
    async (request, reply) => {
      const auth = await requireUser(request, reply, store);
      if (!auth) return;
      const params = request.params as { projectId: string };
      if (!validateId(params.projectId, reply, 'projectId')) return;
      const project = await store.getTrackingProjectById(requestBaseUrl(request), params.projectId);
      if (!project || !canManageProject(auth, project)) {
        reply
          .code(project ? 403 : 404)
          .send(project ? Errors.forbidden() : Errors.notFound('Project'));
        return;
      }
      const payload = UpdateTrackingProjectRequestSchema.parse(request.body);
      const updated = await store.updateTrackingProject(
        requestBaseUrl(request),
        auth.user.id,
        params.projectId,
        payload
      );
      if (!updated) {
        reply.code(404).send(Errors.notFound('Project'));
        return;
      }
      return TrackingProjectSummarySchema.parse(presentProject(updated));
    }
  );

  app.post(
    '/v1/tracking/projects/:projectId/publish',
    { schema: { tags: ['tracking'], summary: 'Publish a project' } },
    async (request, reply) => {
      const auth = await requireUser(request, reply, store);
      if (!auth) return;
      const params = request.params as { projectId: string };
      if (!validateId(params.projectId, reply, 'projectId')) return;
      const project = await store.getTrackingProjectById(requestBaseUrl(request), params.projectId);
      if (!project || !canManageProject(auth, project)) {
        reply
          .code(project ? 403 : 404)
          .send(project ? Errors.forbidden() : Errors.notFound('Project'));
        return;
      }
      const updated = await store.setTrackingProjectStatus(
        requestBaseUrl(request),
        auth.user.id,
        params.projectId,
        'published'
      );
      return TrackingProjectSummarySchema.parse(presentProject(updated || project));
    }
  );

  app.post(
    '/v1/tracking/projects/:projectId/unpublish',
    { schema: { tags: ['tracking'], summary: 'Unpublish a project' } },
    async (request, reply) => {
      const auth = await requireUser(request, reply, store);
      if (!auth) return;
      const params = request.params as { projectId: string };
      if (!validateId(params.projectId, reply, 'projectId')) return;
      const project = await store.getTrackingProjectById(requestBaseUrl(request), params.projectId);
      if (!project || !canManageProject(auth, project)) {
        reply
          .code(project ? 403 : 404)
          .send(project ? Errors.forbidden() : Errors.notFound('Project'));
        return;
      }
      const updated = await store.setTrackingProjectStatus(
        requestBaseUrl(request),
        auth.user.id,
        params.projectId,
        'draft'
      );
      return TrackingProjectSummarySchema.parse(presentProject(updated || project));
    }
  );

  app.get(
    '/v1/tracking/projects/:projectId/milestones',
    { schema: { tags: ['tracking'], summary: 'List project milestones' } },
    async (request, reply) => {
      const auth = await requireUser(request, reply, store);
      if (!auth) return;
      const params = request.params as { projectId: string };
      if (!validateId(params.projectId, reply, 'projectId')) return;
      const project = await store.getTrackingProjectById(requestBaseUrl(request), params.projectId);
      if (!project || !project.courseId || !canViewCourse(auth, project.courseId)) {
        reply
          .code(project ? 403 : 404)
          .send(project ? Errors.forbidden() : Errors.notFound('Project'));
        return;
      }
      const milestones = await store.listTrackingMilestones(
        requestBaseUrl(request),
        params.projectId
      );
      return milestones.map((entry) =>
        TrackingMilestoneSchema.parse(presentMilestone(entry, [], []))
      );
    }
  );

  app.post(
    '/v1/tracking/projects/:projectId/milestones',
    { schema: { tags: ['tracking'], summary: 'Create a milestone' } },
    async (request, reply) => {
      const auth = await requireUser(request, reply, store);
      if (!auth) return;
      const params = request.params as { projectId: string };
      if (!validateId(params.projectId, reply, 'projectId')) return;
      const project = await store.getTrackingProjectById(requestBaseUrl(request), params.projectId);
      if (!project || !canManageProject(auth, project)) {
        reply
          .code(project ? 403 : 404)
          .send(project ? Errors.forbidden() : Errors.notFound('Project'));
        return;
      }
      const payload = CreateMilestoneRequestSchema.parse(request.body);
      const milestone = await store.createTrackingMilestone(
        requestBaseUrl(request),
        auth.user.id,
        params.projectId,
        payload
      );
      reply.code(201);
      return TrackingMilestoneSchema.parse(presentMilestone(milestone, [], []));
    }
  );

  app.get(
    '/v1/tracking/milestones/:milestoneId',
    { schema: { tags: ['tracking'], summary: 'Get milestone with submissions' } },
    async (request, reply) => {
      const auth = await requireUser(request, reply, store);
      if (!auth) return;
      const params = request.params as { milestoneId: string };
      if (!validateId(params.milestoneId, reply, 'milestoneId')) return;
      const milestone = await store.getTrackingMilestone(
        requestBaseUrl(request),
        params.milestoneId
      );
      if (!milestone) {
        reply.code(404).send(Errors.notFound('Milestone'));
        return;
      }
      const project = await store.getTrackingProjectById(
        requestBaseUrl(request),
        milestone.projectId
      );
      if (!project?.courseId || !canViewCourse(auth, project.courseId)) {
        reply.code(403).send(Errors.forbidden());
        return;
      }
      const canManage = canManageProject(auth, project);
      const submissions = (
        await store.listTrackingMilestoneSubmissions(requestBaseUrl(request), milestone.id)
      ).filter(
        (entry) => auth.user.systemRole === 'admin' || canManage || entry.userId === auth.user.id
      );
      const reviews = (
        await Promise.all(
          submissions.map((entry) => store.getTrackingReview(requestBaseUrl(request), entry.id))
        )
      ).filter(isReviewRecord);
      return TrackingMilestoneSchema.parse(presentMilestone(milestone, submissions, reviews));
    }
  );

  app.patch(
    '/v1/tracking/milestones/:milestoneId',
    { schema: { tags: ['tracking'], summary: 'Update a milestone' } },
    async (request, reply) => {
      const auth = await requireUser(request, reply, store);
      if (!auth) return;
      const params = request.params as { milestoneId: string };
      if (!validateId(params.milestoneId, reply, 'milestoneId')) return;
      const milestone = await store.getTrackingMilestone(
        requestBaseUrl(request),
        params.milestoneId
      );
      if (!milestone) {
        reply.code(404).send(Errors.notFound('Milestone'));
        return;
      }
      const project = await store.getTrackingProjectById(
        requestBaseUrl(request),
        milestone.projectId
      );
      if (!project || !canManageProject(auth, project)) {
        reply.code(403).send(Errors.forbidden());
        return;
      }
      const payload = UpdateMilestoneRequestSchema.parse(request.body);
      const updated = await store.updateTrackingMilestone(
        requestBaseUrl(request),
        auth.user.id,
        params.milestoneId,
        payload
      );
      return TrackingMilestoneSchema.parse(presentMilestone(updated || milestone, [], []));
    }
  );

  app.delete(
    '/v1/tracking/milestones/:milestoneId',
    { schema: { tags: ['tracking'], summary: 'Delete a milestone' } },
    async (request, reply) => {
      const auth = await requireUser(request, reply, store);
      if (!auth) return;
      const params = request.params as { milestoneId: string };
      if (!validateId(params.milestoneId, reply, 'milestoneId')) return;
      const milestone = await store.getTrackingMilestone(
        requestBaseUrl(request),
        params.milestoneId
      );
      if (!milestone) {
        reply.code(404).send(Errors.notFound('Milestone'));
        return;
      }
      const project = await store.getTrackingProjectById(
        requestBaseUrl(request),
        milestone.projectId
      );
      if (!project || !canManageProject(auth, project)) {
        reply.code(403).send(Errors.forbidden());
        return;
      }
      await store.deleteTrackingMilestone(
        requestBaseUrl(request),
        auth.user.id,
        params.milestoneId
      );
      return { ok: true };
    }
  );

  app.post(
    '/v1/tracking/projects/:projectId/applications',
    { schema: { tags: ['tracking'], summary: 'Create or update a role application for a project' } },
    async (request, reply) => {
      const auth = await requireUser(request, reply, store);
      if (!auth) return;
      const params = request.params as { projectId: string };
      if (!validateId(params.projectId, reply, 'projectId')) return;
      const project = await store.getTrackingProjectById(requestBaseUrl(request), params.projectId);
      if (!project || !project.courseId) {
        reply.code(404).send(Errors.notFound('Project'));
        return;
      }
      if (!canViewCourse(auth, project.courseId) || !isStudentMember(auth, project.courseId)) {
        reply.code(403).send(Errors.forbidden());
        return;
      }
      if (project.status !== 'published' || project.deliveryMode !== 'team') {
        reply.code(422).send(Errors.validation('This project is not accepting team applications.'));
        return;
      }
      const now = new Date();
      if (project.applicationOpenAt && new Date(project.applicationOpenAt) > now) {
        reply.code(422).send(Errors.validation('Applications for this project are not open yet.'));
        return;
      }
      if (project.applicationCloseAt && new Date(project.applicationCloseAt) < now) {
        reply.code(422).send(Errors.validation('Applications for this project are already closed.'));
        return;
      }
      const payload = CreateProjectRoleApplicationRequestSchema.parse(request.body);
      try {
        const application = await store.createProjectRoleApplication(
          requestBaseUrl(request),
          auth.user.id,
          params.projectId,
          payload
        );
        reply.code(201);
        return ProjectRoleApplicationSchema.parse(application);
      } catch (error) {
        reply
          .code(422)
          .send(Errors.validation(error instanceof Error ? error.message : 'Failed to save application.'));
      }
    }
  );

  app.get(
    '/v1/tracking/projects/:projectId/applications/me',
    { schema: { tags: ['tracking'], summary: 'Get current user application for a project' } },
    async (request, reply) => {
      const auth = await requireUser(request, reply, store);
      if (!auth) return;
      const params = request.params as { projectId: string };
      if (!validateId(params.projectId, reply, 'projectId')) return;
      const project = await store.getTrackingProjectById(requestBaseUrl(request), params.projectId);
      if (!project || !project.courseId || !canViewCourse(auth, project.courseId)) {
        reply.code(project ? 403 : 404).send(project ? Errors.forbidden() : Errors.notFound('Project'));
        return;
      }
      const application = await store.getProjectRoleApplicationForUser(
        requestBaseUrl(request),
        params.projectId,
        auth.user.id
      );
      return application ? ProjectRoleApplicationSchema.parse(application) : null;
    }
  );

  app.get(
    '/v1/tracking/projects/:projectId/applications',
    { schema: { tags: ['tracking'], summary: 'List role applications for a project' } },
    async (request, reply) => {
      const auth = await requireUser(request, reply, store);
      if (!auth) return;
      const params = request.params as { projectId: string };
      if (!validateId(params.projectId, reply, 'projectId')) return;
      const project = await store.getTrackingProjectById(requestBaseUrl(request), params.projectId);
      if (!project || !canManageProject(auth, project)) {
        reply.code(project ? 403 : 404).send(project ? Errors.forbidden() : Errors.notFound('Project'));
        return;
      }
      const applications = await store.listProjectRoleApplications(
        requestBaseUrl(request),
        params.projectId
      );
      return applications.map((entry) => ProjectRoleApplicationSchema.parse(entry));
    }
  );

  app.post(
    '/v1/tracking/projects/:projectId/team-formation/generate',
    { schema: { tags: ['tracking'], summary: 'Generate suggested teams for a project' } },
    async (request, reply) => {
      const auth = await requireUser(request, reply, store);
      if (!auth) return;
      const params = request.params as { projectId: string };
      if (!validateId(params.projectId, reply, 'projectId')) return;
      const project = await store.getTrackingProjectById(requestBaseUrl(request), params.projectId);
      if (!project || !canManageProject(auth, project)) {
        reply.code(project ? 403 : 404).send(project ? Errors.forbidden() : Errors.notFound('Project'));
        return;
      }
      const payload = GenerateTeamFormationRequestSchema.parse(request.body ?? {});
      try {
        const run = await store.generateProjectTeamFormation(
          requestBaseUrl(request),
          auth.user.id,
          params.projectId,
          payload
        );
        return TeamFormationRunSchema.parse(run);
      } catch (error) {
        reply
          .code(422)
          .send(Errors.validation(error instanceof Error ? error.message : 'Failed to generate teams.'));
      }
    }
  );

  app.post(
    '/v1/tracking/projects/:projectId/team-formation/lock',
    { schema: { tags: ['tracking'], summary: 'Lock generated teams for a project' } },
    async (request, reply) => {
      const auth = await requireUser(request, reply, store);
      if (!auth) return;
      const params = request.params as { projectId: string };
      if (!validateId(params.projectId, reply, 'projectId')) return;
      const project = await store.getTrackingProjectById(requestBaseUrl(request), params.projectId);
      if (!project || !canManageProject(auth, project)) {
        reply.code(project ? 403 : 404).send(project ? Errors.forbidden() : Errors.notFound('Project'));
        return;
      }
      const payload = LockTeamFormationRequestSchema.parse(request.body ?? {});
      try {
        const teams = await store.lockProjectTeams(
          requestBaseUrl(request),
          auth.user.id,
          params.projectId,
          payload
        );
        return teams.map((entry) => TeamSchema.parse(entry));
      } catch (error) {
        reply
          .code(422)
          .send(Errors.validation(error instanceof Error ? error.message : 'Failed to lock teams.'));
      }
    }
  );

  app.get(
    '/v1/tracking/projects/:projectId/teams',
    { schema: { tags: ['tracking'], summary: 'List teams for a project' } },
    async (request, reply) => {
      const auth = await requireUser(request, reply, store);
      if (!auth) return;
      const params = request.params as { projectId: string };
      if (!validateId(params.projectId, reply, 'projectId')) return;
      const project = await store.getTrackingProjectById(requestBaseUrl(request), params.projectId);
      if (!project || !project.courseId || !canViewCourse(auth, project.courseId)) {
        reply.code(project ? 403 : 404).send(project ? Errors.forbidden() : Errors.notFound('Project'));
        return;
      }
      const teams = await store.listProjectTeams(requestBaseUrl(request), params.projectId);
      const visibleTeams = canManageProject(auth, project)
        ? teams
        : teams.filter((team) => team.members.some((member) => member.userId === auth.user.id));
      return visibleTeams.map((entry) => TeamSchema.parse(entry));
    }
  );

  app.patch(
    '/v1/tracking/projects/:projectId/teams/:teamId',
    { schema: { tags: ['tracking'], summary: 'Update a team assignment' } },
    async (request, reply) => {
      const auth = await requireUser(request, reply, store);
      if (!auth) return;
      const params = request.params as { projectId: string; teamId: string };
      if (!validateId(params.projectId, reply, 'projectId')) return;
      if (!validateId(params.teamId, reply, 'teamId')) return;
      const project = await store.getTrackingProjectById(requestBaseUrl(request), params.projectId);
      if (!project || !canManageProject(auth, project)) {
        reply.code(project ? 403 : 404).send(project ? Errors.forbidden() : Errors.notFound('Project'));
        return;
      }
      const payload = UpdateTeamRequestSchema.parse(request.body);
      const updated = await store.updateProjectTeam(
        requestBaseUrl(request),
        auth.user.id,
        params.projectId,
        params.teamId,
        payload
      );
      if (!updated) {
        reply.code(404).send(Errors.notFound('Team'));
        return;
      }
      return TeamSchema.parse(updated);
    }
  );

  app.get(
    '/v1/tracking/milestones/:milestoneId/submissions',
    { schema: { tags: ['tracking'], summary: 'List milestone submissions' } },
    async (request, reply) => {
      const auth = await requireUser(request, reply, store);
      if (!auth) return;
      const params = request.params as { milestoneId: string };
      if (!validateId(params.milestoneId, reply, 'milestoneId')) return;
      const milestone = await store.getTrackingMilestone(
        requestBaseUrl(request),
        params.milestoneId
      );
      if (!milestone) {
        reply.code(404).send(Errors.notFound('Milestone'));
        return;
      }
      const project = await store.getTrackingProjectById(
        requestBaseUrl(request),
        milestone.projectId
      );
      if (!project?.courseId || !canViewCourse(auth, project.courseId)) {
        reply.code(403).send(Errors.forbidden());
        return;
      }
      const canManage = canManageProject(auth, project);
      const query = request.query as { limit?: string; offset?: string };
      const opts = parsePaginationOpts(query);
      const [submissions, total] = await Promise.all([
        store.listTrackingMilestoneSubmissions(requestBaseUrl(request), params.milestoneId, opts),
        opts
          ? store.countTrackingMilestoneSubmissions(requestBaseUrl(request), params.milestoneId)
          : Promise.resolve(undefined),
      ]);
      if (total !== undefined) void reply.header('X-Total-Count', String(total));
      return submissions
        .filter(
          (entry) =>
            auth.user.systemRole === 'admin' ||
            canManage ||
            entry.userId === auth.user.id ||
            entry.submittedByUserId === auth.user.id ||
            entry.teamMemberUserIds.includes(auth.user.id)
        )
        .map((entry) => TrackingSubmissionSchema.parse(entry));
    }
  );

  app.post(
    '/v1/tracking/milestones/:milestoneId/submissions',
    { schema: { tags: ['tracking'], summary: 'Create a milestone submission' } },
    async (request, reply) => {
      const auth = await requireUser(request, reply, store);
      if (!auth) return;
      const params = request.params as { milestoneId: string };
      if (!validateId(params.milestoneId, reply, 'milestoneId')) return;
      const milestone = await store.getTrackingMilestone(
        requestBaseUrl(request),
        params.milestoneId
      );
      if (!milestone) {
        reply.code(404).send(Errors.notFound('Milestone'));
        return;
      }
      const project = await store.getTrackingProjectById(
        requestBaseUrl(request),
        milestone.projectId
      );
      if (!project?.courseId || !canViewCourse(auth, project.courseId)) {
        reply.code(403).send(Errors.forbidden());
        return;
      }
      // Enforce deadline: reject submissions past dueAt unless user is admin or instructor
      if (milestone.dueAt && new Date(milestone.dueAt) < new Date()) {
        const canManage = canManageProject(auth, project!);
        if (!canManage && auth.user.systemRole !== 'admin') {
          reply.code(422).send(apiError('VALIDATION_ERROR', 'The submission deadline has passed.'));
          return;
        }
      }
      if (project.deliveryMode === 'team' && project.teamFormationStatus !== 'teams_locked') {
        reply.code(422).send(
          Errors.validation('Teams must be locked before team projects can accept submissions.')
        );
        return;
      }
      const payload = CreateTrackingSubmissionRequestSchema.parse(request.body);
      let created;
      try {
        created = await store.createTrackingSubmission(
          requestBaseUrl(request),
          auth.user.id,
          params.milestoneId,
          payload
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to create submission.';
        const statusCode =
          /not assigned/i.test(message) || /forbidden/i.test(message)
            ? 403
            : /locked/i.test(message) || /accept submissions/i.test(message)
              ? 422
              : 422;
        reply.code(statusCode).send(statusCode === 403 ? Errors.forbidden() : Errors.validation(message));
        return;
      }
      reply.code(201);
      return TrackingSubmissionSchema.parse(created);
    }
  );

  app.get(
    '/v1/tracking/submissions/:submissionId',
    { schema: { tags: ['tracking'], summary: 'Get a submission' } },
    async (request, reply) => {
      const auth = await requireUser(request, reply, store);
      if (!auth) return;
      const params = request.params as { submissionId: string };
      if (!validateId(params.submissionId, reply, 'submissionId')) return;
      const submission = await store.getSubmissionForAdmin(
        requestBaseUrl(request),
        params.submissionId
      );
      if (!submission) {
        reply.code(404).send(Errors.notFound('Submission'));
        return;
      }
      const project = await store.getTrackingProjectById(
        requestBaseUrl(request),
        submission.projectId
      );
      if (!canViewSubmission(auth, project, submission)) {
        reply.code(403).send(Errors.forbidden());
        return;
      }
      return TrackingSubmissionSchema.parse(submission);
    }
  );

  app.patch(
    '/v1/tracking/submissions/:submissionId',
    { schema: { tags: ['tracking'], summary: 'Update a submission' } },
    async (request, reply) => {
      const auth = await requireUser(request, reply, store);
      if (!auth) return;
      const params = request.params as { submissionId: string };
      if (!validateId(params.submissionId, reply, 'submissionId')) return;
      const existing = await store.getSubmissionForAdmin(
        requestBaseUrl(request),
        params.submissionId
      );
      if (!existing) {
        reply.code(404).send(Errors.notFound('Submission'));
        return;
      }
      const project = await store.getTrackingProjectById(
        requestBaseUrl(request),
        existing.projectId
      );
      if (!canViewSubmission(auth, project, existing)) {
        reply.code(403).send(Errors.forbidden());
        return;
      }
      const canManageExistingProject = project ? canManageProject(auth, project) : false;
      if (
        existing.userId === auth.user.id &&
        auth.user.systemRole !== 'admin' &&
        !canManageExistingProject
      ) {
        const review = await store.getTrackingReview(requestBaseUrl(request), params.submissionId);
        if (review && (review.status === 'approved' || review.status === 'graded')) {
          reply.code(422).send(Errors.validation('Approved submissions can no longer be edited.'));
          return;
        }
      }
      const payload = UpdateTrackingSubmissionRequestSchema.parse(request.body);
      const updated = await store.updateTrackingSubmission(
        requestBaseUrl(request),
        auth.user.id,
        params.submissionId,
        payload
      );
      return TrackingSubmissionSchema.parse(updated || existing);
    }
  );

  app.get(
    '/v1/tracking/submissions/:submissionId/review',
    { schema: { tags: ['tracking'], summary: 'Get submission review' } },
    async (request, reply) => {
      const auth = await requireUser(request, reply, store);
      if (!auth) return;
      const params = request.params as { submissionId: string };
      if (!validateId(params.submissionId, reply, 'submissionId')) return;
      const submission = await store.getSubmissionForAdmin(
        requestBaseUrl(request),
        params.submissionId
      );
      if (!submission) {
        reply.code(404).send(Errors.notFound('Submission'));
        return;
      }
      const project = await store.getTrackingProjectById(
        requestBaseUrl(request),
        submission.projectId
      );
      if (!canViewSubmission(auth, project, submission)) {
        reply.code(403).send(Errors.forbidden());
        return;
      }
      const review = await store.getTrackingReview(requestBaseUrl(request), params.submissionId);
      if (!review) {
        reply.code(404).send({ error: 'No review found.' });
        return;
      }
      return TrackingReviewSchema.parse(review);
    }
  );

  app.post(
    '/v1/tracking/submissions/:submissionId/review',
    { schema: { tags: ['tracking'], summary: 'Create a submission review' } },
    async (request, reply) => {
      const auth = await requireUser(request, reply, store);
      if (!auth) return;
      const params = request.params as { submissionId: string };
      if (!validateId(params.submissionId, reply, 'submissionId')) return;
      const submission = await store.getSubmissionForAdmin(
        requestBaseUrl(request),
        params.submissionId
      );
      if (!submission) {
        reply.code(404).send(Errors.notFound('Submission'));
        return;
      }
      const project = await store.getTrackingProjectById(
        requestBaseUrl(request),
        submission.projectId
      );
      if (!project || !canManageProject(auth, project)) {
        reply.code(403).send(Errors.forbidden());
        return;
      }
      const payload = CreateReviewRequestSchema.parse(request.body);
      const review = await store.createTrackingReview(
        requestBaseUrl(request),
        auth.user.id,
        params.submissionId,
        payload
      );

      // Notify student by email + in-app notification (fire-and-forget; non-fatal)
      void store
        .getSubmissionStudentEmail(requestBaseUrl(request), params.submissionId)
        .then(async (student) => {
          if (!student) return;
          const webBase =
            process.env.NIBRAS_WEB_BASE_URL ??
            process.env.NEXT_PUBLIC_NIBRAS_WEB_BASE_URL ??
            requestBaseUrl(request);
          const submissionUrl = `${webBase}/submissions/${params.submissionId}`;
          const statusLabel =
            payload.status === 'approved'
              ? 'Approved ✓'
              : payload.status === 'graded'
                ? 'Graded'
                : payload.status === 'changes_requested'
                  ? 'Changes requested'
                  : 'Reviewed';

          // In-app notification
          await store.createNotification(requestBaseUrl(request), student.userId, {
            type: 'feedback',
            title: `${statusLabel} — ${project?.title ?? 'Submission'}`,
            body: payload.feedback
              ? payload.feedback.slice(0, 120) + (payload.feedback.length > 120 ? '…' : '')
              : `Your submission has been reviewed.`,
            link: submissionUrl,
          });

          // Email
          return sendReviewSubmittedEmail({
            studentEmail: student.email,
            studentName: student.username,
            projectName: project?.title ?? submission.projectId,
            reviewStatus: payload.status as 'approved' | 'graded' | 'changes_requested' | 'pending',
            feedback: payload.feedback,
            submissionUrl,
          });
        })
        .catch(() => {
          /* notification/email errors are non-fatal */
        });

      reply.code(201);
      return TrackingReviewSchema.parse(review);
    }
  );

  app.get(
    '/v1/tracking/review-queue',
    { schema: { tags: ['tracking'], summary: 'Get instructor review queue' } },
    async (request, reply) => {
      const auth = await requireUser(request, reply, store);
      if (!auth) return;
      if (!hasAnyInstructorAccess(auth)) {
        reply.code(403).send(Errors.forbidden());
        return;
      }
      const query = request.query as {
        courseId?: string;
        projectId?: string;
        status?: 'queued' | 'running' | 'passed' | 'failed' | 'needs_review';
        limit?: string;
        offset?: string;
      };
      if (query.courseId && !canManageCourse(auth, query.courseId)) {
        reply.code(403).send(Errors.forbidden());
        return;
      }
      const filters = {
        courseId: query.courseId,
        projectId: query.projectId,
        status: query.status,
      };
      const opts = parsePaginationOpts(query);
      const [results, total] = await Promise.all([
        store.listTrackingReviewQueue(requestBaseUrl(request), filters, opts),
        opts
          ? store.countTrackingReviewQueue(requestBaseUrl(request), filters)
          : Promise.resolve(undefined),
      ]);
      if (total !== undefined) void reply.header('X-Total-Count', String(total));
      const filtered =
        auth.user.systemRole === 'admin'
          ? results
          : (
              await Promise.all(
                results.map(async (submission) => {
                  const project = await store.getTrackingProjectById(
                    requestBaseUrl(request),
                    submission.projectId
                  );
                  return project && canManageProject(auth, project) ? submission : null;
                })
              )
            ).filter((entry): entry is NonNullable<typeof entry> => entry !== null);
      return ReviewQueueResponseSchema.parse({ submissions: filtered });
    }
  );

  app.get(
    '/v1/tracking/activity',
    { schema: { tags: ['tracking'], summary: 'Get activity feed for current user' } },
    async (request, reply) => {
      const auth = await requireUser(request, reply, store);
      if (!auth) return;
      return await store.listTrackingActivity(requestBaseUrl(request), auth.user.id);
    }
  );

  app.get(
    '/v1/tracking/dashboard/home',
    { schema: { tags: ['tracking'], summary: 'Get role-aware home dashboard' } },
    async (request, reply) => {
      const auth = await requireUser(request, reply, store);
      if (!auth) return;
      const query = request.query as { mode?: string };
      if (query.mode && query.mode !== 'student' && query.mode !== 'instructor') {
        reply.code(400).send(Errors.validation('mode must be "student" or "instructor"'));
        return;
      }
      const dashboard = await store.getHomeDashboard(
        requestBaseUrl(request),
        auth.user.id,
        query.mode as 'student' | 'instructor' | undefined
      );
      if (
        query.mode &&
        !dashboard.availableModes.includes(query.mode as 'student' | 'instructor')
      ) {
        reply.code(403).send(Errors.forbidden());
        return;
      }
      return presentHomeDashboard(dashboard);
    }
  );

  app.get(
    '/v1/tracking/dashboard/student',
    { schema: { tags: ['tracking'], summary: 'Get student dashboard' } },
    async (request, reply) => {
      const auth = await requireUser(request, reply, store);
      if (!auth) return;
      const query = request.query as { courseId?: string };
      const dashboard = await store.getStudentTrackingDashboard(
        requestBaseUrl(request),
        auth.user.id,
        query.courseId || null
      );
      const submissionsByMilestone: Record<
        string,
        Awaited<ReturnType<AppStore['listTrackingMilestoneSubmissions']>>
      > = {};
      const reviewsByMilestone: Record<
        string,
        NonNullable<Awaited<ReturnType<AppStore['getTrackingReview']>>>[]
      > = {};
      for (const milestones of Object.values(dashboard.milestonesByProject)) {
        for (const milestone of milestones) {
          const submissions = (
            await store.listTrackingMilestoneSubmissions(requestBaseUrl(request), milestone.id)
          ).filter((entry) => entry.userId === auth.user.id);
          submissionsByMilestone[milestone.id] = submissions;
          const reviews = (
            await Promise.all(
              submissions.map((entry) => store.getTrackingReview(requestBaseUrl(request), entry.id))
            )
          ).filter(isReviewRecord);
          reviewsByMilestone[milestone.id] = reviews;
        }
      }
      return presentStudentDashboard({
        dashboard,
        submissionsByMilestone,
        reviewsByMilestone,
      });
    }
  );

  app.get(
    '/v1/tracking/dashboard/instructor',
    { schema: { tags: ['tracking'], summary: 'Get instructor dashboard' } },
    async (request, reply) => {
      const auth = await requireUser(request, reply, store);
      if (!auth) return;
      if (!hasAnyInstructorAccess(auth)) {
        reply.code(403).send(Errors.forbidden());
        return;
      }
      return presentInstructorDashboard(
        await store.getInstructorTrackingDashboard(requestBaseUrl(request), auth.user.id)
      );
    }
  );

  app.get(
    '/v1/tracking/dashboard/course/:courseId',
    { schema: { tags: ['tracking'], summary: 'Get course-level dashboard' } },
    async (request, reply) => {
      const auth = await requireUser(request, reply, store);
      if (!auth) return;
      const params = request.params as { courseId: string };
      if (!validateId(params.courseId, reply, 'courseId')) return;
      if (!canManageCourse(auth, params.courseId)) {
        reply.code(403).send(Errors.forbidden());
        return;
      }
      return presentInstructorDashboard(
        await store.getCourseTrackingDashboard(
          requestBaseUrl(request),
          auth.user.id,
          params.courseId
        )
      );
    }
  );

  app.post(
    '/v1/tracking/courses/:courseId/invites',
    { schema: { tags: ['tracking'], summary: 'Create a course invite link' } },
    async (request, reply) => {
      const auth = await requireUser(request, reply, store);
      if (!auth) return;
      const params = request.params as { courseId: string };
      if (!validateId(params.courseId, reply, 'courseId')) return;
      if (!canManageCourse(auth, params.courseId)) {
        reply.code(403).send(Errors.forbidden());
        return;
      }
      const body = request.body as { role?: string; maxUses?: number; expiresAt?: string | null };
      const role = (body.role as 'student' | 'instructor' | 'ta') || 'student';
      const invite = await store.createCourseInvite(
        requestBaseUrl(request),
        params.courseId,
        role,
        {
          maxUses: body.maxUses,
          expiresAt: body.expiresAt,
        }
      );
      const inviteUrl = `${requestBaseUrl(request)}/join/${invite.code}`;
      reply.code(201);
      return { code: invite.code, inviteUrl };
    }
  );

  app.get(
    '/v1/tracking/invites/:code',
    { schema: { tags: ['tracking'], summary: 'Look up a course invite' } },
    async (request, reply) => {
      const params = request.params as { code: string };
      const invite = await store.getCourseInviteByCode(requestBaseUrl(request), params.code);
      if (!invite) {
        reply.code(404).send(Errors.notFound('Invite'));
        return;
      }
      if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
        reply.code(410).send(apiError('NOT_FOUND', 'This invite link has expired.'));
        return;
      }
      return {
        code: invite.code,
        courseTitle: invite.course.title,
        courseCode: invite.course.courseCode,
        termLabel: invite.course.termLabel,
        role: invite.role,
        expiresAt: invite.expiresAt,
      };
    }
  );

  app.post(
    '/v1/tracking/invites/:code/join',
    { schema: { tags: ['tracking'], summary: 'Join a course via invite link' } },
    async (request, reply) => {
      const auth = await requireUser(request, reply, store);
      if (!auth) return;
      const params = request.params as { code: string };
      try {
        const membership = await store.redeemCourseInvite(
          requestBaseUrl(request),
          params.code,
          auth.user.id
        );
        reply.code(201);
        return membership;
      } catch (err) {
        const e = err as { statusCode?: number; message?: string };
        reply
          .code(e.statusCode || 409)
          .send(apiError('CONFLICT', e.message || 'Failed to join course.'));
      }
    }
  );

  app.get(
    '/v1/tracking/analytics/student',
    { schema: { tags: ['tracking'], summary: 'Get student submission analytics' } },
    async (request, reply) => {
      const auth = await requireUser(request, reply, store);
      if (!auth) return;
      const query = request.query as { courseId?: string };

      const courses = await store.listTrackingCourses(requestBaseUrl(request), auth.user.id);
      const filteredCourses = query.courseId
        ? courses.filter((c) => c.id === query.courseId)
        : courses;

      const analytics = await Promise.all(
        filteredCourses.map(async (course) => {
          const projects = await store.listTrackingProjects(requestBaseUrl(request), course.id);
          const projectStats = await Promise.all(
            projects.map(async (project) => {
              const milestones = await store.listTrackingMilestones(
                requestBaseUrl(request),
                project.id
              );
              const milestoneStats = await Promise.all(
                milestones.map(async (milestone) => {
                  const submissions = (
                    await store.listTrackingMilestoneSubmissions(
                      requestBaseUrl(request),
                      milestone.id
                    )
                  ).filter((s) => s.userId === auth.user.id);
                  const latest = submissions[0] || null;
                  return {
                    milestoneId: milestone.id,
                    milestoneTitle: milestone.title,
                    dueAt: milestone.dueAt,
                    submissionCount: submissions.length,
                    latestStatus: latest?.status ?? null,
                    latestSubmittedAt: latest?.createdAt ?? null,
                  };
                })
              );
              const submitted = milestoneStats.filter((m) => m.submissionCount > 0).length;
              const passed = milestoneStats.filter((m) => m.latestStatus === 'passed').length;
              return {
                projectId: project.id,
                projectTitle: project.title,
                totalMilestones: milestones.length,
                submittedMilestones: submitted,
                passedMilestones: passed,
                milestones: milestoneStats,
              };
            })
          );
          return {
            courseId: course.id,
            courseTitle: course.title,
            projects: projectStats,
          };
        })
      );

      return { userId: auth.user.id, analytics };
    }
  );

  app.get(
    '/v1/tracking/submissions/:submissionId/commits',
    { schema: { tags: ['tracking'], summary: 'Get commits linked to a submission' } },
    async (request, reply) => {
      const auth = await requireUser(request, reply, store);
      if (!auth) return;
      const params = request.params as { submissionId: string };
      if (!validateId(params.submissionId, reply, 'submissionId')) return;
      const submission = await store.getSubmissionForAdmin(
        requestBaseUrl(request),
        params.submissionId
      );
      if (!submission) {
        reply.code(404).send(Errors.notFound('Submission'));
        return;
      }
      const project = await store.getTrackingProjectById(
        requestBaseUrl(request),
        submission.projectId
      );
      if (!canViewSubmission(auth, project, submission)) {
        reply.code(403).send(Errors.forbidden());
        return;
      }
      return await store.getTrackingSubmissionCommits(requestBaseUrl(request), params.submissionId);
    }
  );

  /**
   * GET /v1/tracking/courses/:courseId/export.csv
   * Export all student submission data for the course as a CSV file.
   * Restricted to instructors, TAs, and admins.
   */
  app.get(
    '/v1/tracking/courses/:courseId/export.csv',
    {
      schema: {
        tags: ['tracking'],
        summary: 'Export student grades as CSV (instructor/admin only)',
        produces: ['text/csv'],
      },
    },
    async (request, reply) => {
      const auth = await requireUser(request, reply, store);
      if (!auth) return;
      const params = request.params as { courseId: string };
      if (!validateId(params.courseId, reply, 'courseId')) return;
      if (!canManageCourse(auth, params.courseId)) {
        return reply.code(403).send(Errors.forbidden());
      }
      const rows = await store.exportCourseGrades(requestBaseUrl(request), params.courseId);
      const csvCell = (value: string | null | undefined): string =>
        `"${String(value ?? '').replace(/"/g, '""')}"`;
      const header =
        'githubLogin,username,milestoneTitle,projectKey,status,submittedAt,commitSha\n';
      const body = rows
        .map((r) =>
          [
            r.githubLogin,
            r.username,
            r.milestoneTitle,
            r.projectKey,
            r.status,
            r.submittedAt,
            r.commitSha,
          ]
            .map(csvCell)
            .join(',')
        )
        .join('\n');
      return reply
        .header('Content-Type', 'text/csv; charset=utf-8')
        .header(
          'Content-Disposition',
          `attachment; filename="course-${params.courseId}-grades.csv"`
        )
        .send(header + body + '\n');
    }
  );
}

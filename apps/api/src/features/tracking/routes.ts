import { FastifyInstance } from "fastify";
import {
  AddCourseMemberRequestSchema,
  CourseMemberSchema,
  CreateMilestoneRequestSchema,
  CreateReviewRequestSchema,
  CreateTrackingCourseRequestSchema,
  CreateTrackingProjectRequestSchema,
  CreateTrackingSubmissionRequestSchema,
  ReviewQueueResponseSchema,
  TrackingCourseSummarySchema,
  TrackingMilestoneSchema,
  TrackingProjectDetailSchema,
  TrackingProjectSummarySchema,
  TrackingReviewSchema,
  TrackingSubmissionSchema,
  UpdateMilestoneRequestSchema,
  UpdateTrackingProjectRequestSchema,
  UpdateTrackingSubmissionRequestSchema
} from "@nibras/contracts";
import { requireUser } from "../../lib/auth";
import { requestBaseUrl } from "../../lib/request-base-url";
import { AppStore } from "../../store";
import { presentInstructorDashboard, presentMilestone, presentProject, presentStudentDashboard } from "./presenters/dashboard";
import { canManageCourse, canManageProject, canViewCourse, canViewSubmission, hasAnyInstructorAccess } from "./policies/access";

function isReviewRecord<T>(value: T | null): value is T {
  return value !== null;
}

export function registerTrackingRoutes(app: FastifyInstance, store: AppStore): void {
  app.get("/v1/tracking/courses", async (request, reply) => {
    const auth = await requireUser(request, reply, store);
    if (!auth) return;
    return await store.listTrackingCourses(requestBaseUrl(request), auth.user.id);
  });

  app.get("/v1/tracking/courses/:courseId/members", async (request, reply) => {
    const auth = await requireUser(request, reply, store);
    if (!auth) return;
    const params = request.params as { courseId: string };
    if (!canManageCourse(auth, params.courseId)) {
      reply.code(403).send({ error: "Forbidden." });
      return;
    }
    const members = await store.listCourseMembersForInstructor(requestBaseUrl(request), params.courseId);
    return members.map((m) => CourseMemberSchema.parse(m));
  });

  app.post("/v1/tracking/courses/:courseId/members", async (request, reply) => {
    const auth = await requireUser(request, reply, store);
    if (!auth) return;
    const params = request.params as { courseId: string };
    if (!canManageCourse(auth, params.courseId)) {
      reply.code(403).send({ error: "Forbidden." });
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
      const statusCode = (err as { statusCode?: number }).statusCode || 400;
      reply.code(statusCode).send({ error: err instanceof Error ? err.message : "Failed to add member." });
    }
  });

  app.delete("/v1/tracking/courses/:courseId/members/:userId", async (request, reply) => {
    const auth = await requireUser(request, reply, store);
    if (!auth) return;
    const params = request.params as { courseId: string; userId: string };
    if (!canManageCourse(auth, params.courseId)) {
      reply.code(403).send({ error: "Forbidden." });
      return;
    }
    await store.removeCourseMember(requestBaseUrl(request), params.courseId, params.userId);
    return { ok: true };
  });

  app.post("/v1/tracking/courses", async (request, reply) => {
    const auth = await requireUser(request, reply, store);
    if (!auth) return;
    if (auth.user.systemRole !== "admin" && !hasAnyInstructorAccess(auth)) {
      reply.code(403).send({ error: "Only instructors and admins may create courses." });
      return;
    }
    const payload = CreateTrackingCourseRequestSchema.parse(request.body);
    const course = await store.createTrackingCourse(requestBaseUrl(request), auth.user.id, payload);
    reply.code(201);
    return TrackingCourseSummarySchema.parse(course);
  });

  app.get("/v1/tracking/courses/:courseId/projects", async (request, reply) => {
    const auth = await requireUser(request, reply, store);
    if (!auth) return;
    const params = request.params as { courseId: string };
    if (!canViewCourse(auth, params.courseId)) {
      reply.code(403).send({ error: "Forbidden." });
      return;
    }
    return (await store.listTrackingProjects(requestBaseUrl(request), params.courseId)).map(presentProject);
  });

  app.post("/v1/tracking/projects", async (request, reply) => {
    const auth = await requireUser(request, reply, store);
    if (!auth) return;
    const payload = CreateTrackingProjectRequestSchema.parse(request.body);
    if (!canManageCourse(auth, payload.courseId)) {
      reply.code(403).send({ error: "Forbidden." });
      return;
    }
    const created = await store.createTrackingProject(requestBaseUrl(request), auth.user.id, payload);
    reply.code(201);
    return TrackingProjectSummarySchema.parse(presentProject(created));
  });

  app.get("/v1/tracking/projects/:projectId", async (request, reply) => {
    const auth = await requireUser(request, reply, store);
    if (!auth) return;
    const params = request.params as { projectId: string };
    const project = await store.getTrackingProjectById(requestBaseUrl(request), params.projectId);
    if (!project) {
      reply.code(404).send({ error: "Unknown project." });
      return;
    }
    if (!project.courseId || !canViewCourse(auth, project.courseId)) {
      reply.code(403).send({ error: "Forbidden." });
      return;
    }
    const milestones = await store.listTrackingMilestones(requestBaseUrl(request), project.id);
    return TrackingProjectDetailSchema.parse({
      ...presentProject(project),
      milestones: milestones.map((milestone) => presentMilestone(milestone, [], []))
    });
  });

  app.patch("/v1/tracking/projects/:projectId", async (request, reply) => {
    const auth = await requireUser(request, reply, store);
    if (!auth) return;
    const params = request.params as { projectId: string };
    const project = await store.getTrackingProjectById(requestBaseUrl(request), params.projectId);
    if (!project || !canManageProject(auth, project)) {
      reply.code(project ? 403 : 404).send({ error: project ? "Forbidden." : "Unknown project." });
      return;
    }
    const payload = UpdateTrackingProjectRequestSchema.parse(request.body);
    const updated = await store.updateTrackingProject(requestBaseUrl(request), auth.user.id, params.projectId, payload);
    if (!updated) {
      reply.code(404).send({ error: "Unknown project." });
      return;
    }
    return TrackingProjectSummarySchema.parse(presentProject(updated));
  });

  app.post("/v1/tracking/projects/:projectId/publish", async (request, reply) => {
    const auth = await requireUser(request, reply, store);
    if (!auth) return;
    const params = request.params as { projectId: string };
    const project = await store.getTrackingProjectById(requestBaseUrl(request), params.projectId);
    if (!project || !canManageProject(auth, project)) {
      reply.code(project ? 403 : 404).send({ error: project ? "Forbidden." : "Unknown project." });
      return;
    }
    const updated = await store.setTrackingProjectStatus(requestBaseUrl(request), auth.user.id, params.projectId, "published");
    return TrackingProjectSummarySchema.parse(presentProject(updated || project));
  });

  app.post("/v1/tracking/projects/:projectId/unpublish", async (request, reply) => {
    const auth = await requireUser(request, reply, store);
    if (!auth) return;
    const params = request.params as { projectId: string };
    const project = await store.getTrackingProjectById(requestBaseUrl(request), params.projectId);
    if (!project || !canManageProject(auth, project)) {
      reply.code(project ? 403 : 404).send({ error: project ? "Forbidden." : "Unknown project." });
      return;
    }
    const updated = await store.setTrackingProjectStatus(requestBaseUrl(request), auth.user.id, params.projectId, "draft");
    return TrackingProjectSummarySchema.parse(presentProject(updated || project));
  });

  app.get("/v1/tracking/projects/:projectId/milestones", async (request, reply) => {
    const auth = await requireUser(request, reply, store);
    if (!auth) return;
    const params = request.params as { projectId: string };
    const project = await store.getTrackingProjectById(requestBaseUrl(request), params.projectId);
    if (!project || !project.courseId || !canViewCourse(auth, project.courseId)) {
      reply.code(project ? 403 : 404).send({ error: project ? "Forbidden." : "Unknown project." });
      return;
    }
    const milestones = await store.listTrackingMilestones(requestBaseUrl(request), params.projectId);
    return milestones.map((entry) => TrackingMilestoneSchema.parse(presentMilestone(entry, [], [])));
  });

  app.post("/v1/tracking/projects/:projectId/milestones", async (request, reply) => {
    const auth = await requireUser(request, reply, store);
    if (!auth) return;
    const params = request.params as { projectId: string };
    const project = await store.getTrackingProjectById(requestBaseUrl(request), params.projectId);
    if (!project || !canManageProject(auth, project)) {
      reply.code(project ? 403 : 404).send({ error: project ? "Forbidden." : "Unknown project." });
      return;
    }
    const payload = CreateMilestoneRequestSchema.parse(request.body);
    const milestone = await store.createTrackingMilestone(requestBaseUrl(request), auth.user.id, params.projectId, payload);
    reply.code(201);
    return TrackingMilestoneSchema.parse(presentMilestone(milestone, [], []));
  });

  app.get("/v1/tracking/milestones/:milestoneId", async (request, reply) => {
    const auth = await requireUser(request, reply, store);
    if (!auth) return;
    const params = request.params as { milestoneId: string };
    const milestone = await store.getTrackingMilestone(requestBaseUrl(request), params.milestoneId);
    if (!milestone) {
      reply.code(404).send({ error: "Unknown milestone." });
      return;
    }
    const project = await store.getTrackingProjectById(requestBaseUrl(request), milestone.projectId);
    if (!project?.courseId || !canViewCourse(auth, project.courseId)) {
      reply.code(403).send({ error: "Forbidden." });
      return;
    }
    const canManage = canManageProject(auth, project);
    const submissions = (await store.listTrackingMilestoneSubmissions(requestBaseUrl(request), milestone.id))
      .filter((entry) => auth.user.systemRole === "admin" || canManage || entry.userId === auth.user.id);
    const reviews = (await Promise.all(submissions.map((entry) => store.getTrackingReview(requestBaseUrl(request), entry.id)))).filter(isReviewRecord);
    return TrackingMilestoneSchema.parse(presentMilestone(milestone, submissions, reviews));
  });

  app.patch("/v1/tracking/milestones/:milestoneId", async (request, reply) => {
    const auth = await requireUser(request, reply, store);
    if (!auth) return;
    const params = request.params as { milestoneId: string };
    const milestone = await store.getTrackingMilestone(requestBaseUrl(request), params.milestoneId);
    if (!milestone) {
      reply.code(404).send({ error: "Unknown milestone." });
      return;
    }
    const project = await store.getTrackingProjectById(requestBaseUrl(request), milestone.projectId);
    if (!project || !canManageProject(auth, project)) {
      reply.code(403).send({ error: "Forbidden." });
      return;
    }
    const payload = UpdateMilestoneRequestSchema.parse(request.body);
    const updated = await store.updateTrackingMilestone(requestBaseUrl(request), auth.user.id, params.milestoneId, payload);
    return TrackingMilestoneSchema.parse(presentMilestone(updated || milestone, [], []));
  });

  app.delete("/v1/tracking/milestones/:milestoneId", async (request, reply) => {
    const auth = await requireUser(request, reply, store);
    if (!auth) return;
    const params = request.params as { milestoneId: string };
    const milestone = await store.getTrackingMilestone(requestBaseUrl(request), params.milestoneId);
    if (!milestone) {
      reply.code(404).send({ error: "Unknown milestone." });
      return;
    }
    const project = await store.getTrackingProjectById(requestBaseUrl(request), milestone.projectId);
    if (!project || !canManageProject(auth, project)) {
      reply.code(403).send({ error: "Forbidden." });
      return;
    }
    await store.deleteTrackingMilestone(requestBaseUrl(request), auth.user.id, params.milestoneId);
    return { ok: true };
  });

  app.get("/v1/tracking/milestones/:milestoneId/submissions", async (request, reply) => {
    const auth = await requireUser(request, reply, store);
    if (!auth) return;
    const params = request.params as { milestoneId: string };
    const milestone = await store.getTrackingMilestone(requestBaseUrl(request), params.milestoneId);
    if (!milestone) {
      reply.code(404).send({ error: "Unknown milestone." });
      return;
    }
    const project = await store.getTrackingProjectById(requestBaseUrl(request), milestone.projectId);
    if (!project?.courseId || !canViewCourse(auth, project.courseId)) {
      reply.code(403).send({ error: "Forbidden." });
      return;
    }
    const canManage = canManageProject(auth, project);
    const submissions = await store.listTrackingMilestoneSubmissions(requestBaseUrl(request), params.milestoneId);
    return submissions
      .filter((entry) => auth.user.systemRole === "admin" || canManage || entry.userId === auth.user.id)
      .map((entry) => TrackingSubmissionSchema.parse(entry));
  });

  app.post("/v1/tracking/milestones/:milestoneId/submissions", async (request, reply) => {
    const auth = await requireUser(request, reply, store);
    if (!auth) return;
    const params = request.params as { milestoneId: string };
    const milestone = await store.getTrackingMilestone(requestBaseUrl(request), params.milestoneId);
    if (!milestone) {
      reply.code(404).send({ error: "Unknown milestone." });
      return;
    }
    const project = await store.getTrackingProjectById(requestBaseUrl(request), milestone.projectId);
    if (!project?.courseId || !canViewCourse(auth, project.courseId)) {
      reply.code(403).send({ error: "Forbidden." });
      return;
    }
    const payload = CreateTrackingSubmissionRequestSchema.parse(request.body);
    const created = await store.createTrackingSubmission(requestBaseUrl(request), auth.user.id, params.milestoneId, payload);
    reply.code(201);
    return TrackingSubmissionSchema.parse(created);
  });

  app.get("/v1/tracking/submissions/:submissionId", async (request, reply) => {
    const auth = await requireUser(request, reply, store);
    if (!auth) return;
    const params = request.params as { submissionId: string };
    const submission = await store.getSubmissionForAdmin(requestBaseUrl(request), params.submissionId);
    if (!submission) {
      reply.code(404).send({ error: "Unknown submission." });
      return;
    }
    const project = await store.getTrackingProjectById(requestBaseUrl(request), submission.projectId);
    if (!canViewSubmission(auth, project, submission)) {
      reply.code(403).send({ error: "Forbidden." });
      return;
    }
    return TrackingSubmissionSchema.parse(submission);
  });

  app.patch("/v1/tracking/submissions/:submissionId", async (request, reply) => {
    const auth = await requireUser(request, reply, store);
    if (!auth) return;
    const params = request.params as { submissionId: string };
    const existing = await store.getSubmissionForAdmin(requestBaseUrl(request), params.submissionId);
    if (!existing) {
      reply.code(404).send({ error: "Unknown submission." });
      return;
    }
    const project = await store.getTrackingProjectById(requestBaseUrl(request), existing.projectId);
    if (!canViewSubmission(auth, project, existing)) {
      reply.code(403).send({ error: "Forbidden." });
      return;
    }
    const payload = UpdateTrackingSubmissionRequestSchema.parse(request.body);
    const updated = await store.updateTrackingSubmission(requestBaseUrl(request), auth.user.id, params.submissionId, payload);
    return TrackingSubmissionSchema.parse(updated || existing);
  });

  app.get("/v1/tracking/submissions/:submissionId/review", async (request, reply) => {
    const auth = await requireUser(request, reply, store);
    if (!auth) return;
    const params = request.params as { submissionId: string };
    const submission = await store.getSubmissionForAdmin(requestBaseUrl(request), params.submissionId);
    if (!submission) {
      reply.code(404).send({ error: "Unknown submission." });
      return;
    }
    const project = await store.getTrackingProjectById(requestBaseUrl(request), submission.projectId);
    if (!canViewSubmission(auth, project, submission)) {
      reply.code(403).send({ error: "Forbidden." });
      return;
    }
    const review = await store.getTrackingReview(requestBaseUrl(request), params.submissionId);
    if (!review) {
      reply.code(404).send({ error: "No review found." });
      return;
    }
    return TrackingReviewSchema.parse(review);
  });

  app.post("/v1/tracking/submissions/:submissionId/review", async (request, reply) => {
    const auth = await requireUser(request, reply, store);
    if (!auth) return;
    const params = request.params as { submissionId: string };
    const submission = await store.getSubmissionForAdmin(requestBaseUrl(request), params.submissionId);
    if (!submission) {
      reply.code(404).send({ error: "Unknown submission." });
      return;
    }
    const project = await store.getTrackingProjectById(requestBaseUrl(request), submission.projectId);
    if (!project || !canManageProject(auth, project)) {
      reply.code(403).send({ error: "Forbidden." });
      return;
    }
    const payload = CreateReviewRequestSchema.parse(request.body);
    const review = await store.createTrackingReview(requestBaseUrl(request), auth.user.id, params.submissionId, payload);
    reply.code(201);
    return TrackingReviewSchema.parse(review);
  });

  app.get("/v1/tracking/review-queue", async (request, reply) => {
    const auth = await requireUser(request, reply, store);
    if (!auth) return;
    if (!hasAnyInstructorAccess(auth)) {
      reply.code(403).send({ error: "Forbidden." });
      return;
    }
    const query = request.query as { courseId?: string; projectId?: string; status?: "queued" | "running" | "passed" | "failed" | "needs_review" };
    if (query.courseId && !canManageCourse(auth, query.courseId)) {
      reply.code(403).send({ error: "Forbidden." });
      return;
    }
    const results = await store.listTrackingReviewQueue(requestBaseUrl(request), query);
    const filtered = auth.user.systemRole === "admin"
      ? results
      : (await Promise.all(results.map(async (submission) => {
          const project = await store.getTrackingProjectById(requestBaseUrl(request), submission.projectId);
          return project && canManageProject(auth, project) ? submission : null;
        }))).filter((entry): entry is NonNullable<typeof entry> => entry !== null);
    return ReviewQueueResponseSchema.parse({ submissions: filtered });
  });

  app.get("/v1/tracking/activity", async (request, reply) => {
    const auth = await requireUser(request, reply, store);
    if (!auth) return;
    return await store.listTrackingActivity(requestBaseUrl(request), auth.user.id);
  });

  app.get("/v1/tracking/dashboard/student", async (request, reply) => {
    const auth = await requireUser(request, reply, store);
    if (!auth) return;
    const query = request.query as { courseId?: string };
    const dashboard = await store.getStudentTrackingDashboard(requestBaseUrl(request), auth.user.id, query.courseId || null);
    const submissionsByMilestone: Record<string, Awaited<ReturnType<AppStore["listTrackingMilestoneSubmissions"]>>> = {};
    const reviewsByMilestone: Record<string, NonNullable<Awaited<ReturnType<AppStore["getTrackingReview"]>>>[]> = {};
    for (const milestones of Object.values(dashboard.milestonesByProject)) {
      for (const milestone of milestones) {
        const submissions = (await store.listTrackingMilestoneSubmissions(requestBaseUrl(request), milestone.id))
          .filter((entry) => entry.userId === auth.user.id);
        submissionsByMilestone[milestone.id] = submissions;
        const reviews = (await Promise.all(submissions.map((entry) => store.getTrackingReview(requestBaseUrl(request), entry.id)))).filter(isReviewRecord);
        reviewsByMilestone[milestone.id] = reviews;
      }
    }
    return presentStudentDashboard({
      dashboard,
      submissionsByMilestone,
      reviewsByMilestone
    });
  });

  app.get("/v1/tracking/dashboard/instructor", async (request, reply) => {
    const auth = await requireUser(request, reply, store);
    if (!auth) return;
    if (!hasAnyInstructorAccess(auth)) {
      reply.code(403).send({ error: "Forbidden." });
      return;
    }
    return presentInstructorDashboard(await store.getInstructorTrackingDashboard(requestBaseUrl(request), auth.user.id));
  });

  app.get("/v1/tracking/dashboard/course/:courseId", async (request, reply) => {
    const auth = await requireUser(request, reply, store);
    if (!auth) return;
    const params = request.params as { courseId: string };
    if (!canManageCourse(auth, params.courseId)) {
      reply.code(403).send({ error: "Forbidden." });
      return;
    }
    return presentInstructorDashboard(await store.getCourseTrackingDashboard(requestBaseUrl(request), auth.user.id, params.courseId));
  });

  app.post("/v1/tracking/courses/:courseId/invites", async (request, reply) => {
    const auth = await requireUser(request, reply, store);
    if (!auth) return;
    const params = request.params as { courseId: string };
    if (!canManageCourse(auth, params.courseId)) {
      reply.code(403).send({ error: "Forbidden." });
      return;
    }
    const body = request.body as { role?: string; maxUses?: number; expiresAt?: string | null };
    const role = (body.role as "student" | "instructor" | "ta") || "student";
    const invite = await store.createCourseInvite(requestBaseUrl(request), params.courseId, role, {
      maxUses: body.maxUses,
      expiresAt: body.expiresAt
    });
    const inviteUrl = `${requestBaseUrl(request)}/join/${invite.code}`;
    reply.code(201);
    return { code: invite.code, inviteUrl };
  });

  app.get("/v1/tracking/invites/:code", async (request, reply) => {
    const params = request.params as { code: string };
    const invite = await store.getCourseInviteByCode(requestBaseUrl(request), params.code);
    if (!invite) {
      reply.code(404).send({ error: "Invalid invite code." });
      return;
    }
    if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
      reply.code(410).send({ error: "This invite link has expired." });
      return;
    }
    return {
      code: invite.code,
      courseTitle: invite.course.title,
      courseCode: invite.course.courseCode,
      termLabel: invite.course.termLabel,
      role: invite.role,
      expiresAt: invite.expiresAt
    };
  });

  app.post("/v1/tracking/invites/:code/join", async (request, reply) => {
    const auth = await requireUser(request, reply, store);
    if (!auth) return;
    const params = request.params as { code: string };
    try {
      const membership = await store.redeemCourseInvite(requestBaseUrl(request), params.code, auth.user.id);
      reply.code(201);
      return membership;
    } catch (err) {
      const e = err as { statusCode?: number; message?: string };
      reply.code(e.statusCode || 400).send({ error: e.message || "Failed to join course." });
    }
  });

  app.get("/v1/tracking/submissions/:submissionId/commits", async (request, reply) => {
    const auth = await requireUser(request, reply, store);
    if (!auth) return;
    const params = request.params as { submissionId: string };
    const submission = await store.getSubmissionForAdmin(requestBaseUrl(request), params.submissionId);
    if (!submission) {
      reply.code(404).send({ error: "Unknown submission." });
      return;
    }
    const project = await store.getTrackingProjectById(requestBaseUrl(request), submission.projectId);
    if (!canViewSubmission(auth, project, submission)) {
      reply.code(403).send({ error: "Forbidden." });
      return;
    }
    return await store.getTrackingSubmissionCommits(requestBaseUrl(request), params.submissionId);
  });
}

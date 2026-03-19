import { z } from "zod";

export const TrackingMembershipRoleSchema = z.enum(["student", "instructor", "ta"]);
export const TrackingProjectStatusSchema = z.enum(["draft", "published", "archived"]);
export const TrackingDeliveryModeSchema = z.enum(["individual", "team"]);
export const TrackingSubmissionTypeSchema = z.enum(["github", "link", "text"]);
export const TrackingSubmissionStatusSchema = z.enum([
  "queued",
  "running",
  "passed",
  "failed",
  "needs_review"
]);
export const TrackingReviewStatusSchema = z.enum([
  "pending",
  "approved",
  "changes_requested",
  "graded"
]);

export const TrackingResourceSchema = z.object({
  label: z.string().min(1),
  url: z.string().url()
});

export const TrackingRubricItemSchema = z.object({
  criterion: z.string().min(1),
  maxScore: z.number().nonnegative()
});

export const TrackingCourseSummarySchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  title: z.string().min(1),
  termLabel: z.string().min(1),
  courseCode: z.string().min(1),
  isActive: z.boolean()
});

export const TrackingMembershipSchema = z.object({
  courseId: z.string().min(1),
  userId: z.string().min(1),
  role: TrackingMembershipRoleSchema
});

export const TrackingProjectSummarySchema = z.object({
  id: z.string().min(1),
  projectKey: z.string().min(1),
  courseId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().default(""),
  status: TrackingProjectStatusSchema,
  deliveryMode: TrackingDeliveryModeSchema,
  gradeWeight: z.string().nullable(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  instructorName: z.string().nullable(),
  type: z.string().min(1),
  rubric: z.array(TrackingRubricItemSchema),
  resources: z.array(TrackingResourceSchema),
  team: z.array(z.object({
    name: z.string().min(1),
    initials: z.string().min(1),
    color: z.string().min(1)
  }))
});

export const TrackingMilestoneSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().default(""),
  order: z.number().int().nonnegative(),
  dueAt: z.string().datetime().nullable(),
  dueDateLabel: z.string().min(1),
  status: z.string().min(1),
  statusLabel: z.string().min(1),
  isFinal: z.boolean()
});

export const TrackingProjectDetailSchema = TrackingProjectSummarySchema.extend({
  milestones: z.array(TrackingMilestoneSchema)
});

export const TrackingSubmissionSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  projectId: z.string().min(1),
  projectKey: z.string().min(1),
  milestoneId: z.string().nullable(),
  commitSha: z.string().min(1),
  repoUrl: z.string().min(1),
  branch: z.string().min(1),
  status: TrackingSubmissionStatusSchema,
  summary: z.string().min(1),
  submissionType: TrackingSubmissionTypeSchema,
  submissionValue: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  submittedAt: z.string().datetime().nullable(),
  localTestExitCode: z.number().int().nullable()
});

export const TrackingReviewSchema = z.object({
  id: z.string().min(1),
  submissionId: z.string().min(1),
  reviewerUserId: z.string().min(1),
  status: TrackingReviewStatusSchema,
  score: z.number().nullable(),
  feedback: z.string().default(""),
  rubric: z.array(TrackingRubricItemSchema),
  reviewedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const TrackingActivityEventSchema = z.object({
  id: z.string().min(1),
  actorUserId: z.string().nullable(),
  courseId: z.string().nullable(),
  projectId: z.string().nullable(),
  milestoneId: z.string().nullable(),
  submissionId: z.string().nullable(),
  action: z.string().min(1),
  summary: z.string().min(1),
  createdAt: z.string().datetime()
});

export const TrackingDashboardStatsSchema = z.object({
  approved: z.number().int().nonnegative(),
  underReview: z.number().int().nonnegative(),
  completion: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  daysRemaining: z.number().int()
});

export const StudentProjectsDashboardResponseSchema = z.object({
  course: TrackingCourseSummarySchema.nullable(),
  memberships: z.array(TrackingMembershipSchema),
  projects: z.array(TrackingProjectSummarySchema),
  milestonesByProject: z.record(z.string(), z.array(TrackingMilestoneSchema)),
  activeProjectId: z.string().nullable(),
  activity: z.array(TrackingActivityEventSchema),
  statsByProject: z.record(z.string(), TrackingDashboardStatsSchema),
  pageError: z.string().nullable()
});

export const InstructorDashboardResponseSchema = z.object({
  courses: z.array(TrackingCourseSummarySchema),
  reviewQueue: z.array(TrackingSubmissionSchema),
  activity: z.array(TrackingActivityEventSchema)
});

export const CreateTrackingProjectRequestSchema = z.object({
  courseId: z.string().min(1),
  slug: z.string().min(1),
  title: z.string().min(1),
  description: z.string().default(""),
  status: TrackingProjectStatusSchema.default("draft"),
  deliveryMode: TrackingDeliveryModeSchema.default("individual"),
  rubric: z.array(TrackingRubricItemSchema).default([]),
  resources: z.array(TrackingResourceSchema).default([])
});

export const UpdateTrackingProjectRequestSchema = CreateTrackingProjectRequestSchema.partial().omit({
  courseId: true
});

export const CreateMilestoneRequestSchema = z.object({
  title: z.string().min(1),
  description: z.string().default(""),
  order: z.number().int().nonnegative(),
  dueAt: z.string().datetime().nullable().default(null),
  isFinal: z.boolean().default(false)
});

export const UpdateMilestoneRequestSchema = CreateMilestoneRequestSchema.partial();

export const CreateTrackingSubmissionRequestSchema = z.object({
  submissionType: TrackingSubmissionTypeSchema,
  submissionValue: z.string().min(1),
  notes: z.string().default(""),
  repoUrl: z.string().default(""),
  branch: z.string().default("main"),
  commitSha: z.string().default("")
});

export const UpdateTrackingSubmissionRequestSchema = CreateTrackingSubmissionRequestSchema.partial();

export const CreateReviewRequestSchema = z.object({
  status: TrackingReviewStatusSchema,
  score: z.number().nullable().default(null),
  feedback: z.string().default(""),
  rubric: z.array(TrackingRubricItemSchema).default([])
});

export const ReviewQueueResponseSchema = z.object({
  submissions: z.array(TrackingSubmissionSchema)
});

export type TrackingCourseSummary = z.infer<typeof TrackingCourseSummarySchema>;
export type TrackingMembership = z.infer<typeof TrackingMembershipSchema>;
export type TrackingProjectSummary = z.infer<typeof TrackingProjectSummarySchema>;
export type TrackingProjectDetail = z.infer<typeof TrackingProjectDetailSchema>;
export type TrackingMilestone = z.infer<typeof TrackingMilestoneSchema>;
export type TrackingSubmission = z.infer<typeof TrackingSubmissionSchema>;
export type TrackingReview = z.infer<typeof TrackingReviewSchema>;
export type TrackingActivityEvent = z.infer<typeof TrackingActivityEventSchema>;
export type StudentProjectsDashboardResponse = z.infer<typeof StudentProjectsDashboardResponseSchema>;
export type InstructorDashboardResponse = z.infer<typeof InstructorDashboardResponseSchema>;
export type CreateTrackingProjectRequest = z.infer<typeof CreateTrackingProjectRequestSchema>;
export type UpdateTrackingProjectRequest = z.infer<typeof UpdateTrackingProjectRequestSchema>;
export type CreateMilestoneRequest = z.infer<typeof CreateMilestoneRequestSchema>;
export type UpdateMilestoneRequest = z.infer<typeof UpdateMilestoneRequestSchema>;
export type CreateTrackingSubmissionRequest = z.infer<typeof CreateTrackingSubmissionRequestSchema>;
export type UpdateTrackingSubmissionRequest = z.infer<typeof UpdateTrackingSubmissionRequestSchema>;
export type CreateReviewRequest = z.infer<typeof CreateReviewRequestSchema>;
export type ReviewQueueResponse = z.infer<typeof ReviewQueueResponseSchema>;

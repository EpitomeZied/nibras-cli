import { z } from 'zod';

export const TrackingMembershipRoleSchema = z.enum(['student', 'instructor', 'ta']);
export const TrackingProjectStatusSchema = z.enum(['draft', 'published', 'archived']);
export const TrackingDeliveryModeSchema = z.enum(['individual', 'team']);
export const ProjectTemplateStatusSchema = z.enum(['draft', 'active']);
export const TeamFormationStatusSchema = z.enum([
  'not_started',
  'application_open',
  'team_review',
  'teams_locked',
]);
export const ProjectRoleApplicationStatusSchema = z.enum(['submitted', 'withdrawn']);
export const TeamStatusSchema = z.enum(['suggested', 'locked']);
export const TrackingSubmissionTypeSchema = z.enum(['github', 'link', 'text']);
export const TrackingSubmissionStatusSchema = z.enum([
  'queued',
  'running',
  'passed',
  'failed',
  'needs_review',
]);
export const TrackingReviewStatusSchema = z.enum([
  'pending',
  'approved',
  'changes_requested',
  'graded',
]);

export const TrackingResourceSchema = z.object({
  label: z.string().min(1),
  url: z.string().url(),
});

export const TrackingRubricItemSchema = z.object({
  criterion: z.string().min(1),
  maxScore: z.number().nonnegative(),
  earned: z.number().nonnegative().optional(),
});

export const TrackingCourseSummarySchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  title: z.string().min(1),
  termLabel: z.string().min(1),
  courseCode: z.string().min(1),
  isActive: z.boolean(),
});

export const TrackingMembershipSchema = z.object({
  courseId: z.string().min(1),
  userId: z.string().min(1),
  role: TrackingMembershipRoleSchema,
  level: z.number().int().min(1).max(4).default(1),
});

export const TeamMemberBadgeSchema = z.object({
  userId: z.string().min(1),
  name: z.string().min(1),
  initials: z.string().min(1),
  color: z.string().min(1),
  roleKey: z.string().min(1).nullable().default(null),
  roleLabel: z.string().min(1).nullable().default(null),
});

export const ProjectTemplateRoleSchema = z.object({
  id: z.string().min(1),
  key: z.string().min(1),
  label: z.string().min(1),
  count: z.number().int().positive(),
  sortOrder: z.number().int().nonnegative(),
});

export const ProjectTemplateMilestoneSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().default(''),
  order: z.number().int().nonnegative(),
  dueAt: z.string().datetime().nullable(),
  isFinal: z.boolean(),
});

export const ProjectTemplateSchema = z.object({
  id: z.string().min(1),
  courseId: z.string().min(1),
  slug: z.string().min(1),
  title: z.string().min(1),
  description: z.string().default(''),
  deliveryMode: TrackingDeliveryModeSchema,
  teamSize: z.number().int().positive().nullable(),
  status: ProjectTemplateStatusSchema,
  rubric: z.array(TrackingRubricItemSchema),
  resources: z.array(TrackingResourceSchema),
  roles: z.array(ProjectTemplateRoleSchema),
  milestones: z.array(ProjectTemplateMilestoneSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const TrackingProjectSummarySchema = z.object({
  id: z.string().min(1),
  projectKey: z.string().min(1),
  courseId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().default(''),
  status: TrackingProjectStatusSchema,
  level: z.number().int().min(1).max(4).default(1),
  deliveryMode: TrackingDeliveryModeSchema,
  templateId: z.string().nullable().default(null),
  teamFormationStatus: TeamFormationStatusSchema.default('not_started'),
  applicationOpenAt: z.string().datetime().nullable().default(null),
  applicationCloseAt: z.string().datetime().nullable().default(null),
  teamLockAt: z.string().datetime().nullable().default(null),
  teamSize: z.number().int().positive().nullable().default(null),
  teamRoles: z.array(ProjectTemplateRoleSchema).default([]),
  teamName: z.string().nullable().default(null),
  assignedRoleLabel: z.string().nullable().default(null),
  gradeWeight: z.string().nullable(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  instructorName: z.string().nullable(),
  type: z.string().min(1),
  rubric: z.array(TrackingRubricItemSchema),
  resources: z.array(TrackingResourceSchema),
  team: z.array(TeamMemberBadgeSchema),
});

export const TrackingMilestoneSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().default(''),
  order: z.number().int().nonnegative(),
  dueAt: z.string().datetime().nullable(),
  dueDateLabel: z.string().min(1),
  status: z.string().min(1),
  statusLabel: z.string().min(1),
  isFinal: z.boolean(),
});

export const TrackingProjectDetailSchema = TrackingProjectSummarySchema.extend({
  milestones: z.array(TrackingMilestoneSchema),
  template: ProjectTemplateSchema.nullable().default(null),
});

export const TrackingSubmissionSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  submittedByUserId: z.string().nullable().default(null),
  projectId: z.string().min(1),
  projectKey: z.string().min(1),
  milestoneId: z.string().nullable(),
  teamId: z.string().nullable().default(null),
  teamName: z.string().nullable().default(null),
  teamMemberUserIds: z.array(z.string().min(1)).default([]),
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
  localTestExitCode: z.number().int().nullable(),
});

export const AiCriterionScoreSchema = z.object({
  id: z.string().min(1),
  points: z.number(),
  earned: z.number(),
  justification: z.string(),
});

export const TrackingReviewSchema = z.object({
  id: z.string().min(1),
  submissionId: z.string().min(1),
  reviewerUserId: z.string().min(1),
  status: TrackingReviewStatusSchema,
  score: z.number().nullable(),
  feedback: z.string().default(''),
  rubric: z.array(TrackingRubricItemSchema),
  reviewedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  // AI grading fields — null when AI has not run
  aiConfidence: z.number().nullable(),
  aiNeedsReview: z.boolean().nullable(),
  aiReasoningSummary: z.string().nullable(),
  aiCriterionScores: z.array(AiCriterionScoreSchema).nullable(),
  aiEvidenceQuotes: z.array(z.string()).nullable(),
  aiModel: z.string().nullable(),
  aiGradedAt: z.string().datetime().nullable(),
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
  createdAt: z.string().datetime(),
});

export const TrackingDashboardStatsSchema = z.object({
  approved: z.number().int().nonnegative(),
  underReview: z.number().int().nonnegative(),
  completion: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  minutesRemaining: z.number().int(),
});

export const DashboardModeSchema = z.enum(['student', 'instructor']);

export const DashboardCtaSchema = z.object({
  label: z.string().min(1),
  href: z.string().min(1),
});

export const StudentHomeAttentionItemSchema = z.object({
  id: z.string().min(1),
  kind: z.enum([
    'changes_requested',
    'failed_submission',
    'needs_review',
    'due_soon',
    'recent_feedback',
  ]),
  courseId: z.string().min(1),
  courseTitle: z.string().min(1),
  projectId: z.string().min(1),
  projectTitle: z.string().min(1),
  milestoneId: z.string().nullable(),
  milestoneTitle: z.string().nullable(),
  submissionId: z.string().nullable(),
  statusText: z.string().min(1),
  reason: z.string().min(1),
  dueAt: z.string().datetime().nullable(),
  submittedAt: z.string().datetime().nullable(),
  reviewedAt: z.string().datetime().nullable(),
  cta: DashboardCtaSchema,
});

export const StudentCourseMilestoneSnapshotSchema = z.object({
  milestoneId: z.string().min(1),
  projectId: z.string().min(1),
  projectTitle: z.string().min(1),
  title: z.string().min(1),
  dueAt: z.string().datetime().nullable(),
  status: z.string().min(1),
  statusLabel: z.string().min(1),
});

export const StudentCourseProjectSnapshotSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(1),
  completion: z.number().int().nonnegative(),
  approved: z.number().int().nonnegative(),
  underReview: z.number().int().nonnegative(),
  open: z.number().int().nonnegative(),
  minutesRemaining: z.number().int().nullable(),
  nextMilestoneTitle: z.string().nullable(),
  href: z.string().min(1),
});

export const StudentCourseSnapshotSchema = z.object({
  courseId: z.string().min(1),
  courseTitle: z.string().min(1),
  completion: z.number().int().nonnegative(),
  approved: z.number().int().nonnegative(),
  underReview: z.number().int().nonnegative(),
  open: z.number().int().nonnegative(),
  nextMilestones: z.array(StudentCourseMilestoneSnapshotSchema),
  projects: z.array(StudentCourseProjectSnapshotSchema),
});

export const StudentSubmissionHealthSchema = z.object({
  failedChecks: z.number().int().nonnegative(),
  needsReview: z.number().int().nonnegative(),
  awaitingReview: z.number().int().nonnegative(),
  recentlyPassed: z.number().int().nonnegative(),
});

export const StudentHomeRecentSubmissionSchema = z.object({
  id: z.string().min(1),
  projectKey: z.string().min(1),
  projectTitle: z.string().min(1),
  milestoneTitle: z.string().nullable(),
  status: z.string().min(1),
  statusLabel: z.string().min(1),
  submittedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  href: z.string().min(1),
});

export const StudentHomeBlockerSchema = z.object({
  id: z.string().min(1),
  kind: z.enum([
    'github_not_linked',
    'github_app_not_installed',
    'no_published_projects',
    'no_memberships',
  ]),
  title: z.string().min(1),
  body: z.string().min(1),
  cta: DashboardCtaSchema,
});

export const StudentHomeDashboardSchema = z.object({
  courses: z.array(TrackingCourseSummarySchema),
  selectedCourseId: z.string().nullable(),
  attentionItems: z.array(StudentHomeAttentionItemSchema),
  courseSnapshots: z.array(StudentCourseSnapshotSchema),
  submissionHealth: StudentSubmissionHealthSchema,
  recentSubmissions: z.array(StudentHomeRecentSubmissionSchema),
  blockers: z.array(StudentHomeBlockerSchema),
});

export const InstructorReviewSummaryByCourseSchema = z.object({
  courseId: z.string().min(1),
  courseTitle: z.string().min(1),
  pendingReviewCount: z.number().int().nonnegative(),
});

export const InstructorReviewSummarySchema = z.object({
  totalAwaitingReview: z.number().int().nonnegative(),
  oldestWaitingMinutes: z.number().int().nullable(),
  submittedLast24Hours: z.number().int().nonnegative(),
  byCourse: z.array(InstructorReviewSummaryByCourseSchema),
});

export const InstructorUrgentQueueItemSchema = z.object({
  submissionId: z.string().min(1),
  courseId: z.string().min(1),
  courseTitle: z.string().min(1),
  projectId: z.string().min(1),
  projectTitle: z.string().min(1),
  projectKey: z.string().min(1),
  studentName: z.string().min(1),
  status: z.string().min(1),
  submittedAt: z.string().datetime(),
  waitingMinutes: z.number().int().nonnegative(),
  cta: DashboardCtaSchema,
});

export const InstructorCourseSummarySchema = z.object({
  courseId: z.string().min(1),
  title: z.string().min(1),
  courseCode: z.string().min(1),
  termLabel: z.string().min(1),
  pendingReviewCount: z.number().int().nonnegative(),
  publishedProjectCount: z.number().int().nonnegative(),
  memberCount: z.number().int().nonnegative(),
  lastActivityAt: z.string().datetime().nullable(),
});

export const DashboardOperationSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().min(1),
  href: z.string().min(1),
});

export const InstructorRecentActivityItemSchema = z.object({
  id: z.string().min(1),
  action: z.string().min(1),
  summary: z.string().min(1),
  createdAt: z.string().datetime(),
  courseId: z.string().nullable(),
  courseTitle: z.string().nullable(),
  href: z.string().nullable(),
});

export const InstructorHomeDashboardSchema = z.object({
  reviewSummary: InstructorReviewSummarySchema,
  urgentQueue: z.array(InstructorUrgentQueueItemSchema),
  courseSummaries: z.array(InstructorCourseSummarySchema),
  recentActivity: z.array(InstructorRecentActivityItemSchema),
  operations: z.array(DashboardOperationSchema),
});

export const DashboardHomeResponseSchema = z.object({
  availableModes: z.array(DashboardModeSchema),
  defaultMode: DashboardModeSchema,
  student: StudentHomeDashboardSchema.optional(),
  instructor: InstructorHomeDashboardSchema.optional(),
});

export const StudentProjectsDashboardResponseSchema = z.object({
  course: TrackingCourseSummarySchema.nullable(),
  memberships: z.array(TrackingMembershipSchema),
  projects: z.array(TrackingProjectSummarySchema),
  milestonesByProject: z.record(z.string(), z.array(TrackingMilestoneSchema)),
  activeProjectId: z.string().nullable(),
  activity: z.array(TrackingActivityEventSchema),
  statsByProject: z.record(z.string(), TrackingDashboardStatsSchema),
  pageError: z.string().nullable(),
});

export const InstructorDashboardResponseSchema = z.object({
  courses: z.array(TrackingCourseSummarySchema),
  reviewQueue: z.array(TrackingSubmissionSchema),
  activity: z.array(TrackingActivityEventSchema),
});

export const ProjectRolePreferenceSchema = z.object({
  templateRoleId: z.string().min(1),
  roleKey: z.string().min(1),
  roleLabel: z.string().min(1),
  rank: z.number().int().positive(),
});

export const ProjectRoleApplicationSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  userId: z.string().min(1),
  statement: z.string().default(''),
  availabilityNote: z.string().default(''),
  status: ProjectRoleApplicationStatusSchema,
  submittedAt: z.string().datetime().nullable(),
  updatedAt: z.string().datetime(),
  preferences: z.array(ProjectRolePreferenceSchema),
});

export const TeamMemberSchema = z.object({
  id: z.string().min(1),
  teamId: z.string().min(1),
  userId: z.string().min(1),
  username: z.string().min(1),
  roleKey: z.string().min(1),
  roleLabel: z.string().min(1),
  status: z.string().min(1),
  createdAt: z.string().datetime(),
});

export const TeamProjectRepoSchema = z.object({
  id: z.string().min(1),
  teamId: z.string().min(1),
  owner: z.string().min(1),
  name: z.string().min(1),
  githubRepoId: z.string().nullable(),
  cloneUrl: z.string().nullable(),
  defaultBranch: z.string().min(1),
  visibility: z.enum(['private', 'public']),
  installStatus: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const TeamSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  name: z.string().min(1),
  status: TeamStatusSchema,
  lockedAt: z.string().datetime().nullable(),
  members: z.array(TeamMemberSchema),
  repo: TeamProjectRepoSchema.nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const TeamFormationSuggestionMemberSchema = z.object({
  userId: z.string().min(1),
  username: z.string().min(1),
  level: z.number().int().min(1).max(4),
  roleKey: z.string().min(1),
  roleLabel: z.string().min(1),
});

export const TeamFormationSuggestionSchema = z.object({
  name: z.string().min(1),
  members: z.array(TeamFormationSuggestionMemberSchema),
  averageLevel: z.number(),
});

export const TeamFormationWaitlistEntrySchema = z.object({
  userId: z.string().min(1),
  username: z.string().min(1),
  level: z.number().int().min(1).max(4),
});

export const TeamFormationRunSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  algorithmVersion: z.string().min(1),
  config: z.record(z.string(), z.unknown()),
  result: z.object({
    teams: z.array(TeamFormationSuggestionSchema),
    waitlist: z.array(TeamFormationWaitlistEntrySchema),
    warnings: z.array(z.string()),
  }),
  createdByUserId: z.string().min(1),
  createdAt: z.string().datetime(),
});

export const AddCourseMemberRequestSchema = z.object({
  githubLogin: z.string().min(1),
  role: TrackingMembershipRoleSchema,
});

export const CourseMemberSchema = z.object({
  id: z.string().min(1),
  courseId: z.string().min(1),
  userId: z.string().min(1),
  username: z.string().min(1),
  githubLogin: z.string().min(1),
  role: TrackingMembershipRoleSchema,
  level: z.number().int().min(1).max(4).default(1),
  createdAt: z.string().datetime(),
});

export const CreateTrackingCourseRequestSchema = z.object({
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  title: z.string().min(1),
  termLabel: z.string().min(1),
  courseCode: z.string().min(1),
});

export const CreateTrackingProjectRequestSchema = z.object({
  courseId: z.string().min(1),
  slug: z.string().min(1),
  title: z.string().min(1),
  description: z.string().default(''),
  status: TrackingProjectStatusSchema.default('draft'),
  deliveryMode: TrackingDeliveryModeSchema.default('individual'),
  templateId: z.string().min(1).nullable().default(null),
  applicationOpenAt: z.string().datetime().nullable().default(null),
  applicationCloseAt: z.string().datetime().nullable().default(null),
  teamLockAt: z.string().datetime().nullable().default(null),
  teamSize: z.number().int().positive().nullable().default(null),
  rubric: z.array(TrackingRubricItemSchema).default([]),
  resources: z.array(TrackingResourceSchema).default([]),
});

export const UpdateTrackingProjectRequestSchema = CreateTrackingProjectRequestSchema.partial().omit(
  {
    courseId: true,
  }
);

export const CreateMilestoneRequestSchema = z.object({
  title: z.string().min(1),
  description: z.string().default(''),
  order: z.number().int().nonnegative(),
  dueAt: z.string().datetime().nullable().default(null),
  isFinal: z.boolean().default(false),
});

export const UpdateMilestoneRequestSchema = CreateMilestoneRequestSchema.partial();

export const CreateTrackingSubmissionRequestSchema = z.object({
  submissionType: TrackingSubmissionTypeSchema,
  submissionValue: z.string().min(1),
  notes: z.string().default(''),
  repoUrl: z.string().default(''),
  branch: z.string().default('main'),
  commitSha: z.string().default(''),
});

export const UpdateTrackingSubmissionRequestSchema =
  CreateTrackingSubmissionRequestSchema.partial();

export const CreateReviewRequestSchema = z.object({
  status: TrackingReviewStatusSchema,
  score: z.number().nullable().default(null),
  feedback: z.string().default(''),
  rubric: z.array(TrackingRubricItemSchema).default([]),
});

export const ReviewQueueResponseSchema = z.object({
  submissions: z.array(TrackingSubmissionSchema),
});

export const CreateProjectTemplateRequestSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  description: z.string().default(''),
  deliveryMode: TrackingDeliveryModeSchema.default('team'),
  teamSize: z.number().int().positive().nullable().default(null),
  status: ProjectTemplateStatusSchema.default('active'),
  rubric: z.array(TrackingRubricItemSchema).default([]),
  resources: z.array(TrackingResourceSchema).default([]),
  roles: z.array(ProjectTemplateRoleSchema.omit({ id: true })).default([]),
  milestones: z.array(ProjectTemplateMilestoneSchema.omit({ id: true })).default([]),
});

export const UpdateProjectTemplateRequestSchema = CreateProjectTemplateRequestSchema.partial();

export const CreateProjectRoleApplicationRequestSchema = z.object({
  statement: z.string().default(''),
  availabilityNote: z.string().default(''),
  preferences: z.array(
    z.object({
      templateRoleId: z.string().min(1),
      rank: z.number().int().positive(),
    })
  ),
});

export const GenerateTeamFormationRequestSchema = z.object({
  algorithmVersion: z.string().min(1).default('v1'),
});

export const LockTeamFormationRequestSchema = z.object({
  formationRunId: z.string().min(1).optional(),
});

export const UpdateTeamRequestSchema = z.object({
  name: z.string().min(1).optional(),
  members: z
    .array(
      z.object({
        userId: z.string().min(1),
        roleKey: z.string().min(1),
        roleLabel: z.string().min(1),
      })
    )
    .optional(),
});

export const CourseInvitePreviewSchema = z.object({
  code: z.string().min(1),
  courseTitle: z.string().min(1),
  courseCode: z.string().min(1),
  termLabel: z.string().min(1),
  role: TrackingMembershipRoleSchema,
  expiresAt: z.string().datetime().nullable(),
});

export const CreateCourseInviteResponseSchema = z.object({
  code: z.string().min(1),
  inviteUrl: z.string().min(1),
});

export const UpdateStudentLevelRequestSchema = z.object({
  level: z.number().int().min(1).max(4),
});
export type UpdateStudentLevelRequest = z.infer<typeof UpdateStudentLevelRequestSchema>;

export type CourseInvitePreview = z.infer<typeof CourseInvitePreviewSchema>;

export type TrackingCourseSummary = z.infer<typeof TrackingCourseSummarySchema>;
export type TrackingMembership = z.infer<typeof TrackingMembershipSchema>;
export type ProjectTemplateRole = z.infer<typeof ProjectTemplateRoleSchema>;
export type ProjectTemplateMilestone = z.infer<typeof ProjectTemplateMilestoneSchema>;
export type ProjectTemplate = z.infer<typeof ProjectTemplateSchema>;
export type TrackingProjectSummary = z.infer<typeof TrackingProjectSummarySchema>;
export type TrackingProjectDetail = z.infer<typeof TrackingProjectDetailSchema>;
export type TrackingMilestone = z.infer<typeof TrackingMilestoneSchema>;
export type TrackingSubmissionType = z.infer<typeof TrackingSubmissionTypeSchema>;
export type TrackingSubmission = z.infer<typeof TrackingSubmissionSchema>;
export type AiCriterionScore = z.infer<typeof AiCriterionScoreSchema>;
export type TrackingReview = z.infer<typeof TrackingReviewSchema>;
export type TrackingActivityEvent = z.infer<typeof TrackingActivityEventSchema>;
export type StudentProjectsDashboardResponse = z.infer<
  typeof StudentProjectsDashboardResponseSchema
>;
export type InstructorDashboardResponse = z.infer<typeof InstructorDashboardResponseSchema>;
export type DashboardHomeResponse = z.infer<typeof DashboardHomeResponseSchema>;
export type DashboardMode = z.infer<typeof DashboardModeSchema>;
export type StudentHomeDashboard = z.infer<typeof StudentHomeDashboardSchema>;
export type InstructorHomeDashboard = z.infer<typeof InstructorHomeDashboardSchema>;
export type ProjectRolePreference = z.infer<typeof ProjectRolePreferenceSchema>;
export type ProjectRoleApplication = z.infer<typeof ProjectRoleApplicationSchema>;
export type TeamMemberBadge = z.infer<typeof TeamMemberBadgeSchema>;
export type TeamMember = z.infer<typeof TeamMemberSchema>;
export type TeamProjectRepo = z.infer<typeof TeamProjectRepoSchema>;
export type Team = z.infer<typeof TeamSchema>;
export type TeamFormationRun = z.infer<typeof TeamFormationRunSchema>;
export type CreateTrackingProjectRequest = z.infer<typeof CreateTrackingProjectRequestSchema>;
export type UpdateTrackingProjectRequest = z.infer<typeof UpdateTrackingProjectRequestSchema>;
export type CreateMilestoneRequest = z.infer<typeof CreateMilestoneRequestSchema>;
export type UpdateMilestoneRequest = z.infer<typeof UpdateMilestoneRequestSchema>;
export type CreateTrackingSubmissionRequest = z.infer<typeof CreateTrackingSubmissionRequestSchema>;
export type UpdateTrackingSubmissionRequest = z.infer<typeof UpdateTrackingSubmissionRequestSchema>;
export type CreateReviewRequest = z.infer<typeof CreateReviewRequestSchema>;
export type ReviewQueueResponse = z.infer<typeof ReviewQueueResponseSchema>;
export type CreateProjectTemplateRequest = z.infer<typeof CreateProjectTemplateRequestSchema>;
export type UpdateProjectTemplateRequest = z.infer<typeof UpdateProjectTemplateRequestSchema>;
export type CreateProjectRoleApplicationRequest = z.infer<
  typeof CreateProjectRoleApplicationRequestSchema
>;
export type GenerateTeamFormationRequest = z.infer<typeof GenerateTeamFormationRequestSchema>;
export type LockTeamFormationRequest = z.infer<typeof LockTeamFormationRequestSchema>;
export type UpdateTeamRequest = z.infer<typeof UpdateTeamRequestSchema>;

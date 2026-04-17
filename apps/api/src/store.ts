import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { ProjectManifest } from '@nibras/contracts';
import {
  buildCs106lManifest,
  buildCs106lStarter,
  CS106L_COURSE,
  listCs106lProjectDefinitions,
  readCs106lTaskText,
} from './lib/cs106l';
import {
  buildDashboardHomeRecord,
  buildInstructorHomeDashboard,
  buildStudentHomeDashboard,
} from './features/tracking/home-dashboard';
import {
  buildDefaultProgramSeed,
  buildProgramSheet,
  buildStudentProgramPlan,
} from './features/programs/domain';

export type PaginationOpts = { limit?: number; offset?: number };

export type DeviceCodeRecord = {
  deviceCode: string;
  userCode: string;
  expiresAt: string;
  intervalSeconds: number;
  userId: string | null;
  status: 'pending' | 'authorized';
};

export type SessionRecord = {
  accessToken: string;
  refreshToken: string;
  userId: string;
  createdAt: string;
};

export type WebSessionRecord = {
  sessionToken: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  revokedAt: string | null;
};

export type SystemRole = 'user' | 'admin';
export type MembershipRole = 'student' | 'instructor' | 'ta';
export type ProjectStatus = 'draft' | 'published' | 'archived';
export type DeliveryMode = 'individual' | 'team';
export type ProjectTemplateStatus = 'draft' | 'active';
export type TeamFormationStatus =
  | 'not_started'
  | 'application_open'
  | 'team_review'
  | 'teams_locked';
export type ProjectRoleApplicationStatus = 'submitted' | 'withdrawn';
export type TeamStatus = 'suggested' | 'locked';
export type SubmissionWorkflowStatus = 'queued' | 'running' | 'passed' | 'failed' | 'needs_review';
export type SubmissionType = 'github' | 'link' | 'text';
export type ReviewStatus = 'pending' | 'approved' | 'changes_requested' | 'graded';
export type ProgramStatus = 'draft' | 'published' | 'archived';
export type RequirementGroupCategory =
  | 'foundation'
  | 'core'
  | 'depth'
  | 'elective'
  | 'capstone'
  | 'policy';
export type RequirementRuleType = 'required' | 'choose_n' | 'elective_pool' | 'track_gate';
export type StudentProgramStatus =
  | 'enrolled'
  | 'track_selected'
  | 'submitted_for_advisor'
  | 'advisor_approved'
  | 'department_approved';
export type PlannedCourseSourceType = 'standard' | 'transfer' | 'petition' | 'manual';
export type StudentRequirementDecisionStatus =
  | 'pending'
  | 'satisfied'
  | 'waived'
  | 'petition_pending';
export type RequirementDecisionSourceType =
  | 'planned_course'
  | 'transfer_credit'
  | 'petition'
  | 'waiver';
export type PetitionType = 'transfer_credit' | 'substitution' | 'waiver';
export type PetitionStatus = 'pending_advisor' | 'pending_department' | 'approved' | 'rejected';
export type ApprovalStage = 'advisor' | 'department';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export type AcademicTerm = 'fall' | 'spring';

export type NotificationRecord = {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: string;
};

export type UserRecord = {
  id: string;
  username: string;
  email: string;
  githubLogin: string;
  githubLinked: boolean;
  githubAppInstalled: boolean;
  systemRole: SystemRole;
  yearLevel: number;
};

export type GitHubAccountRecord = {
  userId: string;
  login: string;
  installationId: string | null;
  userAccessToken: string | null;
};

export type CourseRecord = {
  id: string;
  slug: string;
  title: string;
  termLabel: string;
  courseCode: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CourseMembershipRecord = {
  id: string;
  courseId: string;
  userId: string;
  role: MembershipRole;
  level: number;
  createdAt: string;
  updatedAt: string;
};

export type ProgramRecord = {
  id: string;
  slug: string;
  title: string;
  code: string;
  academicYear: string;
  totalUnitRequirement: number;
  status: ProgramStatus;
  activeVersionId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProgramVersionRecord = {
  id: string;
  programId: string;
  versionLabel: string;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  isActive: boolean;
  policyText: string;
  trackSelectionMinYear: number;
  createdAt: string;
  updatedAt: string;
};

export type TrackRecord = {
  id: string;
  programVersionId: string;
  slug: string;
  title: string;
  description: string;
  selectionYearStart: number;
  createdAt: string;
  updatedAt: string;
};

export type CatalogCourseRecord = {
  id: string;
  programId: string;
  subjectCode: string;
  catalogNumber: string;
  title: string;
  defaultUnits: number;
  department: string;
  createdAt: string;
  updatedAt: string;
};

export type RequirementCourseRecord = {
  id: string;
  requirementRuleId: string;
  catalogCourseId: string;
};

export type RequirementRuleRecord = {
  id: string;
  requirementGroupId: string;
  ruleType: RequirementRuleType;
  pickCount: number | null;
  note: string;
  sortOrder: number;
  courses: RequirementCourseRecord[];
};

export type RequirementGroupRecord = {
  id: string;
  programVersionId: string;
  trackId: string | null;
  title: string;
  category: RequirementGroupCategory;
  minUnits: number;
  minCourses: number;
  notes: string;
  sortOrder: number;
  noDoubleCount: boolean;
  rules: RequirementRuleRecord[];
  createdAt: string;
  updatedAt: string;
};

export type StudentPlannedCourseRecord = {
  id: string;
  studentProgramId: string;
  catalogCourseId: string;
  plannedYear: number;
  plannedTerm: AcademicTerm;
  sourceType: PlannedCourseSourceType;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

export type StudentRequirementDecisionRecord = {
  id: string;
  studentProgramId: string;
  requirementGroupId: string;
  status: StudentRequirementDecisionStatus;
  sourceType: RequirementDecisionSourceType | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PetitionCourseLinkRecord = {
  id: string;
  petitionId: string;
  originalCatalogCourseId: string | null;
  substituteCatalogCourseId: string | null;
};

export type PetitionRecord = {
  id: string;
  studentProgramId: string;
  type: PetitionType;
  status: PetitionStatus;
  justification: string;
  targetRequirementGroupId: string | null;
  submittedByUserId: string;
  reviewerUserId: string | null;
  reviewerNotes: string | null;
  createdAt: string;
  updatedAt: string;
  courseLinks: PetitionCourseLinkRecord[];
};

export type ProgramApprovalRecord = {
  id: string;
  studentProgramId: string;
  stage: ApprovalStage;
  status: ApprovalStatus;
  reviewerUserId: string | null;
  notes: string | null;
  decidedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProgramSheetSnapshotRecord = {
  id: string;
  studentProgramId: string;
  versionId: string;
  renderedPayload: Record<string, unknown>;
  generatedAt: string;
};

export type StudentProgramRecord = {
  id: string;
  userId: string;
  programVersionId: string;
  selectedTrackId: string | null;
  status: StudentProgramStatus;
  isLocked: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ProgramVersionDetailRecord = {
  program: ProgramRecord;
  version: ProgramVersionRecord;
  tracks: TrackRecord[];
  catalogCourses: CatalogCourseRecord[];
  requirementGroups: RequirementGroupRecord[];
};

export type ProgramSheetSectionCourseRecord = {
  plannedCourseId: string;
  catalogCourseId: string;
  subjectCode: string;
  catalogNumber: string;
  title: string;
  units: number;
  plannedYear: number;
  plannedTerm: AcademicTerm;
  sourceType: PlannedCourseSourceType;
};

export type ProgramSheetSectionRecord = {
  requirementGroupId: string;
  title: string;
  category: RequirementGroupCategory;
  minUnits: number;
  minCourses: number;
  notes: string;
  matchedCourses: ProgramSheetSectionCourseRecord[];
  usedUnits: number;
  usedCourses: number;
  status: StudentRequirementDecisionStatus;
};

export type ProgramSheetViewRecord = {
  studentProgramId: string;
  student: {
    id: string;
    username: string;
    email: string;
    yearLevel: number;
  };
  program: ProgramRecord;
  version: ProgramVersionRecord;
  selectedTrack: TrackRecord | null;
  status: StudentProgramStatus;
  isLocked: boolean;
  canSelectTrack: boolean;
  generatedAt: string | null;
  policyText: string;
  sections: ProgramSheetSectionRecord[];
  petitions: PetitionRecord[];
  approvals: ProgramApprovalRecord[];
};

export type StudentProgramPlanRecord = {
  id: string;
  userId: string;
  program: ProgramRecord;
  version: ProgramVersionRecord;
  selectedTrack: TrackRecord | null;
  availableTracks: TrackRecord[];
  status: StudentProgramStatus;
  isLocked: boolean;
  canSelectTrack: boolean;
  catalogCourses: CatalogCourseRecord[];
  requirementGroups: RequirementGroupRecord[];
  plannedCourses: StudentPlannedCourseRecord[];
  decisions: StudentRequirementDecisionRecord[];
  petitions: PetitionRecord[];
  approvals: ProgramApprovalRecord[];
  latestSheet: ProgramSheetViewRecord | null;
};

export type TrackingResourceRecord = {
  label: string;
  url: string;
};

export type TrackingRubricItemRecord = {
  criterion: string;
  maxScore: number;
  earned?: number;
};

export type ProjectTemplateRoleRecord = {
  id: string;
  key: string;
  label: string;
  count: number;
  sortOrder: number;
};

export type ProjectTemplateMilestoneRecord = {
  id: string;
  title: string;
  description: string;
  order: number;
  dueAt: string | null;
  isFinal: boolean;
};

export type ProjectTemplateRecord = {
  id: string;
  courseId: string;
  slug: string;
  title: string;
  description: string;
  deliveryMode: DeliveryMode;
  teamSize: number | null;
  status: ProjectTemplateStatus;
  rubric: TrackingRubricItemRecord[];
  resources: TrackingResourceRecord[];
  roles: ProjectTemplateRoleRecord[];
  milestones: ProjectTemplateMilestoneRecord[];
  createdAt: string;
  updatedAt: string;
};

export type ProjectRolePreferenceRecord = {
  templateRoleId: string;
  roleKey: string;
  roleLabel: string;
  rank: number;
};

export type ProjectRoleApplicationRecord = {
  id: string;
  projectId: string;
  userId: string;
  statement: string;
  availabilityNote: string;
  status: ProjectRoleApplicationStatus;
  submittedAt: string | null;
  updatedAt: string;
  preferences: ProjectRolePreferenceRecord[];
};

export type TeamFormationSuggestionMemberRecord = {
  userId: string;
  username: string;
  level: number;
  roleKey: string;
  roleLabel: string;
};

export type TeamFormationSuggestionRecord = {
  name: string;
  members: TeamFormationSuggestionMemberRecord[];
  averageLevel: number;
};

export type TeamFormationWaitlistEntryRecord = {
  userId: string;
  username: string;
  level: number;
};

export type TeamFormationRunRecord = {
  id: string;
  projectId: string;
  algorithmVersion: string;
  config: Record<string, unknown>;
  result: {
    teams: TeamFormationSuggestionRecord[];
    waitlist: TeamFormationWaitlistEntryRecord[];
    warnings: string[];
  };
  createdByUserId: string;
  createdAt: string;
};

export type TeamMemberRecord = {
  id: string;
  teamId: string;
  userId: string;
  username: string;
  roleKey: string;
  roleLabel: string;
  status: string;
  createdAt: string;
};

export type TeamProjectRepoRecord = {
  id: string;
  teamId: string;
  owner: string;
  name: string;
  githubRepoId: string | null;
  cloneUrl: string | null;
  defaultBranch: string;
  visibility: 'private' | 'public';
  installStatus: string;
  createdAt: string;
  updatedAt: string;
};

export type TeamRecord = {
  id: string;
  projectId: string;
  name: string;
  status: TeamStatus;
  lockedAt: string | null;
  members: TeamMemberRecord[];
  repo: TeamProjectRepoRecord | null;
  createdAt: string;
  updatedAt: string;
};

export type TeamMemberBadgeRecord = {
  userId: string;
  name: string;
  initials: string;
  color: string;
  roleKey: string | null;
  roleLabel: string | null;
};

export type RepoRecord = {
  owner: string;
  name: string;
  cloneUrl: string | null;
  defaultBranch: string;
  visibility: 'private' | 'public';
};

export type ProjectStarterRecord =
  | { kind: 'none' }
  | { kind: 'bundle'; storageKey: string; fileName: string }
  | { kind: 'github-template'; cloneUrl: string };

export type ProjectRecord = {
  id: string;
  projectKey: string;
  slug: string;
  courseId: string | null;
  templateId: string | null;
  title: string;
  description: string;
  status: ProjectStatus;
  level: number;
  deliveryMode: DeliveryMode;
  teamFormationStatus: TeamFormationStatus;
  applicationOpenAt: string | null;
  applicationCloseAt: string | null;
  teamLockAt: string | null;
  teamSize: number | null;
  teamRoles: ProjectTemplateRoleRecord[];
  teamName: string | null;
  assignedRoleLabel: string | null;
  team: TeamMemberBadgeRecord[];
  rubric: TrackingRubricItemRecord[];
  resources: TrackingResourceRecord[];
  instructorUserId: string | null;
  manifest: ProjectManifest;
  task: string;
  starter: ProjectStarterRecord;
  repoByUserId: Record<string, RepoRecord>;
  createdAt: string;
  updatedAt: string;
};

export type MilestoneRecord = {
  id: string;
  projectId: string;
  title: string;
  description: string;
  order: number;
  dueAt: string | null;
  isFinal: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SubmissionRecord = {
  id: string;
  userId: string;
  submittedByUserId: string | null;
  projectId: string;
  projectKey: string;
  milestoneId: string | null;
  teamId: string | null;
  teamName: string | null;
  teamMemberUserIds: string[];
  commitSha: string;
  repoUrl: string;
  branch: string;
  status: SubmissionWorkflowStatus;
  summary: string;
  submissionType: SubmissionType;
  submissionValue: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  localTestExitCode: number | null;
};

export type AiCriterionScoreRecord = {
  id: string;
  points: number;
  earned: number;
  justification: string;
};

export type ReviewRecord = {
  id: string;
  submissionId: string;
  reviewerUserId: string;
  status: ReviewStatus;
  score: number | null;
  feedback: string;
  rubric: TrackingRubricItemRecord[];
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  // AI grading fields
  aiConfidence: number | null;
  aiNeedsReview: boolean | null;
  aiReasoningSummary: string | null;
  aiCriterionScores: AiCriterionScoreRecord[] | null;
  aiEvidenceQuotes: string[] | null;
  aiModel: string | null;
  aiGradedAt: string | null;
};

export type VerificationLogRecord = {
  id: string;
  submissionId: string;
  attempt: number;
  status: SubmissionWorkflowStatus;
  log: string;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type GithubDeliveryRecord = {
  id: string;
  submissionId: string;
  repoUrl: string;
  eventType: string;
  deliveryId: string;
  ref: string;
  commitSha: string;
  payload: Record<string, unknown>;
  receivedAt: string;
};

export type ActivityRecord = {
  id: string;
  actorUserId: string | null;
  courseId: string | null;
  projectId: string | null;
  milestoneId: string | null;
  submissionId: string | null;
  action: string;
  summary: string;
  createdAt: string;
};

export type TrackingDashboardStats = {
  approved: number;
  underReview: number;
  completion: number;
  total: number;
  minutesRemaining: number;
};

export type StudentDashboardRecord = {
  course: CourseRecord | null;
  memberships: CourseMembershipRecord[];
  projects: ProjectRecord[];
  projectTemplatesById?: Record<string, ProjectTemplateRecord>;
  milestonesByProject: Record<string, MilestoneRecord[]>;
  activeProjectId: string | null;
  activity: ActivityRecord[];
  statsByProject: Record<string, TrackingDashboardStats>;
  pageError: string | null;
};

export type InstructorDashboardRecord = {
  courses: CourseRecord[];
  reviewQueue: SubmissionRecord[];
  activity: ActivityRecord[];
};

export type DashboardModeRecord = 'student' | 'instructor';

export type DashboardCtaRecord = {
  label: string;
  href: string;
};

export type StudentHomeAttentionItemRecord = {
  id: string;
  kind: 'changes_requested' | 'failed_submission' | 'needs_review' | 'due_soon' | 'recent_feedback';
  courseId: string;
  courseTitle: string;
  projectId: string;
  projectTitle: string;
  milestoneId: string | null;
  milestoneTitle: string | null;
  submissionId: string | null;
  statusText: string;
  reason: string;
  dueAt: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  cta: DashboardCtaRecord;
};

export type StudentCourseMilestoneSnapshotRecord = {
  milestoneId: string;
  projectId: string;
  projectTitle: string;
  title: string;
  dueAt: string | null;
  status: string;
  statusLabel: string;
};

export type StudentCourseProjectSnapshotRecord = {
  projectId: string;
  title: string;
  completion: number;
  approved: number;
  underReview: number;
  open: number;
  minutesRemaining: number | null;
  nextMilestoneTitle: string | null;
  href: string;
};

export type StudentCourseSnapshotRecord = {
  courseId: string;
  courseTitle: string;
  completion: number;
  approved: number;
  underReview: number;
  open: number;
  nextMilestones: StudentCourseMilestoneSnapshotRecord[];
  projects: StudentCourseProjectSnapshotRecord[];
};

export type StudentSubmissionHealthRecord = {
  failedChecks: number;
  needsReview: number;
  awaitingReview: number;
  recentlyPassed: number;
};

export type StudentHomeRecentSubmissionRecord = {
  id: string;
  projectKey: string;
  projectTitle: string;
  milestoneTitle: string | null;
  status: string;
  statusLabel: string;
  submittedAt: string | null;
  createdAt: string;
  href: string;
};

export type StudentHomeBlockerRecord = {
  id: string;
  kind:
    | 'github_not_linked'
    | 'github_app_not_installed'
    | 'no_published_projects'
    | 'no_memberships';
  title: string;
  body: string;
  cta: DashboardCtaRecord;
};

export type StudentHomeDashboardRecord = {
  courses: CourseRecord[];
  selectedCourseId: string | null;
  attentionItems: StudentHomeAttentionItemRecord[];
  courseSnapshots: StudentCourseSnapshotRecord[];
  submissionHealth: StudentSubmissionHealthRecord;
  recentSubmissions: StudentHomeRecentSubmissionRecord[];
  blockers: StudentHomeBlockerRecord[];
};

export type InstructorReviewSummaryByCourseRecord = {
  courseId: string;
  courseTitle: string;
  pendingReviewCount: number;
};

export type InstructorReviewSummaryRecord = {
  totalAwaitingReview: number;
  oldestWaitingMinutes: number | null;
  submittedLast24Hours: number;
  byCourse: InstructorReviewSummaryByCourseRecord[];
};

export type InstructorUrgentQueueItemRecord = {
  submissionId: string;
  courseId: string;
  courseTitle: string;
  projectId: string;
  projectTitle: string;
  projectKey: string;
  studentName: string;
  status: string;
  submittedAt: string;
  waitingMinutes: number;
  cta: DashboardCtaRecord;
};

export type InstructorCourseSummaryRecord = {
  courseId: string;
  title: string;
  courseCode: string;
  termLabel: string;
  pendingReviewCount: number;
  publishedProjectCount: number;
  memberCount: number;
  lastActivityAt: string | null;
};

export type DashboardOperationRecord = {
  id: string;
  label: string;
  description: string;
  href: string;
};

export type InstructorRecentActivityItemRecord = {
  id: string;
  action: string;
  summary: string;
  createdAt: string;
  courseId: string | null;
  courseTitle: string | null;
  href: string | null;
};

export type InstructorHomeDashboardRecord = {
  reviewSummary: InstructorReviewSummaryRecord;
  urgentQueue: InstructorUrgentQueueItemRecord[];
  courseSummaries: InstructorCourseSummaryRecord[];
  recentActivity: InstructorRecentActivityItemRecord[];
  operations: DashboardOperationRecord[];
};

export type DashboardHomeRecord = {
  availableModes: DashboardModeRecord[];
  defaultMode: DashboardModeRecord;
  student?: StudentHomeDashboardRecord;
  instructor?: InstructorHomeDashboardRecord;
};

export type CourseInviteRecord = {
  id: string;
  courseId: string;
  code: string;
  role: MembershipRole;
  maxUses: number;
  useCount: number;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type StoreData = {
  users: UserRecord[];
  githubAccounts: GitHubAccountRecord[];
  courses: CourseRecord[];
  programs?: ProgramRecord[];
  programVersions?: ProgramVersionRecord[];
  tracks?: TrackRecord[];
  catalogCourses?: CatalogCourseRecord[];
  requirementGroups?: RequirementGroupRecord[];
  studentPrograms?: StudentProgramRecord[];
  studentPlannedCourses?: StudentPlannedCourseRecord[];
  studentRequirementDecisions?: StudentRequirementDecisionRecord[];
  petitions?: PetitionRecord[];
  programApprovals?: ProgramApprovalRecord[];
  programSheetSnapshots?: ProgramSheetSnapshotRecord[];
  projectTemplates?: ProjectTemplateRecord[];
  projectRoleApplications?: ProjectRoleApplicationRecord[];
  teamFormationRuns?: TeamFormationRunRecord[];
  teams?: TeamRecord[];
  courseMemberships: CourseMembershipRecord[];
  courseInvites: CourseInviteRecord[];
  deviceCodes: DeviceCodeRecord[];
  sessions: SessionRecord[];
  webSessions: WebSessionRecord[];
  submissions: SubmissionRecord[];
  verificationLogs: VerificationLogRecord[];
  projects: ProjectRecord[];
  milestones: MilestoneRecord[];
  reviews: ReviewRecord[];
  githubDeliveries: GithubDeliveryRecord[];
  activity: ActivityRecord[];
  notifications?: NotificationRecord[];
};

export interface AppStore {
  createDeviceCode(apiBaseUrl: string): Promise<DeviceCodeRecord>;
  authorizeDeviceCode(
    apiBaseUrl: string,
    userCode: string,
    userId?: string
  ): Promise<DeviceCodeRecord | null>;
  pollDeviceCode(
    apiBaseUrl: string,
    deviceCode: string
  ): Promise<{ record: DeviceCodeRecord | null; session: SessionRecord | null }>;
  getUserByToken(apiBaseUrl: string, accessToken: string): Promise<UserRecord | null>;
  upsertGitHubUserSession(args: {
    githubUserId: string;
    login: string;
    email: string | null;
    accessToken: string;
    refreshToken?: string;
    accessTokenExpiresIn?: number;
    refreshTokenExpiresIn?: number;
  }): Promise<{ user: UserRecord; session: SessionRecord }>;
  getGithubAccountForUser(userId: string): Promise<{
    login: string;
    installationId: string | null;
    userAccessToken: string | null;
  } | null>;
  linkGitHubInstallation(userId: string, installationId: string): Promise<UserRecord>;
  refreshCliSession(apiBaseUrl: string, refreshToken: string): Promise<SessionRecord | null>;
  deleteSession(apiBaseUrl: string, accessToken: string): Promise<void>;
  createWebSession(apiBaseUrl: string, userId: string): Promise<WebSessionRecord>;
  getUserByWebSession(apiBaseUrl: string, sessionToken: string): Promise<UserRecord | null>;
  deleteWebSession(apiBaseUrl: string, sessionToken: string): Promise<void>;
  getProject(apiBaseUrl: string, projectKey: string): Promise<ProjectRecord | null>;
  provisionProjectRepo(apiBaseUrl: string, projectKey: string, userId: string): Promise<RepoRecord>;
  createOrReuseSubmission(
    apiBaseUrl: string,
    payload: {
      userId: string;
      projectKey: string;
      commitSha: string;
      repoUrl: string;
      branch: string;
    }
  ): Promise<SubmissionRecord>;
  updateLocalTestResult(
    apiBaseUrl: string,
    submissionId: string,
    requesterUserId: string,
    exitCode: number,
    summary: string
  ): Promise<SubmissionRecord | null>;
  getSubmission(
    apiBaseUrl: string,
    submissionId: string,
    requesterUserId: string
  ): Promise<SubmissionRecord | null>;
  getSubmissionForAdmin(apiBaseUrl: string, submissionId: string): Promise<SubmissionRecord | null>;
  overrideSubmissionStatus(
    apiBaseUrl: string,
    submissionId: string,
    status: SubmissionWorkflowStatus,
    summary: string,
    actorUserId: string
  ): Promise<SubmissionRecord | null>;
  listSubmissionVerificationLogs(
    apiBaseUrl: string,
    submissionId: string
  ): Promise<VerificationLogRecord[]>;
  listCourseMemberships(apiBaseUrl: string, userId: string): Promise<CourseMembershipRecord[]>;
  listTrackingCourses(
    apiBaseUrl: string,
    userId: string,
    opts?: PaginationOpts
  ): Promise<CourseRecord[]>;
  countTrackingCourses(apiBaseUrl: string, userId: string): Promise<number>;
  createTrackingCourse(
    apiBaseUrl: string,
    userId: string,
    payload: { slug: string; title: string; termLabel: string; courseCode: string }
  ): Promise<CourseRecord>;
  deleteTrackingCourse(apiBaseUrl: string, courseId: string): Promise<boolean>;
  listPrograms(apiBaseUrl: string): Promise<ProgramRecord[]>;
  createProgram(
    apiBaseUrl: string,
    userId: string,
    payload: {
      slug: string;
      title: string;
      code: string;
      academicYear: string;
      totalUnitRequirement: number;
      status: ProgramStatus;
    }
  ): Promise<ProgramRecord>;
  createProgramVersion(
    apiBaseUrl: string,
    userId: string,
    programId: string,
    payload: {
      versionLabel: string;
      effectiveFrom: string | null;
      effectiveTo: string | null;
      isActive: boolean;
      policyText: string;
      trackSelectionMinYear: number;
    }
  ): Promise<ProgramVersionRecord>;
  getProgramVersionDetail(
    apiBaseUrl: string,
    programId: string,
    versionId: string
  ): Promise<ProgramVersionDetailRecord | null>;
  createCatalogCourse(
    apiBaseUrl: string,
    userId: string,
    programId: string,
    payload: {
      subjectCode: string;
      catalogNumber: string;
      title: string;
      defaultUnits: number;
      department: string;
    }
  ): Promise<CatalogCourseRecord>;
  createRequirementGroup(
    apiBaseUrl: string,
    userId: string,
    programId: string,
    payload: {
      programVersionId: string;
      trackId: string | null;
      title: string;
      category: RequirementGroupCategory;
      minUnits: number;
      minCourses: number;
      notes: string;
      sortOrder: number;
      noDoubleCount: boolean;
      rules: Array<{
        ruleType: RequirementRuleType;
        pickCount: number | null;
        note: string;
        sortOrder: number;
        courses: Array<{ catalogCourseId: string }>;
      }>;
    }
  ): Promise<RequirementGroupRecord>;
  updateRequirementGroup(
    apiBaseUrl: string,
    userId: string,
    programId: string,
    groupId: string,
    payload: Partial<{
      trackId: string | null;
      title: string;
      category: RequirementGroupCategory;
      minUnits: number;
      minCourses: number;
      notes: string;
      sortOrder: number;
      noDoubleCount: boolean;
      rules: Array<{
        ruleType: RequirementRuleType;
        pickCount: number | null;
        note: string;
        sortOrder: number;
        courses: Array<{ catalogCourseId: string }>;
      }>;
    }>
  ): Promise<RequirementGroupRecord | null>;
  createTrack(
    apiBaseUrl: string,
    userId: string,
    programId: string,
    payload: {
      programVersionId: string;
      slug: string;
      title: string;
      description: string;
      selectionYearStart: number;
    }
  ): Promise<TrackRecord>;
  updateTrack(
    apiBaseUrl: string,
    userId: string,
    programId: string,
    trackId: string,
    payload: Partial<{
      slug: string;
      title: string;
      description: string;
      selectionYearStart: number;
    }>
  ): Promise<TrackRecord | null>;
  enrollInProgram(
    apiBaseUrl: string,
    userId: string,
    programId: string
  ): Promise<StudentProgramPlanRecord>;
  getStudentProgramPlan(
    apiBaseUrl: string,
    userId: string
  ): Promise<StudentProgramPlanRecord | null>;
  selectStudentTrack(
    apiBaseUrl: string,
    userId: string,
    trackId: string
  ): Promise<StudentProgramPlanRecord | null>;
  updateStudentProgramPlan(
    apiBaseUrl: string,
    userId: string,
    payload: {
      plannedCourses: Array<{
        catalogCourseId: string;
        plannedYear: number;
        plannedTerm: AcademicTerm;
        sourceType: PlannedCourseSourceType;
        note: string | null;
      }>;
    }
  ): Promise<StudentProgramPlanRecord | null>;
  getStudentProgramSheet(
    apiBaseUrl: string,
    userId: string
  ): Promise<ProgramSheetViewRecord | null>;
  generateStudentProgramSheet(
    apiBaseUrl: string,
    userId: string
  ): Promise<ProgramSheetViewRecord | null>;
  createStudentPetition(
    apiBaseUrl: string,
    userId: string,
    payload: {
      type: PetitionType;
      justification: string;
      targetRequirementGroupId: string | null;
      originalCatalogCourseId: string | null;
      substituteCatalogCourseId: string | null;
    }
  ): Promise<PetitionRecord | null>;
  listStudentPetitions(apiBaseUrl: string, userId: string): Promise<PetitionRecord[]>;
  listProgramPetitions(apiBaseUrl: string, programId: string): Promise<PetitionRecord[]>;
  updateProgramPetition(
    apiBaseUrl: string,
    programId: string,
    petitionId: string,
    reviewerUserId: string,
    payload: { status: PetitionStatus; reviewerNotes: string | null }
  ): Promise<PetitionRecord | null>;
  setProgramApproval(
    apiBaseUrl: string,
    programId: string,
    studentProgramId: string,
    stage: ApprovalStage,
    reviewerUserId: string,
    payload: { status: ApprovalStatus; notes: string | null }
  ): Promise<ProgramApprovalRecord | null>;
  listCourseMembersForInstructor(
    apiBaseUrl: string,
    courseId: string
  ): Promise<Array<CourseMembershipRecord & { username: string; githubLogin: string }>>;
  addCourseMember(
    apiBaseUrl: string,
    courseId: string,
    githubLogin: string,
    role: MembershipRole
  ): Promise<CourseMembershipRecord & { username: string; githubLogin: string }>;
  removeCourseMember(apiBaseUrl: string, courseId: string, userId: string): Promise<void>;
  updateStudentLevel(
    apiBaseUrl: string,
    courseId: string,
    userId: string,
    level: number
  ): Promise<CourseMembershipRecord | null>;
  syncStudentYearGlobal(apiBaseUrl: string, userId: string, yearLevel: number): Promise<void>;
  listStudentsWithYearLevel(
    apiBaseUrl: string
  ): Promise<Array<{ userId: string; username: string; githubLogin: string; yearLevel: number }>>;
  createNotification(
    apiBaseUrl: string,
    userId: string,
    notification: { type: string; title: string; body: string; link?: string }
  ): Promise<void>;
  listNotifications(apiBaseUrl: string, userId: string): Promise<NotificationRecord[]>;
  countUnreadNotifications(apiBaseUrl: string, userId: string): Promise<number>;
  markAllNotificationsRead(apiBaseUrl: string, userId: string): Promise<void>;
  createCourseInvite(
    apiBaseUrl: string,
    courseId: string,
    role: MembershipRole,
    opts?: { maxUses?: number; expiresAt?: string | null }
  ): Promise<CourseInviteRecord>;
  getCourseInviteByCode(
    apiBaseUrl: string,
    code: string
  ): Promise<(CourseInviteRecord & { course: CourseRecord }) | null>;
  redeemCourseInvite(
    apiBaseUrl: string,
    code: string,
    userId: string
  ): Promise<CourseMembershipRecord>;
  listTrackingProjects(
    apiBaseUrl: string,
    courseId: string,
    opts?: PaginationOpts
  ): Promise<ProjectRecord[]>;
  countTrackingProjects(apiBaseUrl: string, courseId: string): Promise<number>;
  getTrackingProjectById(apiBaseUrl: string, projectId: string): Promise<ProjectRecord | null>;
  createTrackingProject(
    apiBaseUrl: string,
    userId: string,
    payload: {
      courseId: string;
      slug: string;
      title: string;
      description: string;
      status: ProjectStatus;
      deliveryMode: DeliveryMode;
      templateId?: string | null;
      applicationOpenAt?: string | null;
      applicationCloseAt?: string | null;
      teamLockAt?: string | null;
      teamSize?: number | null;
      rubric: TrackingRubricItemRecord[];
      resources: TrackingResourceRecord[];
    }
  ): Promise<ProjectRecord>;
  updateTrackingProject(
    apiBaseUrl: string,
    userId: string,
    projectId: string,
    payload: Partial<{
      slug: string;
      title: string;
      description: string;
      status: ProjectStatus;
      deliveryMode: DeliveryMode;
      templateId: string | null;
      applicationOpenAt: string | null;
      applicationCloseAt: string | null;
      teamLockAt: string | null;
      teamSize: number | null;
      rubric: TrackingRubricItemRecord[];
      resources: TrackingResourceRecord[];
    }>
  ): Promise<ProjectRecord | null>;
  listCourseProjectTemplates(
    apiBaseUrl: string,
    courseId: string
  ): Promise<ProjectTemplateRecord[]>;
  createCourseProjectTemplate(
    apiBaseUrl: string,
    userId: string,
    courseId: string,
    payload: {
      slug: string;
      title: string;
      description: string;
      deliveryMode: DeliveryMode;
      teamSize: number | null;
      status: ProjectTemplateStatus;
      rubric: TrackingRubricItemRecord[];
      resources: TrackingResourceRecord[];
      roles: Array<Omit<ProjectTemplateRoleRecord, 'id'>>;
      milestones: Array<Omit<ProjectTemplateMilestoneRecord, 'id'>>;
    }
  ): Promise<ProjectTemplateRecord>;
  getProjectTemplateById(
    apiBaseUrl: string,
    templateId: string
  ): Promise<ProjectTemplateRecord | null>;
  updateProjectTemplate(
    apiBaseUrl: string,
    userId: string,
    templateId: string,
    payload: Partial<{
      slug: string;
      title: string;
      description: string;
      deliveryMode: DeliveryMode;
      teamSize: number | null;
      status: ProjectTemplateStatus;
      rubric: TrackingRubricItemRecord[];
      resources: TrackingResourceRecord[];
      roles: Array<Omit<ProjectTemplateRoleRecord, 'id'>>;
      milestones: Array<Omit<ProjectTemplateMilestoneRecord, 'id'>>;
    }>
  ): Promise<ProjectTemplateRecord | null>;
  createProjectRoleApplication(
    apiBaseUrl: string,
    userId: string,
    projectId: string,
    payload: {
      statement: string;
      availabilityNote: string;
      preferences: Array<{ templateRoleId: string; rank: number }>;
    }
  ): Promise<ProjectRoleApplicationRecord>;
  getProjectRoleApplicationForUser(
    apiBaseUrl: string,
    projectId: string,
    userId: string
  ): Promise<ProjectRoleApplicationRecord | null>;
  listProjectRoleApplications(
    apiBaseUrl: string,
    projectId: string
  ): Promise<ProjectRoleApplicationRecord[]>;
  generateProjectTeamFormation(
    apiBaseUrl: string,
    userId: string,
    projectId: string,
    payload?: { algorithmVersion?: string }
  ): Promise<TeamFormationRunRecord>;
  lockProjectTeams(
    apiBaseUrl: string,
    userId: string,
    projectId: string,
    payload?: { formationRunId?: string }
  ): Promise<TeamRecord[]>;
  listProjectTeams(apiBaseUrl: string, projectId: string): Promise<TeamRecord[]>;
  updateProjectTeam(
    apiBaseUrl: string,
    userId: string,
    projectId: string,
    teamId: string,
    payload: Partial<{
      name: string;
      members: Array<{ userId: string; roleKey: string; roleLabel: string }>;
    }>
  ): Promise<TeamRecord | null>;
  setTrackingProjectStatus(
    apiBaseUrl: string,
    userId: string,
    projectId: string,
    status: ProjectStatus
  ): Promise<ProjectRecord | null>;
  listTrackingMilestones(apiBaseUrl: string, projectId: string): Promise<MilestoneRecord[]>;
  getTrackingMilestone(apiBaseUrl: string, milestoneId: string): Promise<MilestoneRecord | null>;
  createTrackingMilestone(
    apiBaseUrl: string,
    userId: string,
    projectId: string,
    payload: {
      title: string;
      description: string;
      order: number;
      dueAt: string | null;
      isFinal: boolean;
    }
  ): Promise<MilestoneRecord>;
  updateTrackingMilestone(
    apiBaseUrl: string,
    userId: string,
    milestoneId: string,
    payload: Partial<{
      title: string;
      description: string;
      order: number;
      dueAt: string | null;
      isFinal: boolean;
    }>
  ): Promise<MilestoneRecord | null>;
  deleteTrackingMilestone(
    apiBaseUrl: string,
    userId: string,
    milestoneId: string
  ): Promise<boolean>;
  listTrackingMilestoneSubmissions(
    apiBaseUrl: string,
    milestoneId: string,
    opts?: PaginationOpts
  ): Promise<SubmissionRecord[]>;
  countTrackingMilestoneSubmissions(apiBaseUrl: string, milestoneId: string): Promise<number>;
  createTrackingSubmission(
    apiBaseUrl: string,
    userId: string,
    milestoneId: string,
    payload: {
      submissionType: SubmissionType;
      submissionValue: string;
      notes: string;
      repoUrl: string;
      branch: string;
      commitSha: string;
    }
  ): Promise<SubmissionRecord>;
  updateTrackingSubmission(
    apiBaseUrl: string,
    userId: string,
    submissionId: string,
    payload: Partial<{
      submissionType: SubmissionType;
      submissionValue: string;
      notes: string;
      repoUrl: string;
      branch: string;
      commitSha: string;
    }>
  ): Promise<SubmissionRecord | null>;
  createTrackingReview(
    apiBaseUrl: string,
    userId: string,
    submissionId: string,
    payload: {
      status: ReviewStatus;
      score: number | null;
      feedback: string;
      rubric: TrackingRubricItemRecord[];
    }
  ): Promise<ReviewRecord>;
  getTrackingReview(apiBaseUrl: string, submissionId: string): Promise<ReviewRecord | null>;
  getSubmissionStudentEmail(
    apiBaseUrl: string,
    submissionId: string
  ): Promise<{ userId: string; email: string; username: string } | null>;
  listTrackingReviewQueue(
    apiBaseUrl: string,
    filters?: { courseId?: string; projectId?: string; status?: SubmissionWorkflowStatus },
    opts?: PaginationOpts
  ): Promise<SubmissionRecord[]>;
  countTrackingReviewQueue(
    apiBaseUrl: string,
    filters?: { courseId?: string; projectId?: string; status?: SubmissionWorkflowStatus }
  ): Promise<number>;
  listTrackingActivity(apiBaseUrl: string, userId: string): Promise<ActivityRecord[]>;
  getStudentTrackingDashboard(
    apiBaseUrl: string,
    userId: string,
    courseId?: string | null
  ): Promise<StudentDashboardRecord>;
  getInstructorTrackingDashboard(
    apiBaseUrl: string,
    userId: string
  ): Promise<InstructorDashboardRecord>;
  getCourseTrackingDashboard(
    apiBaseUrl: string,
    userId: string,
    courseId: string
  ): Promise<InstructorDashboardRecord>;
  getHomeDashboard(
    apiBaseUrl: string,
    userId: string,
    mode?: DashboardModeRecord
  ): Promise<DashboardHomeRecord>;
  getTrackingSubmissionCommits(
    apiBaseUrl: string,
    submissionId: string
  ): Promise<GithubDeliveryRecord[]>;
  handlePushWebhook(payload: {
    owner: string;
    repoName: string;
    ref: string;
    after: string;
    deliveryId?: string;
    eventType?: string;
    repositoryUrl?: string;
    rawPayload?: Record<string, unknown>;
  }): Promise<void>;
  listUsers(apiBaseUrl: string): Promise<UserRecord[]>;
  setUserSystemRole(
    apiBaseUrl: string,
    userId: string,
    role: SystemRole
  ): Promise<UserRecord | null>;
  deleteUserAccount(apiBaseUrl: string, userId: string): Promise<void>;
  listUserSubmissions(
    apiBaseUrl: string,
    userId: string,
    opts?: PaginationOpts
  ): Promise<SubmissionRecord[]>;
  countUserSubmissions(apiBaseUrl: string, userId: string): Promise<number>;
  exportCourseGrades(
    apiBaseUrl: string,
    courseId: string
  ): Promise<
    Array<{
      githubLogin: string;
      username: string;
      milestoneTitle: string;
      projectKey: string;
      status: string;
      submittedAt: string | null;
      commitSha: string;
    }>
  >;
  close?(): Promise<void>;
}

function defaultTask(apiBaseUrl: string): string {
  return [
    '# CS161 / exam1',
    '',
    'This is the first hosted-style Nibras task.',
    '',
    `1. Run \`nibras login --api-base-url ${apiBaseUrl}\` against the hosted API.`,
    '2. Run `nibras test` inside a provisioned project repo.',
    '3. Run `nibras submit` to push and wait for verification.',
  ].join('\n');
}

export function defaultManifest(apiBaseUrl: string): ProjectManifest {
  return {
    projectKey: 'cs161/exam1',
    releaseVersion: '2026-03-01',
    apiBaseUrl,
    defaultBranch: 'main',
    buildpack: { node: '20' },
    test: {
      mode: 'public-grading',
      command: 'npm test',
      commands: {
        default: 'npm test',
        windows: 'npm test',
      },
      supportsPrevious: true,
    },
    submission: {
      allowedPaths: ['.nibras/**', 'src/**', 'test/**', 'README.md', 'CS161.md', 'package.json'],
      waitForVerificationSeconds: 30,
    },
  };
}

function nowIso(): string {
  return new Date().toISOString();
}

function futureIso(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

function formatDateLabel(value: string | null): string {
  if (!value) return 'No due date';
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function statusLabel(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function branchNameFromRef(ref: string): string {
  return ref.startsWith('refs/heads/') ? ref.slice('refs/heads/'.length) : ref;
}

const TEAM_BADGE_COLORS = ['#0f766e', '#0369a1', '#7c3aed', '#b45309', '#be123c', '#1d4ed8'];

function initialsForName(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
}

function colorForUser(userId: string): string {
  const total = userId.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return TEAM_BADGE_COLORS[total % TEAM_BADGE_COLORS.length];
}

export function resolveProjectTemplateRecord(
  data: StoreData,
  project: Pick<ProjectRecord, 'templateId' | 'teamRoles' | 'teamSize'> & { id: string }
): ProjectTemplateRecord | null {
  if (project.templateId) {
    return data.projectTemplates?.find((entry) => entry.id === project.templateId) || null;
  }
  if ((project.teamRoles?.length || 0) > 0 || project.teamSize) {
    return {
      id: `inline-template-${project.id}`,
      courseId: '',
      slug: '',
      title: '',
      description: '',
      deliveryMode: 'team',
      teamSize: project.teamSize,
      status: 'active',
      rubric: [],
      resources: [],
      roles: project.teamRoles || [],
      milestones: [],
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
  }
  return null;
}

export function buildProjectTeamBadges(
  data: StoreData,
  projectId: string,
  userId: string
): { teamName: string | null; assignedRoleLabel: string | null; team: TeamMemberBadgeRecord[] } {
  const team = (data.teams || []).find(
    (entry) =>
      entry.projectId === projectId &&
      entry.members.some((member) => member.userId === userId && member.status === 'active')
  );
  if (!team) {
    return { teamName: null, assignedRoleLabel: null, team: [] };
  }
  const currentMember = team.members.find((entry) => entry.userId === userId) || null;
  return {
    teamName: team.name,
    assignedRoleLabel: currentMember?.roleLabel || null,
    team: team.members.map((member) => ({
      userId: member.userId,
      name: member.username,
      initials: initialsForName(member.username),
      color: colorForUser(member.userId),
      roleKey: member.roleKey,
      roleLabel: member.roleLabel,
    })),
  };
}

export function projectWithTeamContext(
  data: StoreData,
  project: ProjectRecord,
  userId: string
): ProjectRecord {
  const team = buildProjectTeamBadges(data, project.id, userId);
  return {
    ...project,
    teamName: team.teamName,
    assignedRoleLabel: team.assignedRoleLabel,
    team: team.team,
  };
}

export function teamMemberUserIdsForSubmission(
  data: StoreData,
  submission: SubmissionRecord
): string[] {
  if (submission.teamMemberUserIds.length > 0) {
    return submission.teamMemberUserIds;
  }
  if (!submission.teamId) {
    return [];
  }
  const team = (data.teams || []).find((entry) => entry.id === submission.teamId);
  return team?.members.map((member) => member.userId) || [];
}

export function submissionBelongsToUser(
  data: StoreData,
  submission: SubmissionRecord,
  userId: string
): boolean {
  if (submission.userId === userId || submission.submittedByUserId === userId) {
    return true;
  }
  return teamMemberUserIdsForSubmission(data, submission).includes(userId);
}

function templateRoleForPreference(
  template: ProjectTemplateRecord,
  templateRoleId: string
): ProjectTemplateRoleRecord | null {
  return template.roles.find((role) => role.id === templateRoleId) || null;
}

export function generateTeamFormationResult(args: {
  applications: ProjectRoleApplicationRecord[];
  template: ProjectTemplateRecord;
  users: UserRecord[];
  memberships: CourseMembershipRecord[];
}): TeamFormationRunRecord['result'] {
  const teamSize = args.template.teamSize || 0;
  const warnings: string[] = [];
  if (teamSize <= 0) {
    return { teams: [], waitlist: [], warnings: ['Team size must be configured before matching.'] };
  }
  const activeApplications = args.applications
    .filter((entry) => entry.status === 'submitted')
    .slice()
    .sort((left, right) => left.userId.localeCompare(right.userId));
  const maxTeams = Math.floor(activeApplications.length / teamSize);
  if (maxTeams === 0) {
    return {
      teams: [],
      waitlist: activeApplications.map((application) => {
        const user = args.users.find((entry) => entry.id === application.userId);
        const membership = args.memberships.find((entry) => entry.userId === application.userId);
        return {
          userId: application.userId,
          username: user?.username || application.userId,
          level: membership?.level || 1,
        };
      }),
      warnings: ['Not enough applications to form a complete team.'],
    };
  }

  const rolePool: Array<{ roleKey: string; roleLabel: string }> = [];
  for (const role of args.template.roles.slice().sort((a, b) => a.sortOrder - b.sortOrder)) {
    for (let index = 0; index < role.count; index += 1) {
      rolePool.push({ roleKey: role.key, roleLabel: role.label });
    }
  }
  if (rolePool.length !== teamSize) {
    warnings.push('Template role counts do not equal the configured team size.');
  }

  const teamCount = Math.min(
    maxTeams,
    Math.max(1, Math.floor(activeApplications.length / teamSize))
  );
  const teams: TeamFormationSuggestionRecord[] = Array.from({ length: teamCount }, (_, index) => ({
    name: `Team ${index + 1}`,
    members: [],
    averageLevel: 0,
  }));

  const remainingApplications = [...activeApplications];
  const remainingByUserId = new Set(remainingApplications.map((entry) => entry.userId));
  const userLevel = (userId: string) =>
    args.memberships.find((entry) => entry.userId === userId)?.level ||
    args.users.find((entry) => entry.id === userId)?.yearLevel ||
    1;
  const usernameFor = (userId: string) =>
    args.users.find((entry) => entry.id === userId)?.username || userId;
  const averageLevelForTeam = (team: TeamFormationSuggestionRecord) =>
    team.members.length === 0
      ? 0
      : team.members.reduce((sum, member) => sum + member.level, 0) / team.members.length;

  const preferenceRank = (application: ProjectRoleApplicationRecord, roleId: string) =>
    application.preferences.find((entry) => entry.templateRoleId === roleId)?.rank ?? 999;

  for (const role of args.template.roles.slice().sort((a, b) => a.sortOrder - b.sortOrder)) {
    const slots = Math.min(role.count * teamCount, remainingApplications.length);
    for (let slotIndex = 0; slotIndex < slots; slotIndex += 1) {
      const candidateApplications = remainingApplications.filter((entry) =>
        remainingByUserId.has(entry.userId)
      );
      if (candidateApplications.length === 0) {
        break;
      }
      candidateApplications.sort((left, right) => {
        const rankDelta = preferenceRank(left, role.id) - preferenceRank(right, role.id);
        if (rankDelta !== 0) return rankDelta;
        const levelDelta = userLevel(left.userId) - userLevel(right.userId);
        if (levelDelta !== 0) return levelDelta;
        return left.userId.localeCompare(right.userId);
      });
      const selected = candidateApplications[0];
      const eligibleTeams = teams
        .map((team, index) => ({ team, index }))
        .filter(
          ({ team }) =>
            team.members.length < teamSize && !team.members.some((m) => m.roleKey === role.key)
        )
        .sort((left, right) => {
          const avgDelta = averageLevelForTeam(left.team) - averageLevelForTeam(right.team);
          if (avgDelta !== 0) return avgDelta;
          return left.index - right.index;
        });
      if (eligibleTeams.length === 0) {
        break;
      }
      const target = eligibleTeams[0].team;
      target.members.push({
        userId: selected.userId,
        username: usernameFor(selected.userId),
        level: userLevel(selected.userId),
        roleKey: role.key,
        roleLabel: role.label,
      });
      remainingByUserId.delete(selected.userId);
    }
  }

  const leftovers = remainingApplications.filter((entry) => remainingByUserId.has(entry.userId));
  for (const application of leftovers) {
    const availableRoles = rolePool.filter(
      (role) =>
        !teams.every(
          (team) =>
            team.members.length >= teamSize ||
            team.members.some((member) => member.roleKey === role.roleKey)
        )
    );
    const preferredRole =
      application.preferences
        .slice()
        .sort((left, right) => left.rank - right.rank)
        .map((entry) => templateRoleForPreference(args.template, entry.templateRoleId))
        .find(Boolean) || null;
    const fallbackRole = preferredRole
      ? { roleKey: preferredRole.key, roleLabel: preferredRole.label }
      : availableRoles[0] || rolePool[0];
    const target = teams
      .slice()
      .sort((left, right) => {
        const fillDelta = left.members.length - right.members.length;
        if (fillDelta !== 0) return fillDelta;
        return averageLevelForTeam(left) - averageLevelForTeam(right);
      })
      .find((team) => team.members.length < teamSize);
    if (!target || !fallbackRole) {
      continue;
    }
    target.members.push({
      userId: application.userId,
      username: usernameFor(application.userId),
      level: userLevel(application.userId),
      roleKey: fallbackRole.roleKey,
      roleLabel: fallbackRole.roleLabel,
    });
    remainingByUserId.delete(application.userId);
  }

  const completeTeams = teams.filter((team) => team.members.length === teamSize);
  const incompleteMembers = teams
    .filter((team) => team.members.length !== teamSize)
    .flatMap((team) => team.members);
  if (incompleteMembers.length > 0) {
    warnings.push('Some suggested teams were incomplete and moved to the waitlist.');
  }

  for (const team of completeTeams) {
    team.averageLevel = averageLevelForTeam(team);
  }

  const waitlist = [
    ...incompleteMembers.map((member) => ({
      userId: member.userId,
      username: member.username,
      level: member.level,
    })),
    ...remainingApplications
      .filter((entry) => remainingByUserId.has(entry.userId))
      .map((entry) => ({
        userId: entry.userId,
        username: usernameFor(entry.userId),
        level: userLevel(entry.userId),
      })),
  ].sort((left, right) => left.userId.localeCompare(right.userId));

  return { teams: completeTeams, waitlist, warnings };
}

function calculateProjectStats(
  milestones: MilestoneRecord[],
  submissions: SubmissionRecord[],
  reviews: ReviewRecord[]
): TrackingDashboardStats {
  const statuses = milestones.map((milestone) =>
    milestoneProgress(milestone.id, submissions, reviews)
  );
  const approved = statuses.filter((value) => value === 'approved' || value === 'graded').length;
  const underReview = statuses.filter((value) => value === 'submitted').length;
  const futureDates = milestones
    .map((entry) => entry.dueAt)
    .filter((entry): entry is string => Boolean(entry))
    .map((entry) => new Date(entry))
    .filter((entry) => entry.getTime() > Date.now());
  const lastDue =
    futureDates.length > 0
      ? new Date(Math.max(...futureDates.map((entry) => entry.getTime())))
      : null;
  return {
    approved,
    underReview,
    completion: milestones.length ? Math.round((approved / milestones.length) * 100) : 0,
    total: milestones.length,
    minutesRemaining: lastDue ? Math.ceil((lastDue.getTime() - Date.now()) / 60_000) : 0,
  };
}

function milestoneProgress(
  milestoneId: string,
  submissions: SubmissionRecord[],
  reviews: ReviewRecord[]
): string {
  const milestoneSubmissions = submissions
    .filter((entry) => entry.milestoneId === milestoneId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  if (milestoneSubmissions.length === 0) {
    return 'open';
  }
  const latestSubmission = milestoneSubmissions[0];
  const latestReview = reviews
    .filter((entry) => entry.submissionId === latestSubmission.id)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
  if (latestReview) {
    if (latestReview.status === 'graded') return 'graded';
    if (latestReview.status === 'approved') return 'approved';
  }
  return 'submitted';
}

function makeActivityRecord(args: {
  actorUserId: string | null;
  courseId: string | null;
  projectId: string | null;
  milestoneId: string | null;
  submissionId: string | null;
  action: string;
  summary: string;
}): ActivityRecord {
  return {
    id: randomUUID(),
    actorUserId: args.actorUserId,
    courseId: args.courseId,
    projectId: args.projectId,
    milestoneId: args.milestoneId,
    submissionId: args.submissionId,
    action: args.action,
    summary: args.summary,
    createdAt: nowIso(),
  };
}

function seedData(apiBaseUrl: string): StoreData {
  const createdAt = nowIso();
  const cs161CourseId = 'course_cs161';
  const cs106lCourseId = 'course_cs106l';
  const cs161ProjectId = 'project_cs161_exam1';
  const instructorId = 'user_instructor';
  const studentId = 'user_demo';
  const milestone1Id = 'milestone_exam1_design';
  const milestone2Id = 'milestone_exam1_final';
  const cs106lProjects = listCs106lProjectDefinitions();
  const programSeed = buildDefaultProgramSeed();
  const programId = 'program_cs';
  const programVersionId = 'program_version_cs_2026';
  const trackIds = new Map<string, string>();
  const catalogCourseIds = new Map<string, string>();

  for (const track of programSeed.tracks) {
    trackIds.set(track.slug, `track_${track.slug}`);
  }
  for (const course of programSeed.catalogCourses) {
    catalogCourseIds.set(
      course.key,
      `catalog_${course.subjectCode.toLowerCase()}_${course.catalogNumber.toLowerCase()}`
    );
  }

  const programs: ProgramRecord[] = [
    {
      id: programId,
      slug: programSeed.program.slug,
      title: programSeed.program.title,
      code: programSeed.program.code,
      academicYear: programSeed.program.academicYear,
      totalUnitRequirement: programSeed.program.totalUnitRequirement,
      status: programSeed.program.status,
      activeVersionId: programVersionId,
      createdAt,
      updatedAt: createdAt,
    },
  ];

  const programVersions: ProgramVersionRecord[] = [
    {
      id: programVersionId,
      programId,
      versionLabel: programSeed.version.versionLabel,
      effectiveFrom: createdAt,
      effectiveTo: null,
      isActive: true,
      policyText: programSeed.version.policyText,
      trackSelectionMinYear: programSeed.version.trackSelectionMinYear,
      createdAt,
      updatedAt: createdAt,
    },
  ];

  const tracks: TrackRecord[] = programSeed.tracks.map((track) => ({
    id: trackIds.get(track.slug) || `track_${track.slug}`,
    programVersionId,
    slug: track.slug,
    title: track.title,
    description: track.description,
    selectionYearStart: track.selectionYearStart,
    createdAt,
    updatedAt: createdAt,
  }));

  const catalogCourses: CatalogCourseRecord[] = programSeed.catalogCourses.map((course) => ({
    id: catalogCourseIds.get(course.key) || `catalog_${course.key.toLowerCase()}`,
    programId,
    subjectCode: course.subjectCode,
    catalogNumber: course.catalogNumber,
    title: course.title,
    defaultUnits: course.defaultUnits,
    department: course.department,
    createdAt,
    updatedAt: createdAt,
  }));

  let requirementRuleCounter = 0;
  let requirementCourseCounter = 0;
  const requirementGroups: RequirementGroupRecord[] = [
    ...programSeed.sharedGroups.map((group, index) => ({
      id: `requirement_group_shared_${index + 1}`,
      programVersionId,
      trackId: null,
      title: group.title,
      category: group.category,
      minUnits: group.minUnits,
      minCourses: group.minCourses,
      notes: group.notes,
      sortOrder: group.sortOrder,
      noDoubleCount: group.noDoubleCount,
      rules: group.rules.map((rule) => {
        const requirementRuleId = `requirement_rule_${++requirementRuleCounter}`;
        return {
          id: requirementRuleId,
          requirementGroupId: `requirement_group_shared_${index + 1}`,
          ruleType: rule.ruleType,
          pickCount: rule.pickCount,
          note: rule.note,
          sortOrder: rule.sortOrder,
          courses: rule.courseKeys.map((courseKey) => ({
            id: `requirement_course_${++requirementCourseCounter}`,
            requirementRuleId,
            catalogCourseId:
              catalogCourseIds.get(courseKey) || `catalog_${courseKey.toLowerCase()}`,
          })),
        };
      }),
      createdAt,
      updatedAt: createdAt,
    })),
    ...programSeed.tracks.flatMap((track, trackIndex) =>
      track.groups.map((group, groupIndex) => {
        const groupId = `requirement_group_track_${trackIndex + 1}_${groupIndex + 1}`;
        const trackId = trackIds.get(track.slug) || `track_${track.slug}`;
        return {
          id: groupId,
          programVersionId,
          trackId,
          title: group.title,
          category: group.category,
          minUnits: group.minUnits,
          minCourses: group.minCourses,
          notes: group.notes,
          sortOrder: group.sortOrder,
          noDoubleCount: group.noDoubleCount,
          rules: group.rules.map((rule) => {
            const requirementRuleId = `requirement_rule_${++requirementRuleCounter}`;
            return {
              id: requirementRuleId,
              requirementGroupId: groupId,
              ruleType: rule.ruleType,
              pickCount: rule.pickCount,
              note: rule.note,
              sortOrder: rule.sortOrder,
              courses: rule.courseKeys.map((courseKey) => ({
                id: `requirement_course_${++requirementCourseCounter}`,
                requirementRuleId,
                catalogCourseId:
                  catalogCourseIds.get(courseKey) || `catalog_${courseKey.toLowerCase()}`,
              })),
            };
          }),
          createdAt,
          updatedAt: createdAt,
        };
      })
    ),
  ];

  const studentPrograms: StudentProgramRecord[] = [
    {
      id: 'student_program_demo',
      userId: studentId,
      programVersionId,
      selectedTrackId: null,
      status: 'enrolled',
      isLocked: false,
      createdAt,
      updatedAt: createdAt,
    },
  ];

  const programApprovals: ProgramApprovalRecord[] = [
    {
      id: 'approval_demo_advisor',
      studentProgramId: 'student_program_demo',
      stage: 'advisor',
      status: 'pending',
      reviewerUserId: null,
      notes: null,
      decidedAt: null,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: 'approval_demo_department',
      studentProgramId: 'student_program_demo',
      stage: 'department',
      status: 'pending',
      reviewerUserId: null,
      notes: null,
      decidedAt: null,
      createdAt,
      updatedAt: createdAt,
    },
  ];

  return {
    users: [
      {
        id: studentId,
        username: 'demo',
        email: 'demo@nibras.dev',
        githubLogin: 'demo-user',
        githubLinked: true,
        githubAppInstalled: true,
        systemRole: 'user',
        yearLevel: 1,
      },
      {
        id: instructorId,
        username: 'instructor',
        email: 'instructor@nibras.dev',
        githubLogin: 'nibras-instructor',
        githubLinked: true,
        githubAppInstalled: true,
        systemRole: 'admin',
        yearLevel: 1,
      },
    ],
    githubAccounts: [
      {
        userId: studentId,
        login: 'demo-user',
        installationId: '12345',
        userAccessToken: 'github-demo-token',
      },
      {
        userId: instructorId,
        login: 'nibras-instructor',
        installationId: '67890',
        userAccessToken: 'github-instructor-token',
      },
    ],
    courses: [
      {
        id: cs161CourseId,
        slug: 'cs161',
        title: 'CS 161: Foundations of Systems',
        termLabel: 'Spring 2026',
        courseCode: 'CS161',
        isActive: true,
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: cs106lCourseId,
        slug: CS106L_COURSE.slug,
        title: CS106L_COURSE.title,
        termLabel: CS106L_COURSE.termLabel,
        courseCode: CS106L_COURSE.courseCode,
        isActive: true,
        createdAt,
        updatedAt: createdAt,
      },
    ],
    programs,
    programVersions,
    tracks,
    catalogCourses,
    requirementGroups,
    studentPrograms,
    studentPlannedCourses: [],
    studentRequirementDecisions: [],
    petitions: [],
    programApprovals,
    programSheetSnapshots: [],
    projectTemplates: [],
    projectRoleApplications: [],
    teamFormationRuns: [],
    teams: [],
    courseMemberships: [
      {
        id: 'membership_demo_cs161',
        courseId: cs161CourseId,
        userId: studentId,
        role: 'student',
        level: 1,
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: 'membership_instructor_cs161',
        courseId: cs161CourseId,
        userId: instructorId,
        role: 'instructor',
        level: 1,
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: 'membership_demo_cs106l',
        courseId: cs106lCourseId,
        userId: studentId,
        role: 'student',
        level: 1,
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: 'membership_instructor_cs106l',
        courseId: cs106lCourseId,
        userId: instructorId,
        role: 'instructor',
        level: 1,
        createdAt,
        updatedAt: createdAt,
      },
    ],
    deviceCodes: [],
    sessions: [],
    webSessions: [],
    submissions: [],
    verificationLogs: [],
    projects: [
      {
        id: cs161ProjectId,
        projectKey: 'cs161/exam1',
        slug: 'cs161/exam1',
        courseId: cs161CourseId,
        templateId: null,
        title: 'Exam 1',
        description:
          'Design, implement, and defend your solution for the first project milestone sequence.',
        status: 'published',
        level: 1,
        deliveryMode: 'individual',
        teamFormationStatus: 'not_started',
        applicationOpenAt: null,
        applicationCloseAt: null,
        teamLockAt: null,
        teamSize: null,
        teamRoles: [],
        teamName: null,
        assignedRoleLabel: null,
        team: [],
        rubric: [
          { criterion: 'Correctness', maxScore: 50 },
          { criterion: 'Clarity', maxScore: 30 },
          { criterion: 'Testing', maxScore: 20 },
        ],
        resources: [
          { label: 'Task brief', url: 'https://example.com/task-brief' },
          { label: 'Reference notes', url: 'https://example.com/reference-notes' },
        ],
        instructorUserId: instructorId,
        manifest: defaultManifest(apiBaseUrl),
        task: defaultTask(apiBaseUrl),
        starter: { kind: 'none' },
        repoByUserId: {},
        createdAt,
        updatedAt: createdAt,
      },
      ...cs106lProjects.map((project) => ({
        id: `project_${project.projectKey.replace(/\//g, '_')}`,
        projectKey: project.projectKey,
        slug: project.projectKey,
        courseId: cs106lCourseId,
        templateId: null,
        title: project.title,
        description: project.description,
        status: 'published' as const,
        level: 1,
        deliveryMode: 'individual' as const,
        teamFormationStatus: 'not_started' as const,
        applicationOpenAt: null,
        applicationCloseAt: null,
        teamLockAt: null,
        teamSize: null,
        teamRoles: [],
        teamName: null,
        assignedRoleLabel: null,
        team: [],
        rubric: [],
        resources: [],
        instructorUserId: instructorId,
        manifest: buildCs106lManifest(apiBaseUrl, project.projectKey),
        task: readCs106lTaskText(project.projectKey),
        starter: buildCs106lStarter(project.projectKey),
        repoByUserId: {},
        createdAt,
        updatedAt: createdAt,
      })),
    ],
    milestones: [
      {
        id: milestone1Id,
        projectId: cs161ProjectId,
        title: 'Design Review',
        description: 'Submit an initial design, edge cases, and implementation plan.',
        order: 1,
        dueAt: '2026-12-31T17:00:00.000Z',
        isFinal: false,
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: milestone2Id,
        projectId: cs161ProjectId,
        title: 'Final Project Submission',
        description: 'Submit the final repository state and project write-up.',
        order: 2,
        dueAt: '2027-01-15T17:00:00.000Z',
        isFinal: true,
        createdAt,
        updatedAt: createdAt,
      },
      ...cs106lProjects.map((project) => ({
        id: `milestone_${project.projectKey.replace(/\//g, '_')}_initial`,
        projectId: `project_${project.projectKey.replace(/\//g, '_')}`,
        title: 'Initial Submission',
        description: project.milestoneDescription,
        order: 1,
        dueAt: null,
        isFinal: true,
        createdAt,
        updatedAt: createdAt,
      })),
    ],
    reviews: [],
    githubDeliveries: [],
    courseInvites: [],
    activity: [
      makeActivityRecord({
        actorUserId: instructorId,
        courseId: cs161CourseId,
        projectId: cs161ProjectId,
        milestoneId: null,
        submissionId: null,
        action: 'project.published',
        summary: 'Exam 1 is now published.',
      }),
      ...cs106lProjects.map((project) =>
        makeActivityRecord({
          actorUserId: instructorId,
          courseId: cs106lCourseId,
          projectId: `project_${project.projectKey.replace(/\//g, '_')}`,
          milestoneId: null,
          submissionId: null,
          action: 'project.published',
          summary: `${project.title} is now published.`,
        })
      ),
    ],
  };
}

export class FileStore implements AppStore {
  private readonly storePath: string;

  constructor(storePath: string) {
    this.storePath = storePath;
  }

  private ensureStore(apiBaseUrl: string): StoreData {
    try {
      const raw = fs.readFileSync(this.storePath, 'utf8');
      const parsed = JSON.parse(raw) as StoreData;
      if (!parsed.githubAccounts) {
        parsed.githubAccounts = [];
      }
      if (!parsed.programs) {
        parsed.programs = [];
      }
      if (!parsed.programVersions) {
        parsed.programVersions = [];
      }
      if (!parsed.tracks) {
        parsed.tracks = [];
      }
      if (!parsed.catalogCourses) {
        parsed.catalogCourses = [];
      }
      if (!parsed.requirementGroups) {
        parsed.requirementGroups = [];
      }
      if (!parsed.studentPrograms) {
        parsed.studentPrograms = [];
      }
      if (!parsed.studentPlannedCourses) {
        parsed.studentPlannedCourses = [];
      }
      if (!parsed.studentRequirementDecisions) {
        parsed.studentRequirementDecisions = [];
      }
      if (!parsed.petitions) {
        parsed.petitions = [];
      }
      if (!parsed.programApprovals) {
        parsed.programApprovals = [];
      }
      if (!parsed.programSheetSnapshots) {
        parsed.programSheetSnapshots = [];
      }
      if (!parsed.projectTemplates) {
        parsed.projectTemplates = [];
      }
      if (!parsed.projectRoleApplications) {
        parsed.projectRoleApplications = [];
      }
      if (!parsed.teamFormationRuns) {
        parsed.teamFormationRuns = [];
      }
      if (!parsed.teams) {
        parsed.teams = [];
      }
      return parsed;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw err;
      }
      const initial = seedData(apiBaseUrl);
      this.write(initial);
      return initial;
    }
  }

  read(apiBaseUrl: string): StoreData {
    return this.ensureStore(apiBaseUrl);
  }

  write(data: StoreData): void {
    fs.mkdirSync(path.dirname(this.storePath), { recursive: true });
    fs.writeFileSync(this.storePath, `${JSON.stringify(data, null, 2)}\n`);
  }

  private touchSubmissionLifecycle(
    data: StoreData,
    submission: SubmissionRecord
  ): SubmissionRecord {
    const ageMs = Date.now() - new Date(submission.createdAt).getTime();
    if (submission.milestoneId) {
      return submission;
    }
    if (submission.status === 'queued' && ageMs > 1200) {
      submission.status = 'running';
      submission.summary = 'Verification is running.';
      submission.updatedAt = nowIso();
      this.write(data);
    }
    if (submission.status === 'running' && ageMs > 2600) {
      submission.status =
        submission.localTestExitCode && submission.localTestExitCode !== 0 ? 'failed' : 'passed';
      submission.summary =
        submission.status === 'passed'
          ? 'Verification passed.'
          : 'Verification failed because the reported local tests failed.';
      submission.updatedAt = nowIso();
      this.write(data);
    }
    return submission;
  }

  private findProgramBundle(
    data: StoreData,
    studentProgramId: string
  ): {
    studentProgram: StudentProgramRecord;
    user: UserRecord;
    program: ProgramRecord;
    version: ProgramVersionRecord;
    tracks: TrackRecord[];
    selectedTrack: TrackRecord | null;
    catalogCourses: CatalogCourseRecord[];
    requirementGroups: RequirementGroupRecord[];
    plannedCourses: StudentPlannedCourseRecord[];
    petitions: PetitionRecord[];
    approvals: ProgramApprovalRecord[];
    decisions: StudentRequirementDecisionRecord[];
    latestSheetGeneratedAt: string | null;
  } | null {
    const studentProgram = (data.studentPrograms || []).find(
      (entry) => entry.id === studentProgramId
    );
    if (!studentProgram) return null;
    const user = data.users.find((entry) => entry.id === studentProgram.userId);
    const version = (data.programVersions || []).find(
      (entry) => entry.id === studentProgram.programVersionId
    );
    if (!user || !version) return null;
    const program = (data.programs || []).find((entry) => entry.id === version.programId);
    if (!program) return null;
    const tracks = (data.tracks || []).filter((entry) => entry.programVersionId === version.id);
    const selectedTrack =
      tracks.find((entry) => entry.id === studentProgram.selectedTrackId) || null;
    const catalogCourses = (data.catalogCourses || []).filter(
      (entry) => entry.programId === program.id
    );
    const requirementGroups = (data.requirementGroups || []).filter(
      (entry) => entry.programVersionId === version.id
    );
    const plannedCourses = (data.studentPlannedCourses || []).filter(
      (entry) => entry.studentProgramId === studentProgram.id
    );
    const petitions = (data.petitions || []).filter(
      (entry) => entry.studentProgramId === studentProgram.id
    );
    const approvals = (data.programApprovals || []).filter(
      (entry) => entry.studentProgramId === studentProgram.id
    );
    const decisions = (data.studentRequirementDecisions || []).filter(
      (entry) => entry.studentProgramId === studentProgram.id
    );
    const snapshots = (data.programSheetSnapshots || [])
      .filter((entry) => entry.studentProgramId === studentProgram.id)
      .sort((left, right) => right.generatedAt.localeCompare(left.generatedAt));

    return {
      studentProgram,
      user,
      program,
      version,
      tracks,
      selectedTrack,
      catalogCourses,
      requirementGroups,
      plannedCourses,
      petitions,
      approvals,
      decisions,
      latestSheetGeneratedAt: snapshots[0]?.generatedAt ?? null,
    };
  }

  private syncProgramDecisions(
    data: StoreData,
    studentProgramId: string
  ): StudentProgramPlanRecord | null {
    const bundle = this.findProgramBundle(data, studentProgramId);
    if (!bundle) return null;
    const plan = buildStudentProgramPlan(bundle);
    data.studentRequirementDecisions = [
      ...(data.studentRequirementDecisions || []).filter(
        (entry) => entry.studentProgramId !== studentProgramId
      ),
      ...plan.decisions,
    ];
    this.write(data);
    return plan;
  }

  private getActiveProgramVersion(data: StoreData, programId: string): ProgramVersionRecord | null {
    const versions = (data.programVersions || []).filter((entry) => entry.programId === programId);
    return versions.find((entry) => entry.isActive) || versions[0] || null;
  }

  async createDeviceCode(apiBaseUrl: string): Promise<DeviceCodeRecord> {
    const data = this.read(apiBaseUrl);
    const record: DeviceCodeRecord = {
      deviceCode: randomUUID(),
      userCode: `NB-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      intervalSeconds: 2,
      userId: null,
      status: 'pending',
    };
    data.deviceCodes.push(record);
    this.write(data);
    return record;
  }

  async authorizeDeviceCode(
    apiBaseUrl: string,
    userCode: string,
    userId?: string
  ): Promise<DeviceCodeRecord | null> {
    const data = this.read(apiBaseUrl);
    const record = data.deviceCodes.find((entry) => entry.userCode === userCode);
    if (!record) {
      return null;
    }
    record.status = 'authorized';
    record.userId = userId ?? 'user_demo';
    this.write(data);
    return record;
  }

  async pollDeviceCode(
    apiBaseUrl: string,
    deviceCode: string
  ): Promise<{ record: DeviceCodeRecord | null; session: SessionRecord | null }> {
    const data = this.read(apiBaseUrl);
    const record = data.deviceCodes.find((entry) => entry.deviceCode === deviceCode);
    if (!record) {
      return { record: null, session: null };
    }
    if (record.status !== 'authorized' || !record.userId) {
      return { record, session: null };
    }
    const existing = data.sessions.find((session) => session.userId === record.userId);
    if (existing) {
      return { record, session: existing };
    }
    const session: SessionRecord = {
      accessToken: `access_${randomUUID()}`,
      refreshToken: `refresh_${randomUUID()}`,
      userId: record.userId,
      createdAt: nowIso(),
    };
    data.sessions.push(session);
    this.write(data);
    return { record, session };
  }

  async getUserByToken(apiBaseUrl: string, accessToken: string): Promise<UserRecord | null> {
    const data = this.read(apiBaseUrl);
    const session = data.sessions.find((entry) => entry.accessToken === accessToken);
    if (!session) {
      return null;
    }
    return data.users.find((entry) => entry.id === session.userId) || null;
  }

  async upsertGitHubUserSession(args: {
    githubUserId: string;
    login: string;
    email: string | null;
    accessToken: string;
    refreshToken?: string;
    accessTokenExpiresIn?: number;
    refreshTokenExpiresIn?: number;
  }): Promise<{ user: UserRecord; session: SessionRecord }> {
    const data = this.read('http://127.0.0.1');
    let user = data.users.find((entry) => entry.githubLogin === args.login) || null;
    if (!user) {
      user = {
        id: `user_${args.login}`,
        username: args.login,
        email: args.email || `${args.login}@users.noreply.github.com`,
        githubLogin: args.login,
        githubLinked: true,
        githubAppInstalled: false,
        systemRole: 'user',
        yearLevel: 1,
      };
      data.users.push(user);
    } else {
      user.githubLogin = args.login;
      user.githubLinked = true;
      if (args.email) {
        user.email = args.email;
      }
    }

    const existingAccount = data.githubAccounts.find((entry) => entry.userId === user.id);
    if (existingAccount) {
      existingAccount.login = args.login;
      existingAccount.userAccessToken = args.accessToken;
    } else {
      data.githubAccounts.push({
        userId: user.id,
        login: args.login,
        installationId: null,
        userAccessToken: args.accessToken,
      });
    }

    const session: SessionRecord = {
      accessToken: args.accessToken,
      refreshToken: args.refreshToken || `refresh_${randomUUID()}`,
      userId: user.id,
      createdAt: nowIso(),
    };
    data.sessions.push(session);
    this.write(data);
    return { user, session };
  }

  async getGithubAccountForUser(userId: string): Promise<{
    login: string;
    installationId: string | null;
    userAccessToken: string | null;
  } | null> {
    const data = this.read('http://127.0.0.1');
    const account = data.githubAccounts.find((entry) => entry.userId === userId);
    if (!account) {
      return null;
    }
    return {
      login: account.login,
      installationId: account.installationId,
      userAccessToken: account.userAccessToken,
    };
  }

  async linkGitHubInstallation(userId: string, installationId: string): Promise<UserRecord> {
    const data = this.read('http://127.0.0.1');
    const user = data.users.find((entry) => entry.id === userId);
    if (!user) {
      throw new Error('User not found.');
    }
    const account = data.githubAccounts.find((entry) => entry.userId === userId);
    if (account) {
      account.installationId = installationId;
    } else {
      data.githubAccounts.push({
        userId,
        login: user.githubLogin,
        installationId,
        userAccessToken: null,
      });
    }
    user.githubAppInstalled = true;
    this.write(data);
    return user;
  }

  async listUsers(apiBaseUrl: string): Promise<UserRecord[]> {
    const data = this.read(apiBaseUrl);
    return data.users;
  }

  async setUserSystemRole(
    apiBaseUrl: string,
    userId: string,
    role: SystemRole
  ): Promise<UserRecord | null> {
    const data = this.read(apiBaseUrl);
    const user = data.users.find((u) => u.id === userId);
    if (!user) return null;
    user.systemRole = role;
    this.write(data);
    return user;
  }

  async deleteUserAccount(apiBaseUrl: string, userId: string): Promise<void> {
    const data = this.read(apiBaseUrl);
    // Remove sessions
    data.sessions = data.sessions.filter((s) => s.userId !== userId);
    // Remove web sessions
    data.webSessions = data.webSessions.filter((s) => s.userId !== userId);
    // Anonymise submissions (keep records for audit, strip identity)
    data.submissions = data.submissions.map((s) =>
      s.userId === userId ? { ...s, userId: `deleted_${userId}` } : s
    );
    // Remove course memberships
    data.courseMemberships = data.courseMemberships.filter((m) => m.userId !== userId);
    // Remove the user record
    data.users = data.users.filter((u) => u.id !== userId);
    this.write(data);
  }

  async listUserSubmissions(
    _apiBaseUrl: string,
    userId: string,
    opts?: PaginationOpts
  ): Promise<SubmissionRecord[]> {
    const data = this.read(_apiBaseUrl);
    let results = data.submissions
      .filter((s) => s.userId === userId)
      .sort((left, right) =>
        (right.submittedAt || right.createdAt).localeCompare(left.submittedAt || left.createdAt)
      );
    if (opts?.offset) results = results.slice(opts.offset);
    if (opts?.limit) results = results.slice(0, opts.limit);
    return results;
  }

  async countUserSubmissions(_apiBaseUrl: string, userId: string): Promise<number> {
    const data = this.read(_apiBaseUrl);
    return data.submissions.filter((s) => s.userId === userId).length;
  }

  async exportCourseGrades(
    _apiBaseUrl: string,
    _courseId: string
  ): Promise<
    Array<{
      githubLogin: string;
      username: string;
      milestoneTitle: string;
      projectKey: string;
      status: string;
      submittedAt: string | null;
      commitSha: string;
    }>
  > {
    return [];
  }

  async refreshCliSession(apiBaseUrl: string, refreshToken: string): Promise<SessionRecord | null> {
    const data = this.read(apiBaseUrl);
    const session = data.sessions.find((entry) => entry.refreshToken === refreshToken);
    if (!session) {
      return null;
    }
    data.sessions = data.sessions.filter((entry) => entry.refreshToken !== refreshToken);
    const next: SessionRecord = {
      accessToken: `access_${randomUUID()}`,
      refreshToken: `refresh_${randomUUID()}`,
      userId: session.userId,
      createdAt: nowIso(),
    };
    data.sessions.push(next);
    this.write(data);
    return next;
  }

  async deleteSession(apiBaseUrl: string, accessToken: string): Promise<void> {
    const data = this.read(apiBaseUrl);
    data.sessions = data.sessions.filter((entry) => entry.accessToken !== accessToken);
    this.write(data);
  }

  async createWebSession(apiBaseUrl: string, userId: string): Promise<WebSessionRecord> {
    const data = this.read(apiBaseUrl);
    const session: WebSessionRecord = {
      sessionToken: `web_${randomUUID()}`,
      userId,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      expiresAt: futureIso(30),
      revokedAt: null,
    };
    data.webSessions.push(session);
    this.write(data);
    return session;
  }

  async getUserByWebSession(apiBaseUrl: string, sessionToken: string): Promise<UserRecord | null> {
    const data = this.read(apiBaseUrl);
    const session = data.webSessions.find((entry) => entry.sessionToken === sessionToken);
    if (!session) {
      return null;
    }
    if (session.revokedAt || new Date(session.expiresAt).getTime() <= Date.now()) {
      return null;
    }
    return data.users.find((entry) => entry.id === session.userId) || null;
  }

  async deleteWebSession(apiBaseUrl: string, sessionToken: string): Promise<void> {
    const data = this.read(apiBaseUrl);
    const session = data.webSessions.find((entry) => entry.sessionToken === sessionToken);
    if (!session) {
      return;
    }
    session.revokedAt = nowIso();
    session.updatedAt = nowIso();
    this.write(data);
  }

  async getProject(apiBaseUrl: string, projectKey: string): Promise<ProjectRecord | null> {
    const data = this.read(apiBaseUrl);
    return data.projects.find((entry) => entry.projectKey === projectKey) || null;
  }

  async provisionProjectRepo(
    apiBaseUrl: string,
    projectKey: string,
    userId: string
  ): Promise<RepoRecord> {
    const data = this.read(apiBaseUrl);
    const project = data.projects.find((entry) => entry.projectKey === projectKey);
    const user = data.users.find((entry) => entry.id === userId);
    if (!project || !user) {
      throw new Error('Project or user not found.');
    }
    const existing = project.repoByUserId[userId];
    if (existing) {
      return existing;
    }
    const repo: RepoRecord = {
      owner: user.githubLogin,
      name: `nibras-${projectKey.replace('/', '-')}`,
      cloneUrl: null,
      defaultBranch: project.manifest.defaultBranch,
      visibility: 'private',
    };
    project.repoByUserId[userId] = repo;
    this.write(data);
    return repo;
  }

  async createOrReuseSubmission(
    apiBaseUrl: string,
    payload: {
      userId: string;
      projectKey: string;
      commitSha: string;
      repoUrl: string;
      branch: string;
    }
  ): Promise<SubmissionRecord> {
    const data = this.read(apiBaseUrl);
    const project = data.projects.find((entry) => entry.projectKey === payload.projectKey);
    if (!project) {
      throw new Error('Project not found.');
    }
    const existing = data.submissions.find(
      (entry) =>
        entry.userId === payload.userId &&
        entry.projectKey === payload.projectKey &&
        entry.commitSha === payload.commitSha
    );
    if (existing) {
      return existing;
    }
    const record: SubmissionRecord = {
      id: randomUUID(),
      userId: payload.userId,
      submittedByUserId: payload.userId,
      projectId: project.id,
      projectKey: payload.projectKey,
      milestoneId: null,
      teamId: null,
      teamName: null,
      teamMemberUserIds: [],
      commitSha: payload.commitSha,
      repoUrl: payload.repoUrl,
      branch: payload.branch,
      status: 'queued',
      summary: 'Submission queued for verification.',
      submissionType: 'github',
      submissionValue: payload.repoUrl,
      notes: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      submittedAt: nowIso(),
      localTestExitCode: null,
    };
    data.submissions.push(record);
    data.verificationLogs.push({
      id: randomUUID(),
      submissionId: record.id,
      attempt: 0,
      status: 'queued',
      log: 'Queued',
      startedAt: null,
      finishedAt: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    this.write(data);
    return record;
  }

  async updateLocalTestResult(
    apiBaseUrl: string,
    submissionId: string,
    requesterUserId: string,
    exitCode: number,
    summary: string
  ): Promise<SubmissionRecord | null> {
    const data = this.read(apiBaseUrl);
    const submission = data.submissions.find(
      (entry) => entry.id === submissionId && entry.userId === requesterUserId
    );
    if (!submission) {
      return null;
    }
    submission.localTestExitCode = exitCode;
    submission.summary = summary;
    submission.updatedAt = nowIso();
    this.write(data);
    return submission;
  }

  async getSubmission(
    apiBaseUrl: string,
    submissionId: string,
    requesterUserId: string
  ): Promise<SubmissionRecord | null> {
    const data = this.read(apiBaseUrl);
    const submission = data.submissions.find(
      (entry) => entry.id === submissionId && entry.userId === requesterUserId
    );
    if (!submission) {
      return null;
    }
    return this.touchSubmissionLifecycle(data, submission);
  }

  async getSubmissionForAdmin(
    apiBaseUrl: string,
    submissionId: string
  ): Promise<SubmissionRecord | null> {
    const data = this.read(apiBaseUrl);
    const submission = data.submissions.find((entry) => entry.id === submissionId);
    if (!submission) {
      return null;
    }
    return this.touchSubmissionLifecycle(data, submission);
  }

  async overrideSubmissionStatus(
    apiBaseUrl: string,
    submissionId: string,
    status: SubmissionWorkflowStatus,
    summary: string,
    actorUserId: string
  ): Promise<SubmissionRecord | null> {
    const data = this.read(apiBaseUrl);
    const submission = data.submissions.find((entry) => entry.id === submissionId);
    if (!submission) {
      return null;
    }
    const previousStatus = submission.status;
    submission.status = status;
    submission.summary = summary;
    submission.updatedAt = nowIso();
    data.verificationLogs.push({
      id: randomUUID(),
      submissionId,
      attempt: data.verificationLogs.filter((entry) => entry.submissionId === submissionId).length,
      status,
      log: `Manual override by ${actorUserId}: ${summary}`,
      startedAt: nowIso(),
      finishedAt: nowIso(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    data.activity.unshift(
      makeActivityRecord({
        actorUserId,
        courseId:
          data.projects.find((entry) => entry.id === submission.projectId)?.courseId || null,
        projectId: submission.projectId,
        milestoneId: submission.milestoneId,
        submissionId,
        action: 'submission.overridden',
        summary: `Submission status changed from ${previousStatus} to ${status}.`,
      })
    );
    this.write(data);
    return submission;
  }

  async listSubmissionVerificationLogs(
    apiBaseUrl: string,
    submissionId: string
  ): Promise<VerificationLogRecord[]> {
    return this.read(apiBaseUrl)
      .verificationLogs.filter((entry) => entry.submissionId === submissionId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async listCourseMemberships(
    apiBaseUrl: string,
    userId: string
  ): Promise<CourseMembershipRecord[]> {
    const data = this.read(apiBaseUrl);
    return data.courseMemberships.filter((entry) => entry.userId === userId);
  }

  async listTrackingCourses(
    apiBaseUrl: string,
    userId: string,
    opts?: PaginationOpts
  ): Promise<CourseRecord[]> {
    const data = this.read(apiBaseUrl);
    const user = data.users.find((entry) => entry.id === userId);
    let results: CourseRecord[];
    if (user?.systemRole === 'admin') {
      results = data.courses.filter((entry) => entry.isActive);
    } else {
      const allowedCourseIds = new Set(
        data.courseMemberships
          .filter((entry) => entry.userId === userId)
          .map((entry) => entry.courseId)
      );
      const memberCourses = data.courses.filter(
        (entry) => entry.isActive && allowedCourseIds.has(entry.id)
      );
      // Fall back to all active courses when user has no memberships yet
      // (e.g. brand-new sign-up) — ensures CS161 Exam 1 & 2 are always visible.
      results =
        memberCourses.length > 0 ? memberCourses : data.courses.filter((entry) => entry.isActive);
    }
    const offset = opts?.offset ?? 0;
    return opts?.limit !== undefined ? results.slice(offset, offset + opts.limit) : results;
  }

  async countTrackingCourses(apiBaseUrl: string, userId: string): Promise<number> {
    return (await this.listTrackingCourses(apiBaseUrl, userId)).length;
  }

  async listCourseMembersForInstructor(
    apiBaseUrl: string,
    courseId: string
  ): Promise<Array<CourseMembershipRecord & { username: string; githubLogin: string }>> {
    const data = this.read(apiBaseUrl);
    return data.courseMemberships
      .filter((m) => m.courseId === courseId)
      .map((m) => {
        const user = data.users.find((u) => u.id === m.userId);
        return {
          ...m,
          username: user?.username || m.userId,
          githubLogin: user?.githubLogin || m.userId,
        };
      });
  }

  async addCourseMember(
    apiBaseUrl: string,
    courseId: string,
    githubLogin: string,
    role: MembershipRole
  ): Promise<CourseMembershipRecord & { username: string; githubLogin: string }> {
    const data = this.read(apiBaseUrl);
    const user = data.users.find((u) => u.githubLogin === githubLogin);
    if (!user) {
      throw Object.assign(new Error(`No user found with GitHub login "${githubLogin}".`), {
        statusCode: 404,
      });
    }
    const existing = data.courseMemberships.find(
      (m) => m.courseId === courseId && m.userId === user.id
    );
    if (existing) {
      throw Object.assign(new Error('User is already a member of this course.'), {
        statusCode: 409,
      });
    }
    const membership: CourseMembershipRecord = {
      id: randomUUID(),
      courseId,
      userId: user.id,
      role,
      level: 1,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    data.courseMemberships.push(membership);
    this.write(data);
    return { ...membership, username: user.username, githubLogin: user.githubLogin };
  }

  async removeCourseMember(apiBaseUrl: string, courseId: string, userId: string): Promise<void> {
    const data = this.read(apiBaseUrl);
    data.courseMemberships = data.courseMemberships.filter(
      (m) => !(m.courseId === courseId && m.userId === userId)
    );
    this.write(data);
  }

  async updateStudentLevel(
    apiBaseUrl: string,
    courseId: string,
    userId: string,
    level: number
  ): Promise<CourseMembershipRecord | null> {
    await this.syncStudentYearGlobal(apiBaseUrl, userId, level);
    const data = this.read(apiBaseUrl);
    const membership = data.courseMemberships.find(
      (m) => m.courseId === courseId && m.userId === userId && m.role === 'student'
    );
    return membership ? { ...membership } : null;
  }

  async syncStudentYearGlobal(
    apiBaseUrl: string,
    userId: string,
    yearLevel: number
  ): Promise<void> {
    const data = this.read(apiBaseUrl);
    const user = data.users.find((u) => u.id === userId);
    if (!user) return;
    user.yearLevel = yearLevel;
    // Sync all student memberships to the new year level
    for (const m of data.courseMemberships) {
      if (m.userId === userId && m.role === 'student') {
        m.level = yearLevel;
        m.updatedAt = nowIso();
      }
    }
    this.write(data);
  }

  async listStudentsWithYearLevel(
    apiBaseUrl: string
  ): Promise<Array<{ userId: string; username: string; githubLogin: string; yearLevel: number }>> {
    const data = this.read(apiBaseUrl);
    const studentUserIds = new Set(
      data.courseMemberships.filter((m) => m.role === 'student').map((m) => m.userId)
    );
    return data.users
      .filter((u) => studentUserIds.has(u.id))
      .map((u) => ({
        userId: u.id,
        username: u.username,
        githubLogin: u.githubLogin,
        yearLevel: u.yearLevel ?? 1,
      }));
  }

  async createNotification(
    apiBaseUrl: string,
    userId: string,
    notification: { type: string; title: string; body: string; link?: string }
  ): Promise<void> {
    const data = this.read(apiBaseUrl);
    if (!data.notifications) data.notifications = [];
    data.notifications.push({
      id: randomUUID(),
      userId,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      link: notification.link ?? null,
      read: false,
      createdAt: nowIso(),
    });
    this.write(data);
  }

  async listNotifications(apiBaseUrl: string, userId: string): Promise<NotificationRecord[]> {
    const data = this.read(apiBaseUrl);
    return (data.notifications ?? [])
      .filter((n) => n.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 50);
  }

  async countUnreadNotifications(apiBaseUrl: string, userId: string): Promise<number> {
    const data = this.read(apiBaseUrl);
    return (data.notifications ?? []).filter((n) => n.userId === userId && !n.read).length;
  }

  async markAllNotificationsRead(apiBaseUrl: string, userId: string): Promise<void> {
    const data = this.read(apiBaseUrl);
    for (const n of data.notifications ?? []) {
      if (n.userId === userId) n.read = true;
    }
    this.write(data);
  }

  async createCourseInvite(
    apiBaseUrl: string,
    courseId: string,
    role: MembershipRole,
    opts?: { maxUses?: number; expiresAt?: string | null }
  ): Promise<CourseInviteRecord> {
    const data = this.read(apiBaseUrl);
    if (!data.courseInvites) data.courseInvites = [];
    const code = Math.random().toString(36).slice(2, 10).toUpperCase();
    const invite: CourseInviteRecord = {
      id: randomUUID(),
      courseId,
      code,
      role,
      maxUses: opts?.maxUses ?? 0,
      useCount: 0,
      expiresAt: opts?.expiresAt ?? null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    data.courseInvites.push(invite);
    this.write(data);
    return invite;
  }

  async getCourseInviteByCode(
    apiBaseUrl: string,
    code: string
  ): Promise<(CourseInviteRecord & { course: CourseRecord }) | null> {
    const data = this.read(apiBaseUrl);
    if (!data.courseInvites) return null;
    const invite = data.courseInvites.find((inv) => inv.code === code);
    if (!invite) return null;
    const course = data.courses.find((c) => c.id === invite.courseId);
    if (!course) return null;
    return { ...invite, course };
  }

  async redeemCourseInvite(
    apiBaseUrl: string,
    code: string,
    userId: string
  ): Promise<CourseMembershipRecord> {
    const data = this.read(apiBaseUrl);
    if (!data.courseInvites) data.courseInvites = [];
    const invite = data.courseInvites.find((inv) => inv.code === code);
    if (!invite) {
      throw Object.assign(new Error('Invalid or expired invite code.'), { statusCode: 404 });
    }
    if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
      throw Object.assign(new Error('This invite link has expired.'), { statusCode: 410 });
    }
    if (invite.maxUses > 0 && invite.useCount >= invite.maxUses) {
      throw Object.assign(new Error('This invite link has reached its maximum uses.'), {
        statusCode: 410,
      });
    }
    const existing = data.courseMemberships.find(
      (m) => m.courseId === invite.courseId && m.userId === userId
    );
    if (existing) {
      return existing;
    }
    const membership: CourseMembershipRecord = {
      id: randomUUID(),
      courseId: invite.courseId,
      userId,
      role: invite.role,
      level: 1,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    data.courseMemberships.push(membership);
    invite.useCount += 1;
    invite.updatedAt = nowIso();
    this.write(data);
    return membership;
  }

  async createTrackingCourse(
    apiBaseUrl: string,
    userId: string,
    payload: { slug: string; title: string; termLabel: string; courseCode: string }
  ): Promise<CourseRecord> {
    const data = this.read(apiBaseUrl);
    const course: CourseRecord = {
      id: randomUUID(),
      slug: payload.slug,
      title: payload.title,
      termLabel: payload.termLabel,
      courseCode: payload.courseCode,
      isActive: true,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    const membership: CourseMembershipRecord = {
      id: randomUUID(),
      courseId: course.id,
      userId,
      role: 'instructor',
      level: 1,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    data.courses.push(course);
    data.courseMemberships.push(membership);
    this.write(data);
    return course;
  }

  async deleteTrackingCourse(apiBaseUrl: string, courseId: string): Promise<boolean> {
    const data = this.read(apiBaseUrl);
    const idx = data.courses.findIndex((c) => c.id === courseId);
    if (idx === -1) return false;
    data.courses.splice(idx, 1);
    data.courseMemberships = data.courseMemberships.filter((m) => m.courseId !== courseId);
    this.write(data);
    return true;
  }

  async listPrograms(apiBaseUrl: string): Promise<ProgramRecord[]> {
    const data = this.read(apiBaseUrl);
    return [...(data.programs || [])].sort((left, right) =>
      left.createdAt.localeCompare(right.createdAt)
    );
  }

  async createProgram(
    apiBaseUrl: string,
    _userId: string,
    payload: {
      slug: string;
      title: string;
      code: string;
      academicYear: string;
      totalUnitRequirement: number;
      status: ProgramStatus;
    }
  ): Promise<ProgramRecord> {
    const data = this.read(apiBaseUrl);
    const program: ProgramRecord = {
      id: randomUUID(),
      slug: payload.slug,
      title: payload.title,
      code: payload.code,
      academicYear: payload.academicYear,
      totalUnitRequirement: payload.totalUnitRequirement,
      status: payload.status,
      activeVersionId: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    data.programs = [...(data.programs || []), program];
    this.write(data);
    return program;
  }

  async createProgramVersion(
    apiBaseUrl: string,
    _userId: string,
    programId: string,
    payload: {
      versionLabel: string;
      effectiveFrom: string | null;
      effectiveTo: string | null;
      isActive: boolean;
      policyText: string;
      trackSelectionMinYear: number;
    }
  ): Promise<ProgramVersionRecord> {
    const data = this.read(apiBaseUrl);
    const version: ProgramVersionRecord = {
      id: randomUUID(),
      programId,
      versionLabel: payload.versionLabel,
      effectiveFrom: payload.effectiveFrom,
      effectiveTo: payload.effectiveTo,
      isActive: payload.isActive,
      policyText: payload.policyText,
      trackSelectionMinYear: payload.trackSelectionMinYear,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    data.programVersions = [...(data.programVersions || []), version];
    if (payload.isActive) {
      data.programVersions = data.programVersions.map((entry) =>
        entry.programId === programId ? { ...entry, isActive: entry.id === version.id } : entry
      );
      const program = (data.programs || []).find((entry) => entry.id === programId);
      if (program) {
        program.activeVersionId = version.id;
        program.updatedAt = nowIso();
      }
    }
    this.write(data);
    return version;
  }

  async getProgramVersionDetail(
    apiBaseUrl: string,
    programId: string,
    versionId: string
  ): Promise<ProgramVersionDetailRecord | null> {
    const data = this.read(apiBaseUrl);
    const program = (data.programs || []).find((entry) => entry.id === programId);
    const version = (data.programVersions || []).find(
      (entry) => entry.id === versionId && entry.programId === programId
    );
    if (!program || !version) return null;
    return {
      program,
      version,
      tracks: (data.tracks || []).filter((entry) => entry.programVersionId === versionId),
      catalogCourses: (data.catalogCourses || []).filter((entry) => entry.programId === programId),
      requirementGroups: (data.requirementGroups || []).filter(
        (entry) => entry.programVersionId === versionId
      ),
    };
  }

  async createCatalogCourse(
    apiBaseUrl: string,
    _userId: string,
    programId: string,
    payload: {
      subjectCode: string;
      catalogNumber: string;
      title: string;
      defaultUnits: number;
      department: string;
    }
  ): Promise<CatalogCourseRecord> {
    const data = this.read(apiBaseUrl);
    const course: CatalogCourseRecord = {
      id: randomUUID(),
      programId,
      subjectCode: payload.subjectCode,
      catalogNumber: payload.catalogNumber,
      title: payload.title,
      defaultUnits: payload.defaultUnits,
      department: payload.department,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    data.catalogCourses = [...(data.catalogCourses || []), course];
    this.write(data);
    return course;
  }

  async createRequirementGroup(
    apiBaseUrl: string,
    _userId: string,
    _programId: string,
    payload: {
      programVersionId: string;
      trackId: string | null;
      title: string;
      category: RequirementGroupCategory;
      minUnits: number;
      minCourses: number;
      notes: string;
      sortOrder: number;
      noDoubleCount: boolean;
      rules: Array<{
        ruleType: RequirementRuleType;
        pickCount: number | null;
        note: string;
        sortOrder: number;
        courses: Array<{ catalogCourseId: string }>;
      }>;
    }
  ): Promise<RequirementGroupRecord> {
    const data = this.read(apiBaseUrl);
    const groupId = randomUUID();
    const group: RequirementGroupRecord = {
      id: groupId,
      programVersionId: payload.programVersionId,
      trackId: payload.trackId,
      title: payload.title,
      category: payload.category,
      minUnits: payload.minUnits,
      minCourses: payload.minCourses,
      notes: payload.notes,
      sortOrder: payload.sortOrder,
      noDoubleCount: payload.noDoubleCount,
      rules: payload.rules.map((rule) => {
        const ruleId = randomUUID();
        return {
          id: ruleId,
          requirementGroupId: groupId,
          ruleType: rule.ruleType,
          pickCount: rule.pickCount,
          note: rule.note,
          sortOrder: rule.sortOrder,
          courses: rule.courses.map((course) => ({
            id: randomUUID(),
            requirementRuleId: ruleId,
            catalogCourseId: course.catalogCourseId,
          })),
        };
      }),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    data.requirementGroups = [...(data.requirementGroups || []), group];
    this.write(data);
    return group;
  }

  async updateRequirementGroup(
    apiBaseUrl: string,
    _userId: string,
    _programId: string,
    groupId: string,
    payload: Partial<{
      trackId: string | null;
      title: string;
      category: RequirementGroupCategory;
      minUnits: number;
      minCourses: number;
      notes: string;
      sortOrder: number;
      noDoubleCount: boolean;
      rules: Array<{
        ruleType: RequirementRuleType;
        pickCount: number | null;
        note: string;
        sortOrder: number;
        courses: Array<{ catalogCourseId: string }>;
      }>;
    }>
  ): Promise<RequirementGroupRecord | null> {
    const data = this.read(apiBaseUrl);
    const group = (data.requirementGroups || []).find((entry) => entry.id === groupId);
    if (!group) return null;
    if (payload.trackId !== undefined) group.trackId = payload.trackId;
    if (payload.title !== undefined) group.title = payload.title;
    if (payload.category !== undefined) group.category = payload.category;
    if (payload.minUnits !== undefined) group.minUnits = payload.minUnits;
    if (payload.minCourses !== undefined) group.minCourses = payload.minCourses;
    if (payload.notes !== undefined) group.notes = payload.notes;
    if (payload.sortOrder !== undefined) group.sortOrder = payload.sortOrder;
    if (payload.noDoubleCount !== undefined) group.noDoubleCount = payload.noDoubleCount;
    if (payload.rules !== undefined) {
      group.rules = payload.rules.map((rule) => {
        const ruleId = randomUUID();
        return {
          id: ruleId,
          requirementGroupId: group.id,
          ruleType: rule.ruleType,
          pickCount: rule.pickCount,
          note: rule.note,
          sortOrder: rule.sortOrder,
          courses: rule.courses.map((course) => ({
            id: randomUUID(),
            requirementRuleId: ruleId,
            catalogCourseId: course.catalogCourseId,
          })),
        };
      });
    }
    group.updatedAt = nowIso();
    this.write(data);
    return group;
  }

  async createTrack(
    apiBaseUrl: string,
    _userId: string,
    _programId: string,
    payload: {
      programVersionId: string;
      slug: string;
      title: string;
      description: string;
      selectionYearStart: number;
    }
  ): Promise<TrackRecord> {
    const data = this.read(apiBaseUrl);
    const track: TrackRecord = {
      id: randomUUID(),
      programVersionId: payload.programVersionId,
      slug: payload.slug,
      title: payload.title,
      description: payload.description,
      selectionYearStart: payload.selectionYearStart,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    data.tracks = [...(data.tracks || []), track];
    this.write(data);
    return track;
  }

  async updateTrack(
    apiBaseUrl: string,
    _userId: string,
    _programId: string,
    trackId: string,
    payload: Partial<{
      slug: string;
      title: string;
      description: string;
      selectionYearStart: number;
    }>
  ): Promise<TrackRecord | null> {
    const data = this.read(apiBaseUrl);
    const track = (data.tracks || []).find((entry) => entry.id === trackId);
    if (!track) return null;
    if (payload.slug !== undefined) track.slug = payload.slug;
    if (payload.title !== undefined) track.title = payload.title;
    if (payload.description !== undefined) track.description = payload.description;
    if (payload.selectionYearStart !== undefined)
      track.selectionYearStart = payload.selectionYearStart;
    track.updatedAt = nowIso();
    this.write(data);
    return track;
  }

  async enrollInProgram(
    apiBaseUrl: string,
    userId: string,
    programId: string
  ): Promise<StudentProgramPlanRecord> {
    const data = this.read(apiBaseUrl);
    const version = this.getActiveProgramVersion(data, programId);
    if (!version) {
      throw new Error('No active program version found.');
    }
    let studentProgram = (data.studentPrograms || []).find((entry) => {
      if (entry.userId !== userId) return false;
      const studentVersion = (data.programVersions || []).find(
        (versionEntry) => versionEntry.id === entry.programVersionId
      );
      return studentVersion?.programId === programId;
    });
    if (!studentProgram) {
      studentProgram = {
        id: randomUUID(),
        userId,
        programVersionId: version.id,
        selectedTrackId: null,
        status: 'enrolled',
        isLocked: false,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      data.studentPrograms = [...(data.studentPrograms || []), studentProgram];
      data.programApprovals = [
        ...(data.programApprovals || []),
        {
          id: randomUUID(),
          studentProgramId: studentProgram.id,
          stage: 'advisor',
          status: 'pending',
          reviewerUserId: null,
          notes: null,
          decidedAt: null,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        },
        {
          id: randomUUID(),
          studentProgramId: studentProgram.id,
          stage: 'department',
          status: 'pending',
          reviewerUserId: null,
          notes: null,
          decidedAt: null,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        },
      ];
      this.write(data);
    }
    const plan = this.syncProgramDecisions(data, studentProgram.id);
    if (!plan) {
      throw new Error('Failed to create student program plan.');
    }
    return plan;
  }

  async getStudentProgramPlan(
    apiBaseUrl: string,
    userId: string
  ): Promise<StudentProgramPlanRecord | null> {
    const data = this.read(apiBaseUrl);
    const studentProgram = (data.studentPrograms || []).find((entry) => entry.userId === userId);
    if (!studentProgram) return null;
    return this.syncProgramDecisions(data, studentProgram.id);
  }

  async selectStudentTrack(
    apiBaseUrl: string,
    userId: string,
    trackId: string
  ): Promise<StudentProgramPlanRecord | null> {
    const data = this.read(apiBaseUrl);
    const studentProgram = (data.studentPrograms || []).find((entry) => entry.userId === userId);
    const track = (data.tracks || []).find((entry) => entry.id === trackId);
    const user = data.users.find((entry) => entry.id === userId);
    if (!studentProgram || !track || !user) return null;
    const version = (data.programVersions || []).find(
      (entry) => entry.id === studentProgram.programVersionId
    );
    if (!version || user.yearLevel < version.trackSelectionMinYear) return null;
    studentProgram.selectedTrackId = track.id;
    studentProgram.status = 'track_selected';
    studentProgram.updatedAt = nowIso();
    this.write(data);
    return this.syncProgramDecisions(data, studentProgram.id);
  }

  async updateStudentProgramPlan(
    apiBaseUrl: string,
    userId: string,
    payload: {
      plannedCourses: Array<{
        catalogCourseId: string;
        plannedYear: number;
        plannedTerm: AcademicTerm;
        sourceType: PlannedCourseSourceType;
        note: string | null;
      }>;
    }
  ): Promise<StudentProgramPlanRecord | null> {
    const data = this.read(apiBaseUrl);
    const studentProgram = (data.studentPrograms || []).find((entry) => entry.userId === userId);
    if (!studentProgram || studentProgram.isLocked) return null;
    const now = nowIso();
    data.studentPlannedCourses = [
      ...(data.studentPlannedCourses || []).filter(
        (entry) => entry.studentProgramId !== studentProgram.id
      ),
      ...payload.plannedCourses.map((course) => ({
        id: randomUUID(),
        studentProgramId: studentProgram.id,
        catalogCourseId: course.catalogCourseId,
        plannedYear: course.plannedYear,
        plannedTerm: course.plannedTerm,
        sourceType: course.sourceType,
        note: course.note,
        createdAt: now,
        updatedAt: now,
      })),
    ];
    studentProgram.updatedAt = now;
    this.write(data);
    return this.syncProgramDecisions(data, studentProgram.id);
  }

  async getStudentProgramSheet(
    apiBaseUrl: string,
    userId: string
  ): Promise<ProgramSheetViewRecord | null> {
    const data = this.read(apiBaseUrl);
    const studentProgram = (data.studentPrograms || []).find((entry) => entry.userId === userId);
    if (!studentProgram) return null;
    const bundle = this.findProgramBundle(data, studentProgram.id);
    if (!bundle) return null;
    return buildProgramSheet(bundle);
  }

  async generateStudentProgramSheet(
    apiBaseUrl: string,
    userId: string
  ): Promise<ProgramSheetViewRecord | null> {
    const data = this.read(apiBaseUrl);
    const studentProgram = (data.studentPrograms || []).find((entry) => entry.userId === userId);
    if (!studentProgram) return null;
    const plan = this.syncProgramDecisions(data, studentProgram.id);
    if (!plan) return null;
    const generatedAt = nowIso();
    const sheet = buildProgramSheet({
      studentProgram: {
        id: plan.id,
        userId: plan.userId,
        programVersionId: plan.version.id,
        selectedTrackId: plan.selectedTrack?.id || null,
        status: plan.status,
        isLocked: plan.isLocked,
        createdAt: studentProgram.createdAt,
        updatedAt: studentProgram.updatedAt,
      },
      user: data.users.find((entry) => entry.id === userId) || {
        id: userId,
        username: userId,
        email: `${userId}@example.com`,
        githubLogin: userId,
        githubLinked: false,
        githubAppInstalled: false,
        systemRole: 'user',
        yearLevel: 1,
      },
      program: plan.program,
      version: plan.version,
      selectedTrack: plan.selectedTrack,
      requirementGroups: (data.requirementGroups || []).filter(
        (entry) => entry.programVersionId === plan.version.id
      ),
      plannedCourses: plan.plannedCourses,
      catalogCourses: plan.catalogCourses,
      petitions: plan.petitions,
      approvals: plan.approvals,
      decisions: plan.decisions,
      generatedAt,
    });
    data.programSheetSnapshots = [
      ...(data.programSheetSnapshots || []),
      {
        id: randomUUID(),
        studentProgramId: studentProgram.id,
        versionId: plan.version.id,
        renderedPayload: sheet as unknown as Record<string, unknown>,
        generatedAt,
      },
    ];
    this.write(data);
    return sheet;
  }

  async createStudentPetition(
    apiBaseUrl: string,
    userId: string,
    payload: {
      type: PetitionType;
      justification: string;
      targetRequirementGroupId: string | null;
      originalCatalogCourseId: string | null;
      substituteCatalogCourseId: string | null;
    }
  ): Promise<PetitionRecord | null> {
    const data = this.read(apiBaseUrl);
    const studentProgram = (data.studentPrograms || []).find((entry) => entry.userId === userId);
    if (!studentProgram) return null;
    const petition: PetitionRecord = {
      id: randomUUID(),
      studentProgramId: studentProgram.id,
      type: payload.type,
      status: 'pending_advisor',
      justification: payload.justification,
      targetRequirementGroupId: payload.targetRequirementGroupId,
      submittedByUserId: userId,
      reviewerUserId: null,
      reviewerNotes: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      courseLinks:
        payload.originalCatalogCourseId || payload.substituteCatalogCourseId
          ? [
              {
                id: randomUUID(),
                petitionId: '',
                originalCatalogCourseId: payload.originalCatalogCourseId,
                substituteCatalogCourseId: payload.substituteCatalogCourseId,
              },
            ]
          : [],
    };
    petition.courseLinks = petition.courseLinks.map((entry) => ({
      ...entry,
      petitionId: petition.id,
    }));
    data.petitions = [...(data.petitions || []), petition];
    this.write(data);
    return petition;
  }

  async listStudentPetitions(apiBaseUrl: string, userId: string): Promise<PetitionRecord[]> {
    const data = this.read(apiBaseUrl);
    const studentProgram = (data.studentPrograms || []).find((entry) => entry.userId === userId);
    if (!studentProgram) return [];
    return (data.petitions || []).filter((entry) => entry.studentProgramId === studentProgram.id);
  }

  async listProgramPetitions(apiBaseUrl: string, programId: string): Promise<PetitionRecord[]> {
    const data = this.read(apiBaseUrl);
    const versionIds = new Set(
      (data.programVersions || [])
        .filter((entry) => entry.programId === programId)
        .map((entry) => entry.id)
    );
    const studentProgramIds = new Set(
      (data.studentPrograms || [])
        .filter((entry) => versionIds.has(entry.programVersionId))
        .map((entry) => entry.id)
    );
    return (data.petitions || []).filter((entry) => studentProgramIds.has(entry.studentProgramId));
  }

  async updateProgramPetition(
    apiBaseUrl: string,
    _programId: string,
    petitionId: string,
    reviewerUserId: string,
    payload: { status: PetitionStatus; reviewerNotes: string | null }
  ): Promise<PetitionRecord | null> {
    const data = this.read(apiBaseUrl);
    const petition = (data.petitions || []).find((entry) => entry.id === petitionId);
    if (!petition) return null;
    petition.status = payload.status;
    petition.reviewerUserId = reviewerUserId;
    petition.reviewerNotes = payload.reviewerNotes;
    petition.updatedAt = nowIso();
    this.write(data);
    return petition;
  }

  async setProgramApproval(
    apiBaseUrl: string,
    _programId: string,
    studentProgramId: string,
    stage: ApprovalStage,
    reviewerUserId: string,
    payload: { status: ApprovalStatus; notes: string | null }
  ): Promise<ProgramApprovalRecord | null> {
    const data = this.read(apiBaseUrl);
    const approval = (data.programApprovals || []).find(
      (entry) => entry.studentProgramId === studentProgramId && entry.stage === stage
    );
    const studentProgram = (data.studentPrograms || []).find(
      (entry) => entry.id === studentProgramId
    );
    if (!approval || !studentProgram) return null;
    if (stage === 'department') {
      const advisor = (data.programApprovals || []).find(
        (entry) => entry.studentProgramId === studentProgramId && entry.stage === 'advisor'
      );
      if (advisor?.status !== 'approved') {
        return null;
      }
    }
    approval.status = payload.status;
    approval.notes = payload.notes;
    approval.reviewerUserId = reviewerUserId;
    approval.decidedAt = nowIso();
    approval.updatedAt = nowIso();

    if (stage === 'advisor' && payload.status === 'approved') {
      studentProgram.status = 'advisor_approved';
      studentProgram.isLocked = true;
    } else if (stage === 'department' && payload.status === 'approved') {
      studentProgram.status = 'department_approved';
      studentProgram.isLocked = true;
    } else if (payload.status === 'rejected') {
      studentProgram.status = studentProgram.selectedTrackId ? 'track_selected' : 'enrolled';
      studentProgram.isLocked = false;
    }
    studentProgram.updatedAt = nowIso();
    this.write(data);
    return approval;
  }

  async listTrackingProjects(
    apiBaseUrl: string,
    courseId: string,
    opts?: PaginationOpts
  ): Promise<ProjectRecord[]> {
    const data = this.read(apiBaseUrl);
    const results = data.projects
      .filter((entry) => entry.courseId === courseId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    const offset = opts?.offset ?? 0;
    return opts?.limit !== undefined ? results.slice(offset, offset + opts.limit) : results;
  }

  async countTrackingProjects(apiBaseUrl: string, courseId: string): Promise<number> {
    const data = this.read(apiBaseUrl);
    return data.projects.filter((entry) => entry.courseId === courseId).length;
  }

  async getTrackingProjectById(
    apiBaseUrl: string,
    projectId: string
  ): Promise<ProjectRecord | null> {
    const data = this.read(apiBaseUrl);
    return data.projects.find((entry) => entry.id === projectId) || null;
  }

  async createTrackingProject(
    apiBaseUrl: string,
    userId: string,
    payload: {
      courseId: string;
      slug: string;
      title: string;
      description: string;
      status: ProjectStatus;
      deliveryMode: DeliveryMode;
      templateId?: string | null;
      applicationOpenAt?: string | null;
      applicationCloseAt?: string | null;
      teamLockAt?: string | null;
      teamSize?: number | null;
      rubric: TrackingRubricItemRecord[];
      resources: TrackingResourceRecord[];
    }
  ): Promise<ProjectRecord> {
    const data = this.read(apiBaseUrl);
    const template =
      payload.templateId && data.projectTemplates
        ? data.projectTemplates.find((entry) => entry.id === payload.templateId) || null
        : null;
    const deliveryMode = template?.deliveryMode || payload.deliveryMode;
    const teamRoles = template?.roles || [];
    const teamSize = template?.teamSize ?? payload.teamSize ?? null;
    const record: ProjectRecord = {
      id: randomUUID(),
      projectKey: payload.slug,
      slug: payload.slug,
      courseId: payload.courseId,
      templateId: template?.id || payload.templateId || null,
      title: payload.title,
      description: payload.description,
      status: payload.status,
      level: 1,
      deliveryMode,
      teamFormationStatus:
        deliveryMode === 'team'
          ? payload.applicationOpenAt
            ? 'application_open'
            : 'not_started'
          : 'not_started',
      applicationOpenAt: payload.applicationOpenAt || null,
      applicationCloseAt: payload.applicationCloseAt || null,
      teamLockAt: payload.teamLockAt || null,
      teamSize,
      teamRoles,
      teamName: null,
      assignedRoleLabel: null,
      team: [],
      rubric: template?.rubric || payload.rubric,
      resources: template?.resources || payload.resources,
      instructorUserId: userId,
      manifest: {
        ...defaultManifest(apiBaseUrl),
        projectKey: payload.slug,
      },
      task: `# ${payload.title}\n\n${payload.description}\n`,
      starter: { kind: 'none' },
      repoByUserId: {},
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    data.projects.push(record);
    if (template) {
      for (const milestone of template.milestones) {
        data.milestones.push({
          id: randomUUID(),
          projectId: record.id,
          title: milestone.title,
          description: milestone.description,
          order: milestone.order,
          dueAt: milestone.dueAt,
          isFinal: milestone.isFinal,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        });
      }
    }
    data.activity.unshift(
      makeActivityRecord({
        actorUserId: userId,
        courseId: payload.courseId,
        projectId: record.id,
        milestoneId: null,
        submissionId: null,
        action: 'project.created',
        summary: `${payload.title} was created.`,
      })
    );
    this.write(data);
    return record;
  }

  async updateTrackingProject(
    apiBaseUrl: string,
    userId: string,
    projectId: string,
    payload: Partial<{
      slug: string;
      title: string;
      description: string;
      status: ProjectStatus;
      deliveryMode: DeliveryMode;
      templateId: string | null;
      applicationOpenAt: string | null;
      applicationCloseAt: string | null;
      teamLockAt: string | null;
      teamSize: number | null;
      rubric: TrackingRubricItemRecord[];
      resources: TrackingResourceRecord[];
    }>
  ): Promise<ProjectRecord | null> {
    const data = this.read(apiBaseUrl);
    const project = data.projects.find((entry) => entry.id === projectId);
    if (!project) {
      return null;
    }
    if (payload.slug) {
      project.slug = payload.slug;
      project.projectKey = payload.slug;
      project.manifest.projectKey = payload.slug;
    }
    if (payload.title !== undefined) project.title = payload.title;
    if (payload.description !== undefined) project.description = payload.description;
    if (payload.status !== undefined) project.status = payload.status;
    if (payload.deliveryMode !== undefined) project.deliveryMode = payload.deliveryMode;
    if (payload.templateId !== undefined) project.templateId = payload.templateId;
    if (payload.applicationOpenAt !== undefined) {
      project.applicationOpenAt = payload.applicationOpenAt;
    }
    if (payload.applicationCloseAt !== undefined) {
      project.applicationCloseAt = payload.applicationCloseAt;
    }
    if (payload.teamLockAt !== undefined) {
      project.teamLockAt = payload.teamLockAt;
    }
    if (payload.teamSize !== undefined) {
      project.teamSize = payload.teamSize;
    }
    if (payload.rubric !== undefined) project.rubric = payload.rubric;
    if (payload.resources !== undefined) project.resources = payload.resources;
    if (project.deliveryMode === 'team' && project.teamFormationStatus === 'not_started') {
      project.teamFormationStatus = project.applicationOpenAt ? 'application_open' : 'not_started';
    }
    project.updatedAt = nowIso();
    data.activity.unshift(
      makeActivityRecord({
        actorUserId: userId,
        courseId: project.courseId,
        projectId: project.id,
        milestoneId: null,
        submissionId: null,
        action: 'project.updated',
        summary: `${project.title} was updated.`,
      })
    );
    this.write(data);
    return project;
  }

  async listCourseProjectTemplates(
    apiBaseUrl: string,
    courseId: string
  ): Promise<ProjectTemplateRecord[]> {
    const data = this.read(apiBaseUrl);
    return (data.projectTemplates || [])
      .filter((entry) => entry.courseId === courseId)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async createCourseProjectTemplate(
    apiBaseUrl: string,
    userId: string,
    courseId: string,
    payload: {
      slug: string;
      title: string;
      description: string;
      deliveryMode: DeliveryMode;
      teamSize: number | null;
      status: ProjectTemplateStatus;
      rubric: TrackingRubricItemRecord[];
      resources: TrackingResourceRecord[];
      roles: Array<Omit<ProjectTemplateRoleRecord, 'id'>>;
      milestones: Array<Omit<ProjectTemplateMilestoneRecord, 'id'>>;
    }
  ): Promise<ProjectTemplateRecord> {
    const data = this.read(apiBaseUrl);
    const record: ProjectTemplateRecord = {
      id: randomUUID(),
      courseId,
      slug: payload.slug,
      title: payload.title,
      description: payload.description,
      deliveryMode: payload.deliveryMode,
      teamSize: payload.teamSize,
      status: payload.status,
      rubric: payload.rubric,
      resources: payload.resources,
      roles: payload.roles.map((role, index) => ({
        id: randomUUID(),
        key: role.key,
        label: role.label,
        count: role.count,
        sortOrder: role.sortOrder ?? index,
      })),
      milestones: payload.milestones.map((milestone, index) => ({
        id: randomUUID(),
        title: milestone.title,
        description: milestone.description,
        order: milestone.order ?? index,
        dueAt: milestone.dueAt,
        isFinal: milestone.isFinal,
      })),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    data.projectTemplates = data.projectTemplates || [];
    data.projectTemplates.push(record);
    data.activity.unshift(
      makeActivityRecord({
        actorUserId: userId,
        courseId,
        projectId: null,
        milestoneId: null,
        submissionId: null,
        action: 'template.created',
        summary: `${record.title} template was created.`,
      })
    );
    this.write(data);
    return record;
  }

  async getProjectTemplateById(
    apiBaseUrl: string,
    templateId: string
  ): Promise<ProjectTemplateRecord | null> {
    const data = this.read(apiBaseUrl);
    return (data.projectTemplates || []).find((entry) => entry.id === templateId) || null;
  }

  async updateProjectTemplate(
    apiBaseUrl: string,
    userId: string,
    templateId: string,
    payload: Partial<{
      slug: string;
      title: string;
      description: string;
      deliveryMode: DeliveryMode;
      teamSize: number | null;
      status: ProjectTemplateStatus;
      rubric: TrackingRubricItemRecord[];
      resources: TrackingResourceRecord[];
      roles: Array<Omit<ProjectTemplateRoleRecord, 'id'>>;
      milestones: Array<Omit<ProjectTemplateMilestoneRecord, 'id'>>;
    }>
  ): Promise<ProjectTemplateRecord | null> {
    const data = this.read(apiBaseUrl);
    const template = (data.projectTemplates || []).find((entry) => entry.id === templateId);
    if (!template) {
      return null;
    }
    if (payload.slug !== undefined) template.slug = payload.slug;
    if (payload.title !== undefined) template.title = payload.title;
    if (payload.description !== undefined) template.description = payload.description;
    if (payload.deliveryMode !== undefined) template.deliveryMode = payload.deliveryMode;
    if (payload.teamSize !== undefined) template.teamSize = payload.teamSize;
    if (payload.status !== undefined) template.status = payload.status;
    if (payload.rubric !== undefined) template.rubric = payload.rubric;
    if (payload.resources !== undefined) template.resources = payload.resources;
    if (payload.roles !== undefined) {
      template.roles = payload.roles.map((role, index) => ({
        id: randomUUID(),
        key: role.key,
        label: role.label,
        count: role.count,
        sortOrder: role.sortOrder ?? index,
      }));
    }
    if (payload.milestones !== undefined) {
      template.milestones = payload.milestones.map((milestone, index) => ({
        id: randomUUID(),
        title: milestone.title,
        description: milestone.description,
        order: milestone.order ?? index,
        dueAt: milestone.dueAt,
        isFinal: milestone.isFinal,
      }));
    }
    template.updatedAt = nowIso();
    data.activity.unshift(
      makeActivityRecord({
        actorUserId: userId,
        courseId: template.courseId,
        projectId: null,
        milestoneId: null,
        submissionId: null,
        action: 'template.updated',
        summary: `${template.title} template was updated.`,
      })
    );
    this.write(data);
    return template;
  }

  async createProjectRoleApplication(
    apiBaseUrl: string,
    userId: string,
    projectId: string,
    payload: {
      statement: string;
      availabilityNote: string;
      preferences: Array<{ templateRoleId: string; rank: number }>;
    }
  ): Promise<ProjectRoleApplicationRecord> {
    const data = this.read(apiBaseUrl);
    const project = data.projects.find((entry) => entry.id === projectId);
    if (!project) {
      throw new Error('Project not found.');
    }
    const template = resolveProjectTemplateRecord(data, project);
    if (!template) {
      throw new Error('Team template is not configured for this project.');
    }
    const preferences = payload.preferences
      .slice()
      .sort((left, right) => left.rank - right.rank)
      .map((entry) => {
        const role = template.roles.find((item) => item.id === entry.templateRoleId);
        if (!role) {
          throw new Error('Template role not found.');
        }
        return {
          templateRoleId: role.id,
          roleKey: role.key,
          roleLabel: role.label,
          rank: entry.rank,
        };
      });
    data.projectRoleApplications = data.projectRoleApplications || [];
    const existing = data.projectRoleApplications.find(
      (entry) => entry.projectId === projectId && entry.userId === userId
    );
    const now = nowIso();
    if (existing) {
      existing.statement = payload.statement;
      existing.availabilityNote = payload.availabilityNote;
      existing.preferences = preferences;
      existing.status = 'submitted';
      existing.submittedAt = now;
      existing.updatedAt = now;
      this.write(data);
      return existing;
    }
    const record: ProjectRoleApplicationRecord = {
      id: randomUUID(),
      projectId,
      userId,
      statement: payload.statement,
      availabilityNote: payload.availabilityNote,
      status: 'submitted',
      submittedAt: now,
      updatedAt: now,
      preferences,
    };
    data.projectRoleApplications.push(record);
    this.write(data);
    return record;
  }

  async getProjectRoleApplicationForUser(
    apiBaseUrl: string,
    projectId: string,
    userId: string
  ): Promise<ProjectRoleApplicationRecord | null> {
    const data = this.read(apiBaseUrl);
    return (
      (data.projectRoleApplications || []).find(
        (entry) => entry.projectId === projectId && entry.userId === userId
      ) || null
    );
  }

  async listProjectRoleApplications(
    apiBaseUrl: string,
    projectId: string
  ): Promise<ProjectRoleApplicationRecord[]> {
    const data = this.read(apiBaseUrl);
    return (data.projectRoleApplications || [])
      .filter((entry) => entry.projectId === projectId)
      .sort((left, right) => (left.submittedAt || '').localeCompare(right.submittedAt || ''));
  }

  async generateProjectTeamFormation(
    apiBaseUrl: string,
    userId: string,
    projectId: string,
    payload?: { algorithmVersion?: string }
  ): Promise<TeamFormationRunRecord> {
    const data = this.read(apiBaseUrl);
    const project = data.projects.find((entry) => entry.id === projectId);
    if (!project) {
      throw new Error('Project not found.');
    }
    const template = resolveProjectTemplateRecord(data, project);
    if (!template) {
      throw new Error('Project template not found.');
    }
    const applications = (data.projectRoleApplications || []).filter(
      (entry) => entry.projectId === projectId && entry.status === 'submitted'
    );
    const courseMemberships = data.courseMemberships.filter(
      (entry) => entry.courseId === project.courseId
    );
    const result = generateTeamFormationResult({
      applications,
      template,
      users: data.users,
      memberships: courseMemberships,
    });
    const run: TeamFormationRunRecord = {
      id: randomUUID(),
      projectId,
      algorithmVersion: payload?.algorithmVersion || 'v1',
      config: {
        teamSize: template.teamSize,
        roleCount: template.roles.length,
      },
      result,
      createdByUserId: userId,
      createdAt: nowIso(),
    };
    data.teamFormationRuns = data.teamFormationRuns || [];
    data.teamFormationRuns.push(run);
    project.teamFormationStatus = 'team_review';
    project.updatedAt = nowIso();
    this.write(data);
    return run;
  }

  async lockProjectTeams(
    apiBaseUrl: string,
    userId: string,
    projectId: string,
    payload?: { formationRunId?: string }
  ): Promise<TeamRecord[]> {
    const data = this.read(apiBaseUrl);
    const project = data.projects.find((entry) => entry.id === projectId);
    if (!project) {
      throw new Error('Project not found.');
    }
    const run = payload?.formationRunId
      ? (data.teamFormationRuns || []).find((entry) => entry.id === payload.formationRunId) || null
      : (data.teamFormationRuns || [])
          .filter((entry) => entry.projectId === projectId)
          .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] || null;
    if (!run) {
      throw new Error('No generated team formation run found.');
    }
    data.teams = (data.teams || []).filter((entry) => entry.projectId !== projectId);
    const lockedAt = nowIso();
    const teams = run.result.teams.map((entry) => {
      const teamId = randomUUID();
      const firstMember = entry.members[0];
      const repo: TeamProjectRepoRecord = {
        id: randomUUID(),
        teamId,
        owner: firstMember ? firstMember.username : 'nibras-team',
        name: `nibras-${project.slug.replace(/\//g, '-')}-${entry.name.toLowerCase().replace(/\s+/g, '-')}`,
        githubRepoId: null,
        cloneUrl: null,
        defaultBranch: 'main',
        visibility: 'private',
        installStatus: 'provisioned',
        createdAt: lockedAt,
        updatedAt: lockedAt,
      };
      return {
        id: teamId,
        projectId,
        name: entry.name,
        status: 'locked' as const,
        lockedAt,
        members: entry.members.map((member) => ({
          id: randomUUID(),
          teamId,
          userId: member.userId,
          username: member.username,
          roleKey: member.roleKey,
          roleLabel: member.roleLabel,
          status: 'active',
          createdAt: lockedAt,
        })),
        repo,
        createdAt: lockedAt,
        updatedAt: lockedAt,
      };
    });
    data.teams.push(...teams);
    project.teamFormationStatus = 'teams_locked';
    project.teamLockAt = project.teamLockAt || lockedAt;
    project.updatedAt = lockedAt;
    this.write(data);
    return teams;
  }

  async listProjectTeams(apiBaseUrl: string, projectId: string): Promise<TeamRecord[]> {
    const data = this.read(apiBaseUrl);
    return (data.teams || [])
      .filter((entry) => entry.projectId === projectId)
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  async updateProjectTeam(
    apiBaseUrl: string,
    _userId: string,
    projectId: string,
    teamId: string,
    payload: Partial<{
      name: string;
      members: Array<{ userId: string; roleKey: string; roleLabel: string }>;
    }>
  ): Promise<TeamRecord | null> {
    const data = this.read(apiBaseUrl);
    const team = (data.teams || []).find(
      (entry) => entry.id === teamId && entry.projectId === projectId
    );
    if (!team) {
      return null;
    }
    if (payload.name !== undefined) {
      team.name = payload.name;
    }
    if (payload.members !== undefined) {
      const userLookup = Object.fromEntries(data.users.map((user) => [user.id, user.username]));
      team.members = payload.members.map((member) => ({
        id: randomUUID(),
        teamId: team.id,
        userId: member.userId,
        username: userLookup[member.userId] || member.userId,
        roleKey: member.roleKey,
        roleLabel: member.roleLabel,
        status: 'active',
        createdAt: nowIso(),
      }));
    }
    team.updatedAt = nowIso();
    this.write(data);
    return team;
  }

  async setTrackingProjectStatus(
    apiBaseUrl: string,
    userId: string,
    projectId: string,
    status: ProjectStatus
  ): Promise<ProjectRecord | null> {
    const project = await this.updateTrackingProject(apiBaseUrl, userId, projectId, { status });
    if (!project) {
      return null;
    }
    const data = this.read(apiBaseUrl);
    data.activity.unshift(
      makeActivityRecord({
        actorUserId: userId,
        courseId: project.courseId,
        projectId: project.id,
        milestoneId: null,
        submissionId: null,
        action: status === 'published' ? 'project.published' : 'project.unpublished',
        summary: `${project.title} is now ${status}.`,
      })
    );
    this.write(data);
    return project;
  }

  async listTrackingMilestones(apiBaseUrl: string, projectId: string): Promise<MilestoneRecord[]> {
    const data = this.read(apiBaseUrl);
    return data.milestones
      .filter((entry) => entry.projectId === projectId)
      .sort((left, right) => left.order - right.order);
  }

  async getTrackingMilestone(
    apiBaseUrl: string,
    milestoneId: string
  ): Promise<MilestoneRecord | null> {
    const data = this.read(apiBaseUrl);
    return data.milestones.find((entry) => entry.id === milestoneId) || null;
  }

  async createTrackingMilestone(
    apiBaseUrl: string,
    userId: string,
    projectId: string,
    payload: {
      title: string;
      description: string;
      order: number;
      dueAt: string | null;
      isFinal: boolean;
    }
  ): Promise<MilestoneRecord> {
    const data = this.read(apiBaseUrl);
    const project = data.projects.find((entry) => entry.id === projectId);
    if (!project) {
      throw new Error('Project not found.');
    }
    const milestone: MilestoneRecord = {
      id: randomUUID(),
      projectId,
      title: payload.title,
      description: payload.description,
      order: payload.order,
      dueAt: payload.dueAt,
      isFinal: payload.isFinal,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    data.milestones.push(milestone);
    data.activity.unshift(
      makeActivityRecord({
        actorUserId: userId,
        courseId: project.courseId,
        projectId,
        milestoneId: milestone.id,
        submissionId: null,
        action: 'milestone.created',
        summary: `${milestone.title} was added to ${project.title}.`,
      })
    );
    this.write(data);
    return milestone;
  }

  async updateTrackingMilestone(
    apiBaseUrl: string,
    userId: string,
    milestoneId: string,
    payload: Partial<{
      title: string;
      description: string;
      order: number;
      dueAt: string | null;
      isFinal: boolean;
    }>
  ): Promise<MilestoneRecord | null> {
    const data = this.read(apiBaseUrl);
    const milestone = data.milestones.find((entry) => entry.id === milestoneId);
    if (!milestone) {
      return null;
    }
    if (payload.title !== undefined) milestone.title = payload.title;
    if (payload.description !== undefined) milestone.description = payload.description;
    if (payload.order !== undefined) milestone.order = payload.order;
    if (payload.dueAt !== undefined) milestone.dueAt = payload.dueAt;
    if (payload.isFinal !== undefined) milestone.isFinal = payload.isFinal;
    milestone.updatedAt = nowIso();
    const project = data.projects.find((entry) => entry.id === milestone.projectId);
    data.activity.unshift(
      makeActivityRecord({
        actorUserId: userId,
        courseId: project?.courseId || null,
        projectId: milestone.projectId,
        milestoneId,
        submissionId: null,
        action: 'milestone.updated',
        summary: `${milestone.title} was updated.`,
      })
    );
    this.write(data);
    return milestone;
  }

  async deleteTrackingMilestone(
    apiBaseUrl: string,
    userId: string,
    milestoneId: string
  ): Promise<boolean> {
    const data = this.read(apiBaseUrl);
    const milestone = data.milestones.find((entry) => entry.id === milestoneId);
    if (!milestone) {
      return false;
    }
    data.milestones = data.milestones.filter((entry) => entry.id !== milestoneId);
    data.submissions = data.submissions.filter((entry) => entry.milestoneId !== milestoneId);
    data.activity.unshift(
      makeActivityRecord({
        actorUserId: userId,
        courseId: data.projects.find((entry) => entry.id === milestone.projectId)?.courseId || null,
        projectId: milestone.projectId,
        milestoneId,
        submissionId: null,
        action: 'milestone.deleted',
        summary: `${milestone.title} was deleted.`,
      })
    );
    this.write(data);
    return true;
  }

  async listTrackingMilestoneSubmissions(
    apiBaseUrl: string,
    milestoneId: string,
    opts?: PaginationOpts
  ): Promise<SubmissionRecord[]> {
    const data = this.read(apiBaseUrl);
    const results = data.submissions
      .filter((entry) => entry.milestoneId === milestoneId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    const offset = opts?.offset ?? 0;
    return opts?.limit !== undefined ? results.slice(offset, offset + opts.limit) : results;
  }

  async countTrackingMilestoneSubmissions(
    apiBaseUrl: string,
    milestoneId: string
  ): Promise<number> {
    const data = this.read(apiBaseUrl);
    return data.submissions.filter((entry) => entry.milestoneId === milestoneId).length;
  }

  async createTrackingSubmission(
    apiBaseUrl: string,
    userId: string,
    milestoneId: string,
    payload: {
      submissionType: SubmissionType;
      submissionValue: string;
      notes: string;
      repoUrl: string;
      branch: string;
      commitSha: string;
    }
  ): Promise<SubmissionRecord> {
    const data = this.read(apiBaseUrl);
    const milestone = data.milestones.find((entry) => entry.id === milestoneId);
    if (!milestone) {
      throw new Error('Milestone not found.');
    }
    const project = data.projects.find((entry) => entry.id === milestone.projectId);
    if (!project) {
      throw new Error('Project not found.');
    }
    const now = nowIso();
    let teamId: string | null = null;
    let teamName: string | null = null;
    let teamMemberUserIds: string[] = [];
    let repoUrl = payload.repoUrl || payload.submissionValue;
    let branch = payload.branch || 'main';
    if (project.deliveryMode === 'team') {
      if (project.teamFormationStatus !== 'teams_locked') {
        throw new Error('Teams must be locked before team projects can accept submissions.');
      }
      const team = (data.teams || []).find(
        (entry) =>
          entry.projectId === project.id &&
          entry.members.some((member) => member.userId === userId && member.status === 'active')
      );
      if (!team) {
        throw new Error('You are not assigned to a locked team for this project.');
      }
      teamId = team.id;
      teamName = team.name;
      teamMemberUserIds = team.members.map((member) => member.userId);
      if (team.repo) {
        if (payload.repoUrl || payload.submissionValue) {
          team.repo.cloneUrl = payload.repoUrl || payload.submissionValue;
          team.repo.defaultBranch = branch;
          team.repo.updatedAt = now;
        }
        repoUrl = team.repo.cloneUrl || repoUrl;
        branch = team.repo.defaultBranch || branch;
      }
    }
    const record: SubmissionRecord = {
      id: randomUUID(),
      userId,
      submittedByUserId: userId,
      projectId: project.id,
      projectKey: project.projectKey,
      milestoneId,
      teamId,
      teamName,
      teamMemberUserIds,
      commitSha:
        payload.commitSha ||
        (payload.submissionType === 'github'
          ? `github-pending-${randomUUID().slice(0, 8)}`
          : `manual-${randomUUID().slice(0, 8)}`),
      repoUrl,
      branch,
      status: payload.submissionType === 'github' ? 'running' : 'needs_review',
      summary:
        payload.submissionType === 'github'
          ? 'GitHub submission received. Waiting for webhook activity.'
          : 'Submission received and queued for instructor review.',
      submissionType: payload.submissionType,
      submissionValue: payload.submissionValue,
      notes: payload.notes || null,
      createdAt: now,
      updatedAt: now,
      submittedAt: now,
      localTestExitCode: null,
    };
    data.submissions.push(record);
    data.activity.unshift(
      makeActivityRecord({
        actorUserId: userId,
        courseId: project.courseId,
        projectId: project.id,
        milestoneId,
        submissionId: record.id,
        action: 'submission.created',
        summary: `A ${payload.submissionType} submission was added for ${milestone.title}.`,
      })
    );
    this.write(data);
    return record;
  }

  async updateTrackingSubmission(
    apiBaseUrl: string,
    userId: string,
    submissionId: string,
    payload: Partial<{
      submissionType: SubmissionType;
      submissionValue: string;
      notes: string;
      repoUrl: string;
      branch: string;
      commitSha: string;
    }>
  ): Promise<SubmissionRecord | null> {
    const data = this.read(apiBaseUrl);
    const submission = data.submissions.find((entry) => entry.id === submissionId);
    if (!submission) {
      return null;
    }
    const nextSubmissionType = payload.submissionType ?? submission.submissionType;
    const nextSubmissionValue = payload.submissionValue ?? submission.submissionValue ?? '';
    const nextBranch = payload.branch || submission.branch || 'main';
    const nextRepoUrl =
      nextSubmissionType === 'github'
        ? payload.repoUrl || nextSubmissionValue || submission.repoUrl
        : nextSubmissionValue || submission.repoUrl;
    const nextCommitSha =
      payload.commitSha && payload.commitSha.trim()
        ? payload.commitSha.trim()
        : nextSubmissionType === 'github'
          ? `github-pending-${randomUUID().slice(0, 8)}`
          : `manual-${randomUUID().slice(0, 8)}`;
    const nextStatus = nextSubmissionType === 'github' ? 'running' : 'needs_review';
    const nextSummary =
      nextSubmissionType === 'github'
        ? 'GitHub submission updated. Waiting for webhook activity.'
        : 'Submission updated and queued for instructor review.';
    const submittedAt = nowIso();

    submission.submissionType = nextSubmissionType;
    submission.submissionValue = nextSubmissionValue;
    submission.notes = payload.notes ?? submission.notes;
    submission.repoUrl = nextRepoUrl;
    submission.branch = nextBranch;
    submission.commitSha = nextCommitSha;
    submission.status = nextStatus;
    submission.summary = nextSummary;
    submission.submittedAt = submittedAt;
    submission.localTestExitCode = null;
    submission.updatedAt = submittedAt;
    data.activity.unshift(
      makeActivityRecord({
        actorUserId: userId,
        courseId:
          data.projects.find((entry) => entry.id === submission.projectId)?.courseId || null,
        projectId: submission.projectId,
        milestoneId: submission.milestoneId,
        submissionId,
        action: 'submission.updated',
        summary: 'Submission details were updated and resubmitted.',
      })
    );
    this.write(data);
    return submission;
  }

  async createTrackingReview(
    apiBaseUrl: string,
    userId: string,
    submissionId: string,
    payload: {
      status: ReviewStatus;
      score: number | null;
      feedback: string;
      rubric: TrackingRubricItemRecord[];
    }
  ): Promise<ReviewRecord> {
    const data = this.read(apiBaseUrl);
    const submission = data.submissions.find((entry) => entry.id === submissionId);
    if (!submission) {
      throw new Error('Submission not found.');
    }
    const review: ReviewRecord = {
      id: randomUUID(),
      submissionId,
      reviewerUserId: userId,
      status: payload.status,
      score: payload.score,
      feedback: payload.feedback,
      rubric: payload.rubric,
      reviewedAt: nowIso(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
      aiConfidence: null,
      aiNeedsReview: null,
      aiReasoningSummary: null,
      aiCriterionScores: null,
      aiEvidenceQuotes: null,
      aiModel: null,
      aiGradedAt: null,
    };
    submission.status =
      payload.status === 'changes_requested'
        ? 'failed'
        : payload.status === 'graded' || payload.status === 'approved'
          ? 'passed'
          : 'needs_review';
    submission.summary = payload.feedback || statusLabel(payload.status);
    submission.updatedAt = nowIso();
    data.reviews.push(review);
    data.activity.unshift(
      makeActivityRecord({
        actorUserId: userId,
        courseId:
          data.projects.find((entry) => entry.id === submission.projectId)?.courseId || null,
        projectId: submission.projectId,
        milestoneId: submission.milestoneId,
        submissionId,
        action: 'review.created',
        summary: `Review completed with status ${statusLabel(payload.status)}.`,
      })
    );
    this.write(data);
    return review;
  }

  async getTrackingReview(apiBaseUrl: string, submissionId: string): Promise<ReviewRecord | null> {
    const data = this.read(apiBaseUrl);
    return (
      data.reviews
        .filter((entry) => entry.submissionId === submissionId)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] || null
    );
  }

  async getSubmissionStudentEmail(
    apiBaseUrl: string,
    submissionId: string
  ): Promise<{ userId: string; email: string; username: string } | null> {
    const data = this.read(apiBaseUrl);
    const submission = data.submissions.find((entry) => entry.id === submissionId);
    if (!submission) return null;
    const user = data.users.find((entry) => entry.id === submission.userId);
    return user ? { userId: user.id, email: user.email, username: user.username } : null;
  }

  async listTrackingReviewQueue(
    apiBaseUrl: string,
    filters?: { courseId?: string; projectId?: string; status?: SubmissionWorkflowStatus },
    opts?: PaginationOpts
  ): Promise<SubmissionRecord[]> {
    const data = this.read(apiBaseUrl);
    const results = data.submissions.filter((entry) => {
      if (filters?.projectId && entry.projectId !== filters.projectId) return false;
      if (filters?.courseId) {
        const project = data.projects.find((projectItem) => projectItem.id === entry.projectId);
        if (!project || project.courseId !== filters.courseId) return false;
      }
      if (filters?.status && entry.status !== filters.status) return false;
      return entry.milestoneId !== null;
    });
    const offset = opts?.offset ?? 0;
    return opts?.limit !== undefined ? results.slice(offset, offset + opts.limit) : results;
  }

  async countTrackingReviewQueue(
    apiBaseUrl: string,
    filters?: { courseId?: string; projectId?: string; status?: SubmissionWorkflowStatus }
  ): Promise<number> {
    return (await this.listTrackingReviewQueue(apiBaseUrl, filters)).length;
  }

  async listTrackingActivity(apiBaseUrl: string, userId: string): Promise<ActivityRecord[]> {
    const courses = await this.listTrackingCourses(apiBaseUrl, userId);
    const allowedCourseIds = new Set(courses.map((entry) => entry.id));
    return this.read(apiBaseUrl)
      .activity.filter((entry) => !entry.courseId || allowedCourseIds.has(entry.courseId))
      .slice(0, 20);
  }

  async getStudentTrackingDashboard(
    apiBaseUrl: string,
    userId: string,
    courseId?: string | null
  ): Promise<StudentDashboardRecord> {
    const courses = await this.listTrackingCourses(apiBaseUrl, userId);
    const memberships = await this.listCourseMemberships(apiBaseUrl, userId);
    const selectedCourse = courseId
      ? courses.find((entry) => entry.id === courseId) || null
      : courses[0] || null;
    if (!selectedCourse) {
      return {
        course: null,
        memberships,
        projects: [],
        milestonesByProject: {},
        activeProjectId: null,
        activity: [],
        statsByProject: {},
        pageError: 'No active course found for this account.',
      };
    }
    const data = this.read(apiBaseUrl);
    const projects = data.projects
      .filter((entry) => entry.courseId === selectedCourse.id && entry.status === 'published')
      .map((entry) => projectWithTeamContext(data, entry, userId));
    const milestonesByProject: Record<string, MilestoneRecord[]> = {};
    const statsByProject: Record<string, TrackingDashboardStats> = {};
    for (const project of projects) {
      const milestones = data.milestones
        .filter((entry) => entry.projectId === project.id)
        .sort((left, right) => left.order - right.order);
      milestonesByProject[project.id] = milestones;
      const submissions = data.submissions.filter(
        (entry) => entry.projectId === project.id && submissionBelongsToUser(data, entry, userId)
      );
      statsByProject[project.id] = calculateProjectStats(milestones, submissions, data.reviews);
    }
    return {
      course: selectedCourse,
      memberships,
      projects,
      projectTemplatesById: Object.fromEntries(
        (data.projectTemplates || []).map((entry) => [entry.id, entry])
      ),
      milestonesByProject,
      activeProjectId: projects[0]?.id || null,
      activity: data.activity.filter((entry) => entry.courseId === selectedCourse.id).slice(0, 10),
      statsByProject,
      pageError: projects.length === 0 ? 'No published projects found for this course yet.' : null,
    };
  }

  async getInstructorTrackingDashboard(
    apiBaseUrl: string,
    userId: string
  ): Promise<InstructorDashboardRecord> {
    const courses = (await this.listTrackingCourses(apiBaseUrl, userId)).filter((course) => {
      const membership = this.read(apiBaseUrl).courseMemberships.find(
        (entry) => entry.courseId === course.id && entry.userId === userId
      );
      const user = this.read(apiBaseUrl).users.find((entry) => entry.id === userId);
      return (
        user?.systemRole === 'admin' ||
        membership?.role === 'instructor' ||
        membership?.role === 'ta'
      );
    });
    const reviewQueue = await this.listTrackingReviewQueue(apiBaseUrl);
    const activity = await this.listTrackingActivity(apiBaseUrl, userId);
    return { courses, reviewQueue, activity };
  }

  async getCourseTrackingDashboard(
    apiBaseUrl: string,
    userId: string,
    courseId: string
  ): Promise<InstructorDashboardRecord> {
    const courses = await this.listTrackingCourses(apiBaseUrl, userId);
    const activity = (await this.listTrackingActivity(apiBaseUrl, userId)).filter(
      (entry) => entry.courseId === courseId
    );
    const reviewQueue = await this.listTrackingReviewQueue(apiBaseUrl, { courseId });
    return {
      courses: courses.filter((entry) => entry.id === courseId),
      reviewQueue,
      activity,
    };
  }

  async getHomeDashboard(
    apiBaseUrl: string,
    userId: string,
    mode?: DashboardModeRecord
  ): Promise<DashboardHomeRecord> {
    const data = this.read(apiBaseUrl);
    const user = data.users.find((entry) => entry.id === userId);
    if (!user) {
      throw new Error('User not found.');
    }
    const memberships = await this.listCourseMemberships(apiBaseUrl, userId);
    const studentCourseIds = new Set(
      memberships.filter((entry) => entry.role === 'student').map((entry) => entry.courseId)
    );
    const instructorCourseIds = new Set(
      memberships
        .filter((entry) => entry.role === 'instructor' || entry.role === 'ta')
        .map((entry) => entry.courseId)
    );

    let student: StudentHomeDashboardRecord | undefined;
    if (user.systemRole !== 'admin' || studentCourseIds.size > 0) {
      const studentCourses = (await this.listTrackingCourses(apiBaseUrl, userId)).filter((course) =>
        studentCourseIds.has(course.id)
      );
      const snapshots = await Promise.all(
        studentCourses.map((course) =>
          this.getStudentTrackingDashboard(apiBaseUrl, userId, course.id)
        )
      );
      const submissions = await this.listUserSubmissions(apiBaseUrl, userId);
      const reviewsBySubmission = Object.fromEntries(
        await Promise.all(
          submissions.map(async (submission) => [
            submission.id,
            await this.getTrackingReview(apiBaseUrl, submission.id),
          ])
        )
      ) as Record<string, ReviewRecord | null>;
      student = buildStudentHomeDashboard({
        user,
        courses: studentCourses,
        snapshots,
        submissions,
        reviewsBySubmission,
      });
    }

    let instructor: InstructorHomeDashboardRecord | undefined;
    if (user.systemRole === 'admin' || instructorCourseIds.size > 0) {
      const dashboard = await this.getInstructorTrackingDashboard(apiBaseUrl, userId);
      const managedCourseIds =
        user.systemRole === 'admin'
          ? new Set(dashboard.courses.map((entry) => entry.id))
          : instructorCourseIds;
      const courseTitleById = Object.fromEntries(
        dashboard.courses.map((course) => [course.id, course.title])
      ) as Record<string, string>;
      const managedProjects = data.projects.filter(
        (project) => project.courseId && managedCourseIds.has(project.courseId)
      );
      const projectTitleById = Object.fromEntries(
        managedProjects.map((project) => [project.id, project.title])
      ) as Record<string, string>;
      const courseIdByProjectId = Object.fromEntries(
        managedProjects
          .filter((project) => project.courseId)
          .map((project) => [project.id, project.courseId as string])
      ) as Record<string, string>;
      const studentNameById = Object.fromEntries(
        data.users.map((entry) => [entry.id, entry.username])
      ) as Record<string, string>;
      const memberCountsByCourse = data.courseMemberships.reduce<Record<string, number>>(
        (acc, membership) => {
          if (!managedCourseIds.has(membership.courseId)) return acc;
          acc[membership.courseId] = (acc[membership.courseId] || 0) + 1;
          return acc;
        },
        {}
      );
      const publishedProjectCountsByCourse = managedProjects.reduce<Record<string, number>>(
        (acc, project) => {
          if (project.courseId && project.status === 'published') {
            acc[project.courseId] = (acc[project.courseId] || 0) + 1;
          }
          return acc;
        },
        {}
      );
      instructor = buildInstructorHomeDashboard({
        courses: dashboard.courses,
        reviewQueue: dashboard.reviewQueue,
        activities: dashboard.activity,
        projectTitleById,
        courseIdByProjectId,
        courseTitleById,
        studentNameById,
        memberCountsByCourse,
        publishedProjectCountsByCourse,
      });
    }

    return buildDashboardHomeRecord({
      user,
      memberships,
      requestedMode: mode,
      ...(student ? { student } : {}),
      ...(instructor ? { instructor } : {}),
    });
  }

  async getTrackingSubmissionCommits(
    apiBaseUrl: string,
    submissionId: string
  ): Promise<GithubDeliveryRecord[]> {
    return this.read(apiBaseUrl)
      .githubDeliveries.filter((entry) => entry.submissionId === submissionId)
      .sort((left, right) => right.receivedAt.localeCompare(left.receivedAt));
  }

  async handlePushWebhook(payload: {
    owner: string;
    repoName: string;
    ref: string;
    after: string;
    deliveryId?: string;
    eventType?: string;
    repositoryUrl?: string;
    rawPayload?: Record<string, unknown>;
  }): Promise<void> {
    const data = this.read('http://127.0.0.1');
    const repoUrl =
      payload.repositoryUrl || `https://github.com/${payload.owner}/${payload.repoName}`;
    const branch = branchNameFromRef(payload.ref);
    const project = data.projects.find((entry) =>
      Object.values(entry.repoByUserId).some(
        (repo) => repo.owner === payload.owner && repo.name === payload.repoName
      )
    );
    if (!project) {
      return;
    }
    const matchingSubmissions = data.submissions
      .filter(
        (entry) =>
          entry.projectId === project.id &&
          (entry.repoUrl.includes(`/${payload.owner}/${payload.repoName}`) ||
            entry.submissionValue?.includes(`/${payload.owner}/${payload.repoName}`)) &&
          entry.submissionType === 'github' &&
          entry.branch === branch
      )
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    const submission =
      matchingSubmissions.find((entry) => entry.commitSha === payload.after) ||
      matchingSubmissions.find((entry) => entry.commitSha.startsWith('github-pending-'));
    if (!submission) {
      return;
    }
    submission.status = 'running';
    submission.summary = `GitHub push received for ${payload.ref}. Verification is running.`;
    submission.commitSha = payload.after || submission.commitSha;
    submission.updatedAt = nowIso();
    data.githubDeliveries.unshift({
      id: randomUUID(),
      submissionId: submission.id,
      repoUrl,
      eventType: payload.eventType || 'push',
      deliveryId: payload.deliveryId || randomUUID(),
      ref: payload.ref,
      commitSha: payload.after,
      payload: payload.rawPayload || {},
      receivedAt: nowIso(),
    });
    data.activity.unshift(
      makeActivityRecord({
        actorUserId: null,
        courseId: project.courseId,
        projectId: project.id,
        milestoneId: submission.milestoneId,
        submissionId: submission.id,
        action: 'github.delivery',
        summary: `GitHub ${payload.eventType || 'push'} received for ${project.title}.`,
      })
    );
    this.write(data);
  }
}

export function getStorePath(): string {
  return process.env.NIBRAS_API_STORE || path.join(process.cwd(), 'tmp', 'nibras-api-store.json');
}

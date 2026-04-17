import { randomUUID } from 'node:crypto';
import {
  AcademicTerm,
  ApprovalStage as PrismaApprovalStage,
  ApprovalStatus as PrismaApprovalStatus,
  AssetVisibility,
  CourseRole,
  DeliveryMode,
  PetitionStatus as PrismaPetitionStatus,
  PetitionType as PrismaPetitionType,
  ProjectRoleApplicationStatus as PrismaProjectRoleApplicationStatus,
  ProjectTemplateStatus as PrismaProjectTemplateStatus,
  Prisma,
  PrismaClient,
  ProgramStatus as PrismaProgramStatus,
  ProjectStatus as PrismaProjectStatus,
  PlannedCourseSourceType as PrismaPlannedCourseSourceType,
  RequirementDecisionSourceType as PrismaRequirementDecisionSourceType,
  RequirementGroupCategory as PrismaRequirementGroupCategory,
  RequirementRuleType as PrismaRequirementRuleType,
  RepoVisibility,
  ReviewStatus,
  StudentProgramStatus as PrismaStudentProgramStatus,
  StudentRequirementDecisionStatus as PrismaStudentRequirementDecisionStatus,
  SubmissionStatus,
  SystemRole,
  TeamFormationStatus as PrismaTeamFormationStatus,
  TeamStatus as PrismaTeamStatus,
  TrackingSubmissionType,
} from '@prisma/client';
import {
  createPrivateRepository,
  generateRepositoryFromTemplate,
  GitHubAppConfig,
} from '@nibras/github';
import { encrypt as encryptValue, decrypt as decryptValue } from '@nibras/core';
import { enqueueVerificationJob } from './lib/queue';
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
import {
  ActivityRecord,
  AppStore,
  CatalogCourseRecord,
  CourseMembershipRecord,
  CourseRecord,
  DashboardHomeRecord,
  DashboardModeRecord,
  defaultManifest,
  DeviceCodeRecord,
  GithubDeliveryRecord,
  InstructorDashboardRecord,
  InstructorHomeDashboardRecord,
  MembershipRole,
  MilestoneRecord,
  NotificationRecord,
  PaginationOpts,
  PetitionRecord,
  PlannedCourseSourceType,
  ProgramApprovalRecord,
  ProgramRecord,
  ProgramSheetSnapshotRecord,
  ProgramSheetViewRecord,
  ProgramStatus,
  ProgramVersionDetailRecord,
  ProgramVersionRecord,
  ProjectRoleApplicationRecord,
  ProjectRolePreferenceRecord,
  ProjectRecord,
  ProjectStarterRecord,
  ProjectStatus,
  ProjectTemplateMilestoneRecord,
  ProjectTemplateRecord,
  ProjectTemplateRoleRecord,
  ProjectTemplateStatus,
  RequirementGroupCategory,
  RequirementGroupRecord,
  RequirementRuleType,
  RepoRecord,
  ReviewRecord,
  ReviewStatus as StoreReviewStatus,
  SessionRecord,
  StudentProgramPlanRecord,
  StudentProgramRecord,
  StudentPlannedCourseRecord,
  StudentRequirementDecisionRecord,
  StudentDashboardRecord,
  StudentHomeDashboardRecord,
  SubmissionRecord,
  SubmissionType,
  TrackRecord,
  TeamFormationRunRecord,
  TeamMemberRecord,
  TeamProjectRepoRecord,
  TeamRecord,
  TrackingDashboardStats,
  TrackingResourceRecord,
  TrackingRubricItemRecord,
  UserRecord,
  VerificationLogRecord,
  WebSessionRecord,
  buildProjectTeamBadges,
  generateTeamFormationResult,
  projectWithTeamContext,
  resolveProjectTemplateRecord,
  submissionBelongsToUser,
} from './store';

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

function branchNameFromRef(ref: string): string {
  return ref.startsWith('refs/heads/') ? ref.slice('refs/heads/'.length) : ref;
}

function parseGitHubRepoUrl(value: string): { owner: string; name: string } | null {
  if (!value) {
    return null;
  }
  const sshMatch = value.match(/^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/i);
  if (sshMatch) {
    return { owner: sshMatch[1], name: sshMatch[2] };
  }
  try {
    const url = new URL(value);
    if (url.hostname !== 'github.com') {
      return null;
    }
    const [owner, name] = url.pathname
      .replace(/^\/+/, '')
      .replace(/\.git$/, '')
      .split('/');
    if (!owner || !name) {
      return null;
    }
    return { owner, name };
  } catch {
    return null;
  }
}

function toUserRecord(user: {
  id: string;
  username: string;
  email: string;
  githubLinked: boolean;
  githubAppInstalled: boolean;
  systemRole: SystemRole;
  yearLevel?: number;
  githubAccount: { login: string } | null;
}): UserRecord {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    githubLogin: user.githubAccount?.login || '',
    githubLinked: user.githubLinked,
    githubAppInstalled: user.githubAppInstalled,
    systemRole: user.systemRole === SystemRole.admin ? 'admin' : 'user',
    yearLevel: user.yearLevel ?? 1,
  };
}

function toSubmissionRecord(submission: {
  id: string;
  userId: string;
  submittedByUserId?: string | null;
  projectId: string;
  milestoneId: string | null;
  project: { slug: string };
  team?: { id: string; name: string; members: Array<{ userId: string }> } | null;
  commitSha: string;
  repoUrl: string;
  branch: string;
  status: SubmissionStatus;
  summary: string;
  submissionType: TrackingSubmissionType;
  submissionValue: string | null;
  notes: string | null;
  submittedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  localTestExitCode: number | null;
}): SubmissionRecord {
  return {
    id: submission.id,
    userId: submission.userId,
    submittedByUserId: submission.submittedByUserId ?? null,
    projectId: submission.projectId,
    projectKey: submission.project.slug,
    milestoneId: submission.milestoneId,
    teamId: submission.team?.id || null,
    teamName: submission.team?.name || null,
    teamMemberUserIds: submission.team?.members.map((member) => member.userId) || [],
    commitSha: submission.commitSha,
    repoUrl: submission.repoUrl,
    branch: submission.branch,
    status: submission.status as SubmissionRecord['status'],
    summary: submission.summary,
    submissionType: submission.submissionType as SubmissionType,
    submissionValue: submission.submissionValue,
    notes: submission.notes,
    createdAt: submission.createdAt.toISOString(),
    updatedAt: submission.updatedAt.toISOString(),
    submittedAt: submission.submittedAt ? submission.submittedAt.toISOString() : null,
    localTestExitCode: submission.localTestExitCode,
  };
}

function toProjectTemplateRoleRecord(role: {
  id: string;
  key: string;
  label: string;
  count: number;
  sortOrder: number;
}): ProjectTemplateRoleRecord {
  return {
    id: role.id,
    key: role.key,
    label: role.label,
    count: role.count,
    sortOrder: role.sortOrder,
  };
}

function toProjectTemplateMilestoneRecord(milestone: {
  id: string;
  title: string;
  description: string;
  order: number;
  dueAt: Date | null;
  isFinal: boolean;
}): ProjectTemplateMilestoneRecord {
  return {
    id: milestone.id,
    title: milestone.title,
    description: milestone.description,
    order: milestone.order,
    dueAt: milestone.dueAt ? milestone.dueAt.toISOString() : null,
    isFinal: milestone.isFinal,
  };
}

function toProjectTemplateRecord(template: {
  id: string;
  courseId: string;
  slug: string;
  title: string;
  description: string;
  deliveryMode: DeliveryMode;
  teamSize: number | null;
  status: PrismaProjectTemplateStatus;
  rubricJson: unknown;
  resourcesJson: unknown;
  createdAt: Date;
  updatedAt: Date;
  roles: Array<{
    id: string;
    key: string;
    label: string;
    count: number;
    sortOrder: number;
  }>;
  milestones: Array<{
    id: string;
    title: string;
    description: string;
    order: number;
    dueAt: Date | null;
    isFinal: boolean;
  }>;
}): ProjectTemplateRecord {
  return {
    id: template.id,
    courseId: template.courseId,
    slug: template.slug,
    title: template.title,
    description: template.description,
    deliveryMode: template.deliveryMode === DeliveryMode.team ? 'team' : 'individual',
    teamSize: template.teamSize,
    status: template.status === PrismaProjectTemplateStatus.draft ? 'draft' : 'active',
    rubric: Array.isArray(template.rubricJson)
      ? (template.rubricJson as TrackingRubricItemRecord[])
      : [],
    resources: Array.isArray(template.resourcesJson)
      ? (template.resourcesJson as TrackingResourceRecord[])
      : [],
    roles: template.roles
      .slice()
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map(toProjectTemplateRoleRecord),
    milestones: template.milestones
      .slice()
      .sort((left, right) => left.order - right.order)
      .map(toProjectTemplateMilestoneRecord),
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString(),
  };
}

function toProjectRoleApplicationRecord(application: {
  id: string;
  projectId: string;
  userId: string;
  statement: string;
  availabilityNote: string;
  status: PrismaProjectRoleApplicationStatus;
  submittedAt: Date | null;
  updatedAt: Date;
  preferences: Array<{
    rank: number;
    templateRole: { id: string; key: string; label: string };
  }>;
}): ProjectRoleApplicationRecord {
  return {
    id: application.id,
    projectId: application.projectId,
    userId: application.userId,
    statement: application.statement,
    availabilityNote: application.availabilityNote,
    status:
      application.status === PrismaProjectRoleApplicationStatus.withdrawn
        ? 'withdrawn'
        : 'submitted',
    submittedAt: application.submittedAt ? application.submittedAt.toISOString() : null,
    updatedAt: application.updatedAt.toISOString(),
    preferences: application.preferences
      .slice()
      .sort((left, right) => left.rank - right.rank)
      .map(
        (entry): ProjectRolePreferenceRecord => ({
          templateRoleId: entry.templateRole.id,
          roleKey: entry.templateRole.key,
          roleLabel: entry.templateRole.label,
          rank: entry.rank,
        })
      ),
  };
}

function toTeamProjectRepoRecord(repo: {
  id: string;
  teamId: string;
  owner: string;
  name: string;
  githubRepoId: string | null;
  cloneUrl: string | null;
  defaultBranch: string;
  visibility: RepoVisibility;
  installStatus: string;
  createdAt: Date;
  updatedAt: Date;
}): TeamProjectRepoRecord {
  return {
    id: repo.id,
    teamId: repo.teamId,
    owner: repo.owner,
    name: repo.name,
    githubRepoId: repo.githubRepoId,
    cloneUrl: repo.cloneUrl,
    defaultBranch: repo.defaultBranch,
    visibility: repo.visibility === RepoVisibility.public ? 'public' : 'private',
    installStatus: repo.installStatus,
    createdAt: repo.createdAt.toISOString(),
    updatedAt: repo.updatedAt.toISOString(),
  };
}

function toTeamRecord(team: {
  id: string;
  projectId: string;
  name: string;
  status: PrismaTeamStatus;
  lockedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  members: Array<{
    id: string;
    teamId: string;
    userId: string;
    roleKey: string;
    roleLabel: string;
    status: string;
    createdAt: Date;
    user: { username: string };
  }>;
  repo: {
    id: string;
    teamId: string;
    owner: string;
    name: string;
    githubRepoId: string | null;
    cloneUrl: string | null;
    defaultBranch: string;
    visibility: RepoVisibility;
    installStatus: string;
    createdAt: Date;
    updatedAt: Date;
  } | null;
}): TeamRecord {
  return {
    id: team.id,
    projectId: team.projectId,
    name: team.name,
    status: team.status === PrismaTeamStatus.locked ? 'locked' : 'suggested',
    lockedAt: team.lockedAt ? team.lockedAt.toISOString() : null,
    members: team.members.map(
      (member): TeamMemberRecord => ({
        id: member.id,
        teamId: member.teamId,
        userId: member.userId,
        username: member.user.username,
        roleKey: member.roleKey,
        roleLabel: member.roleLabel,
        status: member.status,
        createdAt: member.createdAt.toISOString(),
      })
    ),
    repo: team.repo ? toTeamProjectRepoRecord(team.repo) : null,
    createdAt: team.createdAt.toISOString(),
    updatedAt: team.updatedAt.toISOString(),
  };
}

function toTeamFormationRunRecord(run: {
  id: string;
  projectId: string;
  algorithmVersion: string;
  configJson: unknown;
  resultJson: unknown;
  createdByUserId: string;
  createdAt: Date;
}): TeamFormationRunRecord {
  return {
    id: run.id,
    projectId: run.projectId,
    algorithmVersion: run.algorithmVersion,
    config:
      run.configJson && typeof run.configJson === 'object'
        ? (run.configJson as Record<string, unknown>)
        : {},
    result:
      run.resultJson && typeof run.resultJson === 'object'
        ? (run.resultJson as TeamFormationRunRecord['result'])
        : { teams: [], waitlist: [], warnings: [] },
    createdByUserId: run.createdByUserId,
    createdAt: run.createdAt.toISOString(),
  };
}

function toCourseRecord(course: {
  id: string;
  slug: string;
  title: string;
  termLabel: string;
  courseCode: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): CourseRecord {
  return {
    id: course.id,
    slug: course.slug,
    title: course.title,
    termLabel: course.termLabel,
    courseCode: course.courseCode,
    isActive: course.isActive,
    createdAt: course.createdAt.toISOString(),
    updatedAt: course.updatedAt.toISOString(),
  };
}

function toMembershipRecord(membership: {
  id: string;
  courseId: string;
  userId: string;
  role: CourseRole;
  level: number;
  createdAt: Date;
  updatedAt: Date;
}): CourseMembershipRecord {
  return {
    id: membership.id,
    courseId: membership.courseId,
    userId: membership.userId,
    role: membership.role as MembershipRole,
    level: membership.level,
    createdAt: membership.createdAt.toISOString(),
    updatedAt: membership.updatedAt.toISOString(),
  };
}

function toProgramRecord(program: {
  id: string;
  slug: string;
  title: string;
  code: string;
  academicYear: string;
  totalUnitRequirement: number;
  status: PrismaProgramStatus;
  activeVersionId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): ProgramRecord {
  return {
    id: program.id,
    slug: program.slug,
    title: program.title,
    code: program.code,
    academicYear: program.academicYear,
    totalUnitRequirement: program.totalUnitRequirement,
    status: program.status as ProgramStatus,
    activeVersionId: program.activeVersionId,
    createdAt: program.createdAt.toISOString(),
    updatedAt: program.updatedAt.toISOString(),
  };
}

function toProgramVersionRecord(version: {
  id: string;
  programId: string;
  versionLabel: string;
  effectiveFrom: Date | null;
  effectiveTo: Date | null;
  isActive: boolean;
  policyText: string;
  trackSelectionMinYear: number;
  createdAt: Date;
  updatedAt: Date;
}): ProgramVersionRecord {
  return {
    id: version.id,
    programId: version.programId,
    versionLabel: version.versionLabel,
    effectiveFrom: version.effectiveFrom?.toISOString() || null,
    effectiveTo: version.effectiveTo?.toISOString() || null,
    isActive: version.isActive,
    policyText: version.policyText,
    trackSelectionMinYear: version.trackSelectionMinYear,
    createdAt: version.createdAt.toISOString(),
    updatedAt: version.updatedAt.toISOString(),
  };
}

function toTrackRecord(track: {
  id: string;
  programVersionId: string;
  slug: string;
  title: string;
  description: string;
  selectionYearStart: number;
  createdAt: Date;
  updatedAt: Date;
}): TrackRecord {
  return {
    id: track.id,
    programVersionId: track.programVersionId,
    slug: track.slug,
    title: track.title,
    description: track.description,
    selectionYearStart: track.selectionYearStart,
    createdAt: track.createdAt.toISOString(),
    updatedAt: track.updatedAt.toISOString(),
  };
}

function toCatalogCourseRecord(course: {
  id: string;
  programId: string;
  subjectCode: string;
  catalogNumber: string;
  title: string;
  defaultUnits: number;
  department: string;
  createdAt: Date;
  updatedAt: Date;
}): CatalogCourseRecord {
  return {
    id: course.id,
    programId: course.programId,
    subjectCode: course.subjectCode,
    catalogNumber: course.catalogNumber,
    title: course.title,
    defaultUnits: course.defaultUnits,
    department: course.department,
    createdAt: course.createdAt.toISOString(),
    updatedAt: course.updatedAt.toISOString(),
  };
}

function toRequirementGroupRecord(group: {
  id: string;
  programVersionId: string;
  trackId: string | null;
  title: string;
  category: PrismaRequirementGroupCategory;
  minUnits: number;
  minCourses: number;
  notes: string;
  sortOrder: number;
  noDoubleCount: boolean;
  createdAt: Date;
  updatedAt: Date;
  rules: Array<{
    id: string;
    requirementGroupId: string;
    ruleType: PrismaRequirementRuleType;
    pickCount: number | null;
    note: string;
    sortOrder: number;
    courses: Array<{
      id: string;
      requirementRuleId: string;
      catalogCourseId: string;
    }>;
  }>;
}): RequirementGroupRecord {
  return {
    id: group.id,
    programVersionId: group.programVersionId,
    trackId: group.trackId,
    title: group.title,
    category: group.category as RequirementGroupCategory,
    minUnits: group.minUnits,
    minCourses: group.minCourses,
    notes: group.notes,
    sortOrder: group.sortOrder,
    noDoubleCount: group.noDoubleCount,
    rules: group.rules.map((rule) => ({
      id: rule.id,
      requirementGroupId: rule.requirementGroupId,
      ruleType: rule.ruleType as RequirementRuleType,
      pickCount: rule.pickCount,
      note: rule.note,
      sortOrder: rule.sortOrder,
      courses: rule.courses.map((course) => ({
        id: course.id,
        requirementRuleId: course.requirementRuleId,
        catalogCourseId: course.catalogCourseId,
      })),
    })),
    createdAt: group.createdAt.toISOString(),
    updatedAt: group.updatedAt.toISOString(),
  };
}

function toStudentProgramRecord(studentProgram: {
  id: string;
  userId: string;
  programVersionId: string;
  selectedTrackId: string | null;
  status: PrismaStudentProgramStatus;
  isLocked: boolean;
  createdAt: Date;
  updatedAt: Date;
}): StudentProgramRecord {
  return {
    id: studentProgram.id,
    userId: studentProgram.userId,
    programVersionId: studentProgram.programVersionId,
    selectedTrackId: studentProgram.selectedTrackId,
    status: studentProgram.status as StudentProgramRecord['status'],
    isLocked: studentProgram.isLocked,
    createdAt: studentProgram.createdAt.toISOString(),
    updatedAt: studentProgram.updatedAt.toISOString(),
  };
}

function toStudentPlannedCourseRecord(plannedCourse: {
  id: string;
  studentProgramId: string;
  catalogCourseId: string;
  plannedYear: number;
  plannedTerm: AcademicTerm;
  sourceType: PrismaPlannedCourseSourceType;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: plannedCourse.id,
    studentProgramId: plannedCourse.studentProgramId,
    catalogCourseId: plannedCourse.catalogCourseId,
    plannedYear: plannedCourse.plannedYear,
    plannedTerm: plannedCourse.plannedTerm as StudentPlannedCourseRecord['plannedTerm'],
    sourceType: plannedCourse.sourceType as PlannedCourseSourceType,
    note: plannedCourse.note,
    createdAt: plannedCourse.createdAt.toISOString(),
    updatedAt: plannedCourse.updatedAt.toISOString(),
  };
}

function toStudentRequirementDecisionRecord(decision: {
  id: string;
  studentProgramId: string;
  requirementGroupId: string;
  status: PrismaStudentRequirementDecisionStatus;
  sourceType: PrismaRequirementDecisionSourceType | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}): StudentRequirementDecisionRecord {
  return {
    id: decision.id,
    studentProgramId: decision.studentProgramId,
    requirementGroupId: decision.requirementGroupId,
    status: decision.status as StudentRequirementDecisionRecord['status'],
    sourceType: decision.sourceType as StudentRequirementDecisionRecord['sourceType'],
    notes: decision.notes,
    createdAt: decision.createdAt.toISOString(),
    updatedAt: decision.updatedAt.toISOString(),
  };
}

function toPetitionRecord(petition: {
  id: string;
  studentProgramId: string;
  type: PrismaPetitionType;
  status: PrismaPetitionStatus;
  justification: string;
  targetRequirementGroupId: string | null;
  submittedByUserId: string;
  reviewerUserId: string | null;
  reviewerNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
  courseLinks: Array<{
    id: string;
    petitionId: string;
    originalCatalogCourseId: string | null;
    substituteCatalogCourseId: string | null;
  }>;
}): PetitionRecord {
  return {
    id: petition.id,
    studentProgramId: petition.studentProgramId,
    type: petition.type as PetitionRecord['type'],
    status: petition.status as PetitionRecord['status'],
    justification: petition.justification,
    targetRequirementGroupId: petition.targetRequirementGroupId,
    submittedByUserId: petition.submittedByUserId,
    reviewerUserId: petition.reviewerUserId,
    reviewerNotes: petition.reviewerNotes,
    createdAt: petition.createdAt.toISOString(),
    updatedAt: petition.updatedAt.toISOString(),
    courseLinks: petition.courseLinks.map((link) => ({
      id: link.id,
      petitionId: link.petitionId,
      originalCatalogCourseId: link.originalCatalogCourseId,
      substituteCatalogCourseId: link.substituteCatalogCourseId,
    })),
  };
}

function toProgramApprovalRecord(approval: {
  id: string;
  studentProgramId: string;
  stage: PrismaApprovalStage;
  status: PrismaApprovalStatus;
  reviewerUserId: string | null;
  notes: string | null;
  decidedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): ProgramApprovalRecord {
  return {
    id: approval.id,
    studentProgramId: approval.studentProgramId,
    stage: approval.stage as ProgramApprovalRecord['stage'],
    status: approval.status as ProgramApprovalRecord['status'],
    reviewerUserId: approval.reviewerUserId,
    notes: approval.notes,
    decidedAt: approval.decidedAt?.toISOString() || null,
    createdAt: approval.createdAt.toISOString(),
    updatedAt: approval.updatedAt.toISOString(),
  };
}

function toProgramSheetSnapshotRecord(snapshot: {
  id: string;
  studentProgramId: string;
  versionId: string;
  renderedPayload: Prisma.JsonValue;
  generatedAt: Date;
}): ProgramSheetSnapshotRecord {
  return {
    id: snapshot.id,
    studentProgramId: snapshot.studentProgramId,
    versionId: snapshot.versionId,
    renderedPayload: (snapshot.renderedPayload || {}) as Record<string, unknown>,
    generatedAt: snapshot.generatedAt.toISOString(),
  };
}

function toMilestoneRecord(milestone: {
  id: string;
  projectId: string;
  title: string;
  description: string;
  order: number;
  dueAt: Date | null;
  isFinal: boolean;
  createdAt: Date;
  updatedAt: Date;
}): MilestoneRecord {
  return {
    id: milestone.id,
    projectId: milestone.projectId,
    title: milestone.title,
    description: milestone.description,
    order: milestone.order,
    dueAt: milestone.dueAt ? milestone.dueAt.toISOString() : null,
    isFinal: milestone.isFinal,
    createdAt: milestone.createdAt.toISOString(),
    updatedAt: milestone.updatedAt.toISOString(),
  };
}

function toReviewRecord(review: {
  id: string;
  submissionAttemptId: string;
  reviewerUserId: string;
  status: ReviewStatus;
  score: number | null;
  feedback: string;
  rubricJson: unknown;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  aiConfidence?: number | null;
  aiNeedsReview?: boolean | null;
  aiReasoningSummary?: string | null;
  aiCriterionScores?: unknown;
  aiEvidenceQuotes?: unknown;
  aiModel?: string | null;
  aiGradedAt?: Date | null;
}): ReviewRecord {
  return {
    id: review.id,
    submissionId: review.submissionAttemptId,
    reviewerUserId: review.reviewerUserId,
    status: review.status as StoreReviewStatus,
    score: review.score,
    feedback: review.feedback,
    rubric: Array.isArray(review.rubricJson)
      ? (review.rubricJson as TrackingRubricItemRecord[])
      : [],
    reviewedAt: review.reviewedAt ? review.reviewedAt.toISOString() : null,
    createdAt: review.createdAt.toISOString(),
    updatedAt: review.updatedAt.toISOString(),
    aiConfidence: review.aiConfidence ?? null,
    aiNeedsReview: review.aiNeedsReview ?? null,
    aiReasoningSummary: review.aiReasoningSummary ?? null,
    aiCriterionScores: Array.isArray(review.aiCriterionScores)
      ? (review.aiCriterionScores as ReviewRecord['aiCriterionScores'])
      : null,
    aiEvidenceQuotes: Array.isArray(review.aiEvidenceQuotes)
      ? (review.aiEvidenceQuotes as string[])
      : null,
    aiModel: review.aiModel ?? null,
    aiGradedAt: review.aiGradedAt ? review.aiGradedAt.toISOString() : null,
  };
}

function toGithubDeliveryRecord(record: {
  id: string;
  submissionAttemptId: string;
  repoUrl: string;
  eventType: string;
  deliveryId: string;
  ref: string;
  commitSha: string;
  payloadJson: unknown;
  receivedAt: Date;
}): GithubDeliveryRecord {
  return {
    id: record.id,
    submissionId: record.submissionAttemptId,
    repoUrl: record.repoUrl,
    eventType: record.eventType,
    deliveryId: record.deliveryId,
    ref: record.ref,
    commitSha: record.commitSha,
    payload: (record.payloadJson as Record<string, unknown> | null) || {},
    receivedAt: record.receivedAt.toISOString(),
  };
}

function toVerificationLogRecord(run: {
  id: string;
  submissionAttemptId: string;
  attempt: number;
  status: SubmissionStatus;
  log: string;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): VerificationLogRecord {
  return {
    id: run.id,
    submissionId: run.submissionAttemptId,
    attempt: run.attempt,
    status: run.status as VerificationLogRecord['status'],
    log: run.log,
    startedAt: run.startedAt ? run.startedAt.toISOString() : null,
    finishedAt: run.finishedAt ? run.finishedAt.toISOString() : null,
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
  };
}

function projectStats(
  milestones: MilestoneRecord[],
  submissions: SubmissionRecord[],
  reviews: ReviewRecord[]
): TrackingDashboardStats {
  const statuses = milestones.map((milestone) => {
    const milestoneSubmissions = submissions
      .filter((entry) => entry.milestoneId === milestone.id)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    if (milestoneSubmissions.length === 0) {
      return 'open';
    }
    const latestReview = reviews
      .filter((entry) => entry.submissionId === milestoneSubmissions[0].id)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
    if (latestReview?.status === 'approved' || latestReview?.status === 'graded') {
      return latestReview.status;
    }
    return 'submitted';
  });
  const approved = statuses.filter((entry) => entry === 'approved' || entry === 'graded').length;
  const underReview = statuses.filter((entry) => entry === 'submitted').length;
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

const latestReleaseInclude = {
  orderBy: { createdAt: 'desc' as const },
  take: 1,
  include: { assets: true },
};

const projectTemplateInclude = {
  include: {
    roles: { orderBy: { sortOrder: 'asc' as const } },
    milestones: { orderBy: { order: 'asc' as const } },
  },
};

function toProjectStarterRecord(args: {
  projectKey: string;
  release?: {
    assets?: Array<{
      kind: string;
      storageKey: string;
    }>;
  };
}): ProjectStarterRecord {
  const starterAsset = args.release?.assets?.find((asset) => asset.kind === 'starter-bundle');
  if (starterAsset) {
    const starter = buildCs106lStarter(args.projectKey);
    return {
      kind: 'bundle',
      storageKey: starterAsset.storageKey,
      fileName: starter.fileName,
    };
  }
  return { kind: 'none' };
}

function toProjectRecord(project: {
  id: string;
  slug: string;
  courseId: string | null;
  templateId?: string | null;
  name: string;
  description: string;
  status: PrismaProjectStatus;
  level: number;
  deliveryMode: DeliveryMode;
  applicationOpenAt?: Date | null;
  applicationCloseAt?: Date | null;
  teamLockAt?: Date | null;
  teamFormationStatus?: PrismaTeamFormationStatus;
  rubricJson: unknown;
  resourcesJson: unknown;
  defaultBranch: string;
  createdAt: Date;
  updatedAt: Date;
  template?: {
    id: string;
    roles: Array<{
      id: string;
      key: string;
      label: string;
      count: number;
      sortOrder: number;
    }>;
    teamSize: number | null;
  } | null;
  releases: Array<{
    manifestJson: unknown;
    taskText: string;
    assets: Array<{ kind: string; storageKey: string }>;
  }>;
}): ProjectRecord {
  const release = project.releases[0];
  return {
    id: project.id,
    projectKey: project.slug,
    slug: project.slug,
    courseId: project.courseId,
    templateId: project.templateId ?? null,
    title: project.name,
    description: project.description,
    status: project.status as ProjectStatus,
    level: project.level,
    deliveryMode: project.deliveryMode === DeliveryMode.team ? 'team' : 'individual',
    teamFormationStatus:
      project.teamFormationStatus === PrismaTeamFormationStatus.application_open
        ? 'application_open'
        : project.teamFormationStatus === PrismaTeamFormationStatus.team_review
          ? 'team_review'
          : project.teamFormationStatus === PrismaTeamFormationStatus.teams_locked
            ? 'teams_locked'
            : 'not_started',
    applicationOpenAt: project.applicationOpenAt?.toISOString() || null,
    applicationCloseAt: project.applicationCloseAt?.toISOString() || null,
    teamLockAt: project.teamLockAt?.toISOString() || null,
    teamSize: project.template?.teamSize ?? null,
    teamRoles: (project.template?.roles || []).map(toProjectTemplateRoleRecord),
    teamName: null,
    assignedRoleLabel: null,
    team: [],
    rubric: Array.isArray(project.rubricJson)
      ? (project.rubricJson as TrackingRubricItemRecord[])
      : [],
    resources: Array.isArray(project.resourcesJson)
      ? (project.resourcesJson as TrackingResourceRecord[])
      : [],
    instructorUserId: null,
    manifest:
      (release?.manifestJson as ProjectRecord['manifest']) || defaultManifest('http://127.0.0.1'),
    task: release?.taskText || defaultTask('http://127.0.0.1'),
    starter: toProjectStarterRecord({ projectKey: project.slug, release }),
    repoByUserId: {},
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}

export class PrismaStore implements AppStore {
  private readonly prisma: PrismaClient;
  private seeded = false;

  constructor(prismaClient?: PrismaClient) {
    this.prisma = prismaClient || new PrismaClient();
  }

  async seed(apiBaseUrl: string): Promise<void> {
    if (this.seeded) {
      return;
    }
    const subject = await this.prisma.subject.upsert({
      where: { slug: 'cs161' },
      update: { name: 'CS161' },
      create: { slug: 'cs161', name: 'CS161' },
    });

    const course = await this.prisma.course.upsert({
      where: { slug: 'cs161' },
      update: {
        title: 'CS 161: Foundations of Systems',
        termLabel: 'Spring 2026',
        courseCode: 'CS161',
        isActive: true,
      },
      create: {
        slug: 'cs161',
        title: 'CS 161: Foundations of Systems',
        termLabel: 'Spring 2026',
        courseCode: 'CS161',
        isActive: true,
      },
    });

    const project = await this.prisma.project.upsert({
      where: { slug: 'cs161/exam1' },
      update: {
        name: 'Exam 1',
        defaultBranch: 'main',
        subjectId: subject.id,
        courseId: course.id,
        description:
          'Design, implement, and defend your solution for the first milestone sequence.',
        status: PrismaProjectStatus.published,
        deliveryMode: DeliveryMode.individual,
        rubricJson: [
          { criterion: 'Correctness', maxScore: 50 },
          { criterion: 'Clarity', maxScore: 30 },
          { criterion: 'Testing', maxScore: 20 },
        ],
        resourcesJson: [
          { label: 'Task brief', url: 'https://example.com/task-brief' },
          { label: 'Reference notes', url: 'https://example.com/reference-notes' },
        ],
      },
      create: {
        slug: 'cs161/exam1',
        name: 'Exam 1',
        defaultBranch: 'main',
        subjectId: subject.id,
        courseId: course.id,
        description:
          'Design, implement, and defend your solution for the first milestone sequence.',
        status: PrismaProjectStatus.published,
        deliveryMode: DeliveryMode.individual,
        rubricJson: [
          { criterion: 'Correctness', maxScore: 50 },
          { criterion: 'Clarity', maxScore: 30 },
          { criterion: 'Testing', maxScore: 20 },
        ],
        resourcesJson: [
          { label: 'Task brief', url: 'https://example.com/task-brief' },
          { label: 'Reference notes', url: 'https://example.com/reference-notes' },
        ],
      },
    });

    const cs106lSubject = await this.prisma.subject.upsert({
      where: { slug: CS106L_COURSE.slug },
      update: { name: CS106L_COURSE.courseCode },
      create: { slug: CS106L_COURSE.slug, name: CS106L_COURSE.courseCode },
    });

    const cs106lCourse = await this.prisma.course.upsert({
      where: { slug: CS106L_COURSE.slug },
      update: {
        title: CS106L_COURSE.title,
        termLabel: CS106L_COURSE.termLabel,
        courseCode: CS106L_COURSE.courseCode,
        isActive: true,
      },
      create: {
        slug: CS106L_COURSE.slug,
        title: CS106L_COURSE.title,
        termLabel: CS106L_COURSE.termLabel,
        courseCode: CS106L_COURSE.courseCode,
        isActive: true,
      },
    });

    await this.prisma.user.upsert({
      where: { email: 'demo@nibras.dev' },
      update: {
        username: 'demo',
        githubLinked: true,
        githubAppInstalled: true,
        systemRole: SystemRole.user,
      },
      create: {
        username: 'demo',
        email: 'demo@nibras.dev',
        githubLinked: true,
        githubAppInstalled: true,
        systemRole: SystemRole.user,
      },
    });

    await this.prisma.user.upsert({
      where: { email: 'instructor@nibras.dev' },
      update: {
        username: 'instructor',
        githubLinked: true,
        githubAppInstalled: true,
        systemRole: SystemRole.admin,
      },
      create: {
        username: 'instructor',
        email: 'instructor@nibras.dev',
        githubLinked: true,
        githubAppInstalled: true,
        systemRole: SystemRole.admin,
      },
    });

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { email: 'demo@nibras.dev' },
    });

    const instructor = await this.prisma.user.findUniqueOrThrow({
      where: { email: 'instructor@nibras.dev' },
    });

    await this.prisma.githubAccount.upsert({
      where: { userId: user.id },
      update: { githubUserId: 'demo-user-id', login: 'demo-user' },
      create: {
        userId: user.id,
        githubUserId: 'demo-user-id',
        login: 'demo-user',
        installationId: 'demo-installation',
      },
    });

    await this.prisma.githubAccount.upsert({
      where: { userId: instructor.id },
      update: { githubUserId: 'instructor-user-id', login: 'nibras-instructor' },
      create: {
        userId: instructor.id,
        githubUserId: 'instructor-user-id',
        login: 'nibras-instructor',
        installationId: 'demo-installation',
      },
    });

    await this.prisma.courseMembership.upsert({
      where: {
        courseId_userId: {
          courseId: course.id,
          userId: user.id,
        },
      },
      update: {
        role: CourseRole.student,
      },
      create: {
        courseId: course.id,
        userId: user.id,
        role: CourseRole.student,
      },
    });

    await this.prisma.courseMembership.upsert({
      where: {
        courseId_userId: {
          courseId: course.id,
          userId: instructor.id,
        },
      },
      update: {
        role: CourseRole.instructor,
      },
      create: {
        courseId: course.id,
        userId: instructor.id,
        role: CourseRole.instructor,
      },
    });

    const manifest = defaultManifest(apiBaseUrl);
    await this.prisma.projectRelease.upsert({
      where: {
        projectId_version: {
          projectId: project.id,
          version: manifest.releaseVersion,
        },
      },
      update: {
        taskText: defaultTask(apiBaseUrl),
        manifestJson: manifest,
      },
      create: {
        projectId: project.id,
        version: manifest.releaseVersion,
        taskText: defaultTask(apiBaseUrl),
        manifestJson: manifest,
        publicAssetRef: 'public://seed',
        privateAssetRef: 'private://seed',
      },
    });

    const milestones = [
      {
        title: 'Design Review',
        description: 'Submit an initial design, edge cases, and implementation plan.',
        order: 1,
        dueAt: new Date('2026-03-27T17:00:00.000Z'),
        isFinal: false,
      },
      {
        title: 'Final Project Submission',
        description: 'Submit the final repository state and project write-up.',
        order: 2,
        dueAt: new Date('2026-04-08T17:00:00.000Z'),
        isFinal: true,
      },
    ];

    for (const milestone of milestones) {
      await this.prisma.milestone
        .upsert({
          where: {
            projectId_order: {
              projectId: project.id,
              order: milestone.order,
            },
          },
          update: milestone,
          create: {
            projectId: project.id,
            ...milestone,
          },
        })
        .catch(async () => {
          const existing = await this.prisma.milestone.findFirst({
            where: {
              projectId: project.id,
              order: milestone.order,
            },
          });
          if (!existing) {
            throw new Error('Unable to seed milestone.');
          }
          await this.prisma.milestone.update({
            where: { id: existing.id },
            data: milestone,
          });
        });
    }

    await this.prisma.courseMembership.upsert({
      where: {
        courseId_userId: {
          courseId: cs106lCourse.id,
          userId: user.id,
        },
      },
      update: {
        role: CourseRole.student,
      },
      create: {
        courseId: cs106lCourse.id,
        userId: user.id,
        role: CourseRole.student,
      },
    });

    await this.prisma.courseMembership.upsert({
      where: {
        courseId_userId: {
          courseId: cs106lCourse.id,
          userId: instructor.id,
        },
      },
      update: {
        role: CourseRole.instructor,
      },
      create: {
        courseId: cs106lCourse.id,
        userId: instructor.id,
        role: CourseRole.instructor,
      },
    });

    for (const definition of listCs106lProjectDefinitions()) {
      const cs106lProject = await this.prisma.project.upsert({
        where: { slug: definition.projectKey },
        update: {
          name: definition.title,
          defaultBranch: 'main',
          subjectId: cs106lSubject.id,
          courseId: cs106lCourse.id,
          description: definition.description,
          status: PrismaProjectStatus.published,
          deliveryMode: DeliveryMode.individual,
          rubricJson: [],
          resourcesJson: [],
        },
        create: {
          slug: definition.projectKey,
          name: definition.title,
          defaultBranch: 'main',
          subjectId: cs106lSubject.id,
          courseId: cs106lCourse.id,
          description: definition.description,
          status: PrismaProjectStatus.published,
          deliveryMode: DeliveryMode.individual,
          rubricJson: [],
          resourcesJson: [],
        },
      });

      const cs106lManifest = buildCs106lManifest(apiBaseUrl, definition.projectKey);
      const starter = buildCs106lStarter(definition.projectKey);
      const release = await this.prisma.projectRelease.upsert({
        where: {
          projectId_version: {
            projectId: cs106lProject.id,
            version: cs106lManifest.releaseVersion,
          },
        },
        update: {
          taskText: readCs106lTaskText(definition.projectKey),
          manifestJson: cs106lManifest,
        },
        create: {
          projectId: cs106lProject.id,
          version: cs106lManifest.releaseVersion,
          taskText: readCs106lTaskText(definition.projectKey),
          manifestJson: cs106lManifest,
          publicAssetRef: 'public://seed',
          privateAssetRef: 'private://seed',
        },
      });

      await this.prisma.projectAsset.deleteMany({
        where: { projectReleaseId: release.id, kind: 'starter-bundle' },
      });
      await this.prisma.projectAsset.create({
        data: {
          projectReleaseId: release.id,
          visibility: AssetVisibility.private,
          kind: 'starter-bundle',
          storageKey: starter.storageKey,
        },
      });

      await this.prisma.milestone.upsert({
        where: {
          projectId_order: {
            projectId: cs106lProject.id,
            order: 1,
          },
        },
        update: {
          title: 'Initial Submission',
          description: definition.milestoneDescription,
          dueAt: null,
          isFinal: true,
        },
        create: {
          projectId: cs106lProject.id,
          title: 'Initial Submission',
          description: definition.milestoneDescription,
          order: 1,
          dueAt: null,
          isFinal: true,
        },
      });
    }

    const programSeed = buildDefaultProgramSeed();
    const seededProgram = await this.prisma.program.upsert({
      where: { slug: programSeed.program.slug },
      update: {
        title: programSeed.program.title,
        code: programSeed.program.code,
        academicYear: programSeed.program.academicYear,
        totalUnitRequirement: programSeed.program.totalUnitRequirement,
        status: programSeed.program.status as PrismaProgramStatus,
      },
      create: {
        slug: programSeed.program.slug,
        title: programSeed.program.title,
        code: programSeed.program.code,
        academicYear: programSeed.program.academicYear,
        totalUnitRequirement: programSeed.program.totalUnitRequirement,
        status: programSeed.program.status as PrismaProgramStatus,
      },
    });

    const seededVersion = await this.prisma.programVersion
      .create({
        data: {
          programId: seededProgram.id,
          versionLabel: programSeed.version.versionLabel,
          effectiveFrom: new Date(),
          isActive: false,
          policyText: programSeed.version.policyText,
          trackSelectionMinYear: programSeed.version.trackSelectionMinYear,
        },
      })
      .catch(async () => {
        const existing = await this.prisma.programVersion.findFirstOrThrow({
          where: {
            programId: seededProgram.id,
            versionLabel: programSeed.version.versionLabel,
          },
        });
        await this.prisma.programVersion.update({
          where: { id: existing.id },
          data: {
            policyText: programSeed.version.policyText,
            trackSelectionMinYear: programSeed.version.trackSelectionMinYear,
            isActive: programSeed.version.isActive,
          },
        });
        return existing;
      });

    await this.prisma.program.update({
      where: { id: seededProgram.id },
      data: { activeVersionId: seededVersion.id },
    });

    const catalogByKey = new Map<string, string>();
    for (const courseSeed of programSeed.catalogCourses) {
      const course = await this.prisma.catalogCourse.upsert({
        where: {
          programId_subjectCode_catalogNumber: {
            programId: seededProgram.id,
            subjectCode: courseSeed.subjectCode,
            catalogNumber: courseSeed.catalogNumber,
          },
        },
        update: {
          title: courseSeed.title,
          defaultUnits: courseSeed.defaultUnits,
          department: courseSeed.department,
        },
        create: {
          programId: seededProgram.id,
          subjectCode: courseSeed.subjectCode,
          catalogNumber: courseSeed.catalogNumber,
          title: courseSeed.title,
          defaultUnits: courseSeed.defaultUnits,
          department: courseSeed.department,
        },
      });
      catalogByKey.set(courseSeed.key, course.id);
    }

    const trackIdBySlug = new Map<string, string>();
    for (const trackSeed of programSeed.tracks) {
      const track = await this.prisma.track.upsert({
        where: {
          programVersionId_slug: {
            programVersionId: seededVersion.id,
            slug: trackSeed.slug,
          },
        },
        update: {
          title: trackSeed.title,
          description: trackSeed.description,
          selectionYearStart: trackSeed.selectionYearStart,
        },
        create: {
          programVersionId: seededVersion.id,
          slug: trackSeed.slug,
          title: trackSeed.title,
          description: trackSeed.description,
          selectionYearStart: trackSeed.selectionYearStart,
        },
      });
      trackIdBySlug.set(track.slug, track.id);
    }

    const allGroups = [
      ...programSeed.sharedGroups.map((group) => ({ ...group, trackId: null as string | null })),
      ...programSeed.tracks.flatMap((track) =>
        track.groups.map((group) => ({
          ...group,
          trackId: trackIdBySlug.get(track.slug) || null,
        }))
      ),
    ];

    for (const groupSeed of allGroups) {
      const requirementGroup = await this.prisma.requirementGroup
        .create({
          data: {
            programVersionId: seededVersion.id,
            trackId: groupSeed.trackId,
            title: groupSeed.title,
            category: groupSeed.category as PrismaRequirementGroupCategory,
            minUnits: groupSeed.minUnits,
            minCourses: groupSeed.minCourses,
            notes: groupSeed.notes,
            sortOrder: groupSeed.sortOrder,
            noDoubleCount: groupSeed.noDoubleCount,
          },
        })
        .catch(async () => {
          const existing = await this.prisma.requirementGroup.findFirstOrThrow({
            where: {
              programVersionId: seededVersion.id,
              trackId: groupSeed.trackId,
              title: groupSeed.title,
            },
          });
          await this.prisma.requirementGroup.update({
            where: { id: existing.id },
            data: {
              category: groupSeed.category as PrismaRequirementGroupCategory,
              minUnits: groupSeed.minUnits,
              minCourses: groupSeed.minCourses,
              notes: groupSeed.notes,
              sortOrder: groupSeed.sortOrder,
              noDoubleCount: groupSeed.noDoubleCount,
            },
          });
          await this.prisma.requirementRule.deleteMany({
            where: { requirementGroupId: existing.id },
          });
          return existing;
        });

      for (const ruleSeed of groupSeed.rules) {
        const rule = await this.prisma.requirementRule.create({
          data: {
            requirementGroupId: requirementGroup.id,
            ruleType: ruleSeed.ruleType as PrismaRequirementRuleType,
            pickCount: ruleSeed.pickCount,
            note: ruleSeed.note,
            sortOrder: ruleSeed.sortOrder,
          },
        });
        await this.prisma.requirementCourse.createMany({
          data: ruleSeed.courseKeys
            .map((courseKey) => catalogByKey.get(courseKey))
            .filter(Boolean)
            .map((catalogCourseId) => ({
              requirementRuleId: rule.id,
              catalogCourseId: catalogCourseId as string,
            })),
          skipDuplicates: true,
        });
      }
    }

    const studentProgram = await this.prisma.studentProgram.findFirst({
      where: { userId: user.id, programVersionId: seededVersion.id },
    });
    if (!studentProgram) {
      const createdStudentProgram = await this.prisma.studentProgram.create({
        data: {
          userId: user.id,
          programVersionId: seededVersion.id,
          status: PrismaStudentProgramStatus.enrolled,
          isLocked: false,
        },
      });
      await this.prisma.programApproval.createMany({
        data: [
          {
            studentProgramId: createdStudentProgram.id,
            stage: PrismaApprovalStage.advisor,
            status: PrismaApprovalStatus.pending,
          },
          {
            studentProgramId: createdStudentProgram.id,
            stage: PrismaApprovalStage.department,
            status: PrismaApprovalStatus.pending,
          },
        ],
        skipDuplicates: true,
      });
    }
    this.seeded = true;
  }

  private async getDefaultUser(): Promise<{ id: string }> {
    return this.prisma.user.findUniqueOrThrow({
      where: { email: 'demo@nibras.dev' },
      select: { id: true },
    });
  }

  private async ensureSeededDemoEnrollments(userId: string): Promise<void> {
    // Auto-enrol every new student in ALL active Year-1 courses so they
    // immediately see the Freshman curriculum without needing a manual invite.
    const year1Courses = await this.prisma.course.findMany({
      where: { isActive: true, termLabel: { startsWith: 'Year 1' } },
      select: { id: true },
    });
    await Promise.all(
      year1Courses.map((course) =>
        this.prisma.courseMembership.upsert({
          where: { courseId_userId: { courseId: course.id, userId } },
          update: {},
          create: { courseId: course.id, userId, role: CourseRole.student },
        })
      )
    );
  }

  private async getProgramBundle(studentProgramId: string): Promise<{
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
  } | null> {
    const studentProgram = await this.prisma.studentProgram.findUnique({
      where: { id: studentProgramId },
      include: {
        user: { include: { githubAccount: true } },
        programVersion: {
          include: {
            program: true,
            tracks: true,
            requirementGroups: {
              include: {
                rules: {
                  include: { courses: true },
                  orderBy: { sortOrder: 'asc' },
                },
              },
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
        selectedTrack: true,
        plannedCourses: true,
        decisions: true,
        petitions: {
          include: { courseLinks: true },
          orderBy: { createdAt: 'desc' },
        },
        approvals: true,
        sheetSnapshots: {
          orderBy: { generatedAt: 'desc' },
          take: 1,
        },
      },
    });
    if (!studentProgram) return null;
    const catalogCourses = await this.prisma.catalogCourse.findMany({
      where: { programId: studentProgram.programVersion.programId },
      orderBy: [{ subjectCode: 'asc' }, { catalogNumber: 'asc' }],
    });
    return {
      studentProgram: toStudentProgramRecord(studentProgram),
      user: toUserRecord(studentProgram.user),
      program: toProgramRecord(studentProgram.programVersion.program),
      version: toProgramVersionRecord(studentProgram.programVersion),
      tracks: studentProgram.programVersion.tracks.map(toTrackRecord),
      selectedTrack: studentProgram.selectedTrack
        ? toTrackRecord(studentProgram.selectedTrack)
        : null,
      catalogCourses: catalogCourses.map(toCatalogCourseRecord),
      requirementGroups:
        studentProgram.programVersion.requirementGroups.map(toRequirementGroupRecord),
      plannedCourses: studentProgram.plannedCourses.map(toStudentPlannedCourseRecord),
      petitions: studentProgram.petitions.map(toPetitionRecord),
      approvals: studentProgram.approvals.map(toProgramApprovalRecord),
      decisions: studentProgram.decisions.map(toStudentRequirementDecisionRecord),
      latestSheetGeneratedAt: studentProgram.sheetSnapshots[0]?.generatedAt.toISOString() || null,
    };
  }

  private async syncProgramDecisions(
    studentProgramId: string
  ): Promise<StudentProgramPlanRecord | null> {
    const bundle = await this.getProgramBundle(studentProgramId);
    if (!bundle) return null;
    const plan = buildStudentProgramPlan(bundle);
    await this.prisma.$transaction([
      this.prisma.studentRequirementDecision.deleteMany({ where: { studentProgramId } }),
      ...plan.decisions.map((decision) =>
        this.prisma.studentRequirementDecision.create({
          data: {
            studentProgramId,
            requirementGroupId: decision.requirementGroupId,
            status: decision.status as PrismaStudentRequirementDecisionStatus,
            sourceType: decision.sourceType as PrismaRequirementDecisionSourceType | undefined,
            notes: decision.notes,
          },
        })
      ),
    ]);
    const refreshed = await this.getProgramBundle(studentProgramId);
    return refreshed ? buildStudentProgramPlan(refreshed) : plan;
  }

  async createSessionForUser(userId: string): Promise<SessionRecord> {
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    const created = await this.prisma.cliSession.create({
      data: {
        userId,
        accessToken: `access_${randomUUID()}`,
        refreshToken: `refresh_${randomUUID()}`,
        expiresAt,
      },
    });
    return {
      accessToken: created.accessToken,
      refreshToken: created.refreshToken,
      userId: created.userId,
      createdAt: created.createdAt.toISOString(),
    };
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
    const email = args.email || `${args.login}@users.noreply.github.com`;
    const username = args.login;

    // Check if a user was pre-created with this GitHub login as their username.
    // This ensures pre-seeded admin/instructor accounts are matched correctly
    // regardless of what email GitHub returns during OAuth.
    const existingByUsername = await this.prisma.user.findUnique({
      where: { username },
    });

    const user = existingByUsername
      ? await this.prisma.user.update({
          where: { id: existingByUsername.id },
          data: { email, githubLinked: true },
        })
      : await this.prisma.user.upsert({
          where: { email },
          update: { username, githubLinked: true },
          create: { username, email, githubLinked: true, githubAppInstalled: false },
        });

    // Encrypt tokens at rest when NIBRAS_ENCRYPTION_KEY is set.
    // Falls back to plaintext in dev so local flow works without the key.
    const maybeEncrypt = (value: string | undefined | null): string | null => {
      if (!value) return null;
      if (!process.env.NIBRAS_ENCRYPTION_KEY) return value;
      try {
        return encryptValue(value);
      } catch {
        return value;
      }
    };

    await this.prisma.githubAccount.upsert({
      where: { userId: user.id },
      update: {
        githubUserId: args.githubUserId,
        login: args.login,
        userAccessToken: maybeEncrypt(args.accessToken),
        userRefreshToken: maybeEncrypt(args.refreshToken),
        userAccessTokenExpiresAt: args.accessTokenExpiresIn
          ? new Date(Date.now() + args.accessTokenExpiresIn * 1000)
          : null,
        userRefreshTokenExpiresAt: args.refreshTokenExpiresIn
          ? new Date(Date.now() + args.refreshTokenExpiresIn * 1000)
          : null,
      },
      create: {
        userId: user.id,
        githubUserId: args.githubUserId,
        login: args.login,
        userAccessToken: maybeEncrypt(args.accessToken),
        userRefreshToken: maybeEncrypt(args.refreshToken),
        userAccessTokenExpiresAt: args.accessTokenExpiresIn
          ? new Date(Date.now() + args.accessTokenExpiresIn * 1000)
          : null,
        userRefreshTokenExpiresAt: args.refreshTokenExpiresIn
          ? new Date(Date.now() + args.refreshTokenExpiresIn * 1000)
          : null,
      },
    });

    const session = await this.createSessionForUser(user.id);
    const hydrated = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      include: { githubAccount: true },
    });

    // Audit: record sign-in event
    await this.prisma.auditLog
      .create({
        data: {
          userId: user.id,
          action: 'user.signed_in',
          targetType: 'User',
          targetId: user.id,
          payload: { login: args.login } as Prisma.InputJsonValue,
        },
      })
      .catch(() => {
        /* non-fatal */
      });

    // Auto-enroll every user in the seeded demo courses so hosted Fly
    // environments are immediately usable for both the JS and C++ flows.
    await Promise.all(
      ['cs161', 'cs106l'].map(async (slug) => {
        try {
          const course = await this.prisma.course.findUnique({ where: { slug } });
          if (!course) {
            return;
          }
          await this.prisma.courseMembership.upsert({
            where: { courseId_userId: { courseId: course.id, userId: user.id } },
            update: {},
            create: { courseId: course.id, userId: user.id, role: CourseRole.student },
          });
        } catch {
          /* non-fatal: enrolment runs again next login */
        }
      })
    );

    return {
      user: toUserRecord(hydrated),
      session,
    };
  }

  async getGithubAccountForUser(userId: string): Promise<{
    login: string;
    installationId: string | null;
    userAccessToken: string | null;
  } | null> {
    const account = await this.prisma.githubAccount.findUnique({
      where: { userId },
    });
    if (!account) {
      return null;
    }
    // Decrypt token if encryption key is configured; fall back to stored value
    const maybeDecrypt = (value: string | null): string | null => {
      if (!value || !process.env.NIBRAS_ENCRYPTION_KEY) return value;
      try {
        return decryptValue(value);
      } catch {
        return value;
      }
    };
    return {
      login: account.login,
      installationId: account.installationId,
      userAccessToken: maybeDecrypt(account.userAccessToken),
    };
  }

  async linkGitHubInstallation(userId: string, installationId: string): Promise<UserRecord> {
    await this.prisma.githubAccount.update({
      where: { userId },
      data: { installationId },
    });
    await this.prisma.user.update({
      where: { id: userId },
      data: { githubAppInstalled: true },
    });
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { githubAccount: true },
    });

    // Audit: record installation link event
    await this.prisma.auditLog
      .create({
        data: {
          userId,
          action: 'installation.linked',
          targetType: 'GithubAccount',
          targetId: userId,
          payload: { installationId } as Prisma.InputJsonValue,
        },
      })
      .catch(() => {
        /* non-fatal */
      });

    return toUserRecord(user);
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
    // Deduplicate: GitHub retries deliveries on failure, skip if already processed
    if (payload.deliveryId) {
      const existing = await this.prisma.githubDelivery.findUnique({
        where: { deliveryId: payload.deliveryId },
      });
      if (existing) return;
    }

    const repoPath = `/${payload.owner}/${payload.repoName}`;
    const branch = branchNameFromRef(payload.ref);
    const submission = await this.prisma.submissionAttempt.findFirst({
      where: {
        submissionType: TrackingSubmissionType.github,
        branch,
        OR: [{ commitSha: payload.after }, { commitSha: { startsWith: 'github-pending-' } }],
        AND: [
          {
            OR: [{ repoUrl: { contains: repoPath } }, { submissionValue: { contains: repoPath } }],
          },
        ],
      },
      include: { project: true },
      orderBy: { createdAt: 'desc' },
    });
    if (!submission) {
      return;
    }
    const attempt = await this.prisma.verificationRun.count({
      where: { submissionAttemptId: submission.id },
    });
    await this.prisma.submissionAttempt.update({
      where: { id: submission.id },
      data: {
        status: SubmissionStatus.running,
        summary: `GitHub push received for ${payload.ref}. Verification is running.`,
        commitSha: payload.after || submission.commitSha,
      },
    });
    await this.prisma.githubDelivery.create({
      data: {
        submissionAttemptId: submission.id,
        repoUrl: payload.repositoryUrl || `https://github.com/${payload.owner}/${payload.repoName}`,
        eventType: payload.eventType || 'push',
        deliveryId: payload.deliveryId || randomUUID(),
        ref: payload.ref,
        commitSha: payload.after,
        payloadJson: (payload.rawPayload || {}) as Prisma.InputJsonValue,
      },
    });
    await this.prisma.verificationRun.create({
      data: {
        submissionAttemptId: submission.id,
        attempt,
        status: SubmissionStatus.running,
        log: `Webhook push received for ${payload.ref}`,
        startedAt: new Date(),
      },
    });
  }

  async createDeviceCode(apiBaseUrl: string): Promise<DeviceCodeRecord> {
    await this.seed(apiBaseUrl);
    const created = await this.prisma.deviceCode.create({
      data: {
        deviceCode: randomUUID(),
        userCode: `NB-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        intervalSeconds: 2,
        status: 'pending',
      },
    });
    return {
      deviceCode: created.deviceCode,
      userCode: created.userCode,
      expiresAt: created.expiresAt.toISOString(),
      intervalSeconds: created.intervalSeconds,
      userId: created.userId,
      status: created.status === 'authorized' ? 'authorized' : 'pending',
    };
  }

  async authorizeDeviceCode(
    apiBaseUrl: string,
    userCode: string,
    userId?: string
  ): Promise<DeviceCodeRecord | null> {
    await this.seed(apiBaseUrl);
    const resolvedUserId = userId ?? (await this.getDefaultUser()).id;
    const found = await this.prisma.deviceCode.findUnique({ where: { userCode } });
    if (!found) {
      return null;
    }
    const updated = await this.prisma.deviceCode.update({
      where: { userCode },
      data: {
        status: 'authorized',
        userId: resolvedUserId,
        approvedAt: new Date(),
      },
    });
    return {
      deviceCode: updated.deviceCode,
      userCode: updated.userCode,
      expiresAt: updated.expiresAt.toISOString(),
      intervalSeconds: updated.intervalSeconds,
      userId: updated.userId,
      status: 'authorized',
    };
  }

  async pollDeviceCode(
    apiBaseUrl: string,
    deviceCode: string
  ): Promise<{ record: DeviceCodeRecord | null; session: SessionRecord | null }> {
    await this.seed(apiBaseUrl);
    const record = await this.prisma.deviceCode.findUnique({ where: { deviceCode } });
    if (!record) {
      return { record: null, session: null };
    }
    const mappedRecord: DeviceCodeRecord = {
      deviceCode: record.deviceCode,
      userCode: record.userCode,
      expiresAt: record.expiresAt.toISOString(),
      intervalSeconds: record.intervalSeconds,
      userId: record.userId,
      status: record.status === 'authorized' ? 'authorized' : 'pending',
    };

    if (record.status !== 'authorized' || !record.userId) {
      return { record: mappedRecord, session: null };
    }

    const existing = await this.prisma.cliSession.findFirst({
      where: { userId: record.userId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) {
      return {
        record: mappedRecord,
        session: {
          accessToken: existing.accessToken,
          refreshToken: existing.refreshToken,
          userId: existing.userId,
          createdAt: existing.createdAt.toISOString(),
        },
      };
    }

    const created = await this.prisma.cliSession.create({
      data: {
        userId: record.userId,
        accessToken: `access_${randomUUID()}`,
        refreshToken: `refresh_${randomUUID()}`,
      },
    });
    return {
      record: mappedRecord,
      session: {
        accessToken: created.accessToken,
        refreshToken: created.refreshToken,
        userId: created.userId,
        createdAt: created.createdAt.toISOString(),
      },
    };
  }

  async getUserByToken(apiBaseUrl: string, accessToken: string): Promise<UserRecord | null> {
    await this.seed(apiBaseUrl);
    const session = await this.prisma.cliSession.findUnique({
      where: { accessToken },
      include: {
        user: {
          include: { githubAccount: true },
        },
      },
    });
    if (!session || session.revokedAt) {
      return null;
    }
    if (session.expiresAt && session.expiresAt < new Date()) {
      return null;
    }
    return toUserRecord(session.user);
  }

  async listUsers(apiBaseUrl: string): Promise<UserRecord[]> {
    await this.seed(apiBaseUrl);
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      include: { githubAccount: true },
    });
    return users.map(toUserRecord);
  }

  async setUserSystemRole(
    apiBaseUrl: string,
    userId: string,
    role: SystemRole
  ): Promise<UserRecord | null> {
    await this.seed(apiBaseUrl);
    const updated = await this.prisma.user
      .update({
        where: { id: userId },
        data: { systemRole: role === 'admin' ? SystemRole.admin : SystemRole.user },
        include: { githubAccount: true },
      })
      .catch(() => null);
    if (!updated) return null;
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'user.roleChanged',
        targetType: 'user',
        targetId: userId,
        payload: { newRole: role } as Prisma.InputJsonValue,
      },
    });
    return toUserRecord(updated);
  }

  async deleteUserAccount(apiBaseUrl: string, userId: string): Promise<void> {
    await this.seed(apiBaseUrl);
    // Run deletion in a transaction to ensure atomicity
    await this.prisma.$transaction(async (tx) => {
      // Revoke all CLI sessions
      await tx.cliSession.updateMany({
        where: { userId },
        data: { revokedAt: new Date() },
      });
      // Revoke all web sessions
      await tx.webSession.updateMany({
        where: { userId },
        data: { revokedAt: new Date() },
      });
      // Anonymise GitHub account (break the link)
      await tx.githubAccount.updateMany({
        where: { userId },
        data: { login: `deleted_${userId}` },
      });
      // Remove course memberships
      await tx.courseMembership.deleteMany({ where: { userId } });
      // Anonymise the user record (GDPR: right to erasure — keep a tombstone for FK integrity)
      await tx.user.update({
        where: { id: userId },
        data: {
          username: `deleted_${userId}`,
          email: `deleted_${userId}@erased.invalid`,
          systemRole: SystemRole.user,
        },
      });
      // Write audit log with the erasure event
      await tx.auditLog.create({
        data: {
          userId,
          action: 'user.accountDeleted',
          targetType: 'user',
          targetId: userId,
          payload: { gdpr: true, erasedAt: new Date().toISOString() } as Prisma.InputJsonValue,
        },
      });
    });
  }

  async refreshCliSession(apiBaseUrl: string, refreshToken: string): Promise<SessionRecord | null> {
    await this.seed(apiBaseUrl);
    const session = await this.prisma.cliSession.findUnique({
      where: { refreshToken },
    });
    if (!session || session.revokedAt) {
      return null;
    }
    // Revoke old session and issue a new one atomically
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const [, created] = await this.prisma.$transaction([
      this.prisma.cliSession.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      }),
      this.prisma.cliSession.create({
        data: {
          userId: session.userId,
          accessToken: `access_${randomUUID()}`,
          refreshToken: `refresh_${randomUUID()}`,
          expiresAt,
        },
      }),
    ]);
    return {
      accessToken: created.accessToken,
      refreshToken: created.refreshToken,
      userId: created.userId,
      createdAt: created.createdAt.toISOString(),
    };
  }

  async deleteSession(apiBaseUrl: string, accessToken: string): Promise<void> {
    await this.seed(apiBaseUrl);
    await this.prisma.cliSession.updateMany({
      where: { accessToken, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async createWebSession(apiBaseUrl: string, userId: string): Promise<WebSessionRecord> {
    await this.seed(apiBaseUrl);
    const created = await this.prisma.webSession.create({
      data: {
        userId,
        sessionToken: `web_${randomUUID()}`,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    return {
      sessionToken: created.sessionToken,
      userId: created.userId,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
      expiresAt: created.expiresAt.toISOString(),
      revokedAt: created.revokedAt ? created.revokedAt.toISOString() : null,
    };
  }

  async getUserByWebSession(apiBaseUrl: string, sessionToken: string): Promise<UserRecord | null> {
    await this.seed(apiBaseUrl);
    const session = await this.prisma.webSession.findUnique({
      where: { sessionToken },
      include: {
        user: {
          include: { githubAccount: true },
        },
      },
    });
    if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
      return null;
    }
    return toUserRecord(session.user);
  }

  async deleteWebSession(apiBaseUrl: string, sessionToken: string): Promise<void> {
    await this.seed(apiBaseUrl);
    await this.prisma.webSession.updateMany({
      where: { sessionToken, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async getProject(apiBaseUrl: string, projectKey: string): Promise<ProjectRecord | null> {
    await this.seed(apiBaseUrl);
    const project = await this.prisma.project.findUnique({
      where: { slug: projectKey },
      include: {
        releases: latestReleaseInclude,
      },
    });
    if (!project || project.releases.length === 0) {
      return null;
    }
    return toProjectRecord(project);
  }

  async provisionProjectRepo(
    apiBaseUrl: string,
    projectKey: string,
    userId: string
  ): Promise<RepoRecord> {
    await this.seed(apiBaseUrl);
    const project = await this.prisma.project.findUnique({ where: { slug: projectKey } });
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { githubAccount: true },
    });
    if (!project || !user || !user.githubAccount) {
      throw new Error('Project or user not found.');
    }
    const existing = await this.prisma.userProjectRepo.findUnique({
      where: {
        userId_projectId: {
          userId,
          projectId: project.id,
        },
      },
    });
    if (existing) {
      return {
        owner: existing.owner,
        name: existing.name,
        cloneUrl: existing.cloneUrl,
        defaultBranch: existing.defaultBranch,
        visibility: existing.visibility === RepoVisibility.private ? 'private' : 'public',
      };
    }

    const created = await this.prisma.userProjectRepo.create({
      data: {
        userId,
        projectId: project.id,
        owner: user.githubAccount.login,
        name: `nibras-${projectKey.replace('/', '-')}`,
        defaultBranch: project.defaultBranch,
        visibility: RepoVisibility.private,
        installStatus: 'provisioned',
      },
    });
    return {
      owner: created.owner,
      name: created.name,
      cloneUrl: created.cloneUrl,
      defaultBranch: created.defaultBranch,
      visibility: 'private',
    };
  }

  async provisionProjectRepoFromGitHub(
    apiBaseUrl: string,
    projectKey: string,
    userId: string,
    githubConfig: GitHubAppConfig
  ): Promise<RepoRecord> {
    const account = await this.getGithubAccountForUser(userId);
    const project = await this.prisma.project.findUnique({
      where: { slug: projectKey },
      include: {
        releases: latestReleaseInclude,
      },
    });
    if (!account?.userAccessToken || !project) {
      throw new Error('GitHub account or project is not ready for provisioning.');
    }
    const hydratedProject = toProjectRecord(project);
    const repoName = `nibras-${projectKey.replace('/', '-')}`;
    const generated =
      hydratedProject.starter.kind === 'bundle'
        ? await createPrivateRepository(
            githubConfig,
            account.userAccessToken,
            account.login,
            repoName
          )
        : await generateRepositoryFromTemplate(
            githubConfig,
            account.userAccessToken,
            account.login,
            repoName
          );
    const record = await this.prisma.userProjectRepo.upsert({
      where: {
        userId_projectId: {
          userId,
          projectId: project.id,
        },
      },
      update: {
        owner: account.login,
        name: repoName,
        cloneUrl: generated.cloneUrl,
        defaultBranch: project.defaultBranch,
        visibility: RepoVisibility.private,
        installStatus: 'provisioned',
      },
      create: {
        userId,
        projectId: project.id,
        owner: account.login,
        name: repoName,
        cloneUrl: generated.cloneUrl,
        defaultBranch: project.defaultBranch,
        visibility: RepoVisibility.private,
        installStatus: 'provisioned',
      },
    });
    return {
      owner: record.owner,
      name: record.name,
      cloneUrl: record.cloneUrl,
      defaultBranch: record.defaultBranch,
      visibility: record.visibility === RepoVisibility.private ? 'private' : 'public',
    };
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
    await this.seed(apiBaseUrl);
    const project = await this.prisma.project.findUnique({
      where: { slug: payload.projectKey },
      include: {
        releases: latestReleaseInclude,
        milestones: { orderBy: { order: 'asc' } },
      },
    });
    if (!project || project.releases.length === 0) {
      throw new Error('Project release not found.');
    }
    // Auto-assign the latest (highest order) milestone for this project
    const latestMilestone =
      project.milestones.length > 0 ? project.milestones[project.milestones.length - 1] : null;
    const repo = await this.prisma.userProjectRepo.findUnique({
      where: {
        userId_projectId: {
          userId: payload.userId,
          projectId: project.id,
        },
      },
    });
    if (!repo) {
      throw new Error('Provisioned repository not found for user.');
    }
    const existing = await this.prisma.submissionAttempt.findFirst({
      where: {
        userId: payload.userId,
        projectId: project.id,
        commitSha: payload.commitSha,
      },
      include: { project: true },
    });
    if (existing) {
      return toSubmissionRecord(existing);
    }
    try {
      const { created, vJobId } = await this.prisma.$transaction(async (tx) => {
        const submission = await tx.submissionAttempt.create({
          data: {
            userId: payload.userId,
            projectId: project.id,
            projectReleaseId: project.releases[0].id,
            userProjectRepoId: repo.id,
            milestoneId: latestMilestone?.id ?? null,
            commitSha: payload.commitSha,
            repoUrl: payload.repoUrl,
            branch: payload.branch,
            status: SubmissionStatus.queued,
            summary: 'Submission queued for verification.',
            submissionType: TrackingSubmissionType.github,
            submissionValue: payload.repoUrl,
            submittedAt: new Date(),
          },
          include: { project: true },
        });
        await tx.verificationRun.create({
          data: {
            submissionAttemptId: submission.id,
            attempt: 0,
            status: SubmissionStatus.queued,
            log: 'Queued',
          },
        });
        const vJob = await tx.verificationJob.create({
          data: {
            submissionAttemptId: submission.id,
            status: SubmissionStatus.queued,
          },
        });
        return { created: submission, vJobId: vJob.id };
      });
      // Enqueue to BullMQ if Redis is configured; no-op otherwise (worker polls DB)
      void enqueueVerificationJob({
        jobId: vJobId,
        submissionAttemptId: created.id,
        attempt: 0,
        maxAttempts: 3,
      });
      return toSubmissionRecord(created);
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
        throw error;
      }
      const duplicate = await this.prisma.submissionAttempt.findFirst({
        where: {
          userId: payload.userId,
          projectId: project.id,
          commitSha: payload.commitSha,
        },
        include: { project: true },
      });
      if (!duplicate) {
        throw error;
      }
      return toSubmissionRecord(duplicate);
    }
  }

  async updateLocalTestResult(
    apiBaseUrl: string,
    submissionId: string,
    requesterUserId: string,
    exitCode: number,
    summary: string
  ): Promise<SubmissionRecord | null> {
    await this.seed(apiBaseUrl);
    const updated = await this.prisma.submissionAttempt.updateMany({
      where: { id: submissionId, userId: requesterUserId },
      data: {
        localTestExitCode: exitCode,
        summary,
      },
    });
    if (updated.count === 0) {
      return null;
    }
    return this.getSubmission(apiBaseUrl, submissionId, requesterUserId);
  }

  async getSubmission(
    apiBaseUrl: string,
    submissionId: string,
    requesterUserId: string
  ): Promise<SubmissionRecord | null> {
    await this.seed(apiBaseUrl);
    const submission = await this.prisma.submissionAttempt.findFirst({
      where: { id: submissionId, userId: requesterUserId },
      include: { project: true, team: { include: { members: true } } },
    });
    if (!submission) {
      return null;
    }
    return toSubmissionRecord(submission);
  }

  async getSubmissionForAdmin(
    apiBaseUrl: string,
    submissionId: string
  ): Promise<SubmissionRecord | null> {
    await this.seed(apiBaseUrl);
    const submission = await this.prisma.submissionAttempt.findUnique({
      where: { id: submissionId },
      include: { project: true, team: { include: { members: true } } },
    });
    return submission ? toSubmissionRecord(submission) : null;
  }

  async overrideSubmissionStatus(
    apiBaseUrl: string,
    submissionId: string,
    status: SubmissionRecord['status'],
    summary: string,
    actorUserId: string
  ): Promise<SubmissionRecord | null> {
    await this.seed(apiBaseUrl);
    const existing = await this.prisma.submissionAttempt.findUnique({
      where: { id: submissionId },
      include: { project: true },
    });
    if (!existing) {
      return null;
    }
    const nextAttempt = await this.prisma.verificationRun.count({
      where: { submissionAttemptId: submissionId },
    });
    const { updated, retryJobId } = await this.prisma.$transaction(async (tx) => {
      const submission = await tx.submissionAttempt.update({
        where: { id: submissionId },
        data: {
          status: status as SubmissionStatus,
          summary,
        },
        include: { project: true },
      });
      // For retry: reset job to queued; for other overrides: mark finished
      let newJobId: string | null = null;
      if (status === 'queued') {
        // Create a fresh job for re-queuing
        await tx.verificationJob.updateMany({
          where: { submissionAttemptId: submissionId },
          data: { status: SubmissionStatus.queued, finishedAt: null, claimedAt: null },
        });
        const existingJob = await tx.verificationJob.findFirst({
          where: { submissionAttemptId: submissionId },
          select: { id: true },
        });
        newJobId = existingJob?.id ?? null;
      } else {
        await tx.verificationJob.updateMany({
          where: { submissionAttemptId: submissionId },
          data: {
            status: status as SubmissionStatus,
            finishedAt: new Date(),
            claimedAt: null,
          },
        });
      }
      await tx.verificationRun.create({
        data: {
          submissionAttemptId: submissionId,
          attempt: nextAttempt,
          status: status as SubmissionStatus,
          log: `Manual override by ${actorUserId}: ${summary}`,
          startedAt: new Date(),
          finishedAt: new Date(),
        },
      });
      await tx.auditLog.create({
        data: {
          userId: actorUserId,
          courseId: existing.project.courseId,
          projectId: existing.projectId,
          milestoneId: existing.milestoneId,
          submissionAttemptId: submissionId,
          action: 'submission.overridden',
          targetType: 'submission',
          targetId: submissionId,
          payload: {
            previousStatus: existing.status,
            nextStatus: status,
            summary,
          } as Prisma.InputJsonValue,
        },
      });
      return { updated: submission, retryJobId: newJobId };
    });
    // If re-queued for retry, enqueue to BullMQ (no-op when Redis not configured)
    if (status === 'queued' && retryJobId) {
      void enqueueVerificationJob({
        jobId: retryJobId,
        submissionAttemptId: submissionId,
        attempt: nextAttempt,
        maxAttempts: 3,
      });
    }
    return toSubmissionRecord(updated);
  }

  async listSubmissionVerificationLogs(
    apiBaseUrl: string,
    submissionId: string
  ): Promise<VerificationLogRecord[]> {
    await this.seed(apiBaseUrl);
    const runs = await this.prisma.verificationRun.findMany({
      where: { submissionAttemptId: submissionId },
      orderBy: [{ attempt: 'desc' }, { createdAt: 'desc' }],
    });
    return runs.map(toVerificationLogRecord);
  }

  async listCourseMemberships(
    apiBaseUrl: string,
    userId: string
  ): Promise<CourseMembershipRecord[]> {
    await this.seed(apiBaseUrl);
    await this.ensureSeededDemoEnrollments(userId);
    const memberships = await this.prisma.courseMembership.findMany({
      where: { userId },
    });
    return memberships.map(toMembershipRecord);
  }

  async listTrackingCourses(
    apiBaseUrl: string,
    userId: string,
    opts?: PaginationOpts
  ): Promise<CourseRecord[]> {
    await this.seed(apiBaseUrl);
    await this.ensureSeededDemoEnrollments(userId);
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const take = opts?.limit;
    const skip = take !== undefined ? (opts?.offset ?? 0) : undefined;
    if (user.systemRole === SystemRole.admin) {
      const courses = await this.prisma.course.findMany({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      });
      return courses.map(toCourseRecord);
    }
    // Use the global yearLevel on User as the single source of truth.
    const studentLevel = (user as { yearLevel?: number }).yearLevel ?? 1;

    // Show every active course that belongs to the student's current year so
    // they always see the full curriculum for their level, even if an admin
    // adds a new course after initial enrolment.
    const yearCourses = await this.prisma.course.findMany({
      where: { isActive: true, termLabel: { startsWith: `Year ${studentLevel}` } },
      orderBy: { createdAt: 'asc' },
      take,
      skip,
    });
    return yearCourses.map(toCourseRecord);
  }

  async countTrackingCourses(apiBaseUrl: string, userId: string): Promise<number> {
    await this.seed(apiBaseUrl);
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.systemRole === SystemRole.admin) {
      return this.prisma.course.count({ where: { isActive: true } });
    }
    const studentLevel = (user as { yearLevel?: number }).yearLevel ?? 1;
    return this.prisma.course.count({
      where: { isActive: true, termLabel: { startsWith: `Year ${studentLevel}` } },
    });
  }

  async createTrackingCourse(
    apiBaseUrl: string,
    userId: string,
    payload: { slug: string; title: string; termLabel: string; courseCode: string }
  ): Promise<CourseRecord> {
    await this.seed(apiBaseUrl);
    const course = await this.prisma.$transaction(async (tx) => {
      const created = await tx.course.create({
        data: {
          slug: payload.slug,
          title: payload.title,
          termLabel: payload.termLabel,
          courseCode: payload.courseCode,
          isActive: true,
        },
      });
      // Automatically enroll the creator as instructor
      await tx.courseMembership.create({
        data: {
          courseId: created.id,
          userId,
          role: CourseRole.instructor,
        },
      });
      return created;
    });
    return toCourseRecord(course);
  }

  async deleteTrackingCourse(apiBaseUrl: string, courseId: string): Promise<boolean> {
    await this.seed(apiBaseUrl);
    const deleted = await this.prisma.course.delete({ where: { id: courseId } }).catch(() => null);
    return deleted !== null;
  }

  async listPrograms(apiBaseUrl: string): Promise<ProgramRecord[]> {
    await this.seed(apiBaseUrl);
    const programs = await this.prisma.program.findMany({ orderBy: { createdAt: 'asc' } });
    return programs.map(toProgramRecord);
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
    await this.seed(apiBaseUrl);
    const program = await this.prisma.program.create({
      data: {
        slug: payload.slug,
        title: payload.title,
        code: payload.code,
        academicYear: payload.academicYear,
        totalUnitRequirement: payload.totalUnitRequirement,
        status: payload.status as PrismaProgramStatus,
      },
    });
    return toProgramRecord(program);
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
    await this.seed(apiBaseUrl);
    const version = await this.prisma.$transaction(async (tx) => {
      if (payload.isActive) {
        await tx.programVersion.updateMany({
          where: { programId },
          data: { isActive: false },
        });
      }
      const created = await tx.programVersion.create({
        data: {
          programId,
          versionLabel: payload.versionLabel,
          effectiveFrom: payload.effectiveFrom ? new Date(payload.effectiveFrom) : null,
          effectiveTo: payload.effectiveTo ? new Date(payload.effectiveTo) : null,
          isActive: payload.isActive,
          policyText: payload.policyText,
          trackSelectionMinYear: payload.trackSelectionMinYear,
        },
      });
      if (payload.isActive) {
        await tx.program.update({
          where: { id: programId },
          data: { activeVersionId: created.id },
        });
      }
      return created;
    });
    return toProgramVersionRecord(version);
  }

  async getProgramVersionDetail(
    apiBaseUrl: string,
    programId: string,
    versionId: string
  ): Promise<ProgramVersionDetailRecord | null> {
    await this.seed(apiBaseUrl);
    const version = await this.prisma.programVersion.findFirst({
      where: { id: versionId, programId },
      include: {
        program: true,
        tracks: true,
        requirementGroups: {
          include: {
            rules: { include: { courses: true }, orderBy: { sortOrder: 'asc' } },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
    if (!version) return null;
    const catalogCourses = await this.prisma.catalogCourse.findMany({
      where: { programId },
      orderBy: [{ subjectCode: 'asc' }, { catalogNumber: 'asc' }],
    });
    return {
      program: toProgramRecord(version.program),
      version: toProgramVersionRecord(version),
      tracks: version.tracks.map(toTrackRecord),
      catalogCourses: catalogCourses.map(toCatalogCourseRecord),
      requirementGroups: version.requirementGroups.map(toRequirementGroupRecord),
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
    await this.seed(apiBaseUrl);
    const course = await this.prisma.catalogCourse.create({
      data: {
        programId,
        subjectCode: payload.subjectCode,
        catalogNumber: payload.catalogNumber,
        title: payload.title,
        defaultUnits: payload.defaultUnits,
        department: payload.department,
      },
    });
    return toCatalogCourseRecord(course);
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
    await this.seed(apiBaseUrl);
    const group = await this.prisma.requirementGroup.create({
      data: {
        programVersionId: payload.programVersionId,
        trackId: payload.trackId,
        title: payload.title,
        category: payload.category as PrismaRequirementGroupCategory,
        minUnits: payload.minUnits,
        minCourses: payload.minCourses,
        notes: payload.notes,
        sortOrder: payload.sortOrder,
        noDoubleCount: payload.noDoubleCount,
        rules: {
          create: payload.rules.map((rule) => ({
            ruleType: rule.ruleType as PrismaRequirementRuleType,
            pickCount: rule.pickCount,
            note: rule.note,
            sortOrder: rule.sortOrder,
            courses: {
              create: rule.courses.map((course) => ({
                catalogCourseId: course.catalogCourseId,
              })),
            },
          })),
        },
      },
      include: {
        rules: { include: { courses: true }, orderBy: { sortOrder: 'asc' } },
      },
    });
    return toRequirementGroupRecord(group);
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
    await this.seed(apiBaseUrl);
    const existing = await this.prisma.requirementGroup.findUnique({ where: { id: groupId } });
    if (!existing) return null;
    if (payload.rules !== undefined) {
      await this.prisma.requirementRule.deleteMany({ where: { requirementGroupId: groupId } });
    }
    const updated = await this.prisma.requirementGroup.update({
      where: { id: groupId },
      data: {
        trackId: payload.trackId,
        title: payload.title,
        category: payload.category as PrismaRequirementGroupCategory | undefined,
        minUnits: payload.minUnits,
        minCourses: payload.minCourses,
        notes: payload.notes,
        sortOrder: payload.sortOrder,
        noDoubleCount: payload.noDoubleCount,
        rules:
          payload.rules !== undefined
            ? {
                create: payload.rules.map((rule) => ({
                  ruleType: rule.ruleType as PrismaRequirementRuleType,
                  pickCount: rule.pickCount,
                  note: rule.note,
                  sortOrder: rule.sortOrder,
                  courses: {
                    create: rule.courses.map((course) => ({
                      catalogCourseId: course.catalogCourseId,
                    })),
                  },
                })),
              }
            : undefined,
      },
      include: {
        rules: { include: { courses: true }, orderBy: { sortOrder: 'asc' } },
      },
    });
    return toRequirementGroupRecord(updated);
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
    await this.seed(apiBaseUrl);
    const track = await this.prisma.track.create({
      data: {
        programVersionId: payload.programVersionId,
        slug: payload.slug,
        title: payload.title,
        description: payload.description,
        selectionYearStart: payload.selectionYearStart,
      },
    });
    return toTrackRecord(track);
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
    await this.seed(apiBaseUrl);
    const existing = await this.prisma.track.findUnique({ where: { id: trackId } });
    if (!existing) return null;
    const track = await this.prisma.track.update({
      where: { id: trackId },
      data: payload,
    });
    return toTrackRecord(track);
  }

  async enrollInProgram(
    apiBaseUrl: string,
    userId: string,
    programId: string
  ): Promise<StudentProgramPlanRecord> {
    await this.seed(apiBaseUrl);
    const version =
      (await this.prisma.programVersion.findFirst({
        where: { programId, isActive: true },
        orderBy: { createdAt: 'desc' },
      })) ||
      (await this.prisma.programVersion.findFirstOrThrow({
        where: { programId },
        orderBy: { createdAt: 'desc' },
      }));

    let studentProgram = await this.prisma.studentProgram.findFirst({
      where: { userId, programVersion: { programId } },
    });
    if (!studentProgram) {
      studentProgram = await this.prisma.studentProgram.create({
        data: {
          userId,
          programVersionId: version.id,
          status: PrismaStudentProgramStatus.enrolled,
          isLocked: false,
          approvals: {
            create: [
              { stage: PrismaApprovalStage.advisor, status: PrismaApprovalStatus.pending },
              { stage: PrismaApprovalStage.department, status: PrismaApprovalStatus.pending },
            ],
          },
        },
      });
    }
    const plan = await this.syncProgramDecisions(studentProgram.id);
    if (!plan) throw new Error('Failed to build student program plan.');
    return plan;
  }

  async getStudentProgramPlan(
    apiBaseUrl: string,
    userId: string
  ): Promise<StudentProgramPlanRecord | null> {
    await this.seed(apiBaseUrl);
    const studentProgram = await this.prisma.studentProgram.findFirst({ where: { userId } });
    if (!studentProgram) return null;
    return this.syncProgramDecisions(studentProgram.id);
  }

  async selectStudentTrack(
    apiBaseUrl: string,
    userId: string,
    trackId: string
  ): Promise<StudentProgramPlanRecord | null> {
    await this.seed(apiBaseUrl);
    const studentProgram = await this.prisma.studentProgram.findFirst({
      where: { userId },
      include: { programVersion: true, user: true },
    });
    const track = await this.prisma.track.findUnique({ where: { id: trackId } });
    if (!studentProgram || !track) return null;
    if (studentProgram.user.yearLevel < studentProgram.programVersion.trackSelectionMinYear) {
      return null;
    }
    await this.prisma.studentProgram.update({
      where: { id: studentProgram.id },
      data: {
        selectedTrackId: track.id,
        status: PrismaStudentProgramStatus.track_selected,
      },
    });
    return this.syncProgramDecisions(studentProgram.id);
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
    await this.seed(apiBaseUrl);
    const studentProgram = await this.prisma.studentProgram.findFirst({ where: { userId } });
    if (!studentProgram || studentProgram.isLocked) return null;
    await this.prisma.$transaction([
      this.prisma.studentPlannedCourse.deleteMany({
        where: { studentProgramId: studentProgram.id },
      }),
      ...payload.plannedCourses.map((course) =>
        this.prisma.studentPlannedCourse.create({
          data: {
            studentProgramId: studentProgram.id,
            catalogCourseId: course.catalogCourseId,
            plannedYear: course.plannedYear,
            plannedTerm: course.plannedTerm,
            sourceType: course.sourceType as PrismaPlannedCourseSourceType,
            note: course.note,
          },
        })
      ),
    ]);
    return this.syncProgramDecisions(studentProgram.id);
  }

  async getStudentProgramSheet(
    apiBaseUrl: string,
    userId: string
  ): Promise<ProgramSheetViewRecord | null> {
    await this.seed(apiBaseUrl);
    const studentProgram = await this.prisma.studentProgram.findFirst({ where: { userId } });
    if (!studentProgram) return null;
    const bundle = await this.getProgramBundle(studentProgram.id);
    return bundle ? buildProgramSheet(bundle) : null;
  }

  async generateStudentProgramSheet(
    apiBaseUrl: string,
    userId: string
  ): Promise<ProgramSheetViewRecord | null> {
    await this.seed(apiBaseUrl);
    const studentProgram = await this.prisma.studentProgram.findFirst({ where: { userId } });
    if (!studentProgram) return null;
    const plan = await this.syncProgramDecisions(studentProgram.id);
    if (!plan) return null;
    const bundle = await this.getProgramBundle(studentProgram.id);
    if (!bundle) return null;
    const generatedAt = new Date().toISOString();
    const sheet = buildProgramSheet({ ...bundle, generatedAt });
    await this.prisma.programSheetSnapshot.create({
      data: {
        studentProgramId: studentProgram.id,
        versionId: bundle.version.id,
        renderedPayload: sheet as unknown as Prisma.InputJsonValue,
        generatedAt: new Date(generatedAt),
      },
    });
    return sheet;
  }

  async createStudentPetition(
    apiBaseUrl: string,
    userId: string,
    payload: {
      type: PetitionRecord['type'];
      justification: string;
      targetRequirementGroupId: string | null;
      originalCatalogCourseId: string | null;
      substituteCatalogCourseId: string | null;
    }
  ): Promise<PetitionRecord | null> {
    await this.seed(apiBaseUrl);
    const studentProgram = await this.prisma.studentProgram.findFirst({ where: { userId } });
    if (!studentProgram) return null;
    const petition = await this.prisma.petition.create({
      data: {
        studentProgramId: studentProgram.id,
        type: payload.type as PrismaPetitionType,
        status: PrismaPetitionStatus.pending_advisor,
        justification: payload.justification,
        targetRequirementGroupId: payload.targetRequirementGroupId,
        submittedByUserId: userId,
        courseLinks:
          payload.originalCatalogCourseId || payload.substituteCatalogCourseId
            ? {
                create: [
                  {
                    originalCatalogCourseId: payload.originalCatalogCourseId,
                    substituteCatalogCourseId: payload.substituteCatalogCourseId,
                  },
                ],
              }
            : undefined,
      },
      include: { courseLinks: true },
    });
    return toPetitionRecord(petition);
  }

  async listStudentPetitions(apiBaseUrl: string, userId: string): Promise<PetitionRecord[]> {
    await this.seed(apiBaseUrl);
    const studentProgram = await this.prisma.studentProgram.findFirst({ where: { userId } });
    if (!studentProgram) return [];
    const petitions = await this.prisma.petition.findMany({
      where: { studentProgramId: studentProgram.id },
      include: { courseLinks: true },
      orderBy: { createdAt: 'desc' },
    });
    return petitions.map(toPetitionRecord);
  }

  async listProgramPetitions(apiBaseUrl: string, programId: string): Promise<PetitionRecord[]> {
    await this.seed(apiBaseUrl);
    const petitions = await this.prisma.petition.findMany({
      where: { studentProgram: { programVersion: { programId } } },
      include: { courseLinks: true },
      orderBy: { createdAt: 'desc' },
    });
    return petitions.map(toPetitionRecord);
  }

  async updateProgramPetition(
    apiBaseUrl: string,
    _programId: string,
    petitionId: string,
    reviewerUserId: string,
    payload: { status: PetitionRecord['status']; reviewerNotes: string | null }
  ): Promise<PetitionRecord | null> {
    await this.seed(apiBaseUrl);
    const existing = await this.prisma.petition.findUnique({ where: { id: petitionId } });
    if (!existing) return null;
    const petition = await this.prisma.petition.update({
      where: { id: petitionId },
      data: {
        status: payload.status as PrismaPetitionStatus,
        reviewerUserId,
        reviewerNotes: payload.reviewerNotes,
      },
      include: { courseLinks: true },
    });
    return toPetitionRecord(petition);
  }

  async setProgramApproval(
    apiBaseUrl: string,
    _programId: string,
    studentProgramId: string,
    stage: ProgramApprovalRecord['stage'],
    reviewerUserId: string,
    payload: { status: ProgramApprovalRecord['status']; notes: string | null }
  ): Promise<ProgramApprovalRecord | null> {
    await this.seed(apiBaseUrl);
    if (stage === 'department') {
      const advisor = await this.prisma.programApproval.findUnique({
        where: { studentProgramId_stage: { studentProgramId, stage: PrismaApprovalStage.advisor } },
      });
      if (!advisor || advisor.status !== PrismaApprovalStatus.approved) {
        return null;
      }
    }
    const approval = await this.prisma.programApproval
      .update({
        where: {
          studentProgramId_stage: { studentProgramId, stage: stage as PrismaApprovalStage },
        },
        data: {
          status: payload.status as PrismaApprovalStatus,
          reviewerUserId,
          notes: payload.notes,
          decidedAt: new Date(),
        },
      })
      .catch(() => null);
    if (!approval) return null;
    await this.prisma.studentProgram.update({
      where: { id: studentProgramId },
      data: {
        status:
          payload.status === 'rejected'
            ? PrismaStudentProgramStatus.track_selected
            : stage === 'advisor'
              ? PrismaStudentProgramStatus.advisor_approved
              : PrismaStudentProgramStatus.department_approved,
        isLocked: payload.status === 'approved',
      },
    });
    return toProgramApprovalRecord(approval);
  }

  async listCourseMembersForInstructor(
    apiBaseUrl: string,
    courseId: string
  ): Promise<Array<CourseMembershipRecord & { username: string; githubLogin: string }>> {
    await this.seed(apiBaseUrl);
    const memberships = await this.prisma.courseMembership.findMany({
      where: { courseId },
      include: { user: { include: { githubAccount: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return memberships.map((m) => ({
      id: m.id,
      courseId: m.courseId,
      userId: m.userId,
      role: m.role as CourseMembershipRecord['role'],
      level: m.level,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
      username: m.user.username,
      githubLogin: m.user.githubAccount?.login || m.user.username,
    }));
  }

  async addCourseMember(
    apiBaseUrl: string,
    courseId: string,
    githubLogin: string,
    role: CourseMembershipRecord['role']
  ): Promise<CourseMembershipRecord & { username: string; githubLogin: string }> {
    await this.seed(apiBaseUrl);
    const account = await this.prisma.githubAccount.findFirst({
      where: { login: githubLogin },
      include: { user: true },
    });
    if (!account) {
      throw Object.assign(new Error(`No user found with GitHub login "${githubLogin}".`), {
        statusCode: 404,
      });
    }
    const existing = await this.prisma.courseMembership.findFirst({
      where: { courseId, userId: account.userId },
    });
    if (existing) {
      throw Object.assign(new Error('User is already a member of this course.'), {
        statusCode: 409,
      });
    }
    const membership = await this.prisma.courseMembership.create({
      data: { courseId, userId: account.userId, role: role as CourseRole },
    });
    await this.prisma.auditLog.create({
      data: {
        userId: account.userId,
        courseId,
        action: 'member.added',
        targetType: 'courseMembership',
        targetId: membership.id,
        payload: { githubLogin, role } as Prisma.InputJsonValue,
      },
    });
    return {
      id: membership.id,
      courseId: membership.courseId,
      userId: membership.userId,
      role: membership.role as CourseMembershipRecord['role'],
      level: membership.level,
      createdAt: membership.createdAt.toISOString(),
      updatedAt: membership.updatedAt.toISOString(),
      username: account.user.username,
      githubLogin: account.login,
    };
  }

  async removeCourseMember(apiBaseUrl: string, courseId: string, userId: string): Promise<void> {
    await this.seed(apiBaseUrl);
    await this.prisma.courseMembership.deleteMany({ where: { courseId, userId } });
    await this.prisma.auditLog.create({
      data: {
        userId,
        courseId,
        action: 'member.removed',
        targetType: 'courseMembership',
        targetId: `${courseId}:${userId}`,
        payload: { removedUserId: userId } as Prisma.InputJsonValue,
      },
    });
  }

  async updateStudentLevel(
    apiBaseUrl: string,
    courseId: string,
    userId: string,
    level: number
  ): Promise<CourseMembershipRecord | null> {
    await this.seed(apiBaseUrl);
    await this.syncStudentYear(userId, level);
    const membership = await this.prisma.courseMembership.findFirst({
      where: { courseId, userId, role: CourseRole.student },
    });
    return membership ? toMembershipRecord(membership) : null;
  }

  /** Atomically update User.yearLevel, sync all student memberships, and upsert Year-N enrolments. */
  private async syncStudentYear(userId: string, yearLevel: number): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // 1. Update global year level on the User row.
      await tx.user.update({ where: { id: userId }, data: { yearLevel } });

      // 2. Sync level on every existing student membership for this user.
      await tx.courseMembership.updateMany({
        where: { userId, role: CourseRole.student },
        data: { level: yearLevel },
      });

      // 3. Auto-enrol into every active Year-N course (upsert to avoid duplicates).
      const yearCourses = await tx.course.findMany({
        where: { isActive: true, termLabel: { startsWith: `Year ${yearLevel}` } },
        select: { id: true },
      });
      for (const course of yearCourses) {
        await tx.courseMembership.upsert({
          where: { courseId_userId: { courseId: course.id, userId } },
          update: { level: yearLevel },
          create: { courseId: course.id, userId, role: CourseRole.student, level: yearLevel },
        });
      }
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'member.year_synced',
        targetType: 'user',
        targetId: userId,
        payload: { yearLevel } as Prisma.InputJsonValue,
      },
    });
  }

  async syncStudentYearGlobal(
    apiBaseUrl: string,
    userId: string,
    yearLevel: number
  ): Promise<void> {
    await this.seed(apiBaseUrl);
    await this.syncStudentYear(userId, yearLevel);
  }

  async listStudentsWithYearLevel(
    apiBaseUrl: string
  ): Promise<Array<{ userId: string; username: string; githubLogin: string; yearLevel: number }>> {
    await this.seed(apiBaseUrl);
    const memberships = await this.prisma.courseMembership.findMany({
      where: { role: CourseRole.student },
      select: { userId: true },
      distinct: ['userId'],
    });
    const studentIds = memberships.map((m) => m.userId);
    const users = await this.prisma.user.findMany({
      where: { id: { in: studentIds } },
      include: { githubAccount: true },
      orderBy: { username: 'asc' },
    });
    return users.map((u) => ({
      userId: u.id,
      username: u.username,
      githubLogin: u.githubAccount?.login ?? '',
      yearLevel: (u as { yearLevel?: number }).yearLevel ?? 1,
    }));
  }

  async createNotification(
    _apiBaseUrl: string,
    userId: string,
    notification: { type: string; title: string; body: string; link?: string }
  ): Promise<void> {
    await (
      this.prisma as unknown as { notification: { create: (args: unknown) => Promise<unknown> } }
    ).notification.create({
      data: {
        userId,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        link: notification.link ?? null,
      },
    });
  }

  async listNotifications(_apiBaseUrl: string, userId: string): Promise<NotificationRecord[]> {
    const rows = await (
      this.prisma as unknown as {
        notification: {
          findMany: (args: unknown) => Promise<
            Array<{
              id: string;
              userId: string;
              type: string;
              title: string;
              body: string;
              link: string | null;
              read: boolean;
              createdAt: Date;
            }>
          >;
        };
      }
    ).notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
  }

  async countUnreadNotifications(_apiBaseUrl: string, userId: string): Promise<number> {
    return (
      this.prisma as unknown as {
        notification: { count: (args: unknown) => Promise<number> };
      }
    ).notification.count({ where: { userId, read: false } });
  }

  async markAllNotificationsRead(_apiBaseUrl: string, userId: string): Promise<void> {
    await (
      this.prisma as unknown as {
        notification: { updateMany: (args: unknown) => Promise<unknown> };
      }
    ).notification.updateMany({ where: { userId, read: false }, data: { read: true } });
  }

  async createCourseInvite(
    apiBaseUrl: string,
    courseId: string,
    role: CourseMembershipRecord['role'],
    opts?: { maxUses?: number; expiresAt?: string | null }
  ): Promise<import('./store').CourseInviteRecord> {
    await this.seed(apiBaseUrl);
    const code = Math.random().toString(36).slice(2, 10).toUpperCase();
    const invite = await this.prisma.courseInvite.create({
      data: {
        courseId,
        code,
        role: role as CourseRole,
        maxUses: opts?.maxUses ?? 0,
        expiresAt: opts?.expiresAt ? new Date(opts.expiresAt) : null,
      },
    });
    return {
      id: invite.id,
      courseId: invite.courseId,
      code: invite.code,
      role: invite.role as CourseMembershipRecord['role'],
      maxUses: invite.maxUses,
      useCount: invite.useCount,
      expiresAt: invite.expiresAt?.toISOString() ?? null,
      createdAt: invite.createdAt.toISOString(),
      updatedAt: invite.updatedAt.toISOString(),
    };
  }

  async getCourseInviteByCode(
    apiBaseUrl: string,
    code: string
  ): Promise<(import('./store').CourseInviteRecord & { course: CourseRecord }) | null> {
    await this.seed(apiBaseUrl);
    const invite = await this.prisma.courseInvite.findUnique({
      where: { code },
      include: { course: true },
    });
    if (!invite) return null;
    return {
      id: invite.id,
      courseId: invite.courseId,
      code: invite.code,
      role: invite.role as CourseMembershipRecord['role'],
      maxUses: invite.maxUses,
      useCount: invite.useCount,
      expiresAt: invite.expiresAt?.toISOString() ?? null,
      createdAt: invite.createdAt.toISOString(),
      updatedAt: invite.updatedAt.toISOString(),
      course: {
        id: invite.course.id,
        slug: invite.course.slug,
        title: invite.course.title,
        termLabel: invite.course.termLabel,
        courseCode: invite.course.courseCode,
        isActive: invite.course.isActive,
        createdAt: invite.course.createdAt.toISOString(),
        updatedAt: invite.course.updatedAt.toISOString(),
      },
    };
  }

  async redeemCourseInvite(
    apiBaseUrl: string,
    code: string,
    userId: string
  ): Promise<CourseMembershipRecord> {
    await this.seed(apiBaseUrl);
    const invite = await this.prisma.courseInvite.findUnique({ where: { code } });
    if (!invite) {
      throw Object.assign(new Error('Invalid or expired invite code.'), { statusCode: 404 });
    }
    if (invite.expiresAt && invite.expiresAt < new Date()) {
      throw Object.assign(new Error('This invite link has expired.'), { statusCode: 410 });
    }
    if (invite.maxUses > 0 && invite.useCount >= invite.maxUses) {
      throw Object.assign(new Error('This invite link has reached its maximum uses.'), {
        statusCode: 410,
      });
    }
    const existing = await this.prisma.courseMembership.findFirst({
      where: { courseId: invite.courseId, userId },
    });
    if (existing) {
      return {
        id: existing.id,
        courseId: existing.courseId,
        userId: existing.userId,
        role: existing.role as CourseMembershipRecord['role'],
        level: existing.level,
        createdAt: existing.createdAt.toISOString(),
        updatedAt: existing.updatedAt.toISOString(),
      };
    }
    const [membership] = await this.prisma.$transaction([
      this.prisma.courseMembership.create({
        data: { courseId: invite.courseId, userId, role: invite.role },
      }),
      this.prisma.courseInvite.update({
        where: { id: invite.id },
        data: { useCount: { increment: 1 } },
      }),
    ]);
    return {
      id: membership.id,
      courseId: membership.courseId,
      userId: membership.userId,
      role: membership.role as CourseMembershipRecord['role'],
      level: membership.level,
      createdAt: membership.createdAt.toISOString(),
      updatedAt: membership.updatedAt.toISOString(),
    };
  }

  async listTrackingProjects(
    apiBaseUrl: string,
    courseId: string,
    opts?: PaginationOpts
  ): Promise<ProjectRecord[]> {
    await this.seed(apiBaseUrl);
    const take = opts?.limit;
    const skip = take !== undefined ? (opts?.offset ?? 0) : undefined;
    const projects = await this.prisma.project.findMany({
      where: { courseId },
      include: {
        releases: latestReleaseInclude,
        template: projectTemplateInclude,
      },
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    });
    return projects.map(toProjectRecord);
  }

  async countTrackingProjects(apiBaseUrl: string, courseId: string): Promise<number> {
    await this.seed(apiBaseUrl);
    return this.prisma.project.count({ where: { courseId } });
  }

  async getTrackingProjectById(
    apiBaseUrl: string,
    projectId: string
  ): Promise<ProjectRecord | null> {
    await this.seed(apiBaseUrl);
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        releases: latestReleaseInclude,
        template: projectTemplateInclude,
      },
    });
    return project ? toProjectRecord(project) : null;
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
      deliveryMode: 'individual' | 'team';
      templateId?: string | null;
      applicationOpenAt?: string | null;
      applicationCloseAt?: string | null;
      teamLockAt?: string | null;
      teamSize?: number | null;
      rubric: TrackingRubricItemRecord[];
      resources: TrackingResourceRecord[];
    }
  ): Promise<ProjectRecord> {
    await this.seed(apiBaseUrl);
    const subject = await this.prisma.subject
      .findUniqueOrThrow({ where: { slug: payload.slug.split('/')[0] || 'cs161' } })
      .catch(async () => {
        return this.prisma.subject.findFirstOrThrow();
      });
    const created = await this.prisma.project.create({
      data: {
        subjectId: subject.id,
        courseId: payload.courseId,
        templateId: payload.templateId || undefined,
        slug: payload.slug,
        name: payload.title,
        defaultBranch: 'main',
        description: payload.description,
        status: payload.status as PrismaProjectStatus,
        deliveryMode: payload.deliveryMode === 'team' ? DeliveryMode.team : DeliveryMode.individual,
        applicationOpenAt: payload.applicationOpenAt ? new Date(payload.applicationOpenAt) : null,
        applicationCloseAt: payload.applicationCloseAt
          ? new Date(payload.applicationCloseAt)
          : null,
        teamLockAt: payload.teamLockAt ? new Date(payload.teamLockAt) : null,
        teamFormationStatus:
          payload.deliveryMode === 'team' && payload.applicationOpenAt
            ? PrismaTeamFormationStatus.application_open
            : PrismaTeamFormationStatus.not_started,
        rubricJson: payload.rubric,
        resourcesJson: payload.resources,
      },
    });
    await this.prisma.projectRelease.create({
      data: {
        projectId: created.id,
        version: `tracking-${Date.now()}`,
        taskText: `# ${payload.title}\n\n${payload.description}\n`,
        manifestJson: {
          ...defaultManifest(apiBaseUrl),
          projectKey: payload.slug,
        },
        publicAssetRef: 'public://tracking',
        privateAssetRef: 'private://tracking',
      },
    });
    const hydrated = await this.prisma.project.findUniqueOrThrow({
      where: { id: created.id },
      include: { releases: latestReleaseInclude, template: projectTemplateInclude },
    });
    if (payload.templateId) {
      const template = await this.prisma.projectTemplate.findUnique({
        where: { id: payload.templateId },
        include: { milestones: { orderBy: { order: 'asc' } } },
      });
      if (template) {
        await this.prisma.milestone.createMany({
          data: template.milestones.map((milestone) => ({
            projectId: created.id,
            title: milestone.title,
            description: milestone.description,
            order: milestone.order,
            dueAt: milestone.dueAt,
            isFinal: milestone.isFinal,
          })),
        });
      }
    }
    await this.prisma.auditLog.create({
      data: {
        userId,
        courseId: payload.courseId,
        projectId: created.id,
        action: 'project.created',
        targetType: 'project',
        targetId: created.id,
        payload: { title: payload.title },
      },
    });
    return toProjectRecord(hydrated);
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
      deliveryMode: 'individual' | 'team';
      templateId: string | null;
      applicationOpenAt: string | null;
      applicationCloseAt: string | null;
      teamLockAt: string | null;
      teamSize: number | null;
      rubric: TrackingRubricItemRecord[];
      resources: TrackingResourceRecord[];
    }>
  ): Promise<ProjectRecord | null> {
    await this.seed(apiBaseUrl);
    const updated = await this.prisma.project
      .update({
        where: { id: projectId },
        data: {
          slug: payload.slug,
          name: payload.title,
          description: payload.description,
          status: payload.status as PrismaProjectStatus | undefined,
          deliveryMode: payload.deliveryMode
            ? payload.deliveryMode === 'team'
              ? DeliveryMode.team
              : DeliveryMode.individual
            : undefined,
          templateId: payload.templateId === undefined ? undefined : payload.templateId,
          applicationOpenAt:
            payload.applicationOpenAt === undefined
              ? undefined
              : payload.applicationOpenAt
                ? new Date(payload.applicationOpenAt)
                : null,
          applicationCloseAt:
            payload.applicationCloseAt === undefined
              ? undefined
              : payload.applicationCloseAt
                ? new Date(payload.applicationCloseAt)
                : null,
          teamLockAt:
            payload.teamLockAt === undefined
              ? undefined
              : payload.teamLockAt
                ? new Date(payload.teamLockAt)
                : null,
          teamFormationStatus:
            payload.deliveryMode === 'team' && payload.applicationOpenAt
              ? PrismaTeamFormationStatus.application_open
              : undefined,
          rubricJson: payload.rubric,
          resourcesJson: payload.resources,
        },
        include: {
          releases: latestReleaseInclude,
          template: projectTemplateInclude,
        },
      })
      .catch(() => null);
    if (!updated) {
      return null;
    }
    await this.prisma.auditLog.create({
      data: {
        userId,
        courseId: updated.courseId,
        projectId: updated.id,
        action: 'project.updated',
        targetType: 'project',
        targetId: updated.id,
      },
    });
    return toProjectRecord(updated);
  }

  async listCourseProjectTemplates(
    apiBaseUrl: string,
    courseId: string
  ): Promise<ProjectTemplateRecord[]> {
    await this.seed(apiBaseUrl);
    const templates = await this.prisma.projectTemplate.findMany({
      where: { courseId },
      include: {
        roles: { orderBy: { sortOrder: 'asc' } },
        milestones: { orderBy: { order: 'asc' } },
      },
      orderBy: { updatedAt: 'desc' },
    });
    return templates.map(toProjectTemplateRecord);
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
    await this.seed(apiBaseUrl);
    const created = await this.prisma.projectTemplate.create({
      data: {
        courseId,
        slug: payload.slug,
        title: payload.title,
        description: payload.description,
        deliveryMode: payload.deliveryMode === 'team' ? DeliveryMode.team : DeliveryMode.individual,
        teamSize: payload.teamSize,
        status:
          payload.status === 'draft'
            ? PrismaProjectTemplateStatus.draft
            : PrismaProjectTemplateStatus.active,
        rubricJson: payload.rubric,
        resourcesJson: payload.resources,
        roles: {
          create: payload.roles.map((role, index) => ({
            key: role.key,
            label: role.label,
            count: role.count,
            sortOrder: role.sortOrder ?? index,
          })),
        },
        milestones: {
          create: payload.milestones.map((milestone, index) => ({
            title: milestone.title,
            description: milestone.description,
            order: milestone.order ?? index,
            dueAt: milestone.dueAt ? new Date(milestone.dueAt) : null,
            isFinal: milestone.isFinal,
          })),
        },
      },
      include: {
        roles: { orderBy: { sortOrder: 'asc' } },
        milestones: { orderBy: { order: 'asc' } },
      },
    });
    await this.prisma.auditLog.create({
      data: {
        userId,
        courseId,
        action: 'template.created',
        targetType: 'template',
        targetId: created.id,
      },
    });
    return toProjectTemplateRecord(created);
  }

  async getProjectTemplateById(
    apiBaseUrl: string,
    templateId: string
  ): Promise<ProjectTemplateRecord | null> {
    await this.seed(apiBaseUrl);
    const template = await this.prisma.projectTemplate.findUnique({
      where: { id: templateId },
      include: {
        roles: { orderBy: { sortOrder: 'asc' } },
        milestones: { orderBy: { order: 'asc' } },
      },
    });
    return template ? toProjectTemplateRecord(template) : null;
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
    await this.seed(apiBaseUrl);
    const updated = await this.prisma
      .$transaction(async (tx) => {
        if (payload.roles !== undefined) {
          await tx.projectTemplateRole.deleteMany({ where: { templateId } });
        }
        if (payload.milestones !== undefined) {
          await tx.projectTemplateMilestone.deleteMany({ where: { templateId } });
        }
        return tx.projectTemplate.update({
          where: { id: templateId },
          data: {
            slug: payload.slug,
            title: payload.title,
            description: payload.description,
            deliveryMode: payload.deliveryMode
              ? payload.deliveryMode === 'team'
                ? DeliveryMode.team
                : DeliveryMode.individual
              : undefined,
            teamSize: payload.teamSize,
            status: payload.status
              ? payload.status === 'draft'
                ? PrismaProjectTemplateStatus.draft
                : PrismaProjectTemplateStatus.active
              : undefined,
            rubricJson: payload.rubric,
            resourcesJson: payload.resources,
            roles:
              payload.roles !== undefined
                ? {
                    create: payload.roles.map((role, index) => ({
                      key: role.key,
                      label: role.label,
                      count: role.count,
                      sortOrder: role.sortOrder ?? index,
                    })),
                  }
                : undefined,
            milestones:
              payload.milestones !== undefined
                ? {
                    create: payload.milestones.map((milestone, index) => ({
                      title: milestone.title,
                      description: milestone.description,
                      order: milestone.order ?? index,
                      dueAt: milestone.dueAt ? new Date(milestone.dueAt) : null,
                      isFinal: milestone.isFinal,
                    })),
                  }
                : undefined,
          },
          include: {
            roles: { orderBy: { sortOrder: 'asc' } },
            milestones: { orderBy: { order: 'asc' } },
          },
        });
      })
      .catch(() => null);
    if (!updated) {
      return null;
    }
    await this.prisma.auditLog.create({
      data: {
        userId,
        courseId: updated.courseId,
        action: 'template.updated',
        targetType: 'template',
        targetId: updated.id,
      },
    });
    return toProjectTemplateRecord(updated);
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
    await this.seed(apiBaseUrl);
    const existing = await this.prisma.projectRoleApplication.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });
    if (existing) {
      await this.prisma.projectRolePreference.deleteMany({ where: { applicationId: existing.id } });
      const updated = await this.prisma.projectRoleApplication.update({
        where: { id: existing.id },
        data: {
          statement: payload.statement,
          availabilityNote: payload.availabilityNote,
          status: PrismaProjectRoleApplicationStatus.submitted,
          submittedAt: new Date(),
          preferences: {
            create: payload.preferences.map((entry) => ({
              templateRoleId: entry.templateRoleId,
              rank: entry.rank,
            })),
          },
        },
        include: {
          preferences: { include: { templateRole: true }, orderBy: { rank: 'asc' } },
        },
      });
      return toProjectRoleApplicationRecord(updated);
    }
    const created = await this.prisma.projectRoleApplication.create({
      data: {
        projectId,
        userId,
        statement: payload.statement,
        availabilityNote: payload.availabilityNote,
        status: PrismaProjectRoleApplicationStatus.submitted,
        submittedAt: new Date(),
        preferences: {
          create: payload.preferences.map((entry) => ({
            templateRoleId: entry.templateRoleId,
            rank: entry.rank,
          })),
        },
      },
      include: {
        preferences: { include: { templateRole: true }, orderBy: { rank: 'asc' } },
      },
    });
    return toProjectRoleApplicationRecord(created);
  }

  async getProjectRoleApplicationForUser(
    apiBaseUrl: string,
    projectId: string,
    userId: string
  ): Promise<ProjectRoleApplicationRecord | null> {
    await this.seed(apiBaseUrl);
    const application = await this.prisma.projectRoleApplication.findUnique({
      where: { projectId_userId: { projectId, userId } },
      include: {
        preferences: { include: { templateRole: true }, orderBy: { rank: 'asc' } },
      },
    });
    return application ? toProjectRoleApplicationRecord(application) : null;
  }

  async listProjectRoleApplications(
    apiBaseUrl: string,
    projectId: string
  ): Promise<ProjectRoleApplicationRecord[]> {
    await this.seed(apiBaseUrl);
    const applications = await this.prisma.projectRoleApplication.findMany({
      where: { projectId },
      include: {
        preferences: { include: { templateRole: true }, orderBy: { rank: 'asc' } },
      },
      orderBy: { submittedAt: 'asc' },
    });
    return applications.map(toProjectRoleApplicationRecord);
  }

  async generateProjectTeamFormation(
    apiBaseUrl: string,
    userId: string,
    projectId: string,
    payload?: { algorithmVersion?: string }
  ): Promise<TeamFormationRunRecord> {
    await this.seed(apiBaseUrl);
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { template: { include: { roles: true, milestones: true } } },
    });
    if (!project || !project.courseId || !project.template) {
      throw new Error('Project template not found.');
    }
    const applications = await this.prisma.projectRoleApplication.findMany({
      where: { projectId, status: PrismaProjectRoleApplicationStatus.submitted },
      include: { preferences: { include: { templateRole: true }, orderBy: { rank: 'asc' } } },
    });
    const courseMembers = await this.prisma.courseMembership.findMany({
      where: { courseId: project.courseId },
    });
    const users = await this.prisma.user.findMany({
      where: { id: { in: applications.map((entry) => entry.userId) } },
      include: { githubAccount: true },
    });
    const templateRecord = toProjectTemplateRecord(project.template);
    const result = generateTeamFormationResult({
      applications: applications.map(toProjectRoleApplicationRecord),
      template: templateRecord,
      users: users.map(toUserRecord),
      memberships: courseMembers.map(toMembershipRecord),
    });
    const run = await this.prisma.teamFormationRun.create({
      data: {
        projectId,
        algorithmVersion: payload?.algorithmVersion || 'v1',
        configJson: { teamSize: templateRecord.teamSize, roleCount: templateRecord.roles.length },
        resultJson: result,
        createdByUserId: userId,
      },
    });
    await this.prisma.project.update({
      where: { id: projectId },
      data: { teamFormationStatus: PrismaTeamFormationStatus.team_review },
    });
    return toTeamFormationRunRecord(run);
  }

  async lockProjectTeams(
    apiBaseUrl: string,
    userId: string,
    projectId: string,
    payload?: { formationRunId?: string }
  ): Promise<TeamRecord[]> {
    await this.seed(apiBaseUrl);
    const run = payload?.formationRunId
      ? await this.prisma.teamFormationRun.findUnique({ where: { id: payload.formationRunId } })
      : await this.prisma.teamFormationRun.findFirst({
          where: { projectId },
          orderBy: { createdAt: 'desc' },
        });
    if (!run) {
      throw new Error('No generated team formation run found.');
    }
    const result = toTeamFormationRunRecord(run).result;
    await this.prisma.team.deleteMany({ where: { projectId } });
    const createdAt = new Date();
    for (const team of result.teams) {
      const createdTeam = await this.prisma.team.create({
        data: {
          projectId,
          name: team.name,
          status: PrismaTeamStatus.locked,
          formationRunId: run.id,
          lockedAt: createdAt,
          members: {
            create: team.members.map((member) => ({
              userId: member.userId,
              roleKey: member.roleKey,
              roleLabel: member.roleLabel,
              status: 'active',
            })),
          },
        },
      });
      const firstMember = team.members[0];
      await this.prisma.teamProjectRepo.create({
        data: {
          teamId: createdTeam.id,
          owner: firstMember?.username || 'nibras-team',
          name: `nibras-${projectId}-${team.name.toLowerCase().replace(/\s+/g, '-')}`,
          defaultBranch: 'main',
          visibility: RepoVisibility.private,
          installStatus: 'provisioned',
        },
      });
    }
    await this.prisma.project.update({
      where: { id: projectId },
      data: {
        teamFormationStatus: PrismaTeamFormationStatus.teams_locked,
        teamLockAt: createdAt,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        userId,
        projectId,
        action: 'teams.locked',
        targetType: 'project',
        targetId: projectId,
      },
    });
    return this.listProjectTeams(apiBaseUrl, projectId);
  }

  async listProjectTeams(apiBaseUrl: string, projectId: string): Promise<TeamRecord[]> {
    await this.seed(apiBaseUrl);
    const teams = await this.prisma.team.findMany({
      where: { projectId },
      include: {
        members: { include: { user: true }, orderBy: { createdAt: 'asc' } },
        repo: true,
      },
      orderBy: { name: 'asc' },
    });
    return teams.map(toTeamRecord);
  }

  async updateProjectTeam(
    apiBaseUrl: string,
    userId: string,
    projectId: string,
    teamId: string,
    payload: Partial<{
      name: string;
      members: Array<{ userId: string; roleKey: string; roleLabel: string }>;
    }>
  ): Promise<TeamRecord | null> {
    await this.seed(apiBaseUrl);
    const updated = await this.prisma
      .$transaction(async (tx) => {
        if (payload.members !== undefined) {
          await tx.teamMember.deleteMany({ where: { teamId } });
        }
        return tx.team.update({
          where: { id: teamId, projectId },
          data: {
            name: payload.name,
            members:
              payload.members !== undefined
                ? {
                    create: payload.members.map((member) => ({
                      userId: member.userId,
                      roleKey: member.roleKey,
                      roleLabel: member.roleLabel,
                      status: 'active',
                    })),
                  }
                : undefined,
          },
          include: {
            members: { include: { user: true }, orderBy: { createdAt: 'asc' } },
            repo: true,
          },
        });
      })
      .catch(() => null);
    if (!updated) {
      return null;
    }
    await this.prisma.auditLog.create({
      data: {
        userId,
        projectId,
        action: 'team.updated',
        targetType: 'team',
        targetId: teamId,
      },
    });
    return toTeamRecord(updated);
  }

  async setTrackingProjectStatus(
    apiBaseUrl: string,
    userId: string,
    projectId: string,
    status: ProjectStatus
  ): Promise<ProjectRecord | null> {
    return this.updateTrackingProject(apiBaseUrl, userId, projectId, { status });
  }

  async listTrackingMilestones(apiBaseUrl: string, projectId: string): Promise<MilestoneRecord[]> {
    await this.seed(apiBaseUrl);
    const milestones = await this.prisma.milestone.findMany({
      where: { projectId },
      orderBy: { order: 'asc' },
    });
    return milestones.map(toMilestoneRecord);
  }

  async getTrackingMilestone(
    apiBaseUrl: string,
    milestoneId: string
  ): Promise<MilestoneRecord | null> {
    await this.seed(apiBaseUrl);
    const milestone = await this.prisma.milestone.findUnique({
      where: { id: milestoneId },
    });
    return milestone ? toMilestoneRecord(milestone) : null;
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
    await this.seed(apiBaseUrl);
    const existing = await this.prisma.milestone.findMany({
      where: { projectId },
      select: { order: true },
    });
    const maxOrder = existing.length > 0 ? Math.max(...existing.map((m) => m.order)) : -1;
    const order = payload.order > maxOrder ? payload.order : maxOrder + 1;
    const created = await this.prisma.milestone.create({
      data: {
        projectId,
        title: payload.title,
        description: payload.description,
        order,
        dueAt: payload.dueAt ? new Date(payload.dueAt) : null,
        isFinal: payload.isFinal,
      },
    });
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    await this.prisma.auditLog.create({
      data: {
        userId,
        courseId: project?.courseId || null,
        projectId,
        milestoneId: created.id,
        action: 'milestone.created',
        targetType: 'milestone',
        targetId: created.id,
      },
    });
    return toMilestoneRecord(created);
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
    await this.seed(apiBaseUrl);
    const updated = await this.prisma.milestone
      .update({
        where: { id: milestoneId },
        data: {
          title: payload.title,
          description: payload.description,
          order: payload.order,
          dueAt:
            payload.dueAt === undefined
              ? undefined
              : payload.dueAt
                ? new Date(payload.dueAt)
                : null,
          isFinal: payload.isFinal,
        },
      })
      .catch(() => null);
    if (!updated) {
      return null;
    }
    const project = await this.prisma.project.findUnique({ where: { id: updated.projectId } });
    await this.prisma.auditLog.create({
      data: {
        userId,
        courseId: project?.courseId || null,
        projectId: updated.projectId,
        milestoneId,
        action: 'milestone.updated',
        targetType: 'milestone',
        targetId: milestoneId,
      },
    });
    return toMilestoneRecord(updated);
  }

  async deleteTrackingMilestone(
    apiBaseUrl: string,
    userId: string,
    milestoneId: string
  ): Promise<boolean> {
    await this.seed(apiBaseUrl);
    const milestone = await this.prisma.milestone.findUnique({ where: { id: milestoneId } });
    if (!milestone) {
      return false;
    }
    const project = await this.prisma.project.findUnique({ where: { id: milestone.projectId } });
    await this.prisma.milestone.delete({ where: { id: milestoneId } });
    await this.prisma.auditLog.create({
      data: {
        userId,
        courseId: project?.courseId || null,
        projectId: milestone.projectId,
        milestoneId,
        action: 'milestone.deleted',
        targetType: 'milestone',
        targetId: milestoneId,
      },
    });
    return true;
  }

  async listTrackingMilestoneSubmissions(
    apiBaseUrl: string,
    milestoneId: string,
    opts?: PaginationOpts
  ): Promise<SubmissionRecord[]> {
    await this.seed(apiBaseUrl);
    const take = opts?.limit;
    const skip = take !== undefined ? (opts?.offset ?? 0) : undefined;
    const submissions = await this.prisma.submissionAttempt.findMany({
      where: { milestoneId },
      include: { project: true, team: { include: { members: true } } },
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    });
    return submissions.map(toSubmissionRecord);
  }

  async countTrackingMilestoneSubmissions(
    apiBaseUrl: string,
    milestoneId: string
  ): Promise<number> {
    await this.seed(apiBaseUrl);
    return this.prisma.submissionAttempt.count({ where: { milestoneId } });
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
    await this.seed(apiBaseUrl);
    let milestone = await this.prisma.milestone.findUniqueOrThrow({
      where: { id: milestoneId },
      include: {
        project: {
          include: {
            releases: latestReleaseInclude,
            teams: { include: { repo: true, members: true } },
          },
        },
      },
    });
    // Auto-create a default release if the project has none yet.
    // This guards against projects created before releases were required.
    if (milestone.project.releases.length === 0) {
      await this.prisma.projectRelease.create({
        data: {
          projectId: milestone.projectId,
          version: `tracking-${Date.now()}`,
          taskText: `# ${milestone.project.name}\n`,
          manifestJson: {
            ...defaultManifest(apiBaseUrl),
            projectKey: milestone.project.slug,
          },
          publicAssetRef: 'public://tracking',
          privateAssetRef: 'private://tracking',
        },
      });
      // Reload with the new release
      const refreshed = await this.prisma.milestone.findUniqueOrThrow({
        where: { id: milestoneId },
        include: {
          project: {
            include: {
              releases: latestReleaseInclude,
              teams: { include: { repo: true, members: true } },
            },
          },
        },
      });
      milestone = refreshed;
    }

    const parsedRepo = parseGitHubRepoUrl(payload.repoUrl || payload.submissionValue);
    let repo = await this.prisma.userProjectRepo.findFirst({
      where: {
        userId,
        projectId: milestone.projectId,
      },
    });
    let teamRepo: { id: string; defaultBranch: string; cloneUrl: string | null } | null = null;
    let team: {
      id: string;
      name: string;
      members: Array<{ userId: string }>;
      repo: { id: string; cloneUrl: string | null; defaultBranch: string } | null;
    } | null = null;
    if (milestone.project.deliveryMode === DeliveryMode.team) {
      team =
        milestone.project.teams.find((entry) =>
          entry.members.some((member) => member.userId === userId && member.status === 'active')
        ) || null;
      if (
        !team ||
        milestone.project.teamFormationStatus !== PrismaTeamFormationStatus.teams_locked
      ) {
        throw new Error('Teams must be locked before team submissions are accepted.');
      }
      if (!team.repo) {
        const account = await this.prisma.githubAccount.findUnique({ where: { userId } });
        teamRepo = await this.prisma.teamProjectRepo.create({
          data: {
            teamId: team.id,
            owner: parsedRepo?.owner || account?.login || 'nibras-team',
            name: parsedRepo?.name || `nibras-${milestone.project.slug.replace('/', '-')}`,
            cloneUrl: payload.repoUrl || payload.submissionValue || null,
            defaultBranch: payload.branch || 'main',
            visibility: RepoVisibility.private,
            installStatus: 'provisioned',
          },
        });
      } else {
        teamRepo = team.repo;
        if (payload.repoUrl || payload.submissionValue) {
          await this.prisma.teamProjectRepo.update({
            where: { teamId: team.id },
            data: {
              cloneUrl: payload.repoUrl || payload.submissionValue,
              defaultBranch: payload.branch || 'main',
            },
          });
        }
      }
    } else if (!repo) {
      const account = await this.prisma.githubAccount.findUnique({ where: { userId } });
      repo = await this.prisma.userProjectRepo.create({
        data: {
          userId,
          projectId: milestone.projectId,
          owner: parsedRepo?.owner || account?.login || 'nibras-user',
          name: parsedRepo?.name || `nibras-${milestone.project.slug.replace('/', '-')}`,
          cloneUrl: payload.repoUrl || payload.submissionValue || null,
          defaultBranch: payload.branch || 'main',
          visibility: RepoVisibility.private,
          installStatus: 'provisioned',
        },
      });
    }
    const submission = await this.prisma.submissionAttempt.create({
      data: {
        userId,
        submittedByUserId: userId,
        projectId: milestone.projectId,
        projectReleaseId: milestone.project.releases[0].id,
        userProjectRepoId: repo?.id,
        teamId: team?.id,
        teamProjectRepoId: teamRepo?.id,
        milestoneId,
        commitSha:
          payload.commitSha ||
          (payload.submissionType === 'github'
            ? `github-pending-${randomUUID().slice(0, 8)}`
            : `manual-${randomUUID().slice(0, 8)}`),
        repoUrl:
          payload.repoUrl ||
          payload.submissionValue ||
          team?.repo?.cloneUrl ||
          null ||
          repo?.cloneUrl ||
          '',
        branch:
          payload.branch ||
          team?.repo?.defaultBranch ||
          teamRepo?.defaultBranch ||
          repo?.defaultBranch ||
          'main',
        status:
          payload.submissionType === 'github'
            ? SubmissionStatus.running
            : SubmissionStatus.needs_review,
        summary:
          payload.submissionType === 'github'
            ? 'GitHub submission received. Waiting for webhook activity.'
            : 'Submission received and queued for instructor review.',
        submissionType: payload.submissionType as TrackingSubmissionType,
        submissionValue: payload.submissionValue,
        notes: payload.notes,
        submittedAt: new Date(),
      },
      include: { project: true, team: { include: { members: true } } },
    });
    await this.prisma.auditLog.create({
      data: {
        userId,
        courseId: milestone.project.courseId,
        projectId: milestone.projectId,
        milestoneId,
        submissionAttemptId: submission.id,
        action: 'submission.created',
        targetType: 'submission',
        targetId: submission.id,
      },
    });
    return toSubmissionRecord(submission);
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
    await this.seed(apiBaseUrl);
    const existing = await this.prisma.submissionAttempt.findUnique({
      where: { id: submissionId },
    });
    if (!existing) {
      return null;
    }

    const nextSubmissionType = payload.submissionType ?? existing.submissionType;
    const nextSubmissionValue = payload.submissionValue ?? existing.submissionValue ?? '';
    const nextBranch = payload.branch || existing.branch || 'main';
    const nextRepoUrl =
      nextSubmissionType === 'github'
        ? payload.repoUrl || nextSubmissionValue || existing.repoUrl
        : nextSubmissionValue || existing.repoUrl;
    const nextCommitSha =
      payload.commitSha && payload.commitSha.trim()
        ? payload.commitSha.trim()
        : nextSubmissionType === 'github'
          ? `github-pending-${randomUUID().slice(0, 8)}`
          : `manual-${randomUUID().slice(0, 8)}`;
    const nextStatus =
      nextSubmissionType === 'github' ? SubmissionStatus.running : SubmissionStatus.needs_review;
    const nextSummary =
      nextSubmissionType === 'github'
        ? 'GitHub submission updated. Waiting for webhook activity.'
        : 'Submission updated and queued for instructor review.';
    const submittedAt = new Date();

    if (nextSubmissionType === 'github') {
      const parsedRepo = parseGitHubRepoUrl(nextRepoUrl);
      if (parsedRepo) {
        await this.prisma.userProjectRepo.update({
          where: {
            userId_projectId: {
              userId: existing.userId,
              projectId: existing.projectId,
            },
          },
          data: {
            owner: parsedRepo.owner,
            name: parsedRepo.name,
            cloneUrl: nextRepoUrl,
            defaultBranch: nextBranch,
          },
        });
      }
    }

    const updated = await this.prisma.submissionAttempt
      .update({
        where: { id: submissionId },
        data: {
          submissionType: nextSubmissionType as TrackingSubmissionType,
          submissionValue: nextSubmissionValue,
          notes: payload.notes ?? existing.notes,
          repoUrl: nextRepoUrl,
          branch: nextBranch,
          commitSha: nextCommitSha,
          status: nextStatus,
          summary: nextSummary,
          submittedAt,
          localTestExitCode: null,
        },
        include: { project: true },
      })
      .catch(() => null);
    if (!updated) {
      return null;
    }
    await this.prisma.auditLog.create({
      data: {
        userId,
        projectId: updated.projectId,
        milestoneId: updated.milestoneId,
        submissionAttemptId: submissionId,
        action: 'submission.updated',
        targetType: 'submission',
        targetId: submissionId,
      },
    });
    return toSubmissionRecord(updated);
  }

  async createTrackingReview(
    apiBaseUrl: string,
    userId: string,
    submissionId: string,
    payload: {
      status: StoreReviewStatus;
      score: number | null;
      feedback: string;
      rubric: TrackingRubricItemRecord[];
    }
  ): Promise<ReviewRecord> {
    await this.seed(apiBaseUrl);
    const submission = await this.prisma.submissionAttempt.findUniqueOrThrow({
      where: { id: submissionId },
    });
    const review = await this.prisma.review.create({
      data: {
        submissionAttemptId: submissionId,
        reviewerUserId: userId,
        status: payload.status as ReviewStatus,
        score: payload.score,
        feedback: payload.feedback,
        rubricJson: payload.rubric,
        reviewedAt: new Date(),
      },
    });
    await this.prisma.submissionAttempt.update({
      where: { id: submissionId },
      data: {
        status:
          payload.status === 'changes_requested'
            ? SubmissionStatus.failed
            : payload.status === 'approved' || payload.status === 'graded'
              ? SubmissionStatus.passed
              : SubmissionStatus.needs_review,
        summary: payload.feedback || payload.status,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        userId,
        projectId: submission.projectId,
        milestoneId: submission.milestoneId,
        submissionAttemptId: submissionId,
        action: 'review.created',
        targetType: 'review',
        targetId: review.id,
      },
    });
    return toReviewRecord(review);
  }

  async getTrackingReview(apiBaseUrl: string, submissionId: string): Promise<ReviewRecord | null> {
    await this.seed(apiBaseUrl);
    const review = await this.prisma.review.findFirst({
      where: { submissionAttemptId: submissionId },
      orderBy: { createdAt: 'desc' },
    });
    return review ? toReviewRecord(review) : null;
  }

  async getSubmissionStudentEmail(
    _apiBaseUrl: string,
    submissionId: string
  ): Promise<{ userId: string; email: string; username: string } | null> {
    const attempt = await this.prisma.submissionAttempt.findUnique({
      where: { id: submissionId },
      select: { user: { select: { id: true, email: true, username: true } } },
    });
    if (!attempt) return null;
    return { userId: attempt.user.id, email: attempt.user.email, username: attempt.user.username };
  }

  async listTrackingReviewQueue(
    apiBaseUrl: string,
    filters?: { courseId?: string; projectId?: string; status?: SubmissionRecord['status'] },
    opts?: PaginationOpts
  ): Promise<SubmissionRecord[]> {
    await this.seed(apiBaseUrl);
    const where = {
      status: filters?.status as SubmissionStatus | undefined,
      projectId: filters?.projectId,
      project: filters?.courseId ? { courseId: filters.courseId } : undefined,
    };
    const take = opts?.limit;
    const skip = take !== undefined ? (opts?.offset ?? 0) : undefined;
    const submissions = await this.prisma.submissionAttempt.findMany({
      where,
      include: { project: true, team: { include: { members: true } } },
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    });
    return submissions.map(toSubmissionRecord);
  }

  async countTrackingReviewQueue(
    apiBaseUrl: string,
    filters?: { courseId?: string; projectId?: string; status?: SubmissionRecord['status'] }
  ): Promise<number> {
    await this.seed(apiBaseUrl);
    return this.prisma.submissionAttempt.count({
      where: {
        status: filters?.status as SubmissionStatus | undefined,
        projectId: filters?.projectId,
        project: filters?.courseId ? { courseId: filters.courseId } : undefined,
      },
    });
  }

  async listTrackingActivity(apiBaseUrl: string, userId: string): Promise<ActivityRecord[]> {
    await this.seed(apiBaseUrl);
    const courses = await this.listTrackingCourses(apiBaseUrl, userId);
    const courseIds = courses.map((entry) => entry.id);
    const logs = await this.prisma.auditLog.findMany({
      where: {
        OR: [{ courseId: { in: courseIds } }, { courseId: null }],
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return logs.map((entry) => ({
      id: entry.id,
      actorUserId: entry.userId,
      courseId: entry.courseId,
      projectId: entry.projectId,
      milestoneId: entry.milestoneId,
      submissionId: entry.submissionAttemptId,
      action: entry.action,
      summary: `${entry.action} on ${entry.targetType}`,
      createdAt: entry.createdAt.toISOString(),
    }));
  }

  async getStudentTrackingDashboard(
    apiBaseUrl: string,
    userId: string,
    courseId?: string | null
  ): Promise<StudentDashboardRecord> {
    await this.seed(apiBaseUrl);
    const courses = await this.listTrackingCourses(apiBaseUrl, userId);
    const memberships = await this.listCourseMemberships(apiBaseUrl, userId);
    const selected = courseId
      ? courses.find((entry) => entry.id === courseId) || null
      : courses[0] || null;
    if (!selected) {
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
    const baseProjects = (await this.listTrackingProjects(apiBaseUrl, selected.id)).filter(
      (entry) => entry.status === 'published'
    );
    const projectRows = await this.prisma.project.findMany({
      where: { id: { in: baseProjects.map((entry) => entry.id) } },
      include: {
        teams: { include: { members: { include: { user: true } }, repo: true } },
      },
    });
    const teamData = {
      teams: projectRows.flatMap((entry) =>
        entry.teams.map((team) =>
          toTeamRecord({
            ...team,
            members: team.members.map((member) => ({
              ...member,
              user: { username: member.user.username },
            })),
          })
        )
      ),
    } as Pick<Parameters<typeof projectWithTeamContext>[0], 'teams'>;
    const projects = baseProjects.map((project) =>
      projectWithTeamContext(
        {
          users: [],
          githubAccounts: [],
          courses: [],
          projectTemplates: [],
          projectRoleApplications: [],
          teamFormationRuns: [],
          teams: teamData.teams,
          courseMemberships: [],
          courseInvites: [],
          deviceCodes: [],
          sessions: [],
          webSessions: [],
          submissions: [],
          verificationLogs: [],
          projects: [],
          milestones: [],
          reviews: [],
          githubDeliveries: [],
          activity: [],
        },
        project,
        userId
      )
    );
    const milestonesByProject: Record<string, MilestoneRecord[]> = {};
    const statsByProject: Record<string, TrackingDashboardStats> = {};
    const reviews = await this.prisma.review.findMany({
      where: {
        submissionAttempt: {
          project: {
            courseId: selected.id,
          },
        },
      },
    });
    const reviewRecords = reviews.map(toReviewRecord);
    for (const project of projects) {
      const milestones = await this.listTrackingMilestones(apiBaseUrl, project.id);
      const submissions = await this.prisma.submissionAttempt.findMany({
        where: {
          projectId: project.id,
        },
        include: { project: true, team: { include: { members: true } } },
      });
      const submissionRecords = submissions.map(toSubmissionRecord).filter((entry) =>
        submissionBelongsToUser(
          {
            users: [],
            githubAccounts: [],
            courses: [],
            projectTemplates: [],
            projectRoleApplications: [],
            teamFormationRuns: [],
            teams: teamData.teams,
            courseMemberships: [],
            courseInvites: [],
            deviceCodes: [],
            sessions: [],
            webSessions: [],
            submissions: [],
            verificationLogs: [],
            projects: [],
            milestones: [],
            reviews: [],
            githubDeliveries: [],
            activity: [],
          },
          entry,
          userId
        )
      );
      milestonesByProject[project.id] = milestones;
      statsByProject[project.id] = projectStats(milestones, submissionRecords, reviewRecords);
    }
    return {
      course: selected,
      memberships,
      projects,
      milestonesByProject,
      activeProjectId: projects[0]?.id || null,
      activity: (await this.listTrackingActivity(apiBaseUrl, userId)).filter(
        (entry) => entry.courseId === selected.id
      ),
      statsByProject,
      pageError: projects.length === 0 ? 'No published projects found for this course yet.' : null,
    };
  }

  async getInstructorTrackingDashboard(
    apiBaseUrl: string,
    userId: string
  ): Promise<InstructorDashboardRecord> {
    await this.seed(apiBaseUrl);
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const courses =
      user.systemRole === SystemRole.admin
        ? await this.listTrackingCourses(apiBaseUrl, userId)
        : (
            await this.prisma.courseMembership.findMany({
              where: {
                userId,
                role: { in: [CourseRole.instructor, CourseRole.ta] },
              },
              include: { course: true },
              orderBy: { createdAt: 'desc' },
            })
          ).map((entry) => toCourseRecord(entry.course));
    const courseIds = courses.map((entry) => entry.id);
    let reviewQueue: SubmissionRecord[] = [];
    if (user.systemRole === SystemRole.admin) {
      reviewQueue = await this.listTrackingReviewQueue(apiBaseUrl);
    } else if (courseIds.length > 0) {
      const batches = await Promise.all(
        courseIds.map((courseId) => this.listTrackingReviewQueue(apiBaseUrl, { courseId }))
      );
      reviewQueue = batches.flat();
    }
    const activity =
      user.systemRole === SystemRole.admin
        ? await this.listTrackingActivity(apiBaseUrl, userId)
        : (await this.listTrackingActivity(apiBaseUrl, userId)).filter(
            (entry) => entry.courseId === null || courseIds.includes(entry.courseId)
          );
    return {
      courses,
      reviewQueue,
      activity,
    };
  }

  async getCourseTrackingDashboard(
    apiBaseUrl: string,
    userId: string,
    courseId: string
  ): Promise<InstructorDashboardRecord> {
    await this.seed(apiBaseUrl);
    return {
      courses: (await this.listTrackingCourses(apiBaseUrl, userId)).filter(
        (entry) => entry.id === courseId
      ),
      reviewQueue: await this.listTrackingReviewQueue(apiBaseUrl, { courseId }),
      activity: (await this.listTrackingActivity(apiBaseUrl, userId)).filter(
        (entry) => entry.courseId === courseId
      ),
    };
  }

  async getHomeDashboard(
    apiBaseUrl: string,
    userId: string,
    mode?: DashboardModeRecord
  ): Promise<DashboardHomeRecord> {
    await this.seed(apiBaseUrl);
    const prismaUser = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { githubAccount: { select: { login: true } } },
    });
    const user = toUserRecord(prismaUser);
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
      const reviewsBySubmission: Record<string, ReviewRecord | null> = {};
      if (submissions.length > 0) {
        const reviews = await this.prisma.review.findMany({
          where: { submissionAttemptId: { in: submissions.map((entry) => entry.id) } },
          orderBy: { createdAt: 'desc' },
        });
        for (const review of reviews) {
          if (!reviewsBySubmission[review.submissionAttemptId]) {
            reviewsBySubmission[review.submissionAttemptId] = toReviewRecord(review);
          }
        }
      }
      for (const submission of submissions) {
        if (!(submission.id in reviewsBySubmission)) {
          reviewsBySubmission[submission.id] = null;
        }
      }
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
      const managedCourseIdsList = [...managedCourseIds];
      const managedProjects = managedCourseIdsList.length
        ? await this.prisma.project.findMany({
            where: { courseId: { in: managedCourseIdsList } },
            select: { id: true, name: true, courseId: true, status: true },
          })
        : [];
      const studentIds = [...new Set(dashboard.reviewQueue.map((entry) => entry.userId))];
      const studentRows = studentIds.length
        ? await this.prisma.user.findMany({
            where: { id: { in: studentIds } },
            select: { id: true, username: true },
          })
        : [];
      const memberCounts = managedCourseIdsList.length
        ? await this.prisma.courseMembership.groupBy({
            by: ['courseId'],
            where: { courseId: { in: managedCourseIdsList } },
            _count: { _all: true },
          })
        : [];
      const projectTitleById = Object.fromEntries(
        managedProjects.map((project) => [project.id, project.name])
      ) as Record<string, string>;
      const courseIdByProjectId = Object.fromEntries(
        managedProjects.map((project) => [project.id, project.courseId || ''])
      ) as Record<string, string>;
      const courseTitleById = Object.fromEntries(
        dashboard.courses.map((course) => [course.id, course.title])
      ) as Record<string, string>;
      const studentNameById = Object.fromEntries(
        studentRows.map((entry) => [entry.id, entry.username])
      ) as Record<string, string>;
      const memberCountsByCourse = Object.fromEntries(
        memberCounts.map((entry) => [entry.courseId, entry._count._all])
      ) as Record<string, number>;
      const publishedProjectCountsByCourse = managedProjects.reduce<Record<string, number>>(
        (acc, project) => {
          if (project.courseId && project.status === PrismaProjectStatus.published) {
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
    await this.seed(apiBaseUrl);
    const deliveries = await this.prisma.githubDelivery.findMany({
      where: { submissionAttemptId: submissionId },
      orderBy: { receivedAt: 'desc' },
    });
    return deliveries.map(toGithubDeliveryRecord);
  }

  async listUserSubmissions(
    apiBaseUrl: string,
    userId: string,
    opts?: { limit?: number; offset?: number }
  ): Promise<SubmissionRecord[]> {
    await this.seed(apiBaseUrl);
    const rows = await this.prisma.submissionAttempt.findMany({
      where: { userId },
      include: { project: true },
      orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }],
      take: opts?.limit,
      skip: opts?.offset,
    });
    return rows.map(toSubmissionRecord);
  }

  async countUserSubmissions(apiBaseUrl: string, userId: string): Promise<number> {
    await this.seed(apiBaseUrl);
    return this.prisma.submissionAttempt.count({ where: { userId } });
  }

  async exportCourseGrades(
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
  > {
    await this.seed(apiBaseUrl);
    // Export all submissions for this course regardless of membership role
    const submissions = await this.prisma.submissionAttempt.findMany({
      where: { project: { courseId } },
      include: {
        project: true,
        milestone: true,
        user: {
          include: { githubAccount: { select: { login: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return submissions.map((s) => ({
      githubLogin: s.user.githubAccount?.login ?? s.user.username,
      username: s.user.username,
      milestoneTitle: s.milestone?.title ?? '',
      projectKey: s.project.slug,
      status: s.status,
      submittedAt: s.submittedAt?.toISOString() ?? null,
      commitSha: s.commitSha,
    }));
  }

  async close(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

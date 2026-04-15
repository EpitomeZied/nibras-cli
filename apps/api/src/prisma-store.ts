import { randomUUID } from 'node:crypto';
import {
  AssetVisibility,
  CourseRole,
  DeliveryMode,
  Prisma,
  PrismaClient,
  ProjectStatus as PrismaProjectStatus,
  RepoVisibility,
  ReviewStatus,
  SubmissionStatus,
  SystemRole,
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
  ActivityRecord,
  AppStore,
  CourseMembershipRecord,
  CourseRecord,
  defaultManifest,
  DeviceCodeRecord,
  GithubDeliveryRecord,
  InstructorDashboardRecord,
  MembershipRole,
  MilestoneRecord,
  PaginationOpts,
  ProjectRecord,
  ProjectStarterRecord,
  ProjectStatus,
  RepoRecord,
  ReviewRecord,
  ReviewStatus as StoreReviewStatus,
  SessionRecord,
  StudentDashboardRecord,
  SubmissionRecord,
  SubmissionType,
  TrackingDashboardStats,
  TrackingResourceRecord,
  TrackingRubricItemRecord,
  UserRecord,
  VerificationLogRecord,
  WebSessionRecord,
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
  projectId: string;
  milestoneId: string | null;
  project: { slug: string };
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
    projectId: submission.projectId,
    projectKey: submission.project.slug,
    milestoneId: submission.milestoneId,
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
    daysRemaining: lastDue ? Math.ceil((lastDue.getTime() - Date.now()) / 86_400_000) : 0,
  };
}

const latestReleaseInclude = {
  orderBy: { createdAt: 'desc' as const },
  take: 1,
  include: { assets: true },
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
  name: string;
  description: string;
  status: PrismaProjectStatus;
  level: number;
  deliveryMode: DeliveryMode;
  rubricJson: unknown;
  resourcesJson: unknown;
  defaultBranch: string;
  createdAt: Date;
  updatedAt: Date;
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
    title: project.name,
    description: project.description,
    status: project.status as ProjectStatus,
    level: project.level,
    deliveryMode: project.deliveryMode === DeliveryMode.team ? 'team' : 'individual',
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
      include: { project: true },
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
      include: { project: true },
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
        slug: payload.slug,
        name: payload.title,
        defaultBranch: 'main',
        description: payload.description,
        status: payload.status as PrismaProjectStatus,
        deliveryMode: payload.deliveryMode === 'team' ? DeliveryMode.team : DeliveryMode.individual,
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
      include: { releases: latestReleaseInclude },
    });
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
          rubricJson: payload.rubric,
          resourcesJson: payload.resources,
        },
        include: {
          releases: latestReleaseInclude,
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
      include: { project: true },
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
    const milestone = await this.prisma.milestone.findUniqueOrThrow({
      where: { id: milestoneId },
      include: { project: { include: { releases: latestReleaseInclude } } },
    });
    const parsedRepo = parseGitHubRepoUrl(payload.repoUrl || payload.submissionValue);
    let repo = await this.prisma.userProjectRepo.findFirst({
      where: {
        userId,
        projectId: milestone.projectId,
      },
    });
    if (!repo) {
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
        projectId: milestone.projectId,
        projectReleaseId: milestone.project.releases[0].id,
        userProjectRepoId: repo.id,
        milestoneId,
        commitSha:
          payload.commitSha ||
          (payload.submissionType === 'github'
            ? `github-pending-${randomUUID().slice(0, 8)}`
            : `manual-${randomUUID().slice(0, 8)}`),
        repoUrl: payload.repoUrl || payload.submissionValue,
        branch: payload.branch || 'main',
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
      include: { project: true },
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
    const updated = await this.prisma.submissionAttempt
      .update({
        where: { id: submissionId },
        data: {
          submissionType: payload.submissionType as TrackingSubmissionType | undefined,
          submissionValue: payload.submissionValue,
          notes: payload.notes,
          repoUrl: payload.repoUrl,
          branch: payload.branch,
          commitSha: payload.commitSha,
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
  ): Promise<{ email: string; username: string } | null> {
    const attempt = await this.prisma.submissionAttempt.findUnique({
      where: { id: submissionId },
      select: { user: { select: { email: true, username: true } } },
    });
    return attempt ? attempt.user : null;
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
      include: { project: true },
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
    const projects = (await this.listTrackingProjects(apiBaseUrl, selected.id)).filter(
      (entry) => entry.status === 'published'
    );
    const milestonesByProject: Record<string, MilestoneRecord[]> = {};
    const statsByProject: Record<string, TrackingDashboardStats> = {};
    const reviews = await this.prisma.review.findMany({
      where: {
        submissionAttempt: {
          userId,
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
          userId,
          projectId: project.id,
        },
        include: { project: true },
      });
      const submissionRecords = submissions.map(toSubmissionRecord);
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
      orderBy: { createdAt: 'desc' },
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

import { randomUUID } from "node:crypto";
import {
  CourseRole,
  DeliveryMode,
  Prisma,
  PrismaClient,
  ProjectStatus as PrismaProjectStatus,
  RepoVisibility,
  ReviewStatus,
  SubmissionStatus,
  SystemRole,
  TrackingSubmissionType
} from "@prisma/client";
import { generateRepositoryFromTemplate, GitHubAppConfig } from "@nibras/github";
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
  ProjectRecord,
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
  UserRecord
} from "./store";

function defaultTask(): string {
  return [
    "# CS161 / exam1",
    "",
    "This is the first hosted-style Nibras task.",
    "",
    "1. Run `nibras login` against the hosted API.",
    "2. Run `nibras test` inside a provisioned project repo.",
    "3. Run `nibras submit` to push and wait for verification."
  ].join("\n");
}

function branchNameFromRef(ref: string): string {
  return ref.startsWith("refs/heads/") ? ref.slice("refs/heads/".length) : ref;
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
    if (url.hostname !== "github.com") {
      return null;
    }
    const [owner, name] = url.pathname.replace(/^\/+/, "").replace(/\.git$/, "").split("/");
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
  githubAccount: { login: string } | null;
}): UserRecord {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    githubLogin: user.githubAccount?.login || "",
    githubLinked: user.githubLinked,
    githubAppInstalled: user.githubAppInstalled,
    systemRole: user.systemRole === SystemRole.admin ? "admin" : "user"
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
    status: submission.status as SubmissionRecord["status"],
    summary: submission.summary,
    submissionType: submission.submissionType as SubmissionType,
    submissionValue: submission.submissionValue,
    notes: submission.notes,
    createdAt: submission.createdAt.toISOString(),
    updatedAt: submission.updatedAt.toISOString(),
    submittedAt: submission.submittedAt ? submission.submittedAt.toISOString() : null,
    localTestExitCode: submission.localTestExitCode
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
    updatedAt: course.updatedAt.toISOString()
  };
}

function toMembershipRecord(membership: {
  id: string;
  courseId: string;
  userId: string;
  role: CourseRole;
  createdAt: Date;
  updatedAt: Date;
}): CourseMembershipRecord {
  return {
    id: membership.id,
    courseId: membership.courseId,
    userId: membership.userId,
    role: membership.role as MembershipRole,
    createdAt: membership.createdAt.toISOString(),
    updatedAt: membership.updatedAt.toISOString()
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
    updatedAt: milestone.updatedAt.toISOString()
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
}): ReviewRecord {
  return {
    id: review.id,
    submissionId: review.submissionAttemptId,
    reviewerUserId: review.reviewerUserId,
    status: review.status as StoreReviewStatus,
    score: review.score,
    feedback: review.feedback,
    rubric: Array.isArray(review.rubricJson) ? review.rubricJson as TrackingRubricItemRecord[] : [],
    reviewedAt: review.reviewedAt ? review.reviewedAt.toISOString() : null,
    createdAt: review.createdAt.toISOString(),
    updatedAt: review.updatedAt.toISOString()
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
    receivedAt: record.receivedAt.toISOString()
  };
}

function projectStats(milestones: MilestoneRecord[], submissions: SubmissionRecord[], reviews: ReviewRecord[]): TrackingDashboardStats {
  const statuses = milestones.map((milestone) => {
    const milestoneSubmissions = submissions
      .filter((entry) => entry.milestoneId === milestone.id)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    if (milestoneSubmissions.length === 0) {
      return "open";
    }
    const latestReview = reviews
      .filter((entry) => entry.submissionId === milestoneSubmissions[0].id)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
    if (latestReview?.status === "approved" || latestReview?.status === "graded") {
      return latestReview.status;
    }
    return "submitted";
  });
  const approved = statuses.filter((entry) => entry === "approved" || entry === "graded").length;
  const underReview = statuses.filter((entry) => entry === "submitted").length;
  const futureDates = milestones
    .map((entry) => entry.dueAt)
    .filter((entry): entry is string => Boolean(entry))
    .map((entry) => new Date(entry))
    .filter((entry) => entry.getTime() > Date.now());
  const lastDue = futureDates.length > 0 ? new Date(Math.max(...futureDates.map((entry) => entry.getTime()))) : null;
  return {
    approved,
    underReview,
    completion: milestones.length ? Math.round((approved / milestones.length) * 100) : 0,
    total: milestones.length,
    daysRemaining: lastDue ? Math.ceil((lastDue.getTime() - Date.now()) / 86_400_000) : 0
  };
}

function toProjectRecord(project: {
  id: string;
  slug: string;
  courseId: string | null;
  name: string;
  description: string;
  status: PrismaProjectStatus;
  deliveryMode: DeliveryMode;
  rubricJson: unknown;
  resourcesJson: unknown;
  defaultBranch: string;
  createdAt: Date;
  updatedAt: Date;
  releases: Array<{ manifestJson: unknown; taskText: string }>;
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
    deliveryMode: project.deliveryMode === DeliveryMode.team ? "team" : "individual",
    rubric: Array.isArray(project.rubricJson) ? project.rubricJson as TrackingRubricItemRecord[] : [],
    resources: Array.isArray(project.resourcesJson) ? project.resourcesJson as TrackingResourceRecord[] : [],
    instructorUserId: null,
    manifest: release?.manifestJson as ProjectRecord["manifest"] || defaultManifest("http://127.0.0.1"),
    task: release?.taskText || defaultTask(),
    repoByUserId: {},
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString()
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
    if (process.env.NODE_ENV === "production" && process.env.NIBRAS_ENABLE_DEMO_SEED !== "1") {
      this.seeded = true;
      return;
    }
    const [existingCourse, existingProject, existingDemoUser, existingInstructorUser, existingRelease, existingMemberships, existingMilestones] = await Promise.all([
      this.prisma.course.findUnique({ where: { slug: "cs161" } }),
      this.prisma.project.findUnique({ where: { slug: "cs161/exam1" } }),
      this.prisma.user.findUnique({ where: { email: "demo@nibras.dev" } }),
      this.prisma.user.findUnique({ where: { email: "instructor@nibras.dev" } }),
      this.prisma.projectRelease.findFirst({
        where: {
          project: { slug: "cs161/exam1" }
        }
      }),
      this.prisma.courseMembership.count({
        where: {
          course: { slug: "cs161" }
        }
      }),
      this.prisma.milestone.count({
        where: {
          project: { slug: "cs161/exam1" }
        }
      })
    ]);
    if (
      existingCourse &&
      existingProject &&
      existingDemoUser &&
      existingInstructorUser &&
      existingRelease &&
      existingMemberships >= 2 &&
      existingMilestones >= 2
    ) {
      this.seeded = true;
      return;
    }

    const subject = await this.prisma.subject.upsert({
      where: { slug: "cs161" },
      update: { name: "CS161" },
      create: { slug: "cs161", name: "CS161" }
    });

    const course = await this.prisma.course.upsert({
      where: { slug: "cs161" },
      update: {
        title: "CS 161: Foundations of Systems",
        termLabel: "Spring 2026",
        courseCode: "CS161",
        isActive: true
      },
      create: {
        slug: "cs161",
        title: "CS 161: Foundations of Systems",
        termLabel: "Spring 2026",
        courseCode: "CS161",
        isActive: true
      }
    });

    const project = await this.prisma.project.upsert({
      where: { slug: "cs161/exam1" },
      update: {
        name: "Exam 1",
        defaultBranch: "main",
        subjectId: subject.id,
        courseId: course.id,
        description: "Design, implement, and defend your solution for the first milestone sequence.",
        status: PrismaProjectStatus.published,
        deliveryMode: DeliveryMode.individual,
        rubricJson: [
          { criterion: "Correctness", maxScore: 50 },
          { criterion: "Clarity", maxScore: 30 },
          { criterion: "Testing", maxScore: 20 }
        ],
        resourcesJson: [
          { label: "Task brief", url: "https://example.com/task-brief" },
          { label: "Reference notes", url: "https://example.com/reference-notes" }
        ]
      },
      create: {
        slug: "cs161/exam1",
        name: "Exam 1",
        defaultBranch: "main",
        subjectId: subject.id,
        courseId: course.id,
        description: "Design, implement, and defend your solution for the first milestone sequence.",
        status: PrismaProjectStatus.published,
        deliveryMode: DeliveryMode.individual,
        rubricJson: [
          { criterion: "Correctness", maxScore: 50 },
          { criterion: "Clarity", maxScore: 30 },
          { criterion: "Testing", maxScore: 20 }
        ],
        resourcesJson: [
          { label: "Task brief", url: "https://example.com/task-brief" },
          { label: "Reference notes", url: "https://example.com/reference-notes" }
        ]
      }
    });

    await this.prisma.user.upsert({
      where: { email: "demo@nibras.dev" },
      update: {
        username: "demo",
        githubLinked: true,
        githubAppInstalled: true,
        systemRole: SystemRole.user
      },
      create: {
        username: "demo",
        email: "demo@nibras.dev",
        githubLinked: true,
        githubAppInstalled: true,
        systemRole: SystemRole.user
      }
    });

    await this.prisma.user.upsert({
      where: { email: "instructor@nibras.dev" },
      update: {
        username: "instructor",
        githubLinked: true,
        githubAppInstalled: true,
        systemRole: SystemRole.admin
      },
      create: {
        username: "instructor",
        email: "instructor@nibras.dev",
        githubLinked: true,
        githubAppInstalled: true,
        systemRole: SystemRole.admin
      }
    });

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { email: "demo@nibras.dev" }
    });

    const instructor = await this.prisma.user.findUniqueOrThrow({
      where: { email: "instructor@nibras.dev" }
    });

    await this.prisma.githubAccount.upsert({
      where: { userId: user.id },
      update: { githubUserId: "demo-user-id", login: "demo-user" },
      create: {
        userId: user.id,
        githubUserId: "demo-user-id",
        login: "demo-user",
        installationId: "demo-installation"
      }
    });

    await this.prisma.githubAccount.upsert({
      where: { userId: instructor.id },
      update: { githubUserId: "instructor-user-id", login: "nibras-instructor" },
      create: {
        userId: instructor.id,
        githubUserId: "instructor-user-id",
        login: "nibras-instructor",
        installationId: "demo-installation"
      }
    });

    await this.prisma.courseMembership.upsert({
      where: {
        courseId_userId: {
          courseId: course.id,
          userId: user.id
        }
      },
      update: {
        role: CourseRole.student
      },
      create: {
        courseId: course.id,
        userId: user.id,
        role: CourseRole.student
      }
    });

    await this.prisma.courseMembership.upsert({
      where: {
        courseId_userId: {
          courseId: course.id,
          userId: instructor.id
        }
      },
      update: {
        role: CourseRole.instructor
      },
      create: {
        courseId: course.id,
        userId: instructor.id,
        role: CourseRole.instructor
      }
    });

    const manifest = defaultManifest(apiBaseUrl);
    await this.prisma.projectRelease.upsert({
      where: {
        projectId_version: {
          projectId: project.id,
          version: manifest.releaseVersion
        }
      },
      update: {
        taskText: defaultTask(),
        manifestJson: manifest
      },
      create: {
        projectId: project.id,
        version: manifest.releaseVersion,
        taskText: defaultTask(),
        manifestJson: manifest,
        publicAssetRef: "public://seed",
        privateAssetRef: "private://seed"
      }
    });

    const milestones = [
      {
        title: "Design Review",
        description: "Submit an initial design, edge cases, and implementation plan.",
        order: 1,
        dueAt: new Date("2026-03-27T17:00:00.000Z"),
        isFinal: false
      },
      {
        title: "Final Project Submission",
        description: "Submit the final repository state and project write-up.",
        order: 2,
        dueAt: new Date("2026-04-08T17:00:00.000Z"),
        isFinal: true
      }
    ];

    for (const milestone of milestones) {
      await this.prisma.milestone.upsert({
        where: {
          projectId_order: {
            projectId: project.id,
            order: milestone.order
          }
        },
        update: milestone,
        create: {
          projectId: project.id,
          ...milestone
        }
      }).catch(async () => {
        const existing = await this.prisma.milestone.findFirst({
          where: {
            projectId: project.id,
            order: milestone.order
          }
        });
        if (!existing) {
          throw new Error("Unable to seed milestone.");
        }
        await this.prisma.milestone.update({
          where: { id: existing.id },
          data: milestone
        });
      });
    }
    this.seeded = true;
  }

  private async getDefaultUser(): Promise<{ id: string }> {
    return this.prisma.user.findUniqueOrThrow({
      where: { email: "demo@nibras.dev" },
      select: { id: true }
    });
  }

  async createSessionForUser(userId: string): Promise<SessionRecord> {
    const created = await this.prisma.cliSession.create({
      data: {
        userId,
        accessToken: `access_${randomUUID()}`,
        refreshToken: `refresh_${randomUUID()}`
      }
    });
    return {
      accessToken: created.accessToken,
      refreshToken: created.refreshToken,
      userId: created.userId,
      createdAt: created.createdAt.toISOString()
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
    const user = await this.prisma.user.upsert({
      where: { email },
      update: {
        username,
        githubLinked: true
      },
      create: {
        username,
        email,
        githubLinked: true,
        githubAppInstalled: false
      }
    });

    await this.prisma.githubAccount.upsert({
      where: { userId: user.id },
      update: {
        githubUserId: args.githubUserId,
        login: args.login,
        userAccessToken: args.accessToken,
        userRefreshToken: args.refreshToken || null,
        userAccessTokenExpiresAt: args.accessTokenExpiresIn
          ? new Date(Date.now() + args.accessTokenExpiresIn * 1000)
          : null,
        userRefreshTokenExpiresAt: args.refreshTokenExpiresIn
          ? new Date(Date.now() + args.refreshTokenExpiresIn * 1000)
          : null
      },
      create: {
        userId: user.id,
        githubUserId: args.githubUserId,
        login: args.login,
        userAccessToken: args.accessToken,
        userRefreshToken: args.refreshToken || null,
        userAccessTokenExpiresAt: args.accessTokenExpiresIn
          ? new Date(Date.now() + args.accessTokenExpiresIn * 1000)
          : null,
        userRefreshTokenExpiresAt: args.refreshTokenExpiresIn
          ? new Date(Date.now() + args.refreshTokenExpiresIn * 1000)
          : null
      }
    });

    const session = await this.createSessionForUser(user.id);
    const hydrated = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      include: { githubAccount: true }
    });
    return {
      user: toUserRecord(hydrated),
      session
    };
  }

  async getGithubAccountForUser(userId: string): Promise<{
    login: string;
    installationId: string | null;
    userAccessToken: string | null;
  } | null> {
    const account = await this.prisma.githubAccount.findUnique({
      where: { userId }
    });
    if (!account) {
      return null;
    }
    return {
      login: account.login,
      installationId: account.installationId,
      userAccessToken: account.userAccessToken
    };
  }

  async linkGitHubInstallation(userId: string, installationId: string): Promise<UserRecord> {
    await this.prisma.githubAccount.update({
      where: { userId },
      data: { installationId }
    });
    await this.prisma.user.update({
      where: { id: userId },
      data: { githubAppInstalled: true }
    });
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { githubAccount: true }
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
    const repoPath = `/${payload.owner}/${payload.repoName}`;
    const branch = branchNameFromRef(payload.ref);
    const submission = await this.prisma.submissionAttempt.findFirst({
      where: {
        submissionType: TrackingSubmissionType.github,
        branch,
        OR: [
          { commitSha: payload.after },
          { commitSha: { startsWith: "github-pending-" } }
        ],
        AND: [{
          OR: [
            { repoUrl: { contains: repoPath } },
            { submissionValue: { contains: repoPath } }
          ]
        }]
      },
      include: { project: true },
      orderBy: { createdAt: "desc" }
    });
    if (!submission) {
      return;
    }
    await this.prisma.submissionAttempt.update({
      where: { id: submission.id },
      data: {
        status: SubmissionStatus.running,
        summary: `GitHub push received for ${payload.ref}. Verification is running.`,
        commitSha: payload.after || submission.commitSha
      }
    });
    await this.prisma.githubDelivery.create({
      data: {
        submissionAttemptId: submission.id,
        repoUrl: payload.repositoryUrl || `https://github.com/${payload.owner}/${payload.repoName}`,
        eventType: payload.eventType || "push",
        deliveryId: payload.deliveryId || randomUUID(),
        ref: payload.ref,
        commitSha: payload.after,
        payloadJson: (payload.rawPayload || {}) as Prisma.InputJsonValue
      }
    });
    await this.prisma.verificationRun.create({
      data: {
        submissionAttemptId: submission.id,
        status: SubmissionStatus.running,
        log: `Webhook push received for ${payload.ref}`
      }
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
        status: "pending"
      }
    });
    return {
      deviceCode: created.deviceCode,
      userCode: created.userCode,
      expiresAt: created.expiresAt.toISOString(),
      intervalSeconds: created.intervalSeconds,
      userId: created.userId,
      status: created.status === "authorized" ? "authorized" : "pending"
    };
  }

  async authorizeDeviceCode(apiBaseUrl: string, userCode: string): Promise<DeviceCodeRecord | null> {
    await this.seed(apiBaseUrl);
    const defaultUser = await this.getDefaultUser();
    const found = await this.prisma.deviceCode.findUnique({ where: { userCode } });
    if (!found) {
      return null;
    }
    const updated = await this.prisma.deviceCode.update({
      where: { userCode },
      data: {
        status: "authorized",
        userId: defaultUser.id,
        approvedAt: new Date()
      }
    });
    return {
      deviceCode: updated.deviceCode,
      userCode: updated.userCode,
      expiresAt: updated.expiresAt.toISOString(),
      intervalSeconds: updated.intervalSeconds,
      userId: updated.userId,
      status: "authorized"
    };
  }

  async pollDeviceCode(apiBaseUrl: string, deviceCode: string): Promise<{ record: DeviceCodeRecord | null; session: SessionRecord | null }> {
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
      status: record.status === "authorized" ? "authorized" : "pending"
    };

    if (record.status !== "authorized" || !record.userId) {
      return { record: mappedRecord, session: null };
    }

    const existing = await this.prisma.cliSession.findFirst({
      where: { userId: record.userId, revokedAt: null },
      orderBy: { createdAt: "desc" }
    });
    if (existing) {
      return {
        record: mappedRecord,
        session: {
          accessToken: existing.accessToken,
          refreshToken: existing.refreshToken,
          userId: existing.userId,
          createdAt: existing.createdAt.toISOString()
        }
      };
    }

    const created = await this.prisma.cliSession.create({
      data: {
        userId: record.userId,
        accessToken: `access_${randomUUID()}`,
        refreshToken: `refresh_${randomUUID()}`
      }
    });
    return {
      record: mappedRecord,
      session: {
        accessToken: created.accessToken,
        refreshToken: created.refreshToken,
        userId: created.userId,
        createdAt: created.createdAt.toISOString()
      }
    };
  }

  async getUserByToken(apiBaseUrl: string, accessToken: string): Promise<UserRecord | null> {
    await this.seed(apiBaseUrl);
    const session = await this.prisma.cliSession.findUnique({
      where: { accessToken },
      include: {
        user: {
          include: { githubAccount: true }
        }
      }
    });
    if (!session || session.revokedAt) {
      return null;
    }
    return toUserRecord(session.user);
  }

  async deleteSession(apiBaseUrl: string, accessToken: string): Promise<void> {
    await this.seed(apiBaseUrl);
    await this.prisma.cliSession.updateMany({
      where: { accessToken, revokedAt: null },
      data: { revokedAt: new Date() }
    });
  }

  async getProject(apiBaseUrl: string, projectKey: string): Promise<ProjectRecord | null> {
    await this.seed(apiBaseUrl);
    const project = await this.prisma.project.findUnique({
      where: { slug: projectKey },
      include: {
        releases: { orderBy: { createdAt: "desc" }, take: 1 }
      }
    });
    if (!project || project.releases.length === 0) {
      return null;
    }
    return toProjectRecord(project);
  }

  async provisionProjectRepo(apiBaseUrl: string, projectKey: string, userId: string): Promise<RepoRecord> {
    await this.seed(apiBaseUrl);
    const project = await this.prisma.project.findUnique({ where: { slug: projectKey } });
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { githubAccount: true }
    });
    if (!project || !user || !user.githubAccount) {
      throw new Error("Project or user not found.");
    }
    const existing = await this.prisma.userProjectRepo.findUnique({
      where: {
        userId_projectId: {
          userId,
          projectId: project.id
        }
      }
    });
    if (existing) {
      return {
        owner: existing.owner,
        name: existing.name,
        cloneUrl: existing.cloneUrl,
        defaultBranch: existing.defaultBranch,
        visibility: existing.visibility === RepoVisibility.private ? "private" : "public"
      };
    }

    const created = await this.prisma.userProjectRepo.create({
      data: {
        userId,
        projectId: project.id,
        owner: user.githubAccount.login,
        name: `nibras-${projectKey.replace("/", "-")}`,
        defaultBranch: project.defaultBranch,
        visibility: RepoVisibility.private,
        installStatus: "provisioned"
      }
    });
    return {
      owner: created.owner,
      name: created.name,
      cloneUrl: created.cloneUrl,
      defaultBranch: created.defaultBranch,
      visibility: "private"
    };
  }

  async provisionProjectRepoFromGitHub(
    apiBaseUrl: string,
    projectKey: string,
    userId: string,
    githubConfig: GitHubAppConfig
  ): Promise<RepoRecord> {
    const account = await this.prisma.githubAccount.findUnique({
      where: { userId }
    });
    const project = await this.prisma.project.findUnique({
      where: { slug: projectKey }
    });
    if (!account?.userAccessToken || !project) {
      throw new Error("GitHub account or project is not ready for provisioning.");
    }
    const repoName = `nibras-${projectKey.replace("/", "-")}`;
    const generated = await generateRepositoryFromTemplate(
      githubConfig,
      account.userAccessToken,
      account.login,
      repoName
    );
    const record = await this.prisma.userProjectRepo.upsert({
      where: {
        userId_projectId: {
          userId,
          projectId: project.id
        }
      },
      update: {
        owner: account.login,
        name: repoName,
        cloneUrl: generated.cloneUrl,
        defaultBranch: project.defaultBranch,
        visibility: RepoVisibility.private,
        installStatus: "provisioned"
      },
      create: {
        userId,
        projectId: project.id,
        owner: account.login,
        name: repoName,
        cloneUrl: generated.cloneUrl,
        defaultBranch: project.defaultBranch,
        visibility: RepoVisibility.private,
        installStatus: "provisioned"
      }
    });
    return {
      owner: record.owner,
      name: record.name,
      cloneUrl: record.cloneUrl,
      defaultBranch: record.defaultBranch,
      visibility: record.visibility === RepoVisibility.private ? "private" : "public"
    };
  }

  async createOrReuseSubmission(
    apiBaseUrl: string,
    payload: { userId: string; projectKey: string; commitSha: string; repoUrl: string; branch: string }
  ): Promise<SubmissionRecord> {
    await this.seed(apiBaseUrl);
    const project = await this.prisma.project.findUnique({
      where: { slug: payload.projectKey },
      include: { releases: { orderBy: { createdAt: "desc" }, take: 1 } }
    });
    if (!project || project.releases.length === 0) {
      throw new Error("Project release not found.");
    }
    const repo = await this.prisma.userProjectRepo.findUnique({
      where: {
        userId_projectId: {
          userId: payload.userId,
          projectId: project.id
        }
      }
    });
    if (!repo) {
      throw new Error("Provisioned repository not found for user.");
    }
    const existing = await this.prisma.submissionAttempt.findFirst({
      where: {
        userId: payload.userId,
        projectId: project.id,
        commitSha: payload.commitSha
      },
      include: { project: true }
    });
    if (existing) {
      return toSubmissionRecord(existing);
    }
    const created = await this.prisma.submissionAttempt.create({
      data: {
        userId: payload.userId,
        projectId: project.id,
        projectReleaseId: project.releases[0].id,
        userProjectRepoId: repo.id,
        milestoneId: null,
        commitSha: payload.commitSha,
        repoUrl: payload.repoUrl,
        branch: payload.branch,
        status: SubmissionStatus.queued,
        summary: "Submission queued for verification.",
        submissionType: TrackingSubmissionType.github,
        submissionValue: payload.repoUrl,
        submittedAt: new Date()
      },
      include: { project: true }
    });
    await this.prisma.verificationRun.create({
      data: {
        submissionAttemptId: created.id,
        status: SubmissionStatus.queued,
        log: "Queued"
      }
    });
    return toSubmissionRecord(created);
  }

  async updateLocalTestResult(apiBaseUrl: string, submissionId: string, exitCode: number, summary: string): Promise<SubmissionRecord | null> {
    await this.seed(apiBaseUrl);
    const updated = await this.prisma.submissionAttempt.update({
      where: { id: submissionId },
      data: {
        localTestExitCode: exitCode,
        summary
      },
      include: { project: true }
    }).catch(() => null);
    if (!updated) {
      return null;
    }
    return toSubmissionRecord(updated);
  }

  async getSubmission(apiBaseUrl: string, submissionId: string): Promise<SubmissionRecord | null> {
    await this.seed(apiBaseUrl);
    const submission = await this.prisma.submissionAttempt.findUnique({
      where: { id: submissionId },
      include: { project: true }
    });
    if (!submission) {
      return null;
    }

    const ageMs = Date.now() - submission.createdAt.getTime();
    if (!submission.milestoneId && submission.status === SubmissionStatus.queued && ageMs > 1200) {
      await this.prisma.submissionAttempt.update({
        where: { id: submission.id },
        data: {
          status: SubmissionStatus.running,
          summary: "Verification is running."
        }
      });
    }
    if (!submission.milestoneId && submission.status === SubmissionStatus.running && ageMs > 2600) {
      const nextStatus =
        submission.localTestExitCode && submission.localTestExitCode !== 0
          ? SubmissionStatus.failed
          : SubmissionStatus.passed;
      await this.prisma.submissionAttempt.update({
        where: { id: submission.id },
        data: {
          status: nextStatus,
          summary: nextStatus === SubmissionStatus.passed
            ? "Verification passed."
            : "Verification failed because the reported local tests failed."
        }
      });
    }

    const refreshed = await this.prisma.submissionAttempt.findUnique({
      where: { id: submissionId },
      include: { project: true }
    });
    return refreshed ? toSubmissionRecord(refreshed) : null;
  }

  async listCourseMemberships(apiBaseUrl: string, userId: string): Promise<CourseMembershipRecord[]> {
    await this.seed(apiBaseUrl);
    const memberships = await this.prisma.courseMembership.findMany({
      where: { userId }
    });
    return memberships.map(toMembershipRecord);
  }

  async listTrackingCourses(apiBaseUrl: string, userId: string): Promise<CourseRecord[]> {
    await this.seed(apiBaseUrl);
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.systemRole === SystemRole.admin) {
      const courses = await this.prisma.course.findMany({
        where: { isActive: true },
        orderBy: { createdAt: "desc" }
      });
      return courses.map(toCourseRecord);
    }
    const memberships = await this.prisma.courseMembership.findMany({
      where: { userId },
      include: { course: true },
      orderBy: { createdAt: "desc" }
    });
    return memberships.map((entry) => toCourseRecord(entry.course));
  }

  async listTrackingProjects(apiBaseUrl: string, courseId: string): Promise<ProjectRecord[]> {
    await this.seed(apiBaseUrl);
    const projects = await this.prisma.project.findMany({
      where: { courseId },
      include: {
        releases: { orderBy: { createdAt: "desc" }, take: 1 }
      },
      orderBy: { createdAt: "desc" }
    });
    return projects.map(toProjectRecord);
  }

  async getTrackingProjectById(apiBaseUrl: string, projectId: string): Promise<ProjectRecord | null> {
    await this.seed(apiBaseUrl);
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        releases: { orderBy: { createdAt: "desc" }, take: 1 }
      }
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
      deliveryMode: "individual" | "team";
      rubric: TrackingRubricItemRecord[];
      resources: TrackingResourceRecord[];
    }
  ): Promise<ProjectRecord> {
    await this.seed(apiBaseUrl);
    const subject = await this.prisma.subject.findUniqueOrThrow({ where: { slug: payload.slug.split("/")[0] || "cs161" } }).catch(async () => {
      return this.prisma.subject.findFirstOrThrow();
    });
    const created = await this.prisma.project.create({
      data: {
        subjectId: subject.id,
        courseId: payload.courseId,
        slug: payload.slug,
        name: payload.title,
        defaultBranch: "main",
        description: payload.description,
        status: payload.status as PrismaProjectStatus,
        deliveryMode: payload.deliveryMode === "team" ? DeliveryMode.team : DeliveryMode.individual,
        rubricJson: payload.rubric,
        resourcesJson: payload.resources
      }
    });
    await this.prisma.projectRelease.create({
      data: {
        projectId: created.id,
        version: `tracking-${Date.now()}`,
        taskText: `# ${payload.title}\n\n${payload.description}\n`,
        manifestJson: {
          ...defaultManifest(apiBaseUrl),
          projectKey: payload.slug
        },
        publicAssetRef: "public://tracking",
        privateAssetRef: "private://tracking"
      }
    });
    const hydrated = await this.prisma.project.findUniqueOrThrow({
      where: { id: created.id },
      include: { releases: { orderBy: { createdAt: "desc" }, take: 1 } }
    });
    await this.prisma.auditLog.create({
      data: {
        userId,
        courseId: payload.courseId,
        projectId: created.id,
        action: "project.created",
        targetType: "project",
        targetId: created.id,
        payload: { title: payload.title }
      }
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
      deliveryMode: "individual" | "team";
      rubric: TrackingRubricItemRecord[];
      resources: TrackingResourceRecord[];
    }>
  ): Promise<ProjectRecord | null> {
    await this.seed(apiBaseUrl);
    const updated = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        slug: payload.slug,
        name: payload.title,
        description: payload.description,
        status: payload.status as PrismaProjectStatus | undefined,
        deliveryMode: payload.deliveryMode
          ? payload.deliveryMode === "team" ? DeliveryMode.team : DeliveryMode.individual
          : undefined,
        rubricJson: payload.rubric,
        resourcesJson: payload.resources
      },
      include: {
        releases: { orderBy: { createdAt: "desc" }, take: 1 }
      }
    }).catch(() => null);
    if (!updated) {
      return null;
    }
    await this.prisma.auditLog.create({
      data: {
        userId,
        courseId: updated.courseId,
        projectId: updated.id,
        action: "project.updated",
        targetType: "project",
        targetId: updated.id
      }
    });
    return toProjectRecord(updated);
  }

  async setTrackingProjectStatus(apiBaseUrl: string, userId: string, projectId: string, status: ProjectStatus): Promise<ProjectRecord | null> {
    return this.updateTrackingProject(apiBaseUrl, userId, projectId, { status });
  }

  async listTrackingMilestones(apiBaseUrl: string, projectId: string): Promise<MilestoneRecord[]> {
    await this.seed(apiBaseUrl);
    const milestones = await this.prisma.milestone.findMany({
      where: { projectId },
      orderBy: { order: "asc" }
    });
    return milestones.map(toMilestoneRecord);
  }

  async getTrackingMilestone(apiBaseUrl: string, milestoneId: string): Promise<MilestoneRecord | null> {
    await this.seed(apiBaseUrl);
    const milestone = await this.prisma.milestone.findUnique({
      where: { id: milestoneId }
    });
    return milestone ? toMilestoneRecord(milestone) : null;
  }

  async createTrackingMilestone(
    apiBaseUrl: string,
    userId: string,
    projectId: string,
    payload: { title: string; description: string; order: number; dueAt: string | null; isFinal: boolean }
  ): Promise<MilestoneRecord> {
    await this.seed(apiBaseUrl);
    const created = await this.prisma.milestone.create({
      data: {
        projectId,
        title: payload.title,
        description: payload.description,
        order: payload.order,
        dueAt: payload.dueAt ? new Date(payload.dueAt) : null,
        isFinal: payload.isFinal
      }
    });
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    await this.prisma.auditLog.create({
      data: {
        userId,
        courseId: project?.courseId || null,
        projectId,
        milestoneId: created.id,
        action: "milestone.created",
        targetType: "milestone",
        targetId: created.id
      }
    });
    return toMilestoneRecord(created);
  }

  async updateTrackingMilestone(
    apiBaseUrl: string,
    userId: string,
    milestoneId: string,
    payload: Partial<{ title: string; description: string; order: number; dueAt: string | null; isFinal: boolean }>
  ): Promise<MilestoneRecord | null> {
    await this.seed(apiBaseUrl);
    const updated = await this.prisma.milestone.update({
      where: { id: milestoneId },
      data: {
        title: payload.title,
        description: payload.description,
        order: payload.order,
        dueAt: payload.dueAt === undefined ? undefined : payload.dueAt ? new Date(payload.dueAt) : null,
        isFinal: payload.isFinal
      }
    }).catch(() => null);
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
        action: "milestone.updated",
        targetType: "milestone",
        targetId: milestoneId
      }
    });
    return toMilestoneRecord(updated);
  }

  async deleteTrackingMilestone(apiBaseUrl: string, userId: string, milestoneId: string): Promise<boolean> {
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
        action: "milestone.deleted",
        targetType: "milestone",
        targetId: milestoneId
      }
    });
    return true;
  }

  async listTrackingMilestoneSubmissions(apiBaseUrl: string, milestoneId: string): Promise<SubmissionRecord[]> {
    await this.seed(apiBaseUrl);
    const submissions = await this.prisma.submissionAttempt.findMany({
      where: { milestoneId },
      include: { project: true },
      orderBy: { createdAt: "desc" }
    });
    return submissions.map(toSubmissionRecord);
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
      include: { project: { include: { releases: { orderBy: { createdAt: "desc" }, take: 1 } } } }
    });
    const parsedRepo = parseGitHubRepoUrl(payload.repoUrl || payload.submissionValue);
    let repo = await this.prisma.userProjectRepo.findFirst({
      where: {
        userId,
        projectId: milestone.projectId
      }
    });
    if (!repo) {
      const account = await this.prisma.githubAccount.findUnique({ where: { userId } });
      repo = await this.prisma.userProjectRepo.create({
        data: {
          userId,
          projectId: milestone.projectId,
          owner: parsedRepo?.owner || account?.login || "nibras-user",
          name: parsedRepo?.name || `nibras-${milestone.project.slug.replace("/", "-")}`,
          cloneUrl: payload.repoUrl || payload.submissionValue || null,
          defaultBranch: payload.branch || "main",
          visibility: RepoVisibility.private,
          installStatus: "provisioned"
        }
      });
    }
    const submission = await this.prisma.submissionAttempt.create({
      data: {
        userId,
        projectId: milestone.projectId,
        projectReleaseId: milestone.project.releases[0].id,
        userProjectRepoId: repo.id,
        milestoneId,
        commitSha: payload.commitSha || (
          payload.submissionType === "github"
            ? `github-pending-${randomUUID().slice(0, 8)}`
            : `manual-${randomUUID().slice(0, 8)}`
        ),
        repoUrl: payload.repoUrl || payload.submissionValue,
        branch: payload.branch || "main",
        status: payload.submissionType === "github" ? SubmissionStatus.running : SubmissionStatus.needs_review,
        summary: payload.submissionType === "github"
          ? "GitHub submission received. Waiting for webhook activity."
          : "Submission received and queued for instructor review.",
        submissionType: payload.submissionType as TrackingSubmissionType,
        submissionValue: payload.submissionValue,
        notes: payload.notes,
        submittedAt: new Date()
      },
      include: { project: true }
    });
    await this.prisma.auditLog.create({
      data: {
        userId,
        courseId: milestone.project.courseId,
        projectId: milestone.projectId,
        milestoneId,
        submissionAttemptId: submission.id,
        action: "submission.created",
        targetType: "submission",
        targetId: submission.id
      }
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
    const updated = await this.prisma.submissionAttempt.update({
      where: { id: submissionId },
      data: {
        submissionType: payload.submissionType as TrackingSubmissionType | undefined,
        submissionValue: payload.submissionValue,
        notes: payload.notes,
        repoUrl: payload.repoUrl,
        branch: payload.branch,
        commitSha: payload.commitSha
      },
      include: { project: true }
    }).catch(() => null);
    if (!updated) {
      return null;
    }
    await this.prisma.auditLog.create({
      data: {
        userId,
        projectId: updated.projectId,
        milestoneId: updated.milestoneId,
        submissionAttemptId: submissionId,
        action: "submission.updated",
        targetType: "submission",
        targetId: submissionId
      }
    });
    return toSubmissionRecord(updated);
  }

  async createTrackingReview(
    apiBaseUrl: string,
    userId: string,
    submissionId: string,
    payload: { status: StoreReviewStatus; score: number | null; feedback: string; rubric: TrackingRubricItemRecord[] }
  ): Promise<ReviewRecord> {
    await this.seed(apiBaseUrl);
    const submission = await this.prisma.submissionAttempt.findUniqueOrThrow({
      where: { id: submissionId }
    });
    const review = await this.prisma.review.create({
      data: {
        submissionAttemptId: submissionId,
        reviewerUserId: userId,
        status: payload.status as ReviewStatus,
        score: payload.score,
        feedback: payload.feedback,
        rubricJson: payload.rubric,
        reviewedAt: new Date()
      }
    });
    await this.prisma.submissionAttempt.update({
      where: { id: submissionId },
      data: {
        status: payload.status === "changes_requested"
          ? SubmissionStatus.failed
          : payload.status === "approved" || payload.status === "graded"
            ? SubmissionStatus.passed
            : SubmissionStatus.needs_review,
        summary: payload.feedback || payload.status
      }
    });
    await this.prisma.auditLog.create({
      data: {
        userId,
        projectId: submission.projectId,
        milestoneId: submission.milestoneId,
        submissionAttemptId: submissionId,
        action: "review.created",
        targetType: "review",
        targetId: review.id
      }
    });
    return toReviewRecord(review);
  }

  async getTrackingReview(apiBaseUrl: string, submissionId: string): Promise<ReviewRecord | null> {
    await this.seed(apiBaseUrl);
    const review = await this.prisma.review.findFirst({
      where: { submissionAttemptId: submissionId },
      orderBy: { createdAt: "desc" }
    });
    return review ? toReviewRecord(review) : null;
  }

  async listTrackingReviewQueue(
    apiBaseUrl: string,
    filters?: { courseId?: string; projectId?: string; status?: SubmissionRecord["status"] }
  ): Promise<SubmissionRecord[]> {
    await this.seed(apiBaseUrl);
    const submissions = await this.prisma.submissionAttempt.findMany({
      where: {
        milestoneId: { not: null },
        status: filters?.status as SubmissionStatus | undefined,
        projectId: filters?.projectId,
        project: filters?.courseId ? { courseId: filters.courseId } : undefined
      },
      include: { project: true },
      orderBy: { createdAt: "desc" }
    });
    return submissions.map(toSubmissionRecord);
  }

  async listTrackingActivity(apiBaseUrl: string, userId: string): Promise<ActivityRecord[]> {
    await this.seed(apiBaseUrl);
    const courses = await this.listTrackingCourses(apiBaseUrl, userId);
    const courseIds = courses.map((entry) => entry.id);
    const logs = await this.prisma.auditLog.findMany({
      where: {
        OR: [
          { courseId: { in: courseIds } },
          { courseId: null }
        ]
      },
      orderBy: { createdAt: "desc" },
      take: 20
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
      createdAt: entry.createdAt.toISOString()
    }));
  }

  async getStudentTrackingDashboard(apiBaseUrl: string, userId: string, courseId?: string | null): Promise<StudentDashboardRecord> {
    await this.seed(apiBaseUrl);
    const courses = await this.listTrackingCourses(apiBaseUrl, userId);
    const memberships = await this.listCourseMemberships(apiBaseUrl, userId);
    const selected = courseId ? courses.find((entry) => entry.id === courseId) || null : courses[0] || null;
    if (!selected) {
      return {
        course: null,
        memberships,
        projects: [],
        milestonesByProject: {},
        activeProjectId: null,
        activity: [],
        statsByProject: {},
        pageError: "No active course found for this account."
      };
    }
    const projects = (await this.listTrackingProjects(apiBaseUrl, selected.id)).filter((entry) => entry.status === "published");
    const milestonesByProject: Record<string, MilestoneRecord[]> = {};
    const statsByProject: Record<string, TrackingDashboardStats> = {};
    const reviews = await this.prisma.review.findMany({
      where: {
        submissionAttempt: {
          userId,
          project: {
            courseId: selected.id
          }
        }
      }
    });
    const reviewRecords = reviews.map(toReviewRecord);
    for (const project of projects) {
      const milestones = await this.listTrackingMilestones(apiBaseUrl, project.id);
      const submissions = await this.prisma.submissionAttempt.findMany({
        where: {
          userId,
          projectId: project.id
        },
        include: { project: true }
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
      activity: (await this.listTrackingActivity(apiBaseUrl, userId)).filter((entry) => entry.courseId === selected.id),
      statsByProject,
      pageError: projects.length === 0 ? "No published projects found for this course yet." : null
    };
  }

  async getInstructorTrackingDashboard(apiBaseUrl: string, userId: string): Promise<InstructorDashboardRecord> {
    await this.seed(apiBaseUrl);
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const courses = user.systemRole === SystemRole.admin
      ? await this.listTrackingCourses(apiBaseUrl, userId)
      : (await this.prisma.courseMembership.findMany({
          where: {
            userId,
            role: { in: [CourseRole.instructor, CourseRole.ta] }
          },
          include: { course: true },
          orderBy: { createdAt: "desc" }
        })).map((entry) => toCourseRecord(entry.course));
    const courseIds = courses.map((entry) => entry.id);
    let reviewQueue: SubmissionRecord[] = [];
    if (user.systemRole === SystemRole.admin) {
      reviewQueue = await this.listTrackingReviewQueue(apiBaseUrl);
    } else if (courseIds.length > 0) {
      const batches = await Promise.all(courseIds.map((courseId) => this.listTrackingReviewQueue(apiBaseUrl, { courseId })));
      reviewQueue = batches.flat();
    }
    const activity = user.systemRole === SystemRole.admin
      ? await this.listTrackingActivity(apiBaseUrl, userId)
      : (await this.listTrackingActivity(apiBaseUrl, userId)).filter((entry) => entry.courseId === null || courseIds.includes(entry.courseId));
    return {
      courses,
      reviewQueue,
      activity
    };
  }

  async getCourseTrackingDashboard(apiBaseUrl: string, userId: string, courseId: string): Promise<InstructorDashboardRecord> {
    await this.seed(apiBaseUrl);
    return {
      courses: (await this.listTrackingCourses(apiBaseUrl, userId)).filter((entry) => entry.id === courseId),
      reviewQueue: await this.listTrackingReviewQueue(apiBaseUrl, { courseId }),
      activity: (await this.listTrackingActivity(apiBaseUrl, userId)).filter((entry) => entry.courseId === courseId)
    };
  }

  async getTrackingSubmissionCommits(apiBaseUrl: string, submissionId: string): Promise<GithubDeliveryRecord[]> {
    await this.seed(apiBaseUrl);
    const deliveries = await this.prisma.githubDelivery.findMany({
      where: { submissionAttemptId: submissionId },
      orderBy: { receivedAt: "desc" }
    });
    return deliveries.map(toGithubDeliveryRecord);
  }

  async close(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

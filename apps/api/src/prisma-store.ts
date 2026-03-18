import { randomUUID } from "node:crypto";
import { PrismaClient, RepoVisibility, SubmissionStatus } from "@prisma/client";
import { generateRepositoryFromTemplate, GitHubAppConfig } from "@nibras/github";
import { AppStore, defaultManifest, DeviceCodeRecord, ProjectRecord, RepoRecord, SessionRecord, SubmissionRecord, UserRecord } from "./store";

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

function toUserRecord(user: {
  id: string;
  username: string;
  email: string;
  githubLinked: boolean;
  githubAppInstalled: boolean;
  githubAccount: { login: string } | null;
}): UserRecord {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    githubLogin: user.githubAccount?.login || "",
    githubLinked: user.githubLinked,
    githubAppInstalled: user.githubAppInstalled
  };
}

function toSubmissionRecord(submission: {
  id: string;
  userId: string;
  project: { slug: string };
  commitSha: string;
  repoUrl: string;
  branch: string;
  status: SubmissionStatus;
  summary: string;
  createdAt: Date;
  updatedAt: Date;
  localTestExitCode: number | null;
}): SubmissionRecord {
  return {
    id: submission.id,
    userId: submission.userId,
    projectKey: submission.project.slug,
    commitSha: submission.commitSha,
    repoUrl: submission.repoUrl,
    branch: submission.branch,
    status: submission.status,
    summary: submission.summary,
    createdAt: submission.createdAt.toISOString(),
    updatedAt: submission.updatedAt.toISOString(),
    localTestExitCode: submission.localTestExitCode
  };
}

export class PrismaStore implements AppStore {
  private readonly prisma: PrismaClient;

  constructor(prismaClient?: PrismaClient) {
    this.prisma = prismaClient || new PrismaClient();
  }

  async seed(apiBaseUrl: string): Promise<void> {
    const subject = await this.prisma.subject.upsert({
      where: { slug: "cs161" },
      update: { name: "CS161" },
      create: { slug: "cs161", name: "CS161" }
    });

    const project = await this.prisma.project.upsert({
      where: { slug: "cs161/exam1" },
      update: { name: "exam1", defaultBranch: "main", subjectId: subject.id },
      create: {
        slug: "cs161/exam1",
        name: "exam1",
        defaultBranch: "main",
        subjectId: subject.id
      }
    });

    await this.prisma.user.upsert({
      where: { email: "demo@nibras.dev" },
      update: {
        username: "demo",
        githubLinked: true,
        githubAppInstalled: true
      },
      create: {
        username: "demo",
        email: "demo@nibras.dev",
        githubLinked: true,
        githubAppInstalled: true
      }
    });

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { email: "demo@nibras.dev" }
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
  }): Promise<void> {
    const repo = await this.prisma.userProjectRepo.findFirst({
      where: {
        owner: payload.owner,
        name: payload.repoName
      }
    });
    if (!repo) {
      return;
    }
    const submission = await this.prisma.submissionAttempt.findFirst({
      where: {
        userProjectRepoId: repo.id,
        commitSha: payload.after
      }
    });
    if (!submission) {
      return;
    }
    await this.prisma.submissionAttempt.update({
      where: { id: submission.id },
      data: {
        status: SubmissionStatus.running,
        summary: `GitHub push received for ${payload.ref}. Verification is running.`
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
    const release = project.releases[0];
    return {
      projectKey: project.slug,
      manifest: release.manifestJson as unknown as ReturnType<typeof defaultManifest>,
      task: release.taskText,
      repoByUserId: {}
    };
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
        commitSha: payload.commitSha,
        repoUrl: payload.repoUrl,
        branch: payload.branch,
        status: SubmissionStatus.queued,
        summary: "Submission queued for verification."
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
    if (submission.status === SubmissionStatus.queued && ageMs > 1200) {
      await this.prisma.submissionAttempt.update({
        where: { id: submission.id },
        data: {
          status: SubmissionStatus.running,
          summary: "Verification is running."
        }
      });
    }
    if (submission.status === SubmissionStatus.running && ageMs > 2600) {
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

  async close(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

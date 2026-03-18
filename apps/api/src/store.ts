import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { ProjectManifest } from "@nibras/contracts";

export type DeviceCodeRecord = {
  deviceCode: string;
  userCode: string;
  expiresAt: string;
  intervalSeconds: number;
  userId: string | null;
  status: "pending" | "authorized";
};

export type SessionRecord = {
  accessToken: string;
  refreshToken: string;
  userId: string;
  createdAt: string;
};

export type UserRecord = {
  id: string;
  username: string;
  email: string;
  githubLogin: string;
  githubLinked: boolean;
  githubAppInstalled: boolean;
};

export type SubmissionRecord = {
  id: string;
  userId: string;
  projectKey: string;
  commitSha: string;
  repoUrl: string;
  branch: string;
  status: "queued" | "running" | "passed" | "failed" | "needs_review";
  summary: string;
  createdAt: string;
  updatedAt: string;
  localTestExitCode: number | null;
};

export type RepoRecord = {
  owner: string;
  name: string;
  cloneUrl: string | null;
  defaultBranch: string;
  visibility: "private" | "public";
};

export type ProjectRecord = {
  projectKey: string;
  manifest: ProjectManifest;
  task: string;
  repoByUserId: Record<string, RepoRecord>;
};

export type StoreData = {
  users: UserRecord[];
  deviceCodes: DeviceCodeRecord[];
  sessions: SessionRecord[];
  submissions: SubmissionRecord[];
  projects: ProjectRecord[];
};

export interface AppStore {
  createDeviceCode(apiBaseUrl: string): Promise<DeviceCodeRecord>;
  authorizeDeviceCode(apiBaseUrl: string, userCode: string): Promise<DeviceCodeRecord | null>;
  pollDeviceCode(apiBaseUrl: string, deviceCode: string): Promise<{ record: DeviceCodeRecord | null; session: SessionRecord | null }>;
  getUserByToken(apiBaseUrl: string, accessToken: string): Promise<UserRecord | null>;
  deleteSession(apiBaseUrl: string, accessToken: string): Promise<void>;
  getProject(apiBaseUrl: string, projectKey: string): Promise<ProjectRecord | null>;
  provisionProjectRepo(apiBaseUrl: string, projectKey: string, userId: string): Promise<RepoRecord>;
  createOrReuseSubmission(
    apiBaseUrl: string,
    payload: { userId: string; projectKey: string; commitSha: string; repoUrl: string; branch: string }
  ): Promise<SubmissionRecord>;
  updateLocalTestResult(apiBaseUrl: string, submissionId: string, exitCode: number, summary: string): Promise<SubmissionRecord | null>;
  getSubmission(apiBaseUrl: string, submissionId: string): Promise<SubmissionRecord | null>;
  close?(): Promise<void>;
}

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

export function defaultManifest(apiBaseUrl: string): ProjectManifest {
  return {
    projectKey: "cs161/exam1",
    releaseVersion: "2026-03-01",
    apiBaseUrl,
    defaultBranch: "main",
    buildpack: { node: "20" },
    test: {
      mode: "public-grading",
      command: "npm test",
      supportsPrevious: true
    },
    submission: {
      allowedPaths: [
        ".nibras/**",
        "src/**",
        "test/**",
        "README.md",
        "CS161.md",
        "package.json"
      ],
      waitForVerificationSeconds: 30
    }
  };
}

function seedData(apiBaseUrl: string): StoreData {
  return {
    users: [
      {
        id: "user_demo",
        username: "demo",
        email: "demo@nibras.dev",
        githubLogin: "demo-user",
        githubLinked: true,
        githubAppInstalled: true
      }
    ],
    deviceCodes: [],
    sessions: [],
    submissions: [],
    projects: [
      {
        projectKey: "cs161/exam1",
        manifest: defaultManifest(apiBaseUrl),
        task: defaultTask(),
        repoByUserId: {}
      }
    ]
  };
}

export class FileStore implements AppStore {
  private readonly storePath: string;

  constructor(storePath: string) {
    this.storePath = storePath;
  }

  private ensureStore(apiBaseUrl: string): StoreData {
    try {
      const raw = fs.readFileSync(this.storePath, "utf8");
      return JSON.parse(raw) as StoreData;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
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

  async createDeviceCode(apiBaseUrl: string): Promise<DeviceCodeRecord> {
    const data = this.read(apiBaseUrl);
    const deviceCode = randomUUID();
    const userCode = `NB-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const record: DeviceCodeRecord = {
      deviceCode,
      userCode,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      intervalSeconds: 2,
      userId: null,
      status: "pending"
    };
    data.deviceCodes.push(record);
    this.write(data);
    return record;
  }

  async authorizeDeviceCode(apiBaseUrl: string, userCode: string): Promise<DeviceCodeRecord | null> {
    const data = this.read(apiBaseUrl);
    const record = data.deviceCodes.find((entry) => entry.userCode === userCode);
    if (!record) {
      return null;
    }
    record.status = "authorized";
    record.userId = "user_demo";
    this.write(data);
    return record;
  }

  async pollDeviceCode(apiBaseUrl: string, deviceCode: string): Promise<{ record: DeviceCodeRecord | null; session: SessionRecord | null }> {
    const data = this.read(apiBaseUrl);
    const record = data.deviceCodes.find((entry) => entry.deviceCode === deviceCode);
    if (!record) {
      return { record: null, session: null };
    }
    if (record.status !== "authorized" || !record.userId) {
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
      createdAt: new Date().toISOString()
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

  async deleteSession(apiBaseUrl: string, accessToken: string): Promise<void> {
    const data = this.read(apiBaseUrl);
    data.sessions = data.sessions.filter((entry) => entry.accessToken !== accessToken);
    this.write(data);
  }

  async getProject(apiBaseUrl: string, projectKey: string): Promise<ProjectRecord | null> {
    const data = this.read(apiBaseUrl);
    return data.projects.find((entry) => entry.projectKey === projectKey) || null;
  }

  async provisionProjectRepo(apiBaseUrl: string, projectKey: string, userId: string): Promise<RepoRecord> {
    const data = this.read(apiBaseUrl);
    const project = data.projects.find((entry) => entry.projectKey === projectKey);
    const user = data.users.find((entry) => entry.id === userId);
    if (!project || !user) {
      throw new Error("Project or user not found.");
    }
    const existing = project.repoByUserId[userId];
    if (existing) {
      return existing;
    }
    const repo: RepoRecord = {
      owner: user.githubLogin,
      name: `nibras-${projectKey.replace("/", "-")}`,
      cloneUrl: null,
      defaultBranch: project.manifest.defaultBranch,
      visibility: "private"
    };
    project.repoByUserId[userId] = repo;
    this.write(data);
    return repo;
  }

  async createOrReuseSubmission(
    apiBaseUrl: string,
    payload: { userId: string; projectKey: string; commitSha: string; repoUrl: string; branch: string }
  ): Promise<SubmissionRecord> {
    const data = this.read(apiBaseUrl);
    const existing = data.submissions.find((entry) =>
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
      projectKey: payload.projectKey,
      commitSha: payload.commitSha,
      repoUrl: payload.repoUrl,
      branch: payload.branch,
      status: "queued",
      summary: "Submission queued for verification.",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      localTestExitCode: null
    };
    data.submissions.push(record);
    this.write(data);
    return record;
  }

  async updateLocalTestResult(apiBaseUrl: string, submissionId: string, exitCode: number, summary: string): Promise<SubmissionRecord | null> {
    const data = this.read(apiBaseUrl);
    const submission = data.submissions.find((entry) => entry.id === submissionId);
    if (!submission) {
      return null;
    }
    submission.localTestExitCode = exitCode;
    submission.summary = summary;
    submission.updatedAt = new Date().toISOString();
    this.write(data);
    return submission;
  }

  async getSubmission(apiBaseUrl: string, submissionId: string): Promise<SubmissionRecord | null> {
    const data = this.read(apiBaseUrl);
    const submission = data.submissions.find((entry) => entry.id === submissionId);
    if (!submission) {
      return null;
    }
    const ageMs = Date.now() - new Date(submission.createdAt).getTime();
    if (submission.status === "queued" && ageMs > 1200) {
      submission.status = "running";
      submission.summary = "Verification is running.";
      submission.updatedAt = new Date().toISOString();
      this.write(data);
    }
    if (submission.status === "running" && ageMs > 2600) {
      submission.status = submission.localTestExitCode && submission.localTestExitCode !== 0 ? "failed" : "passed";
      submission.summary = submission.status === "passed"
        ? "Verification passed."
        : "Verification failed because the reported local tests failed.";
      submission.updatedAt = new Date().toISOString();
      this.write(data);
    }
    return submission;
  }
}

export function getStorePath(): string {
  return process.env.NIBRAS_API_STORE || path.join(process.cwd(), "tmp", "nibras-api-store.json");
}

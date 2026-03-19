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

export type SystemRole = "user" | "admin";
export type MembershipRole = "student" | "instructor" | "ta";
export type ProjectStatus = "draft" | "published" | "archived";
export type DeliveryMode = "individual" | "team";
export type SubmissionWorkflowStatus = "queued" | "running" | "passed" | "failed" | "needs_review";
export type SubmissionType = "github" | "link" | "text";
export type ReviewStatus = "pending" | "approved" | "changes_requested" | "graded";

export type UserRecord = {
  id: string;
  username: string;
  email: string;
  githubLogin: string;
  githubLinked: boolean;
  githubAppInstalled: boolean;
  systemRole: SystemRole;
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
  createdAt: string;
  updatedAt: string;
};

export type TrackingResourceRecord = {
  label: string;
  url: string;
};

export type TrackingRubricItemRecord = {
  criterion: string;
  maxScore: number;
};

export type RepoRecord = {
  owner: string;
  name: string;
  cloneUrl: string | null;
  defaultBranch: string;
  visibility: "private" | "public";
};

export type ProjectRecord = {
  id: string;
  projectKey: string;
  slug: string;
  courseId: string | null;
  title: string;
  description: string;
  status: ProjectStatus;
  deliveryMode: DeliveryMode;
  rubric: TrackingRubricItemRecord[];
  resources: TrackingResourceRecord[];
  instructorUserId: string | null;
  manifest: ProjectManifest;
  task: string;
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
  projectId: string;
  projectKey: string;
  milestoneId: string | null;
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
  daysRemaining: number;
};

export type StudentDashboardRecord = {
  course: CourseRecord | null;
  memberships: CourseMembershipRecord[];
  projects: ProjectRecord[];
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

export type StoreData = {
  users: UserRecord[];
  courses: CourseRecord[];
  courseMemberships: CourseMembershipRecord[];
  deviceCodes: DeviceCodeRecord[];
  sessions: SessionRecord[];
  submissions: SubmissionRecord[];
  projects: ProjectRecord[];
  milestones: MilestoneRecord[];
  reviews: ReviewRecord[];
  githubDeliveries: GithubDeliveryRecord[];
  activity: ActivityRecord[];
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
  listCourseMemberships(apiBaseUrl: string, userId: string): Promise<CourseMembershipRecord[]>;
  listTrackingCourses(apiBaseUrl: string, userId: string): Promise<CourseRecord[]>;
  listTrackingProjects(apiBaseUrl: string, courseId: string): Promise<ProjectRecord[]>;
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
      rubric: TrackingRubricItemRecord[];
      resources: TrackingResourceRecord[];
    }>
  ): Promise<ProjectRecord | null>;
  setTrackingProjectStatus(apiBaseUrl: string, userId: string, projectId: string, status: ProjectStatus): Promise<ProjectRecord | null>;
  listTrackingMilestones(apiBaseUrl: string, projectId: string): Promise<MilestoneRecord[]>;
  getTrackingMilestone(apiBaseUrl: string, milestoneId: string): Promise<MilestoneRecord | null>;
  createTrackingMilestone(
    apiBaseUrl: string,
    userId: string,
    projectId: string,
    payload: { title: string; description: string; order: number; dueAt: string | null; isFinal: boolean }
  ): Promise<MilestoneRecord>;
  updateTrackingMilestone(
    apiBaseUrl: string,
    userId: string,
    milestoneId: string,
    payload: Partial<{ title: string; description: string; order: number; dueAt: string | null; isFinal: boolean }>
  ): Promise<MilestoneRecord | null>;
  deleteTrackingMilestone(apiBaseUrl: string, userId: string, milestoneId: string): Promise<boolean>;
  listTrackingMilestoneSubmissions(apiBaseUrl: string, milestoneId: string): Promise<SubmissionRecord[]>;
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
    payload: { status: ReviewStatus; score: number | null; feedback: string; rubric: TrackingRubricItemRecord[] }
  ): Promise<ReviewRecord>;
  getTrackingReview(apiBaseUrl: string, submissionId: string): Promise<ReviewRecord | null>;
  listTrackingReviewQueue(
    apiBaseUrl: string,
    filters?: { courseId?: string; projectId?: string; status?: SubmissionWorkflowStatus }
  ): Promise<SubmissionRecord[]>;
  listTrackingActivity(apiBaseUrl: string, userId: string): Promise<ActivityRecord[]>;
  getStudentTrackingDashboard(apiBaseUrl: string, userId: string, courseId?: string | null): Promise<StudentDashboardRecord>;
  getInstructorTrackingDashboard(apiBaseUrl: string, userId: string): Promise<InstructorDashboardRecord>;
  getCourseTrackingDashboard(apiBaseUrl: string, userId: string, courseId: string): Promise<InstructorDashboardRecord>;
  getTrackingSubmissionCommits(apiBaseUrl: string, submissionId: string): Promise<GithubDeliveryRecord[]>;
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

function nowIso(): string {
  return new Date().toISOString();
}

function formatDateLabel(value: string | null): string {
  if (!value) return "No due date";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function statusLabel(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function branchNameFromRef(ref: string): string {
  return ref.startsWith("refs/heads/") ? ref.slice("refs/heads/".length) : ref;
}

function calculateProjectStats(milestones: MilestoneRecord[], submissions: SubmissionRecord[], reviews: ReviewRecord[]): TrackingDashboardStats {
  const statuses = milestones.map((milestone) => milestoneProgress(milestone.id, submissions, reviews));
  const approved = statuses.filter((value) => value === "approved" || value === "graded").length;
  const underReview = statuses.filter((value) => value === "submitted").length;
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

function milestoneProgress(milestoneId: string, submissions: SubmissionRecord[], reviews: ReviewRecord[]): string {
  const milestoneSubmissions = submissions
    .filter((entry) => entry.milestoneId === milestoneId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  if (milestoneSubmissions.length === 0) {
    return "open";
  }
  const latestSubmission = milestoneSubmissions[0];
  const latestReview = reviews
    .filter((entry) => entry.submissionId === latestSubmission.id)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
  if (latestReview) {
    if (latestReview.status === "graded") return "graded";
    if (latestReview.status === "approved") return "approved";
  }
  return "submitted";
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
    createdAt: nowIso()
  };
}

function seedData(apiBaseUrl: string): StoreData {
  const createdAt = nowIso();
  const courseId = "course_cs161";
  const projectId = "project_cs161_exam1";
  const instructorId = "user_instructor";
  const studentId = "user_demo";
  const milestone1Id = "milestone_exam1_design";
  const milestone2Id = "milestone_exam1_final";

  return {
    users: [
      {
        id: studentId,
        username: "demo",
        email: "demo@nibras.dev",
        githubLogin: "demo-user",
        githubLinked: true,
        githubAppInstalled: true,
        systemRole: "user"
      },
      {
        id: instructorId,
        username: "instructor",
        email: "instructor@nibras.dev",
        githubLogin: "nibras-instructor",
        githubLinked: true,
        githubAppInstalled: true,
        systemRole: "admin"
      }
    ],
    courses: [
      {
        id: courseId,
        slug: "cs161",
        title: "CS 161: Foundations of Systems",
        termLabel: "Spring 2026",
        courseCode: "CS161",
        isActive: true,
        createdAt,
        updatedAt: createdAt
      }
    ],
    courseMemberships: [
      {
        id: "membership_demo_cs161",
        courseId,
        userId: studentId,
        role: "student",
        createdAt,
        updatedAt: createdAt
      },
      {
        id: "membership_instructor_cs161",
        courseId,
        userId: instructorId,
        role: "instructor",
        createdAt,
        updatedAt: createdAt
      }
    ],
    deviceCodes: [],
    sessions: [],
    submissions: [],
    projects: [
      {
        id: projectId,
        projectKey: "cs161/exam1",
        slug: "cs161/exam1",
        courseId,
        title: "Exam 1",
        description: "Design, implement, and defend your solution for the first project milestone sequence.",
        status: "published",
        deliveryMode: "individual",
        rubric: [
          { criterion: "Correctness", maxScore: 50 },
          { criterion: "Clarity", maxScore: 30 },
          { criterion: "Testing", maxScore: 20 }
        ],
        resources: [
          { label: "Task brief", url: "https://example.com/task-brief" },
          { label: "Reference notes", url: "https://example.com/reference-notes" }
        ],
        instructorUserId: instructorId,
        manifest: defaultManifest(apiBaseUrl),
        task: defaultTask(),
        repoByUserId: {},
        createdAt,
        updatedAt: createdAt
      }
    ],
    milestones: [
      {
        id: milestone1Id,
        projectId,
        title: "Design Review",
        description: "Submit an initial design, edge cases, and implementation plan.",
        order: 1,
        dueAt: "2026-03-27T17:00:00.000Z",
        isFinal: false,
        createdAt,
        updatedAt: createdAt
      },
      {
        id: milestone2Id,
        projectId,
        title: "Final Project Submission",
        description: "Submit the final repository state and project write-up.",
        order: 2,
        dueAt: "2026-04-08T17:00:00.000Z",
        isFinal: true,
        createdAt,
        updatedAt: createdAt
      }
    ],
    reviews: [],
    githubDeliveries: [],
    activity: [
      makeActivityRecord({
        actorUserId: instructorId,
        courseId,
        projectId,
        milestoneId: null,
        submissionId: null,
        action: "project.published",
        summary: "Exam 1 is now published."
      })
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

  private touchSubmissionLifecycle(data: StoreData, submission: SubmissionRecord): SubmissionRecord {
    const ageMs = Date.now() - new Date(submission.createdAt).getTime();
    if (submission.milestoneId) {
      return submission;
    }
    if (submission.status === "queued" && ageMs > 1200) {
      submission.status = "running";
      submission.summary = "Verification is running.";
      submission.updatedAt = nowIso();
      this.write(data);
    }
    if (submission.status === "running" && ageMs > 2600) {
      submission.status = submission.localTestExitCode && submission.localTestExitCode !== 0 ? "failed" : "passed";
      submission.summary = submission.status === "passed"
        ? "Verification passed."
        : "Verification failed because the reported local tests failed.";
      submission.updatedAt = nowIso();
      this.write(data);
    }
    return submission;
  }

  async createDeviceCode(apiBaseUrl: string): Promise<DeviceCodeRecord> {
    const data = this.read(apiBaseUrl);
    const record: DeviceCodeRecord = {
      deviceCode: randomUUID(),
      userCode: `NB-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
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
      createdAt: nowIso()
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
    const project = data.projects.find((entry) => entry.projectKey === payload.projectKey);
    if (!project) {
      throw new Error("Project not found.");
    }
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
      projectId: project.id,
      projectKey: payload.projectKey,
      milestoneId: null,
      commitSha: payload.commitSha,
      repoUrl: payload.repoUrl,
      branch: payload.branch,
      status: "queued",
      summary: "Submission queued for verification.",
      submissionType: "github",
      submissionValue: payload.repoUrl,
      notes: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      submittedAt: nowIso(),
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
    submission.updatedAt = nowIso();
    this.write(data);
    return submission;
  }

  async getSubmission(apiBaseUrl: string, submissionId: string): Promise<SubmissionRecord | null> {
    const data = this.read(apiBaseUrl);
    const submission = data.submissions.find((entry) => entry.id === submissionId);
    if (!submission) {
      return null;
    }
    return this.touchSubmissionLifecycle(data, submission);
  }

  async listCourseMemberships(apiBaseUrl: string, userId: string): Promise<CourseMembershipRecord[]> {
    const data = this.read(apiBaseUrl);
    return data.courseMemberships.filter((entry) => entry.userId === userId);
  }

  async listTrackingCourses(apiBaseUrl: string, userId: string): Promise<CourseRecord[]> {
    const data = this.read(apiBaseUrl);
    const user = data.users.find((entry) => entry.id === userId);
    if (user?.systemRole === "admin") {
      return data.courses.filter((entry) => entry.isActive);
    }
    const allowedCourseIds = new Set(
      data.courseMemberships
        .filter((entry) => entry.userId === userId)
        .map((entry) => entry.courseId)
    );
    return data.courses.filter((entry) => entry.isActive && allowedCourseIds.has(entry.id));
  }

  async listTrackingProjects(apiBaseUrl: string, courseId: string): Promise<ProjectRecord[]> {
    const data = this.read(apiBaseUrl);
    return data.projects.filter((entry) => entry.courseId === courseId).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async getTrackingProjectById(apiBaseUrl: string, projectId: string): Promise<ProjectRecord | null> {
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
      rubric: TrackingRubricItemRecord[];
      resources: TrackingResourceRecord[];
    }
  ): Promise<ProjectRecord> {
    const data = this.read(apiBaseUrl);
    const record: ProjectRecord = {
      id: randomUUID(),
      projectKey: payload.slug,
      slug: payload.slug,
      courseId: payload.courseId,
      title: payload.title,
      description: payload.description,
      status: payload.status,
      deliveryMode: payload.deliveryMode,
      rubric: payload.rubric,
      resources: payload.resources,
      instructorUserId: userId,
      manifest: {
        ...defaultManifest(apiBaseUrl),
        projectKey: payload.slug
      },
      task: `# ${payload.title}\n\n${payload.description}\n`,
      repoByUserId: {},
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    data.projects.push(record);
    data.activity.unshift(makeActivityRecord({
      actorUserId: userId,
      courseId: payload.courseId,
      projectId: record.id,
      milestoneId: null,
      submissionId: null,
      action: "project.created",
      summary: `${payload.title} was created.`
    }));
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
    if (payload.rubric !== undefined) project.rubric = payload.rubric;
    if (payload.resources !== undefined) project.resources = payload.resources;
    project.updatedAt = nowIso();
    data.activity.unshift(makeActivityRecord({
      actorUserId: userId,
      courseId: project.courseId,
      projectId: project.id,
      milestoneId: null,
      submissionId: null,
      action: "project.updated",
      summary: `${project.title} was updated.`
    }));
    this.write(data);
    return project;
  }

  async setTrackingProjectStatus(apiBaseUrl: string, userId: string, projectId: string, status: ProjectStatus): Promise<ProjectRecord | null> {
    const project = await this.updateTrackingProject(apiBaseUrl, userId, projectId, { status });
    if (!project) {
      return null;
    }
    const data = this.read(apiBaseUrl);
    data.activity.unshift(makeActivityRecord({
      actorUserId: userId,
      courseId: project.courseId,
      projectId: project.id,
      milestoneId: null,
      submissionId: null,
      action: status === "published" ? "project.published" : "project.unpublished",
      summary: `${project.title} is now ${status}.`
    }));
    this.write(data);
    return project;
  }

  async listTrackingMilestones(apiBaseUrl: string, projectId: string): Promise<MilestoneRecord[]> {
    const data = this.read(apiBaseUrl);
    return data.milestones
      .filter((entry) => entry.projectId === projectId)
      .sort((left, right) => left.order - right.order);
  }

  async getTrackingMilestone(apiBaseUrl: string, milestoneId: string): Promise<MilestoneRecord | null> {
    const data = this.read(apiBaseUrl);
    return data.milestones.find((entry) => entry.id === milestoneId) || null;
  }

  async createTrackingMilestone(
    apiBaseUrl: string,
    userId: string,
    projectId: string,
    payload: { title: string; description: string; order: number; dueAt: string | null; isFinal: boolean }
  ): Promise<MilestoneRecord> {
    const data = this.read(apiBaseUrl);
    const project = data.projects.find((entry) => entry.id === projectId);
    if (!project) {
      throw new Error("Project not found.");
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
      updatedAt: nowIso()
    };
    data.milestones.push(milestone);
    data.activity.unshift(makeActivityRecord({
      actorUserId: userId,
      courseId: project.courseId,
      projectId,
      milestoneId: milestone.id,
      submissionId: null,
      action: "milestone.created",
      summary: `${milestone.title} was added to ${project.title}.`
    }));
    this.write(data);
    return milestone;
  }

  async updateTrackingMilestone(
    apiBaseUrl: string,
    userId: string,
    milestoneId: string,
    payload: Partial<{ title: string; description: string; order: number; dueAt: string | null; isFinal: boolean }>
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
    data.activity.unshift(makeActivityRecord({
      actorUserId: userId,
      courseId: project?.courseId || null,
      projectId: milestone.projectId,
      milestoneId,
      submissionId: null,
      action: "milestone.updated",
      summary: `${milestone.title} was updated.`
    }));
    this.write(data);
    return milestone;
  }

  async deleteTrackingMilestone(apiBaseUrl: string, userId: string, milestoneId: string): Promise<boolean> {
    const data = this.read(apiBaseUrl);
    const milestone = data.milestones.find((entry) => entry.id === milestoneId);
    if (!milestone) {
      return false;
    }
    data.milestones = data.milestones.filter((entry) => entry.id !== milestoneId);
    data.submissions = data.submissions.filter((entry) => entry.milestoneId !== milestoneId);
    data.activity.unshift(makeActivityRecord({
      actorUserId: userId,
      courseId: data.projects.find((entry) => entry.id === milestone.projectId)?.courseId || null,
      projectId: milestone.projectId,
      milestoneId,
      submissionId: null,
      action: "milestone.deleted",
      summary: `${milestone.title} was deleted.`
    }));
    this.write(data);
    return true;
  }

  async listTrackingMilestoneSubmissions(apiBaseUrl: string, milestoneId: string): Promise<SubmissionRecord[]> {
    const data = this.read(apiBaseUrl);
    return data.submissions
      .filter((entry) => entry.milestoneId === milestoneId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
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
      throw new Error("Milestone not found.");
    }
    const project = data.projects.find((entry) => entry.id === milestone.projectId);
    if (!project) {
      throw new Error("Project not found.");
    }
    const record: SubmissionRecord = {
      id: randomUUID(),
      userId,
      projectId: project.id,
      projectKey: project.projectKey,
      milestoneId,
      commitSha: payload.commitSha || (payload.submissionType === "github"
        ? `github-pending-${randomUUID().slice(0, 8)}`
        : `manual-${randomUUID().slice(0, 8)}`),
      repoUrl: payload.repoUrl || payload.submissionValue,
      branch: payload.branch || "main",
      status: payload.submissionType === "github" ? "running" : "needs_review",
      summary: payload.submissionType === "github"
        ? "GitHub submission received. Waiting for webhook activity."
        : "Submission received and queued for instructor review.",
      submissionType: payload.submissionType,
      submissionValue: payload.submissionValue,
      notes: payload.notes || null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      submittedAt: nowIso(),
      localTestExitCode: null
    };
    data.submissions.push(record);
    data.activity.unshift(makeActivityRecord({
      actorUserId: userId,
      courseId: project.courseId,
      projectId: project.id,
      milestoneId,
      submissionId: record.id,
      action: "submission.created",
      summary: `A ${payload.submissionType} submission was added for ${milestone.title}.`
    }));
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
    if (payload.submissionType !== undefined) submission.submissionType = payload.submissionType;
    if (payload.submissionValue !== undefined) submission.submissionValue = payload.submissionValue;
    if (payload.notes !== undefined) submission.notes = payload.notes;
    if (payload.repoUrl !== undefined) submission.repoUrl = payload.repoUrl;
    if (payload.branch !== undefined) submission.branch = payload.branch;
    if (payload.commitSha !== undefined) submission.commitSha = payload.commitSha;
    submission.updatedAt = nowIso();
    data.activity.unshift(makeActivityRecord({
      actorUserId: userId,
      courseId: data.projects.find((entry) => entry.id === submission.projectId)?.courseId || null,
      projectId: submission.projectId,
      milestoneId: submission.milestoneId,
      submissionId,
      action: "submission.updated",
      summary: "Submission details were updated."
    }));
    this.write(data);
    return submission;
  }

  async createTrackingReview(
    apiBaseUrl: string,
    userId: string,
    submissionId: string,
    payload: { status: ReviewStatus; score: number | null; feedback: string; rubric: TrackingRubricItemRecord[] }
  ): Promise<ReviewRecord> {
    const data = this.read(apiBaseUrl);
    const submission = data.submissions.find((entry) => entry.id === submissionId);
    if (!submission) {
      throw new Error("Submission not found.");
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
      updatedAt: nowIso()
    };
    submission.status = payload.status === "changes_requested"
      ? "failed"
      : payload.status === "graded" || payload.status === "approved"
        ? "passed"
        : "needs_review";
    submission.summary = payload.feedback || statusLabel(payload.status);
    submission.updatedAt = nowIso();
    data.reviews.push(review);
    data.activity.unshift(makeActivityRecord({
      actorUserId: userId,
      courseId: data.projects.find((entry) => entry.id === submission.projectId)?.courseId || null,
      projectId: submission.projectId,
      milestoneId: submission.milestoneId,
      submissionId,
      action: "review.created",
      summary: `Review completed with status ${statusLabel(payload.status)}.`
    }));
    this.write(data);
    return review;
  }

  async getTrackingReview(apiBaseUrl: string, submissionId: string): Promise<ReviewRecord | null> {
    const data = this.read(apiBaseUrl);
    return data.reviews
      .filter((entry) => entry.submissionId === submissionId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] || null;
  }

  async listTrackingReviewQueue(
    apiBaseUrl: string,
    filters?: { courseId?: string; projectId?: string; status?: SubmissionWorkflowStatus }
  ): Promise<SubmissionRecord[]> {
    const data = this.read(apiBaseUrl);
    return data.submissions.filter((entry) => {
      if (filters?.projectId && entry.projectId !== filters.projectId) return false;
      if (filters?.courseId) {
        const project = data.projects.find((projectItem) => projectItem.id === entry.projectId);
        if (!project || project.courseId !== filters.courseId) return false;
      }
      if (filters?.status && entry.status !== filters.status) return false;
      return entry.milestoneId !== null;
    });
  }

  async listTrackingActivity(apiBaseUrl: string, userId: string): Promise<ActivityRecord[]> {
    const courses = await this.listTrackingCourses(apiBaseUrl, userId);
    const allowedCourseIds = new Set(courses.map((entry) => entry.id));
    return this.read(apiBaseUrl).activity.filter((entry) => !entry.courseId || allowedCourseIds.has(entry.courseId)).slice(0, 20);
  }

  async getStudentTrackingDashboard(apiBaseUrl: string, userId: string, courseId?: string | null): Promise<StudentDashboardRecord> {
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
        pageError: "No active course found for this account."
      };
    }
    const data = this.read(apiBaseUrl);
    const projects = data.projects.filter((entry) => entry.courseId === selectedCourse.id && entry.status === "published");
    const milestonesByProject: Record<string, MilestoneRecord[]> = {};
    const statsByProject: Record<string, TrackingDashboardStats> = {};
    for (const project of projects) {
      const milestones = data.milestones.filter((entry) => entry.projectId === project.id).sort((left, right) => left.order - right.order);
      milestonesByProject[project.id] = milestones;
      const submissions = data.submissions.filter((entry) => entry.projectId === project.id && entry.userId === userId);
      statsByProject[project.id] = calculateProjectStats(milestones, submissions, data.reviews);
    }
    return {
      course: selectedCourse,
      memberships,
      projects,
      milestonesByProject,
      activeProjectId: projects[0]?.id || null,
      activity: data.activity.filter((entry) => entry.courseId === selectedCourse.id).slice(0, 10),
      statsByProject,
      pageError: projects.length === 0 ? "No published projects found for this course yet." : null
    };
  }

  async getInstructorTrackingDashboard(apiBaseUrl: string, userId: string): Promise<InstructorDashboardRecord> {
    const courses = (await this.listTrackingCourses(apiBaseUrl, userId)).filter((course) => {
      const membership = this.read(apiBaseUrl).courseMemberships.find((entry) => entry.courseId === course.id && entry.userId === userId);
      const user = this.read(apiBaseUrl).users.find((entry) => entry.id === userId);
      return user?.systemRole === "admin" || membership?.role === "instructor" || membership?.role === "ta";
    });
    const reviewQueue = await this.listTrackingReviewQueue(apiBaseUrl);
    const activity = await this.listTrackingActivity(apiBaseUrl, userId);
    return { courses, reviewQueue, activity };
  }

  async getCourseTrackingDashboard(apiBaseUrl: string, userId: string, courseId: string): Promise<InstructorDashboardRecord> {
    const courses = await this.listTrackingCourses(apiBaseUrl, userId);
    const activity = (await this.listTrackingActivity(apiBaseUrl, userId)).filter((entry) => entry.courseId === courseId);
    const reviewQueue = await this.listTrackingReviewQueue(apiBaseUrl, { courseId });
    return {
      courses: courses.filter((entry) => entry.id === courseId),
      reviewQueue,
      activity
    };
  }

  async getTrackingSubmissionCommits(apiBaseUrl: string, submissionId: string): Promise<GithubDeliveryRecord[]> {
    return this.read(apiBaseUrl).githubDeliveries
      .filter((entry) => entry.submissionId === submissionId)
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
    const data = this.read("http://127.0.0.1");
    const repoUrl = payload.repositoryUrl || `https://github.com/${payload.owner}/${payload.repoName}`;
    const branch = branchNameFromRef(payload.ref);
    const project = data.projects.find((entry) =>
      Object.values(entry.repoByUserId).some((repo) => repo.owner === payload.owner && repo.name === payload.repoName)
    );
    if (!project) {
      return;
    }
    const matchingSubmissions = data.submissions.filter((entry) =>
      entry.projectId === project.id &&
      (entry.repoUrl.includes(`/${payload.owner}/${payload.repoName}`) || entry.submissionValue?.includes(`/${payload.owner}/${payload.repoName}`)) &&
      entry.submissionType === "github" &&
      entry.branch === branch
    ).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    const submission = matchingSubmissions.find((entry) => entry.commitSha === payload.after)
      || matchingSubmissions.find((entry) => entry.commitSha.startsWith("github-pending-"));
    if (!submission) {
      return;
    }
    submission.status = "running";
    submission.summary = `GitHub push received for ${payload.ref}. Verification is running.`;
    submission.commitSha = payload.after || submission.commitSha;
    submission.updatedAt = nowIso();
    data.githubDeliveries.unshift({
      id: randomUUID(),
      submissionId: submission.id,
      repoUrl,
      eventType: payload.eventType || "push",
      deliveryId: payload.deliveryId || randomUUID(),
      ref: payload.ref,
      commitSha: payload.after,
      payload: payload.rawPayload || {},
      receivedAt: nowIso()
    });
    data.activity.unshift(makeActivityRecord({
      actorUserId: null,
      courseId: project.courseId,
      projectId: project.id,
      milestoneId: submission.milestoneId,
      submissionId: submission.id,
      action: "github.delivery",
      summary: `GitHub ${payload.eventType || "push"} received for ${project.title}.`
    }));
    this.write(data);
  }
}

export function getStorePath(): string {
  return process.env.NIBRAS_API_STORE || path.join(process.cwd(), "tmp", "nibras-api-store.json");
}

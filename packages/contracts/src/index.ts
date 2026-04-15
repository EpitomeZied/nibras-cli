import { z } from 'zod';
export * from './tracking';

export const BuildpackSchema = z.object({
  node: z.string().min(1),
});

const GradingRubricItemSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  points: z.number().nonnegative(),
});

const GradingExampleSchema = z.object({
  label: z.string().min(1),
  answer: z.string().min(1),
});

const GradingQuestionSchema = z.object({
  id: z.string().min(1),
  mode: z.enum(['exact', 'semantic', 'exam']),
  prompt: z.string().optional(),
  points: z.number().nonnegative(),
  answerFile: z.string().min(1),
  rubric: z.array(GradingRubricItemSchema).optional(),
  examples: z.array(GradingExampleSchema).optional(),
  solutions: z.array(z.string().min(1)).optional(),
  minConfidence: z.number().min(0).max(1).optional(),
  // Exam-mode fields
  type: z.enum(['mcq', 'short_answer', 'long_answer', 'true_false']).optional(),
  modelAnswer: z.string().optional(),
  gradingCriteria: z.string().optional(),
});

const ProjectTestCommandsSchema = z
  .object({
    default: z.string().min(1).optional(),
    windows: z.string().min(1).optional(),
    macos: z.string().min(1).optional(),
    linux: z.string().min(1).optional(),
    unix: z.string().min(1).optional(),
  })
  .optional();

export const ProjectManifestSchema = z.object({
  projectKey: z.string().min(1),
  releaseVersion: z.string().min(1),
  apiBaseUrl: z.string().url(),
  defaultBranch: z.string().min(1),
  buildpack: BuildpackSchema,
  test: z.object({
    mode: z.enum(['public-grading', 'command']),
    command: z.string().min(1),
    commands: ProjectTestCommandsSchema,
    supportsPrevious: z.boolean().default(false),
  }),
  submission: z.object({
    allowedPaths: z.array(z.string().min(1)).min(1),
    waitForVerificationSeconds: z.number().int().positive().default(120),
  }),
  grading: z
    .object({
      questions: z.array(GradingQuestionSchema),
      totalPoints: z.number().nonnegative().optional(),
    })
    .optional(),
});

export const CliConfigSchema = z.object({
  apiBaseUrl: z.string().url(),
  activeUserId: z.string().optional(),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  tokenCreatedAt: z.string().datetime().optional(),
  defaultOrg: z.string().optional(),
  telemetryOptIn: z.boolean().optional(),
});

export const DeviceStartResponseSchema = z.object({
  deviceCode: z.string().min(1),
  userCode: z.string().min(1),
  verificationUri: z.string().url(),
  verificationUriComplete: z.string().url(),
  intervalSeconds: z.number().int().positive(),
  expiresInSeconds: z.number().int().positive(),
});

export const DevicePollPendingSchema = z.object({
  status: z.literal('pending'),
});

export const UserSchema = z.object({
  id: z.string().min(1),
  username: z.string().min(1),
  email: z.string().email(),
  githubLogin: z.string().min(1),
  githubLinked: z.boolean(),
  githubAppInstalled: z.boolean(),
  systemRole: z.enum(['user', 'admin']).optional(),
  yearLevel: z.number().int().min(1).max(4).default(1),
});

export const DevicePollSuccessSchema = z.object({
  status: z.literal('authorized'),
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  user: UserSchema,
});

export const DevicePollResponseSchema = z.union([DevicePollPendingSchema, DevicePollSuccessSchema]);

export const SessionMembershipSchema = z.object({
  courseId: z.string().min(1),
  role: z.enum(['student', 'instructor', 'ta']),
  level: z.number().int().min(1).max(4).default(1),
});
export type SessionMembership = z.infer<typeof SessionMembershipSchema>;

export const MeResponseSchema = z.object({
  user: UserSchema,
  apiBaseUrl: z.string().url(),
  memberships: z.array(SessionMembershipSchema).default([]),
});

export const ProjectTaskResponseSchema = z.object({
  projectKey: z.string().min(1),
  task: z.string().min(1),
});

export const ProjectStarterSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('none'),
  }),
  z.object({
    kind: z.literal('bundle'),
    downloadUrl: z.string().url(),
    archiveFormat: z.literal('zip'),
    fileName: z.string().min(1),
  }),
  z.object({
    kind: z.literal('github-template'),
    cloneUrl: z.string().min(1),
  }),
]);

export const ProjectSetupResponseSchema = z.object({
  projectKey: z.string().min(1),
  repo: z.object({
    owner: z.string().min(1),
    name: z.string().min(1),
    cloneUrl: z.string().nullable(),
    defaultBranch: z.string().min(1),
    visibility: z.enum(['private', 'public']),
  }),
  templateCloneUrl: z.string().nullable().optional(),
  starter: ProjectStarterSchema.optional(),
  manifest: ProjectManifestSchema,
  task: z.string().min(1),
});

export const SubmissionPrepareRequestSchema = z.object({
  projectKey: z.string().min(1),
  commitSha: z.string().min(1),
  repoUrl: z.string().min(1),
  branch: z.string().min(1),
});

export const SubmissionPrepareResponseSchema = z.object({
  submissionId: z.string().min(1),
  status: z.enum(['queued', 'running', 'passed', 'failed', 'needs_review']),
});

export const LocalTestResultRequestSchema = z.object({
  exitCode: z.number().int(),
  summary: z.string().min(1),
  ranPrevious: z.boolean().default(false),
});

export const SubmissionStatusResponseSchema = z.object({
  submissionId: z.string().min(1),
  projectKey: z.string().min(1),
  status: z.enum(['queued', 'running', 'passed', 'failed', 'needs_review']),
  commitSha: z.string().min(1),
  summary: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const PingResponseSchema = z.object({
  ok: z.boolean(),
  api: z.enum(['reachable', 'unreachable']),
  auth: z.enum(['valid', 'missing', 'invalid']),
  github: z.enum(['linked', 'missing']),
  githubApp: z.enum(['installed', 'missing']),
});

export const TokenRefreshRequestSchema = z.object({
  refreshToken: z.string().min(1),
});

export const TokenRefreshResponseSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
});

export const GitHubInstallUrlResponseSchema = z.object({
  installUrl: z.string().url(),
});

export const GitHubConfigResponseSchema = z.object({
  configured: z.boolean(),
  appName: z.string().optional(),
  webBaseUrl: z.string().optional(),
});

export const GitHubInstallationCompleteRequestSchema = z.object({
  installationId: z.string().min(1),
  state: z.string().min(1).optional(),
});

export const GitHubInstallationCompleteResponseSchema = z.object({
  githubAppInstalled: z.boolean(),
  installationId: z.string().min(1),
  redirectTo: z.string().url().optional(),
});

export const GitHubRepositoryValidateRequestSchema = z.object({
  repoUrl: z.string().min(1),
});

export const GitHubRepositoryValidateResponseSchema = z.object({
  repoUrl: z.string().url(),
  owner: z.string().min(1),
  name: z.string().min(1),
  fullName: z.string().min(1),
  defaultBranch: z.string().min(1),
  visibility: z.enum(['public', 'private']),
  permission: z.enum(['admin', 'write']),
});

export type ProjectManifest = z.infer<typeof ProjectManifestSchema>;
export type CliConfig = z.infer<typeof CliConfigSchema>;
export type DeviceStartResponse = z.infer<typeof DeviceStartResponseSchema>;
export type DevicePollResponse = z.infer<typeof DevicePollResponseSchema>;
export type MeResponse = z.infer<typeof MeResponseSchema>;
export type ProjectTaskResponse = z.infer<typeof ProjectTaskResponseSchema>;
export type ProjectStarter = z.infer<typeof ProjectStarterSchema>;
export type ProjectSetupResponse = z.infer<typeof ProjectSetupResponseSchema>;
export type SubmissionPrepareRequest = z.infer<typeof SubmissionPrepareRequestSchema>;
export type SubmissionPrepareResponse = z.infer<typeof SubmissionPrepareResponseSchema>;
export type LocalTestResultRequest = z.infer<typeof LocalTestResultRequestSchema>;
export type SubmissionStatusResponse = z.infer<typeof SubmissionStatusResponseSchema>;
export type PingResponse = z.infer<typeof PingResponseSchema>;
export type GitHubInstallUrlResponse = z.infer<typeof GitHubInstallUrlResponseSchema>;
export type GitHubConfigResponse = z.infer<typeof GitHubConfigResponseSchema>;
export type GitHubInstallationCompleteRequest = z.infer<
  typeof GitHubInstallationCompleteRequestSchema
>;
export type GitHubInstallationCompleteResponse = z.infer<
  typeof GitHubInstallationCompleteResponseSchema
>;
export type GitHubRepositoryValidateRequest = z.infer<typeof GitHubRepositoryValidateRequestSchema>;
export type GitHubRepositoryValidateResponse = z.infer<
  typeof GitHubRepositoryValidateResponseSchema
>;

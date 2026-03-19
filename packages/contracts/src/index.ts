import { z } from "zod";
export * from "./tracking";

export const BuildpackSchema = z.object({
  node: z.string().min(1)
});

export const ProjectManifestSchema = z.object({
  projectKey: z.string().min(1),
  releaseVersion: z.string().min(1),
  apiBaseUrl: z.string().url(),
  defaultBranch: z.string().min(1),
  buildpack: BuildpackSchema,
  test: z.object({
    mode: z.enum(["public-grading", "command"]),
    command: z.string().min(1),
    supportsPrevious: z.boolean().default(false)
  }),
  submission: z.object({
    allowedPaths: z.array(z.string().min(1)).min(1),
    waitForVerificationSeconds: z.number().int().positive().default(120)
  })
});

export const CliConfigSchema = z.object({
  apiBaseUrl: z.string().url(),
  activeUserId: z.string().optional(),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  defaultOrg: z.string().optional(),
  telemetryOptIn: z.boolean().optional()
});

export const DeviceStartResponseSchema = z.object({
  deviceCode: z.string().min(1),
  userCode: z.string().min(1),
  verificationUri: z.string().url(),
  verificationUriComplete: z.string().url(),
  intervalSeconds: z.number().int().positive(),
  expiresInSeconds: z.number().int().positive()
});

export const DevicePollPendingSchema = z.object({
  status: z.literal("pending")
});

export const UserSchema = z.object({
  id: z.string().min(1),
  username: z.string().min(1),
  email: z.string().email(),
  githubLogin: z.string().min(1),
  githubLinked: z.boolean(),
  githubAppInstalled: z.boolean()
});

export const DevicePollSuccessSchema = z.object({
  status: z.literal("authorized"),
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  user: UserSchema
});

export const DevicePollResponseSchema = z.union([
  DevicePollPendingSchema,
  DevicePollSuccessSchema
]);

export const MeResponseSchema = z.object({
  user: UserSchema,
  apiBaseUrl: z.string().url()
});

export const ProjectTaskResponseSchema = z.object({
  projectKey: z.string().min(1),
  task: z.string().min(1)
});

export const ProjectSetupResponseSchema = z.object({
  projectKey: z.string().min(1),
  repo: z.object({
    owner: z.string().min(1),
    name: z.string().min(1),
    cloneUrl: z.string().nullable(),
    defaultBranch: z.string().min(1),
    visibility: z.enum(["private", "public"])
  }),
  manifest: ProjectManifestSchema,
  task: z.string().min(1)
});

export const SubmissionPrepareRequestSchema = z.object({
  projectKey: z.string().min(1),
  commitSha: z.string().min(1),
  repoUrl: z.string().min(1),
  branch: z.string().min(1)
});

export const SubmissionPrepareResponseSchema = z.object({
  submissionId: z.string().min(1),
  status: z.enum(["queued", "running", "passed", "failed", "needs_review"])
});

export const LocalTestResultRequestSchema = z.object({
  exitCode: z.number().int(),
  summary: z.string().min(1),
  ranPrevious: z.boolean().default(false)
});

export const SubmissionStatusResponseSchema = z.object({
  submissionId: z.string().min(1),
  projectKey: z.string().min(1),
  status: z.enum(["queued", "running", "passed", "failed", "needs_review"]),
  commitSha: z.string().min(1),
  summary: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const PingResponseSchema = z.object({
  ok: z.boolean(),
  api: z.enum(["reachable", "unreachable"]),
  auth: z.enum(["valid", "missing", "invalid"]),
  github: z.enum(["linked", "missing"]),
  githubApp: z.enum(["installed", "missing"])
});

export const GitHubInstallUrlResponseSchema = z.object({
  installUrl: z.string().url()
});

export const GitHubConfigResponseSchema = z.object({
  configured: z.boolean(),
  appName: z.string().optional(),
  webBaseUrl: z.string().optional()
});

export const GitHubSessionBootstrapSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  user: UserSchema,
  apiBaseUrl: z.string().url()
});

export const GitHubInstallationCompleteRequestSchema = z.object({
  installationId: z.string().min(1)
});

export const GitHubInstallationCompleteResponseSchema = z.object({
  githubAppInstalled: z.boolean(),
  installationId: z.string().min(1)
});

export type ProjectManifest = z.infer<typeof ProjectManifestSchema>;
export type CliConfig = z.infer<typeof CliConfigSchema>;
export type DeviceStartResponse = z.infer<typeof DeviceStartResponseSchema>;
export type DevicePollResponse = z.infer<typeof DevicePollResponseSchema>;
export type MeResponse = z.infer<typeof MeResponseSchema>;
export type ProjectTaskResponse = z.infer<typeof ProjectTaskResponseSchema>;
export type ProjectSetupResponse = z.infer<typeof ProjectSetupResponseSchema>;
export type SubmissionPrepareRequest = z.infer<typeof SubmissionPrepareRequestSchema>;
export type SubmissionPrepareResponse = z.infer<typeof SubmissionPrepareResponseSchema>;
export type LocalTestResultRequest = z.infer<typeof LocalTestResultRequestSchema>;
export type SubmissionStatusResponse = z.infer<typeof SubmissionStatusResponseSchema>;
export type PingResponse = z.infer<typeof PingResponseSchema>;
export type GitHubInstallUrlResponse = z.infer<typeof GitHubInstallUrlResponseSchema>;
export type GitHubConfigResponse = z.infer<typeof GitHubConfigResponseSchema>;
export type GitHubSessionBootstrap = z.infer<typeof GitHubSessionBootstrapSchema>;
export type GitHubInstallationCompleteRequest = z.infer<typeof GitHubInstallationCompleteRequestSchema>;
export type GitHubInstallationCompleteResponse = z.infer<typeof GitHubInstallationCompleteResponseSchema>;

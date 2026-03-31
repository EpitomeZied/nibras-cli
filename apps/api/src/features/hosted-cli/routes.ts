import { FastifyInstance } from "fastify";
import {
  LocalTestResultRequestSchema,
  MeResponseSchema,
  PingResponseSchema,
  ProjectSetupResponseSchema,
  ProjectTaskResponseSchema,
  SubmissionPrepareRequestSchema,
  SubmissionPrepareResponseSchema,
  SubmissionStatusResponseSchema,
  TokenRefreshRequestSchema,
  TokenRefreshResponseSchema
} from "@nibras/contracts";
import { GitHubAppConfig } from "@nibras/github";
import { PrismaStore } from "../../prisma-store";
import { AppStore } from "../../store";
import { getWebSessionToken, requireUser } from "../../lib/auth";
import { requestBaseUrl } from "../../lib/request-base-url";
import { clearWebSessionCookie } from "../../lib/web-session";

export function registerHostedCliRoutes(
  app: FastifyInstance,
  store: AppStore,
  githubConfig: GitHubAppConfig | null
): void {
  app.get("/v1/health", async () => ({ ok: true }));

  app.get("/v1/ping", async (request) => {
    const authHeader = request.headers.authorization;
    const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : null;
    const user = token ? await store.getUserByToken(requestBaseUrl(request), token) : null;
    return PingResponseSchema.parse({
      ok: true,
      api: "reachable",
      auth: token ? (user ? "valid" : "invalid") : "missing",
      github: user?.githubLinked ? "linked" : "missing",
      githubApp: user?.githubAppInstalled ? "installed" : "missing"
    });
  });

  app.post("/v1/auth/refresh", { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (request, reply) => {
    const payload = TokenRefreshRequestSchema.parse(request.body);
    const session = await store.refreshCliSession(requestBaseUrl(request), payload.refreshToken);
    if (!session) {
      reply.code(401).send({ error: "Invalid or expired refresh token." });
      return;
    }
    return TokenRefreshResponseSchema.parse({
      accessToken: session.accessToken,
      refreshToken: session.refreshToken
    });
  });

  app.post("/v1/logout", async (request, reply) => {
    const auth = await requireUser(request, reply, store);
    if (!auth) return;
    if (auth.authKind === "bearer") {
      await store.deleteSession(requestBaseUrl(request), auth.token);
    } else {
      await store.deleteWebSession(requestBaseUrl(request), auth.token);
      void reply.header("Set-Cookie", clearWebSessionCookie(request));
    }
    return { ok: true };
  });

  app.get("/v1/me", async (request, reply) => {
    const auth = await requireUser(request, reply, store);
    if (!auth) return;
    return MeResponseSchema.parse({
      user: auth.user,
      apiBaseUrl: requestBaseUrl(request)
    });
  });

  app.get("/v1/web/session", async (request, reply) => {
    const auth = await requireUser(request, reply, store);
    if (!auth) return;
    return MeResponseSchema.parse({
      user: auth.user,
      apiBaseUrl: requestBaseUrl(request)
    });
  });

  app.post("/v1/web/logout", async (request, reply) => {
    const sessionToken = getWebSessionToken(request);
    if (sessionToken) {
      await store.deleteWebSession(requestBaseUrl(request), sessionToken);
    }
    void reply.header("Set-Cookie", clearWebSessionCookie(request));
    return { ok: true };
  });

  app.get("/v1/projects/:projectKey/manifest", async (request, reply) => {
    const params = request.params as { projectKey: string };
    const project = await store.getProject(requestBaseUrl(request), params.projectKey);
    if (!project) {
      reply.code(404).send({ error: `Unknown project ${params.projectKey}.` });
      return;
    }
    project.manifest.apiBaseUrl = requestBaseUrl(request);
    return project.manifest;
  });

  app.get("/v1/projects/:projectKey/task", async (request, reply) => {
    const params = request.params as { projectKey: string };
    const project = await store.getProject(requestBaseUrl(request), params.projectKey);
    if (!project) {
      reply.code(404).send({ error: `Unknown project ${params.projectKey}.` });
      return;
    }
    return ProjectTaskResponseSchema.parse({
      projectKey: project.projectKey,
      task: project.task
    });
  });

  app.post("/v1/projects/:projectKey/setup", async (request, reply) => {
    const auth = await requireUser(request, reply, store);
    if (!auth) return;
    const params = request.params as { projectKey: string };
    const project = await store.getProject(requestBaseUrl(request), params.projectKey);
    if (!project) {
      reply.code(404).send({ error: `Unknown project ${params.projectKey}.` });
      return;
    }
    let repo = await store.provisionProjectRepo(requestBaseUrl(request), params.projectKey, auth.user.id);
    if (githubConfig && store instanceof PrismaStore) {
      const account = await store.getGithubAccountForUser(auth.user.id);
      if (account?.userAccessToken && account.installationId) {
        try {
          repo = await store.provisionProjectRepoFromGitHub(
            requestBaseUrl(request),
            params.projectKey,
            auth.user.id,
            githubConfig
          );
        } catch {
          // Keep the DB-backed fallback record if GitHub template provisioning is not configured yet.
        }
      }
    }
    project.manifest.apiBaseUrl = requestBaseUrl(request);
    return ProjectSetupResponseSchema.parse({
      projectKey: project.projectKey,
      repo,
      manifest: project.manifest,
      task: project.task
    });
  });

  app.post("/v1/submissions/prepare", async (request, reply) => {
    const auth = await requireUser(request, reply, store);
    if (!auth) return;
    const payload = SubmissionPrepareRequestSchema.parse(request.body);
    const submission = await store.createOrReuseSubmission(requestBaseUrl(request), {
      ...payload,
      userId: auth.user.id
    });
    return SubmissionPrepareResponseSchema.parse({
      submissionId: submission.id,
      status: submission.status
    });
  });

  app.post("/v1/submissions/:submissionId/local-test-result", async (request, reply) => {
    const auth = await requireUser(request, reply, store);
    if (!auth) return;
    const params = request.params as { submissionId: string };
    const payload = LocalTestResultRequestSchema.parse(request.body);
    const submission = await store.updateLocalTestResult(
      requestBaseUrl(request),
      params.submissionId,
      auth.user.id,
      payload.exitCode,
      payload.summary
    );
    if (!submission) {
      const existing = await store.getSubmissionForAdmin(requestBaseUrl(request), params.submissionId);
      reply.code(existing ? 403 : 404).send({ error: existing ? "Forbidden." : "Unknown submission." });
      return;
    }
    return { ok: true };
  });

  app.get("/v1/submissions/:submissionId", async (request, reply) => {
    const auth = await requireUser(request, reply, store);
    if (!auth) return;
    const params = request.params as { submissionId: string };
    const submission = await store.getSubmission(requestBaseUrl(request), params.submissionId, auth.user.id);
    if (!submission) {
      const existing = await store.getSubmissionForAdmin(requestBaseUrl(request), params.submissionId);
      reply.code(existing ? 403 : 404).send({ error: existing ? "Forbidden." : "Unknown submission." });
      return;
    }
    return SubmissionStatusResponseSchema.parse({
      submissionId: submission.id,
      projectKey: submission.projectKey,
      status: submission.status,
      commitSha: submission.commitSha,
      summary: submission.summary,
      createdAt: submission.createdAt,
      updatedAt: submission.updatedAt
    });
  });
}

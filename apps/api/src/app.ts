import Fastify, { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import rawBodyPlugin from "fastify-raw-body";
import {
  DevicePollResponseSchema,
  DeviceStartResponseSchema,
  GitHubConfigResponseSchema,
  GitHubInstallationCompleteRequestSchema,
  GitHubInstallationCompleteResponseSchema,
  GitHubInstallUrlResponseSchema,
  GitHubSessionBootstrapSchema,
  LocalTestResultRequestSchema,
  MeResponseSchema,
  PingResponseSchema,
  ProjectSetupResponseSchema,
  ProjectTaskResponseSchema,
  SubmissionPrepareRequestSchema,
  SubmissionPrepareResponseSchema,
  SubmissionStatusResponseSchema
} from "@nibras/contracts";
import {
  buildGitHubInstallUrl,
  buildGitHubOAuthUrl,
  createSignedState,
  exchangeGitHubOAuthCode,
  getGitHubUser,
  getGitHubUserInstallations,
  GitHubAppConfig,
  loadGitHubAppConfig,
  pollGitHubDeviceFlow,
  startGitHubDeviceFlow,
  verifySignedState,
  verifyWebhookSignature
} from "@nibras/github";
import { PrismaStore } from "./prisma-store";
import { AppStore, FileStore, getStorePath } from "./store";

function normalizeOrigin(value: string | undefined): string | null {
  if (!value) {
    return null;
  }
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function getAllowedCorsOrigins(): string[] {
  const configuredOrigins = process.env.NIBRAS_WEB_CORS_ORIGINS;
  const candidates = configuredOrigins
    ? configuredOrigins.split(",")
    : [
        process.env.NIBRAS_WEB_BASE_URL,
        process.env.NEXT_PUBLIC_NIBRAS_WEB_BASE_URL,
        "http://127.0.0.1:3000",
        "http://localhost:3000"
      ];

  const origins = new Set<string>();
  for (const candidate of candidates) {
    const normalized = normalizeOrigin(candidate?.trim());
    if (normalized) {
      origins.add(normalized);
    }
  }
  return Array.from(origins);
}

function requestBaseUrl(request: FastifyRequest): string {
  const forwardedProto = request.headers["x-forwarded-proto"];
  const forwardedHost = request.headers["x-forwarded-host"];
  const proto = Array.isArray(forwardedProto)
    ? forwardedProto[0]
    : typeof forwardedProto === "string"
      ? forwardedProto.split(",")[0]?.trim()
      : request.protocol;
  const host = Array.isArray(forwardedHost)
    ? forwardedHost[0]
    : typeof forwardedHost === "string"
      ? forwardedHost.split(",")[0]?.trim()
      : request.headers.host || "127.0.0.1:4848";
  return `${proto || "http"}://${host}`;
}

function getBearerToken(request: FastifyRequest): string | null {
  const raw = request.headers.authorization;
  if (!raw || !raw.startsWith("Bearer ")) {
    return null;
  }
  return raw.slice("Bearer ".length).trim();
}

async function requireUser(request: FastifyRequest, reply: FastifyReply, store: AppStore) {
  const token = getBearerToken(request);
  if (!token) {
    reply.code(401).send({ error: "Missing bearer token." });
    return null;
  }
  const user = await store.getUserByToken(requestBaseUrl(request), token);
  if (!user) {
    reply.code(401).send({ error: "Invalid bearer token." });
    return null;
  }
  return { token, user };
}

function createDefaultStore(): AppStore {
  if (process.env.DATABASE_URL) {
    return new PrismaStore();
  }
  return new FileStore(getStorePath());
}

export function buildApp(store: AppStore = createDefaultStore()): FastifyInstance {
  const app = Fastify({ logger: false });
  const githubConfig = loadGitHubAppConfig();
  const allowedCorsOrigins = new Set(getAllowedCorsOrigins());

  void app.register(cors, {
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["authorization", "content-type"],
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }
      callback(null, allowedCorsOrigins.has(origin));
    }
  });

  void app.register(rawBodyPlugin, {
    field: "rawBody",
    global: false,
    encoding: false,
    routes: ["/v1/github/webhooks"]
  });

  app.addHook("onClose", async () => {
    if (store.close) {
      await store.close();
    }
  });

  app.get("/v1/health", async () => ({ ok: true }));

  app.get("/v1/github/config", async () => GitHubConfigResponseSchema.parse({
    configured: Boolean(githubConfig),
    appName: githubConfig?.appName,
    webBaseUrl: githubConfig?.webBaseUrl
  }));

  app.get("/v1/ping", async (request) => {
    const token = getBearerToken(request);
    const user = token ? await store.getUserByToken(requestBaseUrl(request), token) : null;
    return PingResponseSchema.parse({
      ok: true,
      api: "reachable",
      auth: token ? (user ? "valid" : "invalid") : "missing",
      github: user?.githubLinked ? "linked" : "missing",
      githubApp: user?.githubAppInstalled ? "installed" : "missing"
    });
  });

  app.post("/v1/device/start", async (request) => {
    if (githubConfig && store instanceof PrismaStore) {
      const device = await startGitHubDeviceFlow(githubConfig);
      return DeviceStartResponseSchema.parse({
        deviceCode: device.deviceCode,
        userCode: device.userCode,
        verificationUri: device.verificationUri,
        verificationUriComplete: device.verificationUriComplete,
        intervalSeconds: device.interval,
        expiresInSeconds: device.expiresIn
      });
    }

    const baseUrl = requestBaseUrl(request);
    const device = await store.createDeviceCode(baseUrl);
    return DeviceStartResponseSchema.parse({
      deviceCode: device.deviceCode,
      userCode: device.userCode,
      verificationUri: `${baseUrl}/dev/approve`,
      verificationUriComplete: `${baseUrl}/dev/approve?user_code=${encodeURIComponent(device.userCode)}`,
      intervalSeconds: device.intervalSeconds,
      expiresInSeconds: 600
    });
  });

  app.get("/dev/approve", async (request, reply) => {
    const query = request.query as { user_code?: string };
    if (!query.user_code) {
      reply.code(400).type("text/html").send("<h1>Missing user_code</h1>");
      return;
    }
    const approved = await store.authorizeDeviceCode(requestBaseUrl(request), query.user_code);
    if (!approved) {
      reply.code(404).type("text/html").send("<h1>Unknown user code</h1>");
      return;
    }
    reply.type("text/html").send("<h1>Nibras device approved</h1><p>You can return to the CLI.</p>");
  });

  app.post("/v1/device/poll", async (request, reply) => {
    const body = request.body as { deviceCode?: string };
    if (!body?.deviceCode) {
      reply.code(400).send({ error: "deviceCode is required." });
      return;
    }

    if (githubConfig && store instanceof PrismaStore) {
      const tokenResponse = await pollGitHubDeviceFlow(githubConfig, body.deviceCode);
      if (!tokenResponse) {
        return DevicePollResponseSchema.parse({ status: "pending" });
      }
      const githubUser = await getGitHubUser(githubConfig, tokenResponse.accessToken);
      const { user, session } = await store.upsertGitHubUserSession({
        githubUserId: String(githubUser.id),
        login: githubUser.login,
        email: githubUser.email,
        accessToken: tokenResponse.accessToken,
        refreshToken: tokenResponse.refreshToken,
        accessTokenExpiresIn: tokenResponse.expiresIn,
        refreshTokenExpiresIn: tokenResponse.refreshTokenExpiresIn
      });
      return DevicePollResponseSchema.parse({
        status: "authorized",
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        user
      });
    }

    const { record, session } = await store.pollDeviceCode(requestBaseUrl(request), body.deviceCode);
    if (!record) {
      reply.code(404).send({ error: "Unknown device code." });
      return;
    }
    if (!session || !record.userId) {
      return DevicePollResponseSchema.parse({ status: "pending" });
    }
    const user = await store.getUserByToken(requestBaseUrl(request), session.accessToken);
    if (!user) {
      reply.code(500).send({ error: "Authorized session missing user." });
      return;
    }
    return DevicePollResponseSchema.parse({
      status: "authorized",
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      user
    });
  });

  app.get("/v1/github/oauth/start", async (request, reply) => {
    if (!githubConfig) {
      reply.code(503).send({ error: "GitHub App is not configured." });
      return;
    }
    const query = request.query as { return_to?: string };
    const returnTo = query.return_to || `${githubConfig.webBaseUrl || requestBaseUrl(request)}/auth/complete`;
    const statePayload = createSignedState(githubConfig.clientSecret, { returnTo });
    reply.redirect(buildGitHubOAuthUrl(githubConfig, statePayload));
  });

  app.get("/v1/github/oauth/callback", async (request, reply) => {
    if (!githubConfig || !(store instanceof PrismaStore)) {
      reply.code(503).send({ error: "GitHub OAuth requires DATABASE_URL and GitHub App configuration." });
      return;
    }
    const query = request.query as { code?: string; state?: string };
    if (!query.code || !query.state) {
      reply.code(400).send({ error: "code and state are required." });
      return;
    }
    const state = verifySignedState(githubConfig.clientSecret, query.state);
    if (!state) {
      reply.code(400).send({ error: "Invalid OAuth state." });
      return;
    }
    const tokenResponse = await exchangeGitHubOAuthCode(githubConfig, query.code);
    const githubUser = await getGitHubUser(githubConfig, tokenResponse.accessToken);
    const { user, session } = await store.upsertGitHubUserSession({
      githubUserId: String(githubUser.id),
      login: githubUser.login,
      email: githubUser.email,
      accessToken: tokenResponse.accessToken,
      refreshToken: tokenResponse.refreshToken,
      accessTokenExpiresIn: tokenResponse.expiresIn,
      refreshTokenExpiresIn: tokenResponse.refreshTokenExpiresIn
    });
    const redirectUrl = new URL(state.returnTo || `${githubConfig.webBaseUrl || requestBaseUrl(request)}/auth/complete`);
    redirectUrl.hash = new URLSearchParams({
      access_token: session.accessToken,
      refresh_token: session.refreshToken,
      api_base_url: requestBaseUrl(request),
      user_id: user.id
    }).toString();
    reply.redirect(redirectUrl.toString());
  });

  app.get("/v1/github/install-url", async (request, reply) => {
    const auth = await requireUser(request, reply, store);
    if (!auth) return;
    if (!githubConfig || !(store instanceof PrismaStore)) {
      reply.code(503).send({ error: "GitHub App is not configured." });
      return;
    }
    const signedState = Buffer.from(JSON.stringify({
      userId: auth.user.id,
      returnTo: `${githubConfig.webBaseUrl || requestBaseUrl(request)}/install/complete`
    })).toString("base64url");
    return GitHubInstallUrlResponseSchema.parse({
      installUrl: buildGitHubInstallUrl(githubConfig, signedState)
    });
  });

  app.post("/v1/github/setup/complete", async (request, reply) => {
    const auth = await requireUser(request, reply, store);
    if (!auth) return;
    if (!githubConfig || !(store instanceof PrismaStore)) {
      reply.code(503).send({ error: "GitHub App is not configured." });
      return;
    }
    const payload = GitHubInstallationCompleteRequestSchema.parse(request.body);
    const account = await store.getGithubAccountForUser(auth.user.id);
    if (!account?.userAccessToken) {
      reply.code(400).send({ error: "GitHub user token is missing for this account." });
      return;
    }
    const installations = await getGitHubUserInstallations(githubConfig, account.userAccessToken);
    const matched = installations.find((entry) => String(entry.id) === payload.installationId);
    if (!matched) {
      reply.code(403).send({ error: "The installation does not belong to the authenticated GitHub user." });
      return;
    }
    const user = await store.linkGitHubInstallation(auth.user.id, payload.installationId);
    return GitHubInstallationCompleteResponseSchema.parse({
      githubAppInstalled: user.githubAppInstalled,
      installationId: payload.installationId
    });
  });

  app.post("/v1/logout", async (request, reply) => {
    const auth = await requireUser(request, reply, store);
    if (!auth) return;
    await store.deleteSession(requestBaseUrl(request), auth.token);
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
      payload.exitCode,
      payload.summary
    );
    if (!submission) {
      reply.code(404).send({ error: "Unknown submission." });
      return;
    }
    return { ok: true };
  });

  app.get("/v1/submissions/:submissionId", async (request, reply) => {
    const auth = await requireUser(request, reply, store);
    if (!auth) return;
    const params = request.params as { submissionId: string };
    const submission = await store.getSubmission(requestBaseUrl(request), params.submissionId);
    if (!submission) {
      reply.code(404).send({ error: "Unknown submission." });
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

  app.post("/v1/github/webhooks", async (request, reply) => {
    if (!githubConfig) {
      reply.code(503).send({ error: "GitHub App is not configured." });
      return;
    }
    const rawBodyValue = (request as FastifyRequest & { rawBody?: Buffer | string }).rawBody;
    const rawBody = Buffer.isBuffer(rawBodyValue)
      ? rawBodyValue
      : typeof rawBodyValue === "string"
        ? Buffer.from(rawBodyValue)
        : Buffer.from(JSON.stringify(request.body ?? {}));
    const signature = request.headers["x-hub-signature-256"];
    const signatureHeader = Array.isArray(signature) ? signature[0] : signature;
    if (!rawBody || !verifyWebhookSignature(githubConfig.webhookSecret, rawBody, signatureHeader)) {
      reply.code(401).send({ error: "Invalid webhook signature." });
      return;
    }
    const event = request.headers["x-github-event"];
    const payload = JSON.parse(rawBody.toString("utf8")) as Record<string, unknown>;
    if (event === "push" && store instanceof PrismaStore) {
      const repository = payload.repository as Record<string, unknown> | undefined;
      const owner = repository?.owner as Record<string, unknown> | undefined;
      await store.handlePushWebhook({
        owner: String(owner?.login || ""),
        repoName: String(repository?.name || ""),
        ref: String(payload.ref || ""),
        after: String(payload.after || "")
      });
    }
    return { ok: true };
  });

  return app;
}

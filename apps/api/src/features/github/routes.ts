import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  DevicePollResponseSchema,
  DeviceStartResponseSchema,
  GitHubConfigResponseSchema,
  GitHubInstallationCompleteRequestSchema,
  GitHubInstallationCompleteResponseSchema,
  GitHubInstallUrlResponseSchema
} from "@nibras/contracts";
import {
  buildGitHubInstallUrl,
  buildGitHubOAuthUrl,
  createSignedState,
  exchangeGitHubOAuthCode,
  getGitHubUser,
  getGitHubUserInstallations,
  GitHubAppConfig,
  pollGitHubDeviceFlow,
  startGitHubDeviceFlow,
  verifySignedState,
  verifyWebhookSignature
} from "@nibras/github";
import { requireUser } from "../../lib/auth";
import { requestBaseUrl } from "../../lib/request-base-url";
import { createWebSessionCookie } from "../../lib/web-session";
import { PrismaStore } from "../../prisma-store";
import { AppStore } from "../../store";

function resolveSafeReturnTo(
  candidate: string | undefined,
  fallback: string,
  requestBase: string,
  configuredWebBaseUrl: string | undefined
): string {
  const allowedOrigins = new Set<string>();

  for (const value of [requestBase, configuredWebBaseUrl, fallback]) {
    if (!value) continue;
    try {
      allowedOrigins.add(new URL(value).origin);
    } catch {
      continue;
    }
  }

  try {
    const fallbackUrl = new URL(fallback);
    if (!candidate) {
      return fallbackUrl.toString();
    }
    const resolved = new URL(candidate, fallbackUrl);
    if (!["http:", "https:"].includes(resolved.protocol)) {
      return fallbackUrl.toString();
    }
    if (!allowedOrigins.has(resolved.origin)) {
      return fallbackUrl.toString();
    }
    return resolved.toString();
  } catch {
    return fallback;
  }
}

export function registerGitHubRoutes(
  app: FastifyInstance,
  store: AppStore,
  githubConfig: GitHubAppConfig | null
): void {
  app.get("/v1/github/config", async () => GitHubConfigResponseSchema.parse({
    configured: Boolean(githubConfig),
    appName: githubConfig?.appName,
    webBaseUrl: githubConfig?.webBaseUrl
  }));

  app.post("/v1/device/start", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request) => {
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

  app.post("/v1/device/poll", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request, reply) => {
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
    const fallbackReturnTo = `${githubConfig.webBaseUrl || requestBaseUrl(request)}/auth/complete`;
    const returnTo = resolveSafeReturnTo(
      query.return_to,
      fallbackReturnTo,
      requestBaseUrl(request),
      githubConfig.webBaseUrl
    );
    const statePayload = createSignedState(githubConfig.clientSecret, { returnTo }, { ttlSeconds: 600 });
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
    const { user } = await store.upsertGitHubUserSession({
      githubUserId: String(githubUser.id),
      login: githubUser.login,
      email: githubUser.email,
      accessToken: tokenResponse.accessToken,
      refreshToken: tokenResponse.refreshToken,
      accessTokenExpiresIn: tokenResponse.expiresIn,
      refreshTokenExpiresIn: tokenResponse.refreshTokenExpiresIn
    });
    const webSession = await store.createWebSession(requestBaseUrl(request), user.id);
    const redirectUrl = resolveSafeReturnTo(
      state.returnTo,
      `${githubConfig.webBaseUrl || requestBaseUrl(request)}/auth/complete`,
      requestBaseUrl(request),
      githubConfig.webBaseUrl
    );
    void reply.header("Set-Cookie", createWebSessionCookie(request, webSession.sessionToken, {
      maxAgeSeconds: 30 * 24 * 60 * 60
    }));
    reply.redirect(redirectUrl);
  });

  app.get("/v1/github/install-url", async (request, reply) => {
    const auth = await requireUser(request, reply, store);
    if (!auth) return;
    if (!githubConfig || !(store instanceof PrismaStore)) {
      reply.code(503).send({ error: "GitHub App is not configured." });
      return;
    }
    const signedState = createSignedState(githubConfig.clientSecret, {
      userId: auth.user.id,
      returnTo: `${githubConfig.webBaseUrl || requestBaseUrl(request)}/dashboard`
    }, { ttlSeconds: 1800 });
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
    let redirectTo = `${githubConfig.webBaseUrl || requestBaseUrl(request)}/dashboard`;
    if (payload.state) {
      const state = verifySignedState(githubConfig.clientSecret, payload.state);
      if (!state) {
        reply.code(400).send({ error: "Invalid installation state." });
        return;
      }
      if (state.userId && state.userId !== auth.user.id) {
        reply.code(403).send({ error: "Installation state does not belong to the authenticated user." });
        return;
      }
      redirectTo = resolveSafeReturnTo(
        state.returnTo,
        redirectTo,
        requestBaseUrl(request),
        githubConfig.webBaseUrl
      );
    }
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
      installationId: payload.installationId,
      redirectTo
    });
  });

  app.post("/v1/github/webhooks", { config: { rateLimit: { max: 50, timeWindow: "1 minute" } } }, async (request: FastifyRequest, reply: FastifyReply) => {
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
    if (!verifyWebhookSignature(githubConfig.webhookSecret, rawBody, signatureHeader)) {
      reply.code(401).send({ error: "Invalid webhook signature." });
      return;
    }
    const event = request.headers["x-github-event"];
    const deliveryIdHeader = request.headers["x-github-delivery"];
    const deliveryId = Array.isArray(deliveryIdHeader) ? deliveryIdHeader[0] : deliveryIdHeader;
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody.toString("utf8")) as Record<string, unknown>;
    } catch {
      reply.code(400).send({ error: "Invalid webhook JSON payload." });
      return;
    }
    if (event === "push" || event === "pull_request") {
      const repository = payload.repository as Record<string, unknown> | undefined;
      const owner = repository?.owner as Record<string, unknown> | undefined;
      await store.handlePushWebhook({
        owner: String(owner?.login || ""),
        repoName: String(repository?.name || ""),
        ref: String(payload.ref || ""),
        after: String(payload.after || payload["head_sha"] || ""),
        deliveryId,
        eventType: Array.isArray(event) ? event[0] : String(event || "push"),
        repositoryUrl: String(repository?.html_url || ""),
        rawPayload: payload
      });
    }
    return { ok: true };
  });
}

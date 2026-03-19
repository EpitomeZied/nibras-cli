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
import { PrismaStore } from "../../prisma-store";
import { AppStore } from "../../store";

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

  app.post("/v1/github/webhooks", async (request: FastifyRequest, reply: FastifyReply) => {
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
    const payload = JSON.parse(rawBody.toString("utf8")) as Record<string, unknown>;
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

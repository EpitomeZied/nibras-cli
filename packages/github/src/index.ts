import crypto from "node:crypto";
import { importPKCS8, SignJWT } from "jose";

export type GitHubAppConfig = {
  appId: string;
  clientId: string;
  clientSecret: string;
  privateKey: string;
  webhookSecret: string;
  appName: string;
  apiBaseUrl?: string;
  webBaseUrl?: string;
  templateOwner?: string;
  templateRepo?: string;
  apiVersion?: string;
};

export type GitHubUser = {
  id: number;
  login: string;
  email: string | null;
  name: string | null;
};

export type GitHubDeviceStart = {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  verificationUriComplete: string;
  expiresIn: number;
  interval: number;
};

export type GitHubTokenResponse = {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  refreshTokenExpiresIn?: number;
  scope?: string;
  tokenType?: string;
};

export function loadGitHubAppConfig(): GitHubAppConfig | null {
  const appId = process.env.GITHUB_APP_ID;
  const clientId = process.env.GITHUB_APP_CLIENT_ID;
  const clientSecret = process.env.GITHUB_APP_CLIENT_SECRET;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;
  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
  const appName = process.env.GITHUB_APP_NAME;
  if (!appId || !clientId || !clientSecret || !privateKey || !webhookSecret || !appName) {
    return null;
  }
  return {
    appId,
    clientId,
    clientSecret,
    privateKey,
    webhookSecret,
    appName,
    apiBaseUrl: process.env.NIBRAS_API_BASE_URL,
    webBaseUrl: process.env.NIBRAS_WEB_BASE_URL,
    templateOwner: process.env.GITHUB_TEMPLATE_OWNER,
    templateRepo: process.env.GITHUB_TEMPLATE_REPO,
    apiVersion: process.env.GITHUB_API_VERSION || "2022-11-28"
  };
}

async function importGitHubPrivateKey(privateKey: string) {
  const normalized = privateKey.replace(/\\n/g, "\n");
  if (normalized.includes("BEGIN RSA PRIVATE KEY")) {
    const pkcs8 = crypto.createPrivateKey(normalized).export({
      format: "pem",
      type: "pkcs8"
    });
    return importPKCS8(pkcs8.toString(), "RS256");
  }
  return importPKCS8(normalized, "RS256");
}

export async function createAppJwt(config: GitHubAppConfig): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const key = await importGitHubPrivateKey(config.privateKey);
  return new SignJWT({})
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuedAt(now - 60)
    .setExpirationTime(now + (9 * 60))
    .setIssuer(config.appId)
    .sign(key);
}

async function githubRequest<T>(url: string, init: RequestInit = {}, token?: string, apiVersion = "2022-11-28"): Promise<T> {
  const headers = new Headers(init.headers || {});
  headers.set("accept", "application/vnd.github+json");
  headers.set("x-github-api-version", apiVersion);
  if (token) {
    headers.set("authorization", `Bearer ${token}`);
  }
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  const response = await fetch(url, { ...init, headers });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(text || `GitHub request failed (${response.status}).`);
  }
  return text ? JSON.parse(text) as T : {} as T;
}

export async function startGitHubDeviceFlow(config: GitHubAppConfig): Promise<GitHubDeviceStart> {
  const params = new URLSearchParams({
    client_id: config.clientId
  });
  const response = await fetch("https://github.com/login/device/code", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded"
    },
    body: params.toString()
  });
  const payload = await response.json() as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(String(payload.error || "Failed to start GitHub device flow."));
  }
  return {
    deviceCode: String(payload.device_code),
    userCode: String(payload.user_code),
    verificationUri: String(payload.verification_uri),
    verificationUriComplete: String(payload.verification_uri_complete || payload.verification_uri),
    expiresIn: Number(payload.expires_in || 900),
    interval: Number(payload.interval || 5)
  };
}

export async function pollGitHubDeviceFlow(config: GitHubAppConfig, deviceCode: string): Promise<GitHubTokenResponse | null> {
  const params = new URLSearchParams({
    client_id: config.clientId,
    device_code: deviceCode,
    grant_type: "urn:ietf:params:oauth:grant-type:device_code"
  });
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded"
    },
    body: params.toString()
  });
  const payload = await response.json() as Record<string, unknown>;
  if (payload.error === "authorization_pending" || payload.error === "slow_down") {
    return null;
  }
  if (!response.ok || payload.error) {
    throw new Error(String(payload.error_description || payload.error || "Failed to poll GitHub device flow."));
  }
  return {
    accessToken: String(payload.access_token),
    refreshToken: payload.refresh_token ? String(payload.refresh_token) : undefined,
    expiresIn: payload.expires_in ? Number(payload.expires_in) : undefined,
    refreshTokenExpiresIn: payload.refresh_token_expires_in ? Number(payload.refresh_token_expires_in) : undefined,
    scope: payload.scope ? String(payload.scope) : undefined,
    tokenType: payload.token_type ? String(payload.token_type) : undefined
  };
}

export async function exchangeGitHubOAuthCode(config: GitHubAppConfig, code: string): Promise<GitHubTokenResponse> {
  const params = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code
  });
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded"
    },
    body: params.toString()
  });
  const payload = await response.json() as Record<string, unknown>;
  if (!response.ok || payload.error) {
    throw new Error(String(payload.error_description || payload.error || "Failed to exchange GitHub OAuth code."));
  }
  return {
    accessToken: String(payload.access_token),
    refreshToken: payload.refresh_token ? String(payload.refresh_token) : undefined,
    expiresIn: payload.expires_in ? Number(payload.expires_in) : undefined,
    refreshTokenExpiresIn: payload.refresh_token_expires_in ? Number(payload.refresh_token_expires_in) : undefined,
    scope: payload.scope ? String(payload.scope) : undefined,
    tokenType: payload.token_type ? String(payload.token_type) : undefined
  };
}

export async function getGitHubUser(config: GitHubAppConfig, userToken: string): Promise<GitHubUser> {
  const payload = await githubRequest<Record<string, unknown>>("https://api.github.com/user", {}, userToken, config.apiVersion);
  return {
    id: Number(payload.id),
    login: String(payload.login),
    email: payload.email ? String(payload.email) : null,
    name: payload.name ? String(payload.name) : null
  };
}

export async function getGitHubUserInstallations(config: GitHubAppConfig, userToken: string): Promise<Array<{ id: number; accountLogin: string }>> {
  const payload = await githubRequest<{ installations: Array<Record<string, unknown>> }>(
    "https://api.github.com/user/installations",
    {},
    userToken,
    config.apiVersion
  );
  return (payload.installations || []).map((installation) => ({
    id: Number(installation.id),
    accountLogin: String((installation.account as Record<string, unknown> | undefined)?.login || "")
  }));
}

export function buildGitHubInstallUrl(config: GitHubAppConfig, state: string): string {
  const url = new URL(`https://github.com/apps/${config.appName}/installations/new`);
  url.searchParams.set("state", state);
  return url.toString();
}

export function buildGitHubOAuthUrl(config: GitHubAppConfig, state: string): string {
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("state", state);
  url.searchParams.set("allow_signup", "true");
  return url.toString();
}

export async function createInstallationAccessToken(config: GitHubAppConfig, installationId: string): Promise<string> {
  const appJwt = await createAppJwt(config);
  const payload = await githubRequest<Record<string, unknown>>(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    { method: "POST", body: JSON.stringify({}) },
    appJwt,
    config.apiVersion
  );
  return String(payload.token);
}

export async function generateRepositoryFromTemplate(
  config: GitHubAppConfig,
  userToken: string,
  owner: string,
  repoName: string
): Promise<{ cloneUrl: string | null; htmlUrl: string | null; fullName: string }> {
  if (!config.templateOwner || !config.templateRepo) {
    throw new Error("Template repository is not configured.");
  }
  const payload = await githubRequest<Record<string, unknown>>(
    `https://api.github.com/repos/${config.templateOwner}/${config.templateRepo}/generate`,
    {
      method: "POST",
      body: JSON.stringify({
        owner,
        name: repoName,
        private: true,
        include_all_branches: false
      })
    },
    userToken,
    config.apiVersion
  );
  return {
    cloneUrl: payload.clone_url ? String(payload.clone_url) : null,
    htmlUrl: payload.html_url ? String(payload.html_url) : null,
    fullName: String(payload.full_name)
  };
}

export function createSignedState(secret: string, payload: Record<string, string>): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${signature}`;
}

export function verifySignedState(secret: string, signedState: string): Record<string, string> | null {
  const [body, signature] = signedState.split(".");
  if (!body || !signature) {
    return null;
  }
  const expected = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== providedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, providedBuffer)) {
    return null;
  }
  return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Record<string, string>;
}

export function verifyWebhookSignature(secret: string, body: Buffer, signatureHeader: string | undefined): boolean {
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) {
    return false;
  }
  const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
  const actual = signatureHeader.slice("sha256=".length);
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);
  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

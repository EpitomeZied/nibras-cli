import crypto from 'node:crypto';
import { importPKCS8, SignJWT } from 'jose';

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

export type SignedStateOptions = {
  ttlSeconds?: number;
};

export class GitHubRequestError extends Error {
  statusCode: number;
  bodyText: string;

  constructor(message: string, statusCode: number, bodyText: string) {
    super(message);
    this.name = 'GitHubRequestError';
    this.statusCode = statusCode;
    this.bodyText = bodyText;
  }
}

export type GitHubRepositoryPermission = 'admin' | 'write' | 'read';

export type GitHubRepository = {
  repoUrl: string;
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  visibility: 'public' | 'private';
  permission: GitHubRepositoryPermission;
};

export function parseGitHubRepositoryUrl(
  value: string
): { owner: string; name: string; repoUrl: string } | null {
  const raw = value.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const hostname = url.hostname.toLowerCase();
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }
    if (hostname !== 'github.com' && hostname !== 'www.github.com') {
      return null;
    }
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length !== 2) {
      return null;
    }
    const [owner, rawRepo] = parts;
    const name = rawRepo.replace(/\.git$/i, '');
    if (!owner || !name) {
      return null;
    }
    return {
      owner,
      name,
      repoUrl: `https://github.com/${owner}/${name}`,
    };
  } catch {
    return null;
  }
}

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
    apiVersion: process.env.GITHUB_API_VERSION || '2022-11-28',
  };
}

async function importGitHubPrivateKey(privateKey: string) {
  const normalized = privateKey.replace(/\\n/g, '\n');
  if (normalized.includes('BEGIN RSA PRIVATE KEY')) {
    const pkcs8 = crypto.createPrivateKey(normalized).export({
      format: 'pem',
      type: 'pkcs8',
    });
    return importPKCS8(pkcs8.toString(), 'RS256');
  }
  return importPKCS8(normalized, 'RS256');
}

export async function createAppJwt(config: GitHubAppConfig): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const key = await importGitHubPrivateKey(config.privateKey);
  return new SignJWT({})
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuedAt(now - 60)
    .setExpirationTime(now + 9 * 60)
    .setIssuer(config.appId)
    .sign(key);
}

async function githubRequest<T>(
  url: string,
  init: RequestInit = {},
  token?: string,
  apiVersion = '2022-11-28'
): Promise<T> {
  const headers = new Headers(init.headers || {});
  headers.set('accept', 'application/vnd.github+json');
  headers.set('x-github-api-version', apiVersion);
  if (token) {
    headers.set('authorization', `Bearer ${token}`);
  }
  if (init.body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }
  const response = await fetch(url, { ...init, headers });
  const text = await response.text();
  if (!response.ok) {
    throw new GitHubRequestError(
      text || `GitHub request failed (${response.status}).`,
      response.status,
      text
    );
  }
  return text ? (JSON.parse(text) as T) : ({} as T);
}

function normalizeRepositoryPermission(
  payload: Record<string, unknown>
): GitHubRepositoryPermission {
  const permissions =
    payload.permissions && typeof payload.permissions === 'object'
      ? (payload.permissions as Record<string, unknown>)
      : null;
  const roleName = typeof payload.role_name === 'string' ? payload.role_name.toLowerCase() : '';

  if (permissions?.admin === true || roleName === 'admin') {
    return 'admin';
  }
  if (permissions?.push === true || permissions?.maintain === true) {
    return 'write';
  }
  if (roleName === 'write' || roleName === 'maintain') {
    return 'write';
  }
  return 'read';
}

export async function startGitHubDeviceFlow(config: GitHubAppConfig): Promise<GitHubDeviceStart> {
  const params = new URLSearchParams({
    client_id: config.clientId,
    scope: 'repo user:email',
  });
  const response = await fetch('https://github.com/login/device/code', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });
  const payload = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(String(payload.error || 'Failed to start GitHub device flow.'));
  }
  return {
    deviceCode: String(payload.device_code),
    userCode: String(payload.user_code),
    verificationUri: String(payload.verification_uri),
    verificationUriComplete: String(payload.verification_uri_complete || payload.verification_uri),
    expiresIn: Number(payload.expires_in || 900),
    interval: Number(payload.interval || 5),
  };
}

export async function pollGitHubDeviceFlow(
  config: GitHubAppConfig,
  deviceCode: string
): Promise<GitHubTokenResponse | null> {
  const params = new URLSearchParams({
    client_id: config.clientId,
    device_code: deviceCode,
    grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
  });
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });
  const payload = (await response.json()) as Record<string, unknown>;
  if (payload.error === 'authorization_pending' || payload.error === 'slow_down') {
    return null;
  }
  if (!response.ok || payload.error) {
    throw new Error(
      String(payload.error_description || payload.error || 'Failed to poll GitHub device flow.')
    );
  }
  return {
    accessToken: String(payload.access_token),
    refreshToken: payload.refresh_token ? String(payload.refresh_token) : undefined,
    expiresIn: payload.expires_in ? Number(payload.expires_in) : undefined,
    refreshTokenExpiresIn: payload.refresh_token_expires_in
      ? Number(payload.refresh_token_expires_in)
      : undefined,
    scope: payload.scope ? String(payload.scope) : undefined,
    tokenType: payload.token_type ? String(payload.token_type) : undefined,
  };
}

export async function exchangeGitHubOAuthCode(
  config: GitHubAppConfig,
  code: string
): Promise<GitHubTokenResponse> {
  const params = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
  });
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });
  const payload = (await response.json()) as Record<string, unknown>;
  if (!response.ok || payload.error) {
    throw new Error(
      String(payload.error_description || payload.error || 'Failed to exchange GitHub OAuth code.')
    );
  }
  return {
    accessToken: String(payload.access_token),
    refreshToken: payload.refresh_token ? String(payload.refresh_token) : undefined,
    expiresIn: payload.expires_in ? Number(payload.expires_in) : undefined,
    refreshTokenExpiresIn: payload.refresh_token_expires_in
      ? Number(payload.refresh_token_expires_in)
      : undefined,
    scope: payload.scope ? String(payload.scope) : undefined,
    tokenType: payload.token_type ? String(payload.token_type) : undefined,
  };
}

export async function getGitHubUser(
  config: GitHubAppConfig,
  userToken: string
): Promise<GitHubUser> {
  const payload = await githubRequest<Record<string, unknown>>(
    'https://api.github.com/user',
    {},
    userToken,
    config.apiVersion
  );
  let email = payload.email ? String(payload.email) : null;

  if (!email) {
    try {
      const emails = await githubRequest<Array<Record<string, unknown>>>(
        'https://api.github.com/user/emails',
        {},
        userToken,
        config.apiVersion
      );
      const preferred =
        emails.find(
          (entry) =>
            entry.primary === true && entry.verified === true && typeof entry.email === 'string'
        ) ||
        emails.find((entry) => entry.verified === true && typeof entry.email === 'string') ||
        emails.find((entry) => entry.primary === true && typeof entry.email === 'string') ||
        emails.find((entry) => typeof entry.email === 'string');
      email = preferred && preferred.email ? String(preferred.email) : null;
    } catch {
      email = null;
    }
  }

  return {
    id: Number(payload.id),
    login: String(payload.login),
    email,
    name: payload.name ? String(payload.name) : null,
  };
}

export async function getGitHubUserInstallations(
  config: GitHubAppConfig,
  userToken: string
): Promise<Array<{ id: number; accountLogin: string }>> {
  const payload = await githubRequest<{ installations: Array<Record<string, unknown>> }>(
    'https://api.github.com/user/installations',
    {},
    userToken,
    config.apiVersion
  );
  return (payload.installations || []).map((installation) => ({
    id: Number(installation.id),
    accountLogin: String(
      (installation.account as Record<string, unknown> | undefined)?.login || ''
    ),
  }));
}

export function buildGitHubInstallUrl(config: GitHubAppConfig, state: string): string {
  const url = new URL(`https://github.com/apps/${config.appName}/installations/new`);
  url.searchParams.set('state', state);
  return url.toString();
}

export function buildGitHubOAuthUrl(config: GitHubAppConfig, state: string): string {
  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('state', state);
  url.searchParams.set('allow_signup', 'true');
  url.searchParams.set('scope', 'repo user:email');
  return url.toString();
}

export async function createInstallationAccessToken(
  config: GitHubAppConfig,
  installationId: string
): Promise<string> {
  const appJwt = await createAppJwt(config);
  const payload = await githubRequest<Record<string, unknown>>(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    { method: 'POST', body: JSON.stringify({}) },
    appJwt,
    config.apiVersion
  );
  return String(payload.token);
}

export async function getGitHubRepository(
  config: GitHubAppConfig,
  userToken: string,
  owner: string,
  repo: string
): Promise<GitHubRepository> {
  const payload = await githubRequest<Record<string, unknown>>(
    `https://api.github.com/repos/${owner}/${repo}`,
    {},
    userToken,
    config.apiVersion
  );

  const normalized = parseGitHubRepositoryUrl(
    typeof payload.html_url === 'string' ? payload.html_url : `https://github.com/${owner}/${repo}`
  );

  return {
    repoUrl: normalized?.repoUrl || `https://github.com/${owner}/${repo}`,
    owner: normalized?.owner || owner,
    name: normalized?.name || repo,
    fullName:
      typeof payload.full_name === 'string'
        ? payload.full_name
        : `${normalized?.owner || owner}/${normalized?.name || repo}`,
    defaultBranch:
      typeof payload.default_branch === 'string' && payload.default_branch
        ? payload.default_branch
        : 'main',
    visibility: payload.private === true ? 'private' : 'public',
    permission: normalizeRepositoryPermission(payload),
  };
}

export async function generateRepositoryFromTemplate(
  config: GitHubAppConfig,
  userToken: string,
  owner: string,
  repoName: string
): Promise<{ cloneUrl: string | null; htmlUrl: string | null; fullName: string }> {
  if (!config.templateOwner || !config.templateRepo) {
    throw new Error('Template repository is not configured.');
  }
  const payload = await githubRequest<Record<string, unknown>>(
    `https://api.github.com/repos/${config.templateOwner}/${config.templateRepo}/generate`,
    {
      method: 'POST',
      body: JSON.stringify({
        owner,
        name: repoName,
        private: true,
        include_all_branches: false,
      }),
    },
    userToken,
    config.apiVersion
  );
  return {
    cloneUrl: payload.clone_url ? String(payload.clone_url) : null,
    htmlUrl: payload.html_url ? String(payload.html_url) : null,
    fullName: String(payload.full_name),
  };
}

export async function createPrivateRepository(
  config: GitHubAppConfig,
  userToken: string,
  owner: string,
  repoName: string
): Promise<{ cloneUrl: string | null; htmlUrl: string | null; fullName: string }> {
  const payload = await githubRequest<Record<string, unknown>>(
    'https://api.github.com/user/repos',
    {
      method: 'POST',
      body: JSON.stringify({
        name: repoName,
        private: true,
        auto_init: false,
      }),
    },
    userToken,
    config.apiVersion
  );
  return {
    cloneUrl: payload.clone_url ? String(payload.clone_url) : null,
    htmlUrl: payload.html_url ? String(payload.html_url) : null,
    fullName: payload.full_name ? String(payload.full_name) : `${owner}/${repoName}`,
  };
}

export function createSignedState(
  secret: string,
  payload: Record<string, string>,
  options: SignedStateOptions = {}
): string {
  const ttlSeconds = options.ttlSeconds ?? 600;
  const now = Math.floor(Date.now() / 1000);
  const body = Buffer.from(
    JSON.stringify({
      payload,
      iat: now,
      exp: now + ttlSeconds,
    })
  ).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${signature}`;
}

export function verifySignedState(
  secret: string,
  signedState: string
): Record<string, string> | null {
  const [body, signature] = signedState.split('.');
  if (!body || !signature) {
    return null;
  }
  const expected = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(signature);
  if (
    expectedBuffer.length !== providedBuffer.length ||
    !crypto.timingSafeEqual(expectedBuffer, providedBuffer)
  ) {
    return null;
  }

  try {
    const decoded = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as unknown;

    if (decoded && typeof decoded === 'object' && 'payload' in decoded) {
      const envelope = decoded as { payload?: Record<string, string>; exp?: number };
      if (!envelope.payload || typeof envelope.payload !== 'object') {
        return null;
      }
      if (typeof envelope.exp === 'number' && envelope.exp < Math.floor(Date.now() / 1000)) {
        return null;
      }
      return envelope.payload;
    }

    if (decoded && typeof decoded === 'object') {
      return decoded as Record<string, string>;
    }
    return null;
  } catch {
    return null;
  }
}

export function verifyWebhookSignature(
  secret: string,
  body: Buffer,
  signatureHeader: string | undefined
): boolean {
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
    return false;
  }
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
  const actual = signatureHeader.slice('sha256='.length);
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);
  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

import { readCliConfig, writeCliConfig } from './config';
import { TOKEN_REFRESH_THRESHOLD_MS } from './constants';

export class ApiError extends Error {
  statusCode: number;

  bodyText: string;

  constructor(message: string, statusCode: number, bodyText: string) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.bodyText = bodyText;
  }
}

/** Thrown when the refresh token is invalid/expired and the user must re-login. */
export class AuthExpiredError extends Error {
  constructor() {
    super('Your session has expired. Run `nibras login` to authenticate again.');
    this.name = 'AuthExpiredError';
  }
}

// TOKEN_REFRESH_THRESHOLD_MS is imported from ./constants.

async function maybeRefreshToken(baseUrl: string): Promise<void> {
  const config = readCliConfig();
  if (!config.accessToken || !config.refreshToken) {
    return;
  }
  const createdAt = config.tokenCreatedAt ? new Date(config.tokenCreatedAt).getTime() : null;
  if (!createdAt || Date.now() - createdAt < TOKEN_REFRESH_THRESHOLD_MS) {
    return;
  }
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: config.refreshToken }),
    });
    if (!response.ok) {
      if (response.status >= 400 && response.status < 500) {
        // 4xx means the refresh token itself is invalid or revoked.
        // Clear the stored credentials so the next API call gets an
        // actionable error rather than a confusing 401.
        writeCliConfig({ ...config, accessToken: undefined, refreshToken: undefined, tokenCreatedAt: undefined });
        throw new AuthExpiredError();
      }
      // 5xx or unexpected — warn and fall through with the existing token.
      process.stderr.write(
        `[nibras] Warning: token refresh failed (${response.status}) — proceeding with existing token.\n`
      );
      return;
    }
    const data = (await response.json()) as { accessToken: string; refreshToken: string };
    writeCliConfig({
      ...config,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      tokenCreatedAt: new Date().toISOString(),
    });
  } catch (err) {
    if (err instanceof AuthExpiredError) throw err;
    // Transient network error — proceed with existing token silently.
  }
}

export async function apiRequest<T>(
  pathName: string,
  options: RequestInit = {},
  overrideBaseUrl?: string
): Promise<T> {
  const config = readCliConfig();
  const baseUrl = overrideBaseUrl || config.apiBaseUrl;

  await maybeRefreshToken(baseUrl);

  // Re-read config after potential refresh
  const refreshedConfig = readCliConfig();
  const headers = new Headers(options.headers || {});
  if (!headers.has('content-type') && options.body) {
    headers.set('content-type', 'application/json');
  }
  if (refreshedConfig.accessToken) {
    headers.set('authorization', `Bearer ${refreshedConfig.accessToken}`);
  }

  const response = await fetch(`${baseUrl.replace(/\/$/, '')}${pathName}`, {
    ...options,
    headers,
  });
  const bodyText = await response.text();
  if (!response.ok) {
    throw new ApiError(
      bodyText || `Request failed with status ${response.status}.`,
      response.status,
      bodyText
    );
  }
  return bodyText ? (JSON.parse(bodyText) as T) : ({} as T);
}

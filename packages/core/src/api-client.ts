import { readCliConfig, writeCliConfig } from "./config";

export class ApiError extends Error {
  statusCode: number;

  bodyText: string;

  constructor(message: string, statusCode: number, bodyText: string) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.bodyText = bodyText;
  }
}

const TOKEN_REFRESH_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

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
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/v1/auth/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken: config.refreshToken })
    });
    if (!response.ok) {
      return; // Silently skip; the original token may still be valid
    }
    const data = await response.json() as { accessToken: string; refreshToken: string };
    writeCliConfig({
      ...config,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      tokenCreatedAt: new Date().toISOString()
    });
  } catch {
    // Network error during refresh — proceed with existing token
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
  if (!headers.has("content-type") && options.body) {
    headers.set("content-type", "application/json");
  }
  if (refreshedConfig.accessToken) {
    headers.set("authorization", `Bearer ${refreshedConfig.accessToken}`);
  }

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}${pathName}`, {
    ...options,
    headers
  });
  const bodyText = await response.text();
  if (!response.ok) {
    throw new ApiError(
      bodyText || `Request failed with status ${response.status}.`,
      response.status,
      bodyText
    );
  }
  return bodyText ? JSON.parse(bodyText) as T : {} as T;
}

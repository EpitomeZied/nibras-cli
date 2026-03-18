import { readCliConfig } from "./config";

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

export async function apiRequest<T>(
  pathName: string,
  options: RequestInit = {},
  overrideBaseUrl?: string
): Promise<T> {
  const config = readCliConfig();
  const baseUrl = overrideBaseUrl || config.apiBaseUrl;
  const headers = new Headers(options.headers || {});
  if (!headers.has("content-type") && options.body) {
    headers.set("content-type", "application/json");
  }
  if (config.accessToken) {
    headers.set("authorization", `Bearer ${config.accessToken}`);
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

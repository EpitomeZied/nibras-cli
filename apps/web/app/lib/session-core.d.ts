export function normalizeApiBaseUrl(value: string | null | undefined): string | null;
export function isLoopbackUrl(value: string | null | undefined): boolean;
export function shouldIgnoreStoredApiBaseUrlForOrigin(pageOrigin: string | null | undefined, value: string | null | undefined): boolean;
export function buildApiBaseUrlCandidates(args: {
  pageOrigin: string | null | undefined;
  storedApiBaseUrl: string | null | undefined;
  configuredApiBaseUrl: string | null | undefined;
}): string[];
export function formatApiDiscoveryError(candidates: string[]): string;
export function discoverApiBaseUrlWith(args: {
  pageOrigin: string | null | undefined;
  storedApiBaseUrl: string | null | undefined;
  configuredApiBaseUrl: string | null | undefined;
  probe: (candidate: string) => Promise<boolean>;
  persistApiBaseUrl?: (candidate: string) => Promise<void> | void;
}): Promise<string>;
export function createApiUrl(apiBaseUrl: string, path: string): string;
export function formatApiFetchError(apiBaseUrl: string): string;
export function apiFetchWith(args: {
  path: string;
  init?: RequestInit;
  auth?: boolean;
  discoverApiBaseUrl: () => Promise<string>;
  fetchImpl: (input: string, init?: RequestInit) => Promise<Response>;
  accessToken?: string | null;
}): Promise<Response>;

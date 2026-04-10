'use client';

import {
  apiFetchWith,
  buildApiBaseUrlCandidates,
  discoverApiBaseUrlWith,
  normalizeApiBaseUrl,
  shouldIgnoreStoredApiBaseUrlForOrigin,
} from './session-core.js';

let discoveryPromise: Promise<string> | null = null;

function getWindowLocationOrigin(): string | null {
  return typeof window === 'undefined' ? null : window.location.origin;
}

export function getStoredApiBaseUrl(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return normalizeApiBaseUrl(window.localStorage.getItem('nibras.apiBaseUrl'));
}

export function getConfiguredApiBaseUrl(): string | null {
  const raw = normalizeApiBaseUrl(process.env.NEXT_PUBLIC_NIBRAS_API_BASE_URL);
  if (!raw) return null;
  // Ignore loopback configured URL when accessed from a production HTTPS origin —
  // same protection already applied to stored URLs.
  if (shouldIgnoreStoredApiBaseUrl(raw)) return null;
  return raw;
}

export function getCurrentOriginCandidate(): string | null {
  return normalizeApiBaseUrl(getWindowLocationOrigin());
}

export function shouldIgnoreStoredApiBaseUrl(value: string): boolean {
  return shouldIgnoreStoredApiBaseUrlForOrigin(getWindowLocationOrigin(), value);
}

export function resolveApiBaseUrl(): string {
  return (
    buildApiBaseUrlCandidates({
      pageOrigin: getCurrentOriginCandidate(),
      storedApiBaseUrl: getStoredApiBaseUrl(),
      configuredApiBaseUrl: getConfiguredApiBaseUrl(),
    })[0] || ''
  );
}

export function persistSessionValues(values: Record<string, string>) {
  for (const [key, value] of Object.entries(values)) {
    const normalizedValue =
      key === 'nibras.apiBaseUrl' ? normalizeApiBaseUrl(value) || value : value;
    window.localStorage.setItem(key, normalizedValue);
  }
  discoveryPromise = null;
}

export async function discoverApiBaseUrl(): Promise<string> {
  if (typeof window === 'undefined') {
    throw new Error('Browser session helpers require window.');
  }

  if (!discoveryPromise) {
    discoveryPromise = discoverApiBaseUrlWith({
      pageOrigin: getCurrentOriginCandidate(),
      storedApiBaseUrl: getStoredApiBaseUrl(),
      configuredApiBaseUrl: getConfiguredApiBaseUrl(),
      probe: async (candidate) => {
        const response = await fetch(`${candidate}/v1/health`);
        return response.ok;
      },
      persistApiBaseUrl: async (candidate) => {
        window.localStorage.setItem('nibras.apiBaseUrl', candidate);
      },
    }).catch((error) => {
      discoveryPromise = null;
      throw error;
    });
  }

  return discoveryPromise;
}

export async function apiFetch(
  path: string,
  init: RequestInit & { auth?: boolean; accessToken?: string } = {}
): Promise<Response> {
  if (typeof window === 'undefined') {
    throw new Error('Browser session helpers require window.');
  }

  const { auth = false, accessToken: explicitToken, ...requestInit } = init;

  // Prefer explicitly provided token, then fall back to the web session token
  // stored in localStorage by /auth/complete after GitHub OAuth. This avoids
  // relying on cross-domain cookies (blocked by Chrome 3P cookie restrictions).
  const accessToken =
    explicitToken ??
    (auth ? (window.localStorage.getItem('nibras.webSession') ?? undefined) : undefined);

  return apiFetchWith({
    path,
    init: requestInit,
    auth,
    accessToken,
    discoverApiBaseUrl,
    fetchImpl: (input, request) => fetch(input, request),
  });
}

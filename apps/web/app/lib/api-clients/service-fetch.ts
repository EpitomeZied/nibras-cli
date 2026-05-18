'use client';

import { resolveServiceBaseUrl, type ApiServiceName } from './registry';
import { ApiError } from './errors';

const WEB_SESSION_TOKEN_KEY = 'nibras.webSession';
const REFRESH_PATH = '/auth/refresh-tokens';

export type ServiceFetchInit = Omit<RequestInit, 'body'> & {
  auth?: boolean;
  body?: BodyInit | Record<string, unknown> | null;
  query?: Record<string, string | number | boolean | null | undefined>;
};

function readSessionToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(WEB_SESSION_TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeSessionToken(token: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(WEB_SESSION_TOKEN_KEY, token);
  } catch {
    /* ignore quota / private-mode errors */
  }
}

function buildUrl(
  service: ApiServiceName,
  path: string,
  query?: ServiceFetchInit['query']
): string {
  const base = resolveServiceBaseUrl(service);
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${base}${normalizedPath}`;
  if (!query) return url;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined) continue;
    search.append(key, String(value));
  }
  const qs = search.toString();
  return qs ? `${url}${url.includes('?') ? '&' : '?'}${qs}` : url;
}

function isPlainObjectBody(body: unknown): body is Record<string, unknown> {
  if (body === null || typeof body !== 'object') return false;
  if (body instanceof FormData) return false;
  if (body instanceof Blob) return false;
  if (body instanceof ArrayBuffer) return false;
  if (body instanceof URLSearchParams) return false;
  if (typeof (body as { append?: unknown }).append === 'function') return false;
  return true;
}

function prepareInit(init: ServiceFetchInit, token: string | null): RequestInit {
  const headers = new Headers(init.headers || {});
  let body: BodyInit | null | undefined;

  if (init.body !== undefined && init.body !== null) {
    if (isPlainObjectBody(init.body)) {
      body = JSON.stringify(init.body);
      if (!headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }
    } else {
      body = init.body as BodyInit;
    }
  } else {
    body = null;
  }

  if (init.auth !== false && token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const rest: RequestInit = { ...init } as RequestInit;
  delete (rest as { query?: unknown }).query;
  delete (rest as { auth?: unknown }).auth;
  delete rest.body;

  return {
    ...rest,
    headers,
    body: body ?? undefined,
  };
}

async function tryRefreshToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  try {
    const adminBase = resolveServiceBaseUrl('admin');
    const response = await fetch(`${adminBase}${REFRESH_PATH}`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!response.ok) return null;
    const payload = (await response.json().catch(() => null)) as
      | { accessToken?: string; data?: { accessToken?: string } }
      | null;
    const next = payload?.accessToken || payload?.data?.accessToken || null;
    if (next) writeSessionToken(next);
    return next;
  } catch {
    return null;
  }
}

async function readResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json().catch(() => null);
  }
  if (response.status === 204) return null;
  return response.text().catch(() => null);
}

export async function serviceFetch<T = unknown>(
  service: ApiServiceName,
  path: string,
  init: ServiceFetchInit = {}
): Promise<T> {
  const url = buildUrl(service, path, init.query);
  const token = readSessionToken();
  const firstRequest = prepareInit(init, token);

  let response = await fetch(url, firstRequest);

  if (response.status === 401 && init.auth !== false) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      response = await fetch(url, prepareInit(init, refreshed));
    }
  }

  const body = await readResponseBody(response);

  if (!response.ok) {
    const message =
      (typeof body === 'object' && body !== null
        ? ((body as Record<string, unknown>).message as string | undefined) ||
          ((body as { error?: { message?: string } }).error?.message ?? undefined)
        : typeof body === 'string'
          ? body
          : undefined) ?? `Request failed with status ${response.status}`;
    throw new ApiError(message, {
      service,
      status: response.status,
      code:
        typeof body === 'object' && body !== null
          ? ((body as { code?: string }).code ?? (body as { error?: { code?: string } }).error?.code)
          : undefined,
      body,
    });
  }

  if (body && typeof body === 'object' && 'data' in (body as Record<string, unknown>)) {
    return (body as { data: T }).data;
  }
  return body as T;
}

/**
 * Variant of `serviceFetch` that resolves to `null` when the backend returns
 * HTTP 404. Used for endpoints the legacy dashboard exposes but the production
 * Railway backend doesn't — the page degrades to an `EmptyState` instead of
 * surfacing an `ApiError`. All other failure modes (401, 500, network) still
 * throw an `ApiError` so genuine outages remain visible.
 */
export async function serviceFetchOptional<T = unknown>(
  service: ApiServiceName,
  path: string,
  init: ServiceFetchInit = {}
): Promise<T | null> {
  try {
    return await serviceFetch<T>(service, path, init);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return null;
    }
    throw err;
  }
}

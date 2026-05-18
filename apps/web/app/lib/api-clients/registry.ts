/**
 * Multi-backend service URL registry.
 *
 * The web app currently talks to a single Nibras API via Next.js rewrites
 * (`apiFetch` in `app/lib/session.ts`). The ported student-dashboard features
 * also consume four EXTERNAL production backends (Railway monolith for admin
 * + community + gamification + reputation, Fly.dev for tracking, Railway for
 * competitions, Railway for the recommendation model). This registry resolves
 * the base URL for each service from, in priority order:
 *
 *   1. `?<service>Api=URL` query string parameter (debug per-tab override)
 *   2. `localStorage.nibras_<service>_api_url`
 *   3. `NEXT_PUBLIC_NIBRAS_<SERVICE>_API_URL` env var
 *   4. Hard-coded default mirroring `nibras-student-dashboard/client/config.js`
 */
export type ApiServiceName =
  | 'admin'
  | 'community'
  | 'tracking'
  | 'competitions'
  | 'recommendation';

const DEFAULT_SERVICE_URLS: Record<ApiServiceName, string> = {
  admin: 'https://nibras-backend.up.railway.app/api',
  community: 'https://nibras-backend.up.railway.app/api',
  tracking: 'https://nibras-api.fly.dev',
  // `ensureCompetitionsApiBaseUrl` in the legacy dashboard appends `/api` to
  // the bare competitions host, so the resolved base is the same `/api` path
  // as the admin service. Verified: `https://nibras-backend.up.railway.app/api/contests`
  // returns 200, while the bare-host variant returns 404.
  competitions: 'https://nibras-backend.up.railway.app/api',
  recommendation: 'https://recommendationmodel-production-0f8e.up.railway.app/api',
};

const ENV_KEYS: Record<ApiServiceName, string> = {
  admin: 'NEXT_PUBLIC_NIBRAS_ADMIN_API_URL',
  community: 'NEXT_PUBLIC_NIBRAS_COMMUNITY_API_URL',
  tracking: 'NEXT_PUBLIC_NIBRAS_TRACKING_API_URL',
  competitions: 'NEXT_PUBLIC_NIBRAS_COMPETITIONS_API_URL',
  recommendation: 'NEXT_PUBLIC_NIBRAS_RECOMMENDATION_API_URL',
};

const QUERY_KEYS: Record<ApiServiceName, readonly string[]> = {
  admin: ['adminApi', 'api'],
  community: ['communityApi', 'discussionsApi'],
  tracking: ['trackingApi', 'trackApi'],
  competitions: ['competitionsApi', 'compApi'],
  recommendation: ['recommendationApi', 'recommendApi', 'recApi'],
};

const STORAGE_KEYS: Record<ApiServiceName, string> = {
  admin: 'nibras_admin_api_url',
  community: 'nibras_community_api_url',
  tracking: 'nibras_tracking_api_url',
  competitions: 'nibras_competitions_api_url',
  recommendation: 'nibras_recommendation_api_url',
};

function normalize(value: string | null | undefined): string | null {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim().replace(/\/+$/, '');
  return trimmed.length > 0 ? trimmed : null;
}

function readEnv(service: ApiServiceName): string | null {
  const envKey = ENV_KEYS[service];
  const raw = (process.env as Record<string, string | undefined>)[envKey];
  return normalize(raw);
}

function readQuery(service: ApiServiceName): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  for (const key of QUERY_KEYS[service]) {
    const value = params.get(key);
    const normalized = normalize(value);
    if (normalized) return normalized;
  }
  return null;
}

function readStorage(service: ApiServiceName): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return normalize(window.localStorage.getItem(STORAGE_KEYS[service]));
  } catch {
    return null;
  }
}

export function resolveServiceBaseUrl(service: ApiServiceName): string {
  return (
    readQuery(service) ??
    readStorage(service) ??
    readEnv(service) ??
    DEFAULT_SERVICE_URLS[service]
  );
}

export function getDefaultServiceBaseUrl(service: ApiServiceName): string {
  return DEFAULT_SERVICE_URLS[service];
}

export function getAllServiceBaseUrls(): Record<ApiServiceName, string> {
  return {
    admin: resolveServiceBaseUrl('admin'),
    community: resolveServiceBaseUrl('community'),
    tracking: resolveServiceBaseUrl('tracking'),
    competitions: resolveServiceBaseUrl('competitions'),
    recommendation: resolveServiceBaseUrl('recommendation'),
  };
}

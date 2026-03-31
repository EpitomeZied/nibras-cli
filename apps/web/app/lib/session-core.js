function normalizePathname(pathname) {
  if (!pathname || pathname === "/") {
    return "";
  }
  return pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

export function normalizeApiBaseUrl(value) {
  if (!value) {
    return null;
  }
  try {
    const url = new URL(value);
    return `${url.origin}${normalizePathname(url.pathname)}`;
  } catch {
    return null;
  }
}

export function isLoopbackUrl(value) {
  const normalized = normalizeApiBaseUrl(value);
  if (!normalized) {
    return false;
  }
  const url = new URL(normalized);
  return url.hostname === "127.0.0.1" || url.hostname === "localhost";
}

export function shouldIgnoreStoredApiBaseUrlForOrigin(pageOrigin, value) {
  const normalizedOrigin = normalizeApiBaseUrl(pageOrigin);
  if (!normalizedOrigin) {
    return false;
  }
  return normalizedOrigin.startsWith("https://") && !isLoopbackUrl(normalizedOrigin) && isLoopbackUrl(value);
}

export function buildApiBaseUrlCandidates({
  pageOrigin,
  storedApiBaseUrl,
  configuredApiBaseUrl
}) {
  const candidates = [];
  const seen = new Set();

  function push(value) {
    const normalized = normalizeApiBaseUrl(value);
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    candidates.push(normalized);
  }

  push(pageOrigin);

  if (
    storedApiBaseUrl &&
    !shouldIgnoreStoredApiBaseUrlForOrigin(pageOrigin, storedApiBaseUrl)
  ) {
    push(storedApiBaseUrl);
  }

  push(configuredApiBaseUrl);

  return candidates;
}

export function formatApiDiscoveryError(candidates) {
  const attempted = candidates.length > 0 ? candidates.join(", ") : "no API base URLs";
  return `Unable to reach the Nibras API. Tried: ${attempted}. Start \`npm run api:dev\` for local API access, start \`npm run proxy:dev\` for same-origin proxy access, or update \`.env\` and your tunnel URL before signing in again.`;
}

export async function discoverApiBaseUrlWith({
  pageOrigin,
  storedApiBaseUrl,
  configuredApiBaseUrl,
  probe,
  persistApiBaseUrl
}) {
  const candidates = buildApiBaseUrlCandidates({
    pageOrigin,
    storedApiBaseUrl,
    configuredApiBaseUrl
  });

  for (const candidate of candidates) {
    try {
      if (await probe(candidate)) {
        if (persistApiBaseUrl) {
          await persistApiBaseUrl(candidate);
        }
        return candidate;
      }
    } catch {
      // Try the next candidate before surfacing a connectivity error.
    }
  }

  throw new Error(formatApiDiscoveryError(candidates));
}

export function createApiUrl(apiBaseUrl, path) {
  const normalizedBase = normalizeApiBaseUrl(apiBaseUrl);
  if (!normalizedBase) {
    throw new Error(`Invalid API base URL: ${String(apiBaseUrl)}`);
  }
  return new URL(path, `${normalizedBase}/`).toString();
}

export function formatApiFetchError(apiBaseUrl) {
  return `Unable to reach the Nibras API at ${apiBaseUrl}. Start \`npm run api:dev\` for local API access, start \`npm run proxy:dev\` for same-origin proxy access, or update \`.env\` and your tunnel URL.`;
}

export async function apiFetchWith({
  path,
  init = {},
  auth = false,
  discoverApiBaseUrl,
  fetchImpl,
  accessToken
}) {
  const apiBaseUrl = await discoverApiBaseUrl();
  const headers = new Headers(init.headers ?? undefined);
  if (auth && accessToken) {
    headers.set("authorization", `Bearer ${accessToken}`);
  }

  let response;
  try {
    response = await fetchImpl(createApiUrl(apiBaseUrl, path), {
      ...init,
      headers,
      credentials: auth ? "include" : init.credentials
    });
  } catch {
    throw new Error(formatApiFetchError(apiBaseUrl));
  }

  if (response.ok) {
    return response;
  }

  try {
    const payload = await response.clone().json();
    if (payload && typeof payload === "object" && typeof payload.error === "string" && payload.error) {
      throw new Error(payload.error);
    }
  } catch (error) {
    if (error instanceof Error && error.name !== "SyntaxError") {
      throw error;
    }
  }

  throw new Error(`HTTP ${response.status}`);
}

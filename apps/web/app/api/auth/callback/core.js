export function resolvePublicOrigin(headers, configuredWebBaseUrl) {
  const forwardedProto = headers.get('x-forwarded-proto') ?? 'https';
  const forwardedHost = headers.get('x-forwarded-host') ?? headers.get('host') ?? '';
  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }
  return configuredWebBaseUrl ?? 'https://nibras-web.fly.dev';
}

export function resolveCallbackRedirect(location, publicOrigin) {
  const fallback = new URL('/auth/complete', publicOrigin);
  if (!location) {
    return fallback.toString();
  }

  try {
    const resolved = new URL(location, publicOrigin);
    if (!['http:', 'https:'].includes(resolved.protocol)) {
      return fallback.toString();
    }
    return new URL(
      `${resolved.pathname}${resolved.search}${resolved.hash}`,
      `${publicOrigin}/`
    ).toString();
  } catch {
    return fallback.toString();
  }
}

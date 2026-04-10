import { NextRequest, NextResponse } from 'next/server';
import { resolveCallbackRedirect, resolvePublicOrigin } from './core.js';

export const dynamic = 'force-dynamic';

/**
 * OAuth callback handler — runs server-side to avoid cross-origin cookie issues.
 *
 * GitHub redirects here after the user authorises the app. We forward the
 * code + state to the real API backend (server-to-server, no browser cookies
 * involved), receive the session token via Set-Cookie, and re-issue that
 * cookie on the web domain (nibras-web.fly.dev) so all subsequent same-origin
 * API calls (via the /v1/* Next.js rewrite) can include it automatically.
 *
 * GitHub App callback URL should be:
 *   https://nibras-web.fly.dev/api/auth/callback
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  // Never use request.url directly here — it may contain the internal container address.
  const publicOrigin = resolvePublicOrigin(
    request.headers,
    process.env.NEXT_PUBLIC_NIBRAS_WEB_BASE_URL ?? 'https://nibras-web.fly.dev'
  );

  if (!code || !state) {
    return NextResponse.redirect(`${publicOrigin}/?auth=required`);
  }

  const apiInternalUrl = process.env.NIBRAS_API_INTERNAL_URL || 'https://nibras-api.fly.dev';

  const callbackUrl =
    `${apiInternalUrl}/v1/github/oauth/callback` +
    `?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`;

  let apiResponse: Response;
  try {
    apiResponse = await fetch(callbackUrl, {
      redirect: 'manual', // Don't follow — we need to capture Set-Cookie + Location
    });
  } catch {
    return NextResponse.redirect(`${publicOrigin}/?auth=required`);
  }

  // Expect a 302 redirect from the API with a Set-Cookie header
  const setCookie = apiResponse.headers.get('set-cookie');
  const location = apiResponse.headers.get('location');

  const response = NextResponse.redirect(resolveCallbackRedirect(location, publicOrigin));

  // Forward the session cookie from the API response onto the web domain.
  // Because this response comes from nibras-web.fly.dev, the browser stores
  // the cookie for that domain — making all /v1/* proxy calls send it automatically.
  if (setCookie) {
    response.headers.set('set-cookie', setCookie);
  }

  return response;
}

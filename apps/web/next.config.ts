import type { NextConfig } from 'next';
import path from 'path';

const apiBaseUrl = process.env.NEXT_PUBLIC_NIBRAS_API_BASE_URL ?? 'http://localhost:4848';
// Server-side only: the real API origin used for rewrites and API routes.
// Must differ from apiBaseUrl when apiBaseUrl is the web origin (to avoid circular rewrites).
const apiInternalUrl = process.env.NIBRAS_API_INTERNAL_URL ?? apiBaseUrl;

// External backends consumed by the ported student-dashboard pages. The browser
// fetches these directly (no Next.js rewrite), so each origin must appear in
// `connect-src` of the CSP header below.
const externalServiceOrigins: string[] = [
  process.env.NEXT_PUBLIC_NIBRAS_ADMIN_API_URL ?? 'https://nibras-backend.up.railway.app',
  process.env.NEXT_PUBLIC_NIBRAS_COMMUNITY_API_URL ?? 'https://nibras-backend.up.railway.app',
  process.env.NEXT_PUBLIC_NIBRAS_TRACKING_API_URL ?? 'https://nibras-api.fly.dev',
  process.env.NEXT_PUBLIC_NIBRAS_COMPETITIONS_API_URL ?? 'https://nibras-backend.up.railway.app',
  process.env.NEXT_PUBLIC_NIBRAS_RECOMMENDATION_API_URL ??
    'https://recommendationmodel-production-0f8e.up.railway.app',
]
  .map((value) => {
    try {
      return new URL(value).origin;
    } catch {
      return null;
    }
  })
  .filter((value): value is string => value !== null);

const connectSrc = ["'self'", apiBaseUrl, ...new Set(externalServiceOrigins)].join(' ');

// Security headers applied to every response.
// CSP allows 'unsafe-inline' for scripts/styles only in development; production
// tightens this further. Adjust img-src / connect-src if additional CDNs are used.
const securityHeaders = [
  // Prevent browsers from sniffing the MIME type of a response.
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Block clickjacking by denying framing by anyone other than same origin.
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  // Prevent full-page XSS attacks in legacy browsers (belt-and-suspenders).
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  // Limit referrer information sent to third parties.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Restrict browser feature/API access to only what the app needs.
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=()',
  },
  // Force HTTPS for 1 year, including sub-domains.
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains; preload',
  },
  // Content Security Policy:
  //   - default-src 'self': only load resources from same origin by default.
  //   - script-src: self + inline (needed by Next.js) + GitHub avatars worker script.
  //   - style-src: self + inline (CSS-in-JS / Next.js).
  //   - img-src: self + data URIs + GitHub avatar CDN.
  //   - connect-src: self + API base URL for fetch calls.
  //   - frame-src: youtube-nocookie.com for embedded video walkthroughs.
  //   - frame-ancestors 'none': belt-and-suspenders against framing.
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https://avatars.githubusercontent.com https://i.ytimg.com",
      `connect-src ${connectSrc}`,
      "font-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      'frame-src https://www.youtube-nocookie.com https://www.youtube.com',
      "frame-ancestors 'none'",
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  output: 'standalone',
  // Required for monorepo standalone builds to correctly trace and bundle
  // workspace dependencies from the repo root. Moved out of experimental in Next.js 15.
  outputFileTracingRoot: path.join(__dirname, '../../'),
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
        pathname: '/**',
      },
    ],
  },
  // Attach security headers to every page and API route.
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
  // Proxy all /v1/* API calls through Next.js so session cookies are same-origin.
  // Uses NIBRAS_API_INTERNAL_URL to avoid circular rewrites when NEXT_PUBLIC_NIBRAS_API_BASE_URL
  // is set to the web origin.
  async rewrites() {
    return [
      {
        source: '/v1/:path*',
        destination: `${apiInternalUrl}/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;

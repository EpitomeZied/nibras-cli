import type { NextConfig } from 'next';
import path from 'path';

const apiBaseUrl = process.env.NEXT_PUBLIC_NIBRAS_API_BASE_URL ?? 'http://localhost:4848';
// Server-side only: the real API origin used for rewrites and API routes.
// Must differ from apiBaseUrl when apiBaseUrl is the web origin (to avoid circular rewrites).
const apiInternalUrl = process.env.NIBRAS_API_INTERNAL_URL ?? apiBaseUrl;

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

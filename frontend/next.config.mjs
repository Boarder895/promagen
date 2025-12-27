// next.config.mjs
/** @type {import('next').NextConfig} */

/**
 * Host normalisation (optional):
 * If you deploy to a real domain and want `www.` → apex (308),
 * set NEXT_PUBLIC_SITE_URL=https://example.com in your env.
 */
const site = process.env.NEXT_PUBLIC_SITE_URL || '';

const redirects = async () => {
  if (!site || !/^https?:\/\/[^/]+$/i.test(site)) return [];
  const { hostname } = new URL(site);
  return [
    {
      source: '/:path*',
      has: [{ type: 'host', value: `www.${hostname}` }],
      destination: `${site}/:path*`,
      permanent: true, // platform may choose 308/301
    },
  ];
};

const nextConfig = {
  reactStrictMode: true,

  // Small hardening: avoid broadcasting framework info.
  poweredByHeader: false,

  // Only produce `.next/standalone` when explicitly requested.
  // Flip it on with: NEXT_STANDALONE=true pnpm build
  output: process.env.NEXT_STANDALONE === 'true' ? 'standalone' : undefined,

  // Fail CI if there are TS errors.
  typescript: {
    ignoreBuildErrors: false,
  },

  // We run ESLint via Husky + GitHub Actions.
  // Skip Next.js' built-in lint during `next build` to avoid
  // incompatibility with ESLint v9.
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Minor perf: keep this small and focused.
  experimental: {
    optimizePackageImports: ['react', 'react-dom'],
  },

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: 'localhost' },
    ],
  },

  async redirects() {
    return redirects();
  },
};

export default nextConfig;

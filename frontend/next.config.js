/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Only produce `.next/standalone` when explicitly requested.
  // This lets you keep normal dev/builds light, and flip it on via:
  //   pnpm run build:standalone   (which sets NEXT_STANDALONE=true)
  output: process.env.NEXT_STANDALONE === 'true' ? 'standalone' : undefined,

  // Ensure build fails on TS/ESLint errors in CI.
  typescript: { ignoreBuildErrors: false },
  eslint: { ignoreDuringBuilds: false },
};

module.exports = nextConfig;

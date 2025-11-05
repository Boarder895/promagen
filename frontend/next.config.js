/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Only produce `.next/standalone` when explicitly requested.
  // Flip it on with: NEXT_STANDALONE=true pnpm build
  output: process.env.NEXT_STANDALONE === 'true' ? 'standalone' : undefined,

  // Fail CI if there are TS or ESLint errors.
  typescript: { ignoreBuildErrors: false },
  eslint: { ignoreDuringBuilds: false },
};

module.exports = nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Keep lint visible in CI, but don't fail production builds on lint issues.
  // CI will run a separate lint job; build stays green.
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Leave TS errors blocking builds (safer). If you need to unblock temporarily,
  // flip to `true` and revert once fixed.
  typescript: {
    ignoreBuildErrors: false,
  },

  poweredByHeader: false,
};

module.exports = nextConfig;








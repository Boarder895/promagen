/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  eslint: {
    // Keep build green: lint runs in a separate CI job.
    ignoreDuringBuilds: true,
  },

  typescript: {
    // Keep TS errors blocking builds (safer). Flip to true only if you must unblock temporarily.
    ignoreBuildErrors: false,
  },

  poweredByHeader: false,
};

export default nextConfig;
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Keep build green: lint runs in a separate CI job.
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Keep TS errors blocking builds (safer). Flip to true only if you must unblock temporarily.
  typescript: {
    ignoreBuildErrors: false,
  },

  poweredByHeader: false,
};

export default nextConfig;









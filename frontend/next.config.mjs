/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true,
  },

  images: {
    // Allow next/image to load SVG flags from jsDelivr
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.jsdelivr.net' },
    ],
  },

  // Make uppercase /Flags requests resolve to /flags (case fix for old refs)
  async rewrites() {
    return [
      { source: '/Flags/:path*', destination: '/flags/:path*' },
    ];
  },
};

export default nextConfig;



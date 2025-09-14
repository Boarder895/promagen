/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },

  // Security + preview privacy headers
  async headers() {
    return [
      {
        // apply to every route
        source: "/:path*",
        headers: [
          // Force HTTPS in browsers that have seen the site (HSTS)
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },

          // TEMP while in preview: tell crawlers not to index
          // Remove this before public launch.
          { key: "X-Robots-Tag", value: "noindex, nofollow" }
        ],
      },
    ];
  },
};

module.exports = nextConfig;

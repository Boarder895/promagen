/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      // { protocol: "https", hostname: "cdn.yoursite.com" },
    ],
  },
  // Ensure linting runs during `next build`
  eslint: {
    ignoreDuringBuilds: false,
  },
};

export default nextConfig;








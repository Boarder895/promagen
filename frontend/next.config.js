/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // NOTE:
  // - No `output: 'export'`
  // - No custom `distDir` (use default .next)
  // - Keep this minimal to avoid CSP/dev header issues during build
};

module.exports = nextConfig;










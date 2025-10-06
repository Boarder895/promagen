/** @type {import('next').NextConfig} */
const nextConfig = {
  // keep eslint checks in CI/build
  eslint: { ignoreDuringBuilds: false },

  // security headers (baseline hardening)
  async headers() {
    const securityHeaders = [
      { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' }, // switch to 'DENY' if you never iframe this site
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      // Optional (enable once you’re ready): CSP Report-Only while tuning
      // { key: 'Content-Security-Policy-Report-Only', value: "default-src 'self'; img-src 'self' data: https:; script-src 'self' 'unsafe-inline' https:; style-src 'self' 'unsafe-inline' https:; connect-src 'self' https:;" },
    ];
    return [{ source: '/:path*', headers: securityHeaders }];
  },

  // nice-to-haves
  poweredByHeader: false,
  reactStrictMode: true,
  compress: true,

  // webpack fix: force a safe uniqueName to bypass bad package.json parsing edge-cases
  webpack: (config) => {
    if (!config.output) config.output = {};
    config.output.uniqueName = 'promagen-frontend';
    return config;
  },
};

module.exports = nextConfig;


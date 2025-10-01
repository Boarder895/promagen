/** @type {import('next').NextConfig} */

// Keep minimal since middleware now sets dynamic CSP.
// We still turn off the X-Powered-By header and enable strict mode.
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
};

module.exports = nextConfig;



// Centralised environment access with safe defaults.
// Add keys here as you grow; never read process.env directly elsewhere.

export const env = {
  siteUrl:
    (process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '') as string | undefined) ||
    'http://localhost:3000',
  siteName: process.env.NEXT_PUBLIC_SITE_NAME || 'Promagen',
  siteTagline:
    process.env.NEXT_PUBLIC_SITE_TAGLINE ||
    'AI creativity + market mood, elegantly visualised.',
};

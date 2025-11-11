import type { MetadataRoute } from 'next';
import { env } from '@/lib/env';

export default function robots(): MetadataRoute.Robots {
  const host = env.siteUrl;
  const allow = ['/'];
  const disallow = ['/admin', '/api'];
  return {
    rules: {
      userAgent: '*',
      allow,
      disallow,
    },
    sitemap: `${host}/sitemap.xml`,
    host,
  };
}

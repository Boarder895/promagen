import type { Metadata } from 'next';
import { env } from '@/lib/env';

export const baseTitle = env.siteName;
export const baseDescription =
  'AI prompt builder with 10,000+ phrases for 42+ image generators. Elo-ranked leaderboard and live financial market data.';

export function canonical(pathname = '/'): string {
  try {
    const url = new URL(pathname, env.siteUrl);
    return url.toString();
  } catch {
    return `${env.siteUrl}/`;
  }
}

/** Site-wide default metadata for Next.js Metadata API */
export function defaultMetadata(pathname = '/'): Metadata {
  const url = canonical(pathname);
  return {
    metadataBase: new URL(env.siteUrl),
    title: {
      default: `${baseTitle} — ${env.siteTagline}`,
      template: `%s · ${baseTitle}`,
    },
    description: baseDescription,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      url,
      siteName: env.siteName,
      title: `${baseTitle} — ${env.siteTagline}`,
      description: baseDescription,
      images: [{ url: '/og', width: 1200, height: 630, alt: `${env.siteName} preview` }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${baseTitle} — ${env.siteTagline}`,
      description: baseDescription,
      images: ['/og'],
    },
    robots: { index: true, follow: true },
    applicationName: env.siteName,
  };
}

'use client';

import Script from 'next/script';

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
const ANALYTICS_ENABLED = process.env.NEXT_PUBLIC_ANALYTICS_ENABLED !== 'false';

export function GoogleAnalytics() {
  // If there is no ID or analytics are disabled, do nothing.
  if (!ANALYTICS_ENABLED || !GA_MEASUREMENT_ID) {
    if (process.env.NEXT_PUBLIC_ANALYTICS_DEBUG === 'true') {
      // This only shows up in the browser console in debug mode.
      // eslint-disable-next-line no-console
      console.info(
        '[Analytics] GoogleAnalytics disabled – enabled=%s id=%s',
        ANALYTICS_ENABLED,
        GA_MEASUREMENT_ID,
      );
    }
    return null;
  }

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga-gtag-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){window.dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}', {
            page_path: window.location.pathname,
          });
        `}
      </Script>
    </>
  );
}

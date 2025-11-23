// frontend/src/components/analytics/google-analytics.tsx

'use client';

import Script from 'next/script';

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || 'G-QHJ7L4OPCM';

/**
 * GoogleAnalytics
 *
 * Injects the GA4 gtag.js script on every page.
 * Used from the root layout so it runs across the whole app.
 */
export function GoogleAnalytics() {
  if (!GA_MEASUREMENT_ID) {
    // Fail quietly if the ID is missing in some environment.
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

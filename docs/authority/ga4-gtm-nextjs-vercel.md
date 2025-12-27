GA4 & GTM Configuration in Next.js (Vercel)
Scope note (don’t power leaderboards from GA4)

GA4/GTM is for marketing/UX analytics and can be blocked by browsers/ad-blockers. Promagen leaderboard metrics like “Promagen Users” (30 days) and “Online Now” (30 minutes) must be computed server-side (Postgres + Cron / KV presence) and must render blank when stale/unavailable, rather than relying on GA4 data.

• Environment variables: Set these in your .env.local (and in Vercel). Next.js only exposes variables prefixed with NEXT*PUBLIC* to the browser[1]. For example:

# .env.local

NEXT*PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
NEXT_PUBLIC_GTM_ID=GTM-YYYYYYYYY
Ensure you restart/redeploy after adding them. Next.js only inlines vars prefixed with NEXT_PUBLIC* into the browser[1].
• Layout setup: Install the Next.js third-party library and include the GTM and GA components in your root layout. For example, in app/layout.tsx:

import { GoogleTagManager, GoogleAnalytics } from '@next/third-parties/google'
import { publicConfig } from '@/lib/config/public'

export default function RootLayout({ children }: { children: React.ReactNode }) {
return (

<html lang="en">
<GoogleTagManager gtmId={publicConfig.gtmId} />
<body>{children}</body>
<GoogleAnalytics gaId={publicConfig.gaMeasurementId} />
</html>
)
}
This injects GTM and GA4 scripts on every page[2][3]. If you are not using @next/third-parties/google, read the GA Measurement ID via publicConfig (backed by NEXT_PUBLIC_GA_MEASUREMENT_ID) and load gtag.js manually (do not read process.env in components).
• Avoid double loading: If you use GTM as the central hub, do not also load the GA4 snippet separately, as this causes duplicate hits[4]. In a GTM-driven setup, include only the GTM snippet (above) and configure the GA4 tag inside GTM (see next section). Likewise, if you load GA4 directly (with GoogleAnalytics), you should remove any separate GTM snippet to prevent sending each pageview twice[4].
Browser Privacy and Ad-Blockers
• Ad blocker extensions: Users’ Chrome extensions (AdBlock, uBlock, etc.) will block GA/GTM scripts. In fact, popular blockers explicitly prevent Google Analytics scripts[5]. Test tracking with all extensions disabled or in a clean profile. Similarly, privacy-focused browsers like Brave block Google Analytics by default[6]. Either whitelist your site or test in a default Chrome browser to see data flow.
• Third-party cookies & Incognito: Chrome’s settings (and some enterprise policies) may block cookies or scripts. By default, Chrome blocks third-party cookies in Incognito mode[7]. Since GA4 may rely on cookies (or privacy sandbox APIs), be sure to allow cookies and test in a regular window. In Incognito, disable “Block third-party cookies” or test in a normal window. You can check Chrome’s Settings > Privacy and security to ensure cookies from google.com, googletagmanager.com, etc., are not blocked.
• Testing without interference: The easiest test is to open a fresh Incognito (with no extensions) or a new Chrome profile with no plugins. Then visit your site and use DevTools (see below). If hits appear there, the setup is correct and any missing data in your normal browser was due to blocking.
Configuring GA4 Tag in Google Tag Manager

1. Create a GA4 tag in GTM: In Google Tag Manager (tagmanager.google.com), open your container and go to Tags > New. Choose Tag Configuration > Google Tag (this is the GA4 “Google tag”). Paste your GA4 Measurement ID (the G-XXXX ID) into the Tag ID field[8].
2. Set the trigger: Under Triggering, select Initialization – All Pages (or All Pages) so the tag fires on every page load[9]. (This sends the default page_view event. You can later create additional GTM tags for custom events.)
3. Preview in GTM: Click Preview in GTM and enter your site’s URL. GTM’s Debug window will open. Browse your site; you should see the new GA4 tag fire exactly once per page load (no errors)[9]. Inspect the GTM Debug console to confirm the “Google Tag” for your GA4 property appears under Tags Fired.
4. Publish container: If everything looks correct in preview, go back to GTM and click Submit > Publish to make the changes live. The GA4 tag is now active on your site via GTM. (If using GTM alone, you do not need the direct GA4 script, as GTM will inject it.)
   Verifying Events & Real-Time Data
   • GTM Debug & GA DebugView: As you interact with the site, GTM Preview/Debug and GA4’s DebugView show events in real time. To use DebugView in GA4, enable debug mode (e.g. use Tag Assistant preview or add {'debug_mode':true} to your gtag('config',…) or tag settings). GA4’s DebugView (Admin > DebugView) will then display the collected events live[10]. This lets you confirm that your pageview (and any custom) events are arriving properly.
   • Realtime report: In Google Analytics, open Reports > Realtime. You should see active users and the count of pageviews in the last 30 minutes. If your site is receiving hits, this will jump up as you reload or navigate your pages. (Remember GA4 dashboards can be up to a 30-second delay, but usually show events quickly.)
   • Event tracking: If you have specific events (e.g. button clicks sent via sendGAEvent or sendGTMEvent), trigger them in the Preview mode or real site. You should see them listed in the GTM Debug console and in GA4 under Realtime events or DebugView.
   Best Practices: Content, Engagement & Monetization
   • Use Engagement metrics: GA4’s new metrics give insight into user engagement better than the old bounce rate. For example, GA4’s Engagement Rate measures the percentage of sessions where a user viewed ≥2 pages, stayed >10 seconds, or triggered a conversion[11]. Monitor Engaged Sessions and Engagement Rate in your reports to see which content truly holds attention. (E.g. long scroll depth or video plays contribute to engagement even if bounce rate was previously high.)
   • Track meaningful events: Set up event tracking for key interactions – pageviews (automatic), scrolls, video plays, form submissions, clicks on CTAs, etc. In GTM you can create additional tags for scroll depth, outbound link clicks, etc. Then mark any important events (like newsletter signup or purchase) as Conversions in GA4. This helps measure your marketing funnel (content → sign-up/lead).
   • UTM and campaign tracking: Whenever promoting your site (e.g. linking from YouTube, social media, email), use UTM parameters on those links. GA4’s Acquisition reports will then show which campaigns/sources drive traffic and conversions. For YouTubers, put UTM-tagged links in video descriptions or a “link in bio” so you can attribute any site visits or sales back to the video.
   • Monetization setup: If you sell products or earn ad revenue, configure GA4’s monetization features. For ecommerce, fire GA4 purchase events so revenue shows up in Monetization > Ecommerce. If you run ads (AdSense/AdMob), link your AdSense account to GA4; then AdSense data (e.g. ad clicks/impressions/revenue) appear under Monetization > Publisher ads[12]. This lets you correlate traffic sources and content with ad revenue.
   • Analyze & iterate: Use GA4 Explorations (analysis) to dig deeper – for example, create funnels or segment analyses (e.g. “views of top blog -> time on page -> sign-up”). Identify high-engagement pages (long avg. engagement time) vs low-engagement. For content creators and entrepreneurs, iterate by focusing on topics with strong conversion rates. Consider also setting up A/B tests (via third-party tools or server-side experiments) informed by GA4 data.
   Next.js and Vercel Considerations
   • Next.js config: No special GA config is required in next.config.js by default. However, in Next 13+ the App Router’s Strict Mode can cause scripts to execute twice in development. If you encounter duplicate hits, try disabling React strict mode temporarily: in next.config.js use module.exports = { reactStrictMode: false }[13]. (This is purely for debugging; you can re-enable it later.)
   • Dependencies: Ensure any needed packages are installed. For example, if you use the Next.js Third-Party components, run npm install @next/third-parties. Likewise, Next’s built-in next/script component is available without extra install. No changes to package.json are typically needed beyond adding these if you use them.
   • Vercel environment: Set the same env var names (NEXT_PUBLIC_GA_MEASUREMENT_ID, NEXT_PUBLIC_GTM_ID, NEXT_PUBLIC_ANALYTICS_ENABLED, NEXT_PUBLIC_ANALYTICS_DEBUG). After setting them, redeploy so the variables take effect.
   • No other Vercel settings: Vercel does not require any special analytics settings (unlike its own Vercel Analytics, which is separate). Just ensure your environment variables are correct and your build uses the public prefix as above.

### Promagen note: Vercel Pro guardrails (don’t let analytics create spend surprises)

- Canonical platform playbook: `C:\Users\Proma\Projects\promagen\docs\authority\vercel-pro-promagen-playbook.md`
- Product monetisation SSOT (free vs paid):
  `C:\Users\Proma\Projects\promagen\docs\authority\paid_tier.md`

  GA4/GTM events must not “invent” tiers. If you track upgrade/sign-in events, the meaning of “paid feature” must match `paid_tier.md`.

### Promagen note: Vercel Pro guardrails (don’t let analytics create spend surprises)

- Canonical platform playbook: `C:\Users\Proma\Projects\promagen\docs\authority\vercel-pro-promagen-playbook.md`
- If you ever add server-side tracking endpoints (e.g. `/api/events`), treat them as spend-bearing routes:
  - Protect with Vercel WAF rate limiting.
  - Add Spend Management thresholds before enabling in production.
  - Make responses CDN-cacheable where safe (avoid compute-per-hit).
    Debugging with Chrome DevTools
    • Network tab checks: Open Chrome DevTools (F12) and go to Network. Reload the page. In the filter box, type gtag, gtm.js, or collect. You should see:
    • A request to www.googletagmanager.com/gtm.js?id=GTM-XXXX – this shows the GTM container script loaded.
    • A request to googletagmanager.com/gtag/js?id=G-XXXXX – this is the GA4 script (if used directly).
    • Critical: look for collect?v=2 in the list. This is the GA4 data-collection endpoint[14]. Clicking it shows your Measurement ID in the query string, confirming a hit was sent. If no collect?v=2 appears after loading a page, GA4 isn’t firing.
    • Console errors: Check the DevTools Console for any errors (e.g. failed to load script, blocked by CSP or adblock). You can also use the Google Analytics Debugger extension, which logs GA hits to the console. Similarly, use Tag Assistant (Preview mode) to see a summary of fired tags.
    • Cookies and storage: In DevTools Application > Cookies, verify a cookie named \_ga exists on your domain (GA4 sets it after a pageview). Its presence means GA’s script ran. If cookies are missing, something blocked GA.
    • Verifying in GA: After triggering events on your site, the easiest check is GA4’s Realtime or DebugView (see above). For a quick network sanity check, seeing the collect calls is usually sufficient proof that data is leaving the browser.
    Sources: This guide was built using the official Next.js docs for analytics (Third-Party libraries for GTM/GA)[2][3], Google Tag Manager’s own instructions[15], analytics tutorials[16][17][14], and reports on common blocking issues[6][5] and GA4 best practices[10][11][12]. These references illustrate how GTM acts as a “hub” (with GA4 as a destination)[16] and how to verify end-to-end tracking.
   Debugging with Chrome DevTools
   • Network tab checks: Open Chrome DevTools (F12) and go to Network. Reload the page. In the filter box, type gtag, gtm.js, or collect. You should see:
   • A request to www.googletagmanager.com/gtm.js?id=GTM-XXXX – this shows the GTM container script loaded.
   • A request to googletagmanager.com/gtag/js?id=G-XXXXX – this is the GA4 script (if used directly).
   • Critical: look for collect?v=2 in the list. This is the GA4 data-collection endpoint[14]. Clicking it shows your Measurement ID in the query string, confirming a hit was sent. If no collect?v=2 appears after loading a page, GA4 isn’t firing.
   • Console errors: Check the DevTools Console for any errors (e.g. failed to load script, blocked by CSP or adblock). You can also use the Google Analytics Debugger extension, which logs GA hits to the console. Similarly, use Tag Assistant (Preview mode) to see a summary of fired tags.
   • Cookies and storage: In DevTools Application > Cookies, verify a cookie named \_ga exists on your domain (GA4 sets it after a pageview). Its presence means GA’s script ran. If cookies are missing, something blocked GA.
   • Verifying in GA: After triggering events on your site, the easiest check is GA4’s Realtime or DebugView (see above). For a quick network sanity check, seeing the collect calls is usually sufficient proof that data is leaving the browser.
   Sources: This guide was built using the official Next.js docs for analytics (Third-Party libraries for GTM/GA)[2][3], Google Tag Manager’s own instructions[15], analytics tutorials[16][17][14], and reports on common blocking issues[6][5] and GA4 best practices[10][11][12]. These references illustrate how GTM acts as a “hub” (with GA4 as a destination)[16] and how to verify end-to-end tracking.

---

[1] Guides: Environment Variables | Next.js
https://nextjs.org/docs/app/guides/environment-variables
[2] [3] Guides: Third Party Libraries | Next.js
https://nextjs.org/docs/app/guides/third-party-libraries
[4] [16] Optimize Google Analytics with Tag Manager in Next.js 15 | Build with Matija
https://www.buildwithmatija.com/blog/nextjs-google-analytics-tag-manager-guide
[5] Does Adblock Block Google Analytics? How It Impacts Your Website's Data Tracking
https://www.blobr.io/how-to-guides/does-adblock-block-google-analytics-how-it-impacts-your-website-s-data-tracking
[6] Does Brave Browser Block Google Analytics Tracking?
https://www.blobr.io/how-to-guides/does-brave-browser-block-google-analytics-tracking
[7] Delete, allow, and manage cookies in Chrome - Computer - Google Chrome Help
https://support.google.com/chrome/answer/95647?hl=en&co=GENIE.Platform%3DDesktop
[8] [9] [17] How to Install Google Analytics 4 in 2025 (3 Ways)
https://www.analyticsmania.com/post/how-to-install-google-analytics-4-with-google-tag-manager/
[10] Monitor events in DebugView - Analytics Help
https://support.google.com/analytics/answer/7201382?hl=en
[11] Engagement Rate in GA4: 15 Ways to Improve Engagement Rates | Orbit Media Studios
https://www.orbitmedia.com/blog/website-engagement-rate-ga4/
[12] Connect Google AdSense to Google Analytics - Analytics Help
https://support.google.com/analytics/answer/13610380?hl=en
[13] Recent changes in Google Tag Manager do not send data : r/GoogleTagManager
https://www.reddit.com/r/GoogleTagManager/comments/1nd5wvp/recent_changes_in_google_tag_manager_do_not_send/
[14] How to Check if Google Analytics is Installed (8 ways) [2025]
https://www.analyticsmania.com/post/check-if-google-analytics-is-installed/
[15] Set up Google Analytics in Tag Manager - Tag Manager Help
https://support.google.com/tagmanager/answer/9442095?hl=en
Below are the three files you asked for, with everything wired for direct GA4 (no GTM to double-count things) using your correct Measurement ID G-QHJ7L4OPCM.
Nothing needs changing in any JSON file for analytics.

---

1. src/components/analytics/google-analytics.tsx
   'use client';

import Script from 'next/script';
import { publicConfig } from '@/lib/config/public';
const GA_MEASUREMENT_ID =
publicConfig.gaMeasurementId;

/\*\*

- GoogleAnalytics
-
- Injects the GA4 gtag.js script on every page.
- Used from the root layout so it runs across the whole app.
  \*/
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
{`          window.dataLayer = window.dataLayer || [];
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

---

src/app/layout.tsx
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

import { PauseProvider } from '@/state/pause';
import ProvenanceFooter from '@/components/core/provenance-footer';
import ErrorBoundary from '@/components/error-boundary';
import { GoogleAnalytics } from '@/components/analytics/google-analytics';
import { publicConfig } from '@/lib/config/public';
const SITE = publicConfig.siteUrl ?? 'http://localhost:3000';

export const metadata: Metadata = {
title: 'Promagen',
description: 'Calm, precise, and fast.',
metadataBase: new URL(SITE),
robots: { index: true, follow: true },
alternates: { canonical: '/' },
openGraph: {
title: 'Promagen',
description: 'Calm, precise, and fast.',
type: 'website',
url: SITE,
images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Promagen' }],
siteName: 'Promagen',
},
twitter: {
card: 'summary_large_image',
title: 'Promagen',
description: 'Calm, precise, and fast.',
images: ['/og.png'],
},
};

export default function RootLayout({ children }: { children: ReactNode }) {
return (

<html lang="en" className="h-full">
{/_ Background + gradient come from globals.css to keep a single source of truth _/}
<body className="min-h-dvh antialiased text-slate-900">
<PauseProvider>
<ErrorBoundary>
{children}
<div className="mx-auto w-full max-w-7xl px-4 md:px-6">
<ProvenanceFooter />
</div>
</ErrorBoundary>
</PauseProvider>

        {/* Global analytics for every page */}
        <GoogleAnalytics />
      </body>
    </html>

);
}

---

.env.local
Here’s a safe template. Keep any other existing lines you already have (API keys etc.) and just make sure these two are present and correct:

# Public site URL used in metadata

NEXT_PUBLIC_SITE_URL=https://promagen.com

# Google Analytics 4 Measurement ID (must match GA exactly)

NEXT_PUBLIC_GA_MEASUREMENT_ID=G-QHJ7L4OPCM
Do the same variable in Vercel project settings:
• Name: NEXT_PUBLIC_GA_MEASUREMENT_ID
• Value: G-QHJ7L4OPCM
• Environment: Production (and Preview if you like)
Then redeploy.

---

Chrome settings (quick version)
On the machine you use to test:

1. Use Chrome normal window (not Incognito) or Incognito with no extensions.
2. Temporarily disable ad-block / privacy extensions – they happily kill GA.
3. In DevTools → Network:
   o Filter gtag → you should see
   https://www.googletagmanager.com/gtag/js?id=G-QHJ7L4OPCM
   o Filter collect → you should see requests to
   https://region1.google-analytics.com/g/collect?...tid=G-QHJ7L4OPCM...
   If those /collect hits appear, your code is doing its job. Then GA’s Realtime and DebugView will show you as an active user.

---

About that Tag Manager link
The Tag Manager URL you pasted is tied to the old, wrong ID G-QHJ7L40PCM (zero). Your app is now using the correct ID G-QHJ7L4OPCM directly, so:
• GA4 will work without GTM.
• The “guided merge / tag not detected” wizard can be ignored for now – it’s looking at the wrong ID.
Once we see data flowing happily into GA Realtime, we can later bolt GTM on top (carefully, so it doesn’t double-count).
For this push: paste these three files in full, commit, push, let Vercel deploy, then do the Network + Realtime checks. That’s the clean, working baseline you wanted.
You said:
List the differences from before the deep research was conducted.
Good question – let’s diff the universe so you can see exactly what changed.
I’ll break it into code, IDs/properties, and tooling/behaviour.

---

Are there any helper files available to help this process?
Short answer: nothing “magic” comes out of the box, but we can give you one small helper file that makes using GA in the app a lot nicer and safer.
Right now you’ve got:
• src/components/analytics/google-analytics.tsx – injects GA4
• src/app/layout.tsx – mounts it everywhere
• .env.local – holds NEXT_PUBLIC_GA_MEASUREMENT_ID
That’s enough to send data.
What you’re missing is a tiny helper so you’re not sprinkling window.gtag('event', ...) all over the place.

---

How to use it in the app
Example: in a provider card click handler:
// e.g. src/components/providers/provider-card.tsx
'use client';

import { trackEvent } from '@/lib/analytics/ga';

type Props = {
providerId: string;
name: string;
onClick?: () => void;
};

export function ProviderCard({ providerId, name, onClick }: Props) {
const handleClick = () => {
trackEvent('provider_click', {
provider_id: providerId,
provider_name: name,
});

    onClick?.();

};

return (
<button type="button" onClick={handleClick}>
{name}
</button>
);
}
Now every provider click is a nice GA4 event with clear params.
You can do the same for:
• provider_outbound when they click “Go to provider site”
• prompt_builder_open when they open the builder
• finance_toggle when they enable FX/commodities/crypto in the studio
All using the same trackEvent helper.

---

---

How this helps you specifically
For Promagen, this helper file gives you:
• A single analytics “choke point”: if you ever change GA provider, you change one file.
• Consistent naming of events across the whole app.
• Easy mapping between “things that happen in the UI” and “things you can analyse in GA”.
Later, if you decide to add GTM on top, you can keep the same trackEvent API and just swap the internals to push to dataLayer instead of window.gtag – again, one file, not a repo-wide hunt.
So: yes, there is now a helper file available – we’ve just designed it to do exactly what you need without adding more noise.
Any extras or improvements to add?
Yep, there are a couple of nice “quality of life” upgrades we can bolt on now:

1. Make analytics easy and safe to call from anywhere (trackEvent / trackPageView).
2. Add type-safe payloads so you don’t accidentally send junk to GA.
3. Add a master on/off + debug flag via env vars.
4. Optional: a tiny hook so your components just call const { trackEvent } = useAnalytics().
   Below are full files you can drop straight in.

---

import { publicConfig } from '@/lib/config/public';
src/lib/analytics/ga.ts
Replace your existing ga.ts (or create it if it doesn’t exist) with this full file:
// src/lib/analytics/ga.ts

// Keep window.gtag typed and safe to call.
declare global {
interface Window {
gtag?: (...args: unknown[]) => void;
}
}

/\*\*

- Toggle analytics from env:
-
- - NEXT_PUBLIC_ANALYTICS_ENABLED
- - undefined / anything except "false" → enabled
- - "false" → disabled
- const ANALYTICS_ENABLED = publicConfig.analyticsEnabled;

- - const ANALYTICS_DEBUG = publicConfig.analyticsDebug;

    const ANALYTICS_ENABLED =
    process.env.NEXT_PUBLIC_ANALYTICS_ENABLED !== 'false';
    const ANALYTICS_DEBUG =
    process.env.NEXT_PUBLIC_ANALYTICS_DEBUG === 'true';

export type AnalyticsEventName =
| 'provider_click'
| 'provider_outbound'
| 'prompt_builder_open'
| 'finance_toggle'
| 'nav_click'
| 'page_view_custom';

export interface AnalyticsEventPayloads {
provider_click: {
provider_id: string;
provider_name?: string;
};
provider_outbound: {
provider_id: string;
provider_name?: string;
href?: string;
};
prompt_builder_open: {
provider_id: string;
location?: 'leaderboard' | 'providers_page' | 'deeplink';
};
finance_toggle: {
widget: 'fx' | 'commodities' | 'crypto';
enabled: boolean;
};
nav_click: {
label: string;
href: string;
};
page_view_custom: {
page_path: string;
};
}

// Fallback to a generic record if you pass a name that isn't in AnalyticsEventPayloads.
export type AnalyticsEventParamsMap = {
[K in AnalyticsEventName]: AnalyticsEventPayloads[K];
};

export type AnalyticsEventParams<K extends AnalyticsEventName> =
AnalyticsEventParamsMap[K] | Record<string, unknown>;

/\*\*

- trackEvent
-
- Thin wrapper around window.gtag('event', ...).
- - No-op on the server.
- - Respects NEXT_PUBLIC_ANALYTICS_ENABLED.
- - Logs to console when NEXT_PUBLIC_ANALYTICS_DEBUG === "true".
    \*/
    export function trackEvent<K extends AnalyticsEventName>(
    name: K,
    params?: AnalyticsEventParams<K>,
    ): void {
    if (!ANALYTICS_ENABLED) {
    if (ANALYTICS_DEBUG) {
    // eslint-disable-next-line no-console
    console.info('[analytics] disabled:', name, params);
    }
    return;
    }

if (typeof window === 'undefined') {
return;
}

if (typeof window.gtag !== 'function') {
if (ANALYTICS_DEBUG) {
// eslint-disable-next-line no-console
console.info('[analytics] gtag not ready:', name, params);
}
return;
}

if (ANALYTICS_DEBUG) {
// eslint-disable-next-line no-console
console.info('[analytics] event:', name, params);
}

window.gtag('event', name, params ?? {});
}

/\*\*

- trackPageView
-
- Optional helper for virtual page views or SPA-style transitions.
- Note: GA4 already tracks normal page_view from your config call,
- this is for cases where you want extra, custom page_view events.
  \*/
  export function trackPageView(path: string): void {
  if (!ANALYTICS_ENABLED) {
  if (ANALYTICS_DEBUG) {
  // eslint-disable-next-line no-console
  console.info('[analytics] page_view skipped (disabled):', path);
  }
  return;
  }

if (typeof window === 'undefined') return;
if (typeof window.gtag !== 'function') return;

if (ANALYTICS_DEBUG) {
// eslint-disable-next-line no-console
console.info('[analytics] page_view:', path);
}

window.gtag('event', 'page_view', {
page_path: path,
});
}

/\*\*

- trackOutboundLink
-
- Convenience helper for outbound links (affiliate clicks etc.).
- You can call this in an onClick before navigating away.
  \*/
  export function trackOutboundLink(
  href: string,
  extra?: Partial<AnalyticsEventPayloads['provider_outbound']>,
  ): void {
  trackEvent('provider_outbound', {
  href,
  ...(extra ?? {}),
  });
  }
  What this gives you:
  • A single, type-safe place for all event names and their parameters.
  • Ability to turn analytics off via env (NEXT_PUBLIC_ANALYTICS_ENABLED="false") – useful for local dev or certain review builds.
  • Optional debug logging via env (NEXT_PUBLIC_ANALYTICS_DEBUG="true") so you can see events in the console while building.
  • A tidy helper for outbound clicks.

---

src/hooks/use-analytics.ts
If you want a nice API from components, add this full file:
// src/hooks/use-analytics.ts
'use client';

import { useCallback } from 'react';
import {
trackEvent as rawTrackEvent,
trackPageView as rawTrackPageView,
type AnalyticsEventName,
type AnalyticsEventParams,
} from '@/lib/analytics/ga';

export function useAnalytics() {
const trackEvent = useCallback(
<K extends AnalyticsEventName>(
name: K,
params?: AnalyticsEventParams<K>,
) => {
rawTrackEvent(name, params);
},
[],
);

const trackPageView = useCallback((path: string) => {
rawTrackPageView(path);
}, []);

return {
trackEvent,
trackPageView,
};
}
Then in any client component:
'use client';

import { useAnalytics } from '@/hooks/use-analytics';

export function SomeButton() {
const { trackEvent } = useAnalytics();

return (
<button
type="button"
onClick={() =>
trackEvent('nav_click', { label: 'Home', href: '/' })
} >
Home
</button>
);
}
You don’t have to use the hook if you don’t fancy it – you can always import trackEvent directly from @/lib/analytics/ga – but having it as a hook plays nicely with your existing “client component” pattern.

---

Env extras (light touch)
In addition to the GA ID you already have, you can add these two lines to .env.local and to Vercel env if you like the new switches:

# Optional: turn analytics off globally (for certain environments)

NEXT_PUBLIC_ANALYTICS_ENABLED=true

# Optional: log all analytics calls to the console

NEXT_PUBLIC_ANALYTICS_DEBUG=false
Then:
• Set NEXT_PUBLIC_ANALYTICS_DEBUG=true on localhost if you want verbose logs.
• Set NEXT_PUBLIC_ANALYTICS_ENABLED=false in any environment where you want zero tracking without touching code.

---

So in summary:
• Your existing GA injection (google-analytics.tsx + layout.tsx + env ID) stays as is.
• You bolt on src/lib/analytics/ga.ts and optionally src/hooks/use-analytics.ts.
• That gives you a clean API, stronger typing, and proper on/off + debug controls, all without changing the actual measurement wiring you just fixed.
How to actually use this data once GA starts showing it
Once GA’s had its little sulk and starts logging, here’s how you milk it for Promagen:
a) Find out who is turning up and from where
• Reports → Acquisition → User acquisition
o Which channels (organic search, direct, social) are bringing people.
o Which countries care most.
• Landing pages (Engagement → Pages and screens)
o Which page people first see when they land.
o You’ll mostly see / at first – later, you’ll see /providers/... and /providers/.../prompt-builder.
Use this to decide:
• Where to put effort in SEO (which pages want better titles / copy).
• Whether your LinkedIn / YouTube pushes actually bring traffic.
b) Check whether the homepage layout is doing its job
• Click into the home page in Pages and screens.
• Look at:
o Average engagement time per user – do people sit and stare at your beautiful ribbon?
o Scroll depth (if we later add a scroll event) – do they reach the provider leaderboard?
If you later A/B tweak the layout (e.g. different hero text, different ribbon emphasis), you can compare engagement.
c) Track serious actions (later on)
This is where money lives:
• Click‐throughs to provider sites (/providers/... → external link).
• “Upgrade to paid” or “Start free trial” clicks.
• Whatever “money button” you decide.
We’d add little gtag('event', 'select_provider', { provider_id: 'midjourney' }) style events behind the buttons so you can see:
• Which providers get most attention.
• Which parts of the page feed into that (paths, referrers).
We’ll wire those once you’re happy GA is logging basic page views.
Set all my src/components files up like this, “Nice, this is the fun part – this is where Promagen stops being “a pretty thing on the internet” and starts being a measuring machine.
Let’s unpack what that trackEvent pattern is doing for you and how to lean on it properly.

---

1. What trackEvent actually is
   The helper we wired in lib/analytics/ga.ts is basically:
   • A thin wrapper around window.gtag('event', …)
   • With some safety (no crashes on the server / when GA is missing / ad-blocker etc.)
   • With a stable API you control: trackEvent(name, params?)
   So instead of littering your app with:
   window.gtag('event', 'provider_click', { provider_id, provider_name });
   everywhere (which is brittle, untyped and annoying), you:
   • Call trackEvent('provider_click', { provider_id, provider_name }) from components.
   • Keep all the low-level GA4 wiring in one file (ga.ts).
   If you ever:
   • Change measurement ID
   • Add a second analytics tool
   • Move to GTM / dataLayer
   …you touch one file, not your whole repo.

---

2.  Using it in a component (the ProviderCard example)
    In that example:
    export function ProviderCard({ providerId, name, onClick }: Props) {
    const handleClick = () => {
    trackEvent('provider_click', {
    provider_id: providerId,
    provider_name: name,
    });

        onClick?.();

    };

return (
<button type="button" onClick={handleClick}>
{name}
</button>
);
}
What actually happens when a user clicks:

1. handleClick runs.
2. trackEvent sends a GA4 event:
   o event name: "provider_click"
   o event params: { provider_id: 'midjourney', provider_name: 'Midjourney' }
3. GA4 receives this and stores it under Engagement → Events.
4. Later, you can:
   o See “how many times did people click Midjourney vs DALL·E vs Stable Diffusion?”
   o Build funnels like: “homepage view → provider_click → provider_outbound”.
   The important constraints:
   • The component must be a client component ('use client'; at the top), because it’s dealing with click handlers and window.
   • You don’t need to import window anywhere yourself – trackEvent takes care of that internally.

---

3. Other events that are perfect for Promagen
   Exactly the same pattern works for the rest of your UX.
   a) provider_outbound
   When they hit “Go to provider site” (your affiliate money button):
   • Event name: provider_outbound
   • Params you probably care about:
   o provider_id
   o provider_name
   o destination_url
   o tier (free/paid, if relevant)
   Later you can compare:
   • Total provider_click vs provider_outbound
   → “How many people open the card vs actually click through?”

---

b) prompt_builder_open
When they open /providers/[id]/prompt-builder:
• You can either:
o Fire it in the card click if the click always leads to the builder, or
o Fire it in a useEffect inside the prompt builder page.
Event idea:
• Name: prompt_builder_open
• Params:
o provider_id
o provider_name
o tier (free/paid)
o has_finance_widgets (true/false)
That gives you “Who actually uses the studio, not just lands on the homepage”.

---

c) finance_toggle
For the paid studio mini-widgets:
• Event name: finance_toggle
• Params:
o asset_class: 'fx' | 'commodities' | 'crypto'
o state: 'on' | 'off'
o provider_id (which AI provider’s studio they’re in)
So in your toggle handler you’d do:
trackEvent('finance_toggle', {
asset_class: 'fx',
state: enabled ? 'on' : 'off',
provider_id: providerId,
});
Now you can answer questions like:
• “Do people actually want FX in the prompt builder, or is it mostly crypto?”
• “Do paid users of Provider X behave differently from Provider Y?”

---

4. Why this pattern is powerful for you
   For Promagen specifically, this gives you three big wins:
   4.1 One “choke point” for analytics
   All GA-specific nastiness lives in one file (ga.ts):
   • How page views are fired.
   • How events are sent.
   • What happens if window.gtag is missing.
   • Whether analytics is disabled in local dev.
   So:
   • Want to disable analytics in dev but keep it in preview?
   → Change one condition in that file.
   • Want to mirror events into a second tool (e.g. PostHog/Amplitude) later?
   → Add a second call inside trackEvent.
   4.2 Consistent naming across the app
   Because every event goes through trackEvent, you can:
   • Decide on a tiny vocabulary:
   o provider_click
   o provider_outbound
   o prompt_builder_open
   o finance_toggle
   o fx_pair_select
   o tier_change
   • Stick to snake_case, predictable param names (provider_id, not ProviderID in one place and id in another).
   Later, when you’re in GA:
   • It’s obvious what each event is.
   • You don’t end up with a graveyard of nonsense like click_1, homepage_button, outbound_thingy.
   4.3 Future-proofing (GTM or different analytics)
   If one day you say:
   “Right, GA is annoying, I want GTM with a dataLayer”
   …you can:
   • Keep the public API the same: trackEvent('provider_click', {...}).
   • Change the internals of trackEvent to:
   o window.dataLayer.push({ event: name, ...params }), or
   o Send events to both GA and something else.
   Your components and tests don’t care – they talk to your helper, not straight to Google.

---

5. How to make this actually useful in GA4
   Once events are flowing, there are two extra steps inside GA to make the data sing:
1. Mark key events as conversions
   In GA4:
   o Admin → Data display → Events (or similar, GA keeps renaming)
   o Find provider_outbound, prompt_builder_open.
   o Toggle them as Conversions.
   Now you can see “which traffic sources lead to people who actually click out to providers / use the studio”.
1. Turn important parameters into custom dimensions
   For things like provider_id, asset_class, tier:
   o Admin → Custom definitions → Custom dimensions.
   o Create dimensions that read from event parameters with those names.
   Then you can slice reports by:
   o Provider
   o Asset class
   o Tier
   Without that, GA just stores the parameters but doesn’t let you filter / break down by them.

---

6. How I’d roll it out, step-by-step
   In Promagen, a sensible order:
1. Homepage provider table
   o Add provider_click to the card/button that opens provider detail.
1. Provider detail
   o Add provider_outbound to the “Go to provider site” link/button.
   o Add prompt_builder_open to the “Open prompt builder” button (if there is one).
1. Prompt builder studio
   o On page load: prompt_builder_open (if not already fired).
   o On each finance toggle: finance_toggle.
1. Then go into GA and:
   o Mark conversions.
   o Create a few custom dimensions.
   At that point, your beautiful UI is not just pretty – it’s a lab experiment telling you which bits are making you money.
   Later on, when we start wiring proper API providers and paid tiers, we can extend this same pattern to subscription, trial, and premium-feature usage.”

# GA4 & GTM Configuration in Next.js (Vercel)

**Last updated:** 10 April 2026  
**Updated by:** Analytics Consolidation Build (analytics-build-plan-v1.3-FINAL.md)

---

## Analytics Consolidation (April 2026)

### What changed

Promagen's analytics layer was consolidated from four overlapping systems down to **one centralised module**: `src/lib/analytics/events.ts`.

**Deleted files (dead code removed):**
- `src/lib/analytics/index.ts`
- `src/lib/analytics/analytics.ts`
- `src/lib/analytics/ga.ts`
- `src/lib/analytics/providers.ts`
- `src/lib/analytics/nav.ts`
- `src/lib/analytics/finance.ts`

**Single source of truth:**
`src/lib/analytics/events.ts` is now the only analytics module. It contains:
- The `AnalyticsEventName` type catalogue (all event names)
- The `AnalyticsEventPayloads` interface (typed params per event)
- The `trackEvent()` dispatcher (GA4 + GTM dual-send)
- 6 convenience wrappers for common events

**Removed event:** `provider_launch` has been permanently removed. The launch panel now fires `provider_outbound` as its sole GA4 event. The server-side `/go/[providerId]` route remains the authoritative conversion record.

### Event-Boundary Contract

**Rule 1 — GA4 wrappers are for analytics transport only.**
`events.ts` dispatches events to GA4 (`window.gtag`) and optionally GTM (`window.dataLayer`). It does not feed internal product systems (Promagen Users, Index Rating, etc.).

**Rule 2 — Internal product telemetry is a separate governed system.**
Promagen Users aggregation, Index Rating calculations, and the `/go/[providerId]` outbound route all use server-side telemetry via Postgres (`provider_activity_events` table). These are not GA4 events.

**Rule 3 — No event name may be added without updating all three:**
1. The `AnalyticsEventName` type in `events.ts`
2. Any dependent cron/aggregation checked for impact
3. This authority doc (`ga4-gtm-nextjs-vercel.md`)

**Rule 4 — Conversion authority chain:**

| Layer | System | Role | Ad-blocker resistant? |
|---|---|---|---|
| **Authoritative** | `/go/[providerId]` → `provider_activity_events` | Server-side conversion truth | ✅ Yes |
| **Supplementary** | GA4 `provider_outbound` | Client-side mirror for dashboards | ❌ No |

Conversion dashboards needing accurate counts must use `provider_activity_events`. GA4 provides directional insight only.

### Convenience wrapper pattern

Components call typed helpers instead of `trackEvent()` directly:

```typescript
// Components use camelCase params:
trackPromptCopy({ providerId: 'midjourney', promptLength: 342 });

// Wrapper translates to snake_case GA4 params:
trackEvent('prompt_copy', { provider_id: 'midjourney', prompt_length: 342 });
```

Available wrappers: `trackPromptBuilderOpen`, `trackPromptCopy`, `trackNavClick`, `trackProviderClick`, `trackProviderOutbound`, `trackAiCitationLanding`.

### Active events (10 wired)

| Event | Fires when | File |
|---|---|---|
| `provider_click` | User clicks provider on leaderboard | `engine-bay.tsx`, `providers-table.tsx` |
| `provider_outbound` | User clicks "Go to site" | `launch-panel.tsx` |
| `prompt_builder_open` | User lands on prompt builder | `provider-page-tracker.tsx`, `prompt-builder.tsx` |
| `prompt_copy` | User copies a prompt | `prompt-builder.tsx`, `enhanced-prompt-builder.tsx` |
| `nav_click` | User clicks top-nav link | `top-nav.tsx` |
| `scene_selected` | User selects a scene | `scene-selector.tsx` |
| `scene_reset` | User resets a scene | `scene-selector.tsx` |
| `explore_drawer_opened` | User opens explore drawer | `explore-drawer.tsx` |
| `explore_chip_clicked` | User clicks explore chip | `explore-drawer.tsx` |
| `cascade_reorder_triggered` | User triggers reorder | `prompt-builder.tsx` |

### Enrichment modules (Extras)

| Module | File | Wired into |
|---|---|---|
| Session Journey Snapshot | `session-journey.ts` | `trackProviderOutbound` |
| AI Citation Detection | `use-ai-citation-detector.ts` | Root layout hook |
| Attribution Waterfall | `attribution-waterfall.ts` | `trackProviderOutbound` |
| Prompt Quality Correlation | `prompt-quality-correlation.ts` | `trackProviderOutbound` |

---

## Scope note (don't power leaderboards from GA4)

GA4/GTM is for marketing/UX analytics and can be blocked by browsers/ad-blockers. Promagen leaderboard metrics like "Promagen Users" (30 days) and "Online Now" (30 minutes) must be computed server-side (Postgres + Cron / KV presence) and must render blank when stale/unavailable, rather than relying on GA4 data.

- Environment variables: set in `.env.local` (local) and Vercel → Project Settings → Environment Variables (prod).
  Next.js only exposes variables prefixed with `NEXT_PUBLIC_` to the browser.

  ```env
  NEXT_PUBLIC_GA_MEASUREMENT_ID=G-QHJ7L4OPCM
  NEXT_PUBLIC_SITE_URL=https://promagen.com
  NEXT_PUBLIC_ANALYTICS_ENABLED=on
  NEXT_PUBLIC_GA_SAMPLE_RATE=1
  NEXT_PUBLIC_ANALYTICS_DEBUG=false
  ```

### Promagen note: Vercel Pro guardrails

This doc is about analytics wiring only. It must not weaken your operational guardrails.

- Put **all** tracking config behind env vars (no hard-coded IDs).
- Keep "trace/diagnostics" endpoints free of paid-upstream calls.
- If you add server-side tracking later, do it via `/api/*` with API calming, caching, and (where relevant) budget guards.
- Monetisation boundaries are defined only in `docs/authority/paid_tier.md` (do not invent tier rules here).

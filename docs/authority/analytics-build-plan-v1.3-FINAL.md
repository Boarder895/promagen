# Promagen GA4 Analytics — Consolidation Build Plan

**Version:** 1.3.0  
**Date:** 10 April 2026  
**Author:** Claude (ChatGPT-reviewed, three rounds of corrections applied)  
**Status:** Build-ready (100/100 target — all three 98→100 fixes applied)  
**Scope:** Analytics files only. No layout, colours, spacing, typography, or UI changes. Pro Promagen page untouched.

---

## Changelog

| Version | Date        | Changes                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1.3.0   | 10 Apr 2026 | Three 98→100 fixes applied. (1) Part 4 exact files pinned: `engine-bay.tsx` line 374 (desktop launch) and `providers-table.tsx` line 1471 (mobile card link) — no ambiguity. (2) Authority doc contract quoted verbatim in §3 Rule 5. (3) Ad-blocker estimate reworded: "industry-wide estimates suggest 25–40%; Promagen's actual rate is unknown until measured post-deploy." Two world-class extras added: AI Citation Landing Detection and Session Journey Snapshot.      |
| 1.2.0   | 10 Apr 2026 | Three ChatGPT corrections applied for 96→98 target. (1) Part 3 table now explicitly states the `src` → `surface` param rename in `launch-panel.tsx` — no longer claims "no call-site logic changes." (2) Event counts corrected: 10 wired after build, 11 remaining — numbers now match listed events exactly. (3) Verification step 9 added: confirm `/go/[providerId]` server-side insert lands in `provider_activity_events`, verifying both layers of the authority chain. |
| 1.1.0   | 10 Apr 2026 | ChatGPT review applied (93→96). `provider_launch` removed — `provider_outbound` is sole authority. Event-boundary contract added (§3). `/go/[providerId]` route confirmed as server-side conversion truth; GA4 `provider_outbound` is client-side mirror only.                                                                                                                                                                                                                 |
| 1.0.0   | 9 Apr 2026  | Initial plan.                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

---

## 1. Problem Statement

Promagen's analytics layer had **four overlapping systems**, three of which were dead code. The six dead files have been deleted. Two files remain:

| File                                            | Role                                               | Status                                       |
| ----------------------------------------------- | -------------------------------------------------- | -------------------------------------------- |
| `src/components/analytics/google-analytics.tsx` | Injects GA4 `gtag.js` script on every page         | ✅ Healthy, no changes needed                |
| `src/lib/analytics/events.ts`                   | Single event catalogue + `trackEvent()` dispatcher | ✅ Healthy, needs convenience wrappers added |

### What's broken now (4 import errors)

The deleted files included convenience wrapper functions that translated camelCase component params into snake_case GA4 event params. Four components and one test file still import from the deleted paths:

| Component                                                              | Deleted import              | Functions used                              |
| ---------------------------------------------------------------------- | --------------------------- | ------------------------------------------- |
| `src/components/providers/prompt-builder.tsx`                          | `@/lib/analytics/providers` | `trackPromptBuilderOpen`, `trackPromptCopy` |
| `src/components/providers/launch-panel.tsx`                            | `@/lib/analytics/providers` | `trackProviderLaunch`                       |
| `src/components/prompts/enhanced-prompt-builder.tsx`                   | `@/lib/analytics/providers` | `trackPromptCopy`                           |
| `src/components/nav/top-nav.tsx`                                       | `@/lib/analytics/nav`       | `trackNavClick`                             |
| `src/components/providers/__tests__/prompt-builder.analytics.test.tsx` | `@/lib/analytics/providers` | `trackPromptBuilderOpen` (mocked)           |

### What's never been wired (events defined but never fired)

| Event               | Purpose                                        | Value                                    |
| ------------------- | ---------------------------------------------- | ---------------------------------------- |
| `provider_click`    | User clicks a provider card on the leaderboard | Top of conversion funnel — "who browses" |
| `provider_outbound` | User navigates to an external provider site    | Bottom of funnel — "who converts"        |

---

## 2. Architectural Decision

**Add convenience wrappers to `events.ts`** rather than rewriting all component call sites.

Rationale:

- Components keep readable helper calls (`trackPromptCopy({ providerId, promptLength })`)
- snake_case translation is centralised in one file (GA4 convention: all event params must be snake_case)
- Minimises files touched (4 import path changes + 1 test update vs rewriting every call site)
- Test file only needs its mock path updated, not its assertions

The wrappers are thin — each is 3–5 lines that map camelCase to snake_case and call `trackEvent()`. They carry no logic, no side effects, no state.

---

## 3. Event-Boundary Contract

**This section defines where analytics responsibilities live. No ambiguity.**

### Rule 1 — GA4 wrappers are for analytics transport only

`events.ts` dispatches events to GA4 (`window.gtag`) and optionally GTM (`window.dataLayer`). It exists solely for marketing/UX dashboards. It does not feed internal product systems.

### Rule 2 — Internal product telemetry is a separate governed system

Promagen Users aggregation, Index Rating calculations, and the `/go/[providerId]` outbound route all use server-side telemetry via Postgres (`provider_activity_events` table, cron jobs, `useIndexRatingEvents` hook). These are **not** GA4 events and are not affected by this build.

### Rule 3 — No event name may be added without updating all three

When a new event name is introduced:

1. The `AnalyticsEventName` type in `events.ts` must be updated
2. Any dependent cron/aggregation must be checked for impact
3. The `ga4-gtm-nextjs-vercel.md` authority doc must be updated

This prevents the fragmented analytics that existed before.

### Rule 4 — Conversion authority chain

| Layer             | System                                                      | Role                                                                                                                                | Ad-blocker resistant?                               |
| ----------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| **Authoritative** | `/go/[providerId]` route → `provider_activity_events` table | Server-side conversion truth. Every outbound click is logged with `click_id`, `provider_id`, `country_code`, `src`, `is_affiliate`. | ✅ Yes — server-side, cannot be blocked             |
| **Supplementary** | GA4 `provider_outbound` event                               | Client-side mirror for the GA4 dashboard. Enables GA4-native funnel reports, audience building, and UTM attribution.                | ❌ No — blocked by ad blockers and privacy browsers |

**Reporting rule:** Conversion dashboards that need accurate counts must use `provider_activity_events` (server-side). GA4 funnel visualisations use `provider_outbound` for directional insight, understanding it under-counts. Industry-wide estimates suggest 25–40% of users block GA4; Promagen's actual ad-blocker rate is unknown until measured post-deploy via server-side vs GA4 comparison.

### Rule 5 — Authority doc dependency (ga4-gtm-nextjs-vercel.md)

The current contract in `ga4-gtm-nextjs-vercel.md` that this build must preserve:

> **Scope note (§1):** "GA4/GTM is for marketing/UX analytics and can be blocked by browsers/ad-blockers. Promagen leaderboard metrics like 'Promagen Users' (30 days) and 'Online Now' (30 minutes) must be computed server-side (Postgres + Cron / KV presence) and must render blank when stale/unavailable, rather than relying on GA4 data."
>
> **Guardrails (§Promagen note):** "Put all tracking config behind env vars (no hard-coded IDs). Keep trace/diagnostics endpoints free of paid-upstream calls. If you add server-side tracking later, do it via /api/\* with API calming, caching, and budget guards. Monetisation boundaries are defined only in paid_tier.md (do not invent tier rules here)."

Part 8 of this build updates that doc to reflect the consolidation. The scope note and guardrails above remain unchanged.

---

## 4. Event Taxonomy (after build)

### `provider_launch` — REMOVED

ChatGPT correctly identified that `provider_launch` and `provider_outbound` overlapped semantically. The `/go/[providerId]` route already logs every outbound click server-side. Adding a second client-side event for the same action creates double-counting risk.

**Decision:** Remove `provider_launch` from the event catalogue entirely. The launch panel fires `provider_outbound` as its sole GA4 event. The server-side `/go/` route remains the authoritative record.

### Active events after build (10 wired)

| Event                       | Fires when                                         | Wired in                                                             |
| --------------------------- | -------------------------------------------------- | -------------------------------------------------------------------- |
| `provider_click`            | User clicks a provider row on leaderboard/homepage | `engine-bay.tsx` line 374, `providers-table.tsx` line 1471 **(new)** |
| `provider_outbound`         | User clicks "Go to site" / affiliate link          | `launch-panel.tsx` **(new, replaces `provider_launch`)**             |
| `prompt_builder_open`       | User lands on the prompt builder page              | `provider-page-tracker.tsx`, `prompt-builder.tsx`                    |
| `prompt_copy`               | User copies a generated prompt                     | `prompt-builder.tsx`, `enhanced-prompt-builder.tsx`                  |
| `nav_click`                 | User clicks a top-nav link                         | `top-nav.tsx`                                                        |
| `scene_selected`            | User selects a scene starter                       | `scene-selector.tsx`                                                 |
| `scene_reset`               | User resets a scene                                | `scene-selector.tsx`                                                 |
| `explore_drawer_opened`     | User opens the explore drawer                      | `explore-drawer.tsx`                                                 |
| `explore_chip_clicked`      | User clicks a chip in the explore drawer           | `explore-drawer.tsx`                                                 |
| `cascade_reorder_triggered` | User triggers a cascade reorder                    | `prompt-builder.tsx`                                                 |

### Conversion funnel (fully measurable)

```
provider_click → prompt_builder_open → prompt_copy → provider_outbound
   (browse)         (engage)             (use)          (convert)
```

### Remaining catalogue events (11 unwired, wired incrementally)

| Event                       | Feature area    |
| --------------------------- | --------------- |
| `prompt_submit`             | Prompt Lab      |
| `prompt_success`            | Prompt Lab      |
| `finance_toggle`            | Finance widgets |
| `finance_tab_view`          | Finance widgets |
| `exchange_widget_open`      | Exchange cards  |
| `country_commodities_hover` | Commodities     |
| `page_view_custom`          | SPA navigation  |
| `ribbon_pause`              | FX ribbon       |
| `fx_pair_select`            | FX pairs        |
| `prompt_liked`              | Like system     |
| `prompt_like_removed`       | Like system     |

These stay in the type catalogue but are not wired in this build. Each will be wired when its feature area is next touched.

---

## 5. Build Plan

### Part 1 — Remove `provider_launch` from `events.ts` ✅ BUILT

Delete the `provider_launch` entry from `AnalyticsEventName` and its payload from `AnalyticsEventPayloads`. Clean removal — the only call site (`launch-panel.tsx`) is being updated in Part 3 to fire `provider_outbound` instead.

### Part 2 — Add convenience wrappers to `events.ts` ✅ BUILT

Add 5 exported wrapper functions to the bottom of `events.ts`:

```typescript
// ============================================================================
// CONVENIENCE WRAPPERS
// ============================================================================
// Translate camelCase component params → snake_case GA4 params.
// Components call these instead of trackEvent() directly.
// Rule: every wrapper maps 1:1 to a single trackEvent() call. No logic.
// ============================================================================

export function trackPromptBuilderOpen(params: {
  providerId: string;
  location?: string;
}): void {
  trackEvent("prompt_builder_open", {
    provider_id: params.providerId,
    location: params.location,
  });
}

export function trackPromptCopy(params: {
  providerId: string;
  promptLength?: number;
}): void {
  trackEvent("prompt_copy", {
    provider_id: params.providerId,
    prompt_length: params.promptLength,
  });
}

export function trackNavClick(params: { label: string; href: string }): void {
  trackEvent("nav_click", {
    label: params.label,
    href: params.href,
  });
}

export function trackProviderClick(params: {
  providerId: string;
  providerName?: string;
  surface?: string;
}): void {
  trackEvent("provider_click", {
    provider_id: params.providerId,
    provider_name: params.providerName,
    surface: params.surface as ProviderSurface,
  });
}

export function trackProviderOutbound(params: {
  providerId: string;
  providerName?: string;
  href?: string;
  surface?: string;
}): void {
  trackEvent("provider_outbound", {
    provider_id: params.providerId,
    provider_name: params.providerName,
    href: params.href,
    surface: params.surface as ProviderSurface,
  });
}
```

### Part 3 — Fix broken imports (4 components + 1 test)

All imports change to `@/lib/analytics/events`. No behavioural logic changes beyond the `src` → `surface` param rename in `launch-panel.tsx`.

| File                                | Old import                                         | New import                                      | Other changes                                                                                                                                                                                                              |
| ----------------------------------- | -------------------------------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prompt-builder.tsx`                | `from "@/lib/analytics/providers"`                 | `from "@/lib/analytics/events"`                 | None — wrapper signatures match existing call sites                                                                                                                                                                        |
| `launch-panel.tsx`                  | `from '@/lib/analytics/providers'`                 | `from '@/lib/analytics/events'`                 | Replace `trackProviderLaunch({ providerId, providerName, src })` with `trackProviderOutbound({ providerId, providerName, href: launchHref, surface: src })` — param rename from `src` to `surface` to match GA4 convention |
| `enhanced-prompt-builder.tsx`       | `from '@/lib/analytics/providers'`                 | `from '@/lib/analytics/events'`                 | None — wrapper signatures match existing call sites                                                                                                                                                                        |
| `top-nav.tsx`                       | `from '@/lib/analytics/nav'`                       | `from '@/lib/analytics/events'`                 | None — wrapper signatures match existing call sites                                                                                                                                                                        |
| `prompt-builder.analytics.test.tsx` | `from '@/lib/analytics/providers'` (import + mock) | `from '@/lib/analytics/events'` (import + mock) | Update mock target path                                                                                                                                                                                                    |

### Part 4 — Wire `provider_click` (new)

Fire `trackProviderClick` when a user clicks a provider on the leaderboard to navigate to the prompt builder. This is the top of the funnel.

**Exact locations (pinned from `src.zip`):**

| Surface | File                                           | Line | Element                                                  | Context                                                                                                         |
| ------- | ---------------------------------------------- | ---- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Desktop | `src/components/home/engine-bay.tsx`           | 374  | `<a href={…/providers/${id}}>` launch button             | Fires when user clicks the "Launch [Platform] Builder" button after selecting a provider in the engine bay grid |
| Mobile  | `src/components/providers/providers-table.tsx` | 1471 | `<a href={…/providers/${id}}>` "Build prompts for…" link | Fires when user taps the mobile card's navigation link to enter the prompt builder                              |

```typescript
// engine-bay.tsx — inside the launch button onClick (line 375)
trackProviderClick({
  providerId: selected.id,
  providerName: selected.name,
  surface: "engine_bay",
});

// providers-table.tsx — on the mobile card link onClick (line 1474)
trackProviderClick({
  providerId: p.id,
  providerName: p.name,
  surface: "mobile_card",
});
```

`provider_click` fires on the leaderboard navigation only. The detail page load already fires `prompt_builder_open` — no double event.

### Part 5 — Wire `provider_outbound` (replaces `provider_launch`)

Fire `trackProviderOutbound` in `launch-panel.tsx` inside the existing `handleLaunchClick`, replacing the current `trackProviderLaunch` call:

```typescript
trackProviderOutbound({
  providerId: provider.id,
  providerName: provider.name,
  href: launchHref,
  surface: src,
});
```

This is the client-side GA4 mirror of the server-side `/go/[providerId]` DB insert. Both fire on the same user action — the server record is authoritative (§3 Rule 4).

### Part 6 — Env var verification (manual, Martin)

Check Vercel → Project Settings → Environment Variables:

| Variable                        | Required value                  | Purpose                                                                  |
| ------------------------------- | ------------------------------- | ------------------------------------------------------------------------ |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | `G-QHJ7L4OPCM`                  | **Without this, the entire GA4 component returns null.** Nothing tracks. |
| `NEXT_PUBLIC_SITE_URL`          | `https://promagen.com`          | Blocks preview deploys from contaminating production data.               |
| `NEXT_PUBLIC_ANALYTICS_ENABLED` | `on` (or unset, defaults to on) | Master kill switch.                                                      |
| `NEXT_PUBLIC_GA_SAMPLE_RATE`    | `1` (or unset, defaults to 1)   | 1 = 100% of sessions tracked.                                            |

### Part 7 — GA4 dashboard configuration (manual, Martin)

Once data flows:

1. **Mark conversions:** GA4 Admin → Events → toggle `provider_outbound` and `prompt_builder_open` as Conversions
2. **Create custom dimensions:** GA4 Admin → Custom Definitions → add `provider_id` and `provider_name` as event-scoped dimensions
3. **AI referral monitoring:** No config needed — GA4 automatically tracks referral sources. Watch Acquisition → Traffic Acquisition for `chatgpt.com`, `perplexity.ai`, `claude.ai`, `gemini.google.com`

### Part 8 — Update authority doc

Update `ga4-gtm-nextjs-vercel.md` to reflect:

- Dead files deleted
- `events.ts` is the single analytics module
- `provider_launch` removed
- Event-boundary contract (§3 of this plan) added
- Convenience wrapper pattern documented
- Scope note and Promagen guardrails preserved unchanged (§3 Rule 5)

---

## 6. Files Changed Summary

| File                                                                   | Change type | What changes                                                                                                     |
| ---------------------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------- |
| `src/lib/analytics/events.ts`                                          | MODIFY      | Remove `provider_launch`. Add 5 convenience wrappers. ✅ BUILT                                                   |
| `src/components/providers/prompt-builder.tsx`                          | MODIFY      | Import path change (1 line)                                                                                      |
| `src/components/providers/launch-panel.tsx`                            | MODIFY      | Import path change. Replace `trackProviderLaunch` → `trackProviderOutbound` with `src` → `surface` param rename. |
| `src/components/prompts/enhanced-prompt-builder.tsx`                   | MODIFY      | Import path change (1 line)                                                                                      |
| `src/components/nav/top-nav.tsx`                                       | MODIFY      | Import path change (1 line)                                                                                      |
| `src/components/providers/__tests__/prompt-builder.analytics.test.tsx` | MODIFY      | Mock path + import path change                                                                                   |
| `src/components/home/engine-bay.tsx`                                   | MODIFY      | Add `trackProviderClick` call inside launch button onClick (line 375)                                            |
| `src/components/providers/providers-table.tsx`                         | MODIFY      | Add `trackProviderClick` call on mobile card link onClick (line 1474)                                            |
| `docs/authority/ga4-gtm-nextjs-vercel.md`                              | MODIFY      | Reflect consolidation, event-boundary contract, removed dead files                                               |

**Total: 9 files. No new files. No deleted files. No layout/UI changes.**

**Existing features preserved: Yes**

---

## 7. Verification Steps

After build + deploy:

1. `pnpm dev` — zero import errors, zero TypeScript errors
2. `pnpm run test:util` — analytics test passes with updated mock path
3. Set `NEXT_PUBLIC_ANALYTICS_DEBUG=true` in `.env.local`
4. Navigate homepage → click provider in engine bay → verify `[analytics:event] provider_click { surface: 'engine_bay' }` in console
5. Open prompt builder → verify `[analytics:event] prompt_builder_open`
6. Copy prompt → verify `[analytics:event] prompt_copy`
7. Click "Go to site" → verify `[analytics:event] provider_outbound` in console (and NO `provider_launch`)
8. Production: GA4 Realtime report shows active user within 30 seconds of visiting site
9. **Server-side authority check:** After clicking "Go to site" in production, query `provider_activity_events` to confirm the outbound click produced a row with the correct `provider_id`, `click_id`, `country_code`, and `src`. This verifies both layers of the conversion authority chain — GA4 client-side mirror (step 7) and server-side truth (this step).

---

## 8. Out of Scope

- Pro Promagen page (complete — do not modify)
- New event types beyond what's in the existing catalogue
- Server-side analytics changes (the `/go/` route is already logging correctly)
- GTM container configuration (using direct GA4 only)
- GA4 ecommerce / monetisation setup (deferred until Stripe Pro is live)
- Wiring the remaining 11 feature-specific events (incremental, not this build)

---

## 9. World-Class Extras (proposed — not built until approved)

### Extra 1 — AI Citation Landing Detection (Score: 94/100)

**What it does:** Detects when a user arrives at Promagen from an AI system (ChatGPT, Perplexity, Claude, Gemini) and fires a dedicated `ai_citation_landing` event with the referring AI, the landing page, and any UTM params. This closes the measurement loop on the entire authority pages strategy — you can finally answer "are the authority pages actually getting cited?"

**Why no one else does this:** Most SaaS products track referral sources generically. Promagen's authority pages are specifically designed for AI citation. Having a dedicated event that distinguishes `chatgpt.com` from `perplexity.ai` from `claude.ai` referrals — with the exact landing page — lets you measure which authority pages are working and which AI systems cite you most. This feeds directly into content strategy decisions.

**How it works:**

1. A thin `useAiCitationDetector()` hook runs once on mount in the root layout
2. It reads `document.referrer` and matches against a known list: `chatgpt.com`, `perplexity.ai`, `claude.ai`, `gemini.google.com`
3. On match, fires `trackEvent('ai_citation_landing', { ai_source, landing_page, utm_source, utm_medium, utm_campaign })`
4. Stores a `sessionStorage` flag so it fires only once per session (no double-count on SPA navigation)
5. GA4 custom dimension on `ai_source` enables slicing all downstream events (prompt copies, outbound clicks) by which AI sent the user

**Files touched:** `events.ts` (add event type + wrapper), new hook `src/hooks/use-ai-citation-detector.ts` (~30 lines), one-line addition in root layout.

**Value:** When you see "42 users arrived from Perplexity this week, 18 copied prompts, 7 clicked through to a provider" — that is the ROI number for authority pages. No other prompt tool has this.

---

### Extra 2 — Session Journey Snapshot on Conversion (Score: 92/100)

**What it does:** When a user fires `provider_outbound` (the conversion event), the event payload is enriched with a compact snapshot of their entire session journey: how many providers they viewed, how many prompts they copied, which pages they visited, how long they've been on-site, and what their entry source was. This turns flat conversion counts into actionable conversion narratives.

**Why no one else does this:** Standard GA4 gives you "X users converted." Promagen would know "users who view 3+ providers before converting have 2.4× the outbound rate" or "users arriving from AI citations convert 40% faster than organic Google." This is the kind of insight that tells you what to gate behind Pro and what to keep free.

**How it works:**

1. A lightweight `SessionJourney` object lives in `sessionStorage` (not a React state — survives SPA navigation, costs zero renders)
2. Existing events (`provider_click`, `prompt_builder_open`, `prompt_copy`) each append a one-line entry: `{ event, provider_id, timestamp }`
3. When `trackProviderOutbound` fires, it reads the journey and attaches a summary to the GA4 event:
   - `journey_providers_viewed` (count)
   - `journey_prompts_copied` (count)
   - `journey_pages_visited` (count)
   - `journey_duration_seconds` (time since session start)
   - `journey_entry_source` (referrer domain or UTM source)
   - `journey_entry_page` (first page visited)
4. GA4 custom dimensions on these fields unlock Exploration reports that answer "what does the conversion journey look like?"

**Files touched:** `events.ts` (extend `provider_outbound` payload type), small utility `src/lib/analytics/session-journey.ts` (~50 lines), minor additions to `trackProviderClick`, `trackPromptCopy`, `trackProviderOutbound` wrappers.

**Value:** This is the data that drives Pro paywall decisions. If users who copy 3+ prompts convert at 2× the rate, that tells you exactly where to put the upgrade wall. Standard GA4 funnels show drop-off; journey snapshots show _why_ people convert.

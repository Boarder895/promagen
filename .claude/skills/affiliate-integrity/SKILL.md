---
name: affiliate-integrity
description: Apply whenever code that touches outbound provider links, the `/go/[providerId]` redirect, the leaderboard, platform pages, comparison pages, footer disclosures, or schema.org `Product.url` is added, changed, or reviewed. Enforces Promagen's hard rule that every external provider link routes through `/go/[providerId]` so click attribution, partner sub-id tracking, FTC disclosure, and Sentinel-grade revenue measurement remain intact. Direct revenue protection — the 🤝 affiliate-emoji bug (April 2026) leaked direct `affiliateUrl` clicks until caught.
type: workflow
---

# affiliate-integrity — every external provider link routes through `/go/`

Promagen monetises the leaderboard via affiliate clicks. The infrastructure is `/go/[providerId]` — a server route in `frontend/src/app/go/[providerId]/route.ts` that:

- Resolves `providerId` against the provider catalog.
- Captures `click_id`, partner sub-ids, and `src` surface attribution.
- Stamps FTC `rel="sponsored"` semantics.
- 302-redirects to the provider's `affiliateUrl`.
- Fires the analytics event Sentinel and the leaderboard rely on.

If a link bypasses `/go/`, the click is lost from attribution. Revenue regresses silently. Sentinel's "AI-referred traffic that converted" metric breaks. Partner programs cannot match the click. The `affiliateUrl` is exposed in HTML, leaking the partner relationship to crawlers, scrapers, and competitors.

This has happened — the **🤝 affiliate-emoji bug (April 2026)**: a `<a href={provider.affiliateUrl}>` in a leaderboard cell rendered the partner URL directly until the link audit caught it. This skill exists to prevent that class of regression.

---

## 0. When this skill applies

**Apply when the change touches any of:**

- `frontend/src/app/go/[providerId]/route.ts` (the redirect itself — read-only without explicit auth)
- `frontend/src/components/providers/**` (leaderboard rows, cells, buttons)
- `frontend/src/components/authority/platform-hub-table.tsx` (platform hub Try buttons)
- `frontend/src/components/authority/**` (any page that links to a provider)
- `frontend/src/app/platforms/**` and `frontend/src/app/providers/**` (pages that render provider links)
- Any new page or component that renders a provider name, logo, or CTA
- Any schema.org `Product.url`, `Offer.url`, or anchor `href` targeting an external provider
- `frontend/src/data/providers/providers.json` (changes to provider data — `affiliateUrl` lives here)
- Any footer or disclosure copy related to affiliate relationships
- `frontend/src/app/about/how-we-score/page.tsx` (the methodology page — affiliate disclosure source)

**Do NOT apply to:**

- Internal admin pages
- Sentinel cron / library
- Test files (unless they assert affiliate routing — those *should* exist)

---

## 1. The hard rule (one sentence)

**Every external provider link in the UI, in metadata, in schema.org, in copy, or in any rendered HTML routes through `/go/[providerId]`. Period.**

UI never links directly to a provider's `affiliateUrl`.

---

## 2. The rule expanded

### 2.1 Anchor / Link `href`

```tsx
// ❌ WRONG — direct affiliateUrl exposed, click attribution lost
<a href={provider.affiliateUrl} target="_blank" rel="noopener">Try</a>

// ✅ RIGHT — routes through /go/, attribution preserved
<a href={`/go/${provider.id}?src=leaderboard_try`} target="_blank" rel="sponsored noopener">Try</a>
```

Surface attribution via the `src` query param. Common surfaces:

- `leaderboard_try` — leaderboard row "Try →" pill
- `platform_hub_try` — `/platforms` page Try button
- `provider_profile_cta` — provider profile page primary CTA
- `comparison_page_a` / `comparison_page_b` — comparison pages distinguish A vs B
- `guide_recommendation` — use-case guide recommendation
- `homepage_proof` — homepage proof section (rare)
- `affiliate_emoji` — the small 🤝 emoji link

The `/go/` route reads `src` and passes it to analytics; do not invent surfaces without coordinating with the analytics event schema.

### 2.2 `next/link`

Same rule:

```tsx
import Link from 'next/link';

// ❌ WRONG
<Link href={provider.affiliateUrl}>Try</Link>

// ✅ RIGHT
<Link href={`/go/${provider.id}?src=leaderboard_try`}>Try</Link>
```

### 2.3 Schema.org JSON-LD

Provider schema entries on Promagen pages reference the **canonical Promagen URL**, not the provider's site:

```jsonc
// ❌ WRONG — points crawlers at provider directly
{
  "@type": "Product",
  "name": "Midjourney",
  "url": "https://www.midjourney.com/?aff=promagen"
}

// ✅ RIGHT — Promagen is the page; provider is referenced by name
{
  "@type": "Product",
  "name": "Midjourney",
  "url": "https://promagen.com/platforms/midjourney"
}
```

If schema legitimately needs to reference the external provider (e.g. `Brand.url` or `manufacturer.url`), use `/go/[id]` so the click is captured if a bot or user follows from rich-result surfaces. But the canonical `url` field on the page-level schema is always Promagen's URL.

### 2.4 OpenGraph and Twitter card metadata

Provider pages on Promagen set `metadata.openGraph.url` to the Promagen canonical URL. Never to the provider site.

### 2.5 Sitemap

The sitemap lists Promagen pages only. Provider sites never appear in `frontend/src/app/sitemap.xml/route.ts`.

### 2.6 `rel` attribute

External provider links via `/go/` use `rel="sponsored noopener"` (FTC sponsored disclosure + security). The `/go/` route handles this; the UI link to `/go/[id]` only needs `rel="sponsored noopener"` if it's a direct anchor. For internal `<Link>` to `/go/[id]`, `rel="sponsored"` is still recommended for consistency.

### 2.7 `target` attribute

Provider links typically open in a new tab (`target="_blank"`). Always pair with `rel="noopener"` (already covered by `rel="sponsored noopener"`).

### 2.8 Click-event analytics

Where a click handler exists alongside the link, the handler should still fire (e.g. `onClick={() => trackProviderClick(...)}`). The `/go/` redirect captures server-side, but the client-side event is what GA4 uses for funnel analysis.

---

## 3. FTC disclosure requirements

Where affiliate relationships exist, disclosure must be visible to humans **and** machine-readable.

### 3.1 Footer disclosure (always present)

The footer `Footer.tsx` has the disclosure: *"Some links to AI image platforms are affiliate links."* with a link to `/about/how-we-score`. Keep this whenever the footer is touched. **Removing or weakening this is a Blocker.**

### 3.2 Page-level disclosure

On surfaces with prominent affiliate CTAs (leaderboard, `/platforms`, `/providers/leaderboard`, comparison pages), an affiliate disclosure must be visible without scrolling on mobile, or anchor-linked from above the fold.

Discreet styling: `text-slate-500/600`, plain underlined link to `/about/how-we-score`. Never a flashy banner — it dilutes other CTAs.

### 3.3 `rel="sponsored"`

All affiliate-routed links must carry `rel="sponsored"` (or `rel="sponsored noopener"`). This is the machine-readable FTC disclosure that AI engines, search engines, and Sentinel rely on.

### 3.4 Methodology page

`/about/how-we-score` is the canonical destination for "how does this site make money?". When it changes, verify it still:

- Names the affiliate-program structure clearly.
- Lists which platforms have affiliate relationships.
- States that affiliate relationships do not affect editorial ranking (or, if they do, discloses that exactly).
- Is reachable from every footer.

---

## 4. Verification — grep patterns

### 4.1 Find direct `affiliateUrl` usage in components

```bash
# Should match ONLY the provider catalog and the /go/ route handler
grep -rn "affiliateUrl" frontend/src --include="*.tsx" --include="*.ts"
```

Any match outside `frontend/src/app/go/`, `frontend/src/data/providers/`, and `frontend/src/lib/providers/` (the resolver) is a bug.

### 4.2 Find anchors that bypass `/go/`

```bash
# Look for href patterns that look like provider sites
grep -rEn 'href=["{].*\.(com|ai|app|io)' frontend/src/components --include="*.tsx" \
  | grep -v "promagen.com" \
  | grep -v "/go/"
```

Any match referring to a provider's domain is a likely bypass.

### 4.3 Find missing `src` attribution

```bash
# /go/ links without src= are valid but lose surface attribution
grep -rEn '/go/\[?[a-zA-Z]' frontend/src --include="*.tsx" \
  | grep -v "src="
```

Each match should be reviewed: should this surface have an `src` param?

### 4.4 Find rel attributes on external links

```bash
grep -rEn '"sponsored"' frontend/src --include="*.tsx"
```

Should match every component that emits an external provider link. Missing `sponsored` is an FTC-compliance gap.

### 4.5 Schema.org `url` fields

```bash
grep -rEn '"url":\s*["`]https?://' frontend/src --include="*.tsx" --include="*.ts" \
  | grep -v "promagen.com"
```

Should be empty (or limited to legitimate non-provider external references — Sentinel's published methodology, etc.).

---

## 5. Anti-patterns — flag in review

| Anti-pattern | Severity | Fix |
|--------------|----------|-----|
| `<a href={provider.affiliateUrl}>` | **Blocker** | Replace with `/go/${provider.id}?src=<surface>` |
| `<Link href={`https://${provider.domain}`}>` | **Blocker** | Same |
| `window.location.href = provider.affiliateUrl` (client-side) | **Blocker** | Same |
| `router.push(provider.affiliateUrl)` | **Blocker** | Same |
| `/go/` link missing `src` query param on a tracked surface | **High** | Add `?src=<surface>` |
| External provider link missing `rel="sponsored"` | **High** | Add `rel="sponsored noopener"` |
| Schema.org `Product.url` pointing to provider site | **High** | Point to canonical Promagen URL |
| Page with affiliate CTAs but no FTC disclosure visible | **High** | Add disclosure block above the fold (mobile) |
| Footer disclosure removed | **Blocker** | Restore |
| `<a target="_blank">` without `rel="noopener"` | Medium | Add `rel="noopener"` |
| `/go/[id]` route handler modified to drop `click_id` | **Blocker** | Revert |
| `/go/[id]` route handler modified to drop partner sub-id propagation | **Blocker** | Revert |
| Provider-name component rendering bare anchor (no `/go/`) | **Blocker** | Wrap in `/go/` |
| New surface (e.g. comparison page CTA) without an `src` value | High | Define and document the new `src` value |
| Surface attribution `src` reused across two unrelated surfaces | Medium | Split — `src` is a category, not a key |

---

## 6. Implementation patterns

### 6.1 Helper for building `/go/` URLs

If the codebase has a helper for building `/go/` URLs, use it. If not, the inline pattern is:

```tsx
const goUrl = `/go/${encodeURIComponent(provider.id)}?src=${encodeURIComponent(surface)}`;
```

`encodeURIComponent` matters when `provider.id` could contain hyphens or special characters (it shouldn't, but be defensive).

### 6.2 Try-button component

If the leaderboard or `/platforms` introduces a new "Try" button, encapsulate the routing:

```tsx
function TryButton({ providerId, surface }: { providerId: string; surface: string }) {
  return (
    <a
      href={`/go/${encodeURIComponent(providerId)}?src=${encodeURIComponent(surface)}`}
      target="_blank"
      rel="sponsored noopener"
      className="..." /* per design-polish */
    >
      <span className="text-...">Try →</span>
    </a>
  );
}
```

This isolates the routing rule in one place. If the rule changes, one edit covers all surfaces.

### 6.3 Provider name as link

Provider names that link out (e.g. on the leaderboard) follow the same pattern:

```tsx
<a
  href={`/go/${provider.id}?src=leaderboard_provider_name`}
  target="_blank"
  rel="sponsored noopener"
  className="provider-name-link"
>
  <span>{provider.name}</span>
</a>
```

### 6.4 Affiliate emoji

The 🤝 emoji link is the canonical "I'm an affiliate" marker on a row. It must route through `/go/` like any other link:

```tsx
<a
  href={`/go/${provider.id}?src=affiliate_emoji`}
  target="_blank"
  rel="sponsored noopener"
  className="provider-affiliate-link"
  aria-label={`Affiliate link to ${provider.name}`}
>
  🤝
</a>
```

The April 2026 bug: this rendered as `<a href={provider.affiliateUrl}>🤝</a>` and leaked direct partner URLs. Test for this exact regression.

---

## 7. The `/go/[providerId]/route.ts` invariants

Don't modify this file without explicit auth. When reviewing changes to it, verify:

- Returns 302 (or 301 if permanent — but normally 302 for affiliate links).
- Reads `providerId` from the route param.
- Resolves to `provider.affiliateUrl` from the catalog.
- Captures `click_id` (generated or passed-through) and `src` from the query.
- Propagates partner sub-id query parameters where the affiliate program supports them.
- Stamps the redirect with appropriate cache headers (`Cache-Control: no-store` for affiliate redirects; do not cache the redirect target server-side).
- Returns a 404 (not 200, not 500) when `providerId` doesn't exist in the catalog.
- Does not expose the resolved `affiliateUrl` in the response body.
- Does not log PII into the analytics event.
- Returns the redirect immediately — no synchronous external API calls in the hot path.

---

## 8. Sentinel interaction

Sentinel's "AI-referred traffic that converted" metric depends on:

1. The AI citation detector firing on landing (`AiCitationDetector` in `app/layout.tsx`).
2. The user clicking through to a provider via `/go/[id]`.
3. The `/go/` event being captured and joined to the AI-citation event in the analytics pipeline.

If `/go/` is bypassed, the user's session has the citation event but no conversion event. Sentinel under-reports AI-referred conversions. The case study at `/sentinel#proof` regresses.

This makes affiliate integrity not just a revenue concern — it is a **product-proof concern**. Sentinel can't claim "AI-referred conversions" without intact `/go/` plumbing.

---

## 9. Output format — code review

Append to the diff summary:

```text
Affiliate Integrity Review
  /go/ routing intact:        yes / no — <reason>
  No direct affiliateUrl in UI: pass / fail — <files>
  src= attribution present:   yes / partial / no — <surfaces>
  rel="sponsored" on externals: yes / partial / no
  Schema url is Promagen:     yes / no / n/a
  Footer disclosure intact:   yes / no
  Page disclosure visible:    yes / no / n/a — <surface>
  /go/[id] route untouched:   yes / no

Findings:
  1. [Severity: Blocker/High/Medium/Low]
     File: <path:line>
     Issue:
     Why it matters:
     Safest fix:

Existing features preserved: Yes/No
Behaviour change: Yes/No
```

Any `Blocker` is a merge-stopper. Any `High` is normally a merge-stopper unless explicitly accepted under "Decisions made" with reasoning.

---

## 10. The honest test

Before merging a change covered by this skill, ask:

> "If I were a partner program ops person reconciling our click data with Promagen's, would my numbers match Promagen's?"

If yes — ship it. If no — there's a leak somewhere; find it.

The leaderboard's affiliate revenue is one of two paths to Promagen funding the Sentinel pivot (the other is Sentinel sales itself). It must be airtight.

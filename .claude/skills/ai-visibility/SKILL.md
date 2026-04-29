---
name: ai-visibility
description: Use this skill whenever code is written, reviewed, changed, refactored, deleted, or approved in Promagen and the change could affect public crawlability, AI visibility, entity clarity, structured data, authority pages, internal linking, affiliate routing, Sentinel monitoring, robots/sitemap behaviour, analytics attribution, or the ability of ChatGPT, Claude, Perplexity, Gemini, Google, Bing, and other AI/search systems to find, read, cite, understand, and send traffic to Promagen or a client site.
type: workflow
---

# ai-visibility — Sentinel principles for our own code

Promagen sells **Sentinel**: a service that audits whether AI engines (ChatGPT, Claude, Perplexity, Gemini) can find, read, cite, and send traffic to a customer's content. The leaderboard at `/platforms` is Sentinel's flagship live proof exhibit.

The proof only stands if Promagen's own pages pass Sentinel. Every code change that touches a public-facing surface must be evaluated against the same five pillars Sentinel sells. A change that regresses any pillar is a **product regression**, even if the UI still looks good — and must be flagged before merge.

This skill is the checklist Claude runs when writing, reviewing, or modifying code on any user-facing surface.

---

## 0. Authority order

When sources conflict, follow CLAUDE.md's authority order:

1. Direct user instruction in the current chat
2. Current source code in `frontend/src/`
3. `CLAUDE.md`
4. `docs/authority/commercial-strategy.md`
5. `docs/authority/sentinel.md`
6. Other `docs/authority/*.md` files — **assume drift unless verified against code**
7. Archive docs only as history

Code is the source of truth. Authority docs may be stale. If code and docs disagree, trust code and report the drift. Do not continue from memory when current file state is uncertain — re-read.

---

## 1. When this skill applies

**Apply when the change touches any of:**

- `frontend/src/app/**/page.tsx` (any public page)
- `frontend/src/app/**/layout.tsx`
- `frontend/src/app/**/route.ts` that returns HTML or affects crawlers (`sitemap.xml`, `robots.txt`, `llms.txt`, `/go/[providerId]`)
- Any `metadata` or `generateMetadata` export
- `frontend/src/components/authority/**`
- `frontend/src/components/sentinel/**`
- `frontend/src/components/providers/**` (the leaderboard surface)
- `frontend/src/components/layout/footer.tsx`, `frontend/src/components/nav/top-nav.tsx`, `frontend/src/components/layout/mobile-bottom-nav.tsx` (global nav and footer affect every page's link graph)
- Any JSON-LD / schema.org block
- `next.config.js` headers/redirects/rewrites that affect crawler access
- `frontend/src/data/providers/providers.json` and the platform catalog (changes to the SSoT cascade into every authority page)
- Any redirect, route deletion, or sitemap change
- Any change to shared components (footer, nav, cards, tables) that public pages depend on

**Do NOT apply to:**

- `/admin/**` pages (correctly noindex)
- API routes returning JSON (not HTML)
- `frontend/src/lib/sentinel/**` cron and library internals (read-only — see CLAUDE.md non-regression)
- Test files, fixtures, mocks
- Build tooling, scripts, package config

---

## 2. The Sentinel principle

Every public page should help at least one of these objectives:

1. Prove Promagen can make pages machine-readable.
2. Help AI engines understand what the page is about.
3. Help AI engines cite the page in answers.
4. Help users arriving from AI engines understand and convert.
5. Provide measurable evidence for weekly monitoring.
6. Protect against regressions after deploys.

If a change weakens one of these, justify under `Risks` or fix before merge.

---

## 3. Definition of AI-visible — the five pillars

A page is AI-visible only if all five pillars hold. A change that regresses any pillar must be flagged in the diff summary.

### 3.1 Findable

- Stable public URL.
- Linked from at least one crawlable internal page.
- Appears in the correct sitemap unless intentionally excluded.
- Not orphaned. Nav or footer changes do not remove important crawl paths.
- Redirects are deliberate; no loops, chains, or dead ends.
- Returns the correct HTTP status (200 for live, 301 for moved, 410 only with explicit approval).
- `metadata.alternates.canonical` resolves to the correct public version.
- Internal anchor text is descriptive ("Compare Midjourney vs DALL·E", not "click here").
- Footer Resources section preserves SEO link equity to `/platforms`, `/providers/leaderboard`, `/guides/*`, `/about/how-we-score`.

### 3.2 Crawlable

- Page content is in server-rendered HTML or statically generated HTML — not gated behind hydration.
- Critical content (h1, summary paragraph, primary table/list, internal links) is in the initial HTML response. Verifiable with `view-source:` or `curl -A "GPTBot" <url>`.
- Page is not gated by auth, cookies, modals, consent overlays, or client-side state.
- Page is not blocked by robots directives.
- `robots.txt` allows AI bot user agents: `GPTBot`, `ChatGPT-User`, `OAI-SearchBot`, `ClaudeBot`, `Claude-Web`, `anthropic-ai`, `PerplexityBot`, `Perplexity-User`, `Google-Extended`, `Googlebot`, `Bingbot`, `cohere-ai`, `Applebot`, `Applebot-Extended`. Disallow only `/admin`, `/api/admin`, `/_next/static/chunks` and similar non-content paths.
- `'use client'` is not at the top of a page that needs indexing. Wrap only interactive children, not the page shell.
- Loading states do not permanently replace crawlable content.
- No important content depends entirely on `useEffect`.

### 3.3 Understandable

- Exactly one `<h1>`, hierarchical `<h2>`/`<h3>`.
- The first 100–150 words state what the page is and who it helps.
- Entity names are explicit. Comparison pages name both compared entities. Guide pages answer the main query directly.
- Important facts are plain text in the HTML, not image-only or icon-only.
- `<table>` is used for tabular data; `<ol>`/`<ul>` for lists; semantic markup matches content shape.
- Tables, FAQs, comparisons, pricing, and steps render structurally — not as visual-only blocks.
- Schema.org JSON-LD present and valid for the page type (see playbook below).
- Promagen's internal engine is **not** described to users as "AI", "GPT", "OpenAI", or "LLM" on consumer surfaces. External AI engines (ChatGPT, Claude, Perplexity, Gemini, Midjourney, etc.) and the AI image platforms are named freely on Sentinel and authority pages.

### 3.4 Citation-ready

- Page contains short, quotable factual statements.
- Methodology is stated where scoring, ranking, or recommendations are made (link to `/about/how-we-score` from any page making claims).
- Evidence, opinion, recommendation, and affiliate/commercial disclosure are distinguished.
- Direct answers to likely user questions are present (FAQ block where appropriate).
- Avoid unsupported superlatives ("best", "leading", "world-class") unless the basis is explained on-page.
- Dates / freshness markers appear where recency matters. `dateModified` reflects last meaningful edit, not build timestamp.
- ISR `revalidate` is set on data-driven pages (3600 hourly, 86400 daily, depending on volatility).
- Stable anchor IDs for important proof points where appropriate (`#proof`, `#sentinel-offer`, `#contact`).

### 3.5 Measurable

- `/go/[providerId]` is the only sanctioned outbound redirect for affiliate clicks. UI never links directly to a provider's `affiliateUrl`. (See `affiliate-integrity` skill.)
- `src` query parameter on `/go/` propagates surface attribution (`leaderboard_try`, `platform_hub_try`, etc.).
- AI citation/referral landing events fire (`AiCitationDetector` is global per `app/layout.tsx` — do not remove).
- GA4 events for `nav_click`, `provider_click`, etc. are preserved when surfaces change.
- No personal or sensitive data collected unnecessarily.
- Sentinel can observe regressions from public pages without requiring private access.

---

## 4. Schema.org playbook by page type

Apply the matching schema in a `<script type="application/ld+json">` block in the page or layout (server-rendered, never inside a client component). Validate against schema.org definitions before merging.

| Page | Required types | Notes |
|------|----------------|-------|
| `/` (Sentinel homepage) | `Organization`, `Service`, `Offer` | `Service` describes Sentinel; `Offer` per tier (Snapshot, Audit, Fix Sprint, Monitor) |
| `/sentinel` | `Service`, `Offer`, `FAQPage`, `BreadcrumbList` | Plus FAQ for bottom-of-page Q&A |
| `/sentinel#proof` (case study within `/sentinel`) | `Article` (embedded) | Bridge case study; `dateModified` reflects last leaderboard refresh |
| `/platforms` | `ItemList`, `Organization`, `BreadcrumbList` | `ItemList` enumerates the 40 platforms in ranked order |
| `/platforms/[id]` | `Product`, `Article`, `BreadcrumbList`, `AggregateRating` (if scored) | Product `name`, `brand`, `description`, `category`; canonical Promagen URL in `url` |
| `/platforms/compare/[slug]` | `Article`, `FAQPage`, `BreadcrumbList` | FAQ block must mirror the on-page Q&A verbatim |
| `/platforms/negative-prompts` | `Article`, `ItemList`, `FAQPage` | ItemList of platforms that support negative prompts |
| `/providers/leaderboard` | `ItemList`, `BreadcrumbList` | Mirror of `/platforms` ranking, alternate view |
| `/guides/best-generator-for/*` | `Article`, `HowTo` (if step-based) or `ItemList`, `BreadcrumbList` | `HowTo` for "how to choose" guides |
| `/guides/prompt-formats` | `Article`, `BreadcrumbList` | The 4-tier taxonomy is editorial substance |
| `/about/how-we-score` | `Article`, `Organization`, `BreadcrumbList` | Methodology — strong trust signal |
| `/admin/**` | none | Noindex, no schema |
| `/api/**` | none | JSON endpoints |

For every authority page, also include `BreadcrumbList` reflecting the URL structure.

**Rules:**

- JSON-LD must be valid JSON.
- Schema must not invent facts absent from the visible content.
- Schema must not overclaim ratings, reviews, prices, or availability.
- Schema IDs and URLs must be stable.
- Breadcrumbs must match visible route hierarchy.
- FAQ schema must match visible FAQ content.
- Product/SoftwareApplication schema must reflect actual platform facts derived from SSoT (`providers.json`).
- **Bad schema is worse than no schema.**

---

## 5. Non-negotiable public-page rules

### 5.1 Authority routes stay public

These routes must remain public, indexable, and SSR unless Martin explicitly approves removal or redirect:

- `/platforms`, `/platforms/[platformId]`, `/platforms/compare/*`, `/platforms/negative-prompts`
- `/providers/leaderboard`, `/providers/compare`, `/providers/trends`
- `/guides/best-generator-for/*`, `/guides/prompt-formats`
- `/about/how-we-score`
- `/sentinel`

Never gate, deindex, paywall, or remove these accidentally.

### 5.2 Admin and internal pages stay private

- `/admin/*`, `/admin/sentinel`, debug routes, internal API diagnostics, preview-only routes, cron routes, test harness routes.
- These must not appear in public sitemap output.
- Default `noindex` for any new `/admin/*` route.

### 5.3 Sentinel is read-only outside `sentinel_*` tables

Sentinel may crawl, measure, record, and report. Sentinel must not modify public page content, provider data, route behaviour, non-Sentinel tables, user records, Stripe state, Clerk state, or affiliate data. Sentinel database writes stay inside `sentinel_*` tables.

### 5.4 Affiliate routing is mandatory

Every external provider link routes through `/go/[providerId]`. UI never links directly to `affiliateUrl`. Schema.org `Product.url` uses canonical Promagen URL, not provider URL. See `affiliate-integrity` skill for full coverage.

### 5.5 No internal-engine exposure (AI Disguise)

Public pages may freely discuss external AI engines (ChatGPT, Claude, Perplexity, Gemini, Google, Bing, AI crawlers, AI image platforms). Promagen's own internal optimiser/builder must not be described to users as "GPT", "OpenAI", "LLM", "model", or "AI model". Use: "Promagen engine", "optimiser", "builder", "Prompt Intelligence Engine", "algorithmic processing". Applies to product-surface copy, not internal docs or Sentinel's discussion of external AI engines.

---

## 6. AI visibility change plan (pre-implementation)

Before editing, produce a short plan:

```text
AI visibility scope:
  - Public surfaces affected:
  - Crawl/index impact:
  - Citation/readability impact:
  - Analytics/attribution impact:
  - Sentinel monitoring impact:

Files to inspect:
  - ...
Files expected to change:
  - ...
Files deliberately untouched:
  - ...

Risk level: Low / Medium / High
Existing features preserved: Yes/No
Behaviour change: Yes/No
```

If the change touches more than four production files, stop and produce a staged plan instead of implementing everything in one pass (per CLAUDE.md task-size limit).

---

## 7. Code review rubric — severity

When reviewing changed code, score each finding by severity.

### 7.1 Blocker — must fix before merge

- Public authority page becomes unreachable, `noindex`, or auth-gated.
- Canonical points to wrong page.
- Sitemap loses important public URLs.
- `robots.txt` blocks important AI/search crawlers without approval.
- Route changes create redirect loop or broken public route.
- Important content becomes client-only and absent from server HTML.
- Provider affiliate link bypasses `/go/[providerId]`.
- Sentinel writes outside `sentinel_*` tables.
- Internal admin data leaks to public page.
- Public copy reveals Promagen's internal GPT/OpenAI/LLM implementation.
- TypeScript/lint/test failures hidden with suppressions or weakened types.
- AuthButton `[&_button]:!text-white` override removed or broken.

### 7.2 High — normally fix before merge unless Martin accepts

- Missing or broken `<title>` / `<meta name="description">` on important public page.
- Missing or incorrect `<h1>`.
- Heading hierarchy confused enough to damage machine understanding.
- JSON-LD invalid or contradicts visible page content.
- Internal links to important pages removed.
- New public page omitted from sitemap.
- Stale commercial positioning reintroduced (homepage reframed as builder, "Upgrade to Pro" CTA in builder UI, etc.).
- Sentinel page no longer states find / read / cite / traffic / report clearly.
- Comparison/recommendation page makes claims without methodology link or affiliate disclosure.
- Outbound links lose attribution params (`src`, `click_id`).
- Client-only rendering hides main page facts from crawlers.

### 7.3 Medium — fix in same pass where safe

- Weak meta description.
- Vague headings.
- Missed FAQ/schema opportunity.
- Missing breadcrumb trail.
- Page lacks freshness marker where recency matters.
- Page lacks internal links to related authority pages.
- Image-only text.
- Vague CTA wording.
- Long decorative section pushes meaningful text below first 1000 chars of HTML.

### 7.4 Low — log as deferred

- Minor wording improvement.
- Optional anchor link.
- Low-value schema enhancement.
- Minor table/list semantic improvement.

---

## 8. Common failure patterns — name and catch these

### 8.1 "Looks good but invisible"

Page looks excellent after hydration; server HTML contains only a shell. **Fix:** move critical content to server rendering or static/ISR generation.

### 8.2 "Marketing hero with no answer"

Polished hero, but doesn't clearly state what the service is, who it's for, what it checks. **Fix:** direct above-the-fold copy stating value prop in plain text.

### 8.3 "Schema drift"

JSON-LD claims content, ratings, FAQs, prices, or product facts the visible page doesn't show. **Fix:** derive schema from visible/SSoT data or remove the schema.

### 8.4 "Affiliate bypass"

Provider CTA uses `affiliateUrl` directly. **Fix:** route through `/go/[providerId]`. (The 🤝 emoji bug, April 2026.)

### 8.5 "Noindex accident"

Copied metadata object includes `robots: { index: false }`. **Fix before merge.**

### 8.6 "Canonical collision"

Several pages point canonical to the hub or homepage. **Fix:** canonical per route, matching the live URL.

### 8.7 "Internal link starvation"

Route remains live but loses all links from nav, footer, hub, related content. **Fix:** at least one crawlable internal link from a relevant page.

### 8.8 "Decorative content replaces factual content"

Animations, icons, charts, or cards replace text the AI engines need. **Fix:** add concise crawlable text alongside the visual.

### 8.9 "Public proof leaks private data"

Sentinel proof sections expose internal run IDs, client names, unpublished customer domains, or admin-only evidence. **Fix:** show public case-study evidence only.

### 8.10 "Commercial positioning drift"

Homepage or nav starts selling the prompt builder as the main product again. **Fix:** restore Sentinel-first hierarchy per `commercial-strategy.md`.

### 8.11 "Hydration mismatch"

Server HTML differs from client render — often dates, counts, or random IDs. AI engines see one thing, users see another. **Fix:** stable seeds or move to client-only after first paint without losing critical content.

### 8.12 "Empty error state"

Public page shows "Something went wrong" or a blank skeleton when an API fails. AI bots cache the empty state. **Fix:** error boundary that preserves at least the page's identifying h1 and core copy.

---

## 9. Safe fix patterns

Prefer these:

- Add missing metadata using existing helper.
- Add concise crawlable paragraph above decorative UI.
- Add visible FAQ block + matching `FAQPage` schema.
- Add `BreadcrumbList` schema matching visible breadcrumbs.
- Add internal links from hub to child and child to hub.
- Replace direct affiliate URL with `/go/[providerId]`.
- Move critical copy out of client-only state.
- Derive platform facts from SSoT (`providers.json`).
- Add clear methodology link near ranking claims.
- Update sitemap inclusion for new public route.
- Add `noindex` to internal/admin route.
- Use canonical helper instead of hardcoded strings.
- Add explicit redirect for retired public URL.
- Preserve route with explanatory content when SEO value is likely.

Avoid:

- Broad rewrites; mass formatting.
- Client-only content for public facts.
- Fake schema, fake reviews, fake ratings.
- Generic "best AI tools" keyword stuffing.
- Direct affiliate links.
- Deleting public routes without redirect analysis.
- Blocking AI bots without reason.
- Hidden text only for crawlers.
- Weakening types to ship metadata quickly.

---

## 10. Redirect and deletion rules

Before deleting, redirecting, or demoting any route:

1. Identify whether the route has public crawl value.
2. Identify whether the route appears in the sitemap.
3. Identify internal links pointing to it (grep `<Link href="/the-route"`).
4. Identify external/backlink risk if known.
5. Decide one:
   - Preserve route.
   - 301 redirect to closest intent match.
   - `noindex` temporary holding page.
   - 404/410 only with explicit approval.
6. Update sitemap logic.
7. Update internal links.
8. Verify canonical behaviour on the redirect target.
9. Report crawl/index impact.

Do not delete public routes purely because they are no longer commercially central. Dormant routes may still carry SEO, AI citation, or trust value.

---

## 11. Sentinel-specific implementation checklist

### 11.1 Public Sentinel sales page (`/sentinel`)

- Clear `<h1>` around AI Visibility Intelligence.
- States what Sentinel checks: whether AI engines can find, read, cite, send traffic; whether competitors are cited; what changed since last check.
- Offer stack clear (Snapshot £495 / Audit £1,950 / Fix Sprint £3,500 / Monitor £349/mo).
- Deliverables clear.
- No private dashboard data, internal run IDs, or customer domains exposed.
- Case study at `/sentinel#proof` is verifiable (user can ask ChatGPT and check).
- CTA works (mailto or booking link).
- Page is indexable.

### 11.2 Internal Sentinel dashboard (`/admin/sentinel`)

- Admin-only. Noindex.
- Does not leak publicly.
- Failure state shown clearly; partial data distinguished from complete.
- Never silently drops failed crawl data.
- Reports crawl-incomplete state.
- Preserves read-only observer model.

### 11.3 Sentinel crawler/library (`frontend/src/lib/sentinel/`, `frontend/src/app/api/sentinel/`)

- Reads public pages as an external visitor.
- Stores snapshots and regressions only in `sentinel_*` tables.
- Handles partial failures honestly.
- Does not mutate the site it monitors.
- Does not call private APIs to inflate visibility.
- Degrades cleanly when external dependencies fail.
- Reports uncertainty and missing data.

---

## 12. Verification — what to run

1. **`pnpm run build`** — must succeed. Catches missing metadata exports, broken JSON-LD, dynamic route conflicts.
2. **View source on rendered page** (`view-source:` or `curl -A "GPTBot" <url>`) — critical content must be present.
3. **Schema.org validator** — paste rendered JSON-LD into Google Rich Results Test or schema.org validator.
4. **`/sitemap.xml` manual fetch** — new page listed with accurate `lastmod`.
5. **`/robots.txt` manual fetch** — AI bot user agents not in `Disallow`.
6. **`pnpm run typecheck && pnpm run lint`** — standard gates per CLAUDE.md.
7. **Cite-check** (Sentinel-relevant changes): open ChatGPT, Claude, or Perplexity. Ask a query the page is meant to rank for. Persist result on `/sentinel#proof` if improved; investigate if regressed.

---

## 13. Output format — code review

Append to the diff summary:

```text
AI Visibility Review
  Overall verdict: Pass / Pass with notes / Fail
  AI visibility impact: Improved / Neutral / Risk introduced

  Findable:           pass / concern / fail — <reason>
  Crawlable:          pass / concern / fail — <reason>
  Understandable:     pass / concern / fail — <reason>
  Citation-ready:     pass / concern / fail — <reason>
  Measurable:         pass / concern / fail — <reason>

  Schema.org:    <required types present? yes / partial / no>
  Affiliate:     <all external provider links route through /go/? yes / no / n/a>
  AI Disguise:   <Promagen engine not called "AI/GPT/OpenAI/LLM" on consumer surfaces? yes / no / n/a>
  Sitemap:       <new/changed pages reflected? yes / no / n/a>
  Sentinel-safe: <no writes outside sentinel_*; no private data leaked? yes / no / n/a>

Findings:
  1. [Severity: Blocker/High/Medium/Low]
     File:
     Issue:
     Why it matters:
     Safest fix:

Existing features preserved: Yes/No
Behaviour change: Yes/No
Recommended next action:
```

Any `Blocker` or `fail` must be addressed before commit, or explicitly deferred under "Decisions made" per CLAUDE.md output format.

---

## 14. Done criteria

A change touching public visibility is not done until:

- Code intent is clear.
- Public page remains accessible.
- Title / description / canonical / robots correct.
- Important content server-readable.
- Internal links preserved or improved.
- Structured data valid or deliberately absent.
- Affiliate routing preserved.
- Sentinel can crawl it as an external visitor.
- `pnpm run typecheck` passes.
- `pnpm run lint` passes.
- Manual verification steps listed.
- Risks reported honestly.
- `Existing features preserved: Yes/No` stated.
- `Behaviour change: Yes/No` stated.

---

## 15. Self-test: dogfood

Before merging any change covered by this skill, ask: **"If a Sentinel customer ran their own audit and got this result, would we be embarrassed?"**

If yes — fix before merge. The proof exhibit is only proof if it holds.

For Promagen, machine readability is the product proof. If a code change makes the site less findable, less readable, less citable, less measurable, or less honest, it is a product regression — even if the UI still looks good.

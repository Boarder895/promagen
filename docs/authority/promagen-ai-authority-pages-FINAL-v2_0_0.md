# Promagen — AI Authority Pages: Build Authority Document

**Version:** 2.0.0 (BUILD COMPLETE)  
**Date:** 9 April 2026  
**Author:** Claude (three-way reviewed with ChatGPT and Grok)  
**Status:** ✅ BUILD COMPLETE — All 7 priorities shipped. 57 crawlable routes live.  
**BQI Decision:** Option B (methodology + headline summary range). Option C deferred until BQI pipeline matures (see §4.2 PAGE 7).  
**ChatGPT Peak Score:** 96/100 (Drop 6)

---

## Changelog

| Version | Date       | Changes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.0.0   | 9 Apr 2026 | **BUILD COMPLETE.** All 7 spec priorities shipped and verified against `src.zip`. Document updated to reflect what was actually built: 57 crawlable routes (1 hub + 40 profiles + 1 neg guide + 8 comparison pairs + 1 prompt format guide + 1 methodology + 1 use-case hub + 4 use-case pages), shared architecture (AuthorityNav, Breadcrumb, presentation.ts, comparison-pairs.ts, use-case-recommendations.ts, bqi-headline.json), build-time ID validation, reverse-slug 301 redirects, SSOT-driven sitemap with honest lastModified. Added §5.8 Shared Architecture, §12 Build Log, §13 ChatGPT Assessment History. Post-launch items updated. |
| 1.2.0   | 8 Apr 2026 | **FINAL (pre-build).** All specific negative prompt counts removed from prose — counts derived exclusively from `platform-config.json` at build time. `platform-tiers.ts` removed as named authority; `platform-config.json` is the sole SSOT, with tier-classification routing logic in `assembleTierAware()` as the architectural reference. Bot language softened. Mobile stance softened. BQI decision locked: Option B. Grok's expanded BQI methodology text incorporated into PAGE 7 spec.                                                                                                                                                     |
| 1.1.0   | 8 Apr 2026 | Negative prompt counts corrected to dynamic derivation. Comparison pages split into interactive + static pairs. `Review` schema removed. Bot section clarified. AI Disguise scope clarified. Mobile readability added. `llms.txt` queued post-launch. Comparison pairs expanded to 8.                                                                                                                                                                                                                                                                                                                                                                |
| 1.0.0   | 8 Apr 2026 | Initial proposal                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

---

## 1. What This Is

A plan to create public-facing, server-rendered authority pages on promagen.com that surface Promagen's existing platform intelligence data. These pages serve two goals simultaneously:

1. **Google SEO** — crawlable, structured, keyword-rich pages that rank for high-intent queries
2. **AI citation** — clean, extractable content that ChatGPT, Perplexity, Claude, and Gemini can quote when users ask about AI image generators

These goals don't conflict — they're the same foundation. The same content that ranks on Google is what AI systems cite.

**Build status:** ✅ Complete. 57 authority routes are live across `/platforms`, `/guides`, and `/about`.

---

## 2. Why Promagen Is Uniquely Positioned

Promagen already holds data that no competitor has assembled in one place:

- **40 active AI image platforms** scored, tiered, and profiled
- **4-tier prompt compatibility system** (CLIP, Midjourney, Natural Language, Plain Language)
- **Comprehensive negative prompt support audit** — 16 separate, 2 inline, 22 none. All counts derived dynamically from `platform-config.json` at build time
- **Character limits, sweet spots, and prompt format rules** per platform
- **Builder Quality Intelligence (BQI)** methodology — 8 test scenes, 40 platforms, three-layer aggregation, triangulated scoring
- **Platform tier assignments** with architectural reasoning (not arbitrary rankings)
- **Weather-driven prompt generation** — a feature nobody else offers

All platform data is sourced from a single SSOT: `platform-config.json`. This data is now publicly crawlable through the authority pages system.

---

## 3. The Bot Strategy

### 3.1 Who we invite in

**Status:** ✅ SHIPPED — `src/app/robots.ts`

| Bot               | Owner      | Purpose                     | Status  |
| ----------------- | ---------- | --------------------------- | ------- |
| `*` (all)         | —          | Default allow               | ✅ Live |
| `OAI-SearchBot`   | OpenAI     | ChatGPT search results      | ✅ Live |
| `GPTBot`          | OpenAI     | Model training/grounding    | ✅ Live |
| `ClaudeBot`       | Anthropic  | Claude grounding            | ✅ Live |
| `PerplexityBot`   | Perplexity | Perplexity search indexing  | ✅ Live |
| `Perplexity-User` | Perplexity | User-triggered fetches      | ✅ Live |
| `Google-Extended` | Google     | Gemini training + grounding | ✅ Live |

**Disallowed paths:** `/admin`, `/api`, `/dev`, `/test`, `/bridge`

### 3.2 What's protected

Promagen's architecture protects proprietary intelligence:

- **Builder algorithms, system prompts, scoring formulas** → server-side API routes, never in HTML
- **AI Disguise principle** → Promagen's internal engine is never revealed (see §3.4)
- **Call 2 and Call 3 logic** → executes on Vercel serverless functions, invisible to crawlers

### 3.3 What's NOT a threat

- Major crawlers generally honour `robots.txt` and don't hammer servers
- Vercel's edge network handles rate limiting and bad-actor bot blocking by default
- Allowing crawlers doesn't expose API keys, internal routes, or proprietary logic
- The data we're surfacing (platform capabilities, prompt formats) is factual reference material — sharing it builds authority, not competitive risk

### 3.4 AI Disguise scope clarification

The AI Disguise principle means: **never reveal that Promagen uses AI/GPT/OpenAI as its internal engine.** It does NOT mean "never say the word AI on the website."

Authority pages are _about_ AI image generators — that's the product category, that's what users search for, that's the topic. You cannot write a page about Midjourney without calling it an AI image generator.

What the disguise prevents is: any reference to OpenAI, GPT, or LLM as Promagen's backend appearing in any rendered HTML, network request, or user-facing surface.

**Rule:** Authority pages use "AI image generator" freely when describing external platforms. They never reference Promagen's internal engine, model, or AI processing.

---

## 4. The Authority Pages

### 4.1 Page Structure (as built)

```
promagen.com/
├── platforms/                              ← Platform hub (P1) ✅
│   ├── [platformId]/                       ← 40 profiles (P2) ✅
│   ├── compare/
│   │   └── [slug]/                         ← 8 pre-rendered pairs (P4) ✅
│   └── negative-prompts/                   ← Negative prompt guide (P3) ✅
├── guides/
│   ├── prompt-formats/                     ← Prompt format guide (P5) ✅
│   └── best-generator-for/                 ← Use-case hub (P7 extra) ✅
│       ├── photorealism/                   ← (P7) ✅
│       ├── illustration/                   ← (P7) ✅
│       ├── product-mockups/                ← (P7) ✅
│       └── concept-art/                    ← (P7) ✅
└── about/
    └── how-we-score/                       ← Methodology (P6) ✅
```

**Total crawlable routes: 57** (1 hub + 40 profiles + 1 neg guide + 8 comparisons + 1 format guide + 1 use-case hub + 4 use-case pages + 1 methodology)

**Note:** The use-case hub page (`/guides/best-generator-for`) was not in the original spec but was added as an extra to complete the use-case cluster and capture "best AI image generator" root queries.

### 4.2 Page-by-Page Specification

---

#### PAGE 1: Platform Hub — `/platforms`

**Status:** ✅ SHIPPED — `src/app/platforms/page.tsx`

**What was built:**

- Hero: dynamic platform count + "Compared by Prompt Compatibility"
- 4 tier stat cards with dynamic counts per tier
- Negative prompt summary with dynamic counts (16 separate / 2 inline / 22 none)
- Filterable/sortable table (client component `platform-hub-table.tsx` with `usePlatformSort` hook) — columns: Platform (with icon), Tier badge, Prompt Style, Negative Prompts, Sweet Spot, Max Chars, Prompt Lab link
- 4-tier explainer section with platform lists per tier
- "Explore Our Guides" internal-link cluster (prompt format guide, neg guide, methodology, 3 top comparisons)
- 5 FAQs
- CTA to Prompt Lab
- Cross-links: negative prompt guide, comparison pages

**Schema.org:** `ItemList`, `FAQPage`, `BreadcrumbList`  
**ISR:** `revalidate: 86400` (daily)  
**Data source:** `platform-config.json` via `platform-data.ts`

---

#### PAGE 2: Platform Profiles — `/platforms/[platformId]`

**Status:** ✅ SHIPPED — `src/app/platforms/[platformId]/page.tsx`  
**Static params:** `generateStaticParams()` → 40 routes from SSOT

**What was built per profile:**

- Platform icon, name, tier badge
- 6 FactCards: Prompt Style, Negative Prompts (with descriptive detail for all 3 types), Sweet Spot, Character Range, Architecture, Country
- "How [name] reads prompts" section with tier description + group knowledge
- Prompt tips section
- "Why prompt optimisation matters" section
- Dedicated "Negative prompt support" section with cross-link to full neg guide
- Platform notes
- Example prompt (mono code block)
- 3 FAQs (character limit, negative prompts, how to write prompts)
- Related platforms (same-tier links)
- CTA to Prompt Lab with platform pre-selected

**Schema.org:** `SoftwareApplication`, `FAQPage`, `BreadcrumbList`  
**ISR:** `revalidate: 86400`

---

#### PAGE 3: Negative Prompt Support Guide — `/platforms/negative-prompts`

**Status:** ✅ SHIPPED — `src/app/platforms/negative-prompts/page.tsx`

**What was built:**

- Hero with dynamic total platform count
- 3 stat cards: Separate (16), Inline (2), Not Supported (22) — all from SSOT
- Jump navigation strip: anchor links to all sections (Separate, Inline, None, Notable Changes, API vs UI, FAQ)
- 3 support type sections, each with: heading + count, description, "How it works", example prompt (mono block), "How Promagen handles it", platform table with icons + tier badges + sweet spots + profile links
- Notable platform changes: Adobe Firefly (removed support), Google Imagen (deprecated), Playground AI (rebrand), ClipDrop (sold)
- API vs UI differences: DeepAI, Hotpot.ai, Stability AI
- 5 FAQs
- CTA to Prompt Lab

**Schema.org:** `HowTo`, `FAQPage`, `BreadcrumbList`  
**ISR:** `revalidate: 86400`

---

#### PAGE 4: Pre-Rendered Comparison Pairs — `/platforms/compare/[slug]`

**Status:** ✅ SHIPPED — `src/app/platforms/compare/[slug]/page.tsx`  
**Static params:** `generateStaticParams()` → 8 routes from `comparison-pairs.ts`  
**Data module:** `src/lib/authority/comparison-pairs.ts` (editorial layer with build-time ID validation)

**8 pre-rendered pairs:**

| Route slug                 | Platforms                 |
| -------------------------- | ------------------------- |
| `midjourney-vs-dalle`      | Midjourney vs DALL·E 3    |
| `midjourney-vs-flux`       | Midjourney vs Flux        |
| `flux-vs-stable-diffusion` | Flux vs Stability AI      |
| `leonardo-vs-ideogram`     | Leonardo vs Ideogram      |
| `dalle-vs-adobe-firefly`   | DALL·E 3 vs Adobe Firefly |
| `midjourney-vs-leonardo`   | Midjourney vs Leonardo    |
| `ideogram-vs-midjourney`   | Ideogram vs Midjourney    |
| `canva-vs-adobe-firefly`   | Canva vs Adobe Firefly    |

**What was built per pair:**

- Hero with both platform names, icons, tier badges
- Side-by-side comparison table (Tier, Prompt Style, Negative Prompts, Sweet Spot, Character Range, Architecture) — all from SSOT via `buildComparisonRows()`
- "Key difference" paragraph (40–60 words, citation-ready) + amber "Choose when" decision line
- "Why this matters for your workflow" paragraph
- Profile links to both platforms (icon + "Full profile →")
- "Other comparisons" cross-links (related pairs involving either platform)
- 2 FAQs per pair
- Dual CTA: "Try [A] in Prompt Lab" + "Try [B] in Prompt Lab"

**Reverse-slug redirects:** 8 × 301 redirects (e.g. `dalle-vs-midjourney` → `midjourney-vs-dalle`) — configured in `next.config.ts`

**Schema.org:** `FAQPage`, `BreadcrumbList`  
**ISR:** `revalidate: 86400`

---

#### PAGE 5: Prompt Format Guide — `/guides/prompt-formats`

**Status:** ✅ SHIPPED — `src/app/guides/prompt-formats/page.tsx`

**What was built:**

- Hero: "How AI Image Generators Read Your Prompts"
- 4-tier explainer with dynamic platform counts and lists per tier
- "Same Creative Intent, Four Different Formats" — lighthouse storm scene written in T1 (CLIP weighted), T2 (Midjourney ::), T3 (natural language), T4 (plain language), each with code block + explanation
- Converter teaser CTA: "Want to see how Promagen handles the conversion? Try the lighthouse scene in Prompt Lab"
- "Why Your Prompt Doesn't Work on Another Platform" — 4 failure patterns (CLIP→NL, --no→other, long→T4, negatives→no-support platforms)
- 5 FAQs targeting high-search-volume queries
- "Explore further" internal links (hub, neg guide, 2 comparisons)
- CTA to Prompt Lab

**Schema.org:** `HowTo`, `FAQPage`, `BreadcrumbList`  
**ISR:** `revalidate: 86400`

---

#### PAGE 6: Methodology — `/about/how-we-score`

**Status:** ✅ SHIPPED — `src/app/about/how-we-score/page.tsx`  
**Decision:** Option B — methodology + headline summary range

**What was built (7 sections per spec):**

1. **What BQI Is** — prompt intelligence vs aesthetic rankings, dynamic platform count
2. **Core Principles** — 4-card grid: objective, architecturally grounded, triangulated, transparent
3. **8-Scene Test Suite** — full table: Scene 01–08 with name, purpose, key stress test
4. **Three-Layer Aggregation** — colour-coded cards: Layer 1 Raw Execution (blue), Layer 2 Multi-Assessor Scoring (purple), Layer 3 Triangulated Median (green)
5. **Scoring Metrics** — 3-card grid: Prompt Adherence (40%), Anchor Fidelity (40%), Format Compliance (20%)
6. **What BQI Measures vs Doesn't** — side-by-side cards
7. **Headline Results (Option B)** — amber callout: range 62–96, loaded from `src/data/authority/bqi-headline.json` via `getBqiHeadlineRange()`

Plus: 5 FAQs, "Explore further" internal links, CTA

**Schema.org:** `AboutPage`, `BreadcrumbList`  
**ISR:** `revalidate: 86400`

---

#### PAGE 7: Use-Case Recommendations — `/guides/best-generator-for/[useCase]`

**Status:** ✅ SHIPPED — `src/app/guides/best-generator-for/[useCase]/page.tsx` + hub at `src/app/guides/best-generator-for/page.tsx`  
**Static params:** `generateStaticParams()` → 4 routes from `use-case-recommendations.ts`  
**Data module:** `src/lib/authority/use-case-recommendations.ts` (editorial layer with build-time ID validation)

**4 use-case pages:**

| Route slug        | Title                                       |
| ----------------- | ------------------------------------------- |
| `photorealism`    | Best AI Image Generator for Photorealism    |
| `illustration`    | Best AI Image Generator for Illustration    |
| `product-mockups` | Best AI Image Generator for Product Mockups |
| `concept-art`     | Best AI Image Generator for Concept Art     |

**What was built per use-case page:**

- Direct answer paragraph (40–60 words, citation-ready)
- 5 recommended platforms with: icon, name, tier badge, reasoning paragraph, per-platform "Try in Prompt Lab" link
- "Prompt format considerations" section with cross-link to prompt format guide
- 2 FAQs per use case
- "Other use-case guides" cross-links (3 related use cases)
- CTA to Prompt Lab

**Use-case hub page** (extra, not in original spec): `/guides/best-generator-for` — lists all 4 use cases as clickable cards with truncated direct answer + platform count. Captures root "best AI image generator" queries.

**Schema.org:** `ItemList`, `FAQPage`, `BreadcrumbList`  
**ISR:** `revalidate: 86400`

---

## 5. Technical Implementation (as built)

### 5.1 Rendering Strategy

All authority pages are server-side rendered with ISR (`revalidate: 86400` — daily) so crawlers see full content in the initial HTML. ✅ Verified across all 8 page files.

Dynamic routes use `generateStaticParams()`:

- `/platforms/[platformId]` → 40 routes from `getAuthorityPlatformIds()`
- `/platforms/compare/[slug]` → 8 routes from `getComparisonSlugs()`
- `/guides/best-generator-for/[useCase]` → 4 routes from `getUseCaseSlugs()`

All pages have: `<title>`, `<meta description>`, Open Graph, Twitter Card, canonical URL, and JSON-LD structured data.

### 5.2 Structured Data (Schema.org JSON-LD)

✅ Verified — all schema types from the spec are implemented:

| Schema type           | Where used                                                                  |
| --------------------- | --------------------------------------------------------------------------- |
| `Organization`        | Platforms layout (site-wide)                                                |
| `SoftwareApplication` | 40 platform profile pages                                                   |
| `FAQPage`             | Hub, profiles, neg guide, comparisons, format guide, methodology, use cases |
| `HowTo`               | Negative prompt guide, prompt format guide                                  |
| `BreadcrumbList`      | All authority pages                                                         |
| `ItemList`            | Hub, use-case hub, use-case pages                                           |
| `AboutPage`           | Methodology page                                                            |

**NOT using:** `Review` or `AggregateRating` (as specified).

### 5.3 Internal Linking & Conversion Funnel

✅ Built — every authority page links back to the Prompt Lab:

```
Authority page (learns about platform) → Prompt Lab (tries it) → Pro upgrade (wants more)
```

Internal linking mesh includes:

- Hub → profiles, neg guide, comparisons, format guide, methodology, use-case guides
- Profiles → neg guide, related same-tier platforms, Prompt Lab
- Neg guide → profiles (per-platform links in tables)
- Comparisons → profiles, related comparisons, Prompt Lab (dual CTA)
- Format guide → hub, neg guide, comparisons, Prompt Lab (converter teaser)
- Methodology → hub, format guide, neg guide, comparisons
- Use cases → profiles (per-recommendation), format guide, related use cases, Prompt Lab (per-platform + general)

### 5.4 Sitemap

✅ Verified — `src/app/sitemap.ts`

| Page type             | `changefreq` | `priority` | Count | Source                      |
| --------------------- | ------------ | ---------- | ----- | --------------------------- |
| Platform hub          | weekly       | 0.9        | 1     | Static                      |
| Platform profiles     | monthly      | 0.8        | 40    | `getAuthorityPlatformIds()` |
| Comparison pairs      | monthly      | 0.8        | 8     | `getComparisonSlugs()`      |
| Negative prompt guide | monthly      | 0.7        | 1     | Static                      |
| Prompt format guide   | monthly      | 0.7        | 1     | Static                      |
| Use-case hub          | monthly      | 0.7        | 1     | Static                      |
| Use-case pages        | monthly      | 0.7        | 4     | `getUseCaseSlugs()`         |
| Methodology           | monthly      | 0.5        | 1     | Static                      |

**lastModified strategy:** Authority pages (`/platforms/*`, `/guides/*`, `/about/*`) use SSOT last-updated date. Product pages use generation time. This prevents the sitemap from appearing noisier than the actual content changes.

### 5.5 Canonical URLs

✅ Every page has a canonical URL via `alternates: { canonical: ... }` in metadata.

Reverse-slug redirects (8 × 301) ensure reversed comparison search orderings canonical to the correct pair page. Configured in `next.config.ts`.

### 5.6 Mobile Readability

✅ All authority pages use `clamp()` for all text and table sizing. No mobile-specific layouts. No grey text per Promagen code standard.

### 5.7 Content Tone

**Reference-first with light guide warmth.** ✅ Verified across all pages.

Lead every section with direct, extractable facts and tables. Add one short "why this matters for your workflow" paragraph per major section. Closer to Wikipedia technical reference than Wirecutter buying guide. No marketing fluff, no subjective superlatives.

### 5.8 Shared Architecture (new — documents what was built beyond the spec)

The authority pages share a modular architecture that was developed iteratively during the build:

**3 Layouts** (dark gradient shell + AuthorityNav):

- `src/app/platforms/layout.tsx` — also includes Organization JSON-LD
- `src/app/guides/layout.tsx`
- `src/app/about/layout.tsx`

**4 Data Modules:**

- `src/lib/authority/platform-data.ts` — central SSOT merge layer. Exports: `getAuthorityPlatforms()`, `getAuthorityPlatformById()`, `getAuthorityPlatformIds()`, `getSameTierPlatforms()`, `getPlatformCounts()`, `getPlatformsByNegativeSupport()`, `getBqiHeadlineRange()`, `getSSOTVersion()`, `getLastUpdated()`, `TIER_META`, `NEGATIVE_SUPPORT_LABEL`
- `src/lib/authority/presentation.ts` — shared colours and style constants. Exports: `getTierBadge()`, `TIER_BADGE`, `TIER_CARD_BG`, `NEG_SUPPORT_COLOR`, `NEG_SUPPORT_LABEL`, `TABLE_CELL_PAD`, `CARD_BG`, `CARD_BORDER`, `ROW_STRIPE`, `DIVIDER`
- `src/lib/authority/comparison-pairs.ts` — editorial SSOT for 8 pairs with build-time ID validation. Exports: `getComparisonSlugs()`, `getComparisonPairBySlug()`, `getRelatedComparisons()`, `getReverseSlugs()`
- `src/lib/authority/use-case-recommendations.ts` — editorial SSOT for 4 use cases with build-time ID validation. Exports: `getUseCaseSlugs()`, `getUseCaseBySlug()`, `getRelatedUseCases()`

**4 Shared Components:**

- `src/components/authority/authority-nav.tsx` — client component with `usePathname()` active-state highlighting. 6 nav items: Platforms, Prompt Formats, Use Cases, Negative Prompts, Compare, Methodology. Injected via all 3 layouts.
- `src/components/authority/breadcrumb.tsx` — typed, accessible breadcrumb with `aria-current="page"`. Used by every authority page.
- `src/components/authority/shared.tsx` — `FaqItem`, `FactCard`, `Section` components. Used across all authority pages.
- `src/components/authority/platform-hub-table.tsx` — client component with filtering (tier buttons) + sorting (column headers). Uses `usePlatformSort` hook.

**1 Data File:**

- `src/data/authority/bqi-headline.json` — BQI range `{ min: 62, max: 96, lastBatchRun: "2026-03-29" }`. Loaded by `getBqiHeadlineRange()` in platform-data.ts. Update this file when BQI scores stabilise.

**1 Hook:**

- `src/hooks/use-platform-sort.ts` — sort state + comparator for the hub table. Extracted to keep the table component lean.

---

## 6. What We're NOT Doing

- **No blog.** Generic "AI trends" content is low-value. Every page surfaces Promagen's proprietary data
- **No thin pages.** Each platform profile has substantial, unique content derived from real platform analysis
- **No AI-generated filler.** All content is factual, data-backed, and derived from audited platform intelligence
- **No exposing proprietary logic.** Builder algorithms, system prompts, and scoring formulas stay server-side
- **No `Review` schema for self-ratings.** Trust is built through the methodology page, not schema claims
- **No hardcoded platform counts.** All numbers derived dynamically from `platform-config.json` at build time
- **No interactive comparison tool** (yet). `/platforms/compare` is not built — only the 8 pre-rendered static pair pages. The interactive tool where users pick any two platforms is a post-launch item.

---

## 7. Post-Launch Items

### 7.1 `llms.txt` (low-effort, optional upside)

**Status:** Not built. Queued.

An emerging companion to `robots.txt` specifically for LLMs. Place a clean markdown summary at `/llms.txt` listing key authority pages and describing Promagen's unique data assets.

### 7.2 `/platforms/tiers` dedicated page

**Status:** Not built. The prompt format guide (`/guides/prompt-formats`) now covers the 4-tier system comprehensively with same-intent examples in all 4 formats. Evaluate whether a separate tiers page adds value or duplicates the format guide.

### 7.3 Interactive comparison tool (`/platforms/compare`)

**Status:** Not built. The 8 pre-rendered static pair pages are live. An interactive tool where users pick any two from the full 40 × 39 / 2 = 780 pair space is a future product feature.

### 7.4 Additional comparison pairs

**Status:** Not built. Monitor search demand via Google Search Console and add static pair routes for emerging high-volume queries. The `comparison-pairs.ts` editorial module makes adding new pairs straightforward.

### 7.5 Option C upgrade (full per-platform BQI scores)

**Status:** Not built. Once the BQI pipeline reaches automated maturity (Parts 9–12 shipped, rescoring complete, multiple stable batch runs), upgrade the methodology page from Option B to Option C with full per-platform scores. The `bqi-headline.json` data file is the migration point — replace it with a full scores dataset and update the page.

### 7.6 Additional use-case pages

**Status:** Not built. The 4 initial use cases (photorealism, illustration, product-mockups, concept-art) are live. More can be added to `use-case-recommendations.ts` based on search demand. The `getUseCaseSlugs()` + `generateStaticParams()` pipeline handles new slugs automatically.

---

## 8. Success Metrics

1. **Google Search Console** — impressions and clicks for target queries within 8–12 weeks
2. **AI citation testing** — manually query ChatGPT, Perplexity, Claude, Gemini for target questions weekly
3. **Referral traffic** — track `utm_source=chatgpt.com` and similar AI referral parameters in GA4
4. **Page engagement** — GA4 page views and engagement time on authority pages
5. **Prompt Lab conversion** — click-through rate from authority pages to Prompt Lab
6. **Backlink acquisition** — other sites linking to Promagen's comparison data as a reference

---

## 9. Build Priority (Final Status)

| Priority | Page                                                              | Routes     | Status     |
| -------- | ----------------------------------------------------------------- | ---------- | ---------- |
| 1        | Platform Hub (`/platforms`)                                       | 1          | ✅ SHIPPED |
| 2        | Platform Profiles (`/platforms/[id]`)                             | 40         | ✅ SHIPPED |
| 3        | Negative Prompt Guide (`/platforms/negative-prompts`)             | 1          | ✅ SHIPPED |
| 4        | Comparison Pairs (`/platforms/compare/[slug]`)                    | 8          | ✅ SHIPPED |
| 5        | Prompt Format Guide (`/guides/prompt-formats`)                    | 1          | ✅ SHIPPED |
| 6        | Methodology (`/about/how-we-score`)                               | 1          | ✅ SHIPPED |
| 7        | Use-Case Recommendations (`/guides/best-generator-for/[useCase]`) | 4 (+1 hub) | ✅ SHIPPED |
| —        | **Total authority routes**                                        | **57**     | ✅         |

**Extras built beyond the spec:** AuthorityNav component (active-state highlighting), shared presentation module, BQI headline JSON data source, use-case hub page, anchor-link jump navigation on neg guide, converter teaser on format guide, hub internal-link cluster, "Choose when" decision lines on comparisons, related comparisons cross-links, reverse-slug 301 redirects, SSOT-driven sitemap lastModified.

---

## 10. Three-Way Review Summary

| Reviewer    | Verdict                                        | Key contributions accepted                                                                                                                                                                                                                                                               |
| ----------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Grok**    | Approved (v1.0 + v1.1)                         | `llms.txt` as post-launch item. `/platforms/tiers` as future page. Confirmed bot strategy and build priority. Expanded BQI methodology text for PAGE 7. Recommended Option C (overruled — see rationale)                                                                                 |
| **ChatGPT** | Approved with corrections (v1.0 → v1.1 → v1.2) | Static comparison pair routes. No `Review` schema for self-ratings. BQI raw score caution. Expanded comparison pairs to 8. OAI-SearchBot vs GPTBot distinction. Google-Extended scope. Named `platform-config.json` as sole SSOT. Softened bot language. Recommended Option B (accepted) |
| **Claude**  | Approved (all versions)                        | Original proposal author. Accepted ChatGPT's structural corrections. AI Disguise scope clarification. Mobile readability via `clamp()`. Dynamic count derivation from SSOT. Option B decision with Option C roadmap                                                                      |

**ChatGPT also served as independent build assessor** across 6 drops, scoring each file batch and providing structural feedback that was actioned in subsequent drops (see §13).

---

## 11. What This Unlocks Long-Term

Once the authority pages start ranking:

- **AI systems cite Promagen as a source** when answering platform comparison questions
- **Google AI Overviews** pull from platform profiles for quick-answer queries
- **Backlink opportunities** open — other sites link to comparison data as reference material
- **Content updates become data-driven** — publish updates when platforms change capabilities
- **YouTube content** has a natural companion — videos reference authority pages, pages embed videos
- **Pro conversion funnel** gets a public top — users discover Promagen through search, try Prompt Lab, upgrade to Pro
- **Option C unlock** — once BQI matures, full per-platform scores make Promagen the definitive public benchmark

---

## 12. Build Log

| Drop | Date       | What was built                                                                                                                                                                                                                                    | Files |
| ---- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| 1    | 8 Apr 2026 | P1 Hub, P2 Profiles, robots.ts, sitemap.ts, platform-data.ts, presentation.ts, breadcrumb.tsx, shared.tsx, platform-hub-table.tsx, use-platform-sort.ts, platforms/layout.tsx                                                                     | 11    |
| 2    | 8 Apr 2026 | P3 Negative Prompt Guide, anchor-link jump nav, enhanced FactCard detail, Section extraction to shared.tsx                                                                                                                                        | 5     |
| 3    | 8 Apr 2026 | P4 Comparison Pairs, comparison-pairs.ts, sitemap update, hub cross-link                                                                                                                                                                          | 4     |
| 4    | 9 Apr 2026 | P4 fixes (build-time validation, chooseWhen, getRelatedComparisons, getReverseSlugs), P5 Prompt Format Guide, guides/layout.tsx, sitemap SSOT lastModified fix                                                                                    | 5     |
| 5    | 9 Apr 2026 | P6 Methodology, about/layout.tsx, hub Explore Our Guides cluster, format guide converter teaser, comparison page RelatedComparisons + chooseWhen rendering, sitemap /about coverage                                                               | 6     |
| 6    | 9 Apr 2026 | P7 Use-Case Recommendations, use-case-recommendations.ts, use-case hub page, AuthorityNav (active-state), bqi-headline.json, getBqiHeadlineRange(), AuthorityNav in all 3 layouts, platform-data.ts BQI import cleanup, sitemap 4 use-case routes | 10    |

---

## 13. ChatGPT Assessment History

Independent scoring by ChatGPT across all 6 drops:

| Drop | Score  | Key feedback actioned                                                                                                                                                                                            |
| ---- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | 93/100 | "Inline presentation constants remain bulky" → extracted to presentation.ts. "Icons in table still feel optional" → kept (useful for recognition).                                                               |
| 2    | 95/100 | "Duplicated presentation constants now consolidated" ✅. "Priority 3 is a real page, not a placeholder" ✅.                                                                                                      |
| 3    | 92/100 | "No build-time guard for platform IDs" → added validation. "No related comparisons" → added. "Reference-grade not decision-grade" → added chooseWhen. "lastModified: new Date() not ideal" → fixed to SSOT date. |
| 4    | 94/100 | "Prompt format guide now converts better" ✅. "Hub is now a stronger authority router" ✅. "Converter teaser is exactly right" ✅.                                                                               |
| 5    | 95/100 | "Methodology page gives real trust depth" ✅. "Comparison page cleaner in related-links handling" ✅. "BQI_RANGE still a local constant" → moved to JSON.                                                        |
| 6    | 96/100 | "Authority section no longer feels like a collection of pages — it feels like a connected content architecture" ✅. All 7 priorities delivered.                                                                  |

**Category scores (Drop 6):**

- Architecture: 96
- Standards compliance: 95
- SEO / authority usefulness: 97
- Code elegance: 94
- Production polish: 96

---

_This document is the build authority for Promagen's AI Authority Pages. All 7 priorities are shipped. All three AI advisors have reviewed and approved. The system is now in maintenance mode — content updates driven by platform changes, search demand, and BQI pipeline maturity._

# Promagen — AI Authority Pages: Build Authority Document

**Version:** 1.2.0 (FINAL)  
**Date:** 8 April 2026  
**Author:** Claude (three-way reviewed with ChatGPT and Grok)  
**Status:** ✅ APPROVED — Build authority document  
**BQI Decision:** Option B (methodology + headline summary range). Option C deferred until BQI pipeline matures (see §4.2 PAGE 7).

---

## Changelog

| Version | Date       | Changes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.2.0   | 8 Apr 2026 | **FINAL.** All specific negative prompt counts removed from prose — counts derived exclusively from `platform-config.json` at build time. `platform-tiers.ts` removed as named authority; `platform-config.json` is the sole SSOT, with tier-classification routing logic in `assembleTierAware()` as the architectural reference. Bot language softened ("major crawlers generally honour `robots.txt`"). Mobile stance softened to allow targeted breakpoints for dense comparison tables if genuinely needed. BQI decision locked: Option B (methodology + headline summary range). Grok's expanded BQI methodology text incorporated into PAGE 7 spec. |
| 1.1.0   | 8 Apr 2026 | Negative prompt counts corrected to dynamic derivation. Comparison pages split into interactive + static pairs. `Review` schema removed. Bot section clarified. AI Disguise scope clarified. Mobile readability added. `llms.txt` queued post-launch. Comparison pairs expanded to 8.                                                                                                                                                                                                                                                                                                                                                                      |
| 1.0.0   | 8 Apr 2026 | Initial proposal                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

---

## 1. What This Is

A plan to create public-facing, server-rendered authority pages on promagen.com that surface Promagen's existing platform intelligence data. These pages serve two goals simultaneously:

1. **Google SEO** — crawlable, structured, keyword-rich pages that rank for high-intent queries
2. **AI citation** — clean, extractable content that ChatGPT, Perplexity, Claude, and Gemini can quote when users ask about AI image generators

These goals don't conflict — they're the same foundation. The same content that ranks on Google is what AI systems cite.

---

## 2. Why Promagen Is Uniquely Positioned

Promagen already holds data that no competitor has assembled in one place:

- **40 active AI image platforms** scored, tiered, and profiled
- **4-tier prompt compatibility system** (CLIP, Midjourney, Natural Language, Plain Language)
- **Comprehensive negative prompt support audit** — platforms classified as separate, inline, none, or converted. All counts derived dynamically from `platform-config.json` at build time
- **Character limits, sweet spots, and prompt format rules** per platform
- **Builder Quality Intelligence (BQI)** methodology — 8 test scenes, 40 platforms, three-layer aggregation, triangulated scoring
- **Platform tier assignments** with architectural reasoning (not arbitrary rankings)
- **Weather-driven prompt generation** — a feature nobody else offers

All platform data is sourced from a single SSOT: `platform-config.json`. This data currently lives inside the app, behind the UI. Making it publicly crawlable turns internal intelligence into external authority.

---

## 3. The Bot Strategy

### 3.1 Who to invite in

Update `robots.txt` to explicitly welcome:

| Bot               | Owner      | Purpose                        | Notes                                                                                                                                                     |
| ----------------- | ---------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Googlebot`       | Google     | Search indexing + AI Overviews | Standard Search eligibility is the path to AI Overviews — no special optimisation needed beyond normal crawlability and helpful content                   |
| `Bingbot`         | Microsoft  | Search indexing + Copilot      |                                                                                                                                                           |
| `OAI-SearchBot`   | OpenAI     | ChatGPT search results         | **This is the one that matters for live citations.** Controls whether your site appears in ChatGPT search answers                                         |
| `GPTBot`          | OpenAI     | Model training/grounding       | Separate and independent from OAI-SearchBot — controls whether content is used for model improvement                                                      |
| `ClaudeBot`       | Anthropic  | Claude grounding               |                                                                                                                                                           |
| `PerplexityBot`   | Perplexity | Perplexity search indexing     | Controls indexing for search results                                                                                                                      |
| `Perplexity-User` | Perplexity | User-triggered fetches         | Controls whether Perplexity can fetch pages during live answer generation                                                                                 |
| `Google-Extended` | Google     | Gemini training + grounding    | Controls whether Google-crawled content may be used for Gemini training and grounding. Does NOT control AI Overviews (that's standard Search eligibility) |

### 3.2 What's protected

Promagen's architecture already protects proprietary intelligence:

- **Builder algorithms, system prompts, scoring formulas** → server-side API routes, never in HTML
- **AI Disguise principle** → Promagen's internal engine is never revealed (see §3.4)
- **Call 2 and Call 3 logic** → executes on Vercel serverless functions, invisible to crawlers

Bots only see the **public-facing rendered HTML** — platform facts, comparisons, and guides. The engine stays locked behind the API.

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

### 3.5 Proposed robots.txt

```
User-agent: *
Allow: /

User-agent: GPTBot
Allow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Perplexity-User
Allow: /

User-agent: Google-Extended
Allow: /

Sitemap: https://promagen.com/sitemap.xml
```

**Timing:** Deploy alongside the first batch of authority pages (Priority 1 + 2). The invitation and the destination go live together.

---

## 4. The Authority Pages

### 4.1 Page Structure Overview

```
promagen.com/
├── platforms/                              ← Platform hub (index page)
│   ├── [platformId]/                       ← Individual platform profiles (40 pages)
│   ├── compare/                            ← Interactive comparison tool
│   │   └── [slug]/                         ← Pre-rendered pair pages (8 static routes)
│   └── negative-prompts/                   ← Negative prompt support guide
├── guides/
│   ├── prompt-formats/                     ← "How each platform reads prompts"
│   └── best-generator-for/                 ← Use-case recommendation pages
│       ├── photorealism/
│       ├── illustration/
│       ├── product-mockups/
│       └── concept-art/
└── about/
    └── how-we-score/                       ← Methodology & transparency
```

### 4.2 Page-by-Page Specification

---

#### PAGE 1: Platform Hub — `/platforms`

**Purpose:** The anchor page. Lists all 40 platforms with tier badges, key stats, and links to individual profiles. This is the page AI systems cite when asked "what AI image generators are there?"

**Content:**

- Hero section: "40 AI Image Generators — Compared by Prompt Compatibility"
- Filterable/sortable table: platform name, tier badge (T1–T4), prompt style, negative prompt support, character limit range, BQI score range, link to profile
- Brief explanation of the 4-tier system and why prompt format matters
- FAQ section answering: "Which AI image generator is best?", "What's the difference between CLIP and natural language prompts?", "Do all generators support negative prompts?"

**Data source:** `platform-config.json` (SSOT)

**All counts, platform lists, and tier groupings derived dynamically from data at build time — no hardcoded numbers.**

**Schema.org markup:** `ItemList` containing `SoftwareApplication` entries, `FAQPage`, `BreadcrumbList`

**Target queries (Google + AI):**

- "AI image generators comparison"
- "list of AI image generators"
- "best AI image generator 2026"
- "how many AI image generators are there"

---

#### PAGE 2: Individual Platform Profiles — `/platforms/[platformId]`

**Purpose:** 40 individual pages, one per platform. Each is a definitive reference for that platform's prompt capabilities.

**Content per page:**

- Platform name, logo, tier badge, country of origin
- Prompt format explanation: how this platform reads prompts, in plain English
- Character limits: ideal writing range (sweet spot) and practical maximum where confidence is high
- Negative prompt support status with detail (separate field / inline `--no` / none / converted to positive)
- Tier classification with architectural reasoning
- Which other platforms share similar prompt DNA (template group)
- CTA link to Promagen's Prompt Lab with this platform pre-selected
- "Last verified: [date]" stamp

**Data exposed per profile:**

- Tier assignment and reasoning ✅
- Prompt style (keywords / natural / plain) ✅
- Negative prompt support type ✅
- Ideal writing range / sweet spot ✅
- Practical max or known character limit (where confidence is high) ✅
- Plain-English "how this platform reads prompts" ✅

**Data NOT exposed:**

- Internal config field names or raw JSON shapes
- Builder system prompt contents
- Scoring algorithm internals
- Compression rules or post-processing pipeline details

**Schema.org markup:** `SoftwareApplication` with `applicationCategory: "AI Image Generator"`, `FAQPage`, `BreadcrumbList`

**Target queries (Google + AI):**

- "[Platform name] character limit"
- "[Platform name] negative prompt"
- "[Platform name] prompt format"
- "how to write prompts for [Platform name]"

---

#### PAGE 3: Comparison Tool + Pre-Rendered Pairs

**Interactive tool:** `/platforms/compare`  
**Static pair pages:** `/platforms/compare/[slug]` (e.g., `/platforms/compare/midjourney-vs-dalle`)

**Why both?** The interactive tool lets users pick any combination. The static pair pages give crawlers and AI systems pre-rendered, indexable content for the highest-volume "X vs Y" queries.

**Pre-rendered pairs (8 static routes):**

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

**Content per pair page:**

- Side-by-side comparison table: tier, prompt style, character limits, negative support, sweet spot
- "Key difference" summary paragraph (factual, citation-ready, 40–60 words)
- "Why this matters for your workflow" guidance paragraph
- Links to both platform profiles
- CTA to try both in Prompt Lab

**Schema.org markup:** `FAQPage`, `BreadcrumbList`

**Target queries:**

- "Midjourney vs DALL-E"
- "Flux vs Stable Diffusion"
- "Leonardo vs Ideogram comparison"

---

#### PAGE 4: Negative Prompt Support Guide — `/platforms/negative-prompts`

**Purpose:** The definitive reference for which platforms support negative prompts and how. No competitor has published this data comprehensively.

**Content:**

- Summary paragraph with all counts derived dynamically from `platform-config.json`
- Full table: all 40 platforms grouped by support type (separate / inline / none / converted)
- Explanation of each type with practical examples
- Notable platform changes (Adobe Firefly removed support, Google Imagen deprecated it)
- API vs UI differences where relevant (DeepAI, Hotpot, Stability AI)
- "Last verified: [date]" stamp

**Data source:** `platform-config.json` (SSOT) for counts and classifications. Editorial detail from the negative prompt support audit (verified 29 March 2026).

**Schema.org markup:** `FAQPage`, `HowTo`, `BreadcrumbList`

**Target queries:**

- "which AI generators support negative prompts"
- "negative prompt [platform name]"
- "how to use negative prompts in AI image generators"
- "does [platform] support negative prompts"

---

#### PAGE 5: Prompt Format Guide — `/guides/prompt-formats`

**Purpose:** Explains the 4-tier system and why prompt format matters. This is original research that no competitor has published.

**Content:**

- What are the 4 prompt tiers and why they exist (architectural, not arbitrary)
- How each tier processes prompts differently (CLIP tokenisation, natural language parsing, plain language simplicity)
- Practical examples: same creative intent written in all 4 formats
- "Why your Midjourney prompt doesn't work in DALL-E" (high-search-volume question)
- Which platforms belong to which tier (dynamically derived)

**Data source:** `platform-config.json` (SSOT) for all platform data and tier assignments. Tier-aware routing logic documented in `assembleTierAware()` as the architectural reference for how tiers translate to prompt handling.

**Schema.org markup:** `HowTo`, `FAQPage`, `BreadcrumbList`

**Target queries:**

- "AI image prompt format differences"
- "CLIP vs natural language prompts"
- "why doesn't my prompt work in [platform]"
- "how to write prompts for different AI generators"

---

#### PAGE 6: Use-Case Recommendation Pages — `/guides/best-generator-for/[use-case]`

**Purpose:** Answer the exact questions people ask AI systems. These pages cite Promagen's tier data as evidence for recommendations.

**Planned use-case pages:**

- `/guides/best-generator-for/photorealism`
- `/guides/best-generator-for/illustration`
- `/guides/best-generator-for/product-mockups`
- `/guides/best-generator-for/concept-art`
- More added based on search demand

**Content per page:**

- Direct answer in first paragraph (40–60 words, citation-ready)
- Recommended platforms with reasoning (not just a ranked list — explain WHY based on tier, prompt style, and capabilities)
- Prompt format considerations for the use case
- CTA link to Prompt Lab with relevant platform pre-selected

**Schema.org markup:** `FAQPage`, `ItemList`, `BreadcrumbList`

**Target queries:**

- "best AI image generator for photorealism"
- "best AI art generator for illustrations"
- "AI image generator for product photos"

---

#### PAGE 7: Methodology / How We Score — `/about/how-we-score`

**Purpose:** Transparency page. Explains Promagen's BQI evaluation methodology. Builds E-E-A-T.

**Decision: Option B — Methodology + headline summary range.**

Rationale: The BQI system has had one full batch run. Scene calibration is ongoing (Scene 06 and Scene 08 are weakest). Several platforms need rescoring after the March tier audit. Parts 9–12 of the BQI build (dual-model scoring, rerun/resume, user sampling, human-assisted patching) are not yet shipped. Publishing per-platform scores now would commit to numbers from a maturing system. Option B gives 90% of the citation value with none of the risk. Option C becomes the target once the scoring pipeline is automated, rescoring is complete, and multiple batch runs confirm score stability.

**Content:**

**Section 1 — What BQI Is:**
Builder Quality Intelligence is Promagen's quantitative benchmark for evaluating how effectively an AI image generator's prompt-handling system converts user instructions into the intended image. Unlike aesthetic rankings or subjective "best looking" lists, BQI measures prompt intelligence — the platform's ability to understand and execute structured creative direction.

**Section 2 — Core Principles:**

- Objective, not subjective — BQI never scores artistic beauty or style preference. It only scores measurable execution against a fixed creative brief
- Architectural grounding — scores reflect underlying prompt architecture (CLIP tokenisation, natural-language parsing, plain-language simplicity) rather than marketing claims
- Triangulated and reproducible — every score is the result of a three-layer aggregation process designed to eliminate single-assessor bias
- Transparent and auditable — full methodology published so anyone can verify the process

**Section 3 — The Test Suite (8 Standardised Scenes):**
Table showing all 8 scenes with purpose and key stress test per scene (complex multi-subject, style stacking, photorealistic product, illustrative narrative, weather-driven environmental, text/typography, negative prompt handling, edge-case format compliance). Each scene run identically on all 40 platforms using the exact prompt format required by that platform's tier.

**Section 4 — Three-Layer Aggregation:**

- Layer 1 (Raw Execution): Each platform receives 8 test scenes in its native prompt format under identical conditions
- Layer 2 (Multi-Assessor Scoring): Every output independently scored by multiple large vision-language models and human reviewers on three metrics: Prompt Adherence (40%), Anchor Fidelity (40%), Format Compliance (20%)
- Layer 3 (Triangulated Median): Median taken after removing highest and lowest scores. Three metric medians combined into scene score. Eight scene scores averaged for final BQI score (0–100)

**Section 5 — What BQI Measures vs. Does Not Measure:**

- Measures: prompt understanding and execution fidelity, architectural compatibility with different tiers, consistency across controlled conditions
- Does NOT measure: aesthetic quality, generation speed or cost, safety filters, UI/UX, training data recency

**Section 6 — Headline Results (Option B):**
"Across our 8-scene test suite, the 40 platforms score between [min] and [max] on a 100-point scale. Scores vary significantly by tier and scene complexity. Full per-platform breakdowns will be published once the scoring pipeline reaches automated maturity."

_Min/max values derived dynamically from the BQI dataset at build time._

**Section 7 — Freshness:**
"Last updated: [date]. BQI scores are recalculated when platform capabilities change or new test scenes are added."

**Schema.org markup:** `AboutPage`, `Organization`, `BreadcrumbList`

**Target queries:**

- "how does Promagen rank AI generators"
- "AI image generator ranking methodology"
- "BQI score AI image generator"

---

## 5. Technical Implementation

### 5.1 Rendering Strategy

All authority pages must be **server-side rendered (SSR) or statically generated (SSG)** so crawlers see full content in the initial HTML.

- **Platform profiles + comparison pairs:** ISR with `revalidate: 86400` (daily). Platform data changes infrequently
- **Hub + negative prompt guide + prompt format guide:** ISR with `revalidate: 86400`
- **Interactive comparison tool:** Server component for shell + client interactivity for platform selection
- All pages get proper `<title>`, `<meta description>`, Open Graph, and Twitter Card tags
- All counts, platform lists, and stats derived dynamically from `platform-config.json` at build time — no hardcoded numbers that drift from the SSOT

### 5.2 Structured Data (Schema.org JSON-LD)

Every authority page includes JSON-LD structured data in `<head>`:

| Schema type           | Where used                            |
| --------------------- | ------------------------------------- |
| `Organization`        | Site-wide layout (Promagen as entity) |
| `SoftwareApplication` | Platform profile pages                |
| `FAQPage`             | Every page with Q&A content           |
| `HowTo`               | Guide pages                           |
| `BreadcrumbList`      | All authority pages                   |
| `ItemList`            | Hub page, recommendation pages        |
| `AboutPage`           | Methodology page                      |

**NOT using:** `Review` or `AggregateRating` for Promagen's own platform scores. The methodology page builds trust through transparent explanation, not through schema self-ratings.

### 5.3 Internal Linking & Conversion Funnel

Authority pages link back to the Prompt Lab with platform pre-selected:

```
Authority page (learns about platform) → Prompt Lab (tries it) → Pro upgrade (wants more)
```

Every platform profile and comparison page includes a CTA: "Try [Platform] in Prompt Lab →"

### 5.4 Sitemap

`next-sitemap` (already in the project) must include all authority pages:

| Page type                | `changefreq` | `priority` |
| ------------------------ | ------------ | ---------- |
| Platform hub             | weekly       | 0.9        |
| Platform profiles        | monthly      | 0.8        |
| Comparison pairs         | monthly      | 0.8        |
| Negative prompt guide    | monthly      | 0.7        |
| Prompt format guide      | monthly      | 0.7        |
| Use-case recommendations | monthly      | 0.7        |
| Methodology              | yearly       | 0.5        |

### 5.5 Canonical URLs

Every page gets a canonical URL. The interactive comparison tool (`/platforms/compare?a=midjourney&b=dalle`) canonicals to the static pair page (`/platforms/compare/midjourney-vs-dalle`) when that pair exists.

### 5.6 Mobile Readability

Promagen is desktop-only for product surfaces (Prompt Lab, leaderboard, Mission Control). Authority pages are different — they're search-landing pages.

Google's mobile-first indexing means if a page is unreadable on mobile, it ranks lower. Someone Googling "does Midjourney support negative prompts" on their phone should be able to read the answer.

**Rule:** Authority pages use `clamp()` aggressively for all text and table sizing. No mobile-specific layouts or design work. If a dense comparison table genuinely needs a targeted breakpoint to remain readable on smaller viewports, that's acceptable — usability trumps ideology. No grey text per Promagen code standard.

### 5.7 Content Tone

**Reference-first with light guide warmth.**

Lead every section with direct, extractable facts and tables. Add one short "why this matters for your workflow" paragraph per major section. This gives AI systems clean citations while still converting humans to the Prompt Lab.

Closer to Wikipedia technical reference than Wirecutter buying guide. No marketing fluff, no subjective superlatives ("amazing", "incredible"), no claims Promagen can't back with data.

---

## 6. What We're NOT Doing

- **No blog.** Generic "AI trends" content is low-value. Every page surfaces Promagen's proprietary data
- **No thin pages.** Each platform profile has substantial, unique content derived from real platform analysis
- **No AI-generated filler.** All content is factual, data-backed, and derived from audited platform intelligence
- **No exposing proprietary logic.** Builder algorithms, system prompts, and scoring formulas stay server-side
- **No `Review` schema for self-ratings.** Trust is built through the methodology page, not schema claims
- **No hardcoded platform counts.** All numbers derived dynamically from `platform-config.json` at build time

---

## 7. Post-Launch Items

These are NOT part of the initial build but are queued for after the first batch ships:

### 7.1 `llms.txt` (low-effort, optional upside)

An emerging companion to `robots.txt` specifically for LLMs. Place a clean markdown summary at `/llms.txt` listing key authority pages and describing Promagen's unique data assets. Not a standard yet, but low-risk. Build after the authority pages exist.

### 7.2 `/platforms/tiers` dedicated page

A visual explainer of the 4-tier prompt compatibility system with a matrix view. Evaluate whether this is better as a standalone page or folded into `/guides/prompt-formats`.

### 7.3 Additional comparison pairs

Monitor search demand and add static pair routes for emerging high-volume queries.

### 7.4 Option C upgrade (full per-platform BQI scores)

Once the BQI pipeline reaches automated maturity (Parts 9–12 shipped, rescoring complete, multiple stable batch runs), upgrade the methodology page from Option B to Option C with full per-platform scores. This is the long-term gold standard.

---

## 8. Success Metrics

1. **Google Search Console** — impressions and clicks for target queries within 8–12 weeks
2. **AI citation testing** — manually query ChatGPT, Perplexity, Claude, Gemini for target questions weekly
3. **Referral traffic** — track `utm_source=chatgpt.com` and similar AI referral parameters in GA4
4. **Page engagement** — GA4 page views and engagement time on authority pages
5. **Prompt Lab conversion** — click-through rate from authority pages to Prompt Lab
6. **Backlink acquisition** — other sites linking to Promagen's comparison data as a reference

---

## 9. Build Priority

| Priority | Page                                                               | Reasoning                                                          |
| -------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| 1        | Platform Hub (`/platforms`)                                        | Anchor page, links to everything else                              |
| 2        | Platform Profiles (`/platforms/[id]`)                              | 40 pages of unique, citation-ready content                         |
| 3        | Negative Prompt Guide (`/platforms/negative-prompts`)              | Unique data no competitor has — highest differentiation            |
| 4        | Pre-Rendered Comparison Pairs (`/platforms/compare/[slug]`)        | Captures high-intent "X vs Y" demand with crawlable static routes  |
| 5        | Prompt Format Guide (`/guides/prompt-formats`)                     | Original research, explains Promagen's core IP in plain English    |
| 6        | Methodology Page (`/about/how-we-score`)                           | E-E-A-T signal, builds long-term trust and credibility             |
| 7        | Use-Case Recommendations (`/guides/best-generator-for/[use-case]`) | Directly answers AI citation queries, needs foundation pages first |

---

## 10. Three-Way Review Summary

| Reviewer    | Verdict                                        | Key contributions accepted                                                                                                                                                                                                                                                               |
| ----------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Grok**    | Approved (v1.0 + v1.1)                         | `llms.txt` as post-launch item. `/platforms/tiers` as future page. Confirmed bot strategy and build priority. Expanded BQI methodology text for PAGE 7. Recommended Option C (overruled — see rationale)                                                                                 |
| **ChatGPT** | Approved with corrections (v1.0 → v1.1 → v1.2) | Static comparison pair routes. No `Review` schema for self-ratings. BQI raw score caution. Expanded comparison pairs to 8. OAI-SearchBot vs GPTBot distinction. Google-Extended scope. Named `platform-config.json` as sole SSOT. Softened bot language. Recommended Option B (accepted) |
| **Claude**  | Approved (all versions)                        | Original proposal author. Accepted ChatGPT's structural corrections. AI Disguise scope clarification. Mobile readability via `clamp()`. Dynamic count derivation from SSOT. Option B decision with Option C roadmap                                                                      |

**Rejected feedback (all versions):**

- Both ChatGPT and Grok suggested relaxing the AI Disguise principle for authority pages. Rejected — the principle protects Promagen's internal engine, not the word "AI" when describing external platforms. No conflict exists
- Grok recommended Option C for BQI scores. Overruled — BQI system not mature enough for public per-platform scores. Option C is the long-term target once the pipeline stabilises

---

## 11. What This Unlocks Long-Term

Once the authority pages exist and start ranking:

- **AI systems cite Promagen as a source** when answering platform comparison questions
- **Google AI Overviews** pull from platform profiles for quick-answer queries
- **Backlink opportunities** open — other sites link to comparison data as reference material
- **Content updates become data-driven** — publish updates when platforms change capabilities
- **YouTube content** has a natural companion — videos reference authority pages, pages embed videos
- **Pro conversion funnel** gets a public top — users discover Promagen through search, try Prompt Lab, upgrade to Pro
- **Option C unlock** — once BQI matures, full per-platform scores make Promagen the definitive public benchmark

---

_This document is the build authority for Promagen's AI Authority Pages. All three AI advisors have reviewed and approved. No code should deviate from this spec without Martin's sign-off._

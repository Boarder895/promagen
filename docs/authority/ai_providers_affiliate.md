# AI Providers, Affiliate & AI Disguise

**Version:** 2.0.0  
**Last updated:** 9 April 2026  
**Owner:** Promagen  
**Authority:** This document is the single authority for the AI provider catalogue (40 platforms), outbound affiliate linking, UK compliance, and the AI Disguise prompt generation system. It merges and replaces three previous docs: `ai_providers.md`, `ai providers affiliate & links.md`, and `ai-disguise.md`.

> **Supersedes:**
>
> - `ai_providers.md` (19 Jan 2026, 911 lines) — RETIRED
> - `ai providers.md` (8 Jan 2026, 668 lines) — RETIRED
> - `ai providers affiliate & links.md` (22 Dec 2025, 294 lines) — RETIRED
> - `ai-disguise.md` — **NOT retired** (remains its own doc for the Prompt Lab AI Disguise system; this doc contains a summary and cross-reference only)

> **Cross-references:**
>
> - `ai-disguise.md` v5.0.0 — Full AI Disguise specification (system prompt v4.5, post-processing, harmony engineering, negative prompt display)
> - `harmonizing-claude-openai.md` v2.0.0 — Claude↔GPT system prompt engineering playbook (**STALE**, needs v3.0.0 for three-assessor methodology)
> - `prompt-builder-page.md` — Prompt builder architecture
> - `prompt-intelligence.md` v2.3.0 — Intelligence layer, DNA scoring, colour coding
> - `prompt-lab.md` v3.2.0 — Prompt Lab architecture (**STALE**, needs v4.0.0 for negative prompt display)
> - `paid_tier.md` — Pro gating, free/paid boundaries (the only place that defines what is free vs paid)
> - `optimal-prompt-stacking.md` v2.0.0 — Per-platform stacking limits (**STALE**, negativeSupport counts changed)
> - `human-sentence-conversion.md` v2.0.0 — Call 1, term matching
> - `gallery-mode-master.md` — Gallery Mode integration
> - `ignition.md` — Engine Bay homepage CTA
> - `buttons.md` v4.0.0 — Button styling standards
> - `vercel-pro-promagen-playbook.md` — Vercel deployment, WAF, spend management
> - `code-standard.md` — All code standards
> - `trend-analysis.md` v6.0.0 — Per-platform scoring with three-assessor calibration

---

## Table of Contents

**Part A — Provider Catalogue**

1. [Provider Count & Canonical Sources](#1-provider-count--canonical-sources)
2. [Provider TypeScript Type](#2-provider-typescript-type)
3. [The 40 Providers — Master List](#3-the-45-providers--master-list)
4. [4-Tier Prompt System](#4-4-tier-prompt-system)
5. [Provider Cities & Market Pulse](#5-provider-cities--market-pulse)
6. [Community Voting System](#6-community-voting-system)
7. [Leaderboard & Routes](#7-leaderboard--routes)
8. [AI Provider Selector](#8-ai-provider-selector)
9. [Prompt Builder Data Sources](#9-prompt-builder-data-sources)
10. [Adding a Provider (Process)](#10-adding-a-provider-process)

**Part B — Affiliate & Outbound Linking** 11. [UK Compliance (ASA/CAP)](#11-uk-compliance-asacap) 12. [Canonical Outbound Rule](#12-canonical-outbound-rule) 13. [Affiliate Schema & Registry](#13-affiliate-schema--registry) 14. [Redirect Endpoint `/go/[providerId]`](#14-redirect-endpoint-goproviderid) 15. [Click Logging & Privacy](#15-click-logging--privacy) 16. [Disclosure Wording](#16-disclosure-wording)

**Part C — AI Disguise (Summary)** 17. [AI Disguise Overview](#17-ai-disguise-overview)

**Part D — Governance** 18. [File Map](#18-file-map) 19. [Testing & Lock-in Proofs](#19-testing--lock-in-proofs) 20. [Known Gaps](#20-known-gaps) 21. [Non-Regression Rules](#21-non-regression-rules)

---

# Part A — Provider Catalogue

## 1. Provider Count & Canonical Sources

**Current count: 40 providers across 14 countries.**

### Canonical data sources (single source of truth)

| Data                       | File                                             | Notes                                                                                                                                                                               |
| -------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Provider catalogue         | `src/data/providers/providers.json`              | 40 entries. The authoritative list.                                                                                                                                                 |
| Provider index             | `src/data/providers/index.ts`                    | Re-exports from JSON                                                                                                                                                                |
| **Platform config (SSOT)** | **`src/data/providers/platform-config.json`**    | **Single source of truth for all 40 active platforms** — assembly rules, tier info, negativeSupport, sweetSpot, tokenLimit, idealMin/idealMax, groupKnowledge. Added 26 March 2026. |
| Platform config adapter    | `src/data/providers/platform-config.ts`          | TypeScript adapter exporting typed shapes to existing consumers                                                                                                                     |
| Platform formats (legacy)  | `src/data/providers/platform-formats.json`       | **PARTIALLY SUPERSEDED** — still holds `_assemblyDefaults`. Will be folded into platform-config.json and deleted.                                                                   |
| Platform tiers             | `src/data/platform-tiers.ts`                     | 4-tier assignments. **All 40 platforms assigned to tiers.
| Provider capabilities      | `src/data/providers/providers.capabilities.json` | Per-provider feature flags                                                                                                                                                          |
| Icon manifest              | `src/data/providers/icon-manifest.json`          | Icon paths per provider                                                                                                                                                             |
| Weather city map           | `src/data/providers/provider-weather-map.ts`     | Provider → weather city mappings                                                                                                                                                    |

> **Deleted files (26 March SSOT consolidation):**
>
> - `src/data/compression/` folder — moved to `src/data/providers/compression-utils.ts` and `compression-dictionary.json`

### History

| Date        | Count | Change                                                 |
| ----------- | ----- | ------------------------------------------------------ |
| 22 Dec 2025 | 42    | Initial catalogue                                      |
| 19 Mar 2026 | 45    | +Recraft, +Kling AI, +Luma AI (then −NightCafe, −OpenArt, −Tensor.Art, −GetImg, −Freepik on 26 Mar) |
| 26 Mar 2026 | 40    | −NightCafe, −OpenArt, −Tensor.Art, −GetImg, −Freepik (multi-engine aggregators removed) |

---

## 2. Provider TypeScript Type

**Canonical entry point:** `@/types/provider`

This file re-exports from `@/types/providers.ts`. All UI and route code must import from this single entry point:

```typescript
import type { Provider } from "@/types/provider";
```

**Forbidden patterns:**

- Importing from `@/types/providers` directly
- Defining ad-hoc Provider types in components or routes
- Using `z.infer<typeof SomeSchema>` as the Provider type in UI code

### Type definition

```typescript
export type Provider = {
  id: string;
  name: string;
  country?: string; // DEPRECATED: Use countryCode
  countryCode?: string; // ISO 3166-1 alpha-2

  score?: number; // Overall score 0–100
  trend?: ProviderTrend; // 'up' | 'down' | 'flat'
  tags?: string[];

  website: string;
  url?: string; // Legacy alias — use website

  affiliateUrl: string | null;
  requiresDisclosure: boolean;

  tagline?: string;
  tip?: string;

  icon?: string;
  localIcon?: string; // Local PNG path (e.g., '/icons/providers/midjourney.png')

  hqCity?: string;
  timezone?: string;
  supportHours?: string;

  imageQualityRank?: number;
  incumbentAdjustment?: boolean;

  visualStyles?: string;
  apiAvailable?: boolean;
  affiliateProgramme?: boolean;

  ranking?: ProviderRanking;

  // DEPRECATED fields
  sweetSpot?: string;
  generationSpeed?: ProviderGenerationSpeed;
  affordability?: string;

  supportsPrefill?: boolean;
  group?: string;
  tier?: string;
};
```

---

## 3. The 40 Providers — Master List

Sorted alphabetically. Cross-referenced against `providers.json` and `platform-tiers.ts` as of 23 March 2026.

| #   | ID                   | Name                            | Tier | City          | Country | Affiliate | API |
| --- | -------------------- | ------------------------------- | ---- | ------------- | ------- | --------- | --- |
| 1   | `123rf`              | 123RF AI Generator              | T4   | Kuala Lumpur  | MY      | ✅        | No  |
| 2   | `adobe-firefly`      | Adobe Firefly                   | T3   | San Jose      | US      | ✅        | Yes |
| 3   | `artbreeder`         | Artbreeder                      | T4   | New York      | US      | —         | No  |
| 4   | `artguru`            | Artguru                         | T1   | Hong Kong     | CN      | —         | No  |
| 5   | `artistly`           | Artistly                        | T4   | Burlington    | CA      | ✅        | No  |
| 6   | `bing`               | Bing Image Creator              | T3   | Redmond       | US      | —         | No  |
| 7   | `bluewillow`         | BlueWillow                      | T2   | San Francisco | US      | ✅        | No  |
| 8   | `canva`              | Canva Magic Media               | T4   | Surry Hills   | AU      | ✅        | No  |
| 9   | `clipdrop`           | Clipdrop                        | T1   | Paris         | FR      | —         | Yes |
| 10  | `craiyon`            | Craiyon                         | T4   | Houston       | US      | —         | No  |
| 11  | `openai`             | DALL·E 3                        | T3   | San Francisco | US      | —         | Yes |
| 12  | `deepai`             | DeepAI                          | T4   | San Francisco | US      | —         | Yes |
| 13  | `dreamlike`          | Dreamlike.art                   | T1   | London        | GB      | ✅        | No  |
| 14  | `dreamstudio`        | DreamStudio                     | T1   | London        | GB      | —         | Yes |
| 15  | `flux`               | Flux (Black Forest Labs)        | T3   | Freiburg      | DE      | —         | Yes |
| 16  | `fotor`              | Fotor                           | T4   | Hong Kong     | CN      | ✅        | No  |
| 19  | `google-imagen`      | Google Imagen                   | T3   | Mountain View | US      | —         | Yes |
| 20  | `hotpot`             | Hotpot.ai                       | T3   | Palo Alto     | US      | —         | No  |
| 21  | `ideogram`           | Ideogram                        | T3   | Toronto       | CA      | ✅        | Yes |
| 22  | `imagine-meta`       | Imagine (Meta)                  | T3   | Menlo Park    | US      | —         | Yes |
| 23  | `jasper-art`         | Jasper Art                      | T3   | Austin        | US      | ✅        | No  |
| 24  | `kling`              | Kling AI                        | T3   | Beijing       | CN      | —         | Yes |
| 25  | `leonardo`           | Leonardo AI                     | T1   | Sydney        | AU      | ✅        | Yes |
| 26  | `lexica`             | Lexica                          | T1   | San Francisco | US      | —         | No  |
| 27  | `luma-ai`            | Luma AI                         | T3   | Palo Alto     | US      | —         | Yes |
| 28  | `microsoft-designer` | Microsoft Designer              | T3   | Redmond       | US      | ✅        | No  |
| 29  | `midjourney`         | Midjourney                      | T2   | San Francisco | US      | —         | No  |
| 30  | `myedit`             | MyEdit (CyberLink)              | T4   | Taipei        | TW      | ✅        | No  |
| 32  | `novelai`            | NovelAI                         | T1   | Sheridan      | US      | —         | No  |
| 34  | `photoleap`          | Photoleap                       | T4   | Jerusalem     | IL      | ✅        | No  |
| 35  | `picsart`            | Picsart                         | T4   | San Francisco | US      | ✅        | Yes |
| 36  | `picwish`            | PicWish                         | T4   | Hong Kong     | CN      | ✅        | No  |
| 37  | `pixlr`              | Pixlr                           | T4   | Bandar Sunway | MY      | ✅        | No  |
| 38  | `playground`         | Playground AI                   | T1   | San Francisco | US      | —         | Yes |
| 39  | `recraft`            | Recraft                         | T3   | San Francisco | US      | —         | Yes |
| 40  | `runway`             | Runway ML                       | T3   | New York      | US      | ✅        | Yes |
| 41  | `simplified`         | Simplified                      | T4   | San Francisco | US      | ✅        | No  |
| 42  | `stability`          | Stability AI / Stable Diffusion | T1   | London        | GB      | —         | Yes |
| 44  | `visme`              | Visme AI                        | T4   | Rockville     | US      | ✅        | No  |
| 45  | `vistacreate`        | VistaCreate                     | T4   | Limassol      | CY      | ✅        | No  |

**Summary:** 24 with affiliate URLs. 18 with API access. 14 countries (AU, CA, CN, CY, DE, ES, FR, GB, IL, MY, PL, SG, TW, US).

### Providers added 19 March 2026

| Provider       | Tier | Encoder                        | City          | Key characteristics                                                                      |
| -------------- | ---- | ------------------------------ | ------------- | ---------------------------------------------------------------------------------------- |
| **Recraft**    | T3   | Proprietary                    | San Francisco | Design-focused, vector/SVG, text rendering, ~200 token limit, separate negatives         |
| **Kling AI**   | T3   | ChatGLM3                       | Beijing       | Kuaishou's creative studio, cinematic compositions, separate negatives, ~200 token limit |
| **Luma AI**    | T3   | Universal Transformer (Photon) | Palo Alto     | Ultra-photorealistic, natural language, no negative support, ~300 token limit            |
| **Tensor.Art** | T1   | CLIP (SD 1.5/SDXL/Flux)        | Singapore     | Community model hub, full `(term:weight)` syntax, separate negatives                     |

### Provider removed 19 March 2026

| Provider      | Reason                                                   |
| ------------- | -------------------------------------------------------- |
| **remove-bg** | Not an image generator — background removal utility only |

### Reclassification

| Provider       | Old tier        | New tier              | Reason                                                               |
| -------------- | --------------- | --------------------- | -------------------------------------------------------------------- |
| **Jasper Art** | T1 (CLIP-Based) | T3 (Natural Language) | Does not accept weighted keyword syntax; natural language input only |

---

## 4. 4-Tier Prompt System

**File:** `src/data/platform-tiers.ts`

Each platform maps to one of four prompt tiers based on how their model interprets input.


### Tier definitions

| Tier   | Name              | Prompt style                                                    | Platform count           |
| ------ | ----------------- | --------------------------------------------------------------- | ------------------------ |
| **T1** | CLIP-Based        | Weighted keywords `(term:1.3)`, stacking, quality prefix/suffix | 7 (+ up to 5 unassigned) |
| **T2** | Midjourney Family | Prose with `::` weighting, `--ar`, `--v`, `--no` parameters     | 1                        |
| **T3** | Natural Language  | Conversational sentences, no special syntax                     | 17                       |
| **T4** | Plain Language    | Simple, short, focused — minimal jargon                         | 15                       |

### Platform assignments (from `platform-tiers.ts` — 40 of 40)

**Tier 1 — CLIP-Based (7):**
`dreamlike`, `dreamstudio`, `fotor`, `leonardo`, `lexica`, `novelai`, `stability`

**Tier 2 — Midjourney Family (1):**
`midjourney`

**Tier 3 — Natural Language (17):**
`adobe-firefly`, `artbreeder`, `bing`, `canva`, `deepai`, `flux`, `google-imagen`, `ideogram`, `imagine-meta`, `kling`, `luma-ai`, `openai`, `pixlr`, `playground`, `recraft`, `runway`, `simplified`

**Tier 4 — Plain Language (15):**
`123rf`, `artguru`, `artistly`, `bluewillow`, `clipdrop`, `craiyon`, `hotpot`, `jasper-art`, `microsoft-designer`, `myedit`, `photoleap`, `picsart`, `picwish`, `visme`, `vistacreate`

**Not in tiers file (5) — exist in providers.json and platform-config.json:**

### Major reclassifications since v1.0.0

18 platforms changed tiers between the v1.0.0 doc (23 March) and the current `platform-tiers.ts`. Key changes:

| Platform           | Was (doc v1.0.0) | Now (code) | Reason                                 |
| ------------------ | ---------------- | ---------- | -------------------------------------- |
| artguru            | T1               | T4         | Not CLIP-based                         |
| artbreeder         | T4               | T3         | Supports natural language              |
| bluewillow         | T2               | T4         | Does not support Midjourney syntax     |
| canva              | T4               | T3         | Natural language platform              |
| clipdrop           | T1               | T4         | Simplified interface, no weight syntax |
| deepai             | T4               | T3         | Accepts natural language               |
| fotor              | T4               | T1         | CLIP-based, supports weighting         |
| hotpot             | T3               | T4         | Plain language preferred               |
| jasper-art         | T3               | T4         | DALL-E 2 backend, simple input         |
| microsoft-designer | T3               | T4         | Simple input preferred                 |
| pixlr              | T4               | T3         | Supports natural language + negatives  |
| playground         | T1               | T3         | Pivoted to design tool, NL preferred   |
| simplified         | T4               | T3         | Supports NL + negatives                |

### Negative prompt support (from `platform-config.json` SSOT — verified 29 March 2026)

| Mode               | Count  | Platforms                                                                                                                                                                                                             | Prompt Lab behaviour                                                      |
| ------------------ | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `separate`         | **17** | artbreeder, artguru, artistly, craiyon, dreamlike, dreamstudio, fotor, ideogram, kling, leonardo, lexica, novelai, pixlr, playground, recraft, simplified, stability | **Amber negative prompt window shown** in Prompt Lab with own copy + save |
| `inline`           | **2**  | bluewillow, midjourney                                                                                                                                                                                                | Negatives inline after `--no` in the positive prompt                      |
| `none`/`converted` | **21** | 123rf, adobe-firefly, bing, canva, clipdrop, deepai, flux, google-imagen, hotpot, imagine-meta, jasper-art, luma-ai, microsoft-designer, myedit, openai, photoleap, picsart, picwish, runway, visme, vistacreate      | Negatives flipped to positive reinforcement ("blurry" → "sharp focus")    |

> **11 config fixes applied 29 March 2026:** GetImg, NightCafe, OpenArt, Freepik, Tensor.Art, Craiyon, Kling, Pixlr, Simplified, Artbreeder, Artistly all changed from `none`/missing to `separate` after deep research audit verified each platform's actual UI.

### Provider-specific syntax

| Platform         | Tier | Weight syntax                               | Negative support                       |
| ---------------- | ---- | ------------------------------------------- | -------------------------------------- |
| Leonardo         | T1   | `term::1.3` (double-colon)                  | Separate field                         |
| Stable Diffusion | T1   | `(term:1.3)` (parenthetical)                | Separate field                         |
| Tensor.Art       | T1\* | `(term:1.3)` (parenthetical, SD-compatible) | Separate field                         |
| Midjourney       | T2   | `term::2.0` (prose weighting) + `--no` flag | `--no` inline                          |
| DALL·E 3         | T3   | None (natural language)                     | Converted to positive                  |
| Kling AI         | T3   | None (ChatGLM3 encoder)                     | Separate field                         |
| Recraft          | T3   | None (proprietary encoder)                  | Separate field                         |
| Luma AI          | T3   | None (Photon model)                         | **Not supported** — no negative prompt |
| Canva            | T3   | None (simple input)                         | Converted to positive                  |

\*Tensor.Art not in `platform-tiers.ts` — routed via `platform-config.json`.

---

## 5. Provider Cities & Market Pulse

The `hqCity` field enables dynamic city connections between AI providers and stock exchanges via Market Pulse.

### City normalization

| Provider `hqCity` | Normalized to | Provider(s)              |
| ----------------- | ------------- | ------------------------ |
| Surry Hills       | Sydney        | Canva                    |
| Mountain View     | San Francisco | Google Imagen            |
| Menlo Park        | San Francisco | Imagine (Meta)           |
| Palo Alto         | San Francisco | Hotpot, Luma AI          |
| San Jose          | San Francisco | Adobe Firefly            |
| Redmond           | Seattle       | Microsoft Designer, Bing |
| Bandar Sunway     | Kuala Lumpur  | Pixlr                    |

**Source:** `src/data/city-connections.ts` → `CITY_ALIASES`

### Provider cities (40 providers, 29 cities, 14 countries)

| City                             | Providers                                                                                                                                                                                                                          |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **San Francisco** (+ normalized) | Midjourney, DALL·E 3, Playground AI, Lexica, OpenArt, Picsart, DeepAI, BlueWillow, Simplified, Recraft, Adobe Firefly, Google Imagen, Imagine (Meta), Hotpot, Luma AI                                                              |
| **London**                       | Stability AI, DreamStudio, Dreamlike.art                                                                                                                                                                                           |
| **Hong Kong**                    | Fotor, Artguru, PicWish                                                                                                                                                                                                            |
| **New York**                     | Artbreeder, Runway ML                                                                                                                                                                                                              |
| **Redmond** (→ Seattle)          | Microsoft Designer, Bing Image Creator                                                                                                                                                                                             |
| **Sydney** (+ Surry Hills)       | Leonardo AI, Canva                                                                                                                                                                                                                 |
| **Palo Alto** (→ SF)             | Hotpot, Luma AI                                                                                                                                                                                                                    |
| **Beijing**                      | Kling AI                                                                                                                                                                                                                           |
| **Singapore**                    | Tensor.Art                                                                                                                                                                                                                         |
| **Toronto**                      | Ideogram                                                                                                                                                                                                                           |
| **Paris**                        | Clipdrop                                                                                                                                                                                                                           |
| **Warsaw**                       | Getimg.ai                                                                                                                                                                                                                          |
| **Freiburg**                     | Flux (Black Forest Labs)                                                                                                                                                                                                           |
| **Austin**                       | Jasper Art                                                                                                                                                                                                                         |
| Other (1 provider each)          | Cairns (NightCafe), Houston (Craiyon), Sheridan (NovelAI), Taipei (MyEdit), Jerusalem (Photoleap), Burlington (Artistly), Rockville (Visme), Málaga (Freepik), Limassol (VistaCreate), Kuala Lumpur (123RF), Bandar Sunway (Pixlr) |

---

## 6. Community Voting System

### How voting works

Users vote for provider image quality. Votes influence the "Image Quality" column ranking.

| Signal       | Standard weight | Pro weight |
| ------------ | --------------- | ---------- |
| Image upload | 1               | 1.5        |
| Image like   | 2               | 3          |
| Comment      | 2               | 3          |
| Card like    | 3               | 4.5        |

### Bayesian ranking formula

```
bayesianScore = (n * x + m * c) / (n + m)
where: n = total weighted votes, x = average vote score, m = 10, c = 50
```

### Anti-gaming: Auth required, paid multiplier, 3 votes/day, rolling 24h window, Bayesian scepticism, time decay, silent enforcement.

### Seed data (Artificial Analysis ELO, Nov 2024)

| Provider         | Seed ELO |
| ---------------- | -------- |
| Midjourney       | 1093     |
| Stability AI SD3 | 1084     |
| DALL·E 3         | 984      |

Manual tiers: Top-tier (Adobe Firefly, Runway ML, Recraft, Flux), Mid-tier (Canva, Lexica, OpenArt, NightCafe, Jasper Art, Freepik, Kling AI, Ideogram, Luma AI), Entry-tier (Craiyon, DeepAI, Hotpot), Specialized (NovelAI/anime, Tensor.Art/community hub, Clipdrop/editing).

---

## 7. Leaderboard & Routes

### Core routes

| Route                    | File                                     | Purpose                              |
| ------------------------ | ---------------------------------------- | ------------------------------------ |
| `/providers/leaderboard` | `src/app/providers/leaderboard/page.tsx` | Main leaderboard                     |
| `/providers`             | `src/app/providers/page.tsx`             | Same leaderboard surface             |
| `/leaderboard`           | `src/app/leaderboard/page.tsx`           | Redirect to `/providers/leaderboard` |
| `/providers/[id]`        | `src/app/providers/[id]/page.tsx`        | Provider detail + prompt builder     |
| `/go/[providerId]`       | `src/app/go/[providerId]/route.ts`       | Outbound redirect (§14)              |

### Leaderboard column contract

**Provider count:** 40 platforms, 14 countries.

Column order: Provider → Promagen Users → Image Quality → Visual Styles → API/Affiliate → Overall Score

Score calculation (7 weighted criteria): Adoption/Ecosystem (20%), Image Quality (10%), Speed/Uptime (15%), Cost/Free Tier (15%), Trust/Safety (15%), Automation/Innovation (15%), Ethical/Environmental (10%).

**Incumbent adjustment (−5 points):** Applied when 2+ of: Big Tech backing (>$10B cap), Mainstream (>10M users), Mature product (<3 features/quarter).

### Provider cell structure (3 lines)

Line 1: Rank + Provider name (hyperlinked to `/go/{id}?src=leaderboard_homepage`) + Provider icon
Line 2: 🏁 Country flag + City name
Line 3: HH:MM clock + 🎨 "Prompt builder" link → `/providers/{id}`

### Provider APIs

| API                    | File                                                           |
| ---------------------- | -------------------------------------------------------------- |
| Providers list         | `src/app/api/providers/route.ts`                               |
| Provider resolve       | `src/app/api/providers/resolve/route.ts`                       |
| Bulk leaderboard proxy | `src/app/api/providers/leaderboard/bulk/route.ts`              |
| Provider vote          | `src/app/api/providers/vote/route.ts` (POST: vote, GET: stats) |

---

## 8. AI Provider Selector

Pro Promagen users can filter the leaderboard to show only their preferred providers.

| Feature       | Behaviour                                                          |
| ------------- | ------------------------------------------------------------------ |
| Sort order    | Alphabetical, 123rf positioned last                                |
| Gallery Mode  | 1–3 providers max                                                  |
| Standard view | Unlimited (`maxProviderSelections = isGalleryMode ? 3 : 45`)       |
| Pro gating    | Free users see full leaderboard (no dropdown)                      |
| Persistence   | localStorage (immediate) + Clerk metadata (cross-device, Pro only) |

---

## 9. Prompt Builder Data Sources

| Data             | File                                       | Content                                                                                                                                                    |
| ---------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prompt options   | `src/data/providers/prompt-options.json`   | 12 categories × ~100 curated options + ~961 negatives ≈ 2,100 terms                                                                                        |
| Platform formats | `src/data/providers/platform-formats.json` | Assembly rules for 40 platforms: promptStyle, sweetSpot, tokenLimit, qualityPrefix/suffix, negativeSupport, weightingSyntax, categoryOrder, impactPriority |
| Assembly logic   | `src/lib/prompt-builder.ts`                | `assemblePrompt()` — One Brain (24 public functions)                                                                                                       |
| Type definitions | `src/types/prompt-builder.ts`              | `PromptCategory`, `PlatformFormat`, `AssembledPrompt`, `WeatherCategoryMap`                                                                                |

For full architecture, see `prompt-builder-page.md`. For per-platform stacking limits, see `optimal-prompt-stacking.md` v2.0.0.

---

## 10. Adding a Provider (Process)

Adding a provider is an intentional change and must be lock-tested. Updated to reflect the 42→45 migration (19 March 2026).

### Required files (all must be updated)

| #   | File                                      | What to add                                                                                                                          |
| --- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `providers.json`                          | Full provider object: id, name, website, score, trend, tagline, tip, hqCity, countryCode, affiliateUrl, requiresDisclosure           |
| 2   | `platform-formats.json`                   | promptStyle, sweetSpot, tokenLimit, qualityPrefix/suffix, negativeSupport, separator, weightingSyntax, categoryOrder, impactPriority |
| 3   | `providers.capabilities.json`             | Feature flags: textToImage, imageToImage, inpainting, negativePrompt, aspectRatio, etc.                                              |
| 5   | `icon-manifest.json`                      | Icon path                                                                                                                            |
| 6   | `market-power.json`                       | Market power entry                                                                                                                   |
| 7   | `platform-tiers.ts`                       | Add to correct tier's `platforms` array                                                                                              |
| 8   | `provider-weather-map.ts`                 | Weather city mapping                                                                                                                 |
| 9   | `prompt-builder.ts`                       | Add to `PLATFORM_FAMILIES` map                                                                                                       |
| 10  | `use-prompt-optimization.ts`              | Display name map                                                                                                                     |
| 11  | `community-pulse.tsx`                     | Brand colour map                                                                                                                     |
| 12  | `compression/platform-support.json`       | Compression profile                                                                                                                  |
| 13  | `compression/compression-dictionary.json` | Platform entry                                                                                                                       |
| 14  | Provider icon PNG                         | `public/icons/providers/{id}.png`                                                                                                    |

### Tests to update

- `providers.catalog.shape.test.ts` — Verify count is 40
- `providers.capabilities.shape.test.ts` — Add to capability key lists

### Rules

- Affiliate links do NOT affect scoring (score/rank is independent of monetisation)
- New provider gets `affiliateUrl: null` and `requiresDisclosure: false` until affiliate approved
- Add `hqCity` for Market Pulse connections (if city is non-standard, add to `CITY_ALIASES`)

---

# Part B — Affiliate & Outbound Linking

## 11. UK Compliance (ASA/CAP)

### ASA/CAP disclosure (affiliate/referral links)

If a link can earn Promagen money, users must be told clearly and close to the link.

**Rules:**

- Disclosure must be "up front" (not buried on another page)
- Avoid vague wording like "may contain affiliate links"
- Short repeated label near CTAs + longer sentence near table/page header

### ICO/PECR cookie consent

Click logging does NOT use cookies. Promagen's outbound system is cookie-free. Analytics cookies (GA4) are a separate consent decision.

---

## 12. Canonical Outbound Rule

**Non-negotiable:** Promagen must never link directly to external provider URLs from UI surfaces.

**All outbound links MUST go through:** `/go/{providerId}?src=<surface>`

No exceptions. This prevents drift, preserves traceability, and makes disclosure consistent.

---

## 13. Affiliate Schema & Registry

### Current affiliate status (24 of 40 providers)

| Provider           | Affiliate URL                                       | Programme            |
| ------------------ | --------------------------------------------------- | -------------------- |
| Leonardo AI        | `leonardo.ai/ai-affiliate-program/`                 | Direct               |
| Adobe Firefly      | `adobe.com/affiliates.html`                         | Adobe Affiliates     |
| Ideogram           | `ideogram.ai/features/creators-club`                | Creators Club        |
| Microsoft Designer | `microsoft.com/.../microsoft-365/business/micro...` | Microsoft Affiliates |
| 123RF              | `123rf.com/affiliate.php`                           | Direct               |
| Canva              | `canva.com/affiliates/`                             | Canva Affiliates     |
| Picsart            | `picsart.com/affiliates`                            | Direct               |
| Artistly           | `artistly.ai/affiliates`                            | Direct               |
| Fotor              | `fotor.com/affiliate/`                              | Direct               |
| Pixlr              | `pixlr.com/affiliate/`                              | Direct               |
| BlueWillow         | `bluewillow.ai/affiliate`                           | Direct               |
| Jasper Art         | `jasper.ai/partners`                                | Partners             |
| Runway ML          | `runwayml.com/creative-partners-program`            | Creative Partners    |
| Simplified         | `simplified.com/affiliates`                         | Direct               |
| Photoleap          | `lightricks.com/partners`                           | Lightricks Partners  |
| VistaCreate        | `create.vista.com/affiliate/`                       | Direct               |
| MyEdit             | `cyberlink.com/partner/affiliates/`                 | CyberLink Affiliates |
| Visme              | `visme.co/affiliates/`                              | Direct               |
| PicWish            | `picwish.com/affiliate`                             | Direct               |
| Dreamlike.art      | `dreamlike.art/affiliate`                           | Direct               |

### Not affiliate-enabled (21 providers)

`openai`, `midjourney`, `stability`, `dreamstudio`, `flux`, `google-imagen`, `imagine-meta`, `bing`, `clipdrop`, `craiyon`, `deepai`, `hotpot`, `lexica`, `novelai`, `playground`, `artbreeder`, `artguru`, `recraft`, `kling`, `luma-ai`

### Recommended schema extension (future)

```json
{
  "affiliate": {
    "enabled": true,
    "programme": "Impact",
    "clickIdParam": "click_id",
    "allowHosts": ["example.com", "partner.example.com"],
    "defaultUtm": { "utm_source": "promagen", "utm_medium": "affiliate", ... }
  }
}
```

---

## 14. Redirect Endpoint `/go/[providerId]`

**File:** `src/app/go/[providerId]/route.ts`

### Behaviour

1. Validate `providerId` exists in registry
2. Choose destination: `affiliateUrl` if present, else `website`
3. Enforce allowlist (destination host must match provider's known hosts)
4. Generate server `click_id` (UUID)
5. Append tracking params: `click_id`, UTMs
6. Write cookie-free log record to Postgres
7. Return 302 redirect with `Cache-Control: no-store`

### Security headers

- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Robots-Tag: noindex, nofollow`

### Query parameters

- `src` (optional): surface identifier (e.g., `leaderboard`, `provider_detail`)
- `utm_source`, `utm_medium`, `utm_campaign`, `utm_content` (optional overrides)

### Vercel guardrails

- Treat `/go/*` as a bot magnet: WAF rate limiting + app-level throttling
- `no-store` + `noindex` to avoid caching redirects and polluting SEO
- See `vercel-pro-promagen-playbook.md`

---

## 15. Click Logging & Privacy

### What we log (privacy-minimal)

clickId, providerId, isAffiliate, requiresDisclosure, src, createdAt, eventType, sessionId (anonymous), countryCode (from edge geo — not IP), isBot (server-derived flag), destinationHost, destinationPath, utm object.

### What we do NOT log

Cookies (none set), IP address, full user agent, referrer.

### Event taxonomy

| eventType | Weight | Description                |
| --------- | ------ | -------------------------- |
| `open`    | 1      | Outbound click             |
| `click`   | 1      | Legacy alias for `open`    |
| `submit`  | 3      | User submitted prompt/form |
| `success` | 5      | Confirmed success          |
| `vote`    | 3      | Image quality vote         |

### Guardrails

- Deduplicate by sessionId (one person = one session)
- Only heartbeat when page visible
- Weight submit/success over click/open
- Exclude obvious bots
- Cron aggregation: idempotent + backfillable (upsert)
- Freshness guard: 48h stale → render blank, don't guess

### Traceability

Ideal: Programme supports sub-ID param → `click_id` maps 1:1.
Fallback: UTMs + timestamp window + provider + surface counts.

---

## 16. Disclosure Wording

### Table/page header

"Some links are affiliate links. If you sign up via them, Promagen may earn a commission (at no extra cost to you)."

### CTA labels

- Affiliate-enabled: "Try (affiliate)" or "Try — affiliate link"
- Not affiliate-enabled: "Visit site"

**Rule:** If `requiresDisclosure` is true → show disclosure + CTA label. If false → still route through `/go/` but disclosure label can be omitted.

---

# Part C — AI Disguise (Summary)

## 17. AI Disguise Overview

The Prompt Lab (`/studio/playground`) uses three API calls to GPT-5.4-mini, presented to the user as algorithmic processing. **Full specification in `ai-disguise.md` v5.0.0.**

### The three calls

| Call   | Route                             | Purpose                                                                                                                              | Visual                             |
| ------ | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------- |
| Call 1 | `POST /api/parse-sentence`        | Extract human text → 12 categories                                                                                                   | 12 badges cycle in (150ms stagger) |
| Call 2 | `POST /api/generate-tier-prompts` | Generate 4 native tier prompts (30-rule system prompt v4.5 + 7 post-processing funcs + 4 compliance gates)                           | Tier cards populate                |
| Call 3 | `POST /api/optimise-prompt`       | Optimise assembled prompt for specific provider. 43 independent per-platform builders. Returns optimised positive + negative prompt. | Algorithm cycling (101 names)      |

### Key parameters

| Parameter   | Call 1       | Call 2       | Call 3               |
| ----------- | ------------ | ------------ | -------------------- |
| Model       | gpt-5.4-mini | gpt-5.4-mini | gpt-5.4-mini         |
| Temperature | 0.15         | 0.5          | 0.4 prose / 0.2 CLIP |
| Max tokens  | 700          | 2000         | 1200                 |

### Disguise principle

The user never sees "AI" or "GPT". The system presents as "Prompt Intelligence Engine" with "101 algorithms". See `ai-disguise.md` §1.

### Negative prompt display (v5.0.0)

For the 22 platforms with `negativeSupport: 'separate'`, the Prompt Lab now shows an amber-themed negative prompt window below the emerald optimised positive prompt. Each has its own inline copy + save icons. The bottom copy button copies positive only with a toast ("Negative prompt also available above"). The save button says "Save complete prompt" and saves both. See `ai-disguise.md` §10.

### Call 2 system prompt — v4.5 fix programme

The system prompt evolved from 11 rules scoring 62/100 (v1) to 30 rules scoring 96/100 (v4.0), then through a targeted fix programme (v4.1–v4.5) producing +7 overall gain triangulated across three independent assessors (Claude, ChatGPT, Grok). Key fixes: T1 interaction token deduplication, T2 empty negative field (root cause of --no duplication), T4 character ceiling raised 250→325 (SSOT-justified). See `ai-disguise.md` §6 and §8.

### Provider-specific syntax in Call 2

All 40 providers are tier-aware. When a provider is selected, Call 2's system prompt receives provider context with exact weight syntax, sweetSpot, tokenLimit, qualityPrefix, and negativeSupport. The 30-rule system prompt enforces provider-specific output. Post-processing catches mechanical GPT artefacts. See `ai-disguise.md` §6–§8 and `harmonizing-claude-openai.md` for methodology.

---

# Part D — Governance

## 18. File Map

### Provider data files

| File                                             | Purpose                                                                            | Entries                        |
| ------------------------------------------------ | ---------------------------------------------------------------------------------- | ------------------------------ |
| `src/data/providers/providers.json`              | Master catalogue                                                                   | 40                             |
| **`src/data/providers/platform-config.json`**    | **SSOT — assembly rules, negativeSupport, limits, groupKnowledge**                 | **40 active + 5 archived**     |
| `src/data/providers/platform-config.ts`          | TypeScript adapter for platform-config.json                                        | —                              |
| `src/data/providers/platform-formats.json`       | Legacy assembly rules (**partially superseded** — still holds `_assemblyDefaults`) | 40                             |
| `src/data/providers/providers.capabilities.json` | Feature flags                                                                      | 40                             |
| `src/data/providers/icon-manifest.json`          | Icon paths                                                                         | 40                             |
| `src/data/providers/market-power.json`           | Market power data                                                                  | 40                             |
| `src/data/providers/provider-weather-map.ts`     | Weather city map                                                                   | 40                             |
| `src/data/platform-tiers.ts`                     | Tier assignments                                                                   | 4 tiers (7+1+17+15 = 40 of 40) |

### Provider UI files

| File                                                         | Purpose                                        | Lines     |
| ------------------------------------------------------------ | ---------------------------------------------- | --------- |
| `src/components/providers/provider-cell.tsx`                 | Leaderboard cell                               | ~470      |
| `src/components/providers/providers-table.tsx`               | Leaderboard table                              | ~380      |
| `src/components/providers/image-quality-vote-button.tsx`     | Vote button                                    | ~200      |
| `src/components/providers/describe-your-image.tsx`           | Human text input                               | **1,153** |
| `src/components/prompt-builder/four-tier-prompt-preview.tsx` | 4-tier cards                                   | **942**   |
| `src/components/prompts/enhanced-educational-preview.tsx`    | Prompt Lab — including negative prompt display | **1,913** |

### Outbound/affiliate files

| File                                  | Purpose            |
| ------------------------------------- | ------------------ |
| `src/app/go/[providerId]/route.ts`    | Redirect endpoint  |
| `src/hooks/use-image-quality-vote.ts` | Vote state         |
| `src/lib/vote-storage.ts`             | localStorage votes |

---

## 19. Testing & Lock-in Proofs

### Provider catalogue shape tests

- `src/data/providers/tests/providers.catalog.shape.test.ts` — Guards list length (45), required fields, types, uniqueness

### Provider capabilities shape tests

- `src/data/providers/tests/providers.capabilities.shape.test.ts` — Validates 40 entries with correct capability keys

### Provider schema tests

- `src/__tests__/providers.schema.test.ts`

### Affiliate/outbound lock-in tests (minimum set)

- `/go` returns 404 for unknown provider
- `/go` prefers `affiliateUrl` when present
- `/go` appends `click_id` and UTMs
- `/go` writes log keyed by `click_id`
- `/go` does not set cookies and returns `Cache-Control: no-store`
- UI outbound CTAs contain `/go/{id}?src=...` and do NOT contain external domains

---

## 20. Known Gaps

| #   | Gap                                                            | Status                                                                                                       |
| --- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 1   | `website` vs `url` field — `url` is legacy alias               | Documented, not removed                                                                                      |
| 2   | Canonical Provider type import                                 | RESOLVED — `@/types/provider.ts`                                                                             |
| 3   | Duplicated provider schemas                                    | RESOLVED — canonical at `providers.schema.ts`                                                                |
| 4   | Affiliate config duplication                                   | Documented, not consolidated                                                                                 |
| 5   | Consent model inconsistency (cookie vs localStorage)           | Documented, not resolved                                                                                     |
| 6   | GA4 injection unconditional                                    | Documented, not resolved                                                                                     |
| 7   | `requiresDisclosure` is `false` for all 24 affiliate providers | Needs review — some programmes may require disclosure                                                        |
| 8   | ~~`platform-tiers.ts` missing 5 platforms~~ **RESOLVED**                    | Resolved — 5 platforms removed from catalogue 26 Mar 2026                                            |
| 9   | **`platform-formats.json` still holds `_assemblyDefaults`**    | Deferred — fold into `platform-config.json` when SSOT confirmed stable                                       |
| 10  | **Master list tiers in §3 are stale**                          | 18 platforms changed tiers since v1.0.0. §3 table not updated — use §4 + `platform-tiers.ts` as ground truth |
| 11  | **My Prompts card display for negative prompts**               | Save payload includes negativePrompt, but `/studio/library` cards don't show two sections yet                |

---

## 21. Non-Regression Rules

### Provider catalogue

1. **Provider count is 45** — if adding/removing, update shape tests, this doc, and all "45 platform" references across the codebase
2. **Provider score/rank is independent of monetisation** — affiliate status must never affect scoring
3. **`localIcon` field is the primary icon source** — fallback to remote `icon` URL only if local PNG missing
4. **All outbound links through `/go/{providerId}`** — no direct external URLs in UI
5. **`affiliateUrl: null` and `requiresDisclosure: false` until affiliate approved** — no speculative affiliate links

### Tier system

6. **Tier assignments in `platform-tiers.ts` are authoritative for routing** — but `platform-config.json` is the SSOT for negativeSupport, sweetSpot, and limits
7. **Weight syntax is provider-specific** — Leonardo uses `::`, SD uses `()`, when no provider selected default to parenthetical
8. **Jasper Art is Tier 4** — not Tier 1 or Tier 3 (reclassified multiple times; code is ground truth)
9. **Luma AI has no negative prompt support** — `negativeSupport: 'none'`
   9a. **22 platforms have `negativeSupport: 'separate'`** — verified by deep research audit 29 March 2026. These platforms get the amber negative prompt window in the Prompt Lab.
   9b. ~~Resolved~~ — 5 multi-engine aggregators removed from catalogue 26 Mar 2026.

### AI Disguise

10. **Full AI Disguise specification lives in `ai-disguise.md` v5.0.0** — this doc contains summary only
11. **Algorithm names never reference "AI", "GPT", "OpenAI", or "LLM"**
12. **Post-processing is mandatory** — `postProcessTiers()` runs on all Call 2 responses

### Existing behaviour

13. **Maintain UI layout, colours, and behaviour** unless explicitly changing a feature
14. **State `Existing features preserved: Yes/No`** in every change set
15. **All sizing via `clamp()`** — no fixed px/rem per `code-standard.md`

---

## Changelog


- **23 Mar 2026 (v1.0.0):** **MERGED DOCUMENT — combines `ai_providers.md`, `ai providers affiliate & links.md`, and AI Disguise summary into single authority doc.** Updated to 40 providers (42→45: +Recraft T3, +Kling T3, +Luma AI T3, +Tensor.Art T1, −remove-bg). Jasper Art reclassified T1→T3. All tier counts verified against `platform-tiers.ts` (T1:13, T2:2, T3:14, T4:16). 14 countries (down from documented "16" — actual code shows 14 unique countryCode values). 29 cities. 24 affiliate providers listed with URLs. Provider cities table updated with Beijing (Kling), Singapore (Tensor.Art), Palo Alto (Luma AI). "Adding a provider" process expanded to 14 files (was 6). Seed data tier assignments updated with new providers. Selection limit updated to 45. Shape test note updated. AI Disguise summary added as Part C with cross-reference to `ai-disguise.md` v3.0.0. Gap #7 added (requiresDisclosure false for all affiliates).

---

_End of document._

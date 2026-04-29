# commercial-strategy.md — Promagen Commercial Strategy

**Last updated:** 28 April 2026
**Version:** 2.0.0
**Status:** AUTHORITATIVE. Supersedes `commercial-positioning.md` v1.0.0.
**Owner:** Promagen Ltd
**Authority:** This document defines what Promagen sells, to whom, on which surfaces, and the route map of the site. Code is the source of truth for current state; this doc is the source of truth for the destination.

---

## 1. The position in one paragraph

Promagen is **two products on one domain**:

1. **Sentinel** — a B2B AI Visibility Intelligence service. Audits and monitoring that tell operators whether AI engines (ChatGPT, Claude, Perplexity, Gemini) can find, read, cite, and send traffic to their content. Snapshot £495 → Audit £1,950 → Fix Sprint £3,500 → Monitor £349/month.
2. **The 40-platform AI Image Generator Leaderboard** — a consumer-facing buyer's guide that helps creators choose the right AI image platform by cost, quality, prompt format, capability, and use-case fit. Monetised by affiliate clicks routed through `/go/[providerId]`.

The leaderboard is also Sentinel's **flagship live proof exhibit** — a verifiable demonstration that we know how to make a site rank in AI engines, because we did it on our own asset.

The prompt builder is dead. The major LLMs and image platforms now rewrite prompts internally. The competitive moat collapsed. We do not compete with platform-native AI on prompt optimisation.

---

## 2. Key strategic decisions and rationale

### 2.1 Kill the prompt builder

**Decision:** The prompt builder is not the headline product, the supporting product, or any product. It is dormant code pending deletion.

**Rationale:**

- GPT-5, Claude 4.x, Gemini 2 rewrite prompts internally
- Midjourney, DALL·E, Firefly, Flux all rewrite prompts internally
- Consumer willingness to pay for "prompt optimisation" alone has collapsed
- Continuing to maintain the 3-call AI engine, 40 builder files, 12-category dropdowns, and lock-state UX is paying overhead for a feature the market routes around

**What survives the kill:**

- `platform-config.json` and per-platform metadata (negative-prompt support, prompt format tier, capability flags, sweet spots) — this is **editorial substance for the leaderboard** and must not be lost in code cleanup
- The 4-tier prompt format taxonomy (CLIP / Midjourney / Natural Language / Plain) — useful as comparison content on the leaderboard
- The negative-prompt support audit — useful as standalone authority content

**What dies:**

- `/prompt-lab`, `/providers/[id]/prompt-builder`, `/studio/playground`, `/studio/library`, `/inspire` (all routes redirected to `/platforms`)
- `/api/parse-sentence`, `/api/generate-tier-prompts`, `/api/optimise-prompt` (pending deletion)
- The 40 builder files in `frontend/src/lib/builders/` (pending deletion)
- Scene Starters, Prompt of the Moment, Engine Bay, Mission Control, Community Pulse (homepage-grid Inspire features — all gone)
- Pro Promagen subscription (`/pro-promagen`) — already demoted from sitemap and nav, pending route deletion

### 2.2 The leaderboard is the consumer hero

**Decision:** `/platforms` is the consumer-facing hero. It is a **buyer-intent leaderboard** — answers "which AI image platform is right for me?" by cost, quality, prompt format, use case, capability, and other factors.

**Rationale:**

- Buyer-intent SEO traffic ("best AI image generator for product photography") is high-value
- The 40-platform comparison content is genuinely defensible (curation, scoring methodology, use-case mapping)
- Affiliate revenue compounds passively — every page view is a potential earning event with zero per-click delivery cost
- The leaderboard is the only thing on the site that accrues SEO authority over time
- It doubles as Sentinel's live proof asset — a buyer can independently verify it ranks in ChatGPT in 30 seconds

**Required upgrades to `/platforms` (Pass 4 — separate scope):**

- Cost data per platform (£/month, £ per generation, free tier limits)
- Filterable views: by budget, use case, prompt format, negative-prompt support
- Prominent "Try [Platform]" affiliate CTA per row (currently the affiliate link is buried in the provider name)
- Tier divisions visually: Top picks / Best for X / Niche / Budget
- Cost data collection is **editorial work**, not just engineering — flag as separate scope (~1 week of curation)

### 2.3 Sentinel is the B2B commercial front door

**Decision:** `/` is pure Sentinel. No leaderboard, no Lab, no Inspire, no platform-intelligence band on the homepage.

**Rationale:**

- A creative director picking between Midjourney and Firefly is not the same person as a SaaS founder worried about whether ChatGPT mentions their product
- Mixing audiences on one page dilutes both messages
- Sentinel buyers are operators (CMO, founder, SEO lead) — they arrive via direct outreach, LinkedIn, referral, or "AI visibility" search and want to see Sentinel immediately
- Creator/leaderboard traffic arrives via SEO directly to `/platforms/compare/midjourney-vs-dalle` etc. — it never sees the homepage anyway
- The homepage's primary job is therefore **converting Sentinel buyers**, not routing two audiences

**Compromise that was rejected and why:**

- A 50/50 split-screen homepage was rejected because it makes the site look indecisive ("we couldn't decide what we are, you decide for us"). Best-in-class B2B sites have one dominant message.
- A "two doors" hero with equal-weight CTAs was rejected because it dilutes the commercial story.

**Compromise that was accepted:**

- One deliberate proof link from `/sentinel` (or homepage proof block) to the leaderboard, **mid-page, well below the fold**, framed as "verify it yourself"
- Footer Resources section (discreet, plain text, no marketing weight) linking to `/platforms`, `/providers/leaderboard`, `/guides/best-generator-for`, etc. This preserves internal-link equity for SEO without competing with Sentinel above the fold.

### 2.4 The bridge between Sentinel and the leaderboard

**Decision:** A "case study" section on `/sentinel#proof` (anchor, not separate route) that takes the Snapshot intake fields and shows them applied to Promagen's own leaderboard, with a verifiable result.

**Rationale:**

- Turns the abstract Snapshot intake list into a verifiable case study
- Replaces "trust us, we know AI visibility" with "here's exactly what we did on our own asset, ask ChatGPT and check"
- Keeps the buyer in one flow — `/sentinel` reads top-to-bottom: pitch → pillars → demo → **proof case study** → offer → deliverables → CTA
- Anchor-linked at `/sentinel#proof` so it can be shared in cold outreach (e.g. *"see the proof: promagen.com/sentinel#proof"*) without needing a separate page

**Format (the bridge content):**

| Snapshot intake field | Applied to Promagen |
|-----------------------|---------------------|
| Domain | `promagen.com` |
| Top 3 competitors | `lexica.art`, `prompthero.com`, `playground.com` (or whichever the editorial decides) |
| Priority queries | "best AI image generator", "Midjourney vs DALL·E", "AI image platforms compared" |
| Brand and entity variants | "Promagen", "promagen.com", founder name |
| Priority pages | `/platforms`, `/platforms/midjourney`, `/platforms/compare/midjourney-vs-dalle`, `/guides/best-generator-for/photorealism`, `/about/how-we-score` |
| What we did | Schema.org markup, FAQ blocks, comparison tables, fresh data, daily ISR, internal link graph, AI bot-friendly robots.txt |
| Result | Cite specific queries where Promagen appears in ChatGPT/Claude/Perplexity/Gemini answers |
| Verify it yourself | "Open ChatGPT. Ask: *what's the best AI image generator for [your category]?* See where Promagen lands." |

This is the case study. It IS the bridge between Sentinel and the leaderboard.

---

## 3. Route map (target state)

| Route | Job | Status |
|-------|-----|--------|
| `/` | Sentinel commercial homepage | Hero / Pillars / Demo / Proof / CTA / Footer |
| `/sentinel` | Sentinel deep page + bridge case study | Hero / Pillars / Demo / **Proof case study** (anchor `#proof`) / Offer stack / Deliverables / CTA |
| `/admin/sentinel` | Internal Sentinel weekly digest dashboard | Untouched, admin-only, noindex |
| `/platforms` | **Consumer hero** — 40-platform AI image generator leaderboard | Pending Pass 4 cost-data + filtering upgrade |
| `/platforms/[platformId]` | 40 platform profile pages | Authority content, affiliate CTAs |
| `/platforms/compare/[slug]` | 8 pre-rendered comparison pairs | Authority content |
| `/platforms/negative-prompts` | Negative prompt support audit | Authority content |
| `/providers/leaderboard` | Alternate leaderboard view | Authority content |
| `/providers/compare`, `/providers/trends` | Comparison/trend views | Authority content |
| `/guides/best-generator-for/*` | 4 use-case guides | Authority content |
| `/guides/prompt-formats` | Prompt format guide | Authority content |
| `/about/how-we-score` | Methodology / trust | Authority content |
| `/go/[providerId]` | Affiliate redirect with click tracking | Live infrastructure |
| **All redirected → `/platforms`** | `/prompt-lab`, `/inspire`, `/studio/playground`, `/studio/library`, `/providers/[id]/prompt-builder`, `/world-context` | Code dormant pending deletion PR |
| **Demoted, route still resolves** | `/pro-promagen` | Removed from nav and sitemap; full deletion in separate PR |

---

## 4. Navigation rules (target state)

**Top-nav (desktop ≥640px):**

`Promagen (logo) | Sentinel | About | Contact`

That is the entire top-nav. No Platforms. No Lab. No Inspire. No My Prompts.

- `Sentinel` → `/sentinel`
- `About` → `/about/how-we-score`
- `Contact` → `/sentinel#contact`

**Mobile bottom-nav (<768px):**

`Home | Sentinel | Audit | Contact`

- `Audit` is a deep-link to `/sentinel#sentinel-offer` (the offer stack)

**Footer Resources section (every page that renders the global footer):**

```
Resources
  Live leaderboard      → /platforms
  Provider rankings     → /providers/leaderboard
  Use-case guides       → /guides/best-generator-for
  Prompt format guide   → /guides/prompt-formats

About
  How we score          → /about/how-we-score
  Sentinel              → /sentinel
  Contact               → mailto:hello@promagen.com

© Promagen Ltd
```

This is the only place on `/` where Platforms appears as a link. Discreet, SEO-supporting, not competing with Sentinel above the fold.

---

## 5. Pass plan

| Pass | Scope | Status |
|------|-------|--------|
| **3a** | Strip homepage to pure Sentinel sections (Hero / Pillars / Demo / Proof / CTA / Footer). Remove IntelligenceBand, AuthorityBand, embedded Inspire grid. Simplify top-nav and mobile-nav per §4. Replace minimal Footer with Resources section. Add deliberate proof link inside `SentinelProof`. | **Not yet shipped** — interrupted mid-flight |
| **3b** | Redirect `/prompt-lab`, `/providers/[id]/prompt-builder`, `/studio/playground`, `/studio/library`, `/inspire` → `/platforms`. No code deletion. | Not started |
| **3c** | Add proof case study to `/sentinel#proof` (bridge content per §2.4) | Not started |
| **4** | Restructure `/platforms` for cost/buyer-intent. Add cost column, filters, prominent affiliate CTAs per row, tier divisions. Includes editorial work to collect cost data. | Not started — flagged as bigger scope (~1 week including editorial) |
| **5** | Delete prompt-builder code: route handlers, `/api/parse-sentence`, `/api/generate-tier-prompts`, `/api/optimise-prompt`, the 40 builder files, related components/hooks/tests. Preserve `platform-config.json` and platform metadata. | Deferred to dedicated PR |
| **6** | Delete `/pro-promagen` route, Stripe wiring, Clerk role logic, `userTier === 'paid'` branches across the codebase. | Deferred to dedicated PR |

---

## 6. Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Killing the prompt builder leaves the leaderboard without editorial substance. | `platform-config.json` survives. Per-platform negative-prompt support, format tiers, sweet spots stay. The leaderboard inherits the editorial body of work, just sheds the builder UI. |
| Pass 4 (cost-data leaderboard) blocks affiliate revenue if it slips. | Affiliate clicks already work via `/go/[id]`. Pass 4 increases CTR; absence of Pass 4 doesn't break revenue, only suppresses upside. |
| Sentinel is sold against an empty client list. | Sentinel sales is founder-led outreach plus the proof exhibit. The proof exhibit (the leaderboard) compounds even before the first sale. |
| Deleting the prompt builder code breaks the leaderboard quietly (some platform metadata flows through the same modules). | Pass 5 is a separate PR specifically scoped to the deletion. Verify leaderboard renders cleanly after each file removed. |
| Stale authority docs mislead future passes (e.g. they reference dead routes or features). | This doc supersedes `commercial-positioning.md`. Stale docs flagged for deletion in `docs/authority/` (see deletion list at the project root or the next message). |
| Audience confusion if a creator lands on `/` and sees only Sentinel. | Acceptable. SEO traffic for creators arrives directly at `/platforms/*` and `/guides/*`, not the homepage. The footer Resources section provides a discreet path for the rare creator who arrives at `/`. |

---

## 7. Non-regression rules

- Sentinel cron and library code (`frontend/src/lib/sentinel/`, `frontend/src/app/api/sentinel/`) is read-only with respect to the rest of the application. It crawls public pages as an external visitor.
- The 57 authority routes (`/platforms` hub, 40 platform profiles, 8 comparisons, 1 negative-prompts page, 1 prompt-formats guide, 4 use-case pages, 1 methodology page, 1 leaderboard page) must remain public, indexable, and SSR.
- All affiliate clicks must route through `/go/[providerId]`. UI must never link directly to a provider's `affiliateUrl`.
- The `BUILDER_FREE_FOR_EVERYONE` flag in `frontend/src/lib/usage/constants.ts` is on. Daily prompt-builder limits do not exist.
- The AuthButton white-text override in `frontend/src/components/layout/homepage-grid.tsx` (the `[&_button]:!text-white` wrapper) is critical and must not be removed.
- All `<a>` and `<Link>` elements need explicit `text-{colour}` on child `<svg>` and `<span>` — the global `body { color: #020617 }` causes inheritance issues otherwise.
- Promagen's internal engine must never be described to users as "AI", "GPT", "OpenAI", or "LLM". External AI engines (ChatGPT, Claude, Perplexity, Gemini) and AI image platforms can be named freely.

---

## 8. The selling story (compressed)

For Sentinel:

> "AI engines are becoming where buyers ask questions. ChatGPT, Claude, Perplexity, Gemini all cite specific sites in their answers. If your site isn't being cited — or worse, your competitor is — you're losing buyers you'll never even see. Sentinel tells you exactly where you stand, what's broken, and what to fix first. Then we monitor it weekly so you don't go backwards after a deploy. We did it on our own asset — Promagen's leaderboard — and you can verify it in 30 seconds by asking ChatGPT yourself."

For the leaderboard:

> "40 AI image platforms compared by cost, quality, prompt format, and use case. Independent scoring, transparent methodology. No editorial favouritism — affiliate links disclosed. Find the right platform for your workflow and budget in under five minutes."

---

## 9. Changelog

- **28 Apr 2026 (v2.0.0):** Major revision. Captures the kill-the-prompt-builder decision, the leaderboard-as-consumer-hero decision, the bridge case study format, the strict top-nav (Sentinel / About / Contact only), the mobile-nav (Home / Sentinel / Audit / Contact), and the full pass plan. Supersedes v1.0.0.
- **28 Apr 2026 (v1.0.0):** Initial commercial repositioning doc (was `commercial-positioning.md`). Established Sentinel-led hierarchy, demoted Lab to supporting role, defined homepage section order. Some content from v1.0.0 has been clarified or sharpened in v2.0.0 — particularly the kill call on the prompt builder (v1.0.0 said "demoted", v2.0.0 says "dead").

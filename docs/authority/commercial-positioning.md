# commercial-positioning.md — Promagen Commercial Position

**Last updated:** 28 April 2026
**Version:** 1.0.0
**Status:** AUTHORITATIVE. Supersedes any earlier "what Promagen is" framing in `architecture.md` (now updated to v4.0.0) and the implicit prompt-builder-first framing of the v9.0.0 homepage.
**Owner:** Promagen Ltd
**Authority:** This document defines Promagen's commercial position, the role of each surface, and the rules that govern how those surfaces may be presented.

---

## 1. Position

Promagen is an **AI Platform Intelligence and AI Visibility Intelligence** business.

It sells two things, in this order:

1. **Sentinel** — a monitoring and audit service that tells operators whether AI systems (ChatGPT, Claude, Perplexity, Gemini, AI search crawlers) can find, read, cite and send traffic to their content, and what to fix next.
2. **Platform intelligence content** — a 40-platform comparison hub, methodology, use-case guides and authority pages that serve traffic, build trust, and act as proof of expertise.

The Prompt Lab and Standard Builder remain in the product, but they are **supporting** assets — proof that Promagen understands the AI image ecosystem deeply. They are no longer the main commercial story.

---

## 2. Hierarchy (canonical)

| Rank | Asset | Commercial role | Public surface |
|------|-------|-----------------|----------------|
| 1 | Sentinel | Main product. B2B audits, fix sprints, monitoring retainers. | `/sentinel` (public landing), `/admin/sentinel` (internal digest) |
| 2 | Platform intelligence | Authority + traffic + lead capture. | `/platforms`, `/providers/leaderboard`, `/platforms/compare/*`, `/platforms/negative-prompts`, `/guides/best-generator-for/*`, `/guides/prompt-formats`, `/about/how-we-score` |
| 3 | The Lab (Prompt Lab + Standard Builder + Saved) | Supporting tool, proof of expertise, engagement, email capture. | `/prompt-lab`, `/providers/[id]`, `/studio/library` |
| 4 | Pro Promagen subscription | Consumer monetisation lane (separate scope from Sentinel). | `/pro-promagen` |

This hierarchy is the canonical answer to "what does Promagen sell?". Any surface, copy, or nav item that contradicts it must be revised — not the hierarchy.

---

## 3. Homepage rules

The homepage at `/` must lead with Sentinel and platform intelligence. As of v10.0.0 it renders the following section order, top to bottom:

1. Sentinel hero (H1 = "AI Platform Intelligence. AI Visibility Intelligence.")
2. Sentinel pillars (Watch / Detect / Cite / Report)
3. Live proof (Promagen as the case study)
4. Platform intelligence band (cards into `/platforms`, `/providers/leaderboard`, `/guides/best-generator-for`, `/platforms/negative-prompts`)
5. Inspire grid — existing `NewHomepageClient` rendered verbatim (Scene Starters, Prompt of the Moment, Providers Table, Community Pulse, Engine Bay, Mission Control)
6. Authority band (methodology, prompt-format guide, demoted Lab entry)
7. Final commercial CTA

**Rules:**

- **Must:** Sentinel sections appear above the Inspire grid. The first viewport must communicate the new commercial position.
- **Must:** All existing Inspire features remain intact and reachable. The grid is preserved verbatim — no Scene Starter, POTM, leaderboard or Pulse feature may be deleted by this repositioning.
- **Must not:** Reintroduce a "Prompt Lab" hero, headline, or primary CTA at the top of the homepage. Any prominent "Build Your Prompt" CTA inside the Inspire grid is allowed but must remain *below* the Sentinel sections.
- **Must not:** Place the finance ribbon on `/`. It belongs on `/world-context` only (unchanged from `architecture.md`).
- **Must:** Any new homepage section must obey `buttons.md` styling rules — explicit child colours on `<a>` tags, canonical purple-gradient or engine-bay-style buttons.

---

## 4. Sentinel page (`/sentinel`)

The public Sentinel page must contain, in order:

1. Hero (`variant="product"`) — same headline as homepage.
2. Pillars — what Sentinel actually checks.
3. Proof — Promagen as the live case study.
4. Offer stack — Snapshot, Audit, Fix Sprint, Monitor.
5. Deliverables — what the buyer actually receives in their inbox.
6. CTA — single conversion target (currently a `mailto:` until a booking flow exists).

**Rules:**

- **Must:** Be public, indexable (`robots: index, follow`).
- **Must:** Be a separate route from `/admin/sentinel`. The internal dashboard is admin-only and must remain `noindex`.
- **Must not:** Contain or link to any internal Sentinel data (run IDs, regression tables, customer domains). It is a sales surface only.
- **Must:** State delivery channel and pricing transparently. No "contact for pricing" theatre at the snapshot or audit tier.
- **Must:** Keep prices in line with the deep-research-recommended ladder (Snapshot £495, Audit £1,950, Fix Sprint £3,500, Monitor £349/mo) until a deliberate, documented price change is made here.

---

## 5. Lab demotion rules

The Prompt Lab and the Standard Builder must remain technically intact. The repositioning is **commercial framing only**.

**Allowed (and required):**

- Lab continues to serve at `/prompt-lab`, `/providers/[id]`, `/studio/library`.
- Top-nav and mobile-nav include a "Lab" entry, demoted in size and ordering relative to Sentinel.
- Authority band on `/` includes a Lab card alongside methodology and the prompt-format guide.
- All Lab features (4-tier prompts, 12 categories, paid tier behaviour from `paid_tier.md`) continue exactly as specified by `prompt-lab.md` and `prompt-builder-page.md`.

**Forbidden:**

- Removing the Lab routes.
- Removing `incrementLifetimePrompts()` calls (still required by `paid_tier.md`).
- Adding new prompt-builder-led copy to the homepage hero, headline, or first CTA.
- Renaming the Lab in a way that hides the underlying capability (e.g. burying it as "Tools").

---

## 6. Authority pages (unchanged)

The 57 crawlable authority routes defined in `promagen-ai-authority-pages-FINAL-v2_0_0.md` remain canonical. Nothing in this repositioning may delete, gate, deindex, or paywall any of them. They are the substrate Sentinel monitors and the traffic engine the new commercial position depends on.

---

## 7. Paid Tier (unchanged)

`paid_tier.md` remains the sole authority for in-app Pro Promagen subscription behaviour. Sentinel audits and monitoring are a **separate B2B service** sold through `/sentinel` and do not modify, gate, or extend the Pro Promagen consumer matrix in any way. No implied paywalls. The "anything not in `paid_tier.md` is free" rule is unchanged.

---

## 8. AI Disguise (unchanged, with clarification)

`promagen-ai-authority-pages-FINAL-v2_0_0.md §3.4` already permits free reference to "AI image generators" and external AI systems on authority pages. The same rule applies to all new Sentinel and homepage copy:

- **Allowed:** Naming external systems — ChatGPT, Claude, Perplexity, Gemini, AI image platforms — and using phrases like "AI Visibility Intelligence", "AI crawlers", "AI engines".
- **Forbidden:** Any copy that reveals or implies Promagen's *internal* engine uses GPT/OpenAI/LLMs.

The new Sentinel and homepage copy was written under this rule and stays inside it.

---

## 9. Navigation rules

**Top-nav (desktop, ≥640px):**

`Promagen` (logo) | **Sentinel** | Platforms | Lab | My Prompts (≥768px)

- Sentinel is visually emphasised (sky-tinted gradient border) and ordered first after the logo.
- Platforms is the secondary intelligence entry.
- Lab is third, in standard nav styling.
- My Prompts is hidden below md to save space.

**Mobile bottom-nav (<768px):**

Home | **Sentinel** | Pro | Lab | Saved

- Five slots. Sentinel takes the second slot.
- Lab keeps the fourth slot but loses any "Desktop" badge — it is no longer the headline product.
- Active state styling unchanged from v1.0.

---

## 10. Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Inspire grid breaks because it's now inside a scrollable shell. | Inspire grid is rendered with `min-height: 100vh` so `HomepageGrid` retains a viewport-sized parent. No homepage-grid code is modified. |
| Authority pages get deindexed or hidden by the new top-nav. | "Platforms" link added to top-nav. Authority band on `/` exposes methodology + guides. Sitemap and robots.txt unchanged. |
| Pro Promagen consumer flow conflicts with Sentinel sales messaging. | Sentinel is a B2B service offer with separate CTAs and pricing. `paid_tier.md` is untouched. `/pro-promagen` is unchanged. |
| Lab traffic drops to zero because it's demoted. | Lab keeps a top-nav entry, mobile-nav slot, and a homepage authority-band card. The route, the engine, and the Pro tier behaviour are unchanged. |
| Sentinel landing page makes promises Sentinel can't deliver multi-tenant yet. | Pricing is presented as service pricing with founder-led delivery. The page does not claim self-serve dashboards or multi-domain SaaS. |

---

## 11. Non-regression rules

- **Must:** Any change that contradicts §2 (hierarchy), §3 (homepage rules), §4 (Sentinel page rules), or §5 (Lab demotion rules) requires a same-PR update to this document.
- **Must:** All edits to homepage, top-nav, mobile-bottom-nav, or `/sentinel` reference this doc as authority in the file header.
- **Must not:** Reframe Promagen as primarily a prompt-builder product on any public surface.
- **Must not:** Introduce paid behaviour that contradicts `paid_tier.md`.
- **Must not:** Modify the Inspire grid's component contract (`NewHomepageClient` props) without a separate PR motivated by an Inspire-specific change.

---

## 12. Changelog

- **28 Apr 2026 (v1.0.0):** Initial commercial repositioning. Established Sentinel-led hierarchy. Defined homepage section order. Added `/sentinel` public landing as the canonical product page. Demoted Prompt Lab to supporting role. Updated `architecture.md` to v4.0.0 to reflect the new position.

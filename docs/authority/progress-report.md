# Promagen Progress Report

**Last updated:** 19 March 2026 (evening)  
**Current score:** 79/100 ↑  
**Target:** 85+ (achievable with Image Gen live + YouTube content)  
**Owner:** Martin Farrell (solo founder)  
**Purpose:** Track what's done, what moves the score, and what's deferred. Updated after every major build session.

---

## Score Breakdown

| Category                                  | Score | Weight   | Notes                                                                                                                            |
| ----------------------------------------- | ----- | -------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Engineering quality & prompt engine depth | 93    | High     | Dedup fix, word-boundary fix, test suite green (132 suites, 2,317 tests). 45 platforms, 17 algorithmic systems, 4-tier pipeline. |
| Visual design & UI polish                 | 83    | High     | Pro page, glow patterns, colour coding, dark icon visibility fix — professional. Some rough edges remain.                        |
| Free-to-paid conversion gap               | 58    | Critical | Weakest link. Free user gets full builder + all terms. Image Gen will fix this.                                                  |
| Discoverability & first-visit clarity     | 71    | Critical | Massively improved from wall-of-data homepage. Still complex for cold visitor.                                                   |
| Content & data richness                   | 90    | Medium   | 45 providers, 200 scenes, 9,000+ phrases, live weather, real financial data.                                                     |

---

## What's Done (Shipped)

### Core Product

- [x] Prompt builder with 12 categories, 45 platform-specific configurations
- [x] One Brain architecture (`assemblePrompt()` — single assembly path, cross-source dedup)
- [x] 4-tier prompt system (CLIP, Midjourney, Natural Language, Plain Language)
- [x] Prompt optimizer with 56-rule compression engine
- [x] Weather intelligence engine (17 algorithmic systems, live OpenWeatherMap data)
- [x] 200 Scene Starters across 23 worlds (25 free, 175 Pro)
- [x] Explore Drawer with 9,058+ vocabulary phrases and cascading intelligence
- [x] Prompt of the Moment (102-city rotation, 3-minute cycle)
- [x] Community Pulse (8-card feed, user-submitted prompts)
- [x] AI Provider Leaderboard (45 providers, Elo-ranked by community, dark-icon visibility fix)
- [x] Like system with voting, session persistence, and Pro vote weight (1.5×)
- [x] Feedback widget (👍👌👎) wired to learning pipeline
- [x] Live exchange cards (16 cities, clocks, weather, market status, indices)
- [x] FX ribbon, commodity movers, crypto chips
- [x] Saved Prompts library with folders

### Pro Promagen

- [x] Stripe integration live (£15.99/month, £149.99/year, 7-day trial)
- [x] Pro page with 9 feature cards (3×3 grid) + hover preview system
- [x] Debounced intent pattern (150ms) replacing failed intent triangle
- [x] 8 preview panels: Daily, Format, Scenes, Exchanges, Saved, Lab, Frame, Image Gen
- [x] Image Gen preview — 5 real AI-generated images, blur-to-sharp animation, crossfade rotation
- [x] Colour-coded prompt anatomy (Pro exclusive, both builders, word-boundary-safe parser)
- [x] Pro Gem Badge (6 tiers by lifetime prompt count)
- [x] Global prompt tier selection (persists across all surfaces)
- [x] Exchange customisation (0–16, continental picker)
- [x] Prompt Stacking (+1 on 7 categories)
- [x] Prompt Lab (Pro exclusive)
- [x] Scene Starters Pro gate (175 locked scenes with upgrade path)

### Infrastructure

- [x] Clerk auth (anonymous → free → Pro tier progression)
- [x] Vercel deployment with Skew Protection
- [x] Fly.io gateway for weather data
- [x] GA4 + GTM analytics
- [x] Jest test suite (132 suites, 2,317 tests passing)
- [x] 65+ authority documents

---

## What Moves the Score (Priority Order)

### → 78 to 82: Quick wins (days, not weeks)

| Item                                                   | Impact             | Effort | Score lift |
| ------------------------------------------------------ | ------------------ | ------ | ---------- |
| YouTube video #1: "What is Promagen" (2-min explainer) | Discoverability +5 | 1 day  | +2         |
| YouTube video #2: "Build a prompt in 60 seconds"       | Discoverability +3 | 1 day  | +1         |
| Affiliate links on all 45 providers (`/go/` routes)    | Revenue stream     | 1 day  | +1         |
| Reddit/X/HN launch posts (marketing.md strategy)       | Distribution       | 1 day  | +1         |

### → 82 to 85: Medium builds (1–2 weeks)

| Item                                               | Impact             | Effort  | Score lift |
| -------------------------------------------------- | ------------------ | ------- | ---------- |
| **Image Gen BYOAPI (real feature)**                | Conversion gap +15 | 2 weeks | +3         |
| Pro trial friction — show colour preview then gate | Conversion gap +5  | 3 days  | +1         |
| Public changelog page                              | Trust + SEO        | 2 days  | +0.5       |

### → 85 to 90: Bigger moves (weeks to months)

| Item                                                   | Impact                   | Effort  | Score lift |
| ------------------------------------------------------ | ------------------------ | ------- | ---------- |
| 5+ YouTube videos (prompt engineering tutorial series) | Distribution + authority | Ongoing | +2         |
| Stripe affiliate referral system                       | Viral growth loop        | 1 week  | +1         |
| Homepage A/B test (cold visitor conversion)            | First-visit clarity      | 1 week  | +1         |
| SEO content pages (platform comparison, prompt guides) | Organic traffic          | Ongoing | +2         |

---

## Deferred Items (Parked, Not Forgotten)

| Item                                                                   | Why deferred                                    | Revisit when                |
| ---------------------------------------------------------------------- | ----------------------------------------------- | --------------------------- |
| Conversion learning system (10-part build plan)                        | Plan complete, not yet built — Martin reviewing | After plan approval         |
| Commodity card consumer product mapping                                | Needs proper retail price research, not guessed | Time available for research |
| Ask Promagen (LLM-powered suggestions)                                 | Cost control needed first                       | Revenue covers API spend    |
| Gallery Mode (AI-generated backgrounds)                                | ~$36/month image generation cost                | Paying users offset cost    |
| Prompt Lab auth gating                                                 | Not yet enforced                                | Before public launch        |
| L8 Learning Pipeline wiring in Prompt Lab                              | Pending from evolution-plan-v2                  | After Pro page complete     |
| All 4 tier badges in Explore Drawer                                    | Must ship before evolution-plan-v2 ends         | Next build session          |
| Cascade relevance chip ordering in Explore Drawer                      | Must ship before evolution-plan-v2 ends         | Next build session          |
| Codebase cleanup (9 dead hooks ~1,073 lines, 9 FX picker ~2,690 lines) | PowerShell commands ready                       | Next cleanup session        |
| Pro monthly price point finalisation                                   | Currently £15.99 — market test needed           | After first 50 subscribers  |
| Free trial policy decision                                             | 7-day trial active — monitor conversion         | After 30 days of data       |

---

## Open Marketing Questions

| Question                  | Options                                 | Status                  |
| ------------------------- | --------------------------------------- | ----------------------- |
| Pro monthly price         | £15.99 (current) vs £9.99 vs £7.99      | Live at £15.99, monitor |
| Free trial length         | 7 days (current) vs 14 days vs none     | Live at 7 days, monitor |
| Public changelog          | Yes (builds trust + SEO) vs No (effort) | Undecided               |
| Stripe affiliate referral | Build vs defer                          | Undecided               |

---

## Session Log

| Date              | Session                        | Key deliverables                                                                                                                                                                                                                                                                   |
| ----------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 19 Mar 2026 (eve) | Bug fixes + leaderboard polish | Dark provider icon visibility fix (inline bg pad + ring + glow), DreamStudio 🏠→real icon, prompt dedup fix in assembleKeywords, word-boundary fix in colour parser, Daily Prompts pill button, test suite 9 failures→0 (4 test files updated), conversion learning plan discussed |
| 19 Mar 2026 (am)  | Pro page Image Gen preview     | Vote Power removed, Image Gen card added, 5 real AI images, blur-to-sharp animation, crossfade rotation, 5 authority docs updated                                                                                                                                                  |
| 18 Mar 2026       | Pro page overhaul              | Daily Prompts preview, debounced intent v5, Pro Gem Badge, Prompt Lab parity, colour-coded prompts, tier sync, Frame preview, Exchanges preview                                                                                                                                    |
| 17 Mar 2026       | Colour-coded prompts           | Category colours as Pro feature, both builders, SSOT in prompt-colours.ts, hover bridge pattern                                                                                                                                                                                    |
| 16 Mar 2026       | Stripe integration             | Live payments, checkout flow, webhook, customer portal, cancellation policy                                                                                                                                                                                                        |
| 15 Mar 2026       | Pro page layout                | 1/3–2/3 split, feature control panel v2, exchange picker continental grouping                                                                                                                                                                                                      |

---

## Score History

| Date              | Score | Reason for change                                                                                                          |
| ----------------- | ----- | -------------------------------------------------------------------------------------------------------------------------- |
| 19 Mar 2026 (eve) | 79    | Prompt engine dedup + word-boundary fix, test suite fully green, dark icon fix, provider catalog 42→45, pill button polish |
| 19 Mar 2026 (am)  | 78    | Image Gen preview, 8 working preview panels, real AI images, 5 docs updated                                                |
| Pre-19 Mar        | ~72   | Pro page functional but Vote Power weak, no Image Gen, grey text violations                                                |
| Pre-17 Mar        | ~68   | No colour coding, no preview panels, basic comparison table                                                                |
| Pre-16 Mar        | ~62   | No Stripe, no payment flow, Pro page was placeholder                                                                       |

---

## Changelog

- **19 Mar 2026 (v1.1.0):** Score 78→79. Evening session: prompt engine dedup fix (qualitySuffix × user fidelity), word-boundary fix in colour parser ("textures" no longer split by "text" negative), dark provider icon visibility (inline bg pad on all 45 icons), DreamStudio emoji→real icon, Daily Prompts pill button, test suite restored to green (132 suites, 2,317 tests). Provider catalog expanded 42→45 (recraft, kling, luma-ai, tensor-art). Conversion learning build plan discussed (not yet built).
- **19 Mar 2026 (v1.0.0):** Initial document. Score 78/100. Comprehensive status of all shipped features, prioritised improvement roadmap, deferred items tracker, marketing questions, session log, score history.

---
name: sentinel-readiness
description: Apply when working on any surface that affects Sentinel's commercial readiness — `/sentinel`, `/`, the offer stack, the proof case study at `/sentinel#proof`, the contact / booking flow at `/sentinel#contact`, the deliverables block, the Sentinel hero, or any change that affects whether a B2B buyer can complete the journey from "what is this?" → "I trust this" → "I'll buy this" → "I'm onboarded". Tracks the gap between "Sentinel exists in code" and "Sentinel can sell". Promagen's commercial pivot depends on closing this gap.
type: workflow
---

# sentinel-readiness — gating the Sentinel commercial surface for first-customer fitness

Promagen's homepage is now Sentinel-led. The `/sentinel` deep page exists. The Sentinel cron and library are live. The leaderboard is the proof exhibit. **What's missing is whether a buyer arriving cold can actually complete the purchase journey.**

This skill is the customer-readiness rubric. It governs every change to the Sentinel commercial surface (homepage, `/sentinel`, the offer stack, the case study, the booking flow, the post-purchase intake) and asks one question per change:

> Does this make it easier or harder for a stranger to become Promagen's first paying Sentinel customer?

If the answer is "harder", flag and fix before merge. If the answer is "easier", note the improvement under `Decisions made`. If the answer is "neutral but unblocking other work", acceptable.

---

## 0. When this skill applies

**Apply when the change touches any of:**

- `frontend/src/app/page.tsx` (Sentinel-led homepage)
- `frontend/src/app/sentinel/page.tsx` (Sentinel deep page)
- `frontend/src/components/sentinel/**` — every Sentinel UI component:
  - `sentinel-hero.tsx`
  - `sentinel-pillars.tsx`
  - `sentinel-demo.tsx`
  - `sentinel-proof.tsx`
  - `sentinel-case-study.tsx`
  - `sentinel-offer-stack.tsx`
  - `sentinel-deliverables.tsx`
  - `sentinel-cta.tsx`
  - `dashboard.tsx` (admin only — Sentinel-readiness checks not relevant here)
- `frontend/src/components/home/sentinel-led-homepage.tsx`
- The contact target referenced by `/sentinel#contact` (currently `mailto:hello@promagen.com?subject=Sentinel%20enquiry`; future: Cal.com / Tally / form)
- Any pricing copy or offer description (Snapshot £495 / Audit £1,950 / Fix Sprint £3,500 / Monitor £349/month)
- Authority pages that the Sentinel proof case study references: `/platforms`, `/providers/leaderboard`, `/about/how-we-score`, comparison pages
- `/admin/sentinel/page.tsx` (the internal dashboard — relevant when Sentinel-readiness for **delivery** is being assessed, not customer-facing readiness)

**Do NOT apply to:**

- Builder, Pro tier, or other dormant surfaces
- `/admin/**` non-Sentinel pages
- Sentinel cron / library internals (read-only — see CLAUDE.md)

---

## 1. The customer-readiness bar

A Sentinel buyer arriving cold (from outreach, from a search result, from a referral, from the proof exhibit) must be able to complete the following five gates without friction. Each is a section of this skill.

| # | Gate | Surface | Pass criterion |
|---|------|---------|----------------|
| 1 | **Discover** | Homepage / `/sentinel` hero | "What is this and is it for me?" — answered in 5 seconds, above the fold |
| 2 | **Understand** | Pillars + Demo + Deliverables | "What exactly will I get?" — answered in 60 seconds |
| 3 | **Trust** | Proof + Case study + Methodology | "Why should I believe this works?" — answered with verifiable evidence |
| 4 | **Buy** | Offer stack + CTA + Booking flow | "How do I start?" — frictionless path to commitment |
| 5 | **Onboard** | Post-purchase intake + delivery cadence | "What happens after I pay?" — clear delivery, expectation-set |

A Sentinel-readiness review checks each gate. Any gate that fails is a Blocker.

---

## 2. Gate 1 — Discover

The hero (homepage and `/sentinel`) is the answer to "what is this?". It must:

### 2.1 Hero copy quality bar

- **Headline** names the category clearly. Current: *"AI Platform Intelligence. AI Visibility Intelligence."* Verify it stays that way unless brand decision authorises change.
- **Sub-headline** states what Sentinel does in plain English. Current: *"Sentinel watches whether AI systems can find, read, cite and send traffic to your content — then tells you exactly what to fix next, every week."*
- **Supporting line** establishes proof. Current: *"Built and battle-tested on Promagen itself: 57 authority pages, 40-platform intelligence..."*
- **Eyebrow** signals product or homepage variant. Current: *"Sentinel — by Promagen"* (product) / *"Now from Promagen"* (homepage).

### 2.2 Hero CTA quality bar

Two CTAs, distinct purpose:

- **Primary** (sky/emerald/indigo gradient, rounded-2xl): *"See packages and pricing"* (product variant) or *"See Sentinel"* (homepage variant). Routes to `#sentinel-offer` or `/sentinel`.
- **Secondary** (purple/pink, rounded-full): *"Browse 40-platform intelligence"*. Routes to `/platforms` (the proof exhibit).

The secondary CTA exists because the leaderboard is the *proof*, not the offer. A buyer can verify Promagen's claim before committing. Removing it weakens the trust case.

### 2.3 Reassurance bullet strip

Three claims with emerald checkmarks (*"Weekly action report"*, *"ChatGPT · Claude · Perplexity · Gemini citation tracking"*, *"Live on Promagen as proof"*). Each bullet must remain truthful. If the live cadence becomes biweekly, the bullet is wrong. If a citation tracker for one of the four engines breaks, the bullet is wrong.

### 2.4 Discover-gate failure modes

| Failure | Severity | Fix |
|---------|----------|-----|
| Hero headline doesn't say what category Sentinel is in | Blocker | Restore "AI Visibility Intelligence" or equivalent |
| Sub-headline uses jargon a non-technical SaaS founder can't parse | High | Plain-English rewrite; test against the 5-second comprehension bar |
| Hero CTA points to a 404 or dead anchor | Blocker | Fix the target |
| Eyebrow / hero says "AI" or "GPT" describing Promagen's *internal* engine | Blocker | AI Disguise rule (CLAUDE.md). Refer to external AI engines freely; not Promagen's own optimiser |
| No proof reference in hero | High | Reinstate the "battle-tested on Promagen itself" line |
| Both CTAs route to the same destination | Medium | They must distinguish "buy" vs "verify" intent |

---

## 3. Gate 2 — Understand

Pillars + Demo + Deliverables answer "what will I get?". Together they take a buyer from "I see what this is" to "I see what I'd pay for".

### 3.1 Pillars

The four pillars (Watch / Detect / Cite / Report — verify against `sentinel-pillars.tsx`) describe Sentinel's mechanism. Each pillar is short, concrete, and verifiable. Don't dilute by adding a fifth pillar without strategic reason.

### 3.2 Demo

Demo shows a page audit + a Monday report (per `sentinel-demo.tsx`). It must:

- Show enough specificity that the buyer recognises their own surface ("yes, my Next.js / WordPress / Webflow site has those properties").
- Not show internal Sentinel run IDs, customer domains, or admin-only data.
- Be reproducible — if the demo claims "we found 12 schema gaps on this page", a buyer should be able to ask "what gaps did you find on mine?" and get a coherent answer in the discovery call.

### 3.3 Deliverables

Deliverables (per `sentinel-deliverables.tsx`) answer "what will I receive". Each tier's deliverables must:

- Be physically deliverable (a PDF, a markdown report, a Loom video, a 30-min call).
- Match the price (Snapshot £495 = ~3 hours of work; Audit £1,950 = ~1 day; Fix Sprint £3,500 = ~2 days of implementation; Monitor £349/mo = automated weekly + ~1 hour of review).
- Be falsifiable on completion ("you said you'd deliver X; here is X").

### 3.4 Understand-gate failure modes

| Failure | Severity | Fix |
|---------|----------|-----|
| Demo shows fake/lorem data | Blocker | Use real Promagen leaderboard data or anonymised sample |
| Demo leaks customer/internal data | Blocker | Redact; show public proof only |
| Deliverables list internal jargon (e.g. "JSON-LD audit") without translation | High | Add buyer-language equivalent ("Structured-data audit so AI engines can quote your content") |
| Pillars overlap (two pillars saying the same thing in different words) | Medium | Tighten to four distinct pillars |
| Deliverables mention features that don't exist | Blocker | Remove or build the feature |

---

## 4. Gate 3 — Trust

Proof and case study answer "why should I believe this works?".

### 4.1 The proof case study at `/sentinel#proof`

Per `commercial-strategy.md` §2.4 and `sentinel-case-study.tsx`, the case study is **Promagen's own audit applied to Promagen's own asset**. It must:

- Reference the Snapshot intake fields (domain, top 3 competitors, priority queries, brand variants, priority pages).
- Show what Promagen did (schema markup, FAQ blocks, comparison tables, fresh data, daily ISR, AI bot-friendly robots.txt).
- Show the result: specific queries where Promagen appears in ChatGPT/Claude/Perplexity/Gemini answers.
- Include the "verify it yourself" line: *"Open ChatGPT. Ask: what's the best AI image generator for [your category]? See where Promagen lands."*

This is the substance of the trust case. Removing or weakening it breaks the entire commercial argument.

### 4.2 Methodology link

Every claim about ranking, citation, or recommendation links to `/about/how-we-score`. This is the structured trust signal — both for buyers and for AI engines.

### 4.3 Live proof must stay live

The leaderboard at `/platforms` is the proof exhibit. It must be:

- Public, indexable, SSR (per `ai-visibility/SKILL.md`).
- Up-to-date — `dateModified` reflects the actual last update.
- Verifiable — the citation share table on `/sentinel#proof` must match what a buyer would actually see if they ask the named AI engines.

If the leaderboard is regressed (stale data, broken affiliate routing, hidden behind auth), the proof case study lies. Sentinel-readiness fails.

### 4.4 Trust-gate failure modes

| Failure | Severity | Fix |
|---------|----------|-----|
| Proof case study claims a query result that's no longer true | Blocker | Re-run the citation check; update the case study |
| `/platforms` is regressed (slow, broken, missing data) | Blocker | Fix `/platforms` — it's the proof |
| Case study omits the "verify it yourself" line | High | Restore — this is the trust unlock |
| Methodology page (`/about/how-we-score`) is unreachable from a sales surface | High | Restore link |
| Citation share data is fabricated, not measured | Blocker | Replace with measured data; ship a regression check |
| Affiliate disclosure missing on the proof exhibit | High | Add disclosure |
| Case study leaks Sentinel customer data | Blocker | Use Promagen-as-its-own-customer only until first paid customer signs case-study release |

---

## 5. Gate 4 — Buy

Offer stack + CTA + booking flow turn understanding into commitment.

### 5.1 Offer stack at `/sentinel#sentinel-offer`

Four tiers (per `sentinel-offer-stack.tsx`):

| Tier | Price | Cadence | What |
|------|-------|---------|------|
| Snapshot | £495 | One-off | Quick visibility check |
| Audit | £1,950 | One-off | Deep audit + prioritised fix list |
| Fix Sprint | £3,500 | One-off | Audit + implementation of priority fixes |
| Monitor | £349/month | Recurring | Weekly automated monitoring + review |

Each tier must:

- Have a clear scope statement.
- Have a clear deliverables list (mirrored in `sentinel-deliverables.tsx`).
- Have a CTA that leads to the booking flow.
- Show the price prominently (per CLAUDE.md AI-visibility rules; pricing must be in HTML, not loaded post-hydration).

### 5.2 The booking flow

Currently `/sentinel#contact` resolves to `mailto:hello@promagen.com?subject=Sentinel%20enquiry`. This is a placeholder — it works, but it doesn't pre-qualify the buyer.

**Pending replacement**: a Cal.com / Tally / form-based booking flow that captures intake fields (per Snapshot intake list in `commercial-strategy.md` §2.4). When this is implemented:

- Form must capture: domain, top 3 competitors, priority queries, brand variants, contact details.
- Form must validate (no missing required fields).
- Form must hand off to a calendar booking on submit (Cal.com is the recommended provider per `SKILLS.md`).
- Submission must trigger a confirmation email to the buyer **and** a notification to Promagen ops.
- No PII stored beyond what's needed; GDPR-compliant footer.

### 5.3 Stripe / payment flow

Currently absent or stub. When wired:

- Snapshot and Audit can use Stripe Checkout (one-off charges).
- Fix Sprint should be invoice-based at the price point (£3,500 is closer to a contract than a checkout).
- Monitor uses Stripe Subscriptions (£349/month).
- Fulfilment of payment kicks off the intake form delivery, not the other way round.

The Stripe deletion decision (per yesterday's handover) is a separate scope. This skill only requires that *if* Stripe is wired, it routes to a clear deliverable.

### 5.4 Buy-gate failure modes

| Failure | Severity | Fix |
|---------|----------|-----|
| Offer stack pricing not in initial HTML (loaded post-hydration) | Blocker | Server-render pricing |
| CTA points to a broken anchor | Blocker | Fix |
| Booking flow drops the user without confirmation | Blocker | Add confirmation page + email |
| Booking form captures sensitive data without GDPR consent | Blocker | Add explicit consent; reduce captured data |
| Stripe checkout charges before any intake form is filled | High | Reorder: payment after intake (or intake captured at payment) |
| One tier's deliverables don't match its price | Medium | Re-balance scope vs price |
| No escape hatch for "I want to talk before I buy" | Medium | Add a "Book a 15-min discovery call" link |

---

## 6. Gate 5 — Onboard

The fifth gate is the post-purchase experience. It's the gate most often overlooked, and the one that determines whether the first customer becomes a case study or a refund.

### 6.1 The intake form (per `commercial-strategy.md` §2.4)

After payment (or as part of the booking flow), capture:

- Domain to audit
- Top 3 competitors
- 8–12 priority queries (the questions buyers ask AI engines)
- Brand and entity variants
- Geographic focus
- Priority pages (5–15 URLs)
- Stakeholder contact for delivery handoff

Missing intake fields are *the* most common cause of slipped audit deadlines. The intake form must validate completeness before letting the customer hit "submit".

(Future: `.claude/commands/sentinel-intake-validate` slash command — see `SKILLS.md` §3.5.)

### 6.2 Delivery cadence per tier

Set expectations clearly at purchase:

- Snapshot: delivered within 5 working days of intake completion.
- Audit: delivered within 10 working days.
- Fix Sprint: 10-day kickoff + 10-day implementation; total 20 working days.
- Monitor: first weekly report within 7 days of subscription start.

### 6.3 Communication cadence

- Acknowledgement on intake submit (auto).
- Mid-delivery check-in for Audit + Fix Sprint (manual).
- Delivery handoff (Loom or live call recommended for Audit+).
- 30-day follow-up: case-study request (with explicit opt-in).

### 6.4 Onboard-gate failure modes

| Failure | Severity | Fix |
|---------|----------|-----|
| Customer pays, no intake form arrives | Blocker | Trigger intake on payment success |
| Intake form lets customer submit with missing required fields | Blocker | Add validation |
| No delivery-cadence statement at purchase | High | Add to offer stack and post-purchase email |
| No 30-day follow-up | Medium | Add to ops checklist (not necessarily code) |
| Refund policy unstated | High | State on offer stack: refund window if delivery fails |

---

## 7. Pre-launch readiness checklist

Before Sentinel is opened to first-customer outreach, run this:

```
DISCOVER
[ ] Hero headline names the category clearly (AI Visibility Intelligence)
[ ] Sub-headline parseable in 5 seconds by a non-technical founder
[ ] Two distinct CTAs (buy + verify) both work
[ ] Reassurance bullets all true and verifiable
[ ] No "AI/GPT/OpenAI/LLM" describing Promagen's internal engine

UNDERSTAND
[ ] Four pillars present, distinct, concrete
[ ] Demo uses real (not fake) data
[ ] Deliverables match prices (effort vs cost)
[ ] No undelivered features promised

TRUST
[ ] Proof case study at /sentinel#proof present
[ ] Case study cites specific queries and results
[ ] "Verify it yourself" line included
[ ] Methodology link reachable from sales surfaces
[ ] /platforms (the proof exhibit) is fast, indexable, SSR
[ ] Affiliate disclosure visible on every commercial surface
[ ] Citation share data is measured, not fabricated

BUY
[ ] Pricing in initial HTML on every tier
[ ] CTAs route to working anchors
[ ] Booking flow exists (mailto OR Cal.com OR form)
[ ] Booking confirmation reaches buyer
[ ] Booking notification reaches Promagen ops
[ ] GDPR/cookie consent respected

ONBOARD
[ ] Intake form captures all Snapshot intake fields
[ ] Intake form validates completeness
[ ] Delivery cadence stated per tier
[ ] Acknowledgement email sent on intake
[ ] Refund policy stated
```

When all 25 boxes tick, Sentinel is first-customer-ready.

---

## 8. Anti-patterns — flag in review

| Anti-pattern | Severity |
|--------------|----------|
| Sentinel hero starts selling the prompt builder | Blocker |
| Pricing loaded via client-side fetch (not in HTML) | Blocker |
| Proof case study makes claims that ChatGPT can disprove right now | Blocker |
| Booking flow has no confirmation | Blocker |
| Demo uses lorem ipsum or "sample data" | High |
| Offer stack tier without deliverables list | High |
| Methodology link missing from a sales surface | High |
| Affiliate disclosure removed from a commercial surface | High |
| Hero CTA copy is generic ("Get started", "Learn more") with no specificity | Medium |
| Reassurance bullets list a feature not yet shipped | High |
| Proof case study buried below 1500 chars of preamble | Medium |
| Multiple competing CTAs above the fold (more than 2) | Medium |

---

## 9. Verification

For Sentinel-readiness changes:

1. **`pnpm run build`** — must pass.
2. **`pnpm run typecheck && pnpm run lint`** — pre-approved gates.
3. **Visit `/` and `/sentinel` in dev** — walk the five gates manually:
   - 5-second test on the hero
   - 60-second test on pillars + demo + deliverables
   - "Verify it yourself" — actually open ChatGPT and ask the named query
   - Click every CTA, confirm destination
   - Submit the booking form (or open the mailto), confirm landing
4. **Cite-check** — open ChatGPT/Claude/Perplexity/Gemini, run the priority queries from the case study, confirm Promagen still ranks. If regressed, fix the underlying surface (`/platforms`, comparison pages) before merging case-study claims.
5. **Mobile + desktop** — Sentinel is sold to operators on both; the hero, pillars, and offer stack must work in `<768px` and `≥1280px` viewports.
6. **AI-visibility cross-check** — every Sentinel-readiness change is also subject to `ai-visibility/SKILL.md`. Verify against that skill's rubric.

---

## 10. Output format — code review

Append to the diff summary:

```text
Sentinel Readiness Review
  Discover gate:   pass / concern / fail — <reason>
  Understand gate: pass / concern / fail — <reason>
  Trust gate:      pass / concern / fail — <reason>
  Buy gate:        pass / concern / fail — <reason>
  Onboard gate:    pass / concern / fail — <reason>

  Pricing in HTML (not post-hydration): yes / no
  CTAs all reachable:                   yes / no
  Proof case study verifiable today:    yes / no / n/a
  Affiliate disclosure intact:          yes / no
  Methodology link reachable:           yes / no
  AI Disguise respected:                yes / no
  Booking flow functional:              yes / no / n/a

Findings:
  1. [Severity: Blocker/High/Medium/Low]
     File: <path:line>
     Gate: Discover/Understand/Trust/Buy/Onboard
     Issue:
     Why it matters:
     Safest fix:

Existing features preserved: Yes/No
Behaviour change: Yes/No
First-customer-readiness delta: improved / neutral / regressed
```

---

## 11. The honest test

Before merging a change covered by this skill, ask:

> "If a stranger landed on `/sentinel` cold right now, could they go from never-heard-of-this to paying customer without ever needing to talk to a human?"

If yes — Sentinel is genuinely sellable. If no — find the gate that breaks, name it, fix it.

Until that question can be answered "yes" for at least the Snapshot tier, Sentinel-readiness is the highest-leverage workstream on the project. Every code change should either close one of the five gates or stay clear of them.

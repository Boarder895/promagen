# Vercel Pro for Promagen — Feature Map & Optimisation Playbook

**Last updated:** 9 April 2026  
**Owner:** Promagen  
**Version:** 2.0.0  
**Authority scope:** Vercel plan choice, spend controls, security controls, observability, and performance posture.

---

## 0. Why Promagen cares about Pro

Promagen is a commercial Next.js app with real runtime behaviour: API routes calling OpenAI (gpt-5.4-mini for Call 3 prompt optimisation), cron jobs, Stripe payment flows, analytics, outbound affiliate redirects, and authority pages serving SEO + AI citation traffic. Multiple endpoints can create **real cost** if traffic spikes or abuse occurs.

## Scope clarity

This doc defines **Vercel Pro guardrails and deployment discipline**.

Monetisation is **not** defined here — see `docs/authority/paid_tier.md` and `docs/authority/stripe.md`.

On Pro, you get **risk containment** controls that matter as a solo builder:

- **Spend guardrails** (alerts + automated actions to cap surprise bills).
- **Traffic guardrails** (WAF rules so bots don't turn into upstream spend spikes).
- **Higher platform headroom** (fewer deployment/build/logging constraints while iterating).

---

## 1. Current Promagen Configuration

### 1.1 What Is Live

| Feature | Status |
|---------|--------|
| Vercel Pro plan | ✅ Active |
| Vercel Analytics | ✅ Wired in `layout.tsx` |
| SpeedInsights | ✅ Wired in `layout.tsx` (sampled) |
| GA4 | ✅ Wired via `google-analytics.tsx` (gated by `NEXT_PUBLIC_GA_MEASUREMENT_ID`) |
| AI citation detector | ✅ Wired (`use-ai-citation-detector.ts`) |
| Stripe (Pro Promagen) | ✅ Checkout, portal, webhooks live |
| 4 Vercel Crons | ✅ Promagen Users, Index Rating, Rankings, Learning Aggregation |
| Clerk auth | ✅ Production mode (`clerk.promagen.com`) |
| ISR on authority pages | ✅ `/platforms` revalidates daily (86400s) |
| Homepage | `force-dynamic` (fresh every request) |

### 1.2 Spend-Bearing Endpoints (Money Endpoints)

These endpoints call paid upstream APIs. Every one must be protected at the edge (WAF + rate limiting):

| Endpoint | Upstream | Risk |
|----------|----------|------|
| `/api/optimise-prompt` | **OpenAI** (gpt-5.4-mini) | Call 3 optimisation — per-request cost |
| `/api/generate-tier-prompts` | **OpenAI** (gpt-5.4-mini) | Tier prompt generation — per-request cost |
| `/api/score-prompt` | **OpenAI** (gpt-5.4-mini) | Prompt quality scoring — per-request cost |
| `/api/parse-sentence` | **OpenAI** (gpt-5.4-mini) | Human sentence parsing — per-request cost |
| `/api/fx` | Twelve Data / Fly gateway | FX rate data — per-request if cache misses |
| `/go/*` | None (redirect) | Outbound affiliate route — attractive to bots |

**Rule:** Any new endpoint that calls a paid external API must be added to this list and protected (WAF + rate limiting) before deploy.

---

## 2. Non-Negotiable Safety Rails

### 2.1 Spend Management

- Set alerts at 25% / 50% / 75% / 90% of monthly cap.
- Set a cap action (pause production deployments / webhook notify).
- Review spend dashboard weekly.

### 2.2 WAF Rules for Money Endpoints

Lock down all endpoints in §1.2:

- Rate limit per IP (protect against refresh forcing).
- Block obvious scanners (bad user agents, path probing).
- The OpenAI endpoints (`/api/optimise-prompt`, `/api/generate-tier-prompts`, `/api/score-prompt`, `/api/parse-sentence`) are the highest priority — each call costs real money.
- `/go/*` rate limit and challenge (bots love outbound redirect endpoints).

### 2.3 Cache Policies Are Cost Policies

Caching headers and server TTL are how you avoid paying per page view:

| Surface | Strategy | Rationale |
|---------|----------|-----------|
| Homepage | `force-dynamic` | Shows live data (Promagen Users, weather, Index Rating) |
| Authority pages (`/platforms`) | ISR daily (86400s) | SEO content, rarely changes |
| `/api/fx` | Server cache + CDN headers | Must not force upstream refresh |
| `/api/index-rating/ratings` | `s-maxage=30, stale-while-revalidate=30` | Frontend polls frequently |

---

## 3. Deployment Hygiene

### 3.1 Git-Connected Deployments

- Prefer Git-connected deployments for predictable builds.
- Use Preview deployments for branch testing.
- Document a "production promote" habit: deploy to preview → sanity check → promote.

### 3.2 Build Considerations (Next.js 16)

- `proxy.ts` replaces `middleware.ts` (Next.js 16 convention). If a deprecation warning appears, ensure no `middleware.ts` file exists.
- `pnpm` build may show "Ignored build scripts" for `@clerk/shared`, `@swc/core`, `sharp`. Run `pnpm approve-builds` if needed.

---

## 4. Pro Feature Inventory (Promagen-Relevant)

### 4.1 Commercial Posture & Account Controls

Pro enables commercial usage posture. Promagen operates as a commercial product with affiliate links, paid tiers (Stripe), and monetised features.

### 4.2 Spend Management

Prevents "bot spike → OpenAI/FX API spike → bill spike". Any new spend-bearing endpoint requires: (1) WAF protection, (2) rate limiting, (3) Spend Management thresholds reviewed.

### 4.3 Vercel Firewall / WAF

Protect:
- `/api/optimise-prompt`, `/api/generate-tier-prompts`, `/api/score-prompt`, `/api/parse-sentence` (OpenAI cost risk)
- `/api/fx` (paid upstream market data risk)
- `/go/*` (outbound affiliate route)
- Debug/trace endpoints (restrict access in production)

### 4.4 Rate Limiting

Platform rate limiting throttles abusive clients before they cause upstream work. Critical for OpenAI endpoints.

### 4.5 DDoS Mitigation & Challenge Mode

Keep the site usable during noise spikes. Avoid error storms that hide real bugs.

### 4.6 ISR / Caching

Authority pages use ISR with daily revalidation. Homepage is `force-dynamic` for live data. The caching contract must match between CDN headers and server TTL.

### 4.7 Cron Jobs

4 Vercel Crons are active — see `docs/authority/cron_jobs.md` for full details:

| Job | Schedule | Cost Impact |
|-----|----------|-------------|
| Promagen Users | Every 30 min | DB reads only |
| Index Rating | Daily 00:05 UTC | DB reads + writes |
| Rankings | Hourly | KV reads + writes |
| Learning | Daily 03:00 UTC | Heavy DB computation (14+ layers) |

### 4.8 Vercel Analytics + SpeedInsights

Both wired in `src/app/layout.tsx`. SpeedInsights is sampled. These are metered — treat as a cost surface but low-risk at current traffic.

---

## 5. Repo Touchpoints (Where Pro Intersects Code)

### 5.1 Spend-Bearing OpenAI Routes

- `src/app/api/optimise-prompt/route.ts` — Call 3 optimisation
- `src/app/api/generate-tier-prompts/route.ts` — Tier prompt generation
- `src/app/api/score-prompt/route.ts` — Quality scoring
- `src/app/api/parse-sentence/route.ts` — Human sentence conversion

### 5.2 FX API + Diagnostics

- `src/app/api/fx/route.ts` — Live FX data
- `src/app/api/fx/trace/route.ts` — FX diagnostics (never triggers upstream work)
- `src/app/api/fx/config/route.ts` — FX configuration
- `src/app/api/fx/selection/route.ts` — Pro user FX pair selection

### 5.3 Outbound Affiliate Redirects

- `src/app/go/[providerId]/route.ts` — Outbound redirect + click tracking

### 5.4 Edge "Front Door"

- `src/proxy.ts` — clerkMiddleware, CSP headers, admin gates, security headers, request IDs

### 5.5 Stripe Payment Routes

- `src/app/api/stripe/checkout/route.ts` — Create Checkout session
- `src/app/api/stripe/portal/route.ts` — Customer Portal session
- `src/app/api/stripe/webhook/route.ts` — Receive Stripe events
- `src/app/api/stripe/webhook/health/route.ts` — Webhook health check

### 5.6 Cron Routes

- `src/app/api/promagen-users/cron/route.ts`
- `src/app/api/index-rating/cron/route.ts`
- `src/app/api/cron/rankings/route.ts`
- `src/app/api/learning/aggregate/route.ts`

### 5.7 Analytics

- `src/app/layout.tsx` — Vercel Analytics + SpeedInsights
- `src/components/analytics/google-analytics.tsx` — GA4
- `src/components/analytics/ai-citation-detector.tsx` — AI crawler detection
- `src/lib/analytics/events.ts` — Event definitions

### 5.8 Health Endpoints

- `src/app/api/health/route.ts` — Basic health check
- `src/app/dev/health/page.tsx` — Dev health dashboard
- `src/app/health-check/page.tsx` — Public health check

### 5.9 Repo-Root Config

- `frontend/vercel.json` — Crons, headers, security (NOT the repo root `vercel.json`)
- `package.json` / `pnpm-lock.yaml`
- `next.config.ts`
- `tsconfig.json`

---

## 6. WAF Rule Pack (Promagen Baseline)

### 6.1 OpenAI Endpoints (Highest Priority)

- Allow only POST method.
- Rate limit per IP aggressively (these cost real money per call).
- Block obvious scanners and bots.
- Consider challenge mode under active abuse.

### 6.2 `/api/fx` Baseline

- Allow only GET.
- Rate limit per IP.
- Block obvious scanners.

### 6.3 `/go/*` Baseline

- Rate limit and/or challenge (bots love outbound redirect endpoints).
- Allow only GET, enforce strict parameter validation.

### 6.4 Trace/Debug Endpoints

- Restrict access (admin/dev-only).
- Block by default in production unless explicitly needed.

---

## 7. Spend Management Runbook

### 7.1 If Spend Spikes

1. Check WAF events for OpenAI endpoints and `/api/fx`.
2. Check runtime logs for request burst signatures.
3. Confirm caching headers are still aligned with server TTL.
4. If abuse: tighten WAF + increase rate limiting + challenge suspicious traffic.
5. If legitimate growth: increase cap intentionally, then optimise caching and upstream batching.

### 7.2 What "Good" Looks Like

- Spend is predictable and explained.
- Traffic spikes do not translate into upstream API call spikes.
- OpenAI and FX endpoints are calm under load because edge protection and caching absorb noise.

---

## 8. Documentation Integration Map

Rule: don't copy Pro guidance into every doc. Keep **this** document as the authority for Pro platform posture. In other docs, add a **single-line pointer** where Pro matters:

> "Platform authority (Spend Management + WAF + rate limiting): see `docs/authority/vercel-pro-promagen-playbook.md`."

### 8.1 Where Pointers Must Exist

- **api-3.md**: Call 3 uses OpenAI — Pro WAF protects these routes.
- **promagen-api-brain-v2.md**: Spend-bearing routes, budgets, TTL.
- **cron_jobs.md**: Cron compute costs and scheduling.
- **stripe.md**: Stripe webhook reliability depends on Vercel uptime.
- **ga4-gtm-nextjs-vercel.md**: Analytics scripts create metered usage.
- **api-documentation-twelvedata.md**: FX rate limits and paid usage.

---

## 9. Review Cadence

**Every release (or at least weekly):**

- Review Usage & Spend dashboards.
- Review WAF events for OpenAI endpoints, `/api/fx`, and `/go/*`.
- Review worst production errors in runtime logs.

**Monthly:**

- Re-check Spend Management thresholds and cap.
- Re-check whether any new endpoints should be protected.
- Re-check whether a Pro add-on is now justified (Observability Plus, Analytics Plus).

---

## 10. References

```text
Vercel pricing and plan features
- https://vercel.com/pricing

Vercel Pro plan
- https://vercel.com/docs/plans/pro-plan

Vercel limits
- https://vercel.com/docs/limits

Spend Management
- https://vercel.com/docs/spend-management

Vercel Firewall / WAF
- https://vercel.com/docs/vercel-firewall/vercel-waf
- https://vercel.com/docs/vercel-firewall/vercel-waf/custom-rules
- https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting

Runtime logs
- https://vercel.com/docs/logs/runtime
```

---

## Changelog

- **9 Apr 2026 (v2.0.0):** Major rewrite. Promoted OpenAI Call 3 routes to primary spend-bearing endpoints (§1.2). Updated from pre-monetisation posture to current state: Stripe live, GA4 wired, Vercel Analytics + SpeedInsights wired, 4 crons running, authority pages with ISR. Updated file references to `proxy.ts` (was `middleware.ts`). Added Stripe routes to §5. Restructured WAF recommendations to prioritise OpenAI endpoints. Removed speculative "Day-1 setup" framing — Pro is operational.
- **24 Dec 2025 (v1.0.0):** Initial playbook. Pre-monetisation posture, focused on FX and affiliate routes.

---

_This document is the authority for Vercel Pro platform posture. `src.zip` is the Single Source of Truth — if code and doc conflict, code wins._

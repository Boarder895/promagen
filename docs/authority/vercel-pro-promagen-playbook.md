# Vercel Pro for Promagen — Feature Map & Optimisation Playbook

**Last updated:** 24 December 2025  
**Owner:** Promagen  
**Existing features preserved:** Yes  
**Authority scope:** Vercel plan choice, spend controls, security controls, observability, and performance posture.

---

## 0. Why Promagen should care about Pro (even as a 1-person team)

Promagen is a Next.js web app with real runtime behaviour (API routes, caching, cron/background jobs, analytics, outbound redirects) and at least one endpoint that can create **real cost** if traffic spikes (for example, `/api/fx` calling paid upstream market-data APIs).
Scope clarity (avoid tier confusion)
This document is about Vercel’s platform plan (Pro) and operational guardrails.

It does NOT define Promagen’s product monetisation (free vs paid users).
That contract lives only in:
`C:\Users\Proma\Projects\promagen\docs\authority\paid_tier.md`

On Pro, you gain **adult supervision** controls that matter even more when you’re solo:

- **Spend guardrails** (alerts + automated actions so you don’t wake up to a surprise bill).
- **Traffic guardrails** (a proper WAF you can tune so bots and accidental spikes don’t turn into upstream spend spikes).
- **Higher platform headroom** (fewer deployment/build/logging constraints while you iterate hard).

Promagen posture: Pro isn’t about “team features”. It’s about **risk containment** + **reliability** while you scale from “it works locally” to “it earns money”.

---

## 1. Two immediate Promagen upgrades once you’re on Pro

1. **Turn on Spend Management thresholds** and set a sensible monthly cap while you stabilise deployments.

   - Treat this as a non-negotiable safety rail, not an “admin task for later”.

2. **Enable WAF rules for `/api/fx` (and any paid-upstream endpoints)** to stop bots or accidental traffic spikes turning into spend spikes.
   - Anything that can hit a paid provider must be protected _at the edge_, not “in code only”.

+1: **Integrate Pro Vercel into the rest of the documents to best use it — everywhere.**  
Meaning: any doc that introduces a spend-bearing endpoint, a tracking script, a cron job, or a public redirect route must include a **one-line pointer** to the Pro controls that guard cost and abuse (Spend Management + WAF + rate limiting).

---

## 2. How Pro pricing works (Promagen framing)

### 2.1 The mental model

- Pro is billed as a **monthly platform fee** plus **usage-based** charges.
- Pro includes a monthly **usage credit**.
- Pro includes baseline allowances for common platform usage (data transfer, edge requests, etc.).

Promagen posture: treat the included credit as your “normal operating envelope”, and treat usage beyond that as an exception that must be explained by a deliberate feature or genuine traffic growth.

### 2.2 Non-negotiable safety rails

1. **Spend Management**

   - Set alerts well below the cap.
   - Set an automated action at the cap (pause production deployments / webhook) so you _must_ investigate before further risk.

2. **WAF rules for expensive endpoints**

   - Lock down `/api/fx`, any `/api/*` routes that call paid upstream APIs, and the outbound redirect route (`/go/*`).
   - Rate-limit where sensible. Block obvious scanners. Challenge suspicious traffic.

3. **Cache policies are cost policies**
   - Caching headers and server TTL aren’t “performance tweaks” — they’re how you avoid paying per page view.
   - If caching lies, cost explodes. Promagen must keep **CDN-honest headers**.

---

## 3. Day-1 Pro setup checklist (do this before you chase bugs)

### 3.1 Billing & spend containment

- Enable **Spend Management**.
- Add thresholds (e.g. 25% / 50% / 75% / 90% of cap).
- Add a cap action (pause production deployments and/or webhook notify).
- Turn on billing notifications (email is fine for a solo builder; webhook later if you want automation).

### 3.2 Security & abuse containment

- Enable **WAF custom rules** (start with `/api/fx` + `/go/*`).
- Add **rate limiting** for `/api/fx` (protect upstream credits).
- Add **IP blocking** for obvious abusive IPs and scanner ranges as you spot them.
- Consider **Attack Challenge Mode** during active abuse.

### 3.3 Observability baseline

- Confirm runtime logs are visible and retained long enough to debug real production issues.
- If you use external logging, configure a **log drain** (optional early, valuable once you’re debugging intermittent issues).

### 3.4 Deployment hygiene (solo-friendly)

- Prefer **Git-connected deployments** for predictable builds.
- Use Preview deployments for branch testing (keep them protected if they expose endpoints).
- Document a “production promote” habit: deploy to preview → sanity check → promote.

---

## 4. Complete Pro feature inventory (and how Promagen uses it)

This section is intentionally “feature complete” **for Promagen’s use-cases** (Next.js app, API routes, spend-bearing upstream calls, analytics, affiliate/outbound routes, and long-term growth).

### 4.1 Commercial posture & account controls

**Pro gives you:**

- Commercial usage posture (your project is a product, not a personal sandbox).
- Team/account billing with usage credit model.
- Role-based access controls (RBAC) and activity logs (even if you’re solo, it matters when you later add a collaborator).

**Promagen uses it to:**

- Operate openly as a commercial product (affiliate links, paid tiers, monetised features).
- Keep security sane if/when you add a second person (contractor, designer, VA).

---

### 4.2 Spend Management (wallet guardrail)

**What it is:**

- Alerts + automated actions when spend crosses thresholds.

**Promagen uses it to:**

- Prevent “bot spike → `/api/fx` spike → upstream credits spike → bill spike”.
- Enforce a “no uncontrolled scaling” rule while you stabilise caching and budgets.

**Promagen rule:**

- Any new spend-bearing endpoint requires:  
  (1) WAF protection, (2) rate limiting, (3) Spend Management thresholds reviewed.

---

### 4.3 Vercel Firewall / WAF (traffic guardrail)

**Pro gives you (practically):**

- Enough **custom WAF rules** to protect multiple endpoints properly.
- Enough **IP blocking** capacity to respond quickly during abuse.
- A WAF event stream you can review as part of weekly ops.

**Promagen uses it to:**

- Protect:
  - `/api/fx` (paid upstream risk)
  - `/api/*` that calls paid providers (future: commodities, crypto, equities)
  - `/go/*` (outbound/affiliate route; attractive to bots)
  - Any “trace” endpoints (restrict access; never let them become public attack surfaces)

**Promagen default stance (WAF):**

- Public endpoints must be defensible at the edge.
- Debug/trace endpoints must be restricted (or disabled) in production.

---

### 4.4 Rate limiting (edge cost control)

**What it is:**

- Platform rate limiting so you can throttle abusive clients _before_ they cause upstream work.

**Promagen uses it to:**

- Enforce “no single IP can force refresh”.
- Protect `/api/fx` even if a client tries to hammer it.

---

### 4.5 DDoS mitigation & challenge mode

**What it is:**

- Platform DDoS mitigation and the ability to challenge suspicious traffic.

**Promagen uses it to:**

- Keep the site usable during noise spikes.
- Avoid error storms that hide real bugs.

---

### 4.6 Next.js platform features (performance + correctness)

**Vercel/Next gives you:**

- CDN delivery + automatic HTTPS
- Headers/redirects/rewrites (policy control)
- ISR/revalidation patterns (where appropriate)
- Image optimisation pipeline (metered; treat as a cost surface)

**Promagen uses it to:**

- Keep marketing/docs pages _fast_ without accidental dynamic rendering.
- Use cache headers as part of the cost-control contract.
- Avoid accidental “every request becomes compute”.

---

### 4.7 Functions, compute, and Fluid Compute

**What you get:**

- Serverless Functions for API routes.
- “Fluid” scaling behaviour (automatic concurrency scaling).

**Promagen uses it to:**

- Serve `/api/fx` from server authority (Refresh Gate + budget guard).
- Keep “trace” read-only and cheap.
- Avoid pushing spend logic into the client.

**Promagen runtime rule (important):**

- If your cost-control relies on in-memory caching and single-flight per instance, do not silently move spend-bearing roles to runtimes that change caching semantics without updating authority docs.

---

### 4.8 Cron jobs & scheduled work

**What it is:**

- Scheduled execution for background tasks.

**Promagen uses it to:**

- Periodic aggregation (e.g., “Promagen Users”, provider health, cache snapshots) **without** tying work to page views.
- Any job that hits paid upstream APIs must be budgeted + WAF-protected if externally triggerable.

---

### 4.9 Observability: runtime logs, tracing, drains

**What you get:**

- Runtime logs with longer retention on Pro.
- Observability features (logs, tracing, query/monitoring) and optional add-ons.

**Promagen uses it to:**

- Debug production faults without racing log expiry.
- Identify:
  - upstream failures vs mapping bugs vs budget blocks
  - whether caching is working
  - whether clients are multiplying requests (regressions)

---

### 4.10 Web Analytics & Speed Insights (growth + performance truth)

**What you get:**

- Vercel Web Analytics with longer reporting windows on Pro.
- Custom events and UTM support.
- Optional “Plus” add-on for longer retention / extras.
- Speed Insights for Core Web Vitals.

**Promagen uses it to:**

- Track conversion paths to affiliate clicks (without leaking secrets).
- Track UX performance on the homepage ribbon and leaderboard pages.
- Validate that “fast” is real (CWV), not vibes.

**Important cost note:**

- Analytics scripts add event volume and can add bandwidth usage. Treat analytics as a metered surface: keep events intentional.

---

### 4.11 Domains, DNS, SSL, and routing controls

**What you get:**

- Domain management with automatic TLS.
- Redirects/rewrites for clean canonical URLs.

**Promagen uses it to:**

- Enforce canonical domain and clean URL policy.
- Own outbound routing (`/go/*`) with explicit policies and protection.

---

### 4.12 Preview deployments (safe iteration)

**What you get:**

- Preview deployments per branch/PR.
- Shareable previews and collaboration hooks.

**Promagen uses it to:**

- Test changes to spend-bearing routes safely before production.
- Validate caching headers and WAF behaviour _before_ going live.

**Promagen preview rule:**

- Previews must not expose paid-upstream endpoints without protection (WAF/rate limit) or without “safe mode” gating.

---

### 4.13 Pro add-ons (not required, but worth knowing)

Pro explicitly supports add-ons such as:

- SAML Single Sign-On
- HIPAA BAA
- Flags Explorer
- Observability Plus
- Web Analytics Plus
- Speed Insights

Promagen view (solo builder):

- Most are “later”, except **Speed Insights** (performance truth) and possibly **Web Analytics Plus** if you want longer retention for growth analysis.

---

## 5. Promagen-specific Pro policies (this is the “maximise Pro” part)

### 5.1 The “Spend-bearing endpoint” rule

Any endpoint that can create third-party cost (paid market data, AI calls, affiliate redirects that invite bots) must have:

- Spend Management thresholds reviewed
- WAF rule coverage
- Rate limiting coverage
- Cache semantics reviewed
- A trace/diagnostic stance defined (and protected)

### 5.2 `/api/fx` posture (the money endpoint)

Promagen’s `/api/fx` should be treated like a payment endpoint, even though it’s “just data”:

- WAF: restrict, rate limit, challenge suspicious patterns
- Cache: edge-friendly but honest (no implied background refresh unless it cannot hit upstream)
- Runtime logs: always check for burst patterns and upstream error storms
- Client rule: do not ship UI fetches to `/api/fx` with `cache: 'no-store'` or cookies; that defeats edge caching and spikes origin/upstream calls.

### 5.3 “Trace endpoints must never spend money”

- `/api/fx/trace` must never trigger upstream work.
- Trace should prefer `no-store` caching so you never debug stale diagnostics.
- Trace should be WAF-restricted (dev-only or admin-only stance).

### 5.4 Centralised polling (protects spend)

Promagen must ensure multiple widgets do not multiply `/api/fx` calls. This is not optional — it is part of the cost-control contract.

### 5.5 What “integrate Vercel Pro” means in Promagen (code + dashboard)

To “integrate Vercel Pro” into Promagen properly, we’re really doing two things:

1. Wiring features that need code/config

- Caching that is CDN-honest (headers match the Refresh Gate TTL).
- Cron routes for cache warm-up + health checks (work happens off the request path).
- Analytics / Speed Insights wiring (kept intentional; avoid event spam).
- Hardened outbound redirects (`/go/*`) + click tracking (no open-redirect nonsense).
- Structured logging + request IDs (so Pro logs are actually useful).
- Preview-vs-production behaviour (safe mode, trace lockdown).

2. Switching on Pro controls in the Vercel dashboard

- Spend Management thresholds + a “cap action” (pause production deployments).
- WAF rules + rate limiting for “money endpoints” (`/api/fx` and `/go/*`).
- Challenge mode / IP blocks when abuse is detected.

Dashboard controls don’t require code changes — but your code must be shaped so those controls work cleanly.

#### 5.5.1 Promagen “money endpoints” (treat these like payment routes)

Start with only these two endpoints as “spend-bearing”:

- `/api/fx` (paid upstream market data risk)
- `/go/*` (public outbound redirect route; attractive to bots)

Everything else can stay “normal” until these are bulletproof.

#### 5.5.2 Repo touchpoints (where Pro actually changes the code)

Spend-bearing FX API + diagnostics

- `frontend/src/app/api/fx/route.ts`
- `frontend/src/app/api/fx/trace/route.ts`
- `frontend/src/lib/fx/fetch.ts`
- `frontend/src/lib/fx/live-source.ts`
- `frontend/src/lib/fx/route.ts`
- `frontend/src/lib/fx/freshness.ts`

Outbound affiliate redirects + click tracking

- `frontend/src/app/go/[providerId]/route.ts`
- `frontend/src/lib/affiliate/outbound.ts`
- `frontend/src/app/api/track-click/route.ts`
- `frontend/src/__tests__/go.outbound.route.test.ts`

Edge “front door” shaping (so WAF/rate limiting can be surgical)

- `frontend/src/middleware.ts`

Cron capability (cache warm + health checks off the request path)

- `frontend/src/app/api/promagen-users/cron/route.ts` (or equivalent cron route)

Analytics / Speed Insights wiring

- `frontend/src/app/layout.tsx`
- `frontend/src/lib/analytics/*` (or `frontend/src/lib/analytics.ts`)
- `frontend/src/components/analytics/google-analytics.tsx` (if active)

Health endpoint

- `frontend/src/app/api/health/route.ts`

Note: paths are expressed in “code-standard form” (`frontend/src/...`). If you keep your Next.js `src/` at repo root, the same paths apply without the `frontend/` prefix.

#### 5.5.3 Repo-root config required to do this properly (no guessing)

To add cron schedules, runtime tweaks, and dependency wiring safely, we also need the repo-root config in view:

- `package.json`
- lockfile (`pnpm-lock.yaml` / `package-lock.json` / `yarn.lock`)
- `next.config.js|mjs|ts`
- `tsconfig.json`
- `vercel.json` (or create it if it doesn’t exist)
- `.env.example` (or wherever env vars are documented)

#### 5.5.4 Delivery approach (fast + safe)

Best default: 2 passes

Go 1 — Platform wiring (low risk, high leverage)

- `vercel.json` (crons, redirects/rewrites if needed)
- tighten `middleware.ts` (security headers, request IDs, predictable routing)
- harden `/go/*` + click tracking (so WAF/rate limiting won’t break it)
- make `/api/fx` cache-friendly (headers + idempotency)
- hook analytics/speed in a controlled way (and keep them out of preview if desired)

Go 2 — Spend-proofing + observability (where the real value is)

- refresh gate: block “force refresh” unless explicitly allowed
- safe mode behaviour (preview/demo/stale-if-error)
- structured logs around provider selection + cache hit/miss
- cron warm-up + provider health checks (so page views don’t pay the price)

## 6. WAF rule pack (Promagen baseline)

Start simple and iterate based on WAF events.

### 6.1 `/api/fx` baseline

- Allow only required methods (typically GET).
- Rate limit per IP (protect against refresh forcing).
- Block obvious scanners (bad user agents, path probing).
- Consider challenge mode under active abuse.

### 6.2 `/go/*` baseline

- Rate limit and/or challenge (bots love outbound redirect endpoints).
- Consider allowing only GET and enforcing strict parameter validation.

### 6.3 Trace endpoints

- Restrict access (admin/dev-only).
- Block by default in production unless explicitly needed.

---

## 7. Spend Management runbook (what to do when spend rises)

### 7.1 If spend spikes

1. Check WAF events for `/api/fx` and `/go/*`.
2. Check runtime logs for request burst signatures.
3. Confirm caching headers are still aligned with server TTL.
4. If abuse is present: tighten WAF + increase rate limiting + challenge suspicious traffic.
5. If it’s legitimate growth: increase cap intentionally, then optimise caching and upstream batching.

### 7.2 What “good” looks like

- Spend is predictable and explained.
- Traffic spikes do not translate into upstream spikes.
- `/api/fx` is calm under load because edge protection and caching absorb noise.

---

## 8. “Integrate Pro Vercel everywhere” — documentation integration map (no duplication)

Rule: don’t copy/paste Pro guidance into every doc. Instead:

- Keep **this** document as the authority for Pro platform posture.
- In other docs, add a **single-line pointer** where Pro matters.

Add pointers like:

> “Platform authority (Spend Management + WAF + rate limiting): see `docs/authority/vercel-pro-promagen-playbook.md`.”

### 8.1 Where pointers must exist

- **Promagen API Brain v2**: where spend-bearing routes, budgets, TTL, and platform gotchas are defined.
- **Ribbon Homepage spec**: where `/api/fx` polling, caching, and “no multiplied requests” are defined.
- **Twelve Data docs**: where rate limits/429s and paid usage are referenced (Pro protects you from bots forcing paid calls).
- **GA4/GTM doc**: where analytics scripts can create metered usage (events + data transfer).
- **Fly v2 doc** (if used): clarify which spend-bearing workloads run on Vercel vs Fly, and which platform’s guardrails apply.

---

## 9. Review cadence (how we keep maximising Pro)

**Every release (or at least weekly):**

- Review Usage & Spend dashboards.
- Review WAF events for `/api/fx` and `/go/*`.
- Review worst production errors in runtime logs.

**Monthly:**

- Re-check Spend Management thresholds and cap.
- Re-check whether any new endpoints should be protected (anything that calls paid APIs).
- Re-check whether a Pro add-on is now justified (Speed Insights, Observability Plus, Analytics Plus).

---

## 10. References (official pages)

```text
Vercel pricing and plan features
- https://vercel.com/pricing

Vercel Pro plan
- https://vercel.com/docs/plans/pro-plan

Vercel limits (deployments/day, logs retention, etc.)
- https://vercel.com/docs/limits

Build queues / concurrency slots
- https://vercel.com/docs/builds/build-queues

Spend Management (alerts + pause production deployments)
- https://vercel.com/docs/spend-management

Vercel Firewall / WAF
- https://vercel.com/docs/vercel-firewall/vercel-waf
- https://vercel.com/docs/vercel-firewall/vercel-waf/custom-rules
- https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting
- https://vercel.com/docs/vercel-firewall/vercel-waf/ip-blocking

Runtime logs
- https://vercel.com/docs/logs/runtime

Web Analytics limits and pricing
- https://vercel.com/docs/analytics/limits-and-pricing
```

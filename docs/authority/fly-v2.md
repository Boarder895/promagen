# Promagen Fly.io Brain – Deployment & Cost Model (v2)

## Authority scope (read first)

- Primary deploy target for the **frontend** is Vercel.
- Fly.io is **optional** infrastructure for backend/gateway/worker workloads.
- Monetisation boundaries live only in `docs/authority/paid_tier.md`.
- API calming, caching, and budget guards are defined in `docs/authority/promagen-api-brain-v2.md`.
- Vercel Pro operational guardrails are defined in `docs/authority/vercel-pro-promagen-playbook.md`.

## 0. Goal

Promagen needs somewhere for its backend logic to live—if we want to do anything truly “big boy” (API orchestration, caching, provider fallback, auth, payments, job queues), we need a proper server or worker runtime.

Fly.io is ideal because:

- Cheap, always-on
- Deploy from Docker easily
- Full Linux server control
- Can scale from small to monstrous

This document defines:

- What runs on Vercel vs Fly
- How cost scales

1. Fly.io’s role in Promagen
   1.1 Home for backend API routes
   Your Next.js project already has backend routes under something like:
   • frontend/src/app/api/\* (Next.js App Router API routes)
   In local development, these behave as server endpoints. In production, they need a real server platform.
   Fly.io provides the container that runs those backend routes so they can:
   • Proxy external APIs (Twelve Data, FMP, OilPriceAPI, etc.).
   • Normalise responses into Promagen’s internal shapes.
   • Enforce paid-tier rules and feature flags.
   • Serve your /api/\_ endpoints to the frontend.
   Example routes Promagen might expose via Fly.io:
   • /api/fx – hitting your primary FX provider for fx.ribbon (no cross-provider fallback; cache/ride-cache handled server-side).
   • /api/holidays/check – calling a calendar/market-holidays API.
   • /api/crypto/live – live crypto data for the homepage ribbon.
   • /api/ai/providers – internal AI provider scores and metadata.
   These are your APIs, not external ones. Fly.io runs the container that serves them.
   1.2 Offloading work away from the browser
   The browser cannot safely hold API keys, nor should it fan out directly to rate-limited third-party APIs.
   Fly.io gives Promagen:
   • Environment variables / secret storage for API keys.
   • Choice of regions (e.g. London) for low-latency calls to providers.
   • Autoscaling / machine sizing so you can grow gradually.
   • Long-lived containers that behave like “tiny Linux workstations in the sky”.
   Promagen’s backend uses this to:
   • Call external APIs securely.
   • Aggregate data server-side.
   • Apply quota and caching rules centrally.
   • Send only the necessary data down to the UI.
   1.3 Scheduler for background jobs
   Promagen has several background tasks that make far more sense on a persistent backend than inside request/response handlers:
   • “Warm cache” jobs for FX rates.
   • Real-time crypto buffers.
   • Daily commodity synchronisation.
   • Hourly exchange metadata updates.
   • Provider score calculations and trend updates.
   Fly.io lets you run these as:
   • Tiny machines with background loops.
   • Cron-style scheduled jobs.
   This allows you to:
   • Aggregate multiple UI needs into a single batch call.
   • Keep responses warm in cache.
   • Avoid hammering paid APIs for every page view.
   1.4 Escape hatch when serverless is too restrictive
   Vercel is excellent for the frontend and short-lived serverless functions.

### Promagen note: Vercel Pro as the “front door” (guardrails + spend control)

- Canonical Vercel Pro playbook: `C:\Users\Proma\Projects\promagen\docs\authority\vercel-pro-promagen-playbook.md`
- Keep Vercel as the edge/CDN/WAF layer even if some compute moves to Fly.
- Treat WAF rules + Spend Management as _platform_ safety rails; code-level safe-mode/kill-switches are the _second_ line of defence.
  However, some Promagen workloads will eventually be too “muscular” for edge/serverless:
  • Long-running tasks.
  • Big JSON transformations.
  • Background queues and fan-out calls.
  • Scripts that exceed typical edge timeouts.
  Fly.io gives you full Linux machines (still small and cost-controlled) without those constraints.
  Promagen will grow naturally into work that needs:
  • Continuous processes.
  • State across invocations.
  • Richer scheduling than “run for a few seconds and die”.
  Fly.io is the platform for that class of work.
  1.5 The glue between Promagen and many external APIs
  Fly.io does not provide FX/crypto/commodities data. It:
  • Stores your private API keys.
  • Runs your “rate collector” and normalisation logic.
  • Produces your internal, Promagen-shaped JSON.
  • Protects users from hitting third-party rate limits directly.
  • Protects your wallet from API overuse.
  • Makes it easy to swap providers without UI changes.
  In plain language:
  • External API providers give you the data.
  • Fly.io hosts the logic that collects, normalises, caches, and serves that data to your frontend.

---

2. Fly.io pricing primitives
   Fly.io uses usage-based billing:
   • You pay for compute (machines), storage, and network egress.
   • There are optional support / service tiers on top.
   Key components:
1. Compute (Fly Machines / VMs)
   o Billed based on vCPU, RAM, and uptime.
   o Auto-scaling and idle-shutdown can reduce cost by stopping machines at low traffic periods.
1. Storage (persistent volumes)
   o Billed roughly per GB per month (e.g. on the order of ~$0.15/GB-month in typical analyses).
1. Bandwidth / egress
   o Outbound data to users and external services is billed per GB (example ballpark: ~$0.02/GB in Europe/North America; exact numbers depend on region).
1. Support / service tiers
   o Optional standard support plans (e.g. around $29/month) for additional guarantees and help.
1. Legacy vs new billing
   o Older accounts may have access to a legacy “free tier” or low flat plans; newer accounts are primarily usage-based.
   Promagen’s cost is therefore a function of:
   • How many machines you run, where, and at what size.
   • How much persistent storage you attach.
   • How much data you send out (API responses, dashboards, websockets).
   • Whether you add paid support.

---

3. Promagen-specific cost drivers
   As Promagen grows, these are the levers that affect your Fly.io bill:
1. Compute / VMs
   o Machine size (vCPU/RAM) and uptime for your backend workers and API routes.
   o Multiple regions = multiple sets of machines and cost per region.
1. Storage
   o Persistent volumes for:
    Caching rates.
    User-related data (if stored server-side).
    Logs and historical metrics.
   o Volume size × price/GB/month.
1. Bandwidth / egress
   o Data sent from Fly.io to your users (dashboards, live updates).
   o Data sent to other services.
   o Inter-region transfers if you run multiple regions (e.g. London ↔ Singapore).
1. Support / premium services
   o Optional if you want SLAs or higher support responsiveness for paid users.
1. Regions / redundancy
   o Global footprint (e.g. London + New York + Singapore) gives better latency but multiplies compute cost.
1. Scale / growth
   o More users → more traffic → more compute, storage, and egress.
   o Costs scale fairly linearly, especially if you optimise caching and batch calls.

---

4. Example “ball-park” stack
   A simple, concrete example (not tied yet to a specific user count):
   • One backend VM in London, 2 GB RAM, always on: roughly $20–40/month.
   • Storage: 50 GB persistent cache at ~$0.15/GB-month → around $7.50/month.
   • Bandwidth: 500 GB/month at ~$0.02/GB → around $10/month.
   • Support plan (if used): about $29/month.
   Total rough base: $50–90/month. As you add regions and traffic, costs can move into a $200–500/month range or higher, but only if you actually have the usage to justify it.

---

5. Three-stage Promagen cost model (GBP)
   To make this more actionable, we model three realistic stages for Promagen, in British pounds.
   5.1 Stage 1 – Lean Launch (0–500 users/day)
   A small but professional deployment for early beta.
   Assumptions
   • One region (London).
   • One small machine hosting your backend API routes.
   • Light traffic: ~200–500 visitors per day.
   • Light outbound bandwidth.
   • APIs called via your backend.
   • Minimal persistent storage.
   Likely Fly.io costs (per month)
   • Compute (small VM 24/7): ~£12–£25.
   • Storage (5–10 GB): ~£1–£2.
   • Bandwidth (100–200 GB): ~£2–£4.
   • Optional support tier: ~£20.
   • Misc overhead: £3–£5.
   Ballpark total (pricing varies — verify against Fly.io pricing): £20–£55/month. Promagen is cheap to run here – ideal for your first public version.
   5.2 Stage 2 – Mid-Scale Growth (2,000–5,000 users/day)
   Traffic increases; you have paying users; more people refresh FX, crypto, commodities frequently.
   Assumptions
   • Two regions (e.g. London + New York) for lower latency.
   • Medium-sized machines with autoscaling.
   • 2,000–5,000 visitors per day.
   • Higher outbound bandwidth (market data + UI updates).
   • Around 50 GB storage for caches and logs.
   • Hourly background jobs.
   Likely Fly.io costs (per month)
   • Compute (2 mid-size machines with autoscaling): £60–£120.
   • Storage (50 GB): £7–£8.
   • Bandwidth (500–1,000 GB): £10–£20.
   • Internal routing / overhead: £5–£10.
   • Optional support: ~£20.
   Ballpark total (pricing varies — verify against Fly.io pricing): £100–£180/month. This is when Promagen feels “alive” and responsive for a global-ish audience.
   5.3 Stage 3 – Fully Scaled Global
   Promagen is popular, with users across Asia, Europe, and the Americas. High-frequency FX, commodities, and crypto traffic, plus richer analytics and heavier caching.
   Assumptions
   • 3–5 regions (e.g. London, New York, Frankfurt, Singapore, São Paulo).
   • Several machines per region with autoscaling.
   • Heavy bandwidth: 4–10 TB/month.
   • Around 150 GB of persistent storage for historical data, caches, logs.
   • Background tasks running every few minutes.
   • High resilience and internal load balancing.
   Likely Fly.io costs (per month)
   • Compute (multiple machines): £200–£700.
   • Storage (150 GB): ~£20.
   • Bandwidth (4–10 TB): £80–£200.
   • Global load balancing / internal network: £10–£30.
   • Support tier: £20–£40.
   • Occasional scaling spikes: £50–£120.
   Ballpark total (pricing varies — verify against Fly.io pricing): £350–£1,100/month – still modest for a global-ish platform and usually cheaper than an equivalent AWS setup.

---

6. Cost optimisation and guardrails
   To avoid surprises:
   • Monitor egress volumes carefully – especially if your dashboards ever include video or heavy real-time charts.
   • Use auto-scaling / idle shutdown so machines don’t run at full cost during quiet periods.
   • Keep region count sensible – every region adds its own machines and costs.
   • Lean on caching and rate-limiting so the backend doesn’t spam external APIs or dump unnecessary data to clients.
   • Build cost monitoring and alerting early so you don’t discover a nasty bill after the fact.
   The nicest property of Fly.io for Promagen is:
   • You start tiny.
   • You only scale cost when real traffic forces you to.
   • Nothing pushes you into the £300+ range until you actually have the users to justify it.

---

7. How this ties back to the API Brain (v2)
   Fly.io is where the API Brain becomes a running organism:
   src/data/api/providers.registry.json tells your Fly workers which upstream providers exist, how to authenticate (via environment variables), and which adapter should normalise each provider’s payload.
   src/data/api/roles.policies.json tells them which provider powers each role (feature) and what cache TTL applies (for example, the FX ribbon role uses Twelve Data with a 30-minute cache).
   Budget guardrails (FX ribbon)
   Budget guardrails (FX ribbon)

The FX ribbon enforces a soft “budget” model to avoid accidental overuse of paid market-data APIs.

Configure these via environment variables (so limits match your provider plan without code changes):

FX_RIBBON_BUDGET_DAILY_ALLOWANCE — daily credit allowance for the ribbon (set this to your plan, e.g. 800).

FX_RIBBON_BUDGET_MINUTE_ALLOWANCE — per-minute allowance (optional; use if you want a hard minute cap).

FX_RIBBON_BUDGET_MINUTE_WINDOW_SECONDS — window size for the minute allowance.

Note: Twelve Data credit usage is per symbol.
The FX ribbon enforces a soft “budget” model to avoid accidental overuse of paid market-data APIs.

Configure these via environment variables (so limits match your provider plan without code changes):

FX_RIBBON_BUDGET_DAILY_ALLOWANCE — daily credit allowance for the ribbon (set this to your plan, e.g. 800).

FX_RIBBON_BUDGET_MINUTE_ALLOWANCE — per-minute allowance (optional; use if you want a hard minute cap).

FX_RIBBON_BUDGET_MINUTE_WINDOW_SECONDS — window size for the minute allowance.

Note: Twelve Data credit usage is per symbol.

SSOT for what the UI shows (including FX pair metadata and ribbon defaults) lives in `frontend/src/data/fx/fx.pairs.json` and `docs/authority/ribbon-homepage.md`.

Fly.io hosts:
the gateway runtime that loads the Brain JSON files and resolves a role to its provider list,
the worker logic that performs the HTTP call(s) and hands payloads to the adapter layer for normalisation,
the cache layer that keeps data warm for your ribbons (and returns mode: "cached" when serving within TTL).
In the current operating model there is one live provider (Twelve Data) and no synthetic/demo mode. The only active modes are live and cached; fallback is reserved for the future when backup providers are reintroduced.
Promagen on Fly.io becomes:
“Promagen: powered by many APIs under one unified logic layer, running on an infrastructure platform that you control.”

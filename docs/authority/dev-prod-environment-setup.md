# Dev & Prod Environment Setup

> **Location:** `docs/authority/dev-prod-environment-setup.md`  
> **Created:** 20 January 2026  
> **Last Updated:** 9 April 2026  
> **Version:** 2.0.0  
> **Purpose:** Single source of truth for environment configuration across DEV and PROD.

---

## Overview

Promagen uses a **two-service architecture**:

| Service | DEV URL | PROD URL |
|---------|---------|----------|
| **Frontend** (Next.js 16 on Vercel) | `http://localhost:3000` | `https://promagen.com` |
| **Gateway** (Node.js on Fly.io) | `http://localhost:8080` | `https://promagen-api.fly.dev` |

**Data flow:**

```
┌─────────────┐    SSOT Config    ┌─────────────┐
│  Frontend   │ ◄──────────────── │   Gateway   │
│  (Next.js)  │                   │  (Fly.io)   │
│             │ ──────────────────►│             │
└─────────────┘    API Data       └─────────────┘
```

1. Gateway → Frontend: Gateway fetches SSOT configs (cities, FX pairs, etc.) from frontend on startup
2. Frontend → Gateway: Frontend proxies API requests to gateway for live market/weather data

---

## Critical Principle: Startup Order

**DEV requires correct startup order:**

```
1. Frontend FIRST  →  Gateway can fetch /api/*/config endpoints
2. Gateway SECOND  →  Initializes feeds from frontend SSOT
```

If gateway starts before frontend, weather (and other feeds) will fail to initialize.

---

## 1. Frontend Environment Variables

### 1.1 Complete Reference (All Environments)

#### Gateway Connection

| Variable | DEV Value | PROD Value | Purpose |
|----------|-----------|------------|---------|
| `GATEWAY_URL` | `http://localhost:8080` | `https://promagen-api.fly.dev` | Server-side API routes |
| `NEXT_PUBLIC_GATEWAY_URL` | `http://localhost:8080` | `https://promagen-api.fly.dev` | Client-side hooks |

#### Authentication (Clerk)

| Variable | DEV Value | PROD Value | Purpose |
|----------|-----------|------------|---------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_test_xxx` | `pk_live_xxx` | Clerk client SDK |
| `CLERK_SECRET_KEY` | `sk_test_xxx` | `sk_live_xxx` | Clerk server SDK |
| `NEXT_PUBLIC_CLERK_FAPI` | — | `clerk.promagen.com` | Clerk Frontend API domain |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/sign-in` | `/sign-in` | Sign-in redirect |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/sign-up` | `/sign-up` | Sign-up redirect |
| `ADMIN_USER_IDS` | Your Clerk user ID | Comma-separated IDs | Admin gate in proxy.ts |

#### Payments (Stripe)

| Variable | DEV Value | PROD Value | Purpose |
|----------|-----------|------------|---------|
| `STRIPE_SECRET_KEY` | `sk_test_xxx` | `sk_live_xxx` | Stripe API |
| `STRIPE_WEBHOOK_SECRET` | `whsec_xxx` | `whsec_xxx` | Webhook signature verification |
| `STRIPE_PRICE_MONTHLY` | Price ID | Price ID | Monthly plan Stripe Price |
| `STRIPE_PRICE_ANNUAL` | Price ID | Price ID | Annual plan Stripe Price |

#### AI (OpenAI — Call 3 Optimisation)

| Variable | DEV Value | PROD Value | Purpose |
|----------|-----------|------------|---------|
| `OPENAI_API_KEY` | `sk-xxx` | `sk-xxx` | gpt-5.4-mini for prompt optimisation |

#### Database (Neon Postgres)

| Variable | DEV Value | PROD Value | Purpose |
|----------|-----------|------------|---------|
| `DATABASE_URL` | Neon connection string | Neon connection string | Primary DB connection |
| `POSTGRES_URL` | (fallback) | (fallback) | Neon/Vercel Postgres fallback |

#### Vercel KV (Redis)

| Variable | DEV Value | PROD Value | Purpose |
|----------|-----------|------------|---------|
| `VERCEL_KV_HTTP_BASE` | — | Auto-set by Vercel | KV store for voting/rankings |
| `VERCEL_KV_TOKEN` | — | Auto-set by Vercel | KV auth token |

#### Cron Jobs

| Variable | DEV Value | PROD Value | Purpose |
|----------|-----------|------------|---------|
| `PROMAGEN_CRON_SECRET` | Your secret (16+ chars) | Your secret (16+ chars) | All 4 cron endpoints |

#### Analytics

| Variable | DEV Value | PROD Value | Purpose |
|----------|-----------|------------|---------|
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | — | `G-XXXXXXXXXX` | GA4 (disabled if empty) |
| `NEXT_PUBLIC_GA_ENABLED` | `false` | `true` | GA4 kill switch |
| `NEXT_PUBLIC_GA_SAMPLE_RATE` | — | `100` | GA4 sample rate |
| `NEXT_PUBLIC_ANALYTICS_ENABLED` | `false` | `true` | Custom analytics |

#### Feature Flags

| Variable | DEV Value | PROD Value | Purpose |
|----------|-----------|------------|---------|
| `NEXT_PUBLIC_DEMO_JITTER` | `true` | `true` | Demo users + index jitter |
| `NEXT_PUBLIC_DEMO_MODE` | `true` | — | Full demo mode |
| `NEXT_PUBLIC_FX_LIVE` | `true` | `true` | Live FX data |
| `NEXT_PUBLIC_FX_RIBBON_DEMO_MODE` | `true` | — | FX ribbon demo prices |
| `PHASE_6_SCORING_ENABLED` | `true` | `true` | Learning Phase 6 |
| `PHASE_7_LEARNING_ENABLED` | `true` | `true` | Learning Phase 7 |

#### Build & Deployment

| Variable | DEV Value | PROD Value | Purpose |
|----------|-----------|------------|---------|
| `NEXT_PUBLIC_CANONICAL_HOST` | — | `promagen.com` | Canonical URL enforcement |
| `NEXT_PUBLIC_ENFORCE_CANONICAL` | — | `1` | 301 redirect non-canonical hosts |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | `https://promagen.com` | OG images, sitemap |
| `PROMAGEN_DEV_HEALTH_TOKEN` | Your token | Your token | Dev health endpoint auth |

---

## 2. Gateway Environment Variables

### 2.1 Gateway `.env.local` (DEV)

**File:** `C:\Users\Proma\Projects\promagen\gateway\.env.local`

```env
# API Keys
TWELVEDATA_API_KEY=your_key
MARKETSTACK_API_KEY=your_key
OPENWEATHERMAP_API_KEY=your_key

# Frontend SSOT
FRONTEND_BASE_URL=http://localhost:3000

# Derived automatically from FRONTEND_BASE_URL:
# FX_CONFIG_URL=http://localhost:3000/api/fx/config
# CRYPTO_CONFIG_URL=http://localhost:3000/api/crypto/config
# INDICES_CONFIG_URL=http://localhost:3000/api/indices/config
# COMMODITIES_CONFIG_URL=http://localhost:3000/api/commodities/config
# WEATHER_CONFIG_URL=http://localhost:3000/api/weather/config
```

### 2.2 Gateway Fly.io Secrets (PROD)

```powershell
cd C:\Users\Proma\Projects\promagen\gateway
flyctl secrets set TWELVEDATA_API_KEY="your_key"
flyctl secrets set MARKETSTACK_API_KEY="your_key"
flyctl secrets set OPENWEATHERMAP_API_KEY="your_key"
flyctl secrets set FRONTEND_BASE_URL="https://promagen.com"
```

---

## 3. DEV Startup Commands

### Terminal 1 — Frontend (FIRST)

```powershell
cd C:\Users\Proma\Projects\promagen\frontend
pnpm install
pnpm dev
```

Wait for `✓ Ready in X.Xs`

### Terminal 2 — Gateway (SECOND)

```powershell
cd C:\Users\Proma\Projects\promagen\gateway
pnpm install
pnpm dev
```

Wait for `Promagen Gateway listening on http://0.0.0.0:8080`

---

## 4. DEV Verification Checklist

### A) Frontend SSOT config

```powershell
Invoke-RestMethod "http://localhost:3000/api/weather/config" | ConvertTo-Json -Depth 6
```

Expected: `cities` array with entries, `selectedExchangeIds` array, `generatedAt` timestamp.

### B) Gateway initialized

```powershell
Invoke-RestMethod "http://localhost:8080/trace" | ConvertTo-Json -Depth 8
```

Expected: `weather.initialized: true`, `totalCities` populated.

### C) Gateway returns live weather

```powershell
Invoke-RestMethod "http://localhost:8080/weather" | ConvertTo-Json -Depth 4
```

Expected: `meta.mode` = `"live"` or `"cached"` (NOT `"fallback"`).

### D) Frontend proxy works

```powershell
Invoke-RestMethod "http://localhost:3000/api/weather" | ConvertTo-Json -Depth 4
```

Expected: Same data as step C.

### E) Visual confirmation

Open `http://localhost:3000/`, hard refresh. Exchange cards show real temperatures.

---

## 5. PROD Deployment

### Frontend → Vercel

```powershell
cd C:\Users\Proma\Projects\promagen\frontend
Remove-Item -Recurse -Force .next    # Clear cache (critical on every deploy)
git add -A
git commit -m "description"
git push                              # Vercel auto-deploys
```

### Gateway → Fly

```powershell
cd C:\Users\Proma\Projects\promagen\gateway
flyctl deploy
```

### Test Command (Frontend)

```powershell
cd C:\Users\Proma\Projects\promagen\frontend
pnpm run test:util
```

---

## 6. PROD Verification Checklist

### A) Gateway health

```powershell
Invoke-RestMethod "https://promagen-api.fly.dev/health"
```

### B) Gateway SSOT

```powershell
Invoke-RestMethod "https://promagen-api.fly.dev/trace" | ConvertTo-Json -Depth 8
```

Expected: `FRONTEND_BASE_URL: "https://promagen.com"`, `weather.initialized: true`.

### C) Frontend proxy

```powershell
Invoke-RestMethod "https://promagen.com/api/weather" | ConvertTo-Json -Depth 4
```

### D) Visual: `https://promagen.com/` — exchange cards show real temperatures.

---

## 7. Troubleshooting

### Frontend `/api/weather` returns empty data in DEV

Check `frontend/.env.local` has `GATEWAY_URL=http://localhost:8080`. Restart dev server after editing.

### Gateway `weather.initialized: false`

Start frontend before gateway. If already running, restart gateway.

### `.env.local` changes not taking effect

Next.js caches env vars. Stop server, optionally delete `.next`, run `pnpm dev` again.

### Server-side `auth()` returns null on Vercel

Known issue with `@clerk/nextjs` v6.x on Next.js 16. Use `getSessionFromCookie()` pattern instead. See `clerk-auth.md` §2.2.

### Crons not running

Check `frontend/vercel.json` has `?secret=$PROMAGEN_CRON_SECRET` on all cron paths. See `cron_jobs.md` §Cron Security.

---

## Changelog

| Date | Change |
|------|--------|
| 9 Apr 2026 | v2.0.0: Added all frontend env vars (Clerk, Stripe, OpenAI, Neon, KV, GA4, cron, feature flags). Added deploy workflow with .next clearing. Added test command. Added troubleshooting for auth and crons. |
| 20 Jan 2026 | v1.0.0: Document created covering DEV and PROD gateway/frontend setup. |

---

_This document is the authority for environment configuration. `src.zip` is the Single Source of Truth. Critical rules: (1) DEV: start frontend before gateway. (2) Always clear `.next` cache on deploy. (3) Test with `pnpm run test:util`._

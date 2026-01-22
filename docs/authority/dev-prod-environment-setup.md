# Dev & Prod Environment Setup

> **Location:** `docs/authority/dev-prod-environment-setup.md`  
> **Created:** Jan 20, 2026  
> **Purpose:** Single source of truth for environment configuration across DEV and PROD.

---

## Overview

Promagen uses a **two-service architecture**:

| Service                          | DEV URL                 | PROD URL                       |
| -------------------------------- | ----------------------- | ------------------------------ |
| **Frontend** (Next.js on Vercel) | `http://localhost:3000` | `https://promagen.com`         |
| **Gateway** (Node.js on Fly.io)  | `http://localhost:8080` | `https://promagen-api.fly.dev` |

**Data flow:**

```
┌─────────────┐    SSOT Config    ┌─────────────┐
│  Frontend   │ ◄──────────────── │   Gateway   │
│  (Next.js)  │                   │  (Fly.io)   │
│             │ ──────────────────► │             │
└─────────────┘    API Data       └─────────────┘
```

1. **Gateway → Frontend:** Gateway fetches SSOT configs (cities, FX pairs, etc.) from frontend on startup
2. **Frontend → Gateway:** Frontend proxies API requests to gateway for live market/weather data

---

## Critical Principle: Startup Order

**DEV requires correct startup order:**

```
1. Frontend FIRST  →  Gateway can fetch /api/*/config endpoints
2. Gateway SECOND  →  Initializes feeds from frontend SSOT
```

If gateway starts before frontend, weather (and other feeds) will fail to initialize.

---

## 1. DEV Environment Setup

### 1.1 Frontend `.env.local`

**File:** `C:\Users\Proma\Projects\promagen\frontend\.env.local`

**Required variables:**

```env
# =============================================================================
# GATEWAY CONNECTION (Server-side routes use this)
# =============================================================================
GATEWAY_URL=http://localhost:8080

# =============================================================================
# GATEWAY CONNECTION (Client-side code uses this)
# =============================================================================
NEXT_PUBLIC_GATEWAY_URL=http://localhost:8080
```

**Rules:**

- `GATEWAY_URL` is used by server-side API routes (e.g., `/api/weather`, `/api/fx`)
- `NEXT_PUBLIC_GATEWAY_URL` is used by client-side hooks and components
- Both must point to the **local gateway** in DEV
- Do NOT include `GATEWAY_URL=https://promagen-api.fly.dev` in this file (that's for Vercel)

### 1.2 Gateway `.env.local`

**File:** `C:\Users\Proma\Projects\promagen\gateway\.env.local`

**Required variables:**

```env
# =============================================================================
# API KEYS (Required for live data)
# =============================================================================
TWELVEDATA_API_KEY=your_twelvedata_key_here
MARKETSTACK_API_KEY=your_marketstack_key_here
OPENWEATHERMAP_API_KEY=your_openweathermap_key_here

# =============================================================================
# FRONTEND SSOT URLs (Point to local frontend in DEV)
# =============================================================================
FRONTEND_BASE_URL=http://localhost:3000

FX_CONFIG_URL=http://localhost:3000/api/fx/config
CRYPTO_CONFIG_URL=http://localhost:3000/api/crypto/config
INDICES_CONFIG_URL=http://localhost:3000/api/indices/config
COMMODITIES_CONFIG_URL=http://localhost:3000/api/commodities/config
WEATHER_CONFIG_URL=http://localhost:3000/api/weather/config

# =============================================================================
# BUDGET LIMITS (Optional - defaults are sensible)
# =============================================================================
OPENWEATHERMAP_BUDGET_DAILY=1000
OPENWEATHERMAP_BUDGET_MINUTE=60
```

**Rules:**

- All `*_CONFIG_URL` variables must point to `http://localhost:3000` in DEV
- API keys must be real (no demo/synthetic data policy)
- If any key is missing, that feed returns `null` prices (as designed)

---

## 2. DEV Startup Commands

### 2.1 Terminal 1 — Start Frontend (FIRST)

```powershell
cd C:\Users\Proma\Projects\promagen\frontend
pnpm install
pnpm dev
```

**Wait until you see:** `✓ Ready in X.Xs`

### 2.2 Terminal 2 — Start Gateway (SECOND)

```powershell
cd C:\Users\Proma\Projects\promagen\gateway
pnpm install
pnpm dev
```

**Wait until you see:** `Promagen Gateway listening on http://0.0.0.0:8080`

---

## 3. DEV Verification Checklist

Run these commands **in order**. Each must pass before proceeding.

### A) Frontend serves SSOT config correctly

```powershell
Invoke-RestMethod "http://localhost:3000/api/weather/config" | ConvertTo-Json -Depth 6
```

**Expected:**

- `cities` array with 40+ entries
- `selectedExchangeIds` array with 16 entries
- `generatedAt` timestamp present

### B) Gateway initializes from frontend config

```powershell
Invoke-RestMethod "http://localhost:8080/trace" | ConvertTo-Json -Depth 8
```

**Expected under `weather`:**

- `initialized: true`
- `totalCities: 48` (or similar)
- `batchACount: 24`
- `batchBCount: 24`

### C) Gateway returns live weather data

```powershell
Invoke-RestMethod "http://localhost:8080/weather" | ConvertTo-Json -Depth 4
```

**Expected:**

- `meta.mode` = `"live"` or `"cached"` (NOT `"fallback"`)
- `data` array has objects with `temperatureC`, `city`, `emoji`, etc.
- `meta.budget.dailyUsed` > 0 (proves API was called)

### D) Frontend proxy returns gateway data (THE CRITICAL ONE)

```powershell
Invoke-RestMethod "http://localhost:3000/api/weather" | ConvertTo-Json -Depth 4
```

**Expected:**

- Same data as step C
- `meta.mode` = `"live"` or `"cached"`
- `data` array NOT empty

**If this returns empty `data: []`:** Your frontend is not reading `GATEWAY_URL` correctly. Check:

1. `frontend/.env.local` has `GATEWAY_URL=http://localhost:8080`
2. Restart the frontend dev server after editing `.env.local`

### E) Homepage shows real weather (visual confirmation)

1. Open: `http://localhost:3000/`
2. Hard refresh: `Ctrl+F5`
3. Check exchange cards show real temperatures (not "—" placeholders)

---

## 4. PROD Environment Setup

### 4.1 Vercel Environment Variables

**Location:** Vercel Dashboard → Project → Settings → Environment Variables

| Variable                  | Value                          | Scope      |
| ------------------------- | ------------------------------ | ---------- |
| `GATEWAY_URL`             | `https://promagen-api.fly.dev` | Production |
| `NEXT_PUBLIC_GATEWAY_URL` | `https://promagen-api.fly.dev` | Production |

**Note:** Vercel reads these at build time and runtime. Changes require redeployment.

### 4.2 Fly.io Secrets

**Set via CLI:**

```powershell
cd C:\Users\Proma\Projects\promagen\gateway

flyctl secrets set TWELVEDATA_API_KEY="your_key_here"
flyctl secrets set MARKETSTACK_API_KEY="your_key_here"
flyctl secrets set OPENWEATHERMAP_API_KEY="your_key_here"
flyctl secrets set FRONTEND_BASE_URL="https://promagen.com"
```

**Note:** Fly auto-restarts when secrets change. For code changes, use `flyctl deploy`.

### 4.3 Fly.io Environment (fly.toml)

The gateway derives SSOT URLs from `FRONTEND_BASE_URL` automatically:

```toml
[env]
  PORT = "8080"
  NODE_ENV = "production"
  # FRONTEND_BASE_URL set via secrets → derives all *_CONFIG_URL values
```

---

## 5. PROD Verification Checklist

Run after deploying to Vercel and Fly.

### A) Gateway health check

```powershell
Invoke-RestMethod "https://promagen-api.fly.dev/health"
```

**Expected:** `{ status: "ok", ... }`

### B) Gateway trace shows SSOT from promagen.com

```powershell
Invoke-RestMethod "https://promagen-api.fly.dev/trace" | ConvertTo-Json -Depth 8
```

**Expected under `environment`:**

- `FRONTEND_BASE_URL: "https://promagen.com"`
- `WEATHER_CONFIG_URL: "https://promagen.com/api/weather/config"`

**Expected under `weather`:**

- `initialized: true`
- `totalCities: 48`
- `cache.hasData: true`

### C) Gateway returns live weather

```powershell
Invoke-RestMethod "https://promagen-api.fly.dev/weather" | ConvertTo-Json -Depth 4
```

**Expected:**

- `meta.mode` = `"cached"` or `"live"`
- `data` array has weather objects

### D) Frontend proxy returns gateway data

```powershell
Invoke-RestMethod "https://promagen.com/api/weather" | ConvertTo-Json -Depth 4
```

**Expected:** Same data as step C.

### E) Visual confirmation

1. Open: `https://promagen.com/`
2. Hard refresh: `Ctrl+Shift+R`
3. Exchange cards show real temperatures

---

## 6. Troubleshooting

### Problem: Frontend `/api/weather` returns empty data in DEV

**Cause:** `GATEWAY_URL` not set or wrong in `frontend/.env.local`

**Fix:**

1. Open `C:\Users\Proma\Projects\promagen\frontend\.env.local`
2. Ensure this line exists: `GATEWAY_URL=http://localhost:8080`
3. Remove any line like: `GATEWAY_URL=https://promagen-api.fly.dev`
4. Restart frontend: `Ctrl+C` then `pnpm dev`

### Problem: Gateway `/trace` shows `weather.initialized: false`

**Cause:** Gateway started before frontend, or frontend config endpoint is broken

**Fix:**

1. Stop both servers
2. Start frontend first: `pnpm dev` in frontend folder
3. Wait for "Ready" message
4. Start gateway: `pnpm dev` in gateway folder

### Problem: Gateway shows `OPENWEATHERMAP_API_KEY: MISSING`

**Cause:** Key not in `gateway/.env.local`

**Fix:**

1. Add `OPENWEATHERMAP_API_KEY=your_real_key` to `gateway/.env.local`
2. Restart gateway

### Problem: PROD shows `weather.initialized: false`

**Cause:** Fly gateway can't reach `https://promagen.com/api/weather/config`

**Fix:**

1. Check Vercel deployment is live: `curl https://promagen.com/api/weather/config`
2. Redeploy gateway: `flyctl deploy`
3. Check secrets: `flyctl secrets list`

### Problem: `.env.local` changes not taking effect

**Cause:** Next.js caches env vars; need full restart

**Fix:**

1. Stop dev server completely (`Ctrl+C`)
2. Delete `.next` folder (optional but thorough)
3. Run `pnpm dev` again

---

## 7. Environment Variable Reference

### Frontend Variables

| Variable                  | DEV Value               | PROD Value                     | Used By            |
| ------------------------- | ----------------------- | ------------------------------ | ------------------ |
| `GATEWAY_URL`             | `http://localhost:8080` | `https://promagen-api.fly.dev` | Server-side routes |
| `NEXT_PUBLIC_GATEWAY_URL` | `http://localhost:8080` | `https://promagen-api.fly.dev` | Client-side code   |

### Gateway Variables

| Variable                 | DEV Value               | PROD Value             | Notes                   |
| ------------------------ | ----------------------- | ---------------------- | ----------------------- |
| `TWELVEDATA_API_KEY`     | Your key                | Fly secret             | FX + Crypto             |
| `MARKETSTACK_API_KEY`    | Your key                | Fly secret             | Indices                 |
| `OPENWEATHERMAP_API_KEY` | Your key                | Fly secret             | Weather                 |
| `FRONTEND_BASE_URL`      | `http://localhost:3000` | `https://promagen.com` | Derives all config URLs |
| `WEATHER_CONFIG_URL`     | (derived)               | (derived)              | Auto-derived from base  |

---

## 8. Quick Reference: Common Commands

### DEV Startup (in order)

```powershell
# Terminal 1 - Frontend
cd C:\Users\Proma\Projects\promagen\frontend
pnpm dev

# Terminal 2 - Gateway (after frontend is ready)
cd C:\Users\Proma\Projects\promagen\gateway
pnpm dev
```

### DEV Verification (quick)

```powershell
# Gateway has data?
(Invoke-RestMethod "http://localhost:8080/weather").meta.mode

# Frontend proxies correctly?
(Invoke-RestMethod "http://localhost:3000/api/weather").meta.mode
```

### PROD Deployment

```powershell
# Frontend → Vercel
cd C:\Users\Proma\Projects\promagen\frontend
git push  # Vercel auto-deploys

# Gateway → Fly
cd C:\Users\Proma\Projects\promagen\gateway
flyctl deploy
```

### PROD Verification (quick)

```powershell
(Invoke-RestMethod "https://promagen-api.fly.dev/weather").meta.mode
(Invoke-RestMethod "https://promagen.com/api/weather").meta.mode
```

---

## Changelog

| Date       | Change                                       |
| ---------- | -------------------------------------------- |
| 2026-01-20 | Document created covering DEV and PROD setup |

---

_This document is the authority for environment configuration. All wiring decisions should reference this doc._

_**Critical rules:** (1) DEV: start frontend before gateway. (2) DEV: both `.env.local` files must point to `localhost`. (3) PROD: Fly derives config URLs from `FRONTEND_BASE_URL`. (4) Always restart after env changes._

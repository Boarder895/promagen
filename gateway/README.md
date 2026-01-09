# Promagen API Gateway

## Overview

This gateway sits between Vercel (frontend) and TwelveData (upstream API), providing:

- **Persistent caching** (survives across requests - no cold start reset)
- **Request deduplication** (100 simultaneous requests = 1 API call)
- **Budget management** (800/day, 8/minute limits)
- **Circuit breaker** (stops calling on 429/5xx)
- **Background refresh** (cache always warm)
- **Graceful degradation** (serve stale data on failure)

## Endpoints

| Path | Description |
|------|-------------|
| `GET /health` | Health check (used by Fly.io) |
| `GET /fx` | FX ribbon data |
| `GET /trace` | Debug info (budget, circuit, cache status) |

## Deployment

### Prerequisites

1. Fly CLI installed (`fly version`)
2. Logged in (`fly auth login`)
3. TwelveData API key set (`fly secrets set TWELVEDATA_API_KEY=xxx -a promagen-api`)

### Deploy

From this `gateway/` folder:

```powershell
cd C:\Users\Proma\Projects\promagen\gateway
fly deploy -a promagen-api
```

### Verify

```powershell
# Check status
fly status -a promagen-api

# Check logs
fly logs -a promagen-api

# Test health endpoint
curl https://promagen-api.fly.dev/health

# Test FX endpoint
curl https://promagen-api.fly.dev/fx
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TWELVEDATA_API_KEY` | (required) | Your TwelveData API key |
| `FX_RIBBON_BUDGET_DAILY_ALLOWANCE` | 800 | Max API calls per day |
| `FX_RIBBON_BUDGET_MINUTE_ALLOWANCE` | 8 | Max API calls per minute |
| `FX_RIBBON_TTL_SECONDS` | 300 | Cache TTL (5 minutes) |
| `ALLOWED_ORIGINS` | promagen.com,localhost:3000 | CORS allowed origins |

## Local Development

```powershell
# Install dependencies
npm install

# Set API key
$env:TWELVEDATA_API_KEY="your-key-here"

# Run dev server
npm run dev
```

## Architecture

```
Browser → Vercel (/api/fx) → Fly.io Gateway → TwelveData
                                    ↓
                             [In-Memory Cache]
                             [Budget Tracking]
                             [Circuit Breaker]
```

## Cost

- **Fly.io**: ~$2-3/month (1 small machine, London)
- **TwelveData**: Free tier (800/day)
